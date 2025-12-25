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

  const { error } = await supabase.from('saved_places').insert({
    user_id: user.id,
    place_name,
    place_type,
    location,
    description,
    rating,
  });

  if (error) throw error;
}

export async function unsavePlace(placeId: string) {
  const { error } = await supabase
    .from('saved_places')
    .delete()
    .eq('id', placeId);

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

  await supabase.from('search_history').insert({
    user_id: user.id,
    location,
  });
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
