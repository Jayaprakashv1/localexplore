import { supabase } from './supabase';
import { cacheGet, cacheSet, cacheRemove, cacheRemoveByPrefix, TTL } from './cache';
import { enqueue } from './offlineQueue';

// ── Network guard helper ──────────────────────────────────────────────────────
let _isOnline = true;
/** Call this from NetworkContext to keep the database layer in sync. */
export function setNetworkStatus(online: boolean) {
  _isOnline = online;
}
function isOnline() {
  return _isOnline;
}

export type PlaceType = 'place' | 'restaurant' | 'activity' | 'food';

export interface Trip {
  id: string;
  user_id: string;
  title: string;
  destination: string;
  start_date?: string;
  end_date?: string;
  notes?: string;
  is_public: boolean;
  member_count: number;
  created_at: string;
}

export interface TripMember {
  id: string;
  trip_id: string;
  user_id: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface PublicTrip extends Trip {
  my_status: 'pending' | 'approved' | 'rejected' | null;
}

export interface TripItem {
  id: string;
  trip_id: string;
  user_id: string;
  place_name: string;
  place_type: PlaceType;
  location: string;
  description?: string;
  rating?: number;
  notes?: string;
  visit_order: number;
  created_at: string;
}

export interface SavedPlace {
  id: string;
  place_name: string;
  place_type: PlaceType;
  location: string;
  description?: string;
  rating?: number;
  created_at: string;
}

export async function savePlace(
  place_name: string,
  place_type: PlaceType,
  location: string,
  description?: string,
  rating?: number
) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('User not authenticated');

  if (!place_name?.trim() || !place_type || !location?.trim()) {
    throw new Error('Place name, type, and location are required');
  }

  if (place_name.length > 255 || location.length > 255) {
    throw new Error('Place name and location must be less than 255 characters');
  }

  const alreadySaved = await isSaved(place_name, location);
  if (alreadySaved) {
    throw new Error('This place is already saved');
  }

  const payload = {
    user_id: user.id,
    place_name: place_name.trim(),
    place_type,
    location: location.trim(),
    description: description?.trim() || null,
    rating: rating && rating > 0 && rating <= 5 ? rating : null,
  };

  if (!isOnline()) {
    // Optimistic local update — add a synthetic entry to cache
    const cacheKey = `saved_places_${user.id}`;
    const cached = (await cacheGet<SavedPlace[]>(cacheKey)) ?? [];
    const optimistic: SavedPlace = {
      id: `offline_${Date.now()}`,
      place_name: payload.place_name,
      place_type: payload.place_type,
      location: payload.location,
      description: payload.description ?? undefined,
      rating: payload.rating ?? undefined,
      created_at: new Date().toISOString(),
    };
    await cacheSet(cacheKey, [optimistic, ...cached], TTL.SAVED_PLACES);
    await enqueue('savePlace', payload as Record<string, unknown>);
    return;
  }

  const { error } = await supabase.from('saved_places').insert(payload);
  if (error) throw error;

  // Invalidate saved-places cache so next load gets fresh data
  await cacheRemove(`saved_places_${user.id}`);
}

export async function unsavePlace(placeId: string) {
  if (!placeId?.trim()) {
    throw new Error('Place ID is required');
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('User not authenticated');

  if (!isOnline()) {
    // Optimistic removal from cache
    const cacheKey = `saved_places_${user.id}`;
    const cached = (await cacheGet<SavedPlace[]>(cacheKey)) ?? [];
    await cacheSet(cacheKey, cached.filter(p => p.id !== placeId), TTL.SAVED_PLACES);
    await enqueue('unsavePlace', { placeId, userId: user.id });
    return;
  }

  const { error } = await supabase
    .from('saved_places')
    .delete()
    .eq('id', placeId)
    .eq('user_id', user.id);

  if (error) throw error;
  await cacheRemove(`saved_places_${user.id}`);
}

export async function getSavedPlaces(): Promise<SavedPlace[]> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return [];

  const cacheKey = `saved_places_${user.id}`;

  if (!isOnline()) {
    return (await cacheGet<SavedPlace[]>(cacheKey)) ?? [];
  }

  const { data, error } = await supabase
    .from('saved_places')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  const result = data || [];
  await cacheSet(cacheKey, result, TTL.SAVED_PLACES);
  return result;
}

