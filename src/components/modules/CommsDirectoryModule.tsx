import React, { useMemo, useState } from 'react';
import {
  MonitorSmartphone,
  Camera,
  Radio,
  Wifi,
  Copy,
  Check,
  ExternalLink,
  Star,
  Plus,
  RefreshCw,
  Search,
  Download,
  Upload,
  Pencil,
  Trash2,
} from 'lucide-react';
import {
  AnyDeskEntry,
  CctvEntry,
  GoogleSheetLink,
  GoogleSheetTargetModule,
  RadioEntry,
  VoucherDeviceType,
  VoucherStatus,
  WifiAuthorizedDevice,
  WifiVoucher,
  WifiVoucherSubmission,
} from '../../types/cmms';
import { BRANCHES } from '../../data/seedData';
import { StatusBadge } from '../ui/StatusBadge';
import { Modal } from '../ui/Modal';
import { ModuleGoogleSheetsBar } from '../ui/ModuleGoogleSheetsBar';
import { CsvImportModal } from '../modals/CsvImportModal';
import { exportToCsv, generateUid, pickField } from '../../utils/csv';
import { isPortalVoucherRowSet, parsePortalVoucherRows } from '../../utils/wifiVouchers';
import { buildRuijieVoucherFormUrl } from '../../services/voucherSubmissions';

export type CommsSubTab = 'anydesk' | 'cctv' | 'radio' | 'wifi';

interface CommsDirectoryModuleProps {
  initialSubTab?: CommsSubTab;
  googleSheetLinks: GoogleSheetLink[];
  onAddSheetLink: (defaultTarget: GoogleSheetTargetModule) => void;
  onEditSheetLink: (link: GoogleSheetLink) => void;
  anydeskEntries: AnyDeskEntry[];
  cctvEntries: CctvEntry[];
  radioEntries: RadioEntry[];
  wifiAuthorizedDevices: WifiAuthorizedDevice[];
  wifiVouchers: WifiVoucher[];
  voucherSubmissions?: WifiVoucherSubmission[];
  onSaveAnydesk: (entry: AnyDeskEntry) => void;
  onDeleteAnydesk: (id: string) => void;
  onBulkImportAnydesk: (entries: AnyDeskEntry[]) => void;
  onSaveCctv: (entry: CctvEntry) => void;
  onDeleteCctv: (id: string) => void;
  onBulkImportCctv: (entries: CctvEntry[]) => void;
  onSaveRadio: (entry: RadioEntry) => void;
  onDeleteRadio: (id: string) => void;
  onBulkImportRadio: (entries: RadioEntry[]) => void;
  onSaveAuthorizedDevice: (entry: WifiAuthorizedDevice) => void;
  onDeleteAuthorizedDevice: (id: string) => void;
  onBulkImportAuthorizedDevices: (entries: WifiAuthorizedDevice[]) => void;
  onSaveVoucher: (entry: WifiVoucher) => void;
  onDeleteVoucher: (id: string) => void;
  onBulkImportVouchers: (entries: WifiVoucher[]) => void;
  onDeleteVoucherSubmission?: (id: string) => void;
  onReloadVouchers?: () => Promise<void>;
  reloadingVouchers?: boolean;
}

