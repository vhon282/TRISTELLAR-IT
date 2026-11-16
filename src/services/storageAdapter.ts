import { CmmsDatabase, MaintenanceTask } from '../types/cmms';
import { DEFAULT_CHECKLIST, SEED_DATABASE } from '../data/seedData';

const STORAGE_KEY = 'opsmaint_cmms_db_v1';
const THEME_KEY = 'opsmaint_cmms_theme';

/**
 * Clean async-ready storage adapter interface.
 * Implement this interface with Firebase Firestore or Google Sheets API
 * in the next integration phase without changing UI components.
 */
export interface CmmsStorageAdapter {
  readonly providerName: string;
  load(): Promise<CmmsDatabase>;
  save(db: CmmsDatabase): Promise<void>;
  reset(): Promise<CmmsDatabase>;
}

class LocalStorageCmmsAdapter implements CmmsStorageAdapter {
  readonly providerName = 'localStorage';

  async load(): Promise<CmmsDatabase> {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        await this.save(SEED_DATABASE);
        return structuredClone(SEED_DATABASE);
      }
      const parsed = JSON.parse(raw) as Partial<CmmsDatabase>;
      return normalizeDatabase(parsed);
    } catch {
      return structuredClone(SEED_DATABASE);
    }
  }

  async save(db: CmmsDatabase): Promise<void> {
    const payload: CmmsDatabase = {
      ...db,
      version: 1,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
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

  return {
    ...task,
    year: parsedYear,
    quarter: validQuarter,
    seqNumber: task.seqNumber || `${parsedYear}4TH-${String(idx + 1).padStart(2, '0')}`,
    formCode: task.formCode || 'INF-SUP-PRMC-2025 / SUP-PRMC-2022-00',
    checklistItems,
  };
}

export function normalizeDatabase(partial: Partial<CmmsDatabase>): CmmsDatabase {
  const rawTasks = Array.isArray(partial.maintenanceTasks)
    ? partial.maintenanceTasks
    : structuredClone(SEED_DATABASE.maintenanceTasks);

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
    cctvEntries: Array.isArray(partial.cctvEntries)
      ? partial.cctvEntries
      : structuredClone(SEED_DATABASE.cctvEntries),
    radioEntries: Array.isArray(partial.radioEntries)
      ? partial.radioEntries
      : structuredClone(SEED_DATABASE.radioEntries),
    wifiAuthorizedDevices: Array.isArray(partial.wifiAuthorizedDevices)
      ? partial.wifiAuthorizedDevices
      : structuredClone(SEED_DATABASE.wifiAuthorizedDevices),
    wifiVouchers: Array.isArray(partial.wifiVouchers)
      ? partial.wifiVouchers
      : structuredClone(SEED_DATABASE.wifiVouchers),
  };
}

export const storageAdapter: CmmsStorageAdapter = new LocalStorageCmmsAdapter();

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