export async function getSavedPlacesByLocation(location: string): Promise<SavedPlace[]> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return [];

  if (!location?.trim()) {
    return [];
  }

  // Use the full saved-places cache if available (filtered by location)
  const cacheKey = `saved_places_${user.id}`;
  const cached = await cacheGet<SavedPlace[]>(cacheKey);
  if (cached) {
    return cached.filter(p => p.location === location.trim());
  }

  if (!isOnline()) return [];

  const { data, error } = await supabase
    .from('saved_places')
    .select('*')
    .eq('user_id', user.id)
    .eq('location', location.trim())
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function isSaved(place_name: string, location: string): Promise<boolean> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return false;

  if (!place_name?.trim() || !location?.trim()) {
    return false;
  }

  // Fast path — consult local cache first to avoid a round-trip
  const cacheKey = `saved_places_${user.id}`;
  const cached = await cacheGet<SavedPlace[]>(cacheKey);
  if (cached) {
    return cached.some(
      p => p.place_name === place_name.trim() && p.location === location.trim()
    );
  }

  if (!isOnline()) return false;

  const { data, error } = await supabase
    .from('saved_places')
    .select('id')
    .eq('user_id', user.id)
    .eq('place_name', place_name.trim())
    .eq('location', location.trim())
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

/** Batch check which place names (in a given location) are saved.
 *  Returns a Set of saved place names. Avoids N+1 queries. */
export async function isSavedBatch(placeNames: string[], location: string): Promise<Set<string>> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return new Set();
  if (!placeNames.length || !location?.trim()) return new Set();

  // Use cache if available
  const cacheKey = `saved_places_${user.id}`;
  const cached = await cacheGet<SavedPlace[]>(cacheKey);
  if (cached) {
    const saved = new Set<string>();
    for (const p of cached) {
      if (p.location === location.trim() && placeNames.includes(p.place_name)) {
        saved.add(p.place_name);
      }
    }
    return saved;
  }

  if (!isOnline()) return new Set();

  const { data, error } = await supabase
    .from('saved_places')
    .select('place_name')
    .eq('user_id', user.id)
    .eq('location', location.trim())
    .in('place_name', placeNames);

  if (error) throw error;
  return new Set((data || []).map(r => r.place_name));
}

export async function addSearchHistory(location: string) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return;

  const trimmedLocation = location?.trim();
  if (!trimmedLocation || trimmedLocation.length > 255) return;

  // Optimistically update local cache immediately
  const cacheKey = `search_history_${user.id}`;
  const cached = (await cacheGet<string[]>(cacheKey)) ?? [];
  const updated = [trimmedLocation, ...cached.filter(l => l !== trimmedLocation)].slice(0, 10);
  await cacheSet(cacheKey, updated, TTL.SEARCH_HISTORY);

  if (!isOnline()) {
    await enqueue('addSearchHistory', { location: trimmedLocation, userId: user.id });
    return;
  }

  try {
    await supabase.from('search_history').insert({
      user_id: user.id,
      location: trimmedLocation,
    });
  } catch (error) {
    console.error('Failed to add search history:', error);
  }
}

export async function getSearchHistory(): Promise<string[]> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return [];

  const cacheKey = `search_history_${user.id}`;

  if (!isOnline()) {
    return (await cacheGet<string[]>(cacheKey)) ?? [];
  }

  const { data, error } = await supabase
    .from('search_history')
    .select('location')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw error;
  const result = data?.map(item => item.location).filter(Boolean) || [];
  await cacheSet(cacheKey, result, TTL.SEARCH_HISTORY);
  return result;
}

export async function clearSearchHistory() {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return;

  // Clear local cache immediately
  await cacheRemove(`search_history_${user.id}`);

  if (!isOnline()) {
    await enqueue('clearSearchHistory', { userId: user.id });
    return;
  }

  const { error } = await supabase
    .from('search_history')
    .delete()
    .eq('user_id', user.id);

  if (error) throw error;
}

// ── Trip Planner ─────────────────────────────────────────────────────────────

