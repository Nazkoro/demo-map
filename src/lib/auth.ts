import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

const LOGIN_ID_PATTERN = /^[a-z0-9_]{3,20}$/;
const NICKNAME_PATTERN = /^[a-z0-9_]{2,30}$/;
const LOGIN_EMAIL_DOMAIN = 'login.local';
const PROFILE_TABLE = 'user_profiles';

function normalizeLoginId(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeNickname(value: string): string {
  return value.trim().toLowerCase();
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
  if (!NICKNAME_PATTERN.test(normalized)) {
    return 'Никнейм: 2-30 символов, только латиница, цифры и "_"';
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

async function upsertProfile(client: SupabaseClient, userId: string, loginId: string, nickname: string): Promise<void> {
  const { error } = await client
    .from(PROFILE_TABLE)
    .upsert(
      { user_id: userId, login_id: normalizeLoginId(loginId), nickname: normalizeNickname(nickname), email: null },
      { onConflict: 'user_id' },
    );
  if (error) {
    throw error;
  }
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
    return { error: error.message, needsEmailConfirmation: false };
  }
  if (data.user) {
    await upsertProfile(client, data.user.id, normalizedLoginId, normalizedNickname);
  }
  return { error: null, needsEmailConfirmation: !data.session };
}
