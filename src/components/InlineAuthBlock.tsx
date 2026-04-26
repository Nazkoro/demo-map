import { useEffect, useRef, useState } from 'react';

import { supabase } from '../lib/supabase';
import { checkLoginIdTaken, signInWithLoginId, signUpWithLoginId, validateLoginId } from '../lib/auth';

type Tab = 'signin' | 'signup';
type LoginIdStatus = 'idle' | 'invalid' | 'checking' | 'found' | 'not_found' | 'available' | 'taken';

interface Props {
  onSuccess?: () => void;
}

function VisibilityIcon({ off }: { off: boolean }) {
  return off ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3L21 21" />
      <path d="M10.6 10.7C10.2 11.1 10 11.5 10 12C10 13.1 10.9 14 12 14C12.5 14 12.9 13.8 13.3 13.4" />
      <path d="M9.4 5.8C10.2 5.3 11.1 5 12 5C16 5 19.3 7.6 20.6 11.2C20.7 11.5 20.7 11.8 20.6 12.1C20.2 13.2 19.6 14.2 18.8 15.1" />
      <path d="M14.7 18.1C13.8 18.4 12.9 18.6 12 18.6C8 18.6 4.7 16 3.4 12.4C3.3 12.1 3.3 11.8 3.4 11.5C3.8 10.4 4.4 9.4 5.2 8.5" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12C4.1 8.6 7.7 6 12 6C16.3 6 19.9 8.6 21.5 12C19.9 15.4 16.3 18 12 18C7.7 18 4.1 15.4 2.5 12Z" />
      <circle cx="12" cy="12" r="3.1" />
    </svg>
  );
}