export async function createTrip(
  title: string,
  destination: string,
  start_date?: string,
  end_date?: string,
  is_public: boolean = false
): Promise<Trip> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('User not authenticated');

  if (!title?.trim() || !destination?.trim()) {
    throw new Error('Trip title and destination are required');
  }

  if (!isOnline()) {
    // Create optimistic trip locally
    const optimistic: Trip = {
      id: `offline_${Date.now()}`,
      user_id: user.id,
      title: title.trim(),
      destination: destination.trim(),
      start_date: start_date || undefined,
      end_date: end_date || undefined,
      is_public,
      member_count: 0,
      created_at: new Date().toISOString(),
    };
    const cacheKey = `trips_${user.id}`;
    const cached = (await cacheGet<Trip[]>(cacheKey)) ?? [];
    await cacheSet(cacheKey, [optimistic, ...cached], TTL.TRIPS);
    await enqueue('createTrip', { title: title.trim(), destination: destination.trim(), start_date, end_date, is_public, userId: user.id } as Record<string, unknown>);
    return optimistic;
  }

  const { data, error } = await supabase
    .from('trips')
    .insert({
      user_id: user.id,
      title: title.trim(),
      destination: destination.trim(),
      start_date: start_date || null,
      end_date: end_date || null,
      is_public,
    })
    .select()
    .single();

  if (error) throw error;
  await cacheRemove(`trips_${user.id}`);
  return data;
}

export async function getTrips(): Promise<Trip[]> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return [];

  const cacheKey = `trips_${user.id}`;

  if (!isOnline()) {
    return (await cacheGet<Trip[]>(cacheKey)) ?? [];
  }

  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  const result = data || [];
  await cacheSet(cacheKey, result, TTL.TRIPS);
  return result;
}

export async function deleteTrip(tripId: string): Promise<void> {
  if (!tripId?.trim()) throw new Error('Trip ID is required');

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('User not authenticated');

  if (!isOnline()) {
    // Remove from cache optimistically
    const cacheKey = `trips_${user.id}`;
    const cached = (await cacheGet<Trip[]>(cacheKey)) ?? [];
    await cacheSet(cacheKey, cached.filter(t => t.id !== tripId), TTL.TRIPS);
    await cacheRemove(`trip_items_${tripId}`);
    await cacheRemove(`trip_members_${tripId}`);
    await enqueue('deleteTrip', { tripId, userId: user.id });
    return;
  }

  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('id', tripId)
    .eq('user_id', user.id);

  if (error) throw error;
  await cacheRemove(`trips_${user.id}`);
  await cacheRemove(`trip_items_${tripId}`);
  await cacheRemove(`trip_members_${tripId}`);
}

