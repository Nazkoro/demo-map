import { supabase } from './supabase';
import { mapDbRowToPlace } from './places';
import type { Place } from '../types';

const TABLE = 'saved_places';

export async function loadSavedPlaceIds(userId: string): Promise<string[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase.from(TABLE).select('place_id').eq('user_id', userId);
  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row) => (typeof row.place_id === 'string' ? row.place_id : String(row.place_id ?? '')))
    .filter(Boolean);
}

export async function setPlaceSaved(userId: string, placeId: string, shouldSave: boolean): Promise<void> {
  if (!supabase) {
    return;
  }

  if (shouldSave) {
    const { error } = await supabase.from(TABLE).upsert(
      {
        user_id: userId,
        place_id: placeId,
      },
      { onConflict: 'user_id,place_id' },
    );
    if (error) {
      throw error;
    }
    return;
  }

  const { error } = await supabase.from(TABLE).delete().eq('user_id', userId).eq('place_id', placeId);
  if (error) {
    throw error;
  }
}

export async function loadSavedPlaces(userId: string): Promise<Place[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select('places(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row) => (row.places && typeof row.places === 'object' ? mapDbRowToPlace(row.places) : null))
    .filter((item): item is Place => item !== null);
}
