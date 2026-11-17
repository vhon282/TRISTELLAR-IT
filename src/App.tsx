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
  MessageSquareText,
  LogOut,
  Headset,
} from 'lucide-react';
import {
  ActiveModule,
  AnyDeskEntry,
  Asset,
  AssetBundle,
  CctvEntry,
  CmmsDatabase,
  DisposalKeepItem,
  GlobalSearchResult,
  GoogleSheetLink,
  GoogleSheetTargetModule,
  ItNote,
  MaintenanceResetPayload,
  MaintenanceTask,
  OnlinePresenceUser,
  RadioEntry,
  SparePartRequest,
  TeamChatMessage,
  WifiAuthorizedDevice,
  WifiVoucher,
} from './types/cmms';
import {
  DEFAULT_CHECKLIST,
  DEFAULT_GOOGLE_SHEET_LINKS,
  SEED_DATABASE,
} from './data/seedData';
import { generateUid } from './utils/csv';
import { fetchSeedHelpdeskTickets } from './utils/helpdeskTickets';
import { decodeBundleFromQueryParam } from './utils/assetBundles';
import {
  loadThemePreference,
  saveThemePreference,
  storageAdapter,
} from './services/storageAdapter';
import {
  getOrCreateClientId,
  loadSavedOperator,
  mergeChatMessage,
  mergeItNote,
  saveOperatorPreference,
  teamSocket,
} from './services/teamSocket';
import { ExecutiveDashboard } from './components/modules/ExecutiveDashboard';
import { AssetRegistryModule } from './components/modules/AssetRegistryModule';
import { PreventiveMaintenanceModule } from './components/modules/PreventiveMaintenanceModule';
import { PartsDisposalModule } from './components/modules/PartsDisposalModule';
import {
  CommsDirectoryModule,
  CommsSubTab,
} from './components/modules/CommsDirectoryModule';
import { TeamNotesModule } from './components/modules/TeamNotesModule';
import { HelpdeskReportModule } from './components/modules/HelpdeskReportModule';
import { BackupRestoreModal } from './components/modals/BackupRestoreModal';
import { GoogleSheetLinkModal } from './components/modals/GoogleSheetLinkModal';
import { ScannedBundlePage } from './components/bundles/ScannedBundlePage';
import { LoginScreen } from './components/auth/LoginScreen';
import {
  AuthUser,
  clearAuthSession,
  loadAuthSession,
  saveAuthSession,
} from './services/auth';

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
  {
    id: 'helpdesk',
    label: 'Helpdesk Report',
    icon: <Headset className="w-4 h-4 shrink-0" />,
  },
  {
    id: 'team',
    label: 'Team Chat & Notes',
    icon: <MessageSquareText className="w-4 h-4 shrink-0" />,
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
  const [assetViewMode, setAssetViewMode] = useState<
    'inventory' | 'schedule' | 'bundles'
  >('inventory');
  const [assetBranchJump, setAssetBranchJump] = useState<string>('ALL');
  const [pmSearchJump, setPmSearchJump] = useState<string>('');

  const [globalQuery, setGlobalQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement | null>(null);

  const [authUser, setAuthUser] = useState<AuthUser | null>(() => loadAuthSession());
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [sheetModalOpen, setSheetModalOpen] = useState(false);
  const [editingSheetLink, setEditingSheetLink] = useState<GoogleSheetLink | null>(null);
  const [sheetDefaultTarget, setSheetDefaultTarget] =
    useState<GoogleSheetTargetModule>('dashboard');

  const [scannedRoute, setScannedRoute] = useState<{
    active: boolean;
    bundle: AssetBundle | null;
    error?: string;
  }>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const rawBundle = params.get('bundle');
      if (rawBundle !== null) {
        const decoded = decodeBundleFromQueryParam(rawBundle);
        return { active: true, bundle: decoded.bundle, error: decoded.error };
      }
    } catch {
      // ignore URL parsing errors
    }
    return { active: false, bundle: null };
  });
  const [previewBundle, setPreviewBundle] = useState<AssetBundle | null>(null);

  // Real-time Team Chat & IT Notes state (server-authoritative via WebSocket)
  const [teamMessages, setTeamMessages] = useState<TeamChatMessage[]>([]);
  const [itNotes, setItNotes] = useState<ItNote[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlinePresenceUser[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [operatorName, setOperatorName] = useState<string>(
    () => loadAuthSession()?.displayName || loadSavedOperator()
  );
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const clientIdRef = useRef<string>(getOrCreateClientId());
  const activeModuleRef = useRef<ActiveModule>(activeModule);
  const operatorNameRef = useRef<string>(operatorName);

  useEffect(() => {
    if (authUser) {
      setOperatorName(authUser.displayName);
    }
  }, [authUser]);

  useEffect(() => {
    activeModuleRef.current = activeModule;
    if (activeModule === 'team') {
      setUnreadChatCount(0);
    }
  }, [activeModule]);

  useEffect(() => {
    operatorNameRef.current = operatorName;
    saveOperatorPreference(operatorName);
    if (authUser) {
      teamSocket.announcePresence({
        clientId: clientIdRef.current,
        userName: operatorName,
        role: authUser.role || 'TRISTELLAR IT',
      });
    }
  }, [operatorName, authUser]);

  const [reloadingHelpdeskLog, setReloadingHelpdeskLog] = useState(false);

  const HELPDESK_SEED_KEY = 'tristellar_helpdesk_tickets_seeded_v2';

  const handleReloadInitialHelpdeskLog = async () => {
    setReloadingHelpdeskLog(true);
    try {
      const seededTickets = await fetchSeedHelpdeskTickets();
      if (seededTickets.length > 0) {
        const seed2026Report = SEED_DATABASE.helpdeskReports.find((r) => r.year === 2026);
        updateDb((prev) => ({
          ...prev,
          helpdeskTickets: seededTickets,
          helpdeskReports: seed2026Report
            ? prev.helpdeskReports.map((r) => (r.year === 2026 ? seed2026Report : r))
            : prev.helpdeskReports,
        }));
        try {
          window.localStorage.setItem(HELPDESK_SEED_KEY, '1');
        } catch {
          // ignore storage errors
        }
      }
    } catch {
      // ignore fetch errors if offline
    } finally {
      setReloadingHelpdeskLog(false);
    }
  };

  // Load persisted CMMS data once on mount and hydrate 2026 Helpdesk Ticket Log if needed
  useEffect(() => {
    storageAdapter.load().then(async (loaded) => {
      setDb(loaded);
      setIsLoaded(true);

      let alreadySeededV2 = false;
      try {
        alreadySeededV2 = window.localStorage.getItem(HELPDESK_SEED_KEY) === '1';
      } catch {
        alreadySeededV2 = false;
      }

      const existingCount = loaded.helpdeskTickets?.length ?? 0;
      if (!alreadySeededV2 && (existingCount === 0 || existingCount <= 374)) {
        try {
          const seededTickets = await fetchSeedHelpdeskTickets();
          if (seededTickets.length > 0) {
            const seed2026Report = SEED_DATABASE.helpdeskReports.find(
              (r) => r.year === 2026
            );
            setDb((prev) => {
              const next: CmmsDatabase = {
                ...prev,
                helpdeskTickets: seededTickets,
                helpdeskReports: seed2026Report
                  ? prev.helpdeskReports.map((r) =>
                      r.year === 2026 ? seed2026Report : r
                    )
                  : prev.helpdeskReports,
              };
              storageAdapter.save(next).catch(() => undefined);
              return next;
            });
            try {
              window.localStorage.setItem(HELPDESK_SEED_KEY, '1');
            } catch {
              // ignore
            }
          }
        } catch {
          // ignore if asset unavailable
        }
      }
    });
  }, []);

  // Initial Team Chat/Notes REST hydration + WebSocket subscription when signed in
  useEffect(() => {
    if (!authUser) {
      teamSocket.disconnect();
      return;
    }

    fetch('https://instructor-concord-mai-drug.trycloudflare.com/api/team/state')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        if (Array.isArray(data.messages)) setTeamMessages(data.messages);
        if (Array.isArray(data.notes)) setItNotes(data.notes);
        if (Array.isArray(data.onlineUsers)) setOnlineUsers(data.onlineUsers);
      })
      .catch(() => undefined);

    const unsubStatus = teamSocket.onStatus((connected) => {
      setWsConnected(connected);
    });

    const unsubEvents = teamSocket.onEvent((event) => {
      if (event.type === 'team:init') {
        setTeamMessages(event.messages);
        setItNotes(event.notes);
        setOnlineUsers(event.onlineUsers);
      } else if (event.type === 'presence:update') {
        setOnlineUsers(event.onlineUsers);
      } else if (event.type === 'chat:created') {
        setTeamMessages((prev) => mergeChatMessage(prev, event.message));
        if (
          activeModuleRef.current !== 'team' &&
          event.message.sender.toLowerCase() !==
            operatorNameRef.current.trim().toLowerCase()
        ) {
          setUnreadChatCount((c) => c + 1);
        }
      } else if (event.type === 'chat:deleted') {
        setTeamMessages((prev) => prev.filter((m) => m.id !== event.id));
      } else if (event.type === 'note:upserted') {
        setItNotes((prev) => mergeItNote(prev, event.note));
      } else if (event.type === 'note:deleted') {
        setItNotes((prev) => prev.filter((n) => n.id !== event.id));
      }
    });

    teamSocket.connect({
      clientId: clientIdRef.current,
      userName: authUser.displayName,
      role: authUser.role || 'TRISTELLAR IT',
    });

    return () => {
      unsubStatus();
      unsubEvents();
      teamSocket.disconnect();
    };
  }, [authUser]);

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

    for (const note of itNotes) {
      if (
        note.title.toLowerCase().includes(q) ||
        note.content.toLowerCase().includes(q) ||
        note.branchLocation.toLowerCase().includes(q) ||
        (note.assetCode && note.assetCode.toLowerCase().includes(q))
      ) {
        results.push({
          id: note.id,
          module: 'team',
          title: note.title,
          subtitle: `IT Note · ${note.category} · ${note.branchLocation}`,
          code: note.assetCode || note.author,
        });
      }
    }

    for (const rep of db.helpdeskReports || []) {
      const yearTotal = rep.months.reduce(
        (sum, m) => sum + m.doneResolved + m.pending + m.onGoing,
        0
      );
      const matchedPersonnel = rep.personnels.find((p) =>
        p.name.toLowerCase().includes(q)
      );
      if (
        String(rep.year).includes(q) ||
        'helpdesk'.includes(q) ||
        matchedPersonnel
      ) {
        results.push({
          id: `hd-${rep.year}`,
          module: 'helpdesk',
          title: `${rep.year} IT Helpdesk Report`,
          subtitle: matchedPersonnel
            ? `${matchedPersonnel.name}: ${matchedPersonnel.count} tickets · Annual Total: ${yearTotal}`
            : `Annual Tickets: ${yearTotal} · Personnels: ${rep.personnels.length}`,
          code: String(rep.year),
        });
      }
    }

    for (const sheet of db.googleSheetLinks || []) {
      if (
        sheet.label.toLowerCase().includes(q) ||
        (sheet.description || '').toLowerCase().includes(q) ||
        'google sheet'.includes(q) ||
        'spreadsheet'.includes(q)
      ) {
        results.push({
          id: sheet.id,
          module: sheet.moduleTarget,
          title: sheet.label,
          subtitle: `Google Sheet · ${sheet.description || 'Live spreadsheet source'}`,
          code: 'SHEET',
        });
      }
    }

    for (const bundle of db.assetBundles || []) {
      const itemsText = [
        ...bundle.registryAssets.map((r) => `${r.assetCode} ${r.equipmentName}`),
        ...bundle.accessories.map((a) => a.name),
      ].join(' ');
      if (
        bundle.bundleCode.toLowerCase().includes(q) ||
        bundle.bundleName.toLowerCase().includes(q) ||
        bundle.assigneeName.toLowerCase().includes(q) ||
        bundle.branchLocation.toLowerCase().includes(q) ||
        itemsText.toLowerCase().includes(q)
      ) {
        results.push({
          id: bundle.id,
          module: 'assets',
          subTab: 'bundles',
          title: `${bundle.bundleCode} — ${bundle.assigneeName}`,
          subtitle: `Computer Set · ${bundle.branchLocation} · ${bundle.bundleName}`,
          code: bundle.bundleCode,
        });
      }
    }

    for (const t of db.helpdeskTickets || []) {
      if (
        String(t.ticketNo) === q ||
        t.description.toLowerCase().includes(q) ||
        t.solution.toLowerCase().includes(q) ||
        t.notedBy.toLowerCase().includes(q) ||
        t.attendedBy.toLowerCase().includes(q) ||
        t.branchLocation.toLowerCase().includes(q)
      ) {
        results.push({
          id: t.id,
          module: 'helpdesk',
          title: `Ticket #${t.ticketNo}: ${t.description}`,
          subtitle: `${t.branchLocation} · ${t.notedBy || 'Staff'} → ${t.attendedBy || 'IT'}`,
          code: t.date,
        });
      }
    }

    return results.slice(0, 10);
  }, [globalQuery, db, itNotes]);

  const handleNavigate = (module: ActiveModule, subTab?: string) => {
    setActiveModule(module);
    if (module === 'comms' && subTab) {
      setCommsSubTab(subTab as CommsSubTab);
    }
    if (module === 'assets' && subTab) {
      setAssetViewMode(subTab as 'inventory' | 'schedule' | 'bundles');
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

  const handleResetMaintenance = (payload: MaintenanceResetPayload) => {
    const getTaskYear = (t: MaintenanceTask): number =>
      (Number.isFinite(Number(t.year)) && Number(t.year) > 1990 ? Number(t.year) : 0) ||
      Number((t.scheduledDate || '').slice(0, 4)) ||
      Number((t.actualDate || '').slice(0, 4)) ||
      Number((t.seqNumber || '').slice(0, 4)) ||
      2026;

    const shiftYearInDate = (dateStr: string, targetYear: number): string => {
      if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return `${targetYear}-01-15`;
      }
      const [, mm, dd] = dateStr.split('-');
      if (mm === '02' && dd === '29') {
        const isLeap =
          (targetYear % 4 === 0 && targetYear % 100 !== 0) || targetYear % 400 === 0;
        return `${targetYear}-02-${isLeap ? '29' : '28'}`;
      }
      return `${targetYear}-${mm}-${dd}`;
    };

    const quarterLabel = (q: MaintenanceTask['quarter']): string =>
      q === 'Q1' ? '1ST' : q === 'Q2' ? '2ND' : q === 'Q3' ? '3RD' : '4TH';

    updateDb((prev) => {
      let nextTasks: MaintenanceTask[] = prev.maintenanceTasks;

      if (payload.mode === 'clear') {
        nextTasks =
          payload.sourceYear === 'ALL' || payload.sourceYear === 'FROM_ASSETS'
            ? []
            : prev.maintenanceTasks.filter(
                (t) => getTaskYear(t) !== Number(payload.sourceYear)
              );
      } else if (payload.mode === 'reset-pending') {
        nextTasks = prev.maintenanceTasks.map((t) => {
          if (
            payload.sourceYear !== 'ALL' &&
            payload.sourceYear !== 'FROM_ASSETS' &&
            getTaskYear(t) !== Number(payload.sourceYear)
          ) {
            return t;
          }
          return {
            ...t,
            year: getTaskYear(t),
            actualDate: '',
            status: 'Pending',
            remarks: '',
            checklistItems: DEFAULT_CHECKLIST.map((c) => ({
              ...c,
              checked: false,
              remarks: '',
            })),
          };
        });
      } else if (payload.mode === 'rollover') {
        let clonedForTarget: MaintenanceTask[] = [];

        if (payload.sourceYear === 'FROM_ASSETS') {
          clonedForTarget = prev.assets.map((asset, idx) => ({
            id: generateUid('pm'),
            assetId: asset.id,
            assetCode: asset.assetCode,
            equipmentName: asset.equipmentName,
            branchLocation: asset.branchLocation,
            seqNumber: `${payload.targetYear}1ST-${String(idx + 1).padStart(2, '0')}`,
            formCode: 'INF-SUP-PRMC-2025 / SUP-PRMC-2022-00',
            description: `${asset.brand} ${asset.model}`.trim() || asset.equipmentName,
            incharge: asset.assignedTo || '',
            position: '',
            department: '',
            quarter: 'Q1',
            year: payload.targetYear,
            technician: 'Mac',
            scheduledDate: `${payload.targetYear}-01-15`,
            actualDate: '',
            status: 'Pending',
            checklistItems: DEFAULT_CHECKLIST.map((c) => ({
              ...c,
              checked: false,
              remarks: '',
            })),
            remarks: '',
            resultCondition: asset.condition,
            setAssetStatusTo: asset.operationalStatus,
          }));
        } else {
          let sourcePool: MaintenanceTask[];
          if (payload.sourceYear === 'ALL') {
            const years = prev.maintenanceTasks.map(getTaskYear);
            const latestYear = years.length > 0 ? Math.max(...years) : new Date().getFullYear();
            sourcePool = prev.maintenanceTasks.filter((t) => getTaskYear(t) === latestYear);
          } else {
            sourcePool = prev.maintenanceTasks.filter(
              (t) => getTaskYear(t) === Number(payload.sourceYear)
            );
          }

          clonedForTarget = sourcePool.map((t, idx) => ({
            ...t,
            id: generateUid('pm'),
            year: payload.targetYear,
            seqNumber: `${payload.targetYear}${quarterLabel(t.quarter)}-${String(idx + 1).padStart(2, '0')}`,
            scheduledDate: shiftYearInDate(t.scheduledDate, payload.targetYear),
            actualDate: '',
            status: 'Pending',
            remarks: '',
            checklistItems: DEFAULT_CHECKLIST.map((c) => ({
              ...c,
              checked: false,
              remarks: '',
            })),
          }));
        }

        if (payload.keepHistory) {
          const retained = prev.maintenanceTasks.filter(
            (t) => getTaskYear(t) !== Number(payload.targetYear)
          );
          nextTasks = [...clonedForTarget, ...retained];
        } else {
          nextTasks = clonedForTarget;
        }
      }

      const nextAssets = payload.resetAssetLastPmDate
        ? prev.assets.map((a) => ({ ...a, lastMaintenanceDate: '' }))
        : prev.assets;

      return {
        ...prev,
        maintenanceTasks: nextTasks,
        assets: nextAssets,
      };
    });
  };

  const handleOpenAddSheetLink = (
    defaultTarget: GoogleSheetTargetModule = 'dashboard'
  ) => {
    setEditingSheetLink(null);
    setSheetDefaultTarget(defaultTarget);
    setSheetModalOpen(true);
  };

  const handleOpenEditSheetLink = (link: GoogleSheetLink) => {
    setEditingSheetLink(link);
    setSheetDefaultTarget(link.moduleTarget);
    setSheetModalOpen(true);
  };

  const handleSaveSheetLink = (link: GoogleSheetLink) => {
    updateDb((prev) => ({
      ...prev,
      googleSheetLinks: upsertById(prev.googleSheetLinks || [], link),
    }));
  };

  const handleDeleteSheetLink = (id: string) => {
    updateDb((prev) => ({
      ...prev,
      googleSheetLinks: (prev.googleSheetLinks || []).filter((l) => l.id !== id),
    }));
  };

  const handleRestoreDefaultSheets = () => {
    updateDb((prev) => {
      const existing = prev.googleSheetLinks || [];
      const defaultIds = new Set(DEFAULT_GOOGLE_SHEET_LINKS.map((d) => d.id));
      const customOnly = existing.filter((l) => !defaultIds.has(l.id));
      return {
        ...prev,
        googleSheetLinks: [
          ...structuredClone(DEFAULT_GOOGLE_SHEET_LINKS),
          ...customOnly,
        ],
      };
    });
  };

  const handleSaveBundle = (bundle: AssetBundle) => {
    updateDb((prev) => ({
      ...prev,
      assetBundles: upsertById(prev.assetBundles || [], bundle),
    }));
  };

  const handleDeleteBundle = (bundleId: string) => {
    updateDb((prev) => ({
      ...prev,
      assetBundles: (prev.assetBundles || []).filter((b) => b.id !== bundleId),
    }));
  };

  const handleCloseScannedView = () => {
    setPreviewBundle(null);
    setScannedRoute({ active: false, bundle: null });
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('bundle')) {
        url.searchParams.delete('bundle');
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      }
    } catch {
      // ignore history errors
    }
  };

  const handleSignOut = () => {
    clearAuthSession();
    setAuthUser(null);
    setMobileMenuOpen(false);
    setBackupModalOpen(false);
    setSheetModalOpen(false);
  };

  if (previewBundle || scannedRoute.active) {
    return (
      <ScannedBundlePage
        bundle={previewBundle || scannedRoute.bundle}
        error={previewBundle ? undefined : scannedRoute.error}
        liveAssets={authUser ? db.assets : []}
        isAuthenticated={Boolean(authUser)}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
        onBackToPortal={handleCloseScannedView}
      />
    );
  }

  if (!authUser) {
    return (
      <LoginScreen
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
        onLoginSuccess={(user) => {
          saveAuthSession(user);
          setAuthUser(user);
          setOperatorName(user.displayName);
        }}
      />
    );
  }

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
        className={`fixed lg:sticky top-0 left-0 z-40 h-[100dvh] bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 flex flex-col transition-all duration-200 shrink-0 ${
          sidebarCollapsed ? 'lg:w-[68px]' : 'lg:w-[248px]'
        } ${
          mobileMenuOpen
            ? 'translate-x-0 w-[260px]'
            : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Sidebar Brand */}
        <div className="h-14 px-3 flex items-center justify-between border-b border-stone-200 dark:border-stone-800">
          <button
            type="button"
            onClick={() => handleNavigate('dashboard')}
            className={`flex items-center gap-2 min-w-0 text-left ${
              sidebarCollapsed ? 'lg:justify-center lg:w-full' : ''
            }`}
            title="TRISTELLAR IT DEPT."
          >
            <div className="inline-flex items-center justify-center rounded-md bg-white dark:bg-white/95 px-1.5 py-0.5 shrink-0">
              <img
                src={`${import.meta.env.BASE_URL}assets/aistudio/TTC.Logo.Tagline_MKT_Ver7824_3b47c9b8.png`}
                alt="TriStellar — Bigas ng Bayan"
                className={
                  sidebarCollapsed
                    ? 'h-5 w-auto max-w-[44px] object-contain'
                    : 'h-7 w-auto max-w-[108px] object-contain'
                }
              />
            </div>
            {!sidebarCollapsed && (
              <span className="font-display font-bold text-[11px] tracking-tight text-stone-800 dark:text-stone-100 whitespace-nowrap truncate">
                IT DEPT.
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
            const showUnread = item.id === 'team' && unreadChatCount > 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`relative w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/70 dark:hover:bg-stone-800/60'
                } ${sidebarCollapsed ? 'lg:justify-center lg:px-0' : ''}`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  {item.icon}
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </span>
                {showUnread && (
                  <span
                    className={`font-mono tabular-nums text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-600 text-white ${
                      sidebarCollapsed ? 'absolute top-1.5 right-1.5 px-1 py-0' : ''
                    }`}
                  >
                    {unreadChatCount > 9 ? '9+' : unreadChatCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Mobile Operator & Sign Out Footer */}
        <div className="lg:hidden p-3 border-t border-stone-200 dark:border-stone-800 space-y-2 bg-stone-50/70 dark:bg-stone-950/50">
          <div className="px-2 py-1 flex items-center justify-between gap-2 text-xs">
            <span className="text-stone-500 dark:text-stone-400">Signed in as</span>
            <span className="font-semibold text-stone-900 dark:text-stone-100 truncate">
              {authUser.displayName}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 dark:hover:border-rose-800 transition-colors whitespace-nowrap"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sign Out / Switch Operator</span>
          </button>
        </div>

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
        <header className="sticky top-0 z-30 h-14 bg-white/95 dark:bg-stone-900/95 backdrop-blur border-b border-stone-200 dark:border-stone-800 px-3 sm:px-4 lg:px-6 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-lg text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 shrink-0"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Global Search Bar */}
            <div ref={searchWrapperRef} className="relative flex-1 min-w-0 max-w-md">
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

          {/* Top Bar Right Controls: Operator, Backup/Restore JSON, Theme Toggle, Sign Out */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <span className="hidden md:inline-flex items-center px-2 py-1 text-xs font-medium text-stone-500 dark:text-stone-400 whitespace-nowrap shrink-0">
              Operator:
              <strong className="ml-1 font-semibold text-stone-900 dark:text-stone-100">
                {authUser.displayName}
              </strong>
            </span>

            <button
              type="button"
              onClick={() => setBackupModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
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

            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              title="Sign out"
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 dark:hover:border-rose-800 transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
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
                  onAddSheetLink={handleOpenAddSheetLink}
                  onEditSheetLink={handleOpenEditSheetLink}
                  onDeleteSheetLink={handleDeleteSheetLink}
                  onRestoreDefaultSheets={handleRestoreDefaultSheets}
                />
              )}

              {activeModule === 'assets' && (
                <AssetRegistryModule
                  assets={db.assets}
                  maintenanceTasks={db.maintenanceTasks}
                  assetBundles={db.assetBundles || []}
                  initialBranchFilter={assetBranchJump}
                  initialViewMode={assetViewMode}
                  onViewModeChange={setAssetViewMode}
                  googleSheetLinks={db.googleSheetLinks || []}
                  onAddSheetLink={handleOpenAddSheetLink}
                  onEditSheetLink={handleOpenEditSheetLink}
                  onSaveAsset={handleSaveAsset}
                  onDeleteAsset={handleDeleteAsset}
                  onSaveBundle={handleSaveBundle}
                  onDeleteBundle={handleDeleteBundle}
                  onPreviewScannedBundle={(bundle) => setPreviewBundle(bundle)}
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
                  googleSheetLinks={db.googleSheetLinks || []}
                  onAddSheetLink={handleOpenAddSheetLink}
                  onEditSheetLink={handleOpenEditSheetLink}
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
                  onResetMaintenance={handleResetMaintenance}
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
                  googleSheetLinks={db.googleSheetLinks || []}
                  onAddSheetLink={handleOpenAddSheetLink}
                  onEditSheetLink={handleOpenEditSheetLink}
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

              {activeModule === 'helpdesk' && (
                <HelpdeskReportModule
                  reports={db.helpdeskReports || []}
                  tickets={db.helpdeskTickets || []}
                  googleSheetLinks={db.googleSheetLinks || []}
                  onAddSheetLink={handleOpenAddSheetLink}
                  onEditSheetLink={handleOpenEditSheetLink}
                  onSaveReports={(nextReports) =>
                    updateDb((prev) => ({
                      ...prev,
                      helpdeskReports: nextReports,
                    }))
                  }
                  onSaveTickets={(nextTickets) =>
                    updateDb((prev) => ({
                      ...prev,
                      helpdeskTickets: nextTickets,
                    }))
                  }
                  onReloadInitialLog={handleReloadInitialHelpdeskLog}
                  reloadingLog={reloadingHelpdeskLog}
                />
              )}

              {activeModule === 'team' && (
                <TeamNotesModule
                  messages={teamMessages}
                  notes={itNotes}
                  onlineUsers={onlineUsers}
                  wsConnected={wsConnected}
                  assets={db.assets}
                  operatorName={operatorName}
                  onChangeOperatorName={setOperatorName}
                  onSendMessage={(msg) => {
                    setTeamMessages((prev) => mergeChatMessage(prev, msg));
                    teamSocket.sendChatMessage(msg);
                  }}
                  onDeleteMessage={(id) => {
                    setTeamMessages((prev) => prev.filter((m) => m.id !== id));
                    teamSocket.deleteChatMessage(id);
                  }}
                  onUpsertNote={(note) => {
                    setItNotes((prev) => mergeItNote(prev, note));
                    teamSocket.upsertNote(note);
                  }}
                  onDeleteNote={(id) => {
                    setItNotes((prev) => prev.filter((n) => n.id !== id));
                    teamSocket.deleteNote(id);
                  }}
                  onJumpToAsset={(branchOrAll) => {
                    setAssetBranchJump(branchOrAll || 'ALL');
                    setActiveModule('assets');
                  }}
                  onJumpToMaintenance={(code) => {
                    setPmSearchJump(code);
                    setActiveModule('maintenance');
                  }}
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

      <GoogleSheetLinkModal
        isOpen={sheetModalOpen}
        editingLink={editingSheetLink}
        defaultModuleTarget={sheetDefaultTarget}
        onClose={() => setSheetModalOpen(false)}
        onSave={handleSaveSheetLink}
      />
    </div>
  );
}
