// src/pages/AuthPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { loginUser, registerUser, type LoginType } from '../api/auth';

type AuthMode = 'login' | 'register';

const AuthPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [loginType, setLoginType] = useState<LoginType>('phone');

  const [name, setName] = useState('');
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetError = () => setError(null);

  const handleSwitchMode = (nextMode: AuthMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    resetError();
  };

  const handleLoginTypeChange = (type: LoginType) => {
    setLoginType(type);
    setLoginValue('');
    resetError();
  };

  const getLoginLabel = () =>
    loginType === 'phone' ? 'Телефон' : 'E-mail';

  const getLoginPlaceholder = () =>
    loginType === 'phone' ? '+7 900 000-00-00' : 'you@example.com';

  const validate = (): boolean => {
    if (mode === 'register' && !name.trim()) {
      setError('Введи имя');
      return false;
    }

    if (!loginValue.trim()) {
      setError(`Введи ${loginType === 'phone' ? 'телефон' : 'e-mail'}`);
      return false;
    }

    if (!password.trim()) {
      setError('Введи пароль');
      return false;
    }

    if (password.length < 6) {
      setError('Пароль должен быть не короче 6 символов');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetError();

    if (!validate()) return;

    setLoading(true);

    try {
      const common = {
        loginType,
        loginValue: loginValue.trim(),
        password: password.trim(),
      };

      const user =
        mode === 'register'
          ? await registerUser({
              ...common,
              name: name.trim(),
            })
          : await loginUser(common);

      login(user);
      navigate('/');
    } catch (err: any) {
      console.error('auth error', err);
      const msg =
        err?.message ||
        (mode === 'login'
          ? 'Не удалось войти, попробуй ещё раз'
          : 'Не удалось зарегистрироваться');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <Header showSearch={false} showCategoriesButton={false} />

      <main className="main auth-main">
        <div className="auth-card">
          <div className="auth-tabs">
            <button
              type="button"
              className={mode === 'login' ? 'auth-tab active' : 'auth-tab'}
              onClick={() => handleSwitchMode('login')}
            >
              Вход
            </button>
            <button
              type="button"
              className={mode === 'register' ? 'auth-tab active' : 'auth-tab'}
              onClick={() => handleSwitchMode('register')}
            >
              Регистрация
            </button>
          </div>

          <h1 className="auth-title">
            {mode === 'login' ? 'Вход в аккаунт' : 'Создание аккаунта'}
          </h1>

          <div className="auth-login-type">
            <button
              type="button"
              className={
                loginType === 'phone'
                  ? 'auth-login-type-btn active'
                  : 'auth-login-type-btn'
              }
              onClick={() => handleLoginTypeChange('phone')}
            >
              По телефону
            </button>
            <button
              type="button"
              className={
                loginType === 'email'
                  ? 'auth-login-type-btn active'
                  : 'auth-login-type-btn'
              }
              onClick={() => handleLoginTypeChange('email')}
            >
              По e-mail
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'register' && (
              <div className="field">
                <label htmlFor="name">Имя</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    resetError();
                  }}
                  placeholder="Как к тебе обращаться"
                  autoComplete="name"
                />
              </div>
            )}

            <div className="field">
              <label htmlFor="login">{getLoginLabel()}</label>
              <input
                id="login"
                type={loginType === 'email' ? 'email' : 'tel'}
                value={loginValue}
                onChange={(e) => {
                  setLoginValue(e.target.value);
                  resetError();
                }}
                placeholder={getLoginPlaceholder()}
                autoComplete={loginType === 'email' ? 'email' : 'tel'}
              />
            </div>

            <div className="field">
              <label htmlFor="password">Пароль</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  resetError();
                }}
                placeholder="Минимум 6 символов"
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
              />
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button
              type="submit"
              className="primary-btn auth-submit"
              disabled={loading}
            >
              {loading
                ? 'Отправляем…'
                : mode === 'login'
                ? 'Войти'
                : 'Зарегистрироваться'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default AuthPage;
