import React, { useState } from 'react';
import { Lock, Mail, Eye, EyeOff, Sun, Moon, AlertCircle, LogIn } from 'lucide-react';
import { AuthUser, authenticateOperator } from '../../services/auth';

interface LoginScreenProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onLoginSuccess: (user: AuthUser) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  theme,
  onToggleTheme,
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      const user = await authenticateOperator(email, password);
      if (!user) {
        setErrorMsg('Sign-in failed. Check your email and password.');
        return;
      }
      onLoginSuccess(user);
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Sign-in failed. Check your Supabase Auth account and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const logoUrl = `${import.meta.env.BASE_URL}assets/aistudio/TTC.Logo.Tagline_MKT_Ver7824_3b47c9b8.png`;

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center px-4 py-6 sm:p-6 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      <div className="w-full max-w-md my-auto bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 sm:p-8 shadow-sm space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2 min-w-0">
            <div className="inline-flex items-center rounded-lg bg-white px-2 py-1 dark:bg-white/95">
              <img src={logoUrl} alt="TriStellar — Bigas ng Bayan" className="h-9 sm:h-11 w-auto max-w-[210px] object-contain" />
            </div>
            <h1 className="font-bold text-sm sm:text-base">TRISTELLAR IT DEPT.</h1>
            <p className="text-xs text-stone-500 dark:text-stone-400">IT Operations, Assets &amp; Preventive Maintenance</p>
          </div>
          <button type="button" onClick={onToggleTheme} aria-label="Toggle theme" className="p-2.5 rounded-lg border border-stone-200 dark:border-stone-800">
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>

        <div>
          <h2 className="text-sm font-semibold">Operator Sign In</h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">Sign in with an account created in this Supabase project.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-xs font-semibold mb-1.5">Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input id="login-email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="w-full pl-9 pr-3 py-2.5 text-base sm:text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950" />
            </div>
          </div>
          <div>
            <label htmlFor="login-password" className="block text-xs font-semibold mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input id="login-password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your Supabase Auth password" className="w-full pl-9 pr-11 py-2.5 text-base sm:text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950" />
              <button type="button" onClick={() => setShowPassword((show) => !show)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 text-stone-400">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {errorMsg && <div role="alert" className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300"><AlertCircle className="w-4 h-4 shrink-0" /><span>{errorMsg}</span></div>}
          <button type="submit" disabled={isSubmitting} className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm sm:text-xs font-semibold bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60">
            <LogIn className="w-4 h-4" /><span>{isSubmitting ? 'Signing in…' : 'Sign In to CMMS'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
