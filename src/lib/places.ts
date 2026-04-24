import { supabase } from './supabase';
import type { Place, PlaceFormData, PlaceUpdateData } from '../types';

const TABLE = 'places';
const IMAGES_BUCKET = 'place-images';

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
    imageUrls: Array.isArray(row.image_urls) ? row.image_urls.filter((url: unknown) => typeof url === 'string') : [],
    votesUp: Number(row.votes_up) || 0,
    votesDown: Number(row.votes_down) || 0,
    createdAt: new Date(String(row.created_at)).getTime(),
  };
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function uploadPlaceImages(placeId: string, images: File[]): Promise<{ urls: string[]; paths: string[] }> {
  if (!supabase || images.length === 0) {
    return { urls: [], paths: [] };
  }

  const urls: string[] = [];
  const paths: string[] = [];

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const ext = image.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${placeId}/${Date.now()}-${index}.${ext}`;
    const { error: uploadError } = await supabase.storage.from(IMAGES_BUCKET).upload(path, image, {
      upsert: false,
      contentType: image.type || 'image/jpeg',
    });
    if (uploadError) {
      throw uploadError;
    }
    const { data } = supabase.storage.from(IMAGES_BUCKET).getPublicUrl(path);
    urls.push(data.publicUrl);
    paths.push(path);
  }

  return { urls, paths };
}

async function deleteStoragePaths(paths: string[]): Promise<void> {
  if (!supabase || paths.length === 0) {
    return;
  }
  await supabase.storage.from(IMAGES_BUCKET).remove(paths);
}

function extractStoragePathFromPublicUrl(url: string): string {
  const marker = `/storage/v1/object/public/${IMAGES_BUCKET}/`;
  const index = url.indexOf(marker);
  return index === -1 ? '' : url.slice(index + marker.length);
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

interface LoadPlacesByViewportParams {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
  minPrice: number | null;
  maxPrice: number | null;
  categoryKeys: string[] | null;
  limit: number;
  offset: number;
}

interface SearchPlacesByNameParams {
  query: string;
  limit: number;
  offset: number;
}

interface LoadRecentPlacesParams {
  limit: number;
  offset: number;
}

function hasCategoryOverlap(placeCategories: string[], selectedCategories: string[] | null): boolean {
  if (!selectedCategories || selectedCategories.length === 0) {
    return true;
  }
  return selectedCategories.some((category) => placeCategories.includes(category));
}

function fallbackFilterByViewport(allPlaces: Place[], params: LoadPlacesByViewportParams): Place[] {
  return allPlaces
    .filter((place) => place.lat >= params.minLat && place.lat <= params.maxLat)
    .filter((place) => place.lng >= params.minLng && place.lng <= params.maxLng)
    .filter((place) => (params.minPrice == null ? true : place.price >= params.minPrice))
    .filter((place) => (params.maxPrice == null ? true : place.price <= params.maxPrice))
    .filter((place) => hasCategoryOverlap(place.categories, params.categoryKeys))
    .slice(params.offset, params.offset + params.limit);
}

function isRpcMissingError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const maybeError = error as { code?: string; message?: string };
  return (
    maybeError.code === 'PGRST202' ||
    maybeError.code === '404' ||
    (typeof maybeError.message === 'string' && maybeError.message.toLowerCase().includes('get_restaurants'))
  );
}

export async function loadPlacesByViewport(params: LoadPlacesByViewportParams): Promise<Place[]> {
  if (!supabase) {
    return [];
  }

  const payload = {
    p_min_lat: params.minLat,
    p_min_lng: params.minLng,
    p_max_lat: params.maxLat,
    p_max_lng: params.maxLng,
    p_min_price: params.minPrice,
    p_max_price: params.maxPrice,
    p_category_keys: params.categoryKeys,
    p_limit: params.limit,
    p_offset: params.offset,
  };

  const { data, error } = await supabase.rpc('get_restaurants', payload);
  if (error) {
    if (!isRpcMissingError(error)) {
      throw error;
    }
    const allPlaces = await loadPlaces();
    return fallbackFilterByViewport(allPlaces, params);
  }

  return (data ?? []).map(mapDbRowToPlace);
}

export async function searchPlacesByName(params: SearchPlacesByNameParams): Promise<Place[]> {
  if (!supabase) {
    return [];
  }
  const q = params.query.trim();
  if (!q) {
    return [];
  }

  const from = Math.max(0, params.offset);
  const to = from + Math.max(0, params.limit) - 1;
  if (to < from) {
    return [];
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .ilike('name', `%${q}%`)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }
  return (data ?? []).map(mapDbRowToPlace);
}

export async function loadRecentPlaces(params: LoadRecentPlacesParams): Promise<Place[]> {
  if (!supabase) {
    return [];
  }
  const from = Math.max(0, params.offset);
  const to = from + Math.max(0, params.limit) - 1;
  if (to < from) {
    return [];
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, to);

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
  const id = generateId();

  const base = {
    id,
    lng,
    lat,
    name: form.name.trim(),
    price: form.price,
    categories: form.categories,
    dish: form.dish.trim(),
    hours: form.hours.trim(),
    address: form.address.trim(),
    note: form.note.trim(),
    image_urls: [] as string[],
    votes_up: 0,
    votes_down: 0,
  };

  if (!supabase) {
    const place: Place = {
      ...base,
      imageUrls: form.images.map((image) => URL.createObjectURL(image)),
      votesUp: 0,
      votesDown: 0,
      createdAt: Date.now(),
    };
    return { place, local: true };
  }

  const { urls, paths } = await uploadPlaceImages(id, form.images);
  base.image_urls = urls;

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({ ...base, created_at: new Date().toISOString() })
      .select()
      .single();
    if (error) {
      throw error;
    }
    return { place: mapDbRowToPlace(data), local: false };
  } catch (error) {
    await deleteStoragePaths(paths);
    throw error;
  }
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

export async function updatePlace(id: string, data: PlaceUpdateData): Promise<Place> {
  if (!supabase) {
    throw new Error('Supabase не настроен');
  }
  const { urls: uploadedImageUrls, paths: uploadedImagePaths } = await uploadPlaceImages(id, data.newImages);
  const finalImageUrls = [...data.keepImageUrls, ...uploadedImageUrls];
  const keptSet = new Set(data.keepImageUrls);
  const removedStoragePaths = (await supabase.from(TABLE).select('image_urls').eq('id', id).maybeSingle()).data?.image_urls;
  const removedPaths = (Array.isArray(removedStoragePaths) ? removedStoragePaths : [])
    .filter((url: unknown): url is string => typeof url === 'string' && !keptSet.has(url))
    .map(extractStoragePathFromPublicUrl)
    .filter(Boolean);

  const payload = {
    name: data.name.trim(),
    price: data.price,
    categories: data.categories,
    dish: data.dish.trim(),
    hours: data.hours.trim(),
    address: data.address.trim(),
    note: data.note.trim(),
    image_urls: finalImageUrls,
  };
  try {
    const { data: updatedRow, error } = await supabase.from(TABLE).update(payload).eq('id', id).select().single();
    if (error) {
      throw error;
    }
    await deleteStoragePaths(removedPaths);
    return mapDbRowToPlace(updatedRow);
  } catch (error) {
    await deleteStoragePaths(uploadedImagePaths);
    throw error;
  }
}

export async function removePlace(id: string): Promise<void> {
  if (!supabase) {
    return;
  }

  const { data: imageRows } = await supabase.from(TABLE).select('image_urls').eq('id', id).maybeSingle();

  const { data: storageObjects } = await supabase.storage.from(IMAGES_BUCKET).list(id, {
    limit: 100,
    offset: 0,
  });
  const storagePaths = (storageObjects ?? []).map((item) => `${id}/${item.name}`);
  const imageUrls = Array.isArray(imageRows?.image_urls) ? imageRows.image_urls : [];
  const imagePathsFromUrls = imageUrls
    .map(extractStoragePathFromPublicUrl)
    .filter(Boolean);

  const allPaths = Array.from(new Set([...storagePaths, ...imagePathsFromUrls]));
  await deleteStoragePaths(allPaths);

  const { data: deletedRows, error } = await supabase.from(TABLE).delete().eq('id', id).select('id');
  if (error) {
    throw error;
  }
  if (!deletedRows || deletedRows.length === 0) {
    throw new Error('Удаление не выполнено: запись не найдена или недостаточно прав (RLS policy).');
  }
}
