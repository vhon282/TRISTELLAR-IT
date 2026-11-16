import type { Technician } from '../types/cmms';

export interface AuthUser {
  username: 'mac' | 'francis' | 'vhon';
  displayName: Technician;
  role: string;
}

interface AuthAccount extends AuthUser {
  password: string;
}

const ACCOUNTS: AuthAccount[] = [
  {
    username: 'mac',
    displayName: 'Mac',
    role: 'IT Lead',
    password: '123',
  },
  {
    username: 'francis',
    displayName: 'Francis',
    role: 'IT Support',
    password: '123',
  },
  {
    username: 'vhon',
    displayName: 'Vhon',
    role: 'IT Support',
    password: '123',
  },
];

const AUTH_SESSION_KEY = 'tristellar_cmms_auth_session_v1';

export function authenticateOperator(
  rawUsername: string,
  password: string
): AuthUser | null {
  const normalized = rawUsername.trim().toLowerCase();
  const match = ACCOUNTS.find(
    (acc) => acc.username === normalized && acc.password === password
  );
  if (!match) return null;
  return {
    username: match.username,
    displayName: match.displayName,
    role: match.role,
  };
}

export function loadAuthSession(): AuthUser | null {
  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    const valid = ACCOUNTS.find((acc) => acc.username === parsed.username);
    if (!valid) return null;
    return {
      username: valid.username,
      displayName: valid.displayName,
      role: valid.role,
    };
  } catch {
    return null;
  }
}

export function saveAuthSession(user: AuthUser): void {
  try {
    window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user));
  } catch {
    // ignore storage errors
  }
}

export function clearAuthSession(): void {
  try {
    window.localStorage.removeItem(AUTH_SESSION_KEY);
  } catch {
    // ignore storage errors
  }
}
