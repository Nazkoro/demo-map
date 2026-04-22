import { useState } from 'react';

import { supabase } from '../lib/supabase';

type Tab = 'signin' | 'signup';

interface Props {
  onSuccess?: () => void;
}

export default function InlineAuthBlock({ onSuccess }: Props) {
  const [tab, setTab] = useState<Tab>('signin');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const [signinEmail, setSigninEmail] = useState('');
  const [signinPassword, setSigninPassword] = useState('');

  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('');

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    if (!supabase) {
      setMsg('Supabase не настроен');
      return;
    }
    const email = signinEmail.trim();
    if (!email || signinPassword.length < 6) {
      setMsg('Введите email и пароль (минимум 6 символов)');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: signinPassword });
    setBusy(false);
    if (error) {
      setMsg(error.message);
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
    const email = signupEmail.trim();
    if (!email) {
      setMsg('Введите email');
      return;
    }
    if (signupPassword.length < 6) {
      setMsg('Пароль должен быть минимум 6 символов');
      return;
    }
    if (signupPassword !== signupPasswordConfirm) {
      setMsg('Пароли не совпадают');
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({ email, password: signupPassword });
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    if (data.session) {
      onSuccess?.();
      return;
    }
    setMsg('Аккаунт создан. Проверьте почту для подтверждения, затем войдите.');
    setTab('signin');
    setSigninEmail(email);
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
            Email
            <input
              className="am-input"
              type="email"
              value={signinEmail}
              onChange={(e) => setSigninEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
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
          <button type="submit" className="am-btn am-btn--submit am-inline-auth-submit" disabled={busy}>
            {busy ? 'Вход…' : 'Войти'}
          </button>
        </form>
      ) : (
        <form className="am-inline-auth-form" onSubmit={handleSignUp}>
          <label className="am-inline-auth-label">
            Email
            <input
              className="am-input"
              type="email"
              value={signupEmail}
              onChange={(e) => setSignupEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>
          <label className="am-inline-auth-label">
            Пароль
            <input
              className="am-input"
              type="password"
              value={signupPassword}
              onChange={(e) => setSignupPassword(e.target.value)}
              placeholder="минимум 6 символов"
              autoComplete="new-password"
            />
          </label>
          <label className="am-inline-auth-label">
            Пароль ещё раз
            <input
              className="am-input"
              type="password"
              value={signupPasswordConfirm}
              onChange={(e) => setSignupPasswordConfirm(e.target.value)}
              placeholder="повторите пароль"
              autoComplete="new-password"
            />
          </label>
          <button type="submit" className="am-btn am-btn--submit am-inline-auth-submit" disabled={busy}>
            {busy ? 'Регистрация…' : 'Зарегистрироваться'}
          </button>
        </form>
      )}

      {msg && <p className="am-inline-auth-msg">{msg}</p>}
    </div>
  );
}
