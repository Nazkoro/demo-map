import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let _client: SupabaseClient | null = null;

if (url && key && !url.startsWith('PASTE_') && !key.startsWith('PASTE_')) {
  _client = createClient(url, key);
}

export const supabase: SupabaseClient | null = _client;
