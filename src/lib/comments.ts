import { supabase } from './supabase';
import { userNickname } from './auth';
import type { PlaceComment } from '../types';

const TABLE = 'comments';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbRowToComment(row: any): PlaceComment {
  return {
    id: String(row.id),
    placeId: String(row.place_id),
    authorId: String(row.author_id),
    authorName: String(row.author_name ?? 'Участник'),
    body: String(row.body ?? ''),
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

export async function addComment(placeId: string, body: string): Promise<PlaceComment> {
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

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      place_id: placeId,
      author_id: user.id,
      author_name: authorName,
      body: trimmedBody,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }
  return mapDbRowToComment(data);
}

export async function removeComment(commentId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase не настроен');
  }
  const { data, error } = await supabase.from(TABLE).delete().eq('id', commentId).select('id');
  if (error) {
    throw error;
  }
  if (!data || data.length === 0) {
    throw new Error('Комментарий не удален: не найден или нет прав');
  }
}
