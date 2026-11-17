import {
  AssetBundle,
  CmmsDatabase,
  GoogleSheetLink,
  GoogleSheetTargetModule,
  MaintenanceTask,
} from '../types/cmms';
import {
  DEFAULT_ASSET_BUNDLES,
  DEFAULT_CHECKLIST,
  DEFAULT_GOOGLE_SHEET_LINKS,
  SEED_DATABASE,
} from '../data/seedData';

const API_BASE_URL = 'https://expertise-int-ranging-fixes.trycloudflare.com';
const STORAGE_KEY = 'opsmaint_cmms_db_v1';
const THEME_KEY = 'opsmaint_cmms_theme';

/**
 * Clean async-ready storage adapter interface.
 * Connected to local PC SQLite server via Cloudflare Tunnel,
 * with localStorage fallback if the PC server is offline.
 */
export interface CmmsStorageAdapter {
  readonly providerName: string;
  load(): Promise<CmmsDatabase>;
  save(db: CmmsDatabase): Promise<void>;
  reset(): Promise<CmmsDatabase>;
}

class PcSqliteCmmsAdapter implements CmmsStorageAdapter {
  readonly providerName = 'pc-sqlite';

  async load(): Promise<CmmsDatabase> {
    // 1. Try loading from your PC's SQLite database first
    try {
      const response = await fetch(`${API_BASE_URL}/api/cmms`);
      if (response.ok) {
        const remoteData = await response.json();
        if (remoteData && typeof remoteData === 'object') {
          const normalized = normalizeDatabase(remoteData as Partial<CmmsDatabase>);
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
          return normalized;
        }
      }
    } catch {
      console.warn('PC SQLite server unreachable; falling back to localStorage cache.');
    }

    // 2. Fallback to localStorage cache if PC is offline or DB is brand new
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CmmsDatabase>;
        const normalized = normalizeDatabase(parsed);
        // Push existing localStorage data up to your PC DB if PC DB was empty
        this.save(normalized).catch(() => undefined);
        return normalized;
      }
    } catch {
      // ignore storage errors
    }

    // 3. First-time seed if neither PC DB nor localStorage has data yet
    const fresh = structuredClone(SEED_DATABASE);
    await this.save(fresh);
    return fresh;
  }

  async save(db: CmmsDatabase): Promise<void> {
    const payload: CmmsDatabase = {
      ...db,
      version: 1,
      updatedAt: new Date().toISOString(),
    };

    // Keep localStorage cache in sync
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage quota errors
    }

    // Save to your PC's SQLite database
    await fetch(`${API_BASE_URL}/api/cmms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  async reset(): Promise<CmmsDatabase> {
    const fresh = structuredClone(SEED_DATABASE);
    await this.save(fresh);
    return fresh;
  }
}

function normalizeTask(task: MaintenanceTask, idx: number): MaintenanceTask {
  const hasStructuredChecklist =
    Array.isArray(task.checklistItems) &&
    task.checklistItems.length >= 18 &&
    Boolean(task.checklistItems[0]?.section);

  const checklistItems = hasStructuredChecklist
    ? task.checklistItems
    : DEFAULT_CHECKLIST.map((item) => ({
        ...item,
        checked: task.status === 'Done',
        remarks: '',
      }));

  const parsedYear =
    (Number.isFinite(Number(task.year)) && Number(task.year) > 1990 ? Number(task.year) : 0) ||
    Number((task.scheduledDate || '').slice(0, 4)) ||
    Number((task.actualDate || '').slice(0, 4)) ||
    Number((task.seqNumber || '').slice(0, 4)) ||
    2026;

  const validQuarter =
    task.quarter === 'Q1' ||
    task.quarter === 'Q2' ||
    task.quarter === 'Q3' ||
    task.quarter === 'Q4'
      ? task.quarter
      : 'Q4';

  const normalizedTech =
    (task.technician as string) === 'Shem' ? 'Vhon' : task.technician;

  return {
    ...task,
    technician: normalizedTech,
    year: parsedYear,
    quarter: validQuarter,
    seqNumber: task.seqNumber || `${parsedYear}4TH-${String(idx + 1).padStart(2, '0')}`,
    formCode: task.formCode || 'INF-SUP-PRMC-2025 / SUP-PRMC-2022-00',
    checklistItems,
  };
}

const DEMO_VOUCHER_IDS = new Set([
  'wv-001',
  'wv-002',
  'wv-003',
  'wv-004',
  'wv-005',
  'wv-006',
]);

export function normalizeDatabase(partial: Partial<CmmsDatabase>): CmmsDatabase {
  const rawTasks = Array.isArray(partial.maintenanceTasks)
    ? partial.maintenanceTasks
    : structuredClone(SEED_DATABASE.maintenanceTasks);

  const rawCctv = Array.isArray(partial.cctvEntries)
    ? partial.cctvEntries
    : structuredClone(SEED_DATABASE.cctvEntries);

  const rawRadio = Array.isArray(partial.radioEntries)
    ? partial.radioEntries
    : structuredClone(SEED_DATABASE.radioEntries);

  const rawAuthDevices = Array.isArray(partial.wifiAuthorizedDevices)
    ? partial.wifiAuthorizedDevices
    : structuredClone(SEED_DATABASE.wifiAuthorizedDevices);

  const rawVouchers = Array.isArray(partial.wifiVouchers)
    ? partial.wifiVouchers.filter((v) => !DEMO_VOUCHER_IDS.has(v.id))
    : [];

  return {
    version: typeof partial.version === 'number' ? partial.version : 1,
    updatedAt: typeof partial.updatedAt === 'string' ? partial.updatedAt : new Date().toISOString(),
    assets: Array.isArray(partial.assets) ? partial.assets : structuredClone(SEED_DATABASE.assets),
    maintenanceTasks: rawTasks.map(normalizeTask),
    spareParts: Array.isArray(partial.spareParts)
      ? partial.spareParts
      : structuredClone(SEED_DATABASE.spareParts),
    disposalItems: Array.isArray(partial.disposalItems)
      ? partial.disposalItems
      : structuredClone(SEED_DATABASE.disposalItems),
    anydeskEntries: Array.isArray(partial.anydeskEntries)
      ? partial.anydeskEntries
      : structuredClone(SEED_DATABASE.anydeskEntries),
    cctvEntries: rawCctv.map((c) =>
      c.statusNotes === 'Online · Verified by Shem'
        ? { ...c, statusNotes: 'Online · Verified by Vhon' }
        : c
    ),
    radioEntries: rawRadio.map((r) =>
      r.personnelOrUnit === 'Mac / Francis / Shem'
        ? { ...r, personnelOrUnit: 'Mac / Francis / Vhon' }
        : r
    ),
    wifiAuthorizedDevices: rawAuthDevices.map((d) =>
      d.employeeName === 'Shem Navarro' ? { ...d, employeeName: 'Vhon' } : d
    ),
    wifiVouchers: rawVouchers,
    helpdeskReports:
      Array.isArray(partial.helpdeskReports) && partial.helpdeskReports.length > 0
        ? partial.helpdeskReports
        : structuredClone(SEED_DATABASE.helpdeskReports),
    helpdeskTickets: Array.isArray(partial.helpdeskTickets)
      ? partial.helpdeskTickets
      : [],
    googleSheetLinks: Array.isArray(partial.googleSheetLinks)
      ? normalizeGoogleSheetLinks(partial.googleSheetLinks)
      : structuredClone(DEFAULT_GOOGLE_SHEET_LINKS),
    assetBundles: Array.isArray(partial.assetBundles)
      ? normalizeAssetBundles(partial.assetBundles)
      : structuredClone(DEFAULT_ASSET_BUNDLES),
  };
}

function normalizeAssetBundles(raw: AssetBundle[]): AssetBundle[] {
  return raw
    .filter((b) => b && typeof b.bundleCode === 'string')
    .map((b, idx) => ({
      id: b.id || `bnd-custom-${idx + 1}`,
      bundleCode: (b.bundleCode || `SET-${String(idx + 1).padStart(3, '0')}`).trim(),
      bundleName: (b.bundleName || 'Computer Set Bundle').trim(),
      assigneeName: (b.assigneeName || 'Unassigned').trim(),
      department: b.department ? String(b.department).trim() : '',
      branchLocation: (b.branchLocation || 'Main').trim(),
      issuedDate: b.issuedDate || '',
      registryAssets: Array.isArray(b.registryAssets) ? b.registryAssets : [],
      accessories: Array.isArray(b.accessories)
        ? b.accessories.map((acc, aIdx) => ({
            id: acc.id || `acc-${idx + 1}-${aIdx + 1}`,
            name: (acc.name || 'Accessory').trim(),
            category: acc.category || 'Other',
            quantity: Math.max(1, Number(acc.quantity) || 1),
            brandModel: acc.brandModel ? String(acc.brandModel).trim() : '',
            serialNumber: acc.serialNumber ? String(acc.serialNumber).trim() : '',
          }))
        : [],
      notes: b.notes ? String(b.notes).trim() : '',
      updatedAt: b.updatedAt || new Date().toISOString(),
    }));
}

const VALID_SHEET_MODULES = new Set<GoogleSheetTargetModule>([
  'helpdesk',
  'maintenance',
  'assets',
  'comms',
  'dashboard',
]);

function normalizeGoogleSheetLinks(raw: GoogleSheetLink[]): GoogleSheetLink[] {
  return raw
    .filter((item) => item && typeof item.url === 'string' && item.url.trim().length > 0)
    .map((item, idx) => {
      const trimmedUrl = item.url.trim();
      const safeUrl = /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;
      const target = VALID_SHEET_MODULES.has(item.moduleTarget)
        ? item.moduleTarget
        : 'dashboard';
      return {
        id: item.id || `gs-custom-${idx + 1}`,
        label: (item.label || '').trim() || 'Untitled Google Sheet',
        url: safeUrl,
        moduleTarget: target,
        description: item.description ? String(item.description).trim() : '',
        isDefault: Boolean(item.isDefault),
      };
    });
}

export const storageAdapter: CmmsStorageAdapter = new PcSqliteCmmsAdapter();

export function loadThemePreference(): 'light' | 'dark' {
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    // ignore storage errors
  }
  return 'light';
}

export function saveThemePreference(theme: 'light' | 'dark'): void {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore storage errors
  }
}