export const CommsDirectoryModule: React.FC<CommsDirectoryModuleProps> = ({
  initialSubTab = 'anydesk',
  googleSheetLinks,
  onAddSheetLink,
  onEditSheetLink,
  anydeskEntries,
  cctvEntries,
  radioEntries,
  wifiAuthorizedDevices,
  wifiVouchers,
  voucherSubmissions = [],
  onSaveAnydesk,
  onDeleteAnydesk,
  onBulkImportAnydesk,
  onSaveCctv,
  onDeleteCctv,
  onBulkImportCctv,
  onSaveRadio,
  onDeleteRadio,
  onBulkImportRadio,
  onSaveAuthorizedDevice,
  onDeleteAuthorizedDevice,
  onBulkImportAuthorizedDevices,
  onSaveVoucher,
  onDeleteVoucher,
  onBulkImportVouchers,
  onDeleteVoucherSubmission,
  onReloadVouchers,
  reloadingVouchers = false,
}) => {
  const [subTab, setSubTab] = useState<CommsSubTab>(initialSubTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Filters
  const [cctvBranchFilter, setCctvBranchFilter] = useState('ALL');
  const [radioDeptFilter, setRadioDeptFilter] = useState('ALL');
  const [voucherStatusFilter, setVoucherStatusFilter] = useState<'ALL' | VoucherStatus>('ALL');
  const [voucherGroupFilter, setVoucherGroupFilter] = useState<'ALL' | 'Employee' | 'GUEST'>('ALL');

  // Modals
  const [isCsvOpen, setIsCsvOpen] = useState(false);
  const [anydeskModalOpen, setAnydeskModalOpen] = useState(false);
  const [editingAnydesk, setEditingAnydesk] = useState<AnyDeskEntry | null>(null);
  const [adForm, setAdForm] = useState<Omit<AnyDeskEntry, 'id'>>({
    anydeskId: '',
    serverOrPcName: '',
    branchDescription: '',
    categoryStatus: 'Workstation',
    isFavorite: false,
  });

  const [cctvModalOpen, setCctvModalOpen] = useState(false);
  const [editingCctv, setEditingCctv] = useState<CctvEntry | null>(null);
  const [cctvForm, setCctvForm] = useState<Omit<CctvEntry, 'id'>>({
    branch: 'Conchu',
    cameraNo: '',
    ipAddress: '192.168.110.',
    locationArea: '',
    statusNotes: 'Online',
  });

  const [radioModalOpen, setRadioModalOpen] = useState(false);
  const [editingRadio, setEditingRadio] = useState<RadioEntry | null>(null);
  const [radioForm, setRadioForm] = useState<Omit<RadioEntry, 'id'>>({
    personnelOrUnit: '',
    departmentRole: 'IT',
    callsign: '',
    channelNo: 'CH 06',
    notes: '',
  });

  const [authDeviceModalOpen, setAuthDeviceModalOpen] = useState(false);
  const [editingAuthDevice, setEditingAuthDevice] = useState<WifiAuthorizedDevice | null>(null);
  const [authForm, setAuthForm] = useState<Omit<WifiAuthorizedDevice, 'id'>>({
    employeeName: '',
    allowedQty: 2,
    deviceBreakdown: '1 Laptop, 1 Company',
    department: '',
  });

  // Quick voucher assignment form state
  const [assignVoucherCode, setAssignVoucherCode] = useState('');
  const [assignEmployeeName, setAssignEmployeeName] = useState('');
  const [assignEmployeeNum, setAssignEmployeeNum] = useState('');
  const [assignDeviceType, setAssignDeviceType] =
    useState<VoucherDeviceType>('Company Laptop');

  const [voucherModalOpen, setVoucherModalOpen] = useState(false);
  const [newVoucherCodesText, setNewVoucherCodesText] = useState('');
  const [newVoucherDeviceType, setNewVoucherDeviceType] =
    useState<VoucherDeviceType>('Company Laptop');

  React.useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  const availableVouchers = useMemo(
    () => wifiVouchers.filter((v) => v.status === 'Available'),
    [wifiVouchers]
  );

  React.useEffect(() => {
    if (availableVouchers.length === 0) {
      if (assignVoucherCode) setAssignVoucherCode('');
      return;
    }
    const stillAvailable = availableVouchers.some(
      (v) => v.voucherCode === assignVoucherCode
    );
    if (!assignVoucherCode || !stillAvailable) {
      setAssignVoucherCode(availableVouchers[0].voucherCode);
    }
  }, [availableVouchers, assignVoucherCode]);

  const copyText = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopiedId(key);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const filteredAnydesk = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...anydeskEntries]
      .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite))
      .filter((item) => {
        if (!q) return true;
        return (
          item.anydeskId.toLowerCase().includes(q) ||
          item.serverOrPcName.toLowerCase().includes(q) ||
          item.branchDescription.toLowerCase().includes(q) ||
          item.categoryStatus.toLowerCase().includes(q)
        );
      });
  }, [anydeskEntries, searchQuery]);

  const filteredCctv = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cctvEntries.filter((c) => {
      if (cctvBranchFilter !== 'ALL' && c.branch !== cctvBranchFilter) return false;
      if (!q) return true;
      return (
        c.cameraNo.toLowerCase().includes(q) ||
        c.ipAddress.toLowerCase().includes(q) ||
        c.locationArea.toLowerCase().includes(q) ||
        c.statusNotes.toLowerCase().includes(q) ||
        c.branch.toLowerCase().includes(q)
      );
    });
  }, [cctvEntries, cctvBranchFilter, searchQuery]);

  const filteredRadio = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return radioEntries.filter((r) => {
      if (radioDeptFilter !== 'ALL' && r.departmentRole !== radioDeptFilter) return false;
      if (!q) return true;
      return (
        r.personnelOrUnit.toLowerCase().includes(q) ||
        r.departmentRole.toLowerCase().includes(q) ||
        r.callsign.toLowerCase().includes(q) ||
        r.channelNo.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q)
      );
    });
  }, [radioEntries, radioDeptFilter, searchQuery]);

  const filteredAuthDevices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return wifiAuthorizedDevices.filter((d) => {
      if (!q) return true;
      return (
        d.employeeName.toLowerCase().includes(q) ||
        d.deviceBreakdown.toLowerCase().includes(q) ||
        (d.department ?? '').toLowerCase().includes(q)
      );
    });
  }, [wifiAuthorizedDevices, searchQuery]);

  const voucherStats = useMemo(() => {
    let availableEmp = 0;
    let availableGuest = 0;
    let used = 0;
    let expired = 0;
    let employeeTotal = 0;
    let guestTotal = 0;

    for (const v of wifiVouchers) {
      const grp = (v.userGroup || 'Employee').toUpperCase();
      const isGuest = grp === 'GUEST';
      if (isGuest) guestTotal += 1;
      else employeeTotal += 1;

      if (v.status === 'Available') {
        if (isGuest) availableGuest += 1;
        else availableEmp += 1;
      } else if (v.status === 'Expired') {
        expired += 1;
      } else {
        used += 1;
      }
    }

    return {
      total: wifiVouchers.length,
      available: availableEmp + availableGuest,
      availableEmp,
      availableGuest,
      used,
      expired,
      employeeTotal,
      guestTotal,
    };
  }, [wifiVouchers]);

  const filteredVouchers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return wifiVouchers.filter((v) => {
      if (voucherStatusFilter !== 'ALL' && v.status !== voucherStatusFilter) return false;
      if (voucherGroupFilter !== 'ALL') {
        const grp = (v.userGroup || 'Employee').toUpperCase();
        if (grp !== voucherGroupFilter.toUpperCase()) return false;
      }
      if (!q) return true;
      return (
        v.voucherCode.toLowerCase().includes(q) ||
        v.employeeName.toLowerCase().includes(q) ||
        v.employeeNumber.toLowerCase().includes(q) ||
        v.deviceType.toLowerCase().includes(q) ||
        (v.alias ?? '').toLowerCase().includes(q) ||
        (v.userGroup ?? '').toLowerCase().includes(q) ||
        (v.trafficUsed ?? '').toLowerCase().includes(q)
      );
    });
  }, [wifiVouchers, voucherStatusFilter, voucherGroupFilter, searchQuery]);

  const handleQuickAssignVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignVoucherCode.trim() || !assignEmployeeName.trim()) return;
    const existing = wifiVouchers.find(
      (v) => v.voucherCode.toLowerCase() === assignVoucherCode.trim().toLowerCase()
    );
    const today = new Date().toISOString().slice(0, 10);
    onSaveVoucher({
      ...(existing ?? {}),
      id: existing ? existing.id : generateUid('wv'),
      date: today,
      voucherCode: assignVoucherCode.trim(),
      employeeName: assignEmployeeName.trim(),
      employeeNumber: assignEmployeeNum.trim() || 'TTC-PENDING',
      deviceType: assignDeviceType,
      status: 'Used',
      portalStatus: 'In use',
    });
    setAssignVoucherCode('');
    setAssignEmployeeName('');
    setAssignEmployeeNum('');
  };

  const handleExportCurrentTab = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    if (subTab === 'anydesk') {
      exportToCsv(
        `anydesk-directory-${stamp}.csv`,
        [
          { key: 'anydeskId', label: 'AnyDesk ID / Address' },
          { key: 'serverOrPcName', label: 'Server / PC Name' },
          { key: 'branchDescription', label: 'Branch Description' },
          { key: 'categoryStatus', label: 'Category / Status' },
          { key: 'isFavorite', label: 'Favorite', format: (r) => (r.isFavorite ? 'Yes' : 'No') },
        ],
        filteredAnydesk
      );
    } else if (subTab === 'cctv') {
      exportToCsv(
        `cctv-ip-directory-${stamp}.csv`,
        [
          { key: 'branch', label: 'Branch' },
          { key: 'cameraNo', label: 'Camera No' },
          { key: 'ipAddress', label: 'IP Address' },
          { key: 'locationArea', label: 'Location / Area' },
          { key: 'statusNotes', label: 'Ping / Status Notes' },
        ],
        filteredCctv
      );
    } else if (subTab === 'radio') {
      exportToCsv(
        `radio-callsigns-${stamp}.csv`,
        [
          { key: 'personnelOrUnit', label: 'Personnel / Unit' },
          { key: 'departmentRole', label: 'Department / Role' },
          { key: 'callsign', label: 'Callsign' },
          { key: 'channelNo', label: 'Channel #' },
          { key: 'notes', label: 'Notes' },
        ],
        filteredRadio
      );
    } else {
      exportToCsv(
        `wifi-voucher-log-${stamp}.csv`,
        [
          { key: 'date', label: 'Date' },
          { key: 'voucherCode', label: 'Voucher Code' },
          { key: 'userGroup', label: 'User Group' },
          { key: 'period', label: 'Period' },
          { key: 'employeeName', label: 'Employee Name' },
          { key: 'alias', label: 'Alias' },
          { key: 'employeeNumber', label: 'Employee #' },
          { key: 'deviceType', label: 'Device Type' },
          { key: 'status', label: 'Status' },
          { key: 'trafficUsed', label: 'Traffic Used/Total' },
          { key: 'macBinding', label: 'MAC Binding' },
          { key: 'activatedAt', label: 'Activated At' },
          { key: 'expiredAt', label: 'Expired At' },
        ],
        filteredVouchers
      );
    }
  };

  const handleImportCsv = (rows: Record<string, string>[]) => {
    if (subTab === 'anydesk') {
      const items: AnyDeskEntry[] = rows.map((row) => {
        const cat = pickField(row, ['Category / Status', 'Category', 'Status']) || 'Workstation';
        const fav =
          ['yes', 'true', '1', 'favorite'].includes(
            pickField(row, ['Favorite', 'Is Favorite']).toLowerCase()
          ) || cat.toLowerCase() === 'favorite';
        return {
          id: generateUid('ad'),
          anydeskId: pickField(row, ['AnyDesk ID / Address', 'AnyDesk ID', 'ID']),
          serverOrPcName: pickField(row, ['Server / PC Name', 'Name', 'Host']),
          branchDescription: pickField(row, ['Branch Description', 'Description', 'Branch']),
          categoryStatus: cat,
          isFavorite: fav,
        };
      });
      onBulkImportAnydesk(items);
      return { importedCount: items.length, summary: `Imported ${items.length} AnyDesk hosts.` };
    }

    if (subTab === 'cctv') {
      const items: CctvEntry[] = rows.map((row) => ({
        id: generateUid('cam'),
        branch: pickField(row, ['Branch']) || 'Conchu',
        cameraNo: pickField(row, ['Camera No', 'Camera', 'Cam']),
        ipAddress: pickField(row, ['IP Address', 'IP']),
        locationArea: pickField(row, ['Location / Area', 'Area', 'Location']),
        statusNotes: pickField(row, ['Ping / Status Notes', 'Status Notes', 'Notes']) || 'Online',
      }));
      onBulkImportCctv(items);
      return { importedCount: items.length, summary: `Imported ${items.length} CCTV camera IPs.` };
    }

    if (subTab === 'radio') {
      const items: RadioEntry[] = rows.map((row) => ({
        id: generateUid('rad'),
        personnelOrUnit: pickField(row, ['Personnel / Unit', 'Personnel', 'Unit']),
        departmentRole: pickField(row, ['Department / Role', 'Department', 'Role']),
        callsign: pickField(row, ['Callsign']),
        channelNo: pickField(row, ['Channel #', 'Channel']),
        notes: pickField(row, ['Notes']),
      }));
      onBulkImportRadio(items);
      return { importedCount: items.length, summary: `Imported ${items.length} radio callsigns.` };
    }

    // Wi-Fi tab: detect Authorized Devices vs Voucher Log
    const firstRow = rows[0] ?? {};
    const keys = Object.keys(firstRow).join(' ').toLowerCase();
    if (keys.includes('allowed') || keys.includes('breakdown')) {
      const devices: WifiAuthorizedDevice[] = rows.map((row) => ({
        id: generateUid('wad'),
        employeeName: pickField(row, ['Employee Name', 'Name']),
        allowedQty: Number(pickField(row, ['Allowed Qty', 'Qty'])) || 1,
        deviceBreakdown: pickField(row, ['Device Breakdown', 'Devices']),
        department: pickField(row, ['Department']),
      }));
      onBulkImportAuthorizedDevices(devices);
      return {
        importedCount: devices.length,
        summary: `Imported ${devices.length} authorized Wi-Fi device policies.`,
      };
    }

    const vouchers: WifiVoucher[] = isPortalVoucherRowSet(rows)
      ? parsePortalVoucherRows(rows)
      : rows
          .map((row) => {
            const emp = pickField(row, ['Employee Name', 'Employee']);
            const rawStatus = pickField(row, ['Status']);
            const statusLower = rawStatus.toLowerCase();
            const status: VoucherStatus =
              statusLower === 'expired'
                ? 'Expired'
                : statusLower === 'used' || statusLower === 'in use' || Boolean(emp)
                ? 'Used'
                : 'Available';
            const rawDevice = pickField(row, ['Device Type', 'Device']);
            const deviceType: VoucherDeviceType = rawDevice.toLowerCase().includes('company phone')
              ? 'Company Phone'
              : rawDevice.toLowerCase().includes('personal')
              ? 'Personal Phone'
              : rawDevice.toLowerCase().includes('tablet')
              ? 'Tablet'
              : rawDevice.toLowerCase().includes('guest')
              ? 'Guest Device'
              : 'Company Laptop';
            const code =
              pickField(row, ['Voucher Code', 'Code', 'Voucher']) ||
              (Object.values(row)[0]?.trim() ?? '');
            return {
              id: generateUid('wv'),
              date: pickField(row, ['Date']) || new Date().toISOString().slice(0, 10),
              voucherCode: code,
              employeeName: emp,
              employeeNumber: pickField(row, ['Employee #', 'Employee Number', 'Emp No']),
              deviceType,
              status,
            };
          })
          .filter((v) => Boolean(v.voucherCode));
    onBulkImportVouchers(vouchers);
    return { importedCount: vouchers.length, summary: `Merged ${vouchers.length} Wi-Fi vouchers.` };
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            IT Network, Remote Access &amp; Comms Directory
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
            Daily support lookups for AnyDesk hosts, branch CCTV IPs, radio callsigns, and corporate Wi-Fi vouchers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCsvOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV</span>
          </button>
          <button
            type="button"
            onClick={handleExportCurrentTab}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          {subTab !== 'wifi' ? (
            <button
              type="button"
              onClick={() => {
                if (subTab === 'anydesk') {
                  setEditingAnydesk(null);
                  setAdForm({
                    anydeskId: '',
                    serverOrPcName: '',
                    branchDescription: '',
                    categoryStatus: 'Workstation',
                    isFavorite: false,
                  });
                  setAnydeskModalOpen(true);
                } else if (subTab === 'cctv') {
                  setEditingCctv(null);
                  setCctvForm({
                    branch: 'Conchu',
                    cameraNo: '',
                    ipAddress: '192.168.110.',
                    locationArea: '',
                    statusNotes: 'Online',
                  });
                  setCctvModalOpen(true);
                } else if (subTab === 'radio') {
                  setEditingRadio(null);
                  setRadioForm({
                    personnelOrUnit: '',
                    departmentRole: 'IT',
                    callsign: '',
                    channelNo: 'CH 06',
                    notes: '',
                  });
                  setRadioModalOpen(true);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                {subTab === 'anydesk'
                  ? 'Add AnyDesk Host'
                  : subTab === 'cctv'
                  ? 'Add Camera IP'
                  : 'Add Radio Entry'}
              </span>
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {onReloadVouchers && (
                <button
                  type="button"
                  disabled={reloadingVouchers}
                  onClick={onReloadVouchers}
                  title="Sync Wi-Fi vouchers from uploaded portal CSV"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${reloadingVouchers ? 'animate-spin' : ''}`} />
                  <span>Reload Vouchers</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setNewVoucherCodesText('');
                  setNewVoucherDeviceType('Company Laptop');
                  setVoucherModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Voucher</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingAuthDevice(null);
                  setAuthForm({
                    employeeName: '',
                    allowedQty: 2,
                    deviceBreakdown: '1 Laptop, 1 Company',
                    department: '',
                  });
                  setAuthDeviceModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Authorized Employee</span>
              </button>
            </div>
          )}

          <ModuleGoogleSheetsBar
            links={googleSheetLinks}
            moduleTarget="comms"
            onAddLink={onAddSheetLink}
            onEditLink={onEditSheetLink}
          />
        </div>
      </div>

      {/* 4 Sub-tabs + Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-stone-100 dark:bg-stone-800 rounded-lg">
          <button
            type="button"
            onClick={() => {
              setSubTab('anydesk');
              setSearchQuery('');
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'anydesk'
                ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            <MonitorSmartphone className="w-3.5 h-3.5" />
            <span>AnyDesk Directory</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSubTab('cctv');
              setSearchQuery('');
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'cctv'
                ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>CCTV IP Directory</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSubTab('radio');
              setSearchQuery('');
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'radio'
                ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Radio Callsigns</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSubTab('wifi');
              setSearchQuery('');
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'wifi'
                ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>Wi-Fi Devices &amp; Vouchers</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {subTab === 'cctv' && (
            <select
              value={cctvBranchFilter}
              onChange={(e) => setCctvBranchFilter(e.target.value)}
              aria-label="Filter CCTV by Branch"
              className="px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
            >
              <option value="ALL">All Branches</option>
              {BRANCHES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}
          {subTab === 'radio' && (
            <select
              value={radioDeptFilter}
              onChange={(e) => setRadioDeptFilter(e.target.value)}
              aria-label="Filter Radio by Department"
              className="px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
            >
              <option value="ALL">All Departments</option>
              {Array.from(new Set(radioEntries.map((r) => r.departmentRole))).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}
          {subTab === 'wifi' && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={voucherGroupFilter}
                onChange={(e) =>
                  setVoucherGroupFilter(e.target.value as 'ALL' | 'Employee' | 'GUEST')
                }
                aria-label="Filter Vouchers by Group"
                className="px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              >
                <option value="ALL">All Groups ({voucherStats.total})</option>
                <option value="Employee">Employee ({voucherStats.employeeTotal})</option>
                <option value="GUEST">GUEST ({voucherStats.guestTotal})</option>
              </select>
              <select
                value={voucherStatusFilter}
                onChange={(e) => setVoucherStatusFilter(e.target.value as 'ALL' | VoucherStatus)}
                aria-label="Filter Vouchers by Status"
                className="px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              >
                <option value="ALL">All Statuses</option>
                <option value="Available">Available ({voucherStats.available})</option>
                <option value="Used">In Use ({voucherStats.used})</option>
                <option value="Expired">Expired ({voucherStats.expired})</option>
              </select>
            </div>
          )}

          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${subTab}...`}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
            />
          </div>
        </div>
      </div>

      {/* Sub-tab 1: AnyDesk Remote Directory */}
      {subTab === 'anydesk' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredAnydesk.map((entry) => (
            <div
              key={entry.id}
              className="p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex flex-col justify-between gap-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                    <span>{entry.categoryStatus}</span>
                    {entry.isFavorite && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          Favorite
                        </span>
                      </>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 mt-1 truncate">
                    {entry.serverOrPcName}
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 line-clamp-2">
                    {entry.branchDescription}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onSaveAnydesk({ ...entry, isFavorite: !entry.isFavorite })
                  }
                  aria-label="Toggle favorite"
                  className={`p-1.5 rounded-md transition-colors shrink-0 ${
                    entry.isFavorite
                      ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/40'
                      : 'text-stone-400 hover:text-amber-500 hover:bg-stone-100 dark:hover:bg-stone-800'
                  }`}
                >
                  <Star className={`w-4 h-4 ${entry.isFavorite ? 'fill-current' : ''}`} />
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-stone-100 dark:border-stone-800">
                <span className="font-mono text-sm font-bold tabular-nums text-stone-900 dark:text-stone-100">
                  {entry.anydeskId}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => copyText(entry.anydeskId, `ad-${entry.id}`)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors whitespace-nowrap"
                  >
                    {copiedId === `ad-${entry.id}` ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy ID</span>
                      </>
                    )}
                  </button>
                  <a
                    href={`anydesk:${entry.anydeskId.replace(/\s+/g, '')}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-rose-600 text-white hover:bg-rose-700 transition-colors whitespace-nowrap"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Launch</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAnydesk(entry);
                      const { id: _ignored, ...rest } = entry;
                      setAdForm(rest);
                      setAnydeskModalOpen(true);
                    }}
                    aria-label={`Edit ${entry.serverOrPcName}`}
                    className="p-1.5 rounded-md text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmDeleteId === entry.id) {
                        onDeleteAnydesk(entry.id);
                        setConfirmDeleteId(null);
                      } else {
                        setConfirmDeleteId(entry.id);
                      }
                    }}
                    aria-label={`Delete ${entry.serverOrPcName}`}
                    className={`p-1.5 rounded-md ${
                      confirmDeleteId === entry.id
                        ? 'bg-rose-600 text-white'
                        : 'text-stone-400 hover:text-rose-600'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sub-tab 2: CCTV IP Directory */}
      {subTab === 'cctv' && (
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  <th className="px-4 py-3 whitespace-nowrap">Branch</th>
                  <th className="px-4 py-3 whitespace-nowrap">Camera No</th>
                  <th className="px-4 py-3 whitespace-nowrap">IP Address</th>
                  <th className="px-4 py-3 whitespace-nowrap">Location / Area</th>
                  <th className="px-4 py-3 whitespace-nowrap">Ping / Status Notes</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 dark:divide-stone-800 text-xs">
                {filteredCctv.map((cam) => (
                  <tr
                    key={cam.id}
                    className="hover:bg-stone-50/80 dark:hover:bg-stone-800/40 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-stone-900 dark:text-stone-100 whitespace-nowrap">
                      {cam.branch}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-stone-900 dark:text-stone-100 whitespace-nowrap">
                      {cam.cameraNo}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <span className="font-mono font-medium tabular-nums text-orange-700 dark:text-orange-400">
                          {cam.ipAddress}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyText(cam.ipAddress, `ip-${cam.id}`)}
                          className="p-1 rounded hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                          title="Copy IP Address"
                        >
                          {copiedId === `ip-${cam.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-stone-700 dark:text-stone-300">
                      {cam.locationArea || '—'}
                    </td>
                    <td className="px-4 py-3 text-stone-600 dark:text-stone-300">
                      {cam.statusNotes || '—'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCctv(cam);
                            const { id: _ignored, ...rest } = cam;
                            setCctvForm(rest);
                            setCctvModalOpen(true);
                          }}
                          className="p-1.5 rounded-md text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirmDeleteId === cam.id) {
                              onDeleteCctv(cam.id);
                              setConfirmDeleteId(null);
                            } else {
                              setConfirmDeleteId(cam.id);
                            }
                          }}
                          className={`p-1.5 rounded-md ${
                            confirmDeleteId === cam.id
                              ? 'bg-rose-600 text-white'
                              : 'text-stone-400 hover:text-rose-600'
                          }`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-tab 3: Radio Callsigns & Channels */}
      {subTab === 'radio' && (
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  <th className="px-4 py-3 whitespace-nowrap">Department / Role</th>
                  <th className="px-4 py-3 whitespace-nowrap">Callsign</th>
                  <th className="px-4 py-3 whitespace-nowrap">Channel #</th>
                  <th className="px-4 py-3 whitespace-nowrap">Personnel / Unit</th>
                  <th className="px-4 py-3 whitespace-nowrap">Notes</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 dark:divide-stone-800 text-xs">
                {filteredRadio.map((rad) => (
                  <tr
                    key={rad.id}
                    className="hover:bg-stone-50/80 dark:hover:bg-stone-800/40 transition-colors"
                  >
                    <td className="px-4 py-3 font-semibold text-stone-900 dark:text-stone-100 whitespace-nowrap">
                      {rad.departmentRole}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-orange-700 dark:text-orange-400 whitespace-nowrap">
                      {rad.callsign}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-stone-700 dark:text-stone-300 whitespace-nowrap">
                      {rad.channelNo}
                    </td>
                    <td className="px-4 py-3 text-stone-800 dark:text-stone-200">
                      {rad.personnelOrUnit}
                    </td>
                    <td className="px-4 py-3 text-stone-500 dark:text-stone-400">
                      {rad.notes || '—'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRadio(rad);
                            const { id: _ignored, ...rest } = rad;
                            setRadioForm(rest);
                            setRadioModalOpen(true);
                          }}
                          className="p-1.5 rounded-md text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirmDeleteId === rad.id) {
                              onDeleteRadio(rad.id);
                              setConfirmDeleteId(null);
                            } else {
                              setConfirmDeleteId(rad.id);
                            }
                          }}
                          className={`p-1.5 rounded-md ${
                            confirmDeleteId === rad.id
                              ? 'bg-rose-600 text-white'
                              : 'text-stone-400 hover:text-rose-600'
                          }`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-tab 4: Wi-Fi Device List & Voucher Logs */}
      {subTab === 'wifi' && (
        <div className="space-y-6">
          {/* Voucher Summary Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
              <p className="text-[11px] font-medium text-stone-500 dark:text-stone-400">
                Total Portal Vouchers
              </p>
              <p className="mt-1 font-mono text-xl font-bold tabular-nums text-stone-900 dark:text-stone-100">
                {voucherStats.total.toLocaleString()}
              </p>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 font-mono tabular-nums">
                Employee: {voucherStats.employeeTotal} · Guest: {voucherStats.guestTotal}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
              <p className="text-[11px] font-medium text-stone-500 dark:text-stone-400">
                Available (Not Used)
              </p>
              <p className="mt-1 font-mono text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                {voucherStats.available.toLocaleString()}
              </p>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 font-mono tabular-nums">
                Employee: {voucherStats.availableEmp} · Guest: {voucherStats.availableGuest}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
              <p className="text-[11px] font-medium text-stone-500 dark:text-stone-400">
                Active / In Use
              </p>
              <p className="mt-1 font-mono text-xl font-bold tabular-nums text-orange-600 dark:text-orange-400">
                {voucherStats.used.toLocaleString()}
              </p>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                Currently bound &amp; active
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
              <p className="text-[11px] font-medium text-stone-500 dark:text-stone-400">
                Expired (1-Day Guest)
              </p>
              <p className="mt-1 font-mono text-xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
                {voucherStats.expired.toLocaleString()}
              </p>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                Completed guest sessions
              </p>
            </div>
          </div>

          {/* Ruijie Captive Portal Redirect Form Link */}
          <div className="p-3.5 rounded-xl bg-orange-50/70 dark:bg-orange-950/25 border border-orange-200 dark:border-orange-900/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-orange-900 dark:text-orange-200">
                Ruijie Post-Voucher Redirect Form URL (GitHub Pages)
              </p>
              <p className="text-[11px] text-orange-800/80 dark:text-orange-300/80 mt-0.5">
                Standalone user info form with no tabs or links — saves to Supabase &amp; redirects to tristellarcorp.com on submit.
              </p>
              <p className="mt-1 font-mono text-[11px] text-stone-700 dark:text-stone-300 truncate">
                {buildRuijieVoucherFormUrl()}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => copyText(buildRuijieVoucherFormUrl(), 'ruijie-form-url')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-600 text-white hover:bg-orange-700 transition-colors whitespace-nowrap"
              >
                {copiedId === 'ruijie-form-url' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied Form URL</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Ruijie Form URL</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Voucher Assignment Form */}
          <form
            onSubmit={handleQuickAssignVoucher}
            className="p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                Quick Wi-Fi Voucher Assignment
              </h2>
              <span className="text-xs font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                {availableVouchers.length} Available Vouchers Ready
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-stone-500 dark:text-stone-400 mb-1">
                  Voucher Code (Available)
                </label>
                <select
                  required
                  value={assignVoucherCode}
                  onChange={(e) => setAssignVoucherCode(e.target.value)}
                  aria-label="Select Available Voucher Code"
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                >
                  {availableVouchers.length === 0 ? (
                    <option value="">No available vouchers — add or import CSV</option>
                  ) : (
                    availableVouchers.map((v) => (
                      <option key={v.id} value={v.voucherCode}>
                        {v.voucherCode} — {v.userGroup || 'Employee'} ({v.period || 'Unlimited'})
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-stone-500 dark:text-stone-400 mb-1">
                  Employee Name
                </label>
                <input
                  type="text"
                  required
                  list="authorized-employee-names"
                  value={assignEmployeeName}
                  onChange={(e) => setAssignEmployeeName(e.target.value)}
                  placeholder="Employee full name"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                />
                <datalist id="authorized-employee-names">
                  {wifiAuthorizedDevices.map((d) => (
                    <option key={d.id} value={d.employeeName} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-stone-500 dark:text-stone-400 mb-1">
                  Employee #
                </label>
                <input
                  type="text"
                  value={assignEmployeeNum}
                  onChange={(e) => setAssignEmployeeNum(e.target.value)}
                  placeholder="TTC-2883381"
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-stone-500 dark:text-stone-400 mb-1">
                  Device Type
                </label>
                <select
                  value={assignDeviceType}
                  onChange={(e) => setAssignDeviceType(e.target.value as VoucherDeviceType)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                >
                  <option value="Company Laptop">Company Laptop</option>
                  <option value="Company Phone">Company Phone</option>
                  <option value="Personal Phone">Personal Phone</option>
                  <option value="Tablet">Tablet</option>
                  <option value="Guest Device">Guest Device</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={availableVouchers.length === 0 || !assignVoucherCode}
                  className="w-full px-4 py-2 text-xs font-medium rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  Issue Voucher
                </button>
              </div>
            </div>
          </form>

          {/* Split Grid: Authorized Device List & Voucher Issuance Log */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <section className="xl:col-span-5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                    Authorized Device List
                  </h2>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Employee quota &amp; permitted device mix
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-stone-500 dark:text-stone-400">
                  {filteredAuthDevices.length} staff
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                      <th className="px-4 py-2.5">Employee Name</th>
                      <th className="px-4 py-2.5 text-right">Qty</th>
                      <th className="px-4 py-2.5">Device Breakdown</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 dark:divide-stone-800 text-xs">
                    {filteredAuthDevices.map((dev) => (
                      <tr key={dev.id} className="hover:bg-stone-50/70 dark:hover:bg-stone-800/40">
                        <td className="px-4 py-2.5">
                          <div className="font-semibold text-stone-900 dark:text-stone-100">
                            {dev.employeeName}
                          </div>
                          {dev.department && (
                            <div className="text-[11px] text-stone-500 dark:text-stone-400">
                              {dev.department}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold tabular-nums text-stone-900 dark:text-stone-100">
                          {dev.allowedQty}
                        </td>
                        <td className="px-4 py-2.5 text-stone-600 dark:text-stone-300">
                          {dev.deviceBreakdown}
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAuthDevice(dev);
                              const { id: _ignored, ...rest } = dev;
                              setAuthForm(rest);
                              setAuthDeviceModalOpen(true);
                            }}
                            className="p-1 text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteAuthorizedDevice(dev.id)}
                            className="p-1 text-stone-400 hover:text-rose-600 ml-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="xl:col-span-7 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                    Voucher Issuance Log
                  </h2>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Track assigned and available portal voucher codes
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-stone-500 dark:text-stone-400">
                  {filteredVouchers.length} vouchers
                </span>
              </div>
              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800 text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                      <th className="px-3.5 py-2.5 whitespace-nowrap">Voucher Code</th>
                      <th className="px-3.5 py-2.5 whitespace-nowrap">Group &amp; Period</th>
                      <th className="px-3.5 py-2.5 whitespace-nowrap">Employee / Alias</th>
                      <th className="px-3.5 py-2.5 whitespace-nowrap">Device / Traffic</th>
                      <th className="px-3.5 py-2.5 whitespace-nowrap">Date</th>
                      <th className="px-3.5 py-2.5 whitespace-nowrap">Status</th>
                      <th className="px-3.5 py-2.5 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 dark:divide-stone-800 text-xs">
                    {filteredVouchers.map((v) => (
                      <tr key={v.id} className="hover:bg-stone-50/70 dark:hover:bg-stone-800/40">
                        <td className="px-3.5 py-2.5 font-mono font-bold text-stone-900 dark:text-stone-100 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            {v.voucherCode}
                            <button
                              type="button"
                              onClick={() => copyText(v.voucherCode, `vc-${v.id}`)}
                              className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                              title="Copy Voucher Code"
                            >
                              {copiedId === `vc-${v.id}` ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <div className="font-semibold text-stone-800 dark:text-stone-200">
                            {v.userGroup || 'Employee'}
                          </div>
                          <div className="text-[11px] font-mono text-stone-500 dark:text-stone-400">
                            {v.period || 'Unlimited'}
                            {v.macBinding ? ` · MAC: ${v.macBinding}` : ''}
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5">
                          <div className="font-medium text-stone-900 dark:text-stone-100">
                            {v.employeeName || '—'}
                          </div>
                          {(v.alias || v.employeeNumber || v.department || v.branchLocation) && (
                            <div className="text-[11px] font-mono text-stone-500 dark:text-stone-400">
                              {[v.alias, v.employeeNumber, v.department, v.branchLocation]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          )}
                          {v.phoneNumber && (
                            <div className="text-[10px] font-mono text-stone-400">
                              {v.phoneNumber}
                            </div>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <div className="text-stone-700 dark:text-stone-300">
                            {v.deviceType}
                            {v.devices ? ` (${v.devices})` : ''}
                          </div>
                          {v.trafficUsed && (
                            <div className="text-[11px] font-mono text-stone-500 dark:text-stone-400">
                              {v.trafficUsed}
                            </div>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono tabular-nums text-stone-600 dark:text-stone-300 whitespace-nowrap">
                          <div>{v.date}</div>
                          {v.expiredAt && (
                            <div className="text-[10px] text-rose-500 dark:text-rose-400">
                              Exp: {v.expiredAt.split(' ')[0]}
                            </div>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <StatusBadge value={v.status} />
                        </td>
                        <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onDeleteVoucher(v.id)}
                            className="p-1 text-stone-400 hover:text-rose-600"
                            title="Delete Voucher"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* Ruijie Wi-Fi User Check-In Submissions */}
          {voucherSubmissions.length > 0 && (
            <section className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                    Ruijie Wi-Fi User Registrations ({voucherSubmissions.length})
                  </h2>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Live user info submitted from the standalone Ruijie redirect form ({buildRuijieVoucherFormUrl()})
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[360px]">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800 text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                      <th className="px-3.5 py-2.5 whitespace-nowrap">Submitted</th>
                      <th className="px-3.5 py-2.5 whitespace-nowrap">User / Type</th>
                      <th className="px-3.5 py-2.5 whitespace-nowrap">Branch &amp; Dept</th>
                      <th className="px-3.5 py-2.5 whitespace-nowrap">Device / Alias</th>
                      <th className="px-3.5 py-2.5 whitespace-nowrap">Contact / MAC</th>
                      <th className="px-3.5 py-2.5 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 dark:divide-stone-800 text-xs">
                    {voucherSubmissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-stone-50/70 dark:hover:bg-stone-800/40">
                        <td className="px-3.5 py-2.5 font-mono text-[11px] text-stone-500 dark:text-stone-400 whitespace-nowrap">
                          {new Date(sub.submittedAt).toLocaleString()}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <div className="font-semibold text-stone-900 dark:text-stone-100">
                            {sub.fullName}
                          </div>
                          <div className="text-[11px] font-mono text-stone-500 dark:text-stone-400">
                            {sub.userGroup}
                            {sub.employeeNumber ? ` · ${sub.employeeNumber}` : ''}
                            {sub.voucherCode ? ` · Code: ${sub.voucherCode}` : ''}
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <div className="font-medium text-stone-800 dark:text-stone-200">
                            {sub.branchLocation || '—'}
                          </div>
                          {sub.department && (
                            <div className="text-[11px] text-stone-500 dark:text-stone-400">
                              {sub.department}
                            </div>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <div className="text-stone-800 dark:text-stone-200">{sub.deviceType}</div>
                          {sub.alias && (
                            <div className="text-[11px] font-mono text-stone-500 dark:text-stone-400">
                              {sub.alias}
                            </div>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-[11px] text-stone-600 dark:text-stone-300 whitespace-nowrap">
                          <div>{sub.phoneNumber || '—'}</div>
                          {sub.macAddress && (
                            <div className="text-[10px] text-stone-400">{sub.macAddress}</div>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setAssignEmployeeName(sub.fullName);
                                setAssignEmployeeNum(sub.employeeNumber || '');
                                setAssignDeviceType(sub.deviceType);
                              }}
                              className="px-2 py-1 rounded text-[11px] font-medium text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/50 hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors"
                            >
                              Use in Assign
                            </button>
                            {onDeleteVoucherSubmission && (
                              <button
                                type="button"
                                onClick={() => onDeleteVoucherSubmission(sub.id)}
                                className="p-1 text-stone-400 hover:text-rose-600"
                                title="Delete Submission"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {/* AnyDesk Modal */}
      <Modal
        isOpen={anydeskModalOpen}
        onClose={() => setAnydeskModalOpen(false)}
        title={editingAnydesk ? 'Edit AnyDesk Host' : 'Add AnyDesk Remote Host'}
        maxWidthClass="max-w-md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSaveAnydesk({
              id: editingAnydesk ? editingAnydesk.id : generateUid('ad'),
              ...adForm,
            });
            setAnydeskModalOpen(false);
          }}
          className="space-y-3.5"
        >
          <div>
            <label className="block text-xs font-medium mb-1">AnyDesk ID / Address *</label>
            <input
              type="text"
              required
              value={adForm.anydeskId}
              onChange={(e) => setAdForm({ ...adForm, anydeskId: e.target.value })}
              placeholder="412889501"
              className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Server / PC Name *</label>
            <input
              type="text"
              required
              value={adForm.serverOrPcName}
              onChange={(e) => setAdForm({ ...adForm, serverOrPcName: e.target.value })}
              placeholder="BIS main tanza server"
              className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Branch Description</label>
            <input
              type="text"
              value={adForm.branchDescription}
              onChange={(e) => setAdForm({ ...adForm, branchDescription: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1">Category / Status</label>
              <input
                type="text"
                value={adForm.categoryStatus}
                onChange={(e) => setAdForm({ ...adForm, categoryStatus: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-xs pt-5 cursor-pointer">
              <input
                type="checkbox"
                checked={adForm.isFavorite}
                onChange={(e) => setAdForm({ ...adForm, isFavorite: e.target.checked })}
              />
              <span>Favorite</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-stone-200 dark:border-stone-800">
            <button
              type="button"
              onClick={() => setAnydeskModalOpen(false)}
              className="px-4 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700"
            >
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-xs rounded-lg bg-orange-600 hover:bg-orange-700 text-white">
              Save Host
            </button>
          </div>
        </form>
      </Modal>

      {/* CCTV Modal */}
      <Modal
        isOpen={cctvModalOpen}
        onClose={() => setCctvModalOpen(false)}
        title={editingCctv ? 'Edit Camera IP' : 'Add CCTV Camera IP'}
        maxWidthClass="max-w-md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSaveCctv({
              id: editingCctv ? editingCctv.id : generateUid('cam'),
              ...cctvForm,
            });
            setCctvModalOpen(false);
          }}
          className="space-y-3.5"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Branch</label>
              <select
                value={cctvForm.branch}
                onChange={(e) => setCctvForm({ ...cctvForm, branch: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950"
              >
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Camera No *</label>
              <input
                type="text"
                required
                value={cctvForm.cameraNo}
                onChange={(e) => setCctvForm({ ...cctvForm, cameraNo: e.target.value })}
                placeholder="D1"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">IP Address *</label>
            <input
              type="text"
              required
              value={cctvForm.ipAddress}
              onChange={(e) => setCctvForm({ ...cctvForm, ipAddress: e.target.value })}
              placeholder="192.168.110.11"
              className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Location / Area</label>
            <input
              type="text"
              value={cctvForm.locationArea}
              onChange={(e) => setCctvForm({ ...cctvForm, locationArea: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Ping / Status Notes</label>
            <input
              type="text"
              value={cctvForm.statusNotes}
              onChange={(e) => setCctvForm({ ...cctvForm, statusNotes: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-stone-200 dark:border-stone-800">
            <button
              type="button"
              onClick={() => setCctvModalOpen(false)}
              className="px-4 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700"
            >
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-xs rounded-lg bg-orange-600 hover:bg-orange-700 text-white">
              Save Camera
            </button>
          </div>
        </form>
      </Modal>

      {/* Radio Modal */}
      <Modal
        isOpen={radioModalOpen}
        onClose={() => setRadioModalOpen(false)}
        title={editingRadio ? 'Edit Radio Assignment' : 'Add Radio Callsign'}
        maxWidthClass="max-w-md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSaveRadio({
              id: editingRadio ? editingRadio.id : generateUid('rad'),
              ...radioForm,
            });
            setRadioModalOpen(false);
          }}
          className="space-y-3.5"
        >
          <div>
            <label className="block text-xs font-medium mb-1">Personnel / Unit *</label>
            <input
              type="text"
              required
              value={radioForm.personnelOrUnit}
              onChange={(e) => setRadioForm({ ...radioForm, personnelOrUnit: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Dept / Role</label>
              <input
                type="text"
                value={radioForm.departmentRole}
                onChange={(e) => setRadioForm({ ...radioForm, departmentRole: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Callsign *</label>
              <input
                type="text"
                required
                value={radioForm.callsign}
                onChange={(e) => setRadioForm({ ...radioForm, callsign: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Channel #</label>
              <input
                type="text"
                value={radioForm.channelNo}
                onChange={(e) => setRadioForm({ ...radioForm, channelNo: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Notes</label>
            <input
              type="text"
              value={radioForm.notes}
              onChange={(e) => setRadioForm({ ...radioForm, notes: e.target.value })}
              placeholder="e.g. 2 Radio"
              className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-stone-200 dark:border-stone-800">
            <button
              type="button"
              onClick={() => setRadioModalOpen(false)}
              className="px-4 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700"
            >
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-xs rounded-lg bg-orange-600 hover:bg-orange-700 text-white">
              Save Callsign
            </button>
          </div>
        </form>
      </Modal>

      {/* Authorized Device Modal */}
      <Modal
        isOpen={authDeviceModalOpen}
        onClose={() => setAuthDeviceModalOpen(false)}
        title={editingAuthDevice ? 'Edit Authorized Employee' : 'Add Authorized Employee Wi-Fi Quota'}
        maxWidthClass="max-w-md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSaveAuthorizedDevice({
              id: editingAuthDevice ? editingAuthDevice.id : generateUid('wad'),
              ...authForm,
            });
            setAuthDeviceModalOpen(false);
          }}
          className="space-y-3.5"
        >
          <div>
            <label className="block text-xs font-medium mb-1">Employee Name *</label>
            <input
              type="text"
              required
              value={authForm.employeeName}
              onChange={(e) => setAuthForm({ ...authForm, employeeName: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Allowed Qty</label>
              <input
                type="number"
                min={1}
                value={authForm.allowedQty}
                onChange={(e) =>
                  setAuthForm({ ...authForm, allowedQty: Number(e.target.value) || 1 })
                }
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Department</label>
              <input
                type="text"
                value={authForm.department ?? ''}
                onChange={(e) => setAuthForm({ ...authForm, department: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Device Breakdown *</label>
            <input
              type="text"
              required
              value={authForm.deviceBreakdown}
              onChange={(e) => setAuthForm({ ...authForm, deviceBreakdown: e.target.value })}
              placeholder="1 Laptop, 1 Personal, 1 Company"
              className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-stone-200 dark:border-stone-800">
            <button
              type="button"
              onClick={() => setAuthDeviceModalOpen(false)}
              className="px-4 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700"
            >
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-xs rounded-lg bg-orange-600 hover:bg-orange-700 text-white">
              Save Policy
            </button>
          </div>
        </form>
      </Modal>

      <CsvImportModal
        isOpen={isCsvOpen}
        onClose={() => setIsCsvOpen(false)}
        title={
          subTab === 'anydesk'
            ? 'Import AnyDesk Directory CSV'
            : subTab === 'cctv'
            ? 'Import CCTV IP Directory CSV'
            : subTab === 'radio'
            ? 'Import Radio Callsigns CSV'
            : 'Bulk Upload Wi-Fi Vouchers or Authorized Devices CSV'
        }
        description="Paste or upload CSV rows matching this directory's columns."
        sampleHeaders={
          subTab === 'anydesk'
            ? ['AnyDesk ID / Address', 'Server / PC Name', 'Branch Description', 'Category / Status', 'Favorite']
            : subTab === 'cctv'
            ? ['Branch', 'Camera No', 'IP Address', 'Location / Area', 'Ping / Status Notes']
            : subTab === 'radio'
            ? ['Personnel / Unit', 'Department / Role', 'Callsign', 'Channel #', 'Notes']
            : ['Date', 'Voucher Code', 'Employee Name', 'Employee #', 'Device Type', 'Status']
        }
        sampleRow={
          subTab === 'anydesk'
            ? ['551908321', 'Bulacan Backup Server', 'Bulacan — Local Sync Node', 'Server', 'No']
            : subTab === 'cctv'
            ? ['Conchu', 'D5', '192.168.110.15', 'Exit Gate', 'Online · 4MP Bullet']
            : subTab === 'radio'
            ? ['Warehouse Supervisor', 'Warehouse', 'Tango', 'CH 07', '2 Radio']
            : ['2026-11-15', '84920-1190', '', '', 'Company Laptop', 'Available']
        }
        onImportRows={handleImportCsv}
      />

      {/* Add Available Wi-Fi Vouchers Modal */}
      <Modal
        isOpen={voucherModalOpen}
        onClose={() => setVoucherModalOpen(false)}
        title="Add Available Wi-Fi Vouchers"
        subtitle="Enter one or more voucher codes (one per line or comma-separated) to stock them as Available."
        maxWidthClass="max-w-md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const codes = newVoucherCodesText
              .split(/[\n,;]+/)
              .map((s) => s.trim())
              .filter(Boolean);
            if (codes.length === 0) return;
            const today = new Date().toISOString().slice(0, 10);
            const items: WifiVoucher[] = codes.map((code) => ({
              id: generateUid('wv'),
              date: today,
              voucherCode: code,
              employeeName: '',
              employeeNumber: '',
              deviceType: newVoucherDeviceType,
              status: 'Available',
            }));
            onBulkImportVouchers(items);
            setVoucherModalOpen(false);
          }}
          className="space-y-3.5"
        >
          <div>
            <label className="block text-xs font-medium mb-1">
              Voucher Code(s) *
            </label>
            <textarea
              required
              rows={4}
              value={newVoucherCodesText}
              onChange={(e) => setNewVoucherCodesText(e.target.value)}
              placeholder={'84920-1188\n84920-1189\n84920-1190'}
              className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Default Device Type
            </label>
            <select
              value={newVoucherDeviceType}
              onChange={(e) => setNewVoucherDeviceType(e.target.value as VoucherDeviceType)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
            >
              <option value="Company Laptop">Company Laptop</option>
              <option value="Company Phone">Company Phone</option>
              <option value="Personal Phone">Personal Phone</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-stone-200 dark:border-stone-800">
            <button
              type="button"
              onClick={() => setVoucherModalOpen(false)}
              className="px-4 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-orange-600 hover:bg-orange-700 text-white"
            >
              Add Available Vouchers
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
