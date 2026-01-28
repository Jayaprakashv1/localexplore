import { supabase } from './supabase';

export type PlaceType = 'place' | 'restaurant' | 'activity' | 'food';

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