export default function InlineAuthBlock({ onSuccess }: Props) {
  const [tab, setTab] = useState<Tab>('signin');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const [signinLoginId, setSigninLoginId] = useState('');
  const [signinPassword, setSigninPassword] = useState('');
  const [signinLoginIdStatus, setSigninLoginIdStatus] = useState<LoginIdStatus>('idle');

  const [signupLoginId, setSignupLoginId] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('');
  const [signupNickname, setSignupNickname] = useState('');
  const [signupLoginIdStatus, setSignupLoginIdStatus] = useState<LoginIdStatus>('idle');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const signinLoginCheckSeqRef = useRef(0);
  const signupLoginCheckSeqRef = useRef(0);
  const isSignupPasswordTooShort = signupPassword.length > 0 && signupPassword.length < 6;

  useEffect(() => {
    if (tab !== 'signin') {
      setSigninLoginIdStatus('idle');
      return;
    }
    const normalizedLoginId = signinLoginId.trim().toLowerCase();
    if (!normalizedLoginId) {
      setSigninLoginIdStatus('idle');
      return;
    }
    if (validateLoginId(normalizedLoginId)) {
      setSigninLoginIdStatus('invalid');
      return;
    }
    const client = supabase;
    if (!client) {
      setSigninLoginIdStatus('idle');
      return;
    }
    const currentRequest = ++signinLoginCheckSeqRef.current;
    setSigninLoginIdStatus('checking');
    const timeout = setTimeout(() => {
      void checkLoginIdTaken(client, normalizedLoginId).then((taken) => {
        if (currentRequest !== signinLoginCheckSeqRef.current) {
          return;
        }
        setSigninLoginIdStatus(taken ? 'found' : 'not_found');
      });
    }, 450);
    return () => clearTimeout(timeout);
  }, [tab, signinLoginId]);

  useEffect(() => {
    if (tab !== 'signup') {
      setSignupLoginIdStatus('idle');
      return;
    }
    const normalizedLoginId = signupLoginId.trim().toLowerCase();
    if (!normalizedLoginId) {
      setSignupLoginIdStatus('idle');
      return;
    }
    if (validateLoginId(normalizedLoginId)) {
      setSignupLoginIdStatus('invalid');
      return;
    }
    const client = supabase;
    if (!client) {
      setSignupLoginIdStatus('idle');
      return;
    }
    const currentRequest = ++signupLoginCheckSeqRef.current;
    setSignupLoginIdStatus('checking');
    const timeout = setTimeout(() => {
      void checkLoginIdTaken(client, normalizedLoginId).then((taken) => {
        if (currentRequest !== signupLoginCheckSeqRef.current) {
          return;
        }
        setSignupLoginIdStatus(taken ? 'taken' : 'available');
      });
    }, 450);
    return () => clearTimeout(timeout);
  }, [tab, signupLoginId]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    if (!supabase) {
      setMsg('Supabase не настроен');
      return;
    }
    if (signinLoginIdStatus === 'checking') {
      setMsg('Дождитесь завершения проверки логина');
      return;
    }
    if (signinLoginIdStatus === 'not_found') {
      setMsg('Логин не найден');
      return;
    }
    setBusy(true);
    const { error } = await signInWithLoginId(supabase, signinLoginId, signinPassword);
    setBusy(false);
    if (error) {
      setMsg(error);
      return;
    }
    onSuccess?.();
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    if (!supabase) {
      setMsg('Supabase не настроен');
      return;
    }
    const loginIdValidationError = validateLoginId(signupLoginId);
    if (loginIdValidationError) {
      setMsg(loginIdValidationError);
      return;
    }
    if (signupLoginIdStatus === 'checking') {
      setMsg('Дождитесь завершения проверки логина');
      return;
    }
    if (signupLoginIdStatus === 'taken') {
      setMsg('Логин уже занят');
      return;
    }
    if (signupPassword.length < 6) {
      return;
    }
    if (signupPassword !== signupPasswordConfirm) {
      setMsg('Пароли не совпадают');
      return;
    }
    setBusy(true);
    const { error, needsEmailConfirmation } = await signUpWithLoginId(supabase, signupLoginId, signupNickname, signupPassword);
    setBusy(false);
    if (error) {
      setMsg(error);
      return;
    }
    if (!needsEmailConfirmation) {
      onSuccess?.();
      return;
    }
    setMsg('Аккаунт создан, но вход не выполнен. Отключите подтверждение email в настройках Supabase Auth.');
    setTab('signin');
    setSigninLoginId(signupLoginId.trim().toLowerCase());
    setSigninPassword('');
  }

  return (
    <div className="am-inline-auth">
      <div className="am-inline-auth-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={`am-inline-auth-tab${tab === 'signin' ? ' is-active' : ''}`}
          onClick={() => {
            setTab('signin');
            setMsg('');
          }}
          disabled={busy}
        >
          Вход
        </button>
        <button
          type="button"
          role="tab"
          className={`am-inline-auth-tab${tab === 'signup' ? ' is-active' : ''}`}
          onClick={() => {
            setTab('signup');
            setMsg('');
          }}
          disabled={busy}
        >
          Регистрация
        </button>
      </div>

      {tab === 'signin' ? (
        <form className="am-inline-auth-form" onSubmit={handleSignIn}>
          <label className="am-inline-auth-label">
            Логин
            <input
              className="am-input"
              type="text"
              value={signinLoginId}
              onChange={(e) => setSigninLoginId(e.target.value)}
              placeholder="уникальный логин"
              autoComplete="username"
            />
            {signinLoginIdStatus === 'not_found' && <small className="am-inline-auth-hint is-error">Логин не найден</small>}
            {signinLoginIdStatus === 'invalid' && (
              <small className="am-inline-auth-hint is-error">{validateLoginId(signinLoginId.trim().toLowerCase())}</small>
            )}
          </label>
          <label className="am-inline-auth-label">
            Пароль
            <input
              className="am-input"
              type="password"
              value={signinPassword}
              onChange={(e) => setSigninPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>
          <button
            type="submit"
            className="am-btn am-btn--submit am-inline-auth-submit"
            disabled={busy || signinLoginIdStatus === 'checking'}
          >
            {busy ? 'Вход…' : 'Войти'}
          </button>
        </form>
      ) : (
        <form className="am-inline-auth-form" onSubmit={handleSignUp}>
          <label className="am-inline-auth-label">
            Логин
            <input
              className="am-input"
              type="text"
              value={signupLoginId}
              onChange={(e) => setSignupLoginId(e.target.value)}
              placeholder="уникальный логин"
              autoComplete="username"
            />
            {signupLoginIdStatus === 'taken' && <small className="am-inline-auth-hint is-error">Логин уже занят</small>}
            {signupLoginIdStatus === 'invalid' && (
              <small className="am-inline-auth-hint is-error">{validateLoginId(signupLoginId.trim().toLowerCase())}</small>
            )}
          </label>
          <label className="am-inline-auth-label">
            Пароль
            <div className="am-password-wrap">
              <input
                className="am-input"
                type={showSignupPassword ? 'text' : 'password'}
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                placeholder="минимум 6 символов"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="am-password-toggle"
                aria-label={showSignupPassword ? 'Скрыть пароль' : 'Показать пароль'}
                onClick={() => setShowSignupPassword((prev) => !prev)}
              >
                <VisibilityIcon off={showSignupPassword} />
              </button>
            </div>
            {isSignupPasswordTooShort && (
              <small className="am-inline-auth-hint is-error">Пароль должен быть минимум 6 символов</small>
            )}
          </label>
          <label className="am-inline-auth-label">
            Подтвердите пароль
            <input
              className="am-input"
              type={showSignupPassword ? 'text' : 'password'}
              value={signupPasswordConfirm}
              onChange={(e) => setSignupPasswordConfirm(e.target.value)}
              placeholder="повторите пароль"
              autoComplete="new-password"
            />
          </label>
          <label className="am-inline-auth-label">
            Никнейм
            <input
              className="am-input"
              type="text"
              value={signupNickname}
              onChange={(e) => setSignupNickname(e.target.value)}
              placeholder="никнейм, который видят другие"
              autoComplete="nickname"
            />
          </label>
          <button
            type="submit"
            className="am-btn am-btn--submit am-inline-auth-submit"
            disabled={busy || signupLoginIdStatus === 'checking' || signupLoginIdStatus === 'taken' || isSignupPasswordTooShort}
          >
            {busy ? 'Регистрация…' : 'Зарегистрироваться'}
          </button>
        </form>
      )}

      {msg && <p className="am-inline-auth-msg">{msg}</p>}
    </div>
  );
}
