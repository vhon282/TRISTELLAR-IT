import type { Technician } from '../types/cmms';
import { getSupabaseClient } from './supabaseClient';

export interface AuthUser {
  username: string;
  displayName: Technician | string;
  role: string;
}

const AUTH_SESSION_KEY = 'tristellar_cmms_auth_session_v1';

function userToAuthUser(user: {
  email?: string;
  user_metadata?: Record<string, unknown>;
}): AuthUser {
  const metadata = user.user_metadata ?? {};
  const username = String(metadata.username || user.email?.split('@')[0] || 'operator')
    .trim()
    .toLowerCase();
  const displayName = String(
    metadata.display_name || username.charAt(0).toUpperCase() + username.slice(1)
  );
  const role = String(metadata.role || 'IT Support');
  return { username, displayName, role };
}

/** Authenticate against Supabase Auth. Use email/password credentials created in Supabase. */
export async function authenticateOperator(
  email: string,
  password: string
): Promise<AuthUser | null> {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  return data.user ? userToAuthUser(data.user) : null;
}

/**
 * App bootstrap is synchronous; validate its cached profile against Supabase's
 * persisted Auth session instead of trusting the old standalone local profile.
 */
export function loadAuthSession(): AuthUser | null {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL?.trim();
    const projectRef = url ? new URL(url).hostname.split('.')[0] : '';
    if (!projectRef) return null;
    const raw = window.localStorage.getItem(`sb-${projectRef}-auth-token`);
    if (!raw) return null;
    const session = JSON.parse(raw) as {
      access_token?: string;
      expires_at?: number;
      user?: { email?: string; user_metadata?: Record<string, unknown> };
    };
    if (!session.access_token || !session.user) return null;
    if (session.expires_at && session.expires_at * 1000 <= Date.now()) return null;
    return userToAuthUser(session.user);
  } catch {
    return null;
  }
}

export function saveAuthSession(user: AuthUser): void {
  try {
    window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user));
  } catch {
    // Supabase's own persisted session remains authoritative.
  }
}

export function clearAuthSession(): void {
  try {
    window.localStorage.removeItem(AUTH_SESSION_KEY);
  } catch {
    // ignore storage errors
  }
  try {
    void getSupabaseClient().auth.signOut();
  } catch {
    // Supabase may be unconfigured during local setup.
  }
}
