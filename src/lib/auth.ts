import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

const LOGIN_ID_PATTERN = /^[a-z0-9_]{3,20}$/;
const LOGIN_EMAIL_DOMAIN = 'login.local';
const PROFILE_TABLE = 'profiles';

function normalizeLoginId(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeNickname(value: string): string {
  return value.trim();
}

export function validateLoginId(value: string): string | null {
  const normalized = normalizeLoginId(value);
  if (!normalized) {
    return 'Введите Login ID';
  }
  if (!LOGIN_ID_PATTERN.test(normalized)) {
    return 'Login ID: 3-20 символов, только латиница, цифры и "_"';
  }
  return null;
}

export function validateNickname(value: string): string | null {
  const normalized = normalizeNickname(value);
  if (!normalized) {
    return 'Введите никнейм';
  }
  if (normalized.length < 3) {
    return 'Никнейм: минимум 3 символа';
  }
  return null;
}

function loginIdToAuthEmail(value: string): string {
  return `${normalizeLoginId(value)}@${LOGIN_EMAIL_DOMAIN}`;
}

function readNicknameFromMetadata(user: User | null): string | null {
  if (!user) {
    return null;
  }
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const nickname = typeof meta?.nickname === 'string' ? meta.nickname.trim() : '';
  return nickname || null;
}

export function userNickname(user: User | null): string | null {
  const metaNickname = readNicknameFromMetadata(user);
  if (metaNickname) {
    return metaNickname;
  }
  const email = user?.email ?? '';
  if (email.endsWith(`@${LOGIN_EMAIL_DOMAIN}`)) {
    return email.split('@')[0] ?? null;
  }
  return null;
}

export function sessionNickname(session: Session | null): string | null {
  return userNickname(session?.user ?? null);
}

async function upsertProfile(client: SupabaseClient, userId: string, _loginId: string, nickname: string): Promise<void> {
  const { error } = await client
    .from(PROFILE_TABLE)
    .upsert(
      { id: userId, nickname: normalizeNickname(nickname) },
      { onConflict: 'id' },
    );
  if (error) {
    throw error;
  }
}

function isRpcMissingError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const maybeError = error as { code?: string; message?: string };
  return (
    maybeError.code === 'PGRST202' ||
    maybeError.code === '42883' ||
    (typeof maybeError.message === 'string' && maybeError.message.toLowerCase().includes('is_nickname_taken'))
  );
}

async function isNicknameTakenViaRpc(client: SupabaseClient, nickname: string): Promise<boolean> {
  const normalizedNickname = normalizeNickname(nickname);
  if (!normalizedNickname) {
    return false;
  }

  const { data, error } = await client.rpc('is_nickname_taken', {
    p_nickname: normalizedNickname,
  });
  if (error) {
    // Если RPC пока не создана или недоступна по RLS/правам, не блокируем регистрацию:
    // ниже всё равно сработает защита по unique-индексу.
    if (isRpcMissingError(error)) {
      return false;
    }
    return false;
  }

  return Boolean(data);
}

export async function checkNicknameTaken(client: SupabaseClient, nickname: string): Promise<boolean> {
  return isNicknameTakenViaRpc(client, nickname);
}

export async function signInWithLoginId(
  client: SupabaseClient,
  loginId: string,
  password: string,
): Promise<{ error: string | null }> {
  const loginIdError = validateLoginId(loginId);
  if (loginIdError) {
    return { error: loginIdError };
  }
  if (password.length < 6) {
    return { error: 'Пароль должен быть минимум 6 символов' };
  }

  const authEmail = loginIdToAuthEmail(loginId);
  const { error } = await client.auth.signInWithPassword({ email: authEmail, password });
  return { error: error?.message ?? null };
}

export async function signUpWithLoginId(
  client: SupabaseClient,
  loginId: string,
  nickname: string,
  password: string,
): Promise<{ error: string | null; needsEmailConfirmation: boolean }> {
  const loginIdError = validateLoginId(loginId);
  if (loginIdError) {
    return { error: loginIdError, needsEmailConfirmation: false };
  }
  const nicknameError = validateNickname(nickname);
  if (nicknameError) {
    return { error: nicknameError, needsEmailConfirmation: false };
  }
  if (password.length < 6) {
    return { error: 'Пароль должен быть минимум 6 символов', needsEmailConfirmation: false };
  }

  const normalizedLoginId = normalizeLoginId(loginId);
  const normalizedNickname = normalizeNickname(nickname);
  if (await isNicknameTakenViaRpc(client, normalizedNickname)) {
    return { error: 'Никнейм уже занят', needsEmailConfirmation: false };
  }
  const { data, error } = await client.auth.signUp({
    email: loginIdToAuthEmail(normalizedLoginId),
    password,
    options: {
      data: {
        nickname: normalizedNickname,
        login_id: normalizedLoginId,
      },
    },
  });
  if (error) {
    const normalizedMessage = error.message.toLowerCase();
    if (normalizedMessage.includes('already registered') || normalizedMessage.includes('already exists')) {
      return { error: 'Login ID уже занят', needsEmailConfirmation: false };
    }
    return { error: error.message, needsEmailConfirmation: false };
  }
  if (data.user) {
    try {
      await upsertProfile(client, data.user.id, normalizedLoginId, normalizedNickname);
    } catch (profileError) {
      if (profileError && typeof profileError === 'object' && 'message' in profileError) {
        const profileMessage = String(profileError.message).toLowerCase();
        if (
          profileMessage.includes('duplicate') ||
          profileMessage.includes('unique') ||
          profileMessage.includes('profiles_nickname_key')
        ) {
          return { error: 'Никнейм уже занят', needsEmailConfirmation: false };
        }
      }
      throw profileError;
    }
  }
  return { error: null, needsEmailConfirmation: !data.session };
}
