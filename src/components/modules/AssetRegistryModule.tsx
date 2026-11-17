import React, { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  QrCode,
  Download,
  Upload,
  Pencil,
  Trash2,
  CalendarClock,
  Layers,
  Package,
  Smartphone,
} from 'lucide-react';
import {
  Asset,
  AssetBundle,
  AssetCategory,
  AssetCondition,
  GoogleSheetLink,
  GoogleSheetTargetModule,
  MaintenanceTask,
  OperationalStatus,
  Quarter,
  Technician,
} from '../../types/cmms';
import {
  BRANCHES,
  CATEGORIES,
  CONDITIONS,
  DEFAULT_CHECKLIST,
  OPERATIONAL_STATUSES,
  QUARTERS,
  TECHNICIANS,
} from '../../data/seedData';
import { StatusBadge } from '../ui/StatusBadge';
import { Modal } from '../ui/Modal';
import { ModuleGoogleSheetsBar } from '../ui/ModuleGoogleSheetsBar';
import { AssetLabelModal } from '../modals/AssetLabelModal';
import { AssetBundleBuilderModal } from '../modals/AssetBundleBuilderModal';
import { BundleLabelModal } from '../modals/BundleLabelModal';
import { CsvImportModal } from '../modals/CsvImportModal';
import { exportToCsv, generateUid, pickField } from '../../utils/csv';
import { countBundleTotalItems } from '../../utils/assetBundles';

interface AssetRegistryModuleProps {
  assets: Asset[];
  maintenanceTasks: MaintenanceTask[];
  assetBundles: AssetBundle[];
  initialBranchFilter?: string;
  initialViewMode?: 'inventory' | 'schedule' | 'bundles';
  onViewModeChange?: (mode: 'inventory' | 'schedule' | 'bundles') => void;
  googleSheetLinks: GoogleSheetLink[];
  onAddSheetLink: (defaultTarget: GoogleSheetTargetModule) => void;
  onEditSheetLink: (link: GoogleSheetLink) => void;
  onSaveAsset: (asset: Asset) => void;
  onDeleteAsset: (assetId: string) => void;
  onSaveBundle: (bundle: AssetBundle) => void;
  onDeleteBundle: (bundleId: string) => void;
  onPreviewScannedBundle: (bundle: AssetBundle) => void;
  onBulkImportAssetsAndPm: (
    newAssets: Asset[],
    newTasks: MaintenanceTask[]
  ) => void;
  onOpenMaintenanceForAsset: (assetCode: string) => void;
}

const EMPTY_ASSET: Omit<Asset, 'id'> = {
  equipmentName: '',
  assetCode: '',
  serialNumber: '',
  category: 'Computer',
  brand: '',
  model: '',
  specification: '',
  branchLocation: 'Main',
  assignedTo: '',
  condition: 'GOOD',
  operationalStatus: 'OPERATIONAL',
  lastMaintenanceDate: '',
  notes: '',
};

