import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, Sun, Moon, AlertCircle, LogIn } from 'lucide-react';
import { AuthUser, authenticateOperator } from '../../services/auth';

interface LoginScreenProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onLoginSuccess: (user: AuthUser) => void;
}

const OPERATOR_QUICK_SELECT: { username: 'mac' | 'francis' | 'vhon'; label: string }[] = [
  { username: 'mac', label: 'Mac' },
  { username: 'francis', label: 'Francis' },
  { username: 'vhon', label: 'Vhon' },
];

export const LoginScreen: React.FC<LoginScreenProps> = ({
  theme,
  onToggleTheme,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = authenticateOperator(username, password);
    if (!user) {
      setErrorMsg('Invalid username or password. Use mac, francis, or vhon.');
      return;
    }
    setErrorMsg('');
    onLoginSuccess(user);
  };

  const logoUrl = `${import.meta.env.BASE_URL}assets/aistudio/TTC.Logo.Tagline_MKT_Ver7824_3b47c9b8.png`;

  return (
    <div className="min-h-[100dvh] w-full overflow-y-auto overflow-x-hidden flex flex-col items-center px-4 py-6 sm:p-6 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      <div className="w-full max-w-md my-auto bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 sm:p-8 shadow-sm space-y-5 sm:space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2 min-w-0">
            <div className="inline-flex items-center rounded-lg bg-white px-2 py-1 dark:bg-white/95">
              <img
                src={logoUrl}
                alt="TriStellar — Bigas ng Bayan"
                className="h-9 sm:h-11 w-auto max-w-[210px] object-contain"
              />
            </div>
            <div className="min-w-0">
              <h1 className="font-display font-bold text-sm sm:text-base tracking-tight text-stone-900 dark:text-stone-100 truncate">
                TRISTELLAR IT DEPT.
              </h1>
              <p className="text-xs text-stone-500 dark:text-stone-400 leading-snug">
                IT Operations, Assets &amp; Preventive Maintenance
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            className="p-2.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors shrink-0"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>

        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
            Operator Sign In
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
            Sign in with your IT department account to manage assets, PM schedules, vouchers, and team notes.
          </p>
        </div>

        {/* Quick Operator Select */}
        <div className="space-y-1.5">
          <span className="block text-[11px] font-medium text-stone-500 dark:text-stone-400">
            Select Operator
          </span>
          <div className="grid grid-cols-3 gap-2">
            {OPERATOR_QUICK_SELECT.map((op) => {
              const active = username.trim().toLowerCase() === op.username;
              return (
                <button
                  key={op.username}
                  type="button"
                  onClick={() => {
                    setUsername(op.username);
                    setErrorMsg('');
                  }}
                  className={`min-h-[44px] sm:min-h-0 py-2 px-2 sm:px-3 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-orange-600 text-white border-orange-600'
                      : 'bg-stone-50 dark:bg-stone-950 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:border-orange-400'
                  }`}
                >
                  {op.label}
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="login-username"
              className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5"
            >
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-username"
                type="text"
                required
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                enterKeyHint="next"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="mac, francis, or vhon"
                className="w-full pl-9 pr-3 py-2.5 text-base sm:text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                enterKeyHint="done"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="Enter password"
                className="w-full pl-9 pr-11 py-2.5 text-base sm:text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full min-h-[44px] sm:min-h-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm sm:text-xs font-semibold bg-orange-600 text-white hover:bg-orange-700 transition-colors whitespace-nowrap"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In to CMMS</span>
          </button>
        </form>
      </div>
    </div>
  );
};
