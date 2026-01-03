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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  if (!place_name || !place_type || !location) {
    throw new Error('Place name, type, and location are required');
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
    description: description?.trim(),
    rating: rating && rating > 0 && rating <= 5 ? rating : null,
  });

  if (error) throw error;
}

export async function unsavePlace(placeId: string) {
  if (!placeId) {
    throw new Error('Place ID is required');
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('saved_places')
    .delete()
    .eq('id', placeId)
    .eq('user_id', user.id);

  if (error) throw error;
}

export async function getSavedPlaces(): Promise<SavedPlace[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('saved_places')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getSavedPlacesByLocation(location: string): Promise<SavedPlace[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('saved_places')
    .select('*')
    .eq('user_id', user.id)
    .eq('location', location)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function isSaved(place_name: string, location: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('saved_places')
    .select('id')
    .eq('user_id', user.id)
    .eq('place_name', place_name)
    .eq('location', location)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

export async function addSearchHistory(location: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const trimmedLocation = location.trim();
  if (!trimmedLocation) return;

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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('search_history')
    .select('location')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) throw error;
  return data?.map(item => item.location) || [];
}

export async function clearSearchHistory() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('search_history')
    .delete()
    .eq('user_id', user.id);
}
