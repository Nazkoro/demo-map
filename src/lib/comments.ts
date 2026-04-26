import { supabase } from './supabase';
import { userNickname } from './auth';
import type { PlaceComment } from '../types';

const TABLE = 'comments';
const COMMENT_IMAGES_BUCKET = 'comment-images';

function generateUploadKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function extractStoragePathFromPublicUrl(url: string): string {
  const marker = `/storage/v1/object/public/${COMMENT_IMAGES_BUCKET}/`;
  const index = url.indexOf(marker);
  return index === -1 ? '' : url.slice(index + marker.length);
}

async function uploadCommentImages(placeId: string, images: File[]): Promise<{ urls: string[]; paths: string[] }> {
  if (!supabase || images.length === 0) {
    return { urls: [], paths: [] };
  }
  const urls: string[] = [];
  const paths: string[] = [];
  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const ext = image.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${placeId}/${generateUploadKey()}-${index}.${ext}`;
    const { error: uploadError } = await supabase.storage.from(COMMENT_IMAGES_BUCKET).upload(path, image, {
      upsert: false,
      contentType: image.type || 'image/jpeg',
    });
    if (uploadError) {
      throw uploadError;
    }
    const { data } = supabase.storage.from(COMMENT_IMAGES_BUCKET).getPublicUrl(path);
    urls.push(data.publicUrl);
    paths.push(path);
  }
  return { urls, paths };
}

async function deleteCommentStoragePaths(paths: string[]): Promise<void> {
  if (!supabase || paths.length === 0) {
    return;
  }
  await supabase.storage.from(COMMENT_IMAGES_BUCKET).remove(paths);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbRowToComment(row: any): PlaceComment {
  return {
    id: String(row.id),
    placeId: String(row.place_id),
    authorId: String(row.author_id),
    authorName: String(row.author_name ?? 'Участник'),
    body: String(row.body ?? ''),
    imageUrls: Array.isArray(row.image_urls) ? row.image_urls.filter((url: unknown) => typeof url === 'string') : [],
    createdAt: new Date(String(row.created_at)).getTime(),
  };
}

export async function loadComments(placeId: string): Promise<PlaceComment[]> {
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('place_id', placeId)
    .order('created_at', { ascending: false });
  if (error) {
    throw error;
  }
  return (data ?? []).map(mapDbRowToComment);
}

export async function addComment(placeId: string, body: string, images: File[] = []): Promise<PlaceComment> {
  if (!supabase) {
    throw new Error('Supabase не настроен');
  }
  const trimmedBody = body.trim();
  if (!trimmedBody) {
    throw new Error('Текст комментария пустой');
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Нужна авторизация для комментария');
  }

  const authorName = userNickname(user) ?? 'Участник';
  const { urls, paths } = await uploadCommentImages(placeId, images);

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        place_id: placeId,
        author_id: user.id,
        author_name: authorName,
        body: trimmedBody,
        image_urls: urls,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }
    return mapDbRowToComment(data);
  } catch (error) {
    await deleteCommentStoragePaths(paths);
    throw error;
  }
}

export async function removeComment(commentId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase не настроен');
  }
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Нужна авторизация для удаления комментария');
  }

  const { data: commentRow, error: fetchError } = await supabase
    .from(TABLE)
    .select('author_id, image_urls')
    .eq('id', commentId)
    .maybeSingle();
  if (fetchError) {
    throw fetchError;
  }
  if (!commentRow) {
    throw new Error('Комментарий не найден');
  }
  if (String(commentRow.author_id) !== user.id) {
    throw new Error('Удалять комментарий может только автор');
  }

  const imagePaths = (Array.isArray(commentRow?.image_urls) ? commentRow.image_urls : [])
    .filter((url: unknown): url is string => typeof url === 'string')
    .map(extractStoragePathFromPublicUrl)
    .filter(Boolean);

  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', commentId)
    .eq('author_id', user.id)
    .select('id');
  if (error) {
    throw error;
  }
  if (!data || data.length === 0) {
    throw new Error('Комментарий не удален: не найден или нет прав');
  }
  await deleteCommentStoragePaths(imagePaths);
}
