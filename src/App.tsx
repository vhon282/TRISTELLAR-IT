import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Server,
  ClipboardCheck,
  PackageSearch,
  RadioTower,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sun,
  Moon,
  DatabaseBackup,
  Menu,
  X,
  ArrowRight,
} from 'lucide-react';
import {
  ActiveModule,
  AnyDeskEntry,
  Asset,
  CctvEntry,
  CmmsDatabase,
  DisposalKeepItem,
  GlobalSearchResult,
  MaintenanceTask,
  RadioEntry,
  SparePartRequest,
  WifiAuthorizedDevice,
  WifiVoucher,
} from './types/cmms';
import { SEED_DATABASE } from './data/seedData';
import {
  loadThemePreference,
  saveThemePreference,
  storageAdapter,
} from './services/storageAdapter';
import { ExecutiveDashboard } from './components/modules/ExecutiveDashboard';
import { AssetRegistryModule } from './components/modules/AssetRegistryModule';
import { PreventiveMaintenanceModule } from './components/modules/PreventiveMaintenanceModule';
import { PartsDisposalModule } from './components/modules/PartsDisposalModule';
import {
  CommsDirectoryModule,
  CommsSubTab,
} from './components/modules/CommsDirectoryModule';
import { BackupRestoreModal } from './components/modals/BackupRestoreModal';

interface NavItem {
  id: ActiveModule;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="w-4 h-4 shrink-0" />,
  },
  {
    id: 'assets',
    label: 'Asset Registry',
    icon: <Server className="w-4 h-4 shrink-0" />,
  },
  {
    id: 'maintenance',
    label: 'Preventive Maint.',
    icon: <ClipboardCheck className="w-4 h-4 shrink-0" />,
  },
  {
    id: 'parts',
    label: 'Parts & Disposal',
    icon: <PackageSearch className="w-4 h-4 shrink-0" />,
  },
  {
    id: 'comms',
    label: 'IT Comms Hub',
    icon: <RadioTower className="w-4 h-4 shrink-0" />,
  },
];

