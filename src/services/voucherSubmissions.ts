import type {
  VoucherDeviceType,
  VoucherStatus,
  WifiVoucher,
  WifiVoucherSubmission,
} from '../types/cmms';
import { getSupabaseClient } from './supabaseClient';

export const GITHUB_PAGES_BASE_URL = 'https://vhon282.github.io/TRISTELLAR-IT/';

const LOCAL_SUBMISSIONS_KEY = 'tristellar_voucher_submissions_v1';
const VALID_DEVICE_TYPES = new Set<VoucherDeviceType>([
  'Company Laptop',
  'Company Phone',
  'Personal Phone',
  'Tablet',
  'Guest Device',
]);

function normalizeDeviceType(raw: unknown): VoucherDeviceType {
  const s = String(raw || '').trim() as VoucherDeviceType;
  return VALID_DEVICE_TYPES.has(s) ? s : 'Company Laptop';
}

function formatPortalTimestamp(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) {
    return new Date().toISOString().slice(0, 19).replace('T', ' ').replace(/-/g, '/');
  }
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  const hh = String(dt.getHours()).padStart(2, '0');
  const mi = String(dt.getMinutes()).padStart(2, '0');
  const ss = String(dt.getSeconds()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd} ${hh}:${mi}:${ss}`;
}

/** Canonical GitHub Pages URL for Ruijie post-voucher redirect. */
export function buildRuijieVoucherFormUrl(): string {
  return `${GITHUB_PAGES_BASE_URL}?page=voucher-form`;
}

export function buildCurrentHostVoucherFormUrl(): string {
  try {
    const base = `${window.location.origin}${import.meta.env.BASE_URL || '/'}`;
    const url = new URL(base);
    url.searchParams.set('page', 'voucher-form');
    return url.toString();
  } catch {
    return buildRuijieVoucherFormUrl();
  }
}

export function isVoucherFormRoute(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    const page = (params.get('page') || '').trim().toLowerCase();
    if (page === 'voucher-form' || page === 'voucher') return true;
    if (params.has('voucher-form') || params.has('voucherForm')) return true;

    const hash = window.location.hash.toLowerCase();
    if (hash.includes('voucher-form')) return true;

    const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
    if (path.endsWith('/voucher-form')) return true;
  } catch {
    // ignore URL parsing errors
  }
  return false;
}

export function readLocalVoucherSubmissions(): WifiVoucherSubmission[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_SUBMISSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WifiVoucherSubmission[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalVoucherSubmission(submission: WifiVoucherSubmission): void {
  try {
    const existing = readLocalVoucherSubmissions();
    const subCode = submission.voucherCode.trim().toLowerCase();
    const filtered = existing.filter((item) => {
      if (item.id === submission.id) return false;
      if (subCode && item.voucherCode.trim().toLowerCase() === subCode) return false;
      return true;
    });
    window.localStorage.setItem(
      LOCAL_SUBMISSIONS_KEY,
      JSON.stringify([submission, ...filtered].slice(0, 300))
    );
  } catch {
    // ignore storage errors
  }
}

export function removeLocalVoucherSubmission(id: string): void {
  try {
    const existing = readLocalVoucherSubmissions();
    window.localStorage.setItem(
      LOCAL_SUBMISSIONS_KEY,
      JSON.stringify(existing.filter((item) => item.id !== id))
    );
  } catch {
    // ignore storage errors
  }
}

export function mergeVoucherSubmissionLists(
  ...lists: WifiVoucherSubmission[][]
): WifiVoucherSubmission[] {
  const byId = new Map<string, WifiVoucherSubmission>();
  for (const list of lists) {
    for (const item of list) {
      if (!item || !item.id || !item.fullName) continue;
      byId.set(item.id, item);
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
}

function mapRowToSubmission(row: Record<string, unknown>): WifiVoucherSubmission {
  return {
    id: String(row.id || `wvs-${Date.now()}`),
    voucherCode: String(row.voucher_code || '').trim(),
    fullName: String(row.full_name || '').trim(),
    employeeNumber: String(row.employee_number || '').trim(),
    userGroup:
      String(row.user_group || '').toUpperCase() === 'GUEST' ? 'GUEST' : 'Employee',
    department: String(row.department || '').trim(),
    branchLocation: String(row.branch_location || '').trim(),
    deviceType: normalizeDeviceType(row.device_type),
    alias: String(row.alias || '').trim(),
    phoneNumber: String(row.phone_number || '').trim(),
    macAddress: row.mac_address ? String(row.mac_address).trim() : undefined,
    submittedAt: row.submitted_at
      ? String(row.submitted_at)
      : new Date().toISOString(),
  };
}

/**
 * Persists a public Ruijie user information form submission.
 * Writes to localStorage first and races remote Supabase persistence
 * against a short timeout so the user is never stalled before redirecting.
 */
export async function submitPublicVoucherRegistration(
  submission: WifiVoucherSubmission
): Promise<{ remoteSaved: boolean }> {
  saveLocalVoucherSubmission(submission);

  const persistRemote = async (): Promise<boolean> => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('wifi_voucher_submissions').insert({
        id: submission.id,
        voucher_code: submission.voucherCode.trim(),
        full_name: submission.fullName.trim(),
        employee_number: submission.employeeNumber.trim(),
        user_group: submission.userGroup,
        department: submission.department.trim(),
        branch_location: submission.branchLocation.trim(),
        device_type: submission.deviceType,
        alias: submission.alias.trim(),
        phone_number: submission.phoneNumber.trim(),
        mac_address: (submission.macAddress || '').trim(),
        submitted_at: submission.submittedAt,
      });

      return !error;
    } catch {
      return false;
    }
  };

  const timeoutPromise = new Promise<boolean>((resolve) => {
    window.setTimeout(() => resolve(false), 3500);
  });

  const remoteSaved = await Promise.race([persistRemote(), timeoutPromise]);
  return { remoteSaved };
}

export async function fetchRemoteVoucherSubmissions(): Promise<WifiVoucherSubmission[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('wifi_voucher_submissions')
      .select('*')
      .order('submitted_at', { ascending: false })
      .limit(500);

    if (error || !Array.isArray(data)) return [];
    return data
      .map((row) => mapRowToSubmission(row as Record<string, unknown>))
      .filter((s) => Boolean(s.fullName));
  } catch {
    return [];
  }
}

export async function deleteRemoteVoucherSubmission(id: string): Promise<void> {
  removeLocalVoucherSubmission(id);
  try {
    const supabase = getSupabaseClient();
    await supabase.from('wifi_voucher_submissions').delete().eq('id', id);
  } catch {
    // ignore remote delete failure
  }
}

export function subscribeVoucherSubmissions(
  onInsert: (submission: WifiVoucherSubmission) => void
): () => void {
  try {
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel('tristellar-voucher-submissions')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wifi_voucher_submissions' },
        (payload) => {
          const row = payload.new as Record<string, unknown> | null;
          if (!row || !row.full_name) return;
          const mapped = mapRowToSubmission(row);
          if (mapped.fullName) {
            onInsert(mapped);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel).catch(() => undefined);
    };
  } catch {
    return () => undefined;
  }
}

/**
 * Merges submitted Ruijie registrations that carry a voucher code into wifiVouchers.
 * Submissions without a voucher code remain visible in the Ruijie Check-In log.
 */
export function applyVoucherSubmissions(
  existing: WifiVoucher[],
  submissions: WifiVoucherSubmission[]
): { vouchers: WifiVoucher[]; changed: boolean } {
  const codedSubs = submissions.filter((s) => s.voucherCode.trim().length > 0);
  if (codedSubs.length === 0) {
    return { vouchers: existing, changed: false };
  }

  const latestByCode = new Map<string, WifiVoucherSubmission>();
  const sorted = [...codedSubs].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
  for (const sub of sorted) {
    const key = sub.voucherCode.trim().toLowerCase();
    if (!key || latestByCode.has(key)) continue;
    latestByCode.set(key, sub);
  }

  let changed = false;
  const matchedKeys = new Set<string>();

  const next = existing.map((v) => {
    const key = v.voucherCode.trim().toLowerCase();
    const sub = latestByCode.get(key);
    if (!sub) return v;
    matchedKeys.add(key);

    const nextDate = sub.submittedAt.slice(0, 10) || v.date;
    const nextActivated = v.activatedAt || formatPortalTimestamp(sub.submittedAt);
    const nextStatus: VoucherStatus = v.status === 'Expired' ? 'Expired' : 'Used';
    const nextPortalStatus =
      v.status === 'Expired' ? v.portalStatus || 'Expired' : 'In use';

    const alreadySynced =
      v.submittedAt === sub.submittedAt &&
      v.employeeName === sub.fullName &&
      v.status === nextStatus &&
      (v.branchLocation || '') === sub.branchLocation;

    if (alreadySynced) return v;

    changed = true;
    return {
      ...v,
      date: nextDate,
      employeeName: sub.fullName || v.employeeName,
      employeeNumber: sub.employeeNumber || v.employeeNumber,
      deviceType: sub.deviceType || v.deviceType,
      userGroup: sub.userGroup || v.userGroup,
      alias: sub.alias || v.alias,
      branchLocation: sub.branchLocation || v.branchLocation,
      department: sub.department || v.department,
      phoneNumber: sub.phoneNumber || v.phoneNumber,
      macBinding: v.macBinding || sub.macAddress,
      status: nextStatus,
      portalStatus: nextPortalStatus,
      activatedAt: nextActivated,
      submittedAt: sub.submittedAt,
    };
  });

  const additions: WifiVoucher[] = [];
  for (const [key, sub] of latestByCode.entries()) {
    if (matchedKeys.has(key)) continue;
    changed = true;
    additions.push({
      id: sub.id.startsWith('wv-') ? sub.id : `wv-reg-${key}`,
      date: sub.submittedAt.slice(0, 10) || new Date().toISOString().slice(0, 10),
      voucherCode: sub.voucherCode,
      employeeName: sub.fullName,
      employeeNumber: sub.employeeNumber,
      deviceType: sub.deviceType,
      status: 'Used',
      userGroup: sub.userGroup,
      portalStatus: 'In use',
      period: sub.userGroup === 'GUEST' ? '1Days' : 'Unlimited',
      alias: sub.alias || undefined,
      branchLocation: sub.branchLocation || undefined,
      department: sub.department || undefined,
      phoneNumber: sub.phoneNumber || undefined,
      macBinding: sub.macAddress || undefined,
      activatedAt: formatPortalTimestamp(sub.submittedAt),
      submittedAt: sub.submittedAt,
    });
  }

  return {
    vouchers: additions.length > 0 ? [...additions, ...next] : next,
    changed,
  };
}
