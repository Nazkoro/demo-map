import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

import StatusToast from './StatusToast';
import {
  checkLoginIdTaken,
  checkNicknameTaken,
  sessionNickname,
  signInWithLoginId,
  signUpWithLoginId,
  validateLoginId,
  validateNickname,
} from '../lib/auth';
import { supabase } from '../lib/supabase';

type AuthMode = 'home' | 'signin' | 'signup';
type ToastType = 'info' | 'success' | 'error';
type LoginIdStatus = 'idle' | 'invalid' | 'checking' | 'found' | 'not_found' | 'available' | 'taken';
type NicknameStatus = 'idle' | 'invalid' | 'checking' | 'available' | 'taken';

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
  const [toast, setToast] = useState<{ message: string; type: ToastType; key: number } | null>(null);
  const [currentNickname, setCurrentNickname] = useState<string | null>(null);

  const [signinLoginId, setSigninLoginId] = useState('');
  const [signinPassword, setSigninPassword] = useState('');
  const [signinLoginIdStatus, setSigninLoginIdStatus] = useState<LoginIdStatus>('idle');

  const [signupLoginId, setSignupLoginId] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('');
  const [signupNickname, setSignupNickname] = useState('');
  const [signupLoginIdStatus, setSignupLoginIdStatus] = useState<LoginIdStatus>('idle');
  const [signupNicknameStatus, setSignupNicknameStatus] = useState<NicknameStatus>('idle');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const signinLoginCheckSeqRef = useRef(0);
  const signupLoginCheckSeqRef = useRef(0);
  const nicknameCheckSeqRef = useRef(0);

  const languageItems = useMemo(() => ['Русский', 'English'], []);
  const isSignupPasswordTooShort = signupPassword.length > 0 && signupPassword.length < 6;
  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ message, type, key: Date.now() });
  };

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
    if (mode !== 'signin') {
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
  }, [mode, signinLoginId]);

  useEffect(() => {
    if (mode !== 'signup') {
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
  }, [mode, signupLoginId]);

  useEffect(() => {
    if (mode !== 'signup') {
      setSignupNicknameStatus('idle');
      return;
    }
    const normalizedNickname = signupNickname.trim();
    if (!normalizedNickname) {
      setSignupNicknameStatus('idle');
      return;
    }
    if (validateNickname(normalizedNickname)) {
      setSignupNicknameStatus('invalid');
      return;
    }
    const client = supabase;
    if (!client) {
      setSignupNicknameStatus('idle');
      return;
    }

    const currentRequest = ++nicknameCheckSeqRef.current;
    setSignupNicknameStatus('checking');
    const timeout = setTimeout(() => {
      void checkNicknameTaken(client, normalizedNickname).then((taken) => {
        if (currentRequest !== nicknameCheckSeqRef.current) {
          return;
        }
        setSignupNicknameStatus(taken ? 'taken' : 'available');
      });
    }, 450);

    return () => {
      clearTimeout(timeout);
    };
  }, [mode, signupNickname]);

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
      showToast('Supabase не настроен', 'error');
      return;
    }

    if (signinLoginIdStatus === 'checking') {
      showToast('Дождитесь завершения проверки логина', 'info');
      return;
    }
    if (signinLoginIdStatus === 'not_found') {
      showToast('Такой логин не найден', 'error');
      return;
    }
    setBusy(true);
    const { error } = await signInWithLoginId(supabase, signinLoginId, signinPassword);
    setBusy(false);

    if (error) {
      showToast(error, 'error');
      return;
    }

    navigate('/');
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    if (!supabase) {
      showToast('Supabase не настроен', 'error');
      return;
    }

    const loginIdValidationError = validateLoginId(signupLoginId);
    if (loginIdValidationError) {
      showToast(loginIdValidationError, 'error');
      return;
    }
    if (signupLoginIdStatus === 'checking') {
      showToast('Дождитесь завершения проверки логина', 'info');
      return;
    }
    if (signupLoginIdStatus === 'taken') {
      showToast('Логин уже занят', 'error');
      return;
    }
    if (signupPassword.length < 6) {
      return;
    }
    if (signupPassword !== signupPasswordConfirm) {
      showToast('Пароли не совпадают', 'error');
      return;
    }
    const nicknameValidationError = validateNickname(signupNickname);
    if (nicknameValidationError) {
      showToast(nicknameValidationError, 'error');
      return;
    }
    if (signupNicknameStatus === 'checking') {
      showToast('Дождитесь завершения проверки никнейма', 'info');
      return;
    }
    if (signupNicknameStatus === 'taken') {
      showToast('Никнейм уже занят', 'error');
      return;
    }

    setBusy(true);
    const { error, needsEmailConfirmation } = await signUpWithLoginId(supabase, signupLoginId, signupNickname, signupPassword);
    setBusy(false);

    if (error) {
      showToast(error, 'error');
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
      showToast(error.message, 'error');
      return;
    }
    setMsg('Вы вышли из аккаунта');
    setMode('home');
  }

  return (
    <div className="account-page">
      <div className="account-wrap">
        <p className="account-kicker">Аккаунт</p>
        <h1 className="account-title">Настройки</h1>

        <section className="account-card">
          {mode === 'home' && (
            <>
              <div className="account-row account-row--head">
                <span className="account-row-icon">◎</span>
                <span className="account-row-main">
                  <strong>Аккаунт</strong>
                  <small>
                    {currentNickname
                      ? `Вы вошли как: ${currentNickname}`
                      : 'Войдите, чтобы управлять никнеймом, паролем и активностью.'}
                  </small>
                </span>
              </div>
              {currentNickname ? (
                <button type="button" className="account-row" onClick={handleSignOut} disabled={busy}>
                  <span className="account-row-icon">◌</span>
                  <span>{busy ? 'Выход...' : 'Выйти'}</span>
                </button>
              ) : (
                <>
                  <button type="button" className="account-row" onClick={() => setMode('signin')}>
                    <span className="account-row-icon">◌</span>
                    <span>Войти</span>
                  </button>
                  <button type="button" className="account-row" onClick={() => setMode('signup')}>
                    <span className="account-row-icon">◌</span>
                    <span>Регистрация</span>
                  </button>
                </>
              )}
            </>
          )}

          {mode === 'signin' && (
            <form className="account-form" onSubmit={handleSignIn}>
              <div className="account-form-head">
                <p>Настройки</p>
                <button type="button" onClick={() => setMode('home')}>
                  Назад к аккаунту
                </button>
              </div>
              <h2>Вход</h2>
              <label>
                Логин
                <input
                  type="text"
                  value={signinLoginId}
                  onChange={(e) => setSigninLoginId(e.target.value)}
                  placeholder="уникальный логин"
                />
                {signinLoginIdStatus === 'not_found' && <small className="account-field-hint is-error">Логин не найден</small>}
                {signinLoginIdStatus === 'invalid' && (
                  <small className="account-field-hint is-error">{validateLoginId(signinLoginId.trim().toLowerCase())}</small>
                )}
              </label>
              <label>
                Пароль
                <input
                  type="password"
                  value={signinPassword}
                  onChange={(e) => setSigninPassword(e.target.value)}
                  placeholder="Пароль"
                />
              </label>
              <button
                className="account-btn account-btn--primary"
                type="submit"
                disabled={busy || signinLoginIdStatus === 'checking'}
              >
                {busy ? 'Вход...' : 'Войти'}
              </button>
              <button className="account-btn" type="button" onClick={() => setMode('signup')} disabled={busy}>
                Перейти к регистрации
              </button>
            </form>
          )}

          {mode === 'signup' && (
            <form className="account-form" onSubmit={handleSignUp}>
              <div className="account-form-head">
                <p>Настройки</p>
                <button type="button" onClick={() => setMode('home')}>
                  Назад к аккаунту
                </button>
              </div>
              <h2>Регистрация</h2>
              <label>
                Логин
                <input
                  type="text"
                  value={signupLoginId}
                  onChange={(e) => setSignupLoginId(e.target.value)}
                  placeholder="уникальный логин"
                />
                {signupLoginIdStatus === 'taken' && <small className="account-field-hint is-error">Логин уже занят</small>}
                {signupLoginIdStatus === 'invalid' && (
                  <small className="account-field-hint is-error">{validateLoginId(signupLoginId.trim().toLowerCase())}</small>
                )}
              </label>
              <label>
                Пароль
                <div className="account-password-wrap">
                  <input
                    type={showSignupPassword ? 'text' : 'password'}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Пароль"
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
                {isSignupPasswordTooShort && (
                  <small className="account-field-hint is-error">Пароль должен быть минимум 6 символов</small>
                )}
              </label>
              <label>
                Подтвердите пароль
                <input
                  type={showSignupPassword ? 'text' : 'password'}
                  value={signupPasswordConfirm}
                  onChange={(e) => setSignupPasswordConfirm(e.target.value)}
                  placeholder="Повторите пароль"
                />
              </label>
              <label>
                Никнейм
                <input
                  type="text"
                  value={signupNickname}
                  onChange={(e) => setSignupNickname(e.target.value)}
                  placeholder="Никнейм, который видят другие"
                />
                {signupNicknameStatus === 'checking' && <small className="account-field-hint">Проверяем никнейм...</small>}
                {signupNicknameStatus === 'available' && <small className="account-field-hint is-ok">Никнейм свободен</small>}
                {signupNicknameStatus === 'taken' && <small className="account-field-hint is-error">Никнейм уже занят</small>}
                {signupNicknameStatus === 'invalid' && (
                  <small className="account-field-hint is-error">{validateNickname(signupNickname.trim())}</small>
                )}
              </label>
              <button
                className="account-btn account-btn--primary"
                type="submit"
                disabled={
                  busy ||
                  signupLoginIdStatus === 'checking' ||
                  signupLoginIdStatus === 'taken' ||
                  isSignupPasswordTooShort ||
                  signupNicknameStatus === 'checking' ||
                  signupNicknameStatus === 'taken'
                }
              >
                {busy ? 'Регистрация...' : 'Зарегистрироваться'}
              </button>
              <button className="account-btn" type="button" onClick={() => setMode('signin')} disabled={busy}>
                Перейти ко входу
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
      {toast && <StatusToast key={toast.key} message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