export const AssetRegistryModule: React.FC<AssetRegistryModuleProps> = ({
  assets,
  maintenanceTasks,
  assetBundles,
  initialBranchFilter = 'ALL',
  initialViewMode = 'inventory',
  onViewModeChange,
  googleSheetLinks,
  onAddSheetLink,
  onEditSheetLink,
  onSaveAsset,
  onDeleteAsset,
  onSaveBundle,
  onDeleteBundle,
  onPreviewScannedBundle,
  onBulkImportAssetsAndPm,
  onOpenMaintenanceForAsset,
}) => {
  const [viewMode, setViewModeState] = useState<'inventory' | 'schedule' | 'bundles'>(
    initialViewMode
  );
  const setViewMode = (mode: 'inventory' | 'schedule' | 'bundles') => {
    setViewModeState(mode);
    onViewModeChange?.(mode);
  };

  React.useEffect(() => {
    setViewModeState(initialViewMode);
  }, [initialViewMode]);
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState(initialBranchFilter);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [conditionFilter, setConditionFilter] = useState('ALL');

  const [labelAsset, setLabelAsset] = useState<Asset | null>(null);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formState, setFormState] = useState<Omit<Asset, 'id'>>(EMPTY_ASSET);
  const [isCsvOpen, setIsCsvOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Computer Set Bundles state
  const [bundleBuilderOpen, setBundleBuilderOpen] = useState(false);
  const [editingBundle, setEditingBundle] = useState<AssetBundle | null>(null);
  const [labelBundle, setLabelBundle] = useState<AssetBundle | null>(null);
  const [confirmDeleteBundleId, setConfirmDeleteBundleId] = useState<string | null>(null);

  // Sync external branch click from dashboard
  React.useEffect(() => {
    if (initialBranchFilter) {
      setBranchFilter(initialBranchFilter);
    }
  }, [initialBranchFilter]);

  const branchOptions = useMemo(() => {
    return Array.from(new Set([...BRANCHES, ...assets.map((a) => a.branchLocation).filter(Boolean)]));
  }, [assets]);

  const filteredAssets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return assets.filter((a) => {
      if (branchFilter !== 'ALL' && a.branchLocation !== branchFilter) return false;
      if (categoryFilter !== 'ALL' && a.category !== categoryFilter) return false;
      if (statusFilter !== 'ALL' && a.operationalStatus !== statusFilter) return false;
      if (conditionFilter !== 'ALL' && a.condition !== conditionFilter) return false;
      if (!q) return true;
      return (
        a.equipmentName.toLowerCase().includes(q) ||
        a.assetCode.toLowerCase().includes(q) ||
        a.serialNumber.toLowerCase().includes(q) ||
        a.brand.toLowerCase().includes(q) ||
        a.model.toLowerCase().includes(q) ||
        a.assignedTo.toLowerCase().includes(q) ||
        a.specification.toLowerCase().includes(q)
      );
    });
  }, [assets, searchQuery, branchFilter, categoryFilter, statusFilter, conditionFilter]);

  const filteredBundles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return assetBundles.filter((b) => {
      if (branchFilter !== 'ALL' && b.branchLocation !== branchFilter) return false;
      if (!q) return true;
      const inReg = b.registryAssets.some(
        (r) =>
          r.assetCode.toLowerCase().includes(q) ||
          r.equipmentName.toLowerCase().includes(q) ||
          r.serialNumber.toLowerCase().includes(q)
      );
      const inAcc = b.accessories.some(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q) ||
          (a.brandModel || '').toLowerCase().includes(q)
      );
      return (
        b.bundleCode.toLowerCase().includes(q) ||
        b.bundleName.toLowerCase().includes(q) ||
        b.assigneeName.toLowerCase().includes(q) ||
        (b.department || '').toLowerCase().includes(q) ||
        b.branchLocation.toLowerCase().includes(q) ||
        inReg ||
        inAcc
      );
    });
  }, [assetBundles, searchQuery, branchFilter]);

  const latestTaskYear = useMemo(() => {
    const years = maintenanceTasks.map((t) => t.year).filter(Boolean);
    return years.length > 0 ? Math.max(...years) : null;
  }, [maintenanceTasks]);

  const tasksByAssetAndQuarter = useMemo(() => {
    const map = new Map<string, Record<Quarter, MaintenanceTask | undefined>>();
    for (const asset of assets) {
      const matching = maintenanceTasks
        .filter(
          (t) =>
            t.assetId === asset.id ||
            (asset.assetCode && t.assetCode.toLowerCase() === asset.assetCode.toLowerCase())
        )
        .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
      map.set(asset.id, {
        Q1: matching.find((t) => t.quarter === 'Q1'),
        Q2: matching.find((t) => t.quarter === 'Q2'),
        Q3: matching.find((t) => t.quarter === 'Q3'),
        Q4: matching.find((t) => t.quarter === 'Q4'),
      });
    }
    return map;
  }, [assets, maintenanceTasks]);

  const openAddModal = () => {
    setEditingAsset(null);
    setFormState(EMPTY_ASSET);
    setIsAddOpen(true);
  };

  const openEditModal = (asset: Asset) => {
    setEditingAsset(asset);
    const { id: _ignored, ...rest } = asset;
    setFormState(rest);
    setIsAddOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.equipmentName.trim() || !formState.assetCode.trim()) return;
    const saved: Asset = {
      id: editingAsset ? editingAsset.id : generateUid('ast'),
      ...formState,
      equipmentName: formState.equipmentName.trim(),
      assetCode: formState.assetCode.trim(),
      serialNumber: formState.serialNumber.trim(),
    };
    onSaveAsset(saved);
    setIsAddOpen(false);
  };

  const handleExportCsv = () => {
    exportToCsv(
      `tristellar-it-master-assets-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: 'equipmentName', label: 'Equipment Name' },
        { key: 'assetCode', label: 'Asset Code' },
        { key: 'serialNumber', label: 'Serial Number' },
        { key: 'category', label: 'Category' },
        { key: 'brand', label: 'Brand' },
        { key: 'model', label: 'Model' },
        { key: 'specification', label: 'Specification' },
        { key: 'branchLocation', label: 'Branch Location' },
        { key: 'assignedTo', label: 'Assigned To / Bound To' },
        { key: 'condition', label: 'Condition' },
        { key: 'operationalStatus', label: 'Operational Status' },
        { key: 'lastMaintenanceDate', label: 'Last Maintenance Date' },
        { key: 'notes', label: 'Notes / Remarks' },
      ],
      filteredAssets
    );
  };

  const handleImportCsvRows = (rows: Record<string, string>[], headers: string[]) => {
    const normalizedHeaders = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const looksLikeMaintenanceReport =
      normalizedHeaders.includes('quarter') ||
      normalizedHeaders.includes('technician') ||
      normalizedHeaders.includes('actualdate') ||
      normalizedHeaders.includes('pmstatus');

    const assetsToUpsert: Asset[] = [];
    const tasksToUpsert: MaintenanceTask[] = [];
    const existingByCode = new Map(
      assets.filter((a) => a.assetCode).map((a) => [a.assetCode.toLowerCase(), a])
    );
    const existingBySerial = new Map(
      assets.filter((a) => a.serialNumber).map((a) => [a.serialNumber.toLowerCase(), a])
    );

    for (const row of rows) {
      const equipmentName =
        pickField(row, ['Equipment Name', 'Equipment', 'Name', 'Asset Name']) ||
        'Unnamed Equipment';
      const assetCode =
        pickField(row, ['Asset Code', 'Code', 'Asset Tag', 'Tag']) ||
        `IMP-${Math.floor(10000 + Math.random() * 89999)}`;
      const serialNumber = pickField(row, ['Serial Number', 'Serial No', 'Serial', 'SN']);
      const rawCat = pickField(row, ['Category', 'Type']);
      const category: AssetCategory =
        rawCat.toLowerCase().includes('print')
          ? 'Printer'
          : rawCat.toLowerCase().includes('periph') ||
            rawCat.toLowerCase().includes('switch') ||
            rawCat.toLowerCase().includes('ups') ||
            rawCat.toLowerCase().includes('scanner')
          ? 'Peripherals'
          : 'Computer';
      const brand = pickField(row, ['Brand', 'Manufacturer']);
      const model = pickField(row, ['Model']);
      const specification = pickField(row, ['Specification', 'Specs', 'Spec']);
      const branchLocation =
        pickField(row, ['Branch Location', 'Branch', 'Location']) || 'Main';
      const assignedTo = pickField(row, [
        'Assigned To / Bound To',
        'Assigned To',
        'Bound To',
        'User',
      ]);
      const rawCond = pickField(row, ['Condition']).toUpperCase();
      const condition: AssetCondition = (
        CONDITIONS.includes(rawCond as AssetCondition) ? rawCond : 'GOOD'
      ) as AssetCondition;

      const rawStatus = pickField(row, ['Operational Status', 'Op Status']).toUpperCase();
      const operationalStatus: OperationalStatus = (
        OPERATIONAL_STATUSES.includes(rawStatus as OperationalStatus)
          ? rawStatus
          : 'OPERATIONAL'
      ) as OperationalStatus;

      const lastMaintenanceDate = pickField(row, [
        'Last Maintenance Date',
        'Last PM',
        'Actual Date',
      ]);
      const notes = pickField(row, ['Notes / Remarks', 'Notes', 'Remarks']);

      // Match ONLY on unique Asset Code or Serial Number, NEVER on duplicate Equipment Name
      const matched =
        existingByCode.get(assetCode.toLowerCase()) ||
        (serialNumber ? existingBySerial.get(serialNumber.toLowerCase()) : undefined);

      const assetId = matched ? matched.id : generateUid('ast');
      const assetRecord: Asset = {
        id: assetId,
        equipmentName,
        assetCode,
        serialNumber: serialNumber || matched?.serialNumber || '',
        category: matched && !rawCat ? matched.category : category,
        brand: brand || matched?.brand || '',
        model: model || matched?.model || '',
        specification: specification || matched?.specification || '',
        branchLocation: branchLocation || matched?.branchLocation || 'Main',
        assignedTo: assignedTo || matched?.assignedTo || '',
        condition,
        operationalStatus,
        lastMaintenanceDate: lastMaintenanceDate || matched?.lastMaintenanceDate || '',
        notes: notes || matched?.notes || '',
      };

      assetsToUpsert.push(assetRecord);
      existingByCode.set(assetCode.toLowerCase(), assetRecord);
      if (assetRecord.serialNumber) {
        existingBySerial.set(assetRecord.serialNumber.toLowerCase(), assetRecord);
      }

      if (looksLikeMaintenanceReport) {
        const rawQ = pickField(row, ['Quarter', 'Qtr']).toUpperCase();
        const quarter: Quarter = (QUARTERS.includes(rawQ as Quarter) ? rawQ : 'Q4') as Quarter;
        const rawTech = pickField(row, ['Technician', 'Tech', 'Assigned Tech']);
        const technician: Technician =
          TECHNICIANS.find((t) => t.toLowerCase() === rawTech.toLowerCase()) ?? 'Mac';
        const actualDate = pickField(row, ['Actual Date', 'Completed Date', 'Date']);
        const scheduledDate =
          pickField(row, ['Scheduled Date', 'Schedule']) || actualDate || new Date().toISOString().slice(0, 10);
        const rawPmStatus = pickField(row, ['PM Status', 'Status']);
        const pmStatus = rawPmStatus.toLowerCase().includes('done') || Boolean(actualDate)
          ? 'Done'
          : 'Pending';

        tasksToUpsert.push({
          id: generateUid('pm'),
          assetId,
          assetCode: assetRecord.assetCode,
          equipmentName: assetRecord.equipmentName,
          branchLocation: assetRecord.branchLocation,
          quarter,
          year: new Date().getFullYear(),
          technician,
          scheduledDate,
          actualDate,
          status: pmStatus,
          checklistItems: DEFAULT_CHECKLIST.map((c) => ({
            ...c,
            checked: pmStatus === 'Done',
          })),
          remarks: notes || 'Imported from Maintenance Report CSV',
          resultCondition: condition,
          setAssetStatusTo: operationalStatus,
        });
      }
    }

    onBulkImportAssetsAndPm(assetsToUpsert, tasksToUpsert);
    return {
      importedCount: assetsToUpsert.length,
      summary: looksLikeMaintenanceReport
        ? `Imported ${assetsToUpsert.length} assets and ${tasksToUpsert.length} maintenance records (duplicate equipment names preserved by Asset Code/Serial).`
        : `Imported ${assetsToUpsert.length} master assets cleanly (duplicate equipment names preserved by Asset Code/Serial).`,
    };
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Equipment &amp; Master Asset Registry
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5 tabular-nums">
            {viewMode === 'bundles'
              ? `Showing ${filteredBundles.length} of ${assetBundles.length} bundled computer sets with QR & barcode tags`
              : `Showing ${filteredAssets.length} of ${assets.length} tracked IT assets across branches`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-stone-100 dark:bg-stone-800 rounded-lg border border-stone-200/70 dark:border-stone-700">
            <button
              type="button"
              onClick={() => setViewMode('inventory')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'inventory'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Master Inventory View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('schedule')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'schedule'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <CalendarClock className="w-3.5 h-3.5" />
              <span>Maintenance Schedule View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('bundles')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'bundles'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Issued Sets &amp; Bundles</span>
              <span className="font-mono text-[11px] tabular-nums text-stone-500 dark:text-stone-400">
                ({assetBundles.length})
              </span>
            </button>
          </div>

          {viewMode === 'bundles' ? (
            <button
              type="button"
              onClick={() => {
                setEditingBundle(null);
                setBundleBuilderOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Computer Set</span>
            </button>
          ) : (
            <>
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
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Asset</span>
              </button>
            </>
          )}

          <ModuleGoogleSheetsBar
            links={googleSheetLinks}
            moduleTarget="assets"
            onAddLink={onAddSheetLink}
            onEditLink={onEditSheetLink}
          />
        </div>
      </div>

      {/* Multi-column filter bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 p-3.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
        <div className="lg:col-span-2 relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by name, asset code, serial, assignee..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
          />
        </div>

        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          aria-label="Filter by Branch"
          className="px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
        >
          <option value="ALL">All Branches</option>
          {branchOptions.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filter by Category"
          className="px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
        >
          <option value="ALL">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by Operational Status"
          className="px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
        >
          <option value="ALL">All Statuses</option>
          {OPERATIONAL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={conditionFilter}
          onChange={(e) => setConditionFilter(e.target.value)}
          aria-label="Filter by Condition"
          className="px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
        >
          <option value="ALL">All Conditions</option>
          {CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Data Table */}
      {viewMode === 'bundles' ? (
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
          {filteredBundles.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                No matching computer set bundles found
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Create a computer set bundle combining a PC, monitor, keyboard, mouse, and UPS to generate a scannable QR &amp; barcode sticker.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingBundle(null);
                    setBundleBuilderOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Computer Set</span>
                </button>
                {(searchQuery || branchFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setBranchFilter('ALL');
                    }}
                    className="px-4 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                    <th className="px-4 py-3 whitespace-nowrap">Bundle Code</th>
                    <th className="px-4 py-3 whitespace-nowrap">Issued To &amp; Set Name</th>
                    <th className="px-4 py-3 whitespace-nowrap">Branch</th>
                    <th className="px-4 py-3 whitespace-nowrap">Bundled Equipment &amp; Peripherals</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Items</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">QR / Barcode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 dark:divide-stone-800 text-xs">
                  {filteredBundles.map((bundle) => {
                    const totalItems = countBundleTotalItems(bundle);
                    const isConfirming = confirmDeleteBundleId === bundle.id;
                    return (
                      <tr
                        key={bundle.id}
                        className="hover:bg-stone-50/80 dark:hover:bg-stone-800/40 transition-colors"
                      >
                        <td className="px-4 py-3 align-top whitespace-nowrap">
                          <div className="font-mono font-bold tabular-nums text-orange-600 dark:text-orange-400">
                            {bundle.bundleCode}
                          </div>
                          <div className="font-mono text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 tabular-nums">
                            {bundle.issuedDate || '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top min-w-[190px]">
                          <div className="font-semibold text-stone-900 dark:text-stone-100">
                            {bundle.assigneeName}
                          </div>
                          <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                            {bundle.bundleName}
                            {bundle.department ? ` · ${bundle.department}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top whitespace-nowrap font-medium text-stone-800 dark:text-stone-200">
                          {bundle.branchLocation}
                        </td>
                        <td className="px-4 py-3 align-top min-w-[260px] max-w-[440px]">
                          <div className="space-y-1">
                            {bundle.registryAssets.length > 0 && (
                              <p className="text-xs text-stone-800 dark:text-stone-200 font-medium">
                                {bundle.registryAssets
                                  .map((r) => `[${r.assetCode}] ${r.equipmentName}`)
                                  .join(' · ')}
                              </p>
                            )}
                            {bundle.accessories.length > 0 && (
                              <p className="text-[11px] text-stone-500 dark:text-stone-400 font-mono">
                                {bundle.accessories
                                  .map(
                                    (a) =>
                                      `${Math.max(1, Number(a.quantity) || 1)}x ${a.name}`
                                  )
                                  .join(' · ')}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top text-right whitespace-nowrap font-mono font-bold tabular-nums text-stone-900 dark:text-stone-100">
                          {totalItems}
                        </td>
                        <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            {isConfirming ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteBundle(bundle.id);
                                    setConfirmDeleteBundleId(null);
                                  }}
                                  className="px-2.5 py-1.5 text-[11px] font-semibold rounded-md bg-rose-600 text-white hover:bg-rose-700"
                                >
                                  Remove
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteBundleId(null)}
                                  className="px-2 py-1.5 text-[11px] font-medium rounded-md border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setLabelBundle(bundle)}
                                  title="Generate QR & Barcode Sticker"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                                >
                                  <QrCode className="w-3.5 h-3.5" />
                                  <span>QR &amp; Barcode</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onPreviewScannedBundle(bundle)}
                                  title="Preview Mobile Issued Page"
                                  aria-label={`Preview mobile view for ${bundle.bundleCode}`}
                                  className="p-1.5 rounded-md text-stone-500 hover:text-orange-600 hover:bg-orange-50 dark:text-stone-400 dark:hover:text-orange-400 dark:hover:bg-orange-950/40 transition-colors"
                                >
                                  <Smartphone className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingBundle(bundle);
                                    setBundleBuilderOpen(true);
                                  }}
                                  title="Edit Computer Set"
                                  aria-label={`Edit ${bundle.bundleCode}`}
                                  className="p-1.5 rounded-md text-stone-500 hover:text-stone-900 hover:bg-stone-100 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-800 transition-colors"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteBundleId(bundle.id)}
                                  title="Delete Bundle"
                                  aria-label={`Delete ${bundle.bundleCode}`}
                                  className="p-1.5 rounded-md text-stone-500 hover:text-rose-600 hover:bg-rose-50 dark:text-stone-400 dark:hover:text-rose-400 dark:hover:bg-rose-950/40 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
        {filteredAssets.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              No matching assets found
            </p>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Try clearing your filters or add a new equipment unit to the master registry.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setBranchFilter('ALL');
                setCategoryFilter('ALL');
                setStatusFilter('ALL');
                setConditionFilter('ALL');
              }}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {viewMode === 'inventory' ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                    <th className="px-4 py-3 whitespace-nowrap">Asset Code</th>
                    <th className="px-4 py-3 whitespace-nowrap">Equipment &amp; Spec</th>
                    <th className="px-4 py-3 whitespace-nowrap">Category / Brand</th>
                    <th className="px-4 py-3 whitespace-nowrap">Branch / Assigned To</th>
                    <th className="px-4 py-3 whitespace-nowrap">Condition</th>
                    <th className="px-4 py-3 whitespace-nowrap">Operational Status</th>
                    <th className="px-4 py-3 whitespace-nowrap">Last PM</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 dark:divide-stone-800 text-xs">
                  {filteredAssets.map((asset) => (
                    <tr
                      key={asset.id}
                      className="hover:bg-stone-50/80 dark:hover:bg-stone-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <div className="font-mono font-semibold tabular-nums text-stone-900 dark:text-stone-100">
                          {asset.assetCode}
                        </div>
                        <div className="font-mono text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                          SN: {asset.serialNumber || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top min-w-[230px] max-w-[300px]">
                        <div className="font-semibold text-stone-900 dark:text-stone-100">
                          {asset.equipmentName}
                        </div>
                        <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 line-clamp-2">
                          {asset.specification || asset.notes || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <div className="font-medium text-stone-800 dark:text-stone-200">
                          {asset.category}
                        </div>
                        <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                          {[asset.brand, asset.model].filter(Boolean).join(' ') || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top min-w-[170px]">
                        <div className="font-medium text-stone-900 dark:text-stone-100">
                          {asset.branchLocation}
                        </div>
                        <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                          {asset.assignedTo || 'Unassigned'}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <StatusBadge value={asset.condition} />
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <StatusBadge value={asset.operationalStatus} />
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap font-mono tabular-nums text-stone-600 dark:text-stone-300">
                        {asset.lastMaintenanceDate || '—'}
                      </td>
                      <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setLabelAsset(asset)}
                            title="Generate QR & Barcode Label"
                            aria-label={`QR Label for ${asset.assetCode}`}
                            className="p-1.5 rounded-md text-stone-500 hover:text-orange-600 hover:bg-orange-50 dark:text-stone-400 dark:hover:text-orange-400 dark:hover:bg-orange-950/40 transition-colors"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(asset)}
                            title="Edit Asset"
                            aria-label={`Edit ${asset.assetCode}`}
                            className="p-1.5 rounded-md text-stone-500 hover:text-stone-900 hover:bg-stone-100 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-800 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirmDeleteId === asset.id) {
                                onDeleteAsset(asset.id);
                                setConfirmDeleteId(null);
                              } else {
                                setConfirmDeleteId(asset.id);
                              }
                            }}
                            title={
                              confirmDeleteId === asset.id
                                ? 'Click again to confirm delete'
                                : 'Delete Asset'
                            }
                            aria-label={`Delete ${asset.assetCode}`}
                            className={`p-1.5 rounded-md transition-colors ${
                              confirmDeleteId === asset.id
                                ? 'bg-rose-600 text-white'
                                : 'text-stone-500 hover:text-rose-600 hover:bg-rose-50 dark:text-stone-400 dark:hover:text-rose-400 dark:hover:bg-rose-950/40'
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
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                    <th className="px-4 py-3 whitespace-nowrap">Asset Code</th>
                    <th className="px-4 py-3 whitespace-nowrap">Equipment Name</th>
                    <th className="px-4 py-3 whitespace-nowrap">Branch</th>
                    <th className="px-4 py-3 whitespace-nowrap">Status</th>
                    {QUARTERS.map((q) => {
                      const hasPending = maintenanceTasks.some(
                        (t) =>
                          t.quarter === q &&
                          t.status === 'Pending' &&
                          (latestTaskYear === null || t.year === latestTaskYear)
                      );
                      return (
                        <th
                          key={q}
                          className={`px-4 py-3 whitespace-nowrap ${
                            hasPending
                              ? 'text-rose-700 dark:text-rose-300 bg-rose-50/90 dark:bg-rose-950/40'
                              : ''
                          }`}
                        >
                          {q}
                          {hasPending && (
                            <span className="ml-1 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                              •
                            </span>
                          )}
                        </th>
                      );
                    })}
                    <th className="px-4 py-3 text-right whitespace-nowrap">PM Log</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 dark:divide-stone-800 text-xs">
                  {filteredAssets.map((asset) => {
                    const qMap = tasksByAssetAndQuarter.get(asset.id);
                    return (
                      <tr
                        key={asset.id}
                        className="hover:bg-stone-50/80 dark:hover:bg-stone-800/40 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono font-semibold tabular-nums text-stone-900 dark:text-stone-100 whitespace-nowrap">
                          {asset.assetCode}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-stone-900 dark:text-stone-100">
                            {asset.equipmentName}
                          </div>
                          <div className="text-[11px] text-stone-500 dark:text-stone-400">
                            {asset.assignedTo || 'Unassigned'}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-stone-700 dark:text-stone-300">
                          {asset.branchLocation}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StatusBadge value={asset.operationalStatus} />
                        </td>
                        {QUARTERS.map((q) => {
                          const task = qMap?.[q];
                          return (
                            <td key={q} className="px-4 py-3 whitespace-nowrap">
                              {task ? (
                                <div>
                                  <StatusBadge value={task.status} />
                                  <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 font-mono tabular-nums">
                                    {task.technician} · {task.actualDate || task.scheduledDate}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-stone-400 dark:text-stone-600">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onOpenMaintenanceForAsset(asset.assetCode)}
                            className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                          >
                            View Tasks
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
      )}

      {/* Add / Edit Asset Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title={editingAsset ? `Edit Asset · ${editingAsset.assetCode}` : 'Register New Equipment Asset'}
        subtitle="Master inventory record linked to QR labels and quarterly preventive maintenance"
        maxWidthClass="max-w-3xl"
      >
        <form onSubmit={handleSaveForm} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Equipment Name *
              </label>
              <input
                type="text"
                required
                value={formState.equipmentName}
                onChange={(e) => setFormState({ ...formState, equipmentName: e.target.value })}
                placeholder="e.g., Accounting Workstation 01"
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Asset Code *
              </label>
              <input
                type="text"
                required
                value={formState.assetCode}
                onChange={(e) => setFormState({ ...formState, assetCode: e.target.value })}
                placeholder="00541-01"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Serial Number
              </label>
              <input
                type="text"
                value={formState.serialNumber}
                onChange={(e) => setFormState({ ...formState, serialNumber: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Category
              </label>
              <select
                value={formState.category}
                onChange={(e) =>
                  setFormState({ ...formState, category: e.target.value as AssetCategory })
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Branch Location
              </label>
              <select
                value={formState.branchLocation}
                onChange={(e) => setFormState({ ...formState, branchLocation: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              >
                {branchOptions.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Brand
              </label>
              <input
                type="text"
                value={formState.brand}
                onChange={(e) => setFormState({ ...formState, brand: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Model
              </label>
              <input
                type="text"
                value={formState.model}
                onChange={(e) => setFormState({ ...formState, model: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Assigned To / Bound To
              </label>
              <input
                type="text"
                value={formState.assignedTo}
                onChange={(e) => setFormState({ ...formState, assignedTo: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
              Specification
            </label>
            <input
              type="text"
              value={formState.specification}
              onChange={(e) => setFormState({ ...formState, specification: e.target.value })}
              placeholder="CPU / RAM / Storage / Port specs"
              className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Condition
              </label>
              <select
                value={formState.condition}
                onChange={(e) =>
                  setFormState({ ...formState, condition: e.target.value as AssetCondition })
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Operational Status
              </label>
              <select
                value={formState.operationalStatus}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    operationalStatus: e.target.value as OperationalStatus,
                  })
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              >
                {OPERATIONAL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Last Maintenance Date
              </label>
              <input
                type="date"
                value={formState.lastMaintenanceDate}
                onChange={(e) =>
                  setFormState({ ...formState, lastMaintenanceDate: e.target.value })
                }
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
              Notes / Remarks
            </label>
            <textarea
              rows={2}
              value={formState.notes}
              onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-stone-200 dark:border-stone-800">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors"
            >
              {editingAsset ? 'Save Changes' : 'Register Asset'}
            </button>
          </div>
        </form>
      </Modal>

      <AssetLabelModal asset={labelAsset} onClose={() => setLabelAsset(null)} />

      <AssetBundleBuilderModal
        isOpen={bundleBuilderOpen}
        editingBundle={editingBundle}
        existingBundles={assetBundles}
        assets={assets}
        onClose={() => setBundleBuilderOpen(false)}
        onSave={onSaveBundle}
      />

      <BundleLabelModal
        bundle={labelBundle}
        onClose={() => setLabelBundle(null)}
        onPreviewMobile={(bundle) => {
          setLabelBundle(null);
          onPreviewScannedBundle(bundle);
        }}
      />

      <CsvImportModal
        isOpen={isCsvOpen}
        onClose={() => setIsCsvOpen(false)}
        title="Import Master Asset CSV or Maintenance Report CSV"
        description="Auto-detects Master Asset or PM Report headers. Duplicate Equipment Names are safely preserved using Asset Code and Serial Number."
        sampleHeaders={[
          'Equipment Name',
          'Asset Code',
          'Serial Number',
          'Category',
          'Brand',
          'Model',
          'Specification',
          'Branch Location',
          'Assigned To / Bound To',
          'Condition',
          'Operational Status',
          'Last Maintenance Date',
          'Notes / Remarks',
        ]}
        sampleRow={[
          'Dispatch Laser Printer',
          '00542-09',
          'VNB3R99120',
          'Printer',
          'HP',
          'LaserJet Pro M404dn',
          'Monochrome Duplex LAN',
          'Conchu',
          'Conchu Dispatch Desk 2',
          'GOOD',
          'OPERATIONAL',
          '2026-11-10',
          'New backup printer unit',
        ]}
        onImportRows={handleImportCsvRows}
      />
    </div>
  );
};
