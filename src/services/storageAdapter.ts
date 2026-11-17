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
import { getSupabaseClient } from './supabaseClient';

const STORAGE_KEY = 'opsmaint_cmms_db_v1';
const THEME_KEY = 'opsmaint_cmms_theme';
const REMOTE_ROW_ID = 1;

export interface CmmsStorageAdapter {
  readonly providerName: string;
  load(): Promise<CmmsDatabase>;
  save(db: CmmsDatabase): Promise<void>;
  reset(): Promise<CmmsDatabase>;
}

/** Shared CMMS snapshot stored in Supabase; localStorage is used only once to import legacy data. */
class SupabaseCmmsAdapter implements CmmsStorageAdapter {
  readonly providerName = 'supabase';

  async load(): Promise<CmmsDatabase> {
    const supabase = getSupabaseClient();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) {
      throw new Error('Sign in before loading the shared CMMS workspace.');
    }

    const { data, error } = await supabase
      .from('cmms_state')
      .select('payload')
      .eq('id', REMOTE_ROW_ID)
      .maybeSingle();
    if (error) throw error;
    if (data?.payload && typeof data.payload === 'object') {
      return normalizeDatabase(data.payload as Partial<CmmsDatabase>);
    }

    // Seed the shared row once. If this browser has the old local dataset, migrate it
    // with an insert-if-absent so another browser cannot overwrite the winning row.
    const initialData = this.readLegacyData() ?? structuredClone(SEED_DATABASE);
    const payload = { ...normalizeDatabase(initialData), updatedAt: new Date().toISOString() };
    const { error: insertError } = await supabase
      .from('cmms_state')
      .insert({ id: REMOTE_ROW_ID, payload, updated_by: sessionData.session.user.id });

    if (insertError && insertError.code !== '23505') throw insertError;
    if (!insertError) this.clearLegacyData();

    const { data: winner, error: reloadError } = await supabase
      .from('cmms_state')
      .select('payload')
      .eq('id', REMOTE_ROW_ID)
      .single();
    if (reloadError) throw reloadError;
    return normalizeDatabase(winner.payload as Partial<CmmsDatabase>);
  }

  async save(db: CmmsDatabase): Promise<void> {
    const supabase = getSupabaseClient();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) {
      throw new Error('Sign in before saving changes to the shared CMMS workspace.');
    }

    const payload: CmmsDatabase = {
      ...normalizeDatabase(db),
      version: 1,
      updatedAt: new Date().toISOString(),
    };
    const { error } = await supabase.from('cmms_state').upsert({
      id: REMOTE_ROW_ID,
      payload,
      updated_by: sessionData.session.user.id,
    });
    if (error) throw error;
    this.clearLegacyData();
  }

  async reset(): Promise<CmmsDatabase> {
    const fresh = structuredClone(SEED_DATABASE);
    await this.save(fresh);
    return fresh;
  }

  private readLegacyData(): Partial<CmmsDatabase> | null {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<CmmsDatabase>;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  private clearLegacyData(): void {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage cleanup is best-effort; shared data is already persisted remotely.
    }
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
    task.quarter === 'Q1' || task.quarter === 'Q2' || task.quarter === 'Q3' || task.quarter === 'Q4'
      ? task.quarter
      : 'Q4';
  const normalizedTech = (task.technician as string) === 'Shem' ? 'Vhon' : task.technician;

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

const DEMO_VOUCHER_IDS = new Set(['wv-001', 'wv-002', 'wv-003', 'wv-004', 'wv-005', 'wv-006']);

export function normalizeDatabase(partial: Partial<CmmsDatabase>): CmmsDatabase {
  const rawTasks = Array.isArray(partial.maintenanceTasks)
    ? partial.maintenanceTasks
    : structuredClone(SEED_DATABASE.maintenanceTasks);
  const rawCctv = Array.isArray(partial.cctvEntries) ? partial.cctvEntries : structuredClone(SEED_DATABASE.cctvEntries);
  const rawRadio = Array.isArray(partial.radioEntries) ? partial.radioEntries : structuredClone(SEED_DATABASE.radioEntries);
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
    spareParts: Array.isArray(partial.spareParts) ? partial.spareParts : structuredClone(SEED_DATABASE.spareParts),
    disposalItems: Array.isArray(partial.disposalItems) ? partial.disposalItems : structuredClone(SEED_DATABASE.disposalItems),
    anydeskEntries: Array.isArray(partial.anydeskEntries) ? partial.anydeskEntries : structuredClone(SEED_DATABASE.anydeskEntries),
    cctvEntries: rawCctv.map((c) => c.statusNotes === 'Online · Verified by Shem' ? { ...c, statusNotes: 'Online · Verified by Vhon' } : c),
    radioEntries: rawRadio.map((r) => r.personnelOrUnit === 'Mac / Francis / Shem' ? { ...r, personnelOrUnit: 'Mac / Francis / Vhon' } : r),
    wifiAuthorizedDevices: rawAuthDevices.map((d) => d.employeeName === 'Shem Navarro' ? { ...d, employeeName: 'Vhon' } : d),
    wifiVouchers: rawVouchers,
    helpdeskReports: Array.isArray(partial.helpdeskReports) && partial.helpdeskReports.length > 0
      ? partial.helpdeskReports
      : structuredClone(SEED_DATABASE.helpdeskReports),
    helpdeskTickets: Array.isArray(partial.helpdeskTickets) ? partial.helpdeskTickets : [],
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

const VALID_SHEET_MODULES = new Set<GoogleSheetTargetModule>(['helpdesk', 'maintenance', 'assets', 'comms', 'dashboard']);

function normalizeGoogleSheetLinks(raw: GoogleSheetLink[]): GoogleSheetLink[] {
  return raw
    .filter((item) => item && typeof item.url === 'string' && item.url.trim().length > 0)
    .map((item, idx) => {
      const trimmedUrl = item.url.trim();
      const safeUrl = /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;
      const target = VALID_SHEET_MODULES.has(item.moduleTarget) ? item.moduleTarget : 'dashboard';
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

export const storageAdapter: CmmsStorageAdapter = new SupabaseCmmsAdapter();

export function loadThemePreference(): 'light' | 'dark' {
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
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
