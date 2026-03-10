import { supabase } from './supabase';

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

  const { error } = await supabase.from('saved_places').insert({
    user_id: user.id,
    place_name: place_name.trim(),
    place_type,
    location: location.trim(),
    description: description?.trim() || null,
    rating: rating && rating > 0 && rating <= 5 ? rating : null,
  });

  if (error) throw error;
}

export async function unsavePlace(placeId: string) {
  if (!placeId?.trim()) {
    throw new Error('Place ID is required');
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('saved_places')
    .delete()
    .eq('id', placeId)
    .eq('user_id', user.id);

  if (error) throw error;
}

export async function getSavedPlaces(): Promise<SavedPlace[]> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return [];

  const { data, error } = await supabase
    .from('saved_places')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getSavedPlacesByLocation(location: string): Promise<SavedPlace[]> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return [];

  if (!location?.trim()) {
    return [];
  }

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

export async function addSearchHistory(location: string) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return;

  const trimmedLocation = location?.trim();
  if (!trimmedLocation || trimmedLocation.length > 255) return;

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

  const { data, error } = await supabase
    .from('search_history')
    .select('location')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw error;
  return data?.map(item => item.location).filter(Boolean) || [];
}

export async function clearSearchHistory() {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return;

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
  return data;
}

export async function getTrips(): Promise<Trip[]> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return [];

  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function deleteTrip(tripId: string): Promise<void> {
  if (!tripId?.trim()) throw new Error('Trip ID is required');

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('id', tripId)
    .eq('user_id', user.id);

  if (error) throw error;
}

export async function getTripItems(tripId: string): Promise<TripItem[]> {
  if (!tripId?.trim()) return [];

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return [];

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
  return data || [];
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
    .eq('trip_id', tripId)
    .eq('user_id', user.id);

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
}

export async function removeTripItem(itemId: string): Promise<void> {
  if (!itemId?.trim()) throw new Error('Item ID is required');

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('trip_items')
    .delete()
    .eq('id', itemId)
    .eq('user_id', user.id);

  if (error) throw error;
}

// ── Trip Visibility ───────────────────────────────────────────────────────────

export async function updateTripVisibility(tripId: string, is_public: boolean): Promise<void> {
  if (!tripId?.trim()) throw new Error('Trip ID is required');

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('trips')
    .update({ is_public })
    .eq('id', tripId)
    .eq('user_id', user.id);

  if (error) throw error;
}

// ── Trip Members ──────────────────────────────────────────────────────────────

export async function getTripMembers(tripId: string): Promise<TripMember[]> {
  if (!tripId?.trim()) return [];

  const { data, error } = await supabase
    .from('trip_members')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function requestToJoinTrip(tripId: string): Promise<void> {
  if (!tripId?.trim()) throw new Error('Trip ID is required');

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('User not authenticated');

  const email = user.email;
  if (!email) throw new Error('User email not available');

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
}

export async function approveJoinRequest(memberId: string): Promise<void> {
  if (!memberId?.trim()) throw new Error('Member ID is required');

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('User not authenticated');

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

  const { error } = await supabase
    .from('trip_members')
    .delete()
    .eq('trip_id', tripId)
    .eq('user_id', user.id);

  if (error) throw error;
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

  const { data: trips, error } = await supabase
    .from('trips')
    .select('*')
    .eq('is_public', true)
    .neq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!trips || trips.length === 0) return [];

  const tripIds = trips.map(t => t.id);

  const { data: myMemberships } = await supabase
    .from('trip_members')
    .select('trip_id, status')
    .eq('user_id', user.id)
    .in('trip_id', tripIds);

  const membershipMap = new Map(
    (myMemberships || []).map(m => [m.trip_id, m.status as 'pending' | 'approved' | 'rejected'])
  );

  return trips.map(trip => ({
    ...trip,
    my_status: membershipMap.get(trip.id) || null,
  }));
}
