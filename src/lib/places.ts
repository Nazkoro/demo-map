import { supabase } from './supabase';
import type { Place, PlaceFormData } from '../types';

const TABLE = 'places';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapDbRowToPlace(row: any): Place {
  return {
    id: String(row.id),
    lng: Number(row.lng),
    lat: Number(row.lat),
    name: String(row.name ?? ''),
    price: Number(row.price) || 0,
    categories: Array.isArray(row.categories) ? row.categories : [],
    dish: String(row.dish ?? ''),
    hours: String(row.hours ?? ''),
    address: String(row.address ?? row.map_link ?? ''),
    // fall back to old "description" column for legacy rows
    note: String(row.note ?? row.description ?? ''),
    votesUp: Number(row.votes_up) || 0,
    votesDown: Number(row.votes_down) || 0,
    createdAt: new Date(String(row.created_at)).getTime(),
  };
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function loadPlaces(): Promise<Place[]> {
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) {
    throw error;
  }
  return (data ?? []).map(mapDbRowToPlace);
}

export async function insertPlace(
  lng: number,
  lat: number,
  form: PlaceFormData,
): Promise<{ place: Place; local: boolean }> {
  const base = {
    id: generateId(),
    lng,
    lat,
    name: form.name.trim(),
    price: form.price,
    categories: form.categories,
    dish: form.dish.trim(),
    hours: form.hours.trim(),
    address: form.address.trim(),
    note: form.note.trim(),
    votes_up: 0,
    votes_down: 0,
  };

  if (!supabase) {
    const place: Place = {
      ...base,
      votesUp: 0,
      votesDown: 0,
      createdAt: Date.now(),
    };
    return { place, local: true };
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...base, created_at: new Date().toISOString() })
    .select()
    .single();
  if (error) {
    throw error;
  }
  return { place: mapDbRowToPlace(data), local: false };
}

export async function updateVotes(place: Place): Promise<void> {
  if (!supabase) {
    return;
  }
  const { error } = await supabase
    .from(TABLE)
    .update({ votes_up: place.votesUp, votes_down: place.votesDown })
    .eq('id', place.id);
  if (error) {
    throw error;
  }
}

export async function removePlace(id: string): Promise<void> {
  if (!supabase) {
    return;
  }
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) {
    throw error;
  }
}