export default function App() {
  const [db, setDb] = useState<CmmsDatabase>(() => structuredClone(SEED_DATABASE));
  const [isLoaded, setIsLoaded] = useState(false);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => loadThemePreference());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [activeModule, setActiveModule] = useState<ActiveModule>('dashboard');
  const [commsSubTab, setCommsSubTab] = useState<CommsSubTab>('anydesk');
  const [assetBranchJump, setAssetBranchJump] = useState<string>('ALL');
  const [pmSearchJump, setPmSearchJump] = useState<string>('');

  const [globalQuery, setGlobalQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement | null>(null);

  const [backupModalOpen, setBackupModalOpen] = useState(false);

  // Load persisted data on mount
  useEffect(() => {
    storageAdapter.load().then((loaded) => {
      setDb(loaded);
      setIsLoaded(true);
    });
  }, []);

  // Sync theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    saveThemePreference(theme);
  }, [theme]);

  // Close global search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchWrapperRef.current &&
        !searchWrapperRef.current.contains(e.target as Node)
      ) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateDb = (updater: (prev: CmmsDatabase) => CmmsDatabase) => {
    setDb((prev) => {
      const next = updater(prev);
      storageAdapter.save(next).catch(() => undefined);
      return next;
    });
  };

  // Global live search across all modules
  const globalResults = useMemo<GlobalSearchResult[]>(() => {
    const q = globalQuery.trim().toLowerCase();
    if (!q) return [];
    const results: GlobalSearchResult[] = [];

    for (const a of db.assets) {
      if (
        a.equipmentName.toLowerCase().includes(q) ||
        a.assetCode.toLowerCase().includes(q) ||
        a.serialNumber.toLowerCase().includes(q) ||
        a.assignedTo.toLowerCase().includes(q) ||
        a.branchLocation.toLowerCase().includes(q)
      ) {
        results.push({
          id: a.id,
          module: 'assets',
          title: a.equipmentName,
          subtitle: `Asset · ${a.branchLocation} · ${a.assignedTo || 'Unassigned'}`,
          code: a.assetCode,
        });
      }
    }

    for (const ad of db.anydeskEntries) {
      if (
        ad.anydeskId.toLowerCase().includes(q) ||
        ad.serverOrPcName.toLowerCase().includes(q) ||
        ad.branchDescription.toLowerCase().includes(q)
      ) {
        results.push({
          id: ad.id,
          module: 'comms',
          subTab: 'anydesk',
          title: ad.serverOrPcName,
          subtitle: `AnyDesk · ${ad.branchDescription}`,
          code: ad.anydeskId,
        });
      }
    }

    for (const cam of db.cctvEntries) {
      if (
        cam.cameraNo.toLowerCase().includes(q) ||
        cam.ipAddress.toLowerCase().includes(q) ||
        cam.locationArea.toLowerCase().includes(q) ||
        cam.branch.toLowerCase().includes(q)
      ) {
        results.push({
          id: cam.id,
          module: 'comms',
          subTab: 'cctv',
          title: `CCTV ${cam.cameraNo} (${cam.branch})`,
          subtitle: cam.locationArea,
          code: cam.ipAddress,
        });
      }
    }

    for (const rad of db.radioEntries) {
      if (
        rad.callsign.toLowerCase().includes(q) ||
        rad.departmentRole.toLowerCase().includes(q) ||
        rad.personnelOrUnit.toLowerCase().includes(q)
      ) {
        results.push({
          id: rad.id,
          module: 'comms',
          subTab: 'radio',
          title: `${rad.callsign} — ${rad.departmentRole}`,
          subtitle: rad.personnelOrUnit,
          code: rad.channelNo,
        });
      }
    }

    for (const v of db.wifiVouchers) {
      if (
        v.voucherCode.toLowerCase().includes(q) ||
        v.employeeName.toLowerCase().includes(q) ||
        v.employeeNumber.toLowerCase().includes(q)
      ) {
        results.push({
          id: v.id,
          module: 'comms',
          subTab: 'wifi',
          title: v.employeeName
            ? `Voucher ${v.voucherCode} (${v.employeeName})`
            : `Available Voucher ${v.voucherCode}`,
          subtitle: `${v.deviceType} · ${v.status}`,
          code: v.employeeNumber || v.status,
        });
      }
    }

    for (const p of db.spareParts) {
      if (p.item.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)) {
        results.push({
          id: p.id,
          module: 'parts',
          title: p.item,
          subtitle: `Spare Part · Stock Left: ${p.stockLeft}`,
          code: p.type,
        });
      }
    }

    return results.slice(0, 10);
  }, [globalQuery, db]);

  const handleNavigate = (module: ActiveModule, subTab?: string) => {
    setActiveModule(module);
    if (module === 'comms' && subTab) {
      setCommsSubTab(subTab as CommsSubTab);
    }
    setMobileMenuOpen(false);
  };

  // Upsert helpers
  const upsertById = <T extends { id: string }>(list: T[], item: T): T[] => {
    const exists = list.some((x) => x.id === item.id);
    return exists ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list];
  };

  const handleSaveAsset = (asset: Asset) => {
    updateDb((prev) => ({
      ...prev,
      assets: upsertById(prev.assets, asset),
    }));
  };

  const handleDeleteAsset = (assetId: string) => {
    updateDb((prev) => ({
      ...prev,
      assets: prev.assets.filter((a) => a.id !== assetId),
    }));
  };

  const handleBulkImportAssetsAndPm = (
    newAssets: Asset[],
    newTasks: MaintenanceTask[]
  ) => {
    updateDb((prev) => {
      let nextAssets = [...prev.assets];
      for (const item of newAssets) {
        nextAssets = upsertById(nextAssets, item);
      }
      const nextTasks =
        newTasks.length > 0
          ? [...newTasks, ...prev.maintenanceTasks]
          : prev.maintenanceTasks;
      return {
        ...prev,
        assets: nextAssets,
        maintenanceTasks: nextTasks,
      };
    });
  };

  const handleSaveMaintenanceTask = (
    task: MaintenanceTask,
    updateParentAsset: boolean
  ) => {
    updateDb((prev) => {
      const nextTasks = upsertById(prev.maintenanceTasks, task);
      let nextAssets = prev.assets;

      if (updateParentAsset) {
        nextAssets = prev.assets.map((asset) => {
          const matches =
            asset.id === task.assetId ||
            (task.assetCode &&
              asset.assetCode.toLowerCase() === task.assetCode.toLowerCase());
          if (!matches) return asset;
          return {
            ...asset,
            condition: task.resultCondition,
            operationalStatus: task.setAssetStatusTo,
            lastMaintenanceDate:
              task.status === 'Done'
                ? task.actualDate || new Date().toISOString().slice(0, 10)
                : asset.lastMaintenanceDate,
          };
        });
      }

      return {
        ...prev,
        maintenanceTasks: nextTasks,
        assets: nextAssets,
      };
    });
  };

  return (
    <div className="min-h-screen flex bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-stone-950/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Collapsible Navigation Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 flex flex-col transition-all duration-200 shrink-0 ${
          sidebarCollapsed ? 'lg:w-[68px]' : 'lg:w-[248px]'
        } ${
          mobileMenuOpen
            ? 'translate-x-0 w-[248px]'
            : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Sidebar Brand */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-stone-200 dark:border-stone-800">
          <button
            type="button"
            onClick={() => handleNavigate('dashboard')}
            className="flex items-center gap-2.5 min-w-0 text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center font-display font-bold text-xs tracking-tight shrink-0">
              TS
            </div>
            {!sidebarCollapsed && (
              <span className="font-display font-bold text-[13px] tracking-tight text-stone-900 dark:text-stone-100 whitespace-nowrap truncate">
                TRISTELLAR IT DEPT.
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation menu"
            className="lg:hidden p-1.5 rounded-md text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Primary Navigation">
          {NAV_ITEMS.map((item) => {
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/70 dark:hover:bg-stone-800/60'
                } ${sidebarCollapsed ? 'lg:justify-center lg:px-0' : ''}`}
              >
                {item.icon}
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Collapse Sidebar Toggle (Desktop) */}
        <div className="hidden lg:block p-3 border-t border-stone-200 dark:border-stone-800">
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4" />
                <span>Collapse Sidebar</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-14 bg-white/95 dark:bg-stone-900/95 backdrop-blur border-b border-stone-200 dark:border-stone-800 px-4 lg:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-lg text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 shrink-0"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Global Search Bar */}
            <div ref={searchWrapperRef} className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={globalQuery}
                onFocus={() => setSearchFocused(true)}
                onChange={(e) => {
                  setGlobalQuery(e.target.value);
                  setSearchFocused(true);
                }}
                placeholder="Global search: asset code, AnyDesk ID, CCTV IP, callsign, voucher..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />

              {searchFocused && globalQuery.trim().length > 0 && (
                <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl shadow-lg overflow-hidden z-50">
                  {globalResults.length === 0 ? (
                    <div className="p-4 text-xs text-stone-500 dark:text-stone-400 text-center">
                      No matching records across modules.
                    </div>
                  ) : (
                    <div className="divide-y divide-stone-100 dark:divide-stone-800 max-h-80 overflow-y-auto">
                      {globalResults.map((res) => (
                        <button
                          key={`${res.module}-${res.id}`}
                          type="button"
                          onClick={() => {
                            handleNavigate(res.module, res.subTab);
                            setSearchFocused(false);
                            setGlobalQuery('');
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-stone-50 dark:hover:bg-stone-800/60 flex items-center justify-between gap-3 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">
                              {res.title}
                            </p>
                            <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                              {res.subtitle}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {res.code && (
                              <span className="font-mono text-[11px] font-medium text-orange-600 dark:text-orange-400">
                                {res.code}
                              </span>
                            )}
                            <ArrowRight className="w-3.5 h-3.5 text-stone-400" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Top Bar Right Controls: Backup/Restore JSON + Theme Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setBackupModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
            >
              <DatabaseBackup className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Backup / Restore JSON</span>
              <span className="sm:hidden">Backup</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              className="p-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors shrink-0"
            >
              {theme === 'light' ? (
                <Moon className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
            </button>
          </div>
        </header>

        {/* Active Module Content */}
        <main className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto">
          {!isLoaded ? (
            <div className="space-y-4">
              <div className="h-8 w-64 rounded-lg bg-stone-200 dark:bg-stone-800 animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-24 rounded-xl bg-stone-200 dark:bg-stone-800 animate-pulse"
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              {activeModule === 'dashboard' && (
                <ExecutiveDashboard
                  db={db}
                  onNavigate={handleNavigate}
                  onFilterAssetsByBranch={(branch) => {
                    setAssetBranchJump(branch);
                    setActiveModule('assets');
                  }}
                />
              )}

              {activeModule === 'assets' && (
                <AssetRegistryModule
                  assets={db.assets}
                  maintenanceTasks={db.maintenanceTasks}
                  initialBranchFilter={assetBranchJump}
                  onSaveAsset={handleSaveAsset}
                  onDeleteAsset={handleDeleteAsset}
                  onBulkImportAssetsAndPm={handleBulkImportAssetsAndPm}
                  onOpenMaintenanceForAsset={(code) => {
                    setPmSearchJump(code);
                    setActiveModule('maintenance');
                  }}
                />
              )}

              {activeModule === 'maintenance' && (
                <PreventiveMaintenanceModule
                  tasks={db.maintenanceTasks}
                  assets={db.assets}
                  initialSearch={pmSearchJump}
                  onSaveTask={handleSaveMaintenanceTask}
                  onDeleteTask={(id) =>
                    updateDb((prev) => ({
                      ...prev,
                      maintenanceTasks: prev.maintenanceTasks.filter((t) => t.id !== id),
                    }))
                  }
                  onBulkImportTasks={(imported) =>
                    updateDb((prev) => ({
                      ...prev,
                      maintenanceTasks: [...imported, ...prev.maintenanceTasks],
                    }))
                  }
                />
              )}

              {activeModule === 'parts' && (
                <PartsDisposalModule
                  spareParts={db.spareParts}
                  disposalItems={db.disposalItems}
                  onSaveSparePart={(item: SparePartRequest) =>
                    updateDb((prev) => ({
                      ...prev,
                      spareParts: upsertById(prev.spareParts, item),
                    }))
                  }
                  onDeleteSparePart={(id) =>
                    updateDb((prev) => ({
                      ...prev,
                      spareParts: prev.spareParts.filter((p) => p.id !== id),
                    }))
                  }
                  onBulkImportSpareParts={(items) =>
                    updateDb((prev) => ({
                      ...prev,
                      spareParts: [...items, ...prev.spareParts],
                    }))
                  }
                  onSaveDisposalItem={(item: DisposalKeepItem) =>
                    updateDb((prev) => ({
                      ...prev,
                      disposalItems: upsertById(prev.disposalItems, item),
                    }))
                  }
                  onDeleteDisposalItem={(id) =>
                    updateDb((prev) => ({
                      ...prev,
                      disposalItems: prev.disposalItems.filter((d) => d.id !== id),
                    }))
                  }
                  onBulkImportDisposalItems={(items) =>
                    updateDb((prev) => ({
                      ...prev,
                      disposalItems: [...items, ...prev.disposalItems],
                    }))
                  }
                />
              )}

              {activeModule === 'comms' && (
                <CommsDirectoryModule
                  initialSubTab={commsSubTab}
                  anydeskEntries={db.anydeskEntries}
                  cctvEntries={db.cctvEntries}
                  radioEntries={db.radioEntries}
                  wifiAuthorizedDevices={db.wifiAuthorizedDevices}
                  wifiVouchers={db.wifiVouchers}
                  onSaveAnydesk={(entry: AnyDeskEntry) =>
                    updateDb((prev) => ({
                      ...prev,
                      anydeskEntries: upsertById(prev.anydeskEntries, entry),
                    }))
                  }
                  onDeleteAnydesk={(id) =>
                    updateDb((prev) => ({
                      ...prev,
                      anydeskEntries: prev.anydeskEntries.filter((x) => x.id !== id),
                    }))
                  }
                  onBulkImportAnydesk={(items) =>
                    updateDb((prev) => ({
                      ...prev,
                      anydeskEntries: [...items, ...prev.anydeskEntries],
                    }))
                  }
                  onSaveCctv={(entry: CctvEntry) =>
                    updateDb((prev) => ({
                      ...prev,
                      cctvEntries: upsertById(prev.cctvEntries, entry),
                    }))
                  }
                  onDeleteCctv={(id) =>
                    updateDb((prev) => ({
                      ...prev,
                      cctvEntries: prev.cctvEntries.filter((x) => x.id !== id),
                    }))
                  }
                  onBulkImportCctv={(items) =>
                    updateDb((prev) => ({
                      ...prev,
                      cctvEntries: [...items, ...prev.cctvEntries],
                    }))
                  }
                  onSaveRadio={(entry: RadioEntry) =>
                    updateDb((prev) => ({
                      ...prev,
                      radioEntries: upsertById(prev.radioEntries, entry),
                    }))
                  }
                  onDeleteRadio={(id) =>
                    updateDb((prev) => ({
                      ...prev,
                      radioEntries: prev.radioEntries.filter((x) => x.id !== id),
                    }))
                  }
                  onBulkImportRadio={(items) =>
                    updateDb((prev) => ({
                      ...prev,
                      radioEntries: [...items, ...prev.radioEntries],
                    }))
                  }
                  onSaveAuthorizedDevice={(entry: WifiAuthorizedDevice) =>
                    updateDb((prev) => ({
                      ...prev,
                      wifiAuthorizedDevices: upsertById(prev.wifiAuthorizedDevices, entry),
                    }))
                  }
                  onDeleteAuthorizedDevice={(id) =>
                    updateDb((prev) => ({
                      ...prev,
                      wifiAuthorizedDevices: prev.wifiAuthorizedDevices.filter(
                        (x) => x.id !== id
                      ),
                    }))
                  }
                  onBulkImportAuthorizedDevices={(items) =>
                    updateDb((prev) => ({
                      ...prev,
                      wifiAuthorizedDevices: [...items, ...prev.wifiAuthorizedDevices],
                    }))
                  }
                  onSaveVoucher={(entry: WifiVoucher) =>
                    updateDb((prev) => ({
                      ...prev,
                      wifiVouchers: upsertById(prev.wifiVouchers, entry),
                    }))
                  }
                  onDeleteVoucher={(id) =>
                    updateDb((prev) => ({
                      ...prev,
                      wifiVouchers: prev.wifiVouchers.filter((x) => x.id !== id),
                    }))
                  }
                  onBulkImportVouchers={(items) =>
                    updateDb((prev) => ({
                      ...prev,
                      wifiVouchers: [...items, ...prev.wifiVouchers],
                    }))
                  }
                />
              )}
            </>
          )}
        </main>
      </div>

      <BackupRestoreModal
        isOpen={backupModalOpen}
        onClose={() => setBackupModalOpen(false)}
        db={db}
        onRestore={(restoredDb) => {
          setDb(restoredDb);
          storageAdapter.save(restoredDb).catch(() => undefined);
        }}
        onResetSeed={() => {
          storageAdapter.reset().then((fresh) => setDb(fresh));
        }}
      />
    </div>
  );
}
