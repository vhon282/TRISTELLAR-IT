import { GoogleSheetTargetModule } from '../types/cmms';

export const MODULE_TARGET_LABELS: Record<GoogleSheetTargetModule, string> = {
  helpdesk: 'Helpdesk Report',
  maintenance: 'Preventive Maint.',
  assets: 'Asset Registry',
  comms: 'IT Comms Hub',
  dashboard: 'Dashboard Only',
};

export const MODULE_TARGET_OPTIONS: {
  value: GoogleSheetTargetModule;
  label: string;
}[] = [
  { value: 'helpdesk', label: 'Helpdesk Report (+ Dashboard)' },
  { value: 'maintenance', label: 'Preventive Maint. (+ Dashboard)' },
  { value: 'assets', label: 'Asset Registry (+ Dashboard)' },
  { value: 'comms', label: 'IT Comms Hub (+ Dashboard)' },
  { value: 'dashboard', label: 'Dashboard Quick Links Only' },
];

export function normalizeGoogleSheetUrl(raw: string): {
  valid: boolean;
  normalizedUrl: string;
  error?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, normalizedUrl: '', error: 'Please enter a Google Sheets URL.' };
  }

  let candidate = trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        normalizedUrl: '',
        error: 'Only http:// or https:// spreadsheet links are allowed.',
      };
    }
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return {
        valid: false,
        normalizedUrl: '',
        error: 'Please enter a valid web URL (e.g. https://docs.google.com/spreadsheets/...).',
      };
    }
    return { valid: true, normalizedUrl: parsed.toString() };
  } catch {
    return {
      valid: false,
      normalizedUrl: '',
      error: 'Invalid URL format. Paste the full Google Sheets link.',
    };
  }
}

export function extractSheetMeta(url: string): { sheetId?: string; gid?: string } {
  try {
    const parsed = new URL(url);
    const idMatch = parsed.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    const gidFromQuery = parsed.searchParams.get('gid');
    const gidFromHash = parsed.hash.match(/gid=(\d+)/)?.[1];
    return {
      sheetId: idMatch?.[1],
      gid: gidFromQuery || gidFromHash || undefined,
    };
  } catch {
    return {};
  }
}
