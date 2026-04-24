import { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

import { sessionNickname, signInWithLoginId, signUpWithLoginId } from '../lib/auth';
import { supabase } from '../lib/supabase';

type AuthMode = 'home' | 'signin' | 'signup';

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

export default function AccountPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('home');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>('');
  const [currentNickname, setCurrentNickname] = useState<string | null>(null);

  const [signinLoginId, setSigninLoginId] = useState('');
  const [signinPassword, setSigninPassword] = useState('');

  const [signupLoginId, setSignupLoginId] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('');
  const [signupNickname, setSignupNickname] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  const languageItems = useMemo(() => ['Русский', 'English'], []);

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

  useEffect(() => {
    if (!supabase) {
      setCurrentNickname(null);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setCurrentNickname(sessionNickname(data.session));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentNickname(sessionNickname(session));
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    if (!supabase) {
      setMsg('Supabase не настроен');
      return;
    }

    setBusy(true);
    const { error } = await signInWithLoginId(supabase, signinLoginId, signinPassword);
    setBusy(false);

    if (error) {
      setMsg(error);
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
      setMsg('Аккаунт создан, вы уже вошли в систему.');
      setMode('home');
      return;
    }

    setMsg('Аккаунт создан, но вход не выполнен. Отключите подтверждение email в настройках Supabase Auth.');
    setMode('signin');
    setSigninLoginId(signupLoginId.trim().toLowerCase());
    setSigninPassword('');
  }

  async function handleSignOut() {
    if (!supabase) {
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setMsg('Вы вышли из аккаунта');
    setMode('home');
  }

  return (
    <div className="account-page">
      <div className="account-wrap">
        <p className="account-kicker">Account</p>
        <h1 className="account-title">Settings</h1>

        <section className="account-card">
          {mode === 'home' && (
            <>
              <div className="account-row account-row--head">
                <span className="account-row-icon">◎</span>
                <span className="account-row-main">
                  <strong>Account</strong>
                  <small>
                    {currentNickname
                      ? `Вы вошли как @${currentNickname}`
                      : 'Sign in to manage your nickname, password and activity.'}
                  </small>
                </span>
              </div>
              {currentNickname ? (
                <button type="button" className="account-row" onClick={handleSignOut} disabled={busy}>
                  <span className="account-row-icon">◌</span>
                  <span>{busy ? 'Signing out...' : 'Sign out'}</span>
                </button>
              ) : (
                <>
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
                <input
                  type="text"
                  value={signinLoginId}
                  onChange={(e) => setSigninLoginId(e.target.value)}
                  placeholder="unique login id"
                />
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
                <input
                  type="text"
                  value={signupLoginId}
                  onChange={(e) => setSignupLoginId(e.target.value)}
                  placeholder="unique login id"
                />
              </label>
              <label>
                Password
                <div className="account-password-wrap">
                  <input
                    type={showSignupPassword ? 'text' : 'password'}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Password"
                  />
                  <button
                    type="button"
                    className="account-password-toggle"
                    aria-label={showSignupPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    onClick={() => setShowSignupPassword((prev) => !prev)}
                  >
                    <VisibilityIcon off={showSignupPassword} />
                  </button>
                </div>
              </label>
              <label>
                Confirm password
                <input
                  type={showSignupPassword ? 'text' : 'password'}
                  value={signupPasswordConfirm}
                  onChange={(e) => setSignupPasswordConfirm(e.target.value)}
                  placeholder="Re-enter your password"
                />
              </label>
              <label>
                Никнейм
                <input
                  type="text"
                  value={signupNickname}
                  onChange={(e) => setSignupNickname(e.target.value)}
                  placeholder="Nickname shown on posts"
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
