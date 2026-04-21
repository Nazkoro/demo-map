import { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

import { supabase } from '../lib/supabase';

type AuthMode = 'home' | 'signin' | 'signup';

function normalizeEmailFromLogin(login: string): string {
  const safe = login.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  return `${safe}@kartanishchego.local`;
}

export default function AccountPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('home');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>('');

  const [signinLogin, setSigninLogin] = useState('');
  const [signinPassword, setSigninPassword] = useState('');

  const [signupLogin, setSignupLogin] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('');
  const [signupNickname, setSignupNickname] = useState('');

  const languageItems = useMemo(() => ['Русский', 'English', '日本語', '繁體中文'], []);

  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) {
      return;
    }
    root.classList.add('is-account-mode');
    root.classList.remove('is-map-mode');
    document.body.classList.add('account-mode');
    return () => {
      root.classList.remove('is-account-mode');
      document.body.classList.remove('account-mode');
    };
  }, []);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    if (!supabase) {
      setMsg('Supabase не настроен');
      return;
    }

    const login = signinLogin.trim();
    if (!login || signinPassword.length < 6) {
      setMsg('Введите логин и пароль (минимум 6 символов)');
      return;
    }

    setBusy(true);
    const email = normalizeEmailFromLogin(login);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: signinPassword,
    });
    setBusy(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    navigate('/');
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    if (!supabase) {
      setMsg('Supabase не настроен');
      return;
    }

    const login = signupLogin.trim();
    const nickname = signupNickname.trim();
    if (!login || !nickname) {
      setMsg('Заполните логин и никнейм');
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
    const email = normalizeEmailFromLogin(login);
    const { error } = await supabase.auth.signUp({
      email,
      password: signupPassword,
      options: {
        data: { nickname, login },
      },
    });
    setBusy(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg('Аккаунт создан. Теперь войдите в систему.');
    setMode('signin');
    setSigninLogin(login);
    setSigninPassword('');
  }

  return (
    <div className="account-page">
      <div className="account-wrap">
        <p className="account-kicker">Account</p>
        <h1 className="account-title">Settings</h1>

        <section className="account-card">
          {mode === 'home' && (
            <>
              <button type="button" className="account-row account-row--head">
                <span className="account-row-icon">◎</span>
                <span className="account-row-main">
                  <strong>Account</strong>
                  <small>Sign in to manage your nickname, password and activity.</small>
                </span>
              </button>
              <button type="button" className="account-row" onClick={() => setMode('signin')}>
                <span className="account-row-icon">◌</span>
                <span>Sign in</span>
              </button>
              <button type="button" className="account-row" onClick={() => setMode('signup')}>
                <span className="account-row-icon">◌</span>
                <span>Sign up</span>
              </button>
            </>
          )}

          {mode === 'signin' && (
            <form className="account-form" onSubmit={handleSignIn}>
              <div className="account-form-head">
                <p>Settings</p>
                <button type="button" onClick={() => setMode('home')}>
                  Back to account
                </button>
              </div>
              <h2>Sign in</h2>
              <label>
                Login ID
                <input value={signinLogin} onChange={(e) => setSigninLogin(e.target.value)} placeholder="Login ID" />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={signinPassword}
                  onChange={(e) => setSigninPassword(e.target.value)}
                  placeholder="Password"
                />
              </label>
              <button className="account-btn account-btn--primary" type="submit" disabled={busy}>
                {busy ? 'Signing in...' : 'Sign in'}
              </button>
              <button className="account-btn" type="button" onClick={() => setMode('signup')} disabled={busy}>
                Go to sign up
              </button>
            </form>
          )}

          {mode === 'signup' && (
            <form className="account-form" onSubmit={handleSignUp}>
              <div className="account-form-head">
                <p>Settings</p>
                <button type="button" onClick={() => setMode('home')}>
                  Back to account
                </button>
              </div>
              <h2>Sign up</h2>
              <label>
                Login ID
                <input value={signupLogin} onChange={(e) => setSignupLogin(e.target.value)} placeholder="Login ID" />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="Password"
                />
              </label>
              <label>
                Confirm password
                <input
                  type="password"
                  value={signupPasswordConfirm}
                  onChange={(e) => setSignupPasswordConfirm(e.target.value)}
                  placeholder="Re-enter your password"
                />
              </label>
              <label>
                Nickname
                <input
                  value={signupNickname}
                  onChange={(e) => setSignupNickname(e.target.value)}
                  placeholder="Nickname shown in posts"
                />
              </label>
              <button className="account-btn account-btn--primary" type="submit" disabled={busy}>
                {busy ? 'Signing up...' : 'Sign up'}
              </button>
              <button className="account-btn" type="button" onClick={() => setMode('signin')} disabled={busy}>
                Go to sign in
              </button>
            </form>
          )}
        </section>

        {msg && <p className="account-message">{msg}</p>}

        <section className="account-card">
          <h3 className="account-section-title">Language</h3>
          <div className="account-pills">
            {languageItems.map((item) => (
              <button key={item} type="button" className={`account-pill${item === 'English' ? ' is-active' : ''}`}>
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="account-card">
          <h3 className="account-section-title">Privacy & support</h3>
          <button type="button" className="account-row">
            <span className="account-row-icon">◌</span>
            <span>Privacy Policy</span>
          </button>
          <button type="button" className="account-row">
            <span className="account-row-icon">◌</span>
            <span>CHZZK</span>
          </button>
          <button type="button" className="account-row">
            <span className="account-row-icon">◌</span>
            <span>Instagram</span>
          </button>
          <button type="button" className="account-row">
            <span className="account-row-icon">◌</span>
            <span>Email support</span>
          </button>
        </section>
      </div>

      <nav className="map-bottom-nav" aria-label="Основная навигация">
        <NavLink to="/" end className={({ isActive }) => `map-bottom-nav__item${isActive ? ' is-active' : ''}`}>
          <span className="map-bottom-nav__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M4.5 6.5 9 4l6 2.5 4.5-2v13L15 20l-6-2.5-4.5 2z" />
              <path d="M9 4v13.5M15 6.5V20" />
            </svg>
          </span>
        </NavLink>
        <NavLink to="/account" className={({ isActive }) => `map-bottom-nav__item${isActive ? ' is-active' : ''}`}>
          <span className="map-bottom-nav__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M4 8h16M4 16h16" />
              <circle cx="9" cy="8" r="2" />
              <circle cx="15" cy="16" r="2" />
            </svg>
          </span>
        </NavLink>
      </nav>
    </div>
  );
}