export async function getTripItems(tripId: string): Promise<TripItem[]> {
  if (!tripId?.trim()) return [];

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return [];

  const cacheKey = `trip_items_${tripId}`;

  if (!isOnline()) {
    return (await cacheGet<TripItem[]>(cacheKey)) ?? [];
  }

  // RLS handles row-level access: the policy allows the trip owner (auth.uid() = user_id)
  // AND approved trip members (is_approved_trip_member). We must NOT add an extra
  // .eq('user_id', user.id) filter here or approved members in the Feed would get 0 rows.
  const { data, error } = await supabase
    .from('trip_items')
    .select('*')
    .eq('trip_id', tripId)
    .order('visit_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  const result = data || [];
  await cacheSet(cacheKey, result, TTL.TRIP_ITEMS);
  return result;
}

export async function addTripItem(
  tripId: string,
  place_name: string,
  place_type: PlaceType,
  location: string,
  description?: string,
  rating?: number
): Promise<void> {
  if (!tripId?.trim() || !place_name?.trim() || !location?.trim()) {
    throw new Error('Trip ID, place name, and location are required');
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('User not authenticated');

  // Check duplicate against cache first
  const cacheKey = `trip_items_${tripId}`;
  const cachedItems = await cacheGet<TripItem[]>(cacheKey);
  if (cachedItems?.some(i => i.place_name === place_name.trim())) {
    throw new Error('This place is already in the trip');
  }

  if (!isOnline()) {
    const visitOrder = cachedItems?.length ?? 0;
    const optimistic: TripItem = {
      id: `offline_${Date.now()}`,
      trip_id: tripId,
      user_id: user.id,
      place_name: place_name.trim(),
      place_type,
      location: location.trim(),
      description: description?.trim() || undefined,
      rating: rating && rating > 0 && rating <= 5 ? rating : undefined,
      visit_order: visitOrder,
      created_at: new Date().toISOString(),
    };
    await cacheSet(cacheKey, [...(cachedItems ?? []), optimistic], TTL.TRIP_ITEMS);
    await enqueue('addTripItem', { tripId, place_name: place_name.trim(), place_type, location: location.trim(), description, rating, userId: user.id } as Record<string, unknown>);
    return;
  }

  const { data: existing } = await supabase
    .from('trip_items')
    .select('id')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .eq('place_name', place_name.trim())
    .maybeSingle();

  if (existing) throw new Error('This place is already in the trip');

  const { data: countData } = await supabase
    .from('trip_items')
    .select('id', { count: 'exact' })
    .eq('trip_id', tripId);

  const visitOrder = countData?.length || 0;

  const { error } = await supabase.from('trip_items').insert({
    trip_id: tripId,
    user_id: user.id,
    place_name: place_name.trim(),
    place_type,
    location: location.trim(),
    description: description?.trim() || null,
    rating: rating && rating > 0 && rating <= 5 ? rating : null,
    visit_order: visitOrder,
  });

  if (error) throw error;
  await cacheRemove(cacheKey);
}

export async function removeTripItem(itemId: string, tripId?: string): Promise<void> {
  if (!itemId?.trim()) throw new Error('Item ID is required');

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('User not authenticated');

  if (!isOnline()) {
    // Optimistically remove from the specific trip item cache if tripId is known
    if (tripId) {
      const cacheKey = `trip_items_${tripId}`;
      const cached = await cacheGet<TripItem[]>(cacheKey);
      if (cached) {
        await cacheSet(cacheKey, cached.filter(i => i.id !== itemId), TTL.TRIP_ITEMS);
      }
    }
    await enqueue('removeTripItem', { itemId, tripId, userId: user.id });
    return;
  }

  const { error } = await supabase
    .from('trip_items')
    .delete()
    .eq('id', itemId)
    .eq('user_id', user.id);

  if (error) throw error;
  // Invalidate the trip items cache if we know the trip
  if (tripId) await cacheRemove(`trip_items_${tripId}`);
}

// ── Trip Visibility ───────────────────────────────────────────────────────────

export async function updateTripVisibility(tripId: string, is_public: boolean): Promise<void> {
  if (!tripId?.trim()) throw new Error('Trip ID is required');

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('User not authenticated');

  if (!isOnline()) {
    // Update cache optimistically
    const cacheKey = `trips_${user.id}`;
    const cached = await cacheGet<Trip[]>(cacheKey);
    if (cached) {
      await cacheSet(cacheKey, cached.map(t => t.id === tripId ? { ...t, is_public } : t), TTL.TRIPS);
    }
    await enqueue('updateTripVisibility', { tripId, is_public, userId: user.id } as Record<string, unknown>);
    return;
  }

  const { error } = await supabase
    .from('trips')
    .update({ is_public })
    .eq('id', tripId)
    .eq('user_id', user.id);

  if (error) throw error;
  await cacheRemove(`trips_${user.id}`);
}

// ── Trip Members ──────────────────────────────────────────────────────────────

export async function getTripMembers(tripId: string): Promise<TripMember[]> {
  if (!tripId?.trim()) return [];

  const cacheKey = `trip_members_${tripId}`;

  if (!isOnline()) {
    return (await cacheGet<TripMember[]>(cacheKey)) ?? [];
  }

  const { data, error } = await supabase
    .from('trip_members')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  const result = data || [];
  await cacheSet(cacheKey, result, TTL.TRIP_MEMBERS);
  return result;
}

export async function requestToJoinTrip(tripId: string): Promise<void> {
  if (!tripId?.trim()) throw new Error('Trip ID is required');

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('User not authenticated');

  const email = user.email;
  if (!email) throw new Error('User email not available');

  if (!isOnline()) {
    await enqueue('requestToJoinTrip', { tripId, userId: user.id, email });
    return;
  }

  const { error } = await supabase.from('trip_members').insert({
    trip_id: tripId,
    user_id: user.id,
    email,
    status: 'pending',
  });

  if (error) {
    if (error.code === '23505') throw new Error('You have already requested to join this trip');
    throw error;
  }
  await cacheRemove(`trip_members_${tripId}`);
}

export async function approveJoinRequest(memberId: string): Promise<void> {
  if (!memberId?.trim()) throw new Error('Member ID is required');

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('User not authenticated');

  if (!isOnline()) {
    await enqueue('approveJoinRequest', { memberId, userId: user.id });
    return;
  }

  const { error } = await supabase
    .from('trip_members')
    .update({ status: 'approved' })
    .eq('id', memberId);

  if (error) throw error;
}

export async function rejectJoinRequest(memberId: string): Promise<void> {
  if (!memberId?.trim()) throw new Error('Member ID is required');

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('User not authenticated');

  if (!isOnline()) {
    await enqueue('rejectJoinRequest', { memberId, userId: user.id });
    return;
  }

  const { error } = await supabase
    .from('trip_members')
    .update({ status: 'rejected' })
    .eq('id', memberId);

  if (error) throw error;
}

export async function cancelJoinRequest(tripId: string): Promise<void> {
  if (!tripId?.trim()) throw new Error('Trip ID is required');

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('User not authenticated');

  if (!isOnline()) {
    await enqueue('cancelJoinRequest', { tripId, userId: user.id });
    return;
  }

  const { error } = await supabase
    .from('trip_members')
    .delete()
    .eq('trip_id', tripId)
    .eq('user_id', user.id);

  if (error) throw error;
  await cacheRemove(`trip_members_${tripId}`);
}

export async function getMyMembershipStatus(
  tripId: string
): Promise<'pending' | 'approved' | 'rejected' | null> {
  if (!tripId?.trim()) return null;

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data, error } = await supabase
    .from('trip_members')
    .select('status')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  return (data?.status as 'pending' | 'approved' | 'rejected') || null;
}

// ── Public Feed ───────────────────────────────────────────────────────────────

export async function getPublicTrips(): Promise<PublicTrip[]> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return [];

  const cacheKey = `public_feed_${user.id}`;

  if (!isOnline()) {
    return (await cacheGet<PublicTrip[]>(cacheKey)) ?? [];
  }

  const { data: trips, error } = await supabase
    .from('trips')
    .select('*')
    .eq('is_public', true)
    .neq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!trips || trips.length === 0) {
    await cacheSet(cacheKey, [], TTL.PUBLIC_FEED);
    return [];
  }

  const tripIds = trips.map(t => t.id);

  const { data: myMemberships } = await supabase
    .from('trip_members')
    .select('trip_id, status')
    .eq('user_id', user.id)
    .in('trip_id', tripIds);

  const membershipMap = new Map(
    (myMemberships || []).map(m => [m.trip_id, m.status as 'pending' | 'approved' | 'rejected'])
  );

  const result = trips.map(trip => ({
    ...trip,
    my_status: membershipMap.get(trip.id) || null,
  }));

  await cacheSet(cacheKey, result, TTL.PUBLIC_FEED);
  return result;
}

// ── User Stats (Profile Screen) ───────────────────────────────────────────────

export interface UserStats {
  savedCount: number;
  tripCount: number;
  pendingJoinRequests: number;
}

export async function getUserStats(): Promise<UserStats> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { savedCount: 0, tripCount: 0, pendingJoinRequests: 0 };

  const cacheKey = `user_stats_${user.id}`;

  if (!isOnline()) {
    return (await cacheGet<UserStats>(cacheKey)) ?? { savedCount: 0, tripCount: 0, pendingJoinRequests: 0 };
  }

  const [savedRes, tripsRes, pendingRes] = await Promise.allSettled([
    supabase.from('saved_places').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('trips').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('trip_members').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'pending'),
  ]);

  const stats: UserStats = {
    savedCount: savedRes.status === 'fulfilled' ? (savedRes.value.count ?? 0) : 0,
    tripCount: tripsRes.status === 'fulfilled' ? (tripsRes.value.count ?? 0) : 0,
    pendingJoinRequests: pendingRes.status === 'fulfilled' ? (pendingRes.value.count ?? 0) : 0,
  };

  await cacheSet(cacheKey, stats, TTL.TRIPS);
  return stats;
}
