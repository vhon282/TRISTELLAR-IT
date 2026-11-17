import React, { useMemo, useState } from 'react';
import {
  CheckSquare,
  Download,
  Upload,
  Plus,
  Search,
  ClipboardCheck,
  Trash2,
  CalendarDays,
  Table2,
  ChevronLeft,
  ChevronRight,
  Printer,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react';
import {
  Asset,
  AssetCondition,
  ChecklistSection,
  GoogleSheetLink,
  GoogleSheetTargetModule,
  MaintenanceChecklistItem,
  MaintenanceResetMode,
  MaintenanceResetPayload,
  MaintenanceStatus,
  MaintenanceTask,
  OperationalStatus,
  Quarter,
  Technician,
} from '../../types/cmms';
import {
  CHECKLIST_SECTIONS,
  CONDITIONS,
  DEFAULT_CHECKLIST,
  OPERATIONAL_STATUSES,
  QUARTERS,
  TECHNICIANS,
} from '../../data/seedData';
import { StatusBadge } from '../ui/StatusBadge';
import { Modal } from '../ui/Modal';
import { ModuleGoogleSheetsBar } from '../ui/ModuleGoogleSheetsBar';
import { CsvImportModal } from '../modals/CsvImportModal';
import { exportToCsv, generateUid, pickField } from '../../utils/csv';

interface PreventiveMaintenanceModuleProps {
  tasks: MaintenanceTask[];
  assets: Asset[];
  initialSearch?: string;
  googleSheetLinks: GoogleSheetLink[];
  onAddSheetLink: (defaultTarget: GoogleSheetTargetModule) => void;
  onEditSheetLink: (link: GoogleSheetLink) => void;
  onSaveTask: (task: MaintenanceTask, updateParentAsset: boolean) => void;
  onDeleteTask: (taskId: string) => void;
  onBulkImportTasks: (tasks: MaintenanceTask[]) => void;
  onResetMaintenance: (payload: MaintenanceResetPayload) => void;
}

function quarterFromDate(dateStr: string): Quarter {
  const month = Number(dateStr.split('-')[1] || 11);
  if (month <= 3) return 'Q1';
  if (month <= 6) return 'Q2';
  if (month <= 9) return 'Q3';
  return 'Q4';
}

function buildNextSeqNumber(tasks: MaintenanceTask[], quarter: Quarter, year: number): string {
  const qNum =
    quarter === 'Q1'
      ? '1ST'
      : quarter === 'Q2'
      ? '2ND'
      : quarter === 'Q3'
      ? '3RD'
      : '4TH';
  const nextIndex = tasks.length + 1;
  return `${year}${qNum}-${String(nextIndex).padStart(2, '0')}`;
}

function getTaskYear(task: MaintenanceTask): number {
  return (
    (Number.isFinite(Number(task.year)) && Number(task.year) > 1990
      ? Number(task.year)
      : 0) ||
    Number((task.scheduledDate || '').slice(0, 4)) ||
    Number((task.actualDate || '').slice(0, 4)) ||
    Number((task.seqNumber || '').slice(0, 4)) ||
    2026
  );
}

function ensureFullChecklist(items: MaintenanceChecklistItem[]): MaintenanceChecklistItem[] {
  if (items.length >= 18 && items[0]?.section) {
    return items.map((c) => ({ ...c, remarks: c.remarks ?? '' }));
  }
  return DEFAULT_CHECKLIST.map((c) => ({ ...c }));
}

export const PreventiveMaintenanceModule: React.FC<PreventiveMaintenanceModuleProps> = ({
  tasks,
  assets,
  initialSearch = '',
  googleSheetLinks,
  onAddSheetLink,
  onEditSheetLink,
  onSaveTask,
  onDeleteTask,
  onBulkImportTasks,
  onResetMaintenance,
}) => {
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [quarterFilter, setQuarterFilter] = useState<'ALL' | Quarter>('ALL');
  const [yearFilter, setYearFilter] = useState<'ALL' | number>('ALL');
  const [techFilter, setTechFilter] = useState<'ALL' | Technician>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | MaintenanceStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState(initialSearch);

  const yearOptions = useMemo(() => {
    const years = new Set<number>([2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032]);
    tasks.forEach((t) => {
      years.add(getTaskYear(t));
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [tasks]);

  // Calendar month cursor (defaults to current Nov 2026)
  const [calendarYear, setCalendarYear] = useState(2026);
  const [calendarMonth, setCalendarMonth] = useState(10); // 0-indexed (10 = November)

  const [loggingTask, setLoggingTask] = useState<MaintenanceTask | null>(null);
  const [printingTask, setPrintingTask] = useState<MaintenanceTask | null>(null);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [isCsvOpen, setIsCsvOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Annual Rollover & Reset modal state
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetMode, setResetMode] = useState<MaintenanceResetMode>('rollover');
  const [resetSourceYear, setResetSourceYear] = useState<'ALL' | 'FROM_ASSETS' | number>('ALL');
  const [resetTargetYear, setResetTargetYear] = useState<number>(2027);
  const [resetKeepHistory, setResetKeepHistory] = useState<boolean>(true);
  const [resetAssetDates, setResetAssetDates] = useState<boolean>(false);
  const [resetConfirmed, setResetConfirmed] = useState<boolean>(false);
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  // Sync external search (e.g., jumping from Asset Schedule View)
  React.useEffect(() => {
    if (initialSearch) {
      setSearchQuery(initialSearch);
    }
  }, [initialSearch]);

  // New Work Order form state (with full TriStell INF-SUP-PRMC-2025 checklist)
  const [newForm, setNewForm] = useState<MaintenanceTask>(() => {
    const first = assets[0];
    const today = new Date().toISOString().slice(0, 10);
    return {
      id: '',
      assetId: first?.id ?? '',
      assetCode: first?.assetCode ?? '',
      equipmentName: first?.equipmentName ?? '',
      branchLocation: first?.branchLocation ?? 'Main',
      seqNumber: buildNextSeqNumber(tasks, 'Q4', 2026),
      formCode: 'INF-SUP-PRMC-2025 / SUP-PRMC-2022-00',
      description: first ? `${first.brand} ${first.model}`.trim() || first.equipmentName : '',
      incharge: first?.assignedTo ?? '',
      position: '',
      department: '',
      quarter: 'Q4',
      year: 2026,
      technician: 'Mac',
      scheduledDate: today,
      actualDate: '',
      status: 'Pending',
      checklistItems: DEFAULT_CHECKLIST.map((c) => ({ ...c })),
      remarks: '',
      resultCondition: first?.condition ?? 'GOOD',
      setAssetStatusTo: first?.operationalStatus ?? 'OPERATIONAL',
    };
  });

  const openNewWorkOrderModal = (presetDate?: string) => {
    const dateVal = presetDate || new Date().toISOString().slice(0, 10);
    const q = quarterFromDate(dateVal);
    const yr = Number(dateVal.split('-')[0]) || 2026;
    const first = assets[0];
    setNewForm({
      id: '',
      assetId: first?.id ?? '',
      assetCode: first?.assetCode ?? '',
      equipmentName: first?.equipmentName ?? '',
      branchLocation: first?.branchLocation ?? 'Main',
      seqNumber: buildNextSeqNumber(tasks, q, yr),
      formCode: 'INF-SUP-PRMC-2025 / SUP-PRMC-2022-00',
      description: first ? `${first.brand} ${first.model}`.trim() || first.equipmentName : '',
      incharge: first?.assignedTo ?? '',
      position: '',
      department: '',
      quarter: q,
      year: yr,
      technician: techFilter !== 'ALL' ? techFilter : 'Mac',
      scheduledDate: dateVal,
      actualDate: '',
      status: 'Pending',
      checklistItems: DEFAULT_CHECKLIST.map((c) => ({ ...c })),
      remarks: '',
      resultCondition: first?.condition ?? 'GOOD',
      setAssetStatusTo: first?.operationalStatus ?? 'OPERATIONAL',
    });
    setIsNewOpen(true);
  };

  const handleSelectAssetForNewOrder = (assetId: string) => {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;
    setNewForm((prev) => ({
      ...prev,
      assetId: asset.id,
      assetCode: asset.assetCode,
      equipmentName: asset.equipmentName,
      branchLocation: asset.branchLocation,
      description: `${asset.brand} ${asset.model}`.trim() || asset.equipmentName,
      incharge: asset.assignedTo || '',
      resultCondition: asset.condition,
      setAssetStatusTo: asset.operationalStatus,
    }));
  };

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tasks.filter((t) => {
      if (quarterFilter !== 'ALL' && t.quarter !== quarterFilter) return false;
      if (yearFilter !== 'ALL' && getTaskYear(t) !== yearFilter) return false;
      if (techFilter !== 'ALL' && t.technician !== techFilter) return false;
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        t.assetCode.toLowerCase().includes(q) ||
        t.equipmentName.toLowerCase().includes(q) ||
        t.branchLocation.toLowerCase().includes(q) ||
        (t.seqNumber ?? '').toLowerCase().includes(q) ||
        (t.incharge ?? '').toLowerCase().includes(q) ||
        t.remarks.toLowerCase().includes(q) ||
        t.technician.toLowerCase().includes(q)
      );
    });
  }, [tasks, quarterFilter, yearFilter, techFilter, statusFilter, searchQuery]);

  const summary = useMemo(() => {
    const done = filteredTasks.filter((t) => t.status === 'Done').length;
    const pending = filteredTasks.filter((t) => t.status === 'Pending').length;
    const total = filteredTasks.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { done, pending, total, pct };
  }, [filteredTasks]);

  const pendingByQuarter = useMemo(() => {
    const counts: Record<Quarter, number> = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
    tasks.forEach((t) => {
      if (yearFilter !== 'ALL' && getTaskYear(t) !== yearFilter) return;
      if (t.status === 'Pending') {
        counts[t.quarter] = (counts[t.quarter] ?? 0) + 1;
      }
    });
    return counts;
  }, [tasks, yearFilter]);

  const pendingQuarterYearKeys = useMemo(() => {
    const keys = new Set<string>();
    tasks.forEach((t) => {
      if (t.status === 'Pending') {
        keys.add(`${getTaskYear(t)}-${t.quarter}`);
      }
    });
    return keys;
  }, [tasks]);

  // Calendar grid computation
  const calendarData = useMemo(() => {
    const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1);
    const startWeekday = firstDayOfMonth.getDay(); // 0 = Sun
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(calendarYear, calendarMonth, 0).getDate();

    const cells: {
      dateStr: string;
      dayNum: number;
      inCurrentMonth: boolean;
      tasks: MaintenanceTask[];
    }[] = [];

    const pad = (n: number) => String(n).padStart(2, '0');

    // Leading days from previous month
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevM = calendarMonth === 0 ? 12 : calendarMonth;
      const prevY = calendarMonth === 0 ? calendarYear - 1 : calendarYear;
      const dateStr = `${prevY}-${pad(prevM)}-${pad(d)}`;
      cells.push({
        dateStr,
        dayNum: d,
        inCurrentMonth: false,
        tasks: filteredTasks.filter((t) => (t.actualDate || t.scheduledDate) === dateStr),
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calendarYear}-${pad(calendarMonth + 1)}-${pad(d)}`;
      cells.push({
        dateStr,
        dayNum: d,
        inCurrentMonth: true,
        tasks: filteredTasks.filter((t) => (t.actualDate || t.scheduledDate) === dateStr),
      });
    }

    // Trailing days to complete 5 or 6 full weeks
    const remainder = cells.length % 7;
    if (remainder !== 0) {
      const needed = 7 - remainder;
      for (let d = 1; d <= needed; d++) {
        const nextM = calendarMonth === 11 ? 1 : calendarMonth + 2;
        const nextY = calendarMonth === 11 ? calendarYear + 1 : calendarYear;
        const dateStr = `${nextY}-${pad(nextM)}-${pad(d)}`;
        cells.push({
          dateStr,
          dayNum: d,
          inCurrentMonth: false,
          tasks: filteredTasks.filter((t) => (t.actualDate || t.scheduledDate) === dateStr),
        });
      }
    }

    const monthLabel = firstDayOfMonth.toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    return { cells, monthLabel };
  }, [calendarYear, calendarMonth, filteredTasks]);

  const handleQuickToggleStatus = (task: MaintenanceTask) => {
    const nextStatus: MaintenanceStatus = task.status === 'Done' ? 'Pending' : 'Done';
    const nextDate =
      nextStatus === 'Done'
        ? task.actualDate || new Date().toISOString().slice(0, 10)
        : '';
    const updated: MaintenanceTask = {
      ...task,
      status: nextStatus,
      actualDate: nextDate,
      checklistItems:
        nextStatus === 'Done'
          ? ensureFullChecklist(task.checklistItems).map((c) => ({ ...c, checked: true }))
          : ensureFullChecklist(task.checklistItems),
    };
    onSaveTask(updated, nextStatus === 'Done');
  };

  const handleSaveLoggingModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggingTask) return;
    const finalized: MaintenanceTask = {
      ...loggingTask,
      actualDate:
        loggingTask.status === 'Done'
          ? loggingTask.actualDate || new Date().toISOString().slice(0, 10)
          : loggingTask.actualDate,
    };
    onSaveTask(finalized, true);
    setLoggingTask(null);
  };

  const handleCreateWorkOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.assetCode.trim() && !newForm.equipmentName.trim()) return;

    const created: MaintenanceTask = {
      ...newForm,
      id: generateUid('pm'),
      actualDate:
        newForm.status === 'Done'
          ? newForm.actualDate || new Date().toISOString().slice(0, 10)
          : newForm.actualDate,
    };
    onSaveTask(created, newForm.status === 'Done');
    setIsNewOpen(false);
  };

  const handleExportQuarterlyReport = () => {
    const qLabel = quarterFilter === 'ALL' ? 'Annual-Q1-Q4' : quarterFilter;
    exportToCsv(
      `quarterly-maintenance-report-${qLabel}-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: 'seqNumber', label: 'SEQ #' },
        { key: 'quarter', label: 'Quarter' },
        { key: 'year', label: 'Year' },
        { key: 'assetCode', label: 'Asset Code' },
        { key: 'equipmentName', label: 'Equipment Name' },
        { key: 'description', label: 'Description' },
        { key: 'branchLocation', label: 'Location' },
        { key: 'incharge', label: 'Incharge' },
        { key: 'position', label: 'Position' },
        { key: 'department', label: 'Department' },
        { key: 'technician', label: 'Technician' },
        { key: 'scheduledDate', label: 'Scheduled Date' },
        { key: 'actualDate', label: 'Actual Date' },
        { key: 'status', label: 'PM Status' },
        { key: 'resultCondition', label: 'Post-PM Condition' },
        { key: 'setAssetStatusTo', label: 'Asset Operational Status' },
        {
          key: 'checklistItems',
          label: 'Checklist Progress',
          format: (row) => {
            const items = row.checklistItems ?? [];
            const checked = items.filter((i) => i.checked).length;
            return `${checked}/${items.length} Completed`;
          },
        },
        { key: 'remarks', label: 'Technician Remarks' },
      ],
      filteredTasks
    );
  };

  const taskCountByYear = useMemo(() => {
    const map = new Map<number, number>();
    tasks.forEach((t) => {
      const y = getTaskYear(t);
      map.set(y, (map.get(y) ?? 0) + 1);
    });
    return map;
  }, [tasks]);

  const existingTaskYears = useMemo(() => {
    return Array.from(taskCountByYear.keys()).sort((a, b) => b - a);
  }, [taskCountByYear]);

  const resetImpactCount = useMemo(() => {
    if (resetMode === 'rollover') {
      if (resetSourceYear === 'FROM_ASSETS') {
        return assets.length;
      }
      if (resetSourceYear === 'ALL') {
        const latest =
          existingTaskYears.length > 0 ? existingTaskYears[0] : new Date().getFullYear();
        return tasks.filter((t) => getTaskYear(t) === latest).length;
      }
      return tasks.filter((t) => getTaskYear(t) === Number(resetSourceYear)).length;
    }
    if (resetSourceYear === 'ALL' || resetSourceYear === 'FROM_ASSETS') return tasks.length;
    return tasks.filter((t) => getTaskYear(t) === Number(resetSourceYear)).length;
  }, [resetMode, resetSourceYear, tasks, assets.length, existingTaskYears]);

  const openResetModal = () => {
    const latestYear =
      existingTaskYears.length > 0 ? existingTaskYears[0] : new Date().getFullYear();
    setResetMode('rollover');
    if (tasks.length === 0 && assets.length > 0) {
      setResetSourceYear('FROM_ASSETS');
    } else {
      setResetSourceYear(latestYear);
    }
    setResetTargetYear(latestYear + 1);
    setResetKeepHistory(true);
    setResetAssetDates(false);
    setResetConfirmed(false);
    setIsResetOpen(true);
  };

  const handleConfirmReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (resetImpactCount === 0) return;

    onResetMaintenance({
      mode: resetMode,
      sourceYear: resetSourceYear,
      targetYear: resetTargetYear,
      keepHistory: resetKeepHistory,
      resetAssetLastPmDate: resetAssetDates,
    });

    // Clear active filters so newly rolled-over or reset work orders are immediately visible
    setQuarterFilter('ALL');
    setTechFilter('ALL');
    setStatusFilter('ALL');
    setSearchQuery('');

    if (resetMode === 'rollover') {
      setYearFilter(resetTargetYear);
      setCalendarYear(resetTargetYear);
      setCalendarMonth(0);
      setResetNotice(
        `Rolled over ${resetImpactCount} maintenance work orders into ${resetTargetYear} (all set to Pending with cleared checklists).`
      );
    } else if (resetMode === 'reset-pending') {
      setResetNotice(
        `Reset ${resetImpactCount} maintenance work orders${
          resetSourceYear === 'ALL' || resetSourceYear === 'FROM_ASSETS'
            ? ''
            : ` for ${resetSourceYear}`
        } back to Pending.`
      );
    } else {
      setYearFilter('ALL');
      setResetNotice(
        `Cleared ${resetImpactCount} maintenance records${
          resetSourceYear === 'ALL' || resetSourceYear === 'FROM_ASSETS'
            ? ' across all years'
            : ` for ${resetSourceYear}`
        }.`
      );
    }

    setIsResetOpen(false);
  };

  const handleImportCsv = (rows: Record<string, string>[]) => {
    const imported: MaintenanceTask[] = rows.map((row, idx) => {
      const assetCode = pickField(row, ['Asset Code', 'Code', 'Asset Tag']);
      const equipmentName =
        pickField(row, ['Equipment Name', 'Equipment', 'Name']) || 'Equipment Unit';
      const matchedAsset = assets.find(
        (a) =>
          (assetCode && a.assetCode.toLowerCase() === assetCode.toLowerCase()) ||
          a.equipmentName.toLowerCase() === equipmentName.toLowerCase()
      );
      const rawQ = pickField(row, ['Quarter', 'Qtr']).toUpperCase();
      const quarter: Quarter = (QUARTERS.includes(rawQ as Quarter) ? rawQ : 'Q4') as Quarter;
      const rawTech = pickField(row, ['Technician', 'Tech']);
      const technician: Technician =
        TECHNICIANS.find((t) => t.toLowerCase() === rawTech.toLowerCase()) ?? 'Mac';
      const actualDate = pickField(row, ['Actual Date', 'Date Completed']);
      const scheduledDate =
        pickField(row, ['Scheduled Date', 'Schedule']) ||
        actualDate ||
        new Date().toISOString().slice(0, 10);
      const rawStatus = pickField(row, ['PM Status', 'Status']);
      const status: MaintenanceStatus =
        rawStatus.toLowerCase().includes('done') || Boolean(actualDate) ? 'Done' : 'Pending';
      const rawCond = pickField(row, ['Post-PM Condition', 'Condition']).toUpperCase();
      const resultCondition: AssetCondition = (
        CONDITIONS.includes(rawCond as AssetCondition) ? rawCond : 'GOOD'
      ) as AssetCondition;
      const rawOp = pickField(row, ['Asset Operational Status', 'Operational Status']).toUpperCase();
      const setAssetStatusTo: OperationalStatus = (
        OPERATIONAL_STATUSES.includes(rawOp as OperationalStatus) ? rawOp : 'OPERATIONAL'
      ) as OperationalStatus;

      return {
        id: generateUid('pm'),
        assetId: matchedAsset?.id ?? '',
        assetCode: assetCode || matchedAsset?.assetCode || 'UNASSIGNED',
        equipmentName,
        branchLocation:
          pickField(row, ['Branch Location', 'Location', 'Branch']) ||
          matchedAsset?.branchLocation ||
          'Main',
        seqNumber:
          pickField(row, ['SEQ #', 'Seq', 'Sequence']) ||
          buildNextSeqNumber(tasks, quarter, new Date().getFullYear() + idx * 0),
        formCode: 'INF-SUP-PRMC-2025 / SUP-PRMC-2022-00',
        description:
          pickField(row, ['Description']) ||
          (matchedAsset ? `${matchedAsset.brand} ${matchedAsset.model}`.trim() : ''),
        incharge: pickField(row, ['Incharge']) || matchedAsset?.assignedTo || '',
        position: pickField(row, ['Position']),
        department: pickField(row, ['Department']),
        quarter,
        year: Number(pickField(row, ['Year'])) || new Date().getFullYear(),
        technician,
        scheduledDate,
        actualDate,
        status,
        checklistItems: DEFAULT_CHECKLIST.map((c) => ({ ...c, checked: status === 'Done' })),
        remarks: pickField(row, ['Technician Remarks', 'Remarks', 'Notes']),
        resultCondition,
        setAssetStatusTo,
      };
    });

    onBulkImportTasks(imported);
    return {
      importedCount: imported.length,
      summary: `Imported ${imported.length} preventive maintenance work orders.`,
    };
  };

  const renderChecklistSections = (
    items: MaintenanceChecklistItem[],
    onChangeItems: (next: MaintenanceChecklistItem[]) => void
  ) => {
    const normalized = ensureFullChecklist(items);
    const totalChecked = normalized.filter((c) => c.checked).length;

    return (
      <div className="border border-stone-900 dark:border-stone-600 rounded-md overflow-hidden bg-white dark:bg-stone-900">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-stone-900 dark:border-stone-600 bg-stone-50 dark:bg-stone-800/70 text-stone-900 dark:text-stone-100">
              <th className="px-3 py-2 text-center font-bold tracking-wide border-r border-stone-900 dark:border-stone-600">
                <div className="flex items-center justify-between">
                  <span className="flex-1 text-center">DESCRIPTION</span>
                  <span className="font-mono text-[11px] font-medium text-stone-500 dark:text-stone-400 tabular-nums">
                    {totalChecked}/{normalized.length}
                  </span>
                </div>
              </th>
              <th className="px-3 py-2 text-center font-bold tracking-wide w-44 sm:w-64">
                REMARKS
              </th>
            </tr>
          </thead>
          <tbody>
            {CHECKLIST_SECTIONS.map((sectionName) => {
              const sectionIndices = normalized
                .map((item, index) => ({ item, index }))
                .filter(({ item }) => item.section === sectionName);

              const allChecked =
                sectionIndices.length > 0 && sectionIndices.every(({ item }) => item.checked);

              return (
                <React.Fragment key={sectionName}>
                  <tr className="bg-gradient-to-r from-[#d88952] to-[#e9aa7b] dark:from-orange-900/80 dark:to-orange-950/70 border-y border-stone-900 dark:border-stone-600">
                    <td colSpan={2} className="px-2.5 py-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-extrabold tracking-wide text-stone-950 dark:text-orange-100 uppercase">
                          {sectionName}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = normalized.map((c) =>
                              c.section === sectionName ? { ...c, checked: !allChecked } : c
                            );
                            onChangeItems(next);
                          }}
                          className="text-[11px] font-semibold text-stone-900 dark:text-orange-200 hover:underline whitespace-nowrap"
                        >
                          {allChecked ? 'Uncheck Section' : 'Check All'}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {sectionIndices.map(({ item, index }) => (
                    <tr
                      key={`${sectionName}-${index}`}
                      className="border-b last:border-b-0 border-stone-300 dark:border-stone-700 hover:bg-orange-50/40 dark:hover:bg-stone-800/40 transition-colors"
                    >
                      <td className="px-2.5 py-1.5 border-r border-stone-900 dark:border-stone-600 align-middle">
                        <label className="flex items-start gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={(e) => {
                              const next = normalized.map((c, idx) =>
                                idx === index ? { ...c, checked: e.target.checked } : c
                              );
                              onChangeItems(next);
                            }}
                            className="mt-0.5 rounded border-stone-400 text-orange-600 focus:ring-orange-500 shrink-0"
                          />
                          <span className="w-4 text-right font-mono text-[11px] text-stone-700 dark:text-stone-300 shrink-0">
                            {item.itemNo}
                          </span>
                          <span className="text-[11px] font-medium text-stone-900 dark:text-stone-100 leading-snug">
                            {item.label}
                            {item.note && (
                              <span className="block text-[10px] italic font-normal text-stone-600 dark:text-stone-400 mt-0.5 pl-2">
                                {item.note}
                              </span>
                            )}
                          </span>
                        </label>
                      </td>
                      <td className="px-2 py-1 align-middle">
                        <input
                          type="text"
                          value={item.remarks ?? ''}
                          onChange={(e) => {
                            const next = normalized.map((c, idx) =>
                              idx === index ? { ...c, remarks: e.target.value } : c
                            );
                            onChangeItems(next);
                          }}
                          placeholder="Enter remarks..."
                          aria-label={`Remarks for ${item.label}`}
                          className="w-full px-2 py-1 text-[11px] rounded border border-transparent hover:border-stone-300 focus:border-orange-500 dark:hover:border-stone-700 bg-transparent focus:bg-white dark:focus:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none"
                        />
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Preventive Maintenance &amp; Work Orders
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5 tabular-nums">
            {summary.done} Done · {summary.pending} Pending · {summary.pct}% completion · Form INF-SUP-PRMC-2025
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-stone-800 rounded-lg border border-stone-200/70 dark:border-stone-700">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>Work Orders</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'calendar'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Schedule Calendar</span>
            </button>
          </div>

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
            onClick={handleExportQuarterlyReport}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Quarterly Report</span>
          </button>

          <button
            type="button"
            onClick={openResetModal}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-rose-200 dark:border-rose-900/70 bg-white dark:bg-stone-900 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset / Rollover Year</span>
          </button>

          <button
            type="button"
            onClick={() => openNewWorkOrderModal()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Work Order</span>
          </button>

          <ModuleGoogleSheetsBar
            links={googleSheetLinks}
            moduleTarget="maintenance"
            onAddLink={onAddSheetLink}
            onEditLink={onEditSheetLink}
          />
        </div>
      </div>

      {resetNotice && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/90 dark:bg-emerald-950/40 text-xs text-emerald-900 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-medium">{resetNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setResetNotice(null)}
            aria-label="Dismiss notice"
            className="p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-stone-800 rounded-lg">
            {(['ALL', ...QUARTERS] as const).map((q) => {
              const pendingCount = q === 'ALL' ? 0 : pendingByQuarter[q] ?? 0;
              const hasPending = pendingCount > 0;
              const isSelected = quarterFilter === q;
              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuarterFilter(q)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    hasPending
                      ? isSelected
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                      : isSelected
                      ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                >
                  <span>{q === 'ALL' ? 'All Quarters' : q}</span>
                  {hasPending && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono tabular-nums ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      {pendingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <select
            value={yearFilter}
            onChange={(e) => {
              const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
              setYearFilter(val);
              if (typeof val === 'number') {
                setCalendarYear(val);
              }
            }}
            aria-label="Filter by Year"
            className="px-3 py-2 text-xs font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
          >
            <option value="ALL">All Years</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <select
            value={techFilter}
            onChange={(e) => setTechFilter(e.target.value as 'ALL' | Technician)}
            aria-label="Filter by Technician"
            className="px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
          >
            <option value="ALL">All Technicians</option>
            {TECHNICIANS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | MaintenanceStatus)}
            aria-label="Filter by PM Status"
            className="px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
          >
            <option value="ALL">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Done">Done</option>
          </select>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search seq #, asset code, incharge..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
          />
        </div>
      </div>

      {/* View 1: Work Orders Table */}
      {viewMode === 'table' ? (
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
          {filteredTasks.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                No maintenance work orders match the active filters
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Adjust your quarter/technician filter or create a new PM work order.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                    <th className="px-4 py-3 whitespace-nowrap">Seq # / Quarter</th>
                    <th className="px-4 py-3 whitespace-nowrap">Asset &amp; Location</th>
                    <th className="px-4 py-3 whitespace-nowrap">Incharge / Dept</th>
                    <th className="px-4 py-3 whitespace-nowrap">Technician</th>
                    <th className="px-4 py-3 whitespace-nowrap">Scheduled / Actual</th>
                    <th className="px-4 py-3 whitespace-nowrap">Checklist</th>
                    <th className="px-4 py-3 whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 dark:divide-stone-800 text-xs">
                  {filteredTasks.map((task) => {
                    const checkedCount = task.checklistItems.filter((c) => c.checked).length;
                    return (
                      <tr
                        key={task.id}
                        className="hover:bg-stone-50/80 dark:hover:bg-stone-800/40 transition-colors"
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-mono font-semibold text-stone-900 dark:text-stone-100">
                            {task.seqNumber || '—'}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-[11px] font-mono">
                            <span
                              className={`px-1.5 py-0.5 rounded font-bold border ${
                                pendingQuarterYearKeys.has(`${task.year}-${task.quarter}`)
                                  ? 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                              }`}
                            >
                              {task.quarter}
                            </span>
                            <span className="text-stone-500 dark:text-stone-400">
                              {task.year}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 min-w-[210px]">
                          <div className="font-semibold text-stone-900 dark:text-stone-100">
                            {task.equipmentName}
                          </div>
                          <div className="text-[11px] text-stone-500 dark:text-stone-400 font-mono mt-0.5">
                            {task.assetCode} · {task.branchLocation}
                          </div>
                        </td>
                        <td className="px-4 py-3 min-w-[150px]">
                          <div className="text-stone-800 dark:text-stone-200 font-medium">
                            {task.incharge || '—'}
                          </div>
                          <div className="text-[11px] text-stone-500 dark:text-stone-400">
                            {[task.position, task.department].filter(Boolean).join(' · ') || '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-stone-800 dark:text-stone-200">
                          {task.technician}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono tabular-nums">
                          <div className="text-stone-600 dark:text-stone-300">
                            Sched: {task.scheduledDate || '—'}
                          </div>
                          <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                            Actual: {task.actualDate || 'Pending'}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono tabular-nums text-stone-700 dark:text-stone-300">
                          {checkedCount}/{task.checklistItems.length} steps
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleQuickToggleStatus(task)}
                            title="Click to toggle Done / Pending"
                            className="cursor-pointer"
                          >
                            <StatusBadge value={task.status} />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setPrintingTask(task)}
                              title="Print INF-SUP-PRMC-2025 Checklist Sheet"
                              className="p-1.5 rounded-md text-stone-500 hover:text-stone-900 hover:bg-stone-100 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-800 transition-colors"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setLoggingTask({
                                  ...structuredClone(task),
                                  checklistItems: ensureFullChecklist(task.checklistItems),
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                            >
                              <ClipboardCheck className="w-3.5 h-3.5" />
                              <span>Checklist</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirmDeleteId === task.id) {
                                  onDeleteTask(task.id);
                                  setConfirmDeleteId(null);
                                } else {
                                  setConfirmDeleteId(task.id);
                                }
                              }}
                              title={
                                confirmDeleteId === task.id
                                  ? 'Click again to confirm delete'
                                  : 'Delete work order'
                              }
                              className={`p-1.5 rounded-md transition-colors ${
                                confirmDeleteId === task.id
                                  ? 'bg-rose-600 text-white'
                                  : 'text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                              }`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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
        /* View 2: Interactive Maintenance Assignment Calendar */
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-stone-200 dark:border-stone-800">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                {calendarData.monthLabel}
              </h2>
              <select
                value={calendarYear}
                onChange={(e) => setCalendarYear(Number(e.target.value))}
                aria-label="Select Calendar Year"
                className="px-2.5 py-1 text-xs font-mono rounded-md border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (calendarMonth === 0) {
                      setCalendarMonth(11);
                      setCalendarYear((y) => y - 1);
                    } else {
                      setCalendarMonth((m) => m - 1);
                    }
                  }}
                  aria-label="Previous month"
                  className="p-1.5 rounded-md border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setCalendarYear(now.getFullYear());
                    setCalendarMonth(now.getMonth());
                  }}
                  className="px-2.5 py-1 text-xs font-medium rounded-md border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (calendarMonth === 11) {
                      setCalendarMonth(0);
                      setCalendarYear((y) => y + 1);
                    } else {
                      setCalendarMonth((m) => m + 1);
                    }
                  }}
                  aria-label="Next month"
                  className="p-1.5 rounded-md border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-stone-500 dark:text-stone-400">
              <span>Click any date cell to assign a new PM work order</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                Done
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-600 inline-block" />
                Pending
              </span>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="px-3 py-2 text-center border-r last:border-r-0 border-stone-200 dark:border-stone-800">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Cells */}
          <div className="grid grid-cols-7">
            {calendarData.cells.map((cell) => {
              const isToday = cell.dateStr === new Date().toISOString().slice(0, 10);
              return (
                <div
                  key={cell.dateStr}
                  className={`min-h-[120px] p-2 border-r border-b border-stone-200 dark:border-stone-800 flex flex-col gap-1.5 transition-colors ${
                    cell.inCurrentMonth
                      ? 'bg-white dark:bg-stone-900'
                      : 'bg-stone-50/70 dark:bg-stone-950/60 text-stone-400 dark:text-stone-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-mono tabular-nums font-semibold px-1.5 py-0.5 rounded ${
                        isToday
                          ? 'bg-orange-600 text-white'
                          : cell.inCurrentMonth
                          ? 'text-stone-700 dark:text-stone-300'
                          : 'text-stone-400 dark:text-stone-600'
                      }`}
                    >
                      {cell.dayNum}
                    </span>
                    <button
                      type="button"
                      onClick={() => openNewWorkOrderModal(cell.dateStr)}
                      title={`Assign maintenance on ${cell.dateStr}`}
                      className="text-[11px] font-medium text-stone-400 hover:text-orange-600 dark:hover:text-orange-400 px-1 rounded hover:bg-orange-50 dark:hover:bg-orange-950/40 transition-colors"
                    >
                      + Assign
                    </button>
                  </div>

                  <div className="space-y-1 overflow-y-auto max-h-[92px]">
                    {cell.tasks.map((task) => {
                      const quarterPending = pendingQuarterYearKeys.has(
                        `${task.year}-${task.quarter}`
                      );
                      return (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() =>
                            setLoggingTask({
                              ...structuredClone(task),
                              checklistItems: ensureFullChecklist(task.checklistItems),
                            })
                          }
                          className={`w-full text-left px-2 py-1 rounded border text-[11px] leading-tight transition-colors ${
                            task.status === 'Done'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-800/70 dark:text-emerald-200'
                              : 'bg-rose-50 border-rose-300 text-rose-950 hover:bg-rose-100 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 font-mono font-semibold">
                            <span className="truncate">{task.assetCode}</span>
                            <span
                              className={`shrink-0 px-1 rounded text-[10px] ${
                                quarterPending
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-emerald-600/15 text-emerald-800 dark:text-emerald-200'
                              }`}
                            >
                              {task.quarter}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-1 text-[10px] opacity-85 mt-0.5">
                            <span className="truncate">{task.equipmentName}</span>
                            <span className="shrink-0 font-medium">{task.technician}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* New Work Order Modal — Exact INF-SUP-PRMC-2025 PDF Sheet Layout */}
      <Modal
        isOpen={isNewOpen}
        onClose={() => setIsNewOpen(false)}
        title="New Preventive Maintenance Work Order"
        subtitle="TRISTELLAR IT DEPT. · Form INF-SUP-PRMC-2025 / SUP-PRMC-2022-00"
        maxWidthClass="max-w-4xl"
      >
        <form onSubmit={handleCreateWorkOrder} className="space-y-4">
          {/* Compact Scheduling & Asset Auto-Fill Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-2.5 p-3 rounded-lg bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                Load from Asset Registry
              </label>
              <select
                value={newForm.assetId}
                onChange={(e) => handleSelectAssetForNewOrder(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              >
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    [{a.assetCode}] {a.equipmentName} — {a.branchLocation}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                Quarter
              </label>
              <select
                value={newForm.quarter}
                onChange={(e) => {
                  const q = e.target.value as Quarter;
                  setNewForm({
                    ...newForm,
                    quarter: q,
                    seqNumber: buildNextSeqNumber(tasks, q, newForm.year),
                  });
                }}
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              >
                {QUARTERS.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                Year
              </label>
              <select
                value={newForm.year}
                onChange={(e) => {
                  const yr = Number(e.target.value);
                  setNewForm({
                    ...newForm,
                    year: yr,
                    seqNumber: buildNextSeqNumber(tasks, newForm.quarter, yr),
                  });
                }}
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                Technician
              </label>
              <select
                value={newForm.technician}
                onChange={(e) =>
                  setNewForm({ ...newForm, technician: e.target.value as Technician })
                }
                className="w-full px-2.5 py-1.5 text-xs rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              >
                {TECHNICIANS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                Scheduled Date
              </label>
              <input
                type="date"
                value={newForm.scheduledDate}
                onChange={(e) => {
                  const val = e.target.value;
                  const nextQ = val ? quarterFromDate(val) : newForm.quarter;
                  const nextY = val ? Number(val.split('-')[0]) || newForm.year : newForm.year;
                  setNewForm({
                    ...newForm,
                    scheduledDate: val,
                    quarter: nextQ,
                    year: nextY,
                    seqNumber: buildNextSeqNumber(tasks, nextQ, nextY),
                  });
                }}
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>

          {/* Exact PDF Form Sheet Structure */}
          <div className="border-2 border-stone-900 dark:border-stone-600 bg-white dark:bg-stone-900 overflow-hidden rounded-sm">
            {/* Warm Peach Header Banner */}
            <div className="bg-gradient-to-r from-[#f6cbb0] to-[#fde8d7] dark:from-orange-950/80 dark:to-stone-900 border-b border-stone-900 dark:border-stone-600 px-4 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <img
                    src={`${import.meta.env.BASE_URL}assets/aistudio/TTC.Logo.Tagline_MKT_Ver7824_3b47c9b8.png`}
                    alt="TriStellar"
                    className="h-7 w-auto object-contain rounded bg-white/85 px-1.5 py-0.5"
                  />
                  <span className="text-xs font-extrabold tracking-wider text-orange-900 dark:text-orange-300 uppercase">
                    TRISTELLAR IT DEPT.
                  </span>
                </div>
                <span className="text-[11px] font-mono font-semibold text-stone-800 dark:text-stone-200">
                  {newForm.quarter} · {newForm.year}
                </span>
              </div>
              <h3 className="text-center text-base sm:text-lg font-extrabold tracking-wide text-stone-950 dark:text-orange-100 mt-1">
                PREVENTIVE MAINTENANCE CHECKLIST
              </h3>
            </div>

            {/* Form Code Sub-bars */}
            <div className="bg-stone-200 dark:bg-stone-800 border-b border-stone-900 dark:border-stone-600 text-center py-1 font-bold text-[11px] tracking-wide text-stone-900 dark:text-stone-100">
              INF -SUP-PRMC-2025
            </div>
            <div className="border-b border-stone-900 dark:border-stone-600 text-center py-0.5 font-semibold text-[11px] text-stone-800 dark:text-stone-200">
              SUP-PRMC-2022-00
            </div>

            {/* SEQ. # and 2-Column Lined Header Fields */}
            <div className="p-3.5 space-y-2.5 border-b border-stone-900 dark:border-stone-600">
              <div className="flex items-center justify-end gap-3">
                <label className="text-xs font-bold text-stone-900 dark:text-stone-100">
                  SEQ. #
                </label>
                <input
                  type="text"
                  value={newForm.seqNumber ?? ''}
                  onChange={(e) => setNewForm({ ...newForm, seqNumber: e.target.value })}
                  placeholder="20224TH-01"
                  className="w-36 px-2 py-0.5 text-xs font-mono font-bold text-right border-b border-stone-400 dark:border-stone-600 bg-transparent text-stone-900 dark:text-stone-100 focus:outline-none focus:border-orange-600"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-xs">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="w-24 shrink-0 font-bold text-[11px] text-stone-900 dark:text-stone-200">
                      ASSET CODE
                    </label>
                    <input
                      type="text"
                      required
                      value={newForm.assetCode}
                      onChange={(e) => setNewForm({ ...newForm, assetCode: e.target.value })}
                      className="flex-1 px-1.5 py-0.5 text-xs font-mono border-b border-stone-400 dark:border-stone-600 bg-transparent text-stone-900 dark:text-stone-100 focus:outline-none focus:border-orange-600"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-24 shrink-0 font-bold text-[11px] text-stone-900 dark:text-stone-200">
                      DESCRIPTION
                    </label>
                    <input
                      type="text"
                      value={newForm.description ?? ''}
                      onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
                      placeholder="Hardware model / unit description"
                      className="flex-1 px-1.5 py-0.5 text-xs border-b border-stone-400 dark:border-stone-600 bg-transparent text-stone-900 dark:text-stone-100 focus:outline-none focus:border-orange-600"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-24 shrink-0 font-bold text-[11px] text-stone-900 dark:text-stone-200">
                      LOCATION
                    </label>
                    <input
                      type="text"
                      value={newForm.branchLocation}
                      onChange={(e) => setNewForm({ ...newForm, branchLocation: e.target.value })}
                      className="flex-1 px-1.5 py-0.5 text-xs border-b border-stone-400 dark:border-stone-600 bg-transparent text-stone-900 dark:text-stone-100 focus:outline-none focus:border-orange-600"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="w-24 shrink-0 font-bold text-[11px] text-stone-900 dark:text-stone-200">
                      INCHARGE
                    </label>
                    <input
                      type="text"
                      value={newForm.incharge ?? ''}
                      onChange={(e) => setNewForm({ ...newForm, incharge: e.target.value })}
                      placeholder="Employee / Custodian"
                      className="flex-1 px-1.5 py-0.5 text-xs border-b border-stone-400 dark:border-stone-600 bg-transparent text-stone-900 dark:text-stone-100 focus:outline-none focus:border-orange-600"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-24 shrink-0 font-bold text-[11px] text-stone-900 dark:text-stone-200">
                      POSITION
                    </label>
                    <input
                      type="text"
                      value={newForm.position ?? ''}
                      onChange={(e) => setNewForm({ ...newForm, position: e.target.value })}
                      placeholder="e.g., Cashier / Staff"
                      className="flex-1 px-1.5 py-0.5 text-xs border-b border-stone-400 dark:border-stone-600 bg-transparent text-stone-900 dark:text-stone-100 focus:outline-none focus:border-orange-600"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-24 shrink-0 font-bold text-[11px] text-stone-900 dark:text-stone-200">
                      DEPARTMENT
                    </label>
                    <input
                      type="text"
                      value={newForm.department ?? ''}
                      onChange={(e) => setNewForm({ ...newForm, department: e.target.value })}
                      placeholder="e.g., Accounting / Dispatch"
                      className="flex-1 px-1.5 py-0.5 text-xs border-b border-stone-400 dark:border-stone-600 bg-transparent text-stone-900 dark:text-stone-100 focus:outline-none focus:border-orange-600"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 4-Section PDF Checklist Table (DESCRIPTION | REMARKS) */}
            <div className="p-2.5 bg-white dark:bg-stone-900">
              {renderChecklistSections(newForm.checklistItems, (next) =>
                setNewForm({ ...newForm, checklistItems: next })
              )}
            </div>

            {/* Status & Overall Remarks Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-stone-50 dark:bg-stone-800/40 border-t border-stone-900 dark:border-stone-600 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Work Order Status
                </label>
                <select
                  value={newForm.status}
                  onChange={(e) =>
                    setNewForm({
                      ...newForm,
                      status: e.target.value as MaintenanceStatus,
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                >
                  <option value="Pending">Pending (Scheduled)</option>
                  <option value="Done">Done (Completed Now)</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Overall Technician Remarks
                </label>
                <input
                  type="text"
                  value={newForm.remarks}
                  onChange={(e) => setNewForm({ ...newForm, remarks: e.target.value })}
                  placeholder="Overall findings / instructions..."
                  className="w-full px-2.5 py-1.5 text-xs rounded border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsNewOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors"
            >
              Create Work Order
            </button>
          </div>
        </form>
      </Modal>

      {/* Log / Edit Checklist Modal */}
      <Modal
        isOpen={Boolean(loggingTask)}
        onClose={() => setLoggingTask(null)}
        title={
          loggingTask
            ? `PM Checklist · ${loggingTask.seqNumber || loggingTask.assetCode}`
            : 'PM Checklist'
        }
        subtitle="INF-SUP-PRMC-2025 — Saving updates the work order and automatically syncs the parent asset's operational status & last PM date."
        maxWidthClass="max-w-4xl"
      >
        {loggingTask && (
          <form onSubmit={handleSaveLoggingModal} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-lg bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-800 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-stone-500 dark:text-stone-400 mb-1">
                  SEQ. #
                </label>
                <input
                  type="text"
                  value={loggingTask.seqNumber ?? ''}
                  onChange={(e) =>
                    setLoggingTask({ ...loggingTask, seqNumber: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-stone-500 dark:text-stone-400 mb-1">
                  ASSET CODE / LOCATION
                </label>
                <div className="font-mono font-semibold text-stone-900 dark:text-stone-100 py-1.5">
                  {loggingTask.assetCode} · {loggingTask.branchLocation}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-stone-500 dark:text-stone-400 mb-1">
                  DESCRIPTION
                </label>
                <input
                  type="text"
                  value={loggingTask.description ?? loggingTask.equipmentName}
                  onChange={(e) =>
                    setLoggingTask({ ...loggingTask, description: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-stone-500 dark:text-stone-400 mb-1">
                  INCHARGE
                </label>
                <input
                  type="text"
                  value={loggingTask.incharge ?? ''}
                  onChange={(e) =>
                    setLoggingTask({ ...loggingTask, incharge: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-stone-500 dark:text-stone-400 mb-1">
                  POSITION
                </label>
                <input
                  type="text"
                  value={loggingTask.position ?? ''}
                  onChange={(e) =>
                    setLoggingTask({ ...loggingTask, position: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-stone-500 dark:text-stone-400 mb-1">
                  DEPARTMENT
                </label>
                <input
                  type="text"
                  value={loggingTask.department ?? ''}
                  onChange={(e) =>
                    setLoggingTask({ ...loggingTask, department: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Technician
                </label>
                <select
                  value={loggingTask.technician}
                  onChange={(e) =>
                    setLoggingTask({
                      ...loggingTask,
                      technician: e.target.value as Technician,
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                >
                  {TECHNICIANS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Scheduled Date
                </label>
                <input
                  type="date"
                  value={loggingTask.scheduledDate}
                  onChange={(e) =>
                    setLoggingTask({ ...loggingTask, scheduledDate: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Actual Date
                </label>
                <input
                  type="date"
                  value={loggingTask.actualDate}
                  onChange={(e) =>
                    setLoggingTask({ ...loggingTask, actualDate: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Task Status
                </label>
                <select
                  value={loggingTask.status}
                  onChange={(e) =>
                    setLoggingTask({
                      ...loggingTask,
                      status: e.target.value as MaintenanceStatus,
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                >
                  <option value="Pending">Pending</option>
                  <option value="Done">Done</option>
                </select>
              </div>
            </div>

            {renderChecklistSections(loggingTask.checklistItems, (next) =>
              setLoggingTask({ ...loggingTask, checklistItems: next })
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Update Parent Condition
                </label>
                <select
                  value={loggingTask.resultCondition}
                  onChange={(e) =>
                    setLoggingTask({
                      ...loggingTask,
                      resultCondition: e.target.value as AssetCondition,
                    })
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
                  Update Parent Operational Status
                </label>
                <select
                  value={loggingTask.setAssetStatusTo}
                  onChange={(e) =>
                    setLoggingTask({
                      ...loggingTask,
                      setAssetStatusTo: e.target.value as OperationalStatus,
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
                  Summary Remarks
                </label>
                <input
                  type="text"
                  value={loggingTask.remarks}
                  onChange={(e) =>
                    setLoggingTask({ ...loggingTask, remarks: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => {
                  setPrintingTask(loggingTask);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Checklist Form</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLoggingTask(null)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Save &amp; Sync Asset Status</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Printable INF-SUP-PRMC-2025 Form Modal */}
      <Modal
        isOpen={Boolean(printingTask)}
        onClose={() => setPrintingTask(null)}
        title="Printable Preventive Maintenance Checklist"
        subtitle="INF-SUP-PRMC-2025 / SUP-PRMC-2022-00"
        maxWidthClass="max-w-3xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setPrintingTask(null)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-orange-600 text-white hover:bg-orange-700"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Form</span>
            </button>
          </>
        }
      >
        {printingTask && (
          <div
            id="printable-pm-form"
            className="bg-white text-stone-900 border-2 border-stone-900 text-xs"
          >
            <div className="bg-gradient-to-r from-[#f6cbb0] to-[#fde8d7] border-b border-stone-900 px-4 py-2.5">
              <div className="flex items-center justify-center gap-2.5 mb-1">
                <img
                  src={`${import.meta.env.BASE_URL}assets/aistudio/TTC.Logo.Tagline_MKT_Ver7824_3b47c9b8.png`}
                  alt="TriStellar"
                  className="h-7 w-auto object-contain"
                />
                <p className="text-xs font-bold tracking-wider text-orange-900">
                  TRISTELLAR IT DEPT.
                </p>
              </div>
              <h3 className="text-base font-extrabold tracking-wide text-stone-950 text-center">
                PREVENTIVE MAINTENANCE CHECKLIST
              </h3>
            </div>
            <div className="bg-stone-200 border-b border-stone-900 text-center py-1 font-bold text-[11px]">
              INF -SUP-PRMC-2025
            </div>
            <div className="border-b border-stone-900 text-center py-1 font-semibold text-[11px]">
              SUP-PRMC-2022-00
            </div>

            <div className="p-3 border-b border-stone-900 space-y-2">
              <div className="flex justify-end gap-4 font-bold">
                <span>SEQ. #</span>
                <span className="font-mono">{printingTask.seqNumber || '20264TH-01'}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-[11px]">
                <div className="space-y-1">
                  <div className="flex gap-2">
                    <span className="font-semibold w-24">ASSET CODE</span>
                    <span className="border-b border-stone-400 flex-1 font-mono">
                      {printingTask.assetCode}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold w-24">DESCRIPTION</span>
                    <span className="border-b border-stone-400 flex-1">
                      {printingTask.description || printingTask.equipmentName}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold w-24">LOCATION</span>
                    <span className="border-b border-stone-400 flex-1">
                      {printingTask.branchLocation}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex gap-2">
                    <span className="font-semibold w-24">INCHARGE</span>
                    <span className="border-b border-stone-400 flex-1">
                      {printingTask.incharge || '—'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold w-24">POSITION</span>
                    <span className="border-b border-stone-400 flex-1">
                      {printingTask.position || '—'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold w-24">DEPARTMENT</span>
                    <span className="border-b border-stone-400 flex-1">
                      {printingTask.department || '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-stone-900 font-bold">
                  <th className="px-2 py-1.5 text-center border-r border-stone-900">DESCRIPTION</th>
                  <th className="px-2 py-1.5 text-center w-56">REMARKS</th>
                </tr>
              </thead>
              <tbody>
                {CHECKLIST_SECTIONS.map((sec) => {
                  const rows = ensureFullChecklist(printingTask.checklistItems).filter(
                    (c) => c.section === sec
                  );
                  return (
                    <React.Fragment key={sec}>
                      <tr className="bg-gradient-to-r from-[#d88952] to-[#e9aa7b] border-y border-stone-900 font-bold">
                        <td colSpan={2} className="px-2 py-1 text-stone-950">
                          {sec}
                        </td>
                      </tr>
                      {rows.map((row, idx) => (
                        <tr key={idx} className="border-b border-stone-300">
                          <td className="px-2 py-1 border-r border-stone-900">
                            <span className="mr-1.5 font-mono font-bold">
                              {row.checked ? '[✓]' : '[ ]'}
                            </span>
                            <span className="mr-2 font-mono">{row.itemNo}</span>
                            {row.label}
                            {row.note && (
                              <span className="block italic pl-10 text-[10px]">{row.note}</span>
                            )}
                          </td>
                          <td className="px-2 py-1">{row.remarks || ''}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>

            <div className="p-3 flex items-center justify-between text-[11px] bg-stone-50 border-t border-stone-900">
              <span>
                Technician: <strong>{printingTask.technician}</strong>
              </span>
              <span>
                Scheduled: <strong className="font-mono">{printingTask.scheduledDate || '—'}</strong>
              </span>
              <span>
                Actual: <strong className="font-mono">{printingTask.actualDate || '—'}</strong>
              </span>
            </div>
          </div>
        )}
      </Modal>

      <CsvImportModal
        isOpen={isCsvOpen}
        onClose={() => setIsCsvOpen(false)}
        title="Import Quarterly Maintenance CSV"
        description="Upload PM schedule rows or completed technician maintenance logs."
        sampleHeaders={[
          'SEQ #',
          'Quarter',
          'Asset Code',
          'Equipment Name',
          'Branch Location',
          'Technician',
          'Scheduled Date',
          'Actual Date',
          'PM Status',
          'Technician Remarks',
        ]}
        sampleRow={[
          '20264TH-13',
          'Q4',
          '00541-01',
          'Accounting Workstation 01',
          'Main',
          'Mac',
          '2026-11-15',
          '2026-11-15',
          'Done',
          'Completed full Q4 PM checklist',
        ]}
        onImportRows={handleImportCsv}
      />

      {/* Annual Rollover & Reset Maintenance Modal */}
      <Modal
        isOpen={isResetOpen}
        onClose={() => setIsResetOpen(false)}
        title="Reset & Annual Maintenance Rollover"
        subtitle="Prepare next year's preventive maintenance cycle or reset current PM schedules."
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={handleConfirmReset} className="space-y-4">
          {/* Pre-Reset CSV Backup Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-amber-200 dark:border-amber-800/80 bg-amber-50/70 dark:bg-amber-950/30">
            <div className="flex items-start gap-2.5 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-950 dark:text-amber-200">
                <p className="font-semibold">Recommended: Export a backup first</p>
                <p className="text-[11px] opacity-85 mt-0.5">
                  Save your completed PM logs as CSV before resetting or replacing records.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleExportQuarterlyReport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-stone-900 text-amber-900 dark:text-amber-200 hover:bg-amber-100/60 dark:hover:bg-amber-900/40 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Current CSV</span>
            </button>
          </div>

          {/* Mode Selection */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
              Select Reset Action
            </span>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => {
                  setResetMode('rollover');
                  setResetConfirmed(false);
                }}
                className={`text-left p-3 rounded-lg border transition-colors ${
                  resetMode === 'rollover'
                    ? 'border-orange-500 bg-orange-50/70 dark:bg-orange-950/30 dark:border-orange-600'
                    : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                    Roll Over Schedule to New Year
                  </span>
                  <span className="text-[10px] font-semibold text-orange-700 dark:text-orange-300">
                    Recommended for Next Year
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                  Copies asset &amp; technician assignments into the target year with all tasks set to Pending and blank checklists.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setResetMode('reset-pending');
                  setResetConfirmed(false);
                }}
                className={`text-left p-3 rounded-lg border transition-colors ${
                  resetMode === 'reset-pending'
                    ? 'border-orange-500 bg-orange-50/70 dark:bg-orange-950/30 dark:border-orange-600'
                    : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/40'
                }`}
              >
                <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                  Reset Existing Tasks to Pending
                </span>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                  Keeps current work orders in place, clears actual completion dates &amp; remarks, and unchecks all 18 checklist steps.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setResetMode('clear');
                  setResetConfirmed(false);
                }}
                className={`text-left p-3 rounded-lg border transition-colors ${
                  resetMode === 'clear'
                    ? 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/30 dark:border-rose-700'
                    : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/40'
                }`}
              >
                <span className="text-xs font-bold text-rose-700 dark:text-rose-300">
                  Clear Maintenance Data (Blank Slate)
                </span>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                  Deletes maintenance work orders for the selected year (or all years) so you can start fresh or import a new CSV.
                </p>
              </button>
            </div>
          </div>

          {/* Year Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                {resetMode === 'rollover' ? 'Copy Schedule From' : 'Target Year Scope'}
              </label>
              <select
                value={String(resetSourceYear)}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'ALL' || v === 'FROM_ASSETS') {
                    setResetSourceYear(v);
                  } else {
                    setResetSourceYear(Number(v));
                  }
                }}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              >
                <option value="ALL">
                  {resetMode === 'rollover'
                    ? `Latest Year (${existingTaskYears[0] ?? 2026} — ${
                        taskCountByYear.get(existingTaskYears[0] ?? 2026) ?? 0
                      } tasks)`
                    : `All Years (${tasks.length} tasks)`}
                </option>
                {resetMode === 'rollover' && (
                  <option value="FROM_ASSETS">
                    Master Assets ({assets.length} assets → Q1)
                  </option>
                )}
                {yearOptions.map((y) => {
                  const cnt = taskCountByYear.get(y) ?? 0;
                  return (
                    <option key={y} value={String(y)}>
                      {y} ({cnt} {cnt === 1 ? 'task' : 'tasks'})
                    </option>
                  );
                })}
              </select>
            </div>

            {resetMode === 'rollover' && (
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  New Maintenance Year
                </label>
                <select
                  value={resetTargetYear}
                  onChange={(e) => setResetTargetYear(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                >
                  {[2026, 2027, 2028, 2029, 2030, 2031, 2032].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Additional Options */}
          <div className="space-y-2.5 p-3 rounded-lg bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800">
            {resetMode === 'rollover' && (
              <div className="space-y-2">
                <label className="flex items-start gap-2 text-xs text-stone-800 dark:text-stone-200 cursor-pointer">
                  <input
                    type="radio"
                    name="rolloverHistoryMode"
                    checked={resetKeepHistory}
                    onChange={() => setResetKeepHistory(true)}
                    className="mt-0.5 text-orange-600 focus:ring-orange-500"
                  />
                  <span>
                    <strong className="font-semibold">Keep past year records as archive</strong>
                    <span className="block text-[11px] text-stone-500 dark:text-stone-400">
                      Adds fresh {resetTargetYear} Pending work orders while preserving prior years in the Year dropdown.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-xs text-stone-800 dark:text-stone-200 cursor-pointer">
                  <input
                    type="radio"
                    name="rolloverHistoryMode"
                    checked={!resetKeepHistory}
                    onChange={() => setResetKeepHistory(false)}
                    className="mt-0.5 text-orange-600 focus:ring-orange-500"
                  />
                  <span>
                    <strong className="font-semibold">Replace all prior maintenance data</strong>
                    <span className="block text-[11px] text-stone-500 dark:text-stone-400">
                      Removes old year logs and starts completely fresh with only {resetTargetYear} Pending tasks.
                    </span>
                  </span>
                </label>
              </div>
            )}

            <label className="flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={resetAssetDates}
                onChange={(e) => setResetAssetDates(e.target.checked)}
                className="rounded border-stone-300 text-orange-600 focus:ring-orange-500"
              />
              <span>Also clear &ldquo;Last Maintenance Date&rdquo; on Master Assets</span>
            </label>
          </div>

          {/* Impact Summary */}
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-stone-100 dark:bg-stone-800 text-xs">
            <span className="text-stone-600 dark:text-stone-300">
              {resetMode === 'rollover' ? 'Work Orders to Create:' : 'Affected Work Orders:'}
            </span>
            <span className="font-mono tabular-nums font-bold text-stone-900 dark:text-stone-100">
              {resetImpactCount} {resetImpactCount === 1 ? 'task' : 'tasks'}
            </span>
          </div>

          {resetMode === 'clear' && (
            <label className="flex items-center gap-2 text-xs font-medium text-rose-700 dark:text-rose-300 cursor-pointer">
              <input
                type="checkbox"
                checked={resetConfirmed}
                onChange={(e) => setResetConfirmed(e.target.checked)}
                className="rounded border-rose-400 text-rose-600 focus:ring-rose-500"
              />
              <span>
                I confirm I want to permanently delete the selected maintenance records.
              </span>
            </label>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
            <button
              type="button"
              onClick={() => setIsResetOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                resetImpactCount === 0 || (resetMode === 'clear' && !resetConfirmed)
              }
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg text-white transition-colors disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap ${
                resetMode === 'clear'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-orange-600 hover:bg-orange-700'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>
                {resetMode === 'rollover'
                  ? `Roll Over to ${resetTargetYear}`
                  : resetMode === 'reset-pending'
                  ? 'Reset Tasks to Pending'
                  : 'Clear Maintenance Data'}
              </span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
