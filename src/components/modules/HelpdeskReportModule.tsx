import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Hourglass,
  Layers,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Tag,
  Trash2,
  TrendingUp,
  Upload,
  Users,
  Check,
  X,
} from 'lucide-react';
import {
  GoogleSheetLink,
  GoogleSheetTargetModule,
  HelpdeskMonthRow,
  HelpdeskPersonnelCount,
  HelpdeskTicket,
  HelpdeskYearReport,
} from '../../types/cmms';
import { exportToCsv, generateUid } from '../../utils/csv';
import {
  normalizeBranchLocation,
  OFFICIAL_BRANCH_LOCATIONS,
  summarizeHelpdeskCategories,
} from '../../utils/helpdeskTickets';
import { Modal } from '../ui/Modal';
import { ModuleGoogleSheetsBar } from '../ui/ModuleGoogleSheetsBar';
import { HelpdeskTicketLogPanel } from './HelpdeskTicketLogPanel';

const MONTHS_ORDER = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_SET = new Set(MONTHS_ORDER.map((m) => m.toLowerCase()));

interface HelpdeskReportModuleProps {
  reports: HelpdeskYearReport[];
  tickets: HelpdeskTicket[];
  googleSheetLinks: GoogleSheetLink[];
  onAddSheetLink: (defaultTarget: GoogleSheetTargetModule) => void;
  onEditSheetLink: (link: GoogleSheetLink) => void;
  onSaveReports: (nextReports: HelpdeskYearReport[]) => void;
  onSaveTickets: (nextTickets: HelpdeskTicket[]) => void;
  onReloadInitialLog?: () => Promise<void>;
  reloadingLog?: boolean;
}

function summarizeYear(report: HelpdeskYearReport) {
  const done = report.months.reduce((sum, m) => sum + (Number(m.doneResolved) || 0), 0);
  const pending = report.months.reduce((sum, m) => sum + (Number(m.pending) || 0), 0);
  const onGoing = report.months.reduce((sum, m) => sum + (Number(m.onGoing) || 0), 0);
  const overall = done + pending + onGoing;
  const resolutionPct = overall > 0 ? ((done / overall) * 100).toFixed(2) : '0.00';
  const personnelTotal = report.personnels.reduce((sum, p) => sum + (Number(p.count) || 0), 0);
  const topPersonnel = [...report.personnels].sort((a, b) => b.count - a.count)[0];
  const peakMonth = [...report.months].sort(
    (a, b) =>
      b.doneResolved + b.pending + b.onGoing - (a.doneResolved + a.pending + a.onGoing)
  )[0];
  return {
    done,
    pending,
    onGoing,
    overall,
    resolutionPct,
    personnelTotal,
    topPersonnel,
    peakMonth,
  };
}

/**
 * Parses the uploaded multi-year IT_HELPDESK_REPORT matrix CSV
 * (repeated blocks of MONTH,DONE / RESOLVED,PENDING,ON-GOING + OVERALL/year + Personnels)
 * as well as flat Year,Month,Done / Resolved,Pending,On-Going CSVs.
 */
function parseHelpdeskCsv(text: string): HelpdeskYearReport[] {
  const clean = text.replace(/^\uFEFF/, '');
  const lines = clean
    .split(/\r?\n/)
    .map((line) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '')));

  // Check if flat CSV (header contains Year and Month)
  const firstNonEmpty = lines.find((r) => r.some((c) => c.length > 0)) || [];
  const normFirst = firstNonEmpty.map((c) => c.toLowerCase().replace(/[^a-z0-9]/g, ''));
  if (normFirst.includes('year') && normFirst.includes('month')) {
    const yearIdx = normFirst.indexOf('year');
    const monthIdx = normFirst.indexOf('month');
    const doneIdx = normFirst.findIndex((h) => h.includes('done') || h.includes('resolved'));
    const pendIdx = normFirst.findIndex((h) => h.includes('pending'));
    const ongoingIdx = normFirst.findIndex((h) => h.includes('ongoing'));

    const byYear = new Map<number, Map<string, HelpdeskMonthRow>>();
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      const y = Number(row[yearIdx]);
      const mRaw = (row[monthIdx] || '').trim();
      const canonicalMonth = MONTHS_ORDER.find(
        (m) => m.toLowerCase() === mRaw.toLowerCase()
      );
      if (!Number.isFinite(y) || y < 2000 || !canonicalMonth) continue;
      if (!byYear.has(y)) byYear.set(y, new Map());
      byYear.get(y)!.set(canonicalMonth, {
        month: canonicalMonth,
        doneResolved: doneIdx >= 0 ? Math.max(0, Number(row[doneIdx]) || 0) : 0,
        pending: pendIdx >= 0 ? Math.max(0, Number(row[pendIdx]) || 0) : 0,
        onGoing: ongoingIdx >= 0 ? Math.max(0, Number(row[ongoingIdx]) || 0) : 0,
      });
    }

    return Array.from(byYear.entries())
      .map(([year, monthMap]) => ({
        year,
        months: MONTHS_ORDER.map(
          (m) =>
            monthMap.get(m) ?? { month: m, doneResolved: 0, pending: 0, onGoing: 0 }
        ),
        personnels: [],
      }))
      .sort((a, b) => b.year - a.year);
  }

  // Multi-year matrix CSV format (exact format of IT_HELPDESK_REPORT_2026_-_Per_Year.csv)
  interface RawBlock {
    months: Map<string, HelpdeskMonthRow>;
    year: number | null;
    personnels: HelpdeskPersonnelCount[];
  }

  const blocks: RawBlock[] = [];
  let current: RawBlock | null = null;
  let inPersonnelSection = false;

  for (const row of lines) {
    const col1 = (row[1] || '').trim();
    const col1Lower = col1.toLowerCase();

    if (col1Lower === 'month') {
      if (current && current.months.size > 0) {
        blocks.push(current);
      }
      current = {
        months: new Map(),
        year: null,
        personnels: [],
      };
      inPersonnelSection = false;
      continue;
    }

    if (!current) continue;

    // Month data on left columns (1..4)
    if (MONTH_SET.has(col1Lower)) {
      const canonicalMonth = MONTHS_ORDER.find((m) => m.toLowerCase() === col1Lower)!;
      current.months.set(canonicalMonth, {
        month: canonicalMonth,
        doneResolved: Math.max(0, Number(row[2]) || 0),
        pending: Math.max(0, Number(row[3]) || 0),
        onGoing: Math.max(0, Number(row[4]) || 0),
      });
    }

    // Right-side summary / year / personnel block (columns 6..8)
    const labelCol = (row[6] || '').trim();
    const labelLower = labelCol.toLowerCase();
    const valCol = (row[7] || '').trim();
    const extraCol = (row[8] || '').trim();

    if (labelLower === 'overall') {
      const parsedYear = Number(extraCol);
      if (Number.isFinite(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100) {
        current.year = parsedYear;
      }
      inPersonnelSection = false;
    } else if (labelLower.startsWith('personnel')) {
      inPersonnelSection = true;
    } else if (inPersonnelSection && labelCol && /^\d+$/.test(valCol)) {
      current.personnels.push({
        id: generateUid('hp'),
        name: labelCol,
        count: Math.max(0, Number(valCol) || 0),
      });
    }
  }

  if (current && current.months.size > 0) {
    blocks.push(current);
  }

  const results: HelpdeskYearReport[] = [];
  blocks.forEach((blk, idx) => {
    const year = blk.year ?? 2022 + idx;
    results.push({
      year,
      months: MONTHS_ORDER.map(
        (m) =>
          blk.months.get(m) ?? { month: m, doneResolved: 0, pending: 0, onGoing: 0 }
      ),
      personnels: blk.personnels.map((p, pIdx) => ({
        ...p,
        id: `hp-${year}-${pIdx + 1}`,
      })),
    });
  });

  return results.sort((a, b) => b.year - a.year);
}

export const HelpdeskReportModule: React.FC<HelpdeskReportModuleProps> = ({
  reports,
  tickets,
  googleSheetLinks,
  onAddSheetLink,
  onEditSheetLink,
  onSaveReports,
  onSaveTickets,
  onReloadInitialLog,
  reloadingLog = false,
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'tickets'>('summary');
  const [requestedFilter, setRequestedFilter] = useState<{
    category?: string;
    branch?: string;
    search?: string;
    nonce: number;
  } | null>(null);
  const [catBranchFilter, setCatBranchFilter] = useState<string>('ALL');
  const [catClassFilter, setCatClassFilter] = useState<'ALL' | 'Software' | 'Hardware'>('ALL');

  const sortedReports = useMemo(
    () => [...reports].sort((a, b) => b.year - a.year),
    [reports]
  );

  const [selectedView, setSelectedView] = useState<'ALL' | number>(() =>
    sortedReports.length > 0 ? sortedReports[0].year : 'ALL'
  );

  // Month inline edit state
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [monthDraft, setMonthDraft] = useState<{
    doneResolved: number;
    pending: number;
    onGoing: number;
  }>({ doneResolved: 0, pending: 0, onGoing: 0 });

  // Personnel add/edit modal or inline
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonCount, setNewPersonCount] = useState('');
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [personDraft, setPersonDraft] = useState<{ name: string; count: number }>({
    name: '',
    count: 0,
  });

  // Add Year Modal
  const [addYearOpen, setAddYearOpen] = useState(false);
  const [newYearInput, setNewYearInput] = useState(() =>
    String((sortedReports[0]?.year || 2026) + 1)
  );
  const [addYearError, setAddYearError] = useState('');

  // Import CSV Modal
  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<HelpdeskYearReport[]>([]);
  const [importError, setImportError] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeYearReport = useMemo(
    () =>
      selectedView === 'ALL'
        ? null
        : sortedReports.find((r) => r.year === selectedView) ?? sortedReports[0] ?? null,
    [selectedView, sortedReports]
  );

  const activeSummary = useMemo(
    () => (activeYearReport ? summarizeYear(activeYearReport) : null),
    [activeYearReport]
  );

  const allYearsAggregate = useMemo(() => {
    let done = 0;
    let pending = 0;
    let onGoing = 0;
    const personnelMap = new Map<string, number>();

    for (const rep of sortedReports) {
      const sum = summarizeYear(rep);
      done += sum.done;
      pending += sum.pending;
      onGoing += sum.onGoing;
      for (const p of rep.personnels) {
        const key = p.name.trim().toUpperCase();
        personnelMap.set(key, (personnelMap.get(key) || 0) + (Number(p.count) || 0));
      }
    }

    const overall = done + pending + onGoing;
    const resolutionPct = overall > 0 ? ((done / overall) * 100).toFixed(2) : '0.00';
    const combinedPersonnels = Array.from(personnelMap.entries())
      .map(([name, count]) => ({ id: name, name, count }))
      .sort((a, b) => b.count - a.count);

    return { done, pending, onGoing, overall, resolutionPct, combinedPersonnels };
  }, [sortedReports]);

  const updateYearReport = (
    year: number,
    updater: (prev: HelpdeskYearReport) => HelpdeskYearReport
  ) => {
    const next = sortedReports.map((r) => (r.year === year ? updater(r) : r));
    onSaveReports(next);
  };

  const handleSaveMonth = (monthName: string) => {
    if (!activeYearReport) return;
    updateYearReport(activeYearReport.year, (rep) => ({
      ...rep,
      months: rep.months.map((m) =>
        m.month === monthName
          ? {
              ...m,
              doneResolved: Math.max(0, Number(monthDraft.doneResolved) || 0),
              pending: Math.max(0, Number(monthDraft.pending) || 0),
              onGoing: Math.max(0, Number(monthDraft.onGoing) || 0),
            }
          : m
      ),
    }));
    setEditingMonth(null);
  };

  const handleAddPersonnel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeYearReport) return;
    const cleanName = newPersonName.trim().toUpperCase();
    if (!cleanName) return;
    const count = Math.max(0, Number(newPersonCount) || 0);
    updateYearReport(activeYearReport.year, (rep) => ({
      ...rep,
      personnels: [
        ...rep.personnels,
        { id: generateUid('hp'), name: cleanName, count },
      ],
    }));
    setNewPersonName('');
    setNewPersonCount('');
  };

  const handleSavePersonnelEdit = (personId: string) => {
    if (!activeYearReport) return;
    const cleanName = personDraft.name.trim().toUpperCase();
    if (!cleanName) return;
    updateYearReport(activeYearReport.year, (rep) => ({
      ...rep,
      personnels: rep.personnels.map((p) =>
        p.id === personId
          ? { ...p, name: cleanName, count: Math.max(0, Number(personDraft.count) || 0) }
          : p
      ),
    }));
    setEditingPersonId(null);
  };

  const handleDeletePersonnel = (personId: string) => {
    if (!activeYearReport) return;
    updateYearReport(activeYearReport.year, (rep) => ({
      ...rep,
      personnels: rep.personnels.filter((p) => p.id !== personId),
    }));
  };

  const handleCreateYear = (e: React.FormEvent) => {
    e.preventDefault();
    const yr = Number(newYearInput);
    if (!Number.isFinite(yr) || yr < 2000 || yr > 2100) {
      setAddYearError('Enter a valid 4-digit year (2000–2100).');
      return;
    }
    if (sortedReports.some((r) => r.year === yr)) {
      setAddYearError(`Year ${yr} already exists in Helpdesk Report.`);
      return;
    }
    const created: HelpdeskYearReport = {
      year: yr,
      months: MONTHS_ORDER.map((month) => ({
        month,
        doneResolved: 0,
        pending: 0,
        onGoing: 0,
      })),
      personnels: [
        { id: generateUid('hp'), name: 'MAC', count: 0 },
        { id: generateUid('hp'), name: 'FRANCIS', count: 0 },
        { id: generateUid('hp'), name: 'VHON', count: 0 },
      ],
    };
    onSaveReports([created, ...sortedReports].sort((a, b) => b.year - a.year));
    setSelectedView(yr);
    setAddYearError('');
    setAddYearOpen(false);
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const parsed = parseHelpdeskCsv(text);
        if (parsed.length === 0) {
          setImportError(
            'Could not detect helpdesk year blocks or monthly rows in this CSV file.'
          );
          setImportPreview([]);
          return;
        }
        setImportError('');
        setImportPreview(parsed);
      } catch {
        setImportError('Failed to parse CSV file.');
        setImportPreview([]);
      }
    };
    reader.readAsText(file);
  };

  const handleApplyImport = () => {
    if (importPreview.length === 0) return;
    const mergedMap = new Map<number, HelpdeskYearReport>();
    for (const existing of sortedReports) {
      mergedMap.set(existing.year, existing);
    }
    for (const incoming of importPreview) {
      const existing = mergedMap.get(incoming.year);
      mergedMap.set(incoming.year, {
        year: incoming.year,
        months: incoming.months,
        personnels:
          incoming.personnels.length > 0
            ? incoming.personnels
            : existing?.personnels ?? [],
      });
    }
    const next = Array.from(mergedMap.values()).sort((a, b) => b.year - a.year);
    onSaveReports(next);
    setSelectedView(importPreview[0].year);
    setImportPreview([]);
    setImportFileName('');
    setImportOpen(false);
  };

  const handleExportCsv = () => {
    if (selectedView === 'ALL') {
      const flatRows = sortedReports.flatMap((rep) =>
        rep.months.map((m) => ({
          year: rep.year,
          month: m.month,
          doneResolved: m.doneResolved,
          pending: m.pending,
          onGoing: m.onGoing,
          total: m.doneResolved + m.pending + m.onGoing,
        }))
      );
      exportToCsv(
        'IT_HELPDESK_REPORT_ALL_YEARS.csv',
        [
          { key: 'year', label: 'Year' },
          { key: 'month', label: 'Month' },
          { key: 'doneResolved', label: 'Done / Resolved' },
          { key: 'pending', label: 'Pending' },
          { key: 'onGoing', label: 'On-Going' },
          { key: 'total', label: 'Total' },
        ],
        flatRows
      );
    } else if (activeYearReport) {
      const rows = activeYearReport.months.map((m) => ({
        year: activeYearReport.year,
        month: m.month,
        doneResolved: m.doneResolved,
        pending: m.pending,
        onGoing: m.onGoing,
        total: m.doneResolved + m.pending + m.onGoing,
      }));
      exportToCsv(
        `IT_HELPDESK_REPORT_${activeYearReport.year}.csv`,
        [
          { key: 'year', label: 'Year' },
          { key: 'month', label: 'Month' },
          { key: 'doneResolved', label: 'Done / Resolved' },
          { key: 'pending', label: 'Pending' },
          { key: 'onGoing', label: 'On-Going' },
          { key: 'total', label: 'Total' },
        ],
        rows
      );
    }
  };

  // Determine chart scaling
  const maxMonthVolume = useMemo(() => {
    if (!activeYearReport) return 1;
    return Math.max(
      1,
      ...activeYearReport.months.map((m) => m.doneResolved + m.pending + m.onGoing)
    );
  }, [activeYearReport]);

  const maxYearVolume = useMemo(() => {
    return Math.max(
      1,
      ...sortedReports.map((r) => summarizeYear(r).overall)
    );
  }, [sortedReports]);

  const displayTotals =
    selectedView === 'ALL'
      ? allYearsAggregate
      : activeSummary ?? {
          done: 0,
          pending: 0,
          onGoing: 0,
          overall: 0,
          resolutionPct: '0.00',
          personnelTotal: 0,
          topPersonnel: undefined,
          peakMonth: undefined,
        };

  const categorizationBranches = useMemo(() => {
    const set = new Set<string>(OFFICIAL_BRANCH_LOCATIONS);
    for (const t of tickets) {
      const b = normalizeBranchLocation(t.branchLocation || '');
      if (b) set.add(b);
    }
    const officialSet = new Set<string>(OFFICIAL_BRANCH_LOCATIONS);
    return Array.from(set).sort((a, b) => {
      const oa = officialSet.has(a);
      const ob = officialSet.has(b);
      if (oa !== ob) return oa ? -1 : 1;
      return a.localeCompare(b);
    });
  }, [tickets]);

  const classFilteredTickets = useMemo(() => {
    if (catClassFilter === 'ALL') return tickets;
    return tickets.filter(
      (t) =>
        (t.classification || '').trim().toLowerCase() ===
        catClassFilter.toLowerCase()
    );
  }, [tickets, catClassFilter]);

  const branchOverviewSummary = useMemo(
    () => summarizeHelpdeskCategories(classFilteredTickets, true),
    [classFilteredTickets]
  );

  const categorizationSummary = useMemo(() => {
    const filtered = classFilteredTickets.filter((t) => {
      if (
        catBranchFilter !== 'ALL' &&
        normalizeBranchLocation(t.branchLocation || '') !== catBranchFilter
      ) {
        return false;
      }
      return true;
    });
    return summarizeHelpdeskCategories(filtered, true);
  }, [classFilteredTickets, catBranchFilter]);

  const jumpToCategoryTickets = (
    category: string,
    branchOverride?: string,
    searchOverride?: string
  ) => {
    setRequestedFilter({
      category,
      branch: branchOverride ?? catBranchFilter,
      search: searchOverride ?? '',
      nonce: Date.now(),
    });
    setActiveTab('tickets');
  };

  const handleExportCategorySummaryCsv = () => {
    exportToCsv(
      'IT_HELPDESK_2026_CATEGORY_SUMMARY.csv',
      [
        { key: 'rank', label: 'Rank' },
        { key: 'category', label: 'Concern Category' },
        { key: 'count', label: 'Tickets' },
        { key: 'sharePct', label: 'Share (%)' },
        { key: 'softwareCount', label: 'Software' },
        { key: 'hardwareCount', label: 'Hardware' },
        { key: 'resolvedCount', label: 'Done / Resolved' },
        { key: 'avgResolutionDays', label: 'Avg Solve (Days)' },
        { key: 'maxResolutionDays', label: 'Max Solve (Days)' },
        { key: 'topBranch', label: 'Top Branch' },
        { key: 'topNatureOfWork', label: 'Primary Nature of Work' },
        { key: 'totalCost', label: 'Recorded Cost' },
      ],
      categorizationSummary.categories.map((c, idx) => ({
        rank: idx + 1,
        category: c.category,
        count: c.count,
        sharePct: c.sharePct.toFixed(1),
        softwareCount: c.softwareCount,
        hardwareCount: c.hardwareCount,
        resolvedCount: c.resolvedCount,
        avgResolutionDays: c.avgResolutionDays.toFixed(2),
        maxResolutionDays: c.maxResolutionDays,
        topBranch: c.topBranch,
        topNatureOfWork: c.topNatureOfWork,
        totalCost: c.totalCost.toFixed(2),
      }))
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            IT Helpdesk Report
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Annual &amp; monthly ticket status monitoring, personnel counts, and detailed 2026 request log
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ModuleGoogleSheetsBar
            links={googleSheetLinks}
            moduleTarget="helpdesk"
            onAddLink={onAddSheetLink}
            onEditLink={onEditSheetLink}
          />

          {activeTab === 'summary' && (
            <>
              <button
                type="button"
                onClick={() => {
                  setNewYearInput(String((sortedReports[0]?.year || 2026) + 1));
                  setAddYearError('');
                  setAddYearOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-orange-600 text-white hover:bg-orange-700 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Year</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setImportError('');
                  setImportPreview([]);
                  setImportFileName('');
                  setImportOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import Report CSV</span>
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sub-Tab Switcher */}
      <div className="inline-flex flex-wrap items-center gap-1 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('summary')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'summary'
              ? 'bg-orange-600 text-white'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          Annual &amp; Monthly Summary (2022–{sortedReports[0]?.year || 2026})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('tickets')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'tickets'
              ? 'bg-orange-600 text-white'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <span>2026 Ticket Log</span>
          <span
            className={`font-mono text-[11px] tabular-nums px-1.5 py-0.5 rounded ${
              activeTab === 'tickets'
                ? 'bg-orange-700/70 text-white'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
            }`}
          >
            {tickets.length.toLocaleString()}
          </span>
        </button>
      </div>

      {activeTab === 'tickets' ? (
        <HelpdeskTicketLogPanel
          tickets={tickets}
          onSaveTickets={onSaveTickets}
          onReloadInitialLog={onReloadInitialLog}
          reloadingLog={reloadingLog}
          requestedFilter={requestedFilter}
        />
      ) : (
        <>
      {/* Year Filter Bar */}
      <div className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-2">
        <button
          type="button"
          onClick={() => {
            setSelectedView('ALL');
            setEditingMonth(null);
            setEditingPersonId(null);
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
            selectedView === 'ALL'
              ? 'bg-orange-600 text-white'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          All Years ({sortedReports.length})
        </button>

        {sortedReports.map((rep) => {
          const active = selectedView === rep.year;
          const sum = summarizeYear(rep);
          return (
            <button
              key={rep.year}
              type="button"
              onClick={() => {
                setSelectedView(rep.year);
                setEditingMonth(null);
                setEditingPersonId(null);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-orange-600 text-white'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              <span className="font-mono">{rep.year}</span>
              <span
                className={`font-mono text-[11px] tabular-nums ${
                  active ? 'text-orange-100' : 'text-stone-400 dark:text-stone-500'
                }`}
              >
                ({sum.overall.toLocaleString()})
              </span>
            </button>
          );
        })}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-4">
          <div className="flex items-center justify-between gap-2 text-stone-500 dark:text-stone-400">
            <span className="text-xs font-medium">Overall Tickets</span>
            <BarChart3 className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-stone-900 dark:text-stone-100">
            {displayTotals.overall.toLocaleString()}
          </p>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
            {selectedView === 'ALL'
              ? `Cumulative across ${sortedReports.length} reporting years`
              : activeSummary?.peakMonth && activeSummary.peakMonth.doneResolved > 0
              ? `Peak: ${activeSummary.peakMonth.month} (${(
                  activeSummary.peakMonth.doneResolved +
                  activeSummary.peakMonth.pending +
                  activeSummary.peakMonth.onGoing
                ).toLocaleString()})`
              : `Year ${selectedView} monitoring`}
          </p>
        </div>

        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-4">
          <div className="flex items-center justify-between gap-2 text-stone-500 dark:text-stone-400">
            <span className="text-xs font-medium">Done / Resolved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="font-mono text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
              {displayTotals.done.toLocaleString()}
            </p>
            <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {displayTotals.resolutionPct}%
            </span>
          </div>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
            Completed support tickets
          </p>
        </div>

        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-4">
          <div className="flex items-center justify-between gap-2 text-stone-500 dark:text-stone-400">
            <span className="text-xs font-medium">Pending</span>
            <Clock className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          </div>
          <p
            className={`mt-2 font-mono text-2xl font-bold tabular-nums ${
              displayTotals.pending > 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-stone-900 dark:text-stone-100'
            }`}
          >
            {displayTotals.pending.toLocaleString()}
          </p>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
            Awaiting action or parts
          </p>
        </div>

        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-4">
          <div className="flex items-center justify-between gap-2 text-stone-500 dark:text-stone-400">
            <span className="text-xs font-medium">On-Going</span>
            <RefreshCw className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          </div>
          <p
            className={`mt-2 font-mono text-2xl font-bold tabular-nums ${
              displayTotals.onGoing > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-stone-900 dark:text-stone-100'
            }`}
          >
            {displayTotals.onGoing.toLocaleString()}
          </p>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
            Active tickets in progress
          </p>
        </div>
      </div>

      {/* Charts + Personnel Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Monthly or Multi-Year Chart */}
        <section className="lg:col-span-7 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-stone-100 dark:border-stone-800">
            <div>
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <span>
                  {selectedView === 'ALL'
                    ? 'Year-over-Year Ticket Volume (2022–Present)'
                    : `${activeYearReport?.year} Monthly Ticket Distribution`}
                </span>
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                {selectedView === 'ALL'
                  ? 'Annual resolved ticket progression across reporting years'
                  : 'Done / Resolved, Pending, and On-Going volume from January to December'}
              </p>
            </div>
          </div>

          {selectedView === 'ALL' ? (
            <div className="flex-1 pt-6 flex items-end justify-around gap-3 min-h-[240px]">
              {[...sortedReports]
                .sort((a, b) => a.year - b.year)
                .map((rep) => {
                  const sum = summarizeYear(rep);
                  const heightPct = Math.max(
                    6,
                    Math.round((sum.overall / maxYearVolume) * 100)
                  );
                  return (
                    <button
                      key={rep.year}
                      type="button"
                      onClick={() => setSelectedView(rep.year)}
                      className="flex-1 max-w-[92px] flex flex-col items-center gap-2 group h-full justify-end"
                    >
                      <span className="font-mono text-xs font-bold tabular-nums text-stone-800 dark:text-stone-200">
                        {sum.overall.toLocaleString()}
                      </span>
                      <div className="w-full h-44 bg-stone-100 dark:bg-stone-800/70 rounded-lg flex items-end overflow-hidden p-1">
                        <div
                          className="w-full rounded-md bg-orange-600 group-hover:bg-orange-500 transition-all"
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs font-semibold text-stone-700 dark:text-stone-300 group-hover:text-orange-600">
                        {rep.year}
                      </span>
                    </button>
                  );
                })}
            </div>
          ) : (
            <div className="flex-1 pt-6 overflow-x-auto">
              <div className="min-w-[540px] flex items-end justify-between gap-2 h-56 pt-4">
                {activeYearReport?.months.map((m) => {
                  const rowTotal = m.doneResolved + m.pending + m.onGoing;
                  const heightPct =
                    rowTotal > 0 ? Math.max(5, Math.round((rowTotal / maxMonthVolume) * 100)) : 2;
                  const doneRatio = rowTotal > 0 ? (m.doneResolved / rowTotal) * 100 : 100;
                  const pendingRatio = rowTotal > 0 ? (m.pending / rowTotal) * 100 : 0;
                  const ongoingRatio = rowTotal > 0 ? (m.onGoing / rowTotal) * 100 : 0;
                  return (
                    <div
                      key={m.month}
                      className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end"
                      title={`${m.month}: Done ${m.doneResolved}, Pending ${m.pending}, On-Going ${m.onGoing}`}
                    >
                      <span className="font-mono text-[11px] font-semibold tabular-nums text-stone-700 dark:text-stone-300">
                        {rowTotal > 0 ? rowTotal : '0'}
                      </span>
                      <div className="w-full h-40 bg-stone-100 dark:bg-stone-800/70 rounded-md flex items-end overflow-hidden p-0.5">
                        <div
                          className="w-full rounded-sm overflow-hidden flex flex-col justify-end transition-all"
                          style={{ height: `${heightPct}%` }}
                        >
                          {ongoingRatio > 0 && (
                            <div
                              className="w-full bg-amber-500"
                              style={{ height: `${ongoingRatio}%` }}
                            />
                          )}
                          {pendingRatio > 0 && (
                            <div
                              className="w-full bg-rose-500"
                              style={{ height: `${pendingRatio}%` }}
                            />
                          )}
                          <div
                            className={`w-full ${
                              rowTotal > 0
                                ? 'bg-orange-600 dark:bg-orange-500'
                                : 'bg-stone-300 dark:bg-stone-700'
                            }`}
                            style={{ height: `${doneRatio}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-stone-600 dark:text-stone-400">
                        {m.month.slice(0, 3)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Right: Personnel Ticket Distribution */}
        <section className="lg:col-span-5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-stone-100 dark:border-stone-800">
            <div>
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <span>
                  {selectedView === 'ALL'
                    ? 'Personnel Cumulative Volume'
                    : `${activeYearReport?.year} Personnels`}
                </span>
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Tickets handled per IT personnel
              </p>
            </div>
            {selectedView !== 'ALL' && activeSummary && (
              <span className="font-mono text-xs font-semibold tabular-nums text-stone-700 dark:text-stone-300">
                Total: {activeSummary.personnelTotal.toLocaleString()}
              </span>
            )}
          </div>

          <div className="flex-1 pt-4 space-y-3">
            {(() => {
              const list =
                selectedView === 'ALL'
                  ? allYearsAggregate.combinedPersonnels
                  : [...(activeYearReport?.personnels ?? [])].sort(
                      (a, b) => b.count - a.count
                    );
              const totalCount = list.reduce((s, p) => s + p.count, 0);

              if (list.length === 0) {
                return (
                  <p className="text-xs text-stone-500 dark:text-stone-400 py-6 text-center">
                    No personnel counts recorded for this period yet.
                  </p>
                );
              }

              return list.map((person) => {
                const share =
                  totalCount > 0 ? Math.round((person.count / totalCount) * 100) : 0;
                const isEditing = editingPersonId === person.id;

                return (
                  <div
                    key={person.id}
                    className="p-2.5 rounded-lg bg-stone-50 dark:bg-stone-800/40 border border-stone-200/70 dark:border-stone-800 space-y-1.5"
                  >
                    {isEditing && selectedView !== 'ALL' ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={personDraft.name}
                          onChange={(e) =>
                            setPersonDraft((d) => ({ ...d, name: e.target.value }))
                          }
                          className="flex-1 min-w-0 px-2 py-1 text-xs font-semibold rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                        />
                        <input
                          type="number"
                          min={0}
                          value={personDraft.count}
                          onChange={(e) =>
                            setPersonDraft((d) => ({
                              ...d,
                              count: Math.max(0, Number(e.target.value) || 0),
                            }))
                          }
                          className="w-20 px-2 py-1 text-xs font-mono rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                        />
                        <button
                          type="button"
                          onClick={() => handleSavePersonnelEdit(person.id)}
                          className="p-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                          aria-label="Save personnel"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingPersonId(null)}
                          className="p-1.5 rounded border border-stone-300 dark:border-stone-700 text-stone-500"
                          aria-label="Cancel edit"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-stone-900 dark:text-stone-100 truncate">
                          {person.name}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono font-bold tabular-nums text-stone-900 dark:text-stone-100">
                            {person.count.toLocaleString()}
                          </span>
                          <span className="font-mono text-[11px] tabular-nums text-stone-500 dark:text-stone-400">
                            ({share}%)
                          </span>
                          {selectedView !== 'ALL' && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPersonId(person.id);
                                  setPersonDraft({
                                    name: person.name,
                                    count: person.count,
                                  });
                                }}
                                aria-label={`Edit ${person.name}`}
                                className="p-1 text-stone-400 hover:text-orange-600"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePersonnel(person.id)}
                                aria-label={`Remove ${person.name}`}
                                className="p-1 text-stone-400 hover:text-rose-600"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="h-2 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-orange-600 dark:bg-orange-500 transition-all"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {selectedView !== 'ALL' && (
            <form
              onSubmit={handleAddPersonnel}
              className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center gap-2"
            >
              <input
                type="text"
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                placeholder="Personnel name (e.g. VHON)"
                className="flex-1 min-w-0 px-2.5 py-1.5 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
              <input
                type="number"
                min={0}
                value={newPersonCount}
                onChange={(e) => setNewPersonCount(e.target.value)}
                placeholder="Count"
                className="w-20 px-2.5 py-1.5 text-xs font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-orange-600 text-white hover:bg-orange-700 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </form>
          )}
        </section>
      </div>

      {/* Helpdesk Concern Categorization & Most Needed Category */}
      {tickets.length > 0 && (
        <section className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <Tag className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <span>Helpdesk Concern Categorization &amp; Most Needed Support (2026 Log)</span>
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Ranked breakdown of {categorizationSummary.totalTickets.toLocaleString()} logged support requests by concern category — click any category to inspect its tickets
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={catBranchFilter}
                onChange={(e) => setCatBranchFilter(e.target.value)}
                aria-label="Filter categorization by branch"
                className="px-2.5 py-1.5 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-800 dark:text-stone-200"
              >
                <option value="ALL">All Branches</option>
                {categorizationBranches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>

              <div className="inline-flex rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 p-0.5 text-[11px] font-semibold">
                {(['ALL', 'Software', 'Hardware'] as const).map((cls) => (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => setCatClassFilter(cls)}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      catClassFilter === cls
                        ? 'bg-orange-600 text-white'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                    }`}
                  >
                    {cls === 'ALL' ? 'All Types' : cls}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleExportCategorySummaryCsv}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Categories</span>
              </button>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {categorizationSummary.totalTickets === 0 ? (
              <p className="text-xs text-stone-500 dark:text-stone-400 text-center py-6">
                No tickets match the selected branch/classification filter.
              </p>
            ) : (
              <>
                {/* Top Category Spotlight Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* #1 Most Needed Concern Spotlight */}
                  {categorizationSummary.topCategory && (
                    <div className="lg:col-span-5 rounded-xl border border-orange-200 dark:border-orange-900/60 bg-orange-50/70 dark:bg-orange-950/25 p-4 flex flex-col justify-between gap-3">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-orange-700 dark:text-orange-400">
                            #1 Most Needed Helpdesk Concern
                          </span>
                          <span className="font-mono text-xs font-bold tabular-nums text-orange-700 dark:text-orange-300">
                            {categorizationSummary.topCategory.sharePct.toFixed(1)}% of requests
                          </span>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2.5">
                          <h3 className="font-display text-2xl font-bold text-stone-900 dark:text-stone-100">
                            {categorizationSummary.topCategory.category}
                          </h3>
                          <span className="font-mono text-lg font-bold tabular-nums text-orange-600 dark:text-orange-400">
                            {categorizationSummary.topCategory.count.toLocaleString()} tickets
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs text-stone-600 dark:text-stone-300">
                          Top branch: <strong>{categorizationSummary.topCategory.topBranch}</strong> · Primary work:{' '}
                          <strong>{categorizationSummary.topCategory.topNatureOfWork}</strong>
                        </p>
                        {categorizationSummary.topCategory.sampleConcerns.length > 0 && (
                          <p className="mt-2 text-[11px] text-stone-500 dark:text-stone-400 line-clamp-2">
                            Common requests: {categorizationSummary.topCategory.sampleConcerns.join(' · ')}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-orange-200/70 dark:border-orange-900/40 text-xs">
                        <span className="text-stone-600 dark:text-stone-400 font-mono tabular-nums">
                          SW: {categorizationSummary.topCategory.softwareCount.toLocaleString()} · HW:{' '}
                          {categorizationSummary.topCategory.hardwareCount.toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            jumpToCategoryTickets(categorizationSummary.topCategory!.category)
                          }
                          className="inline-flex items-center gap-1 font-semibold text-orange-700 dark:text-orange-300 hover:underline"
                        >
                          <span>Inspect {categorizationSummary.topCategory.category} Tickets</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* #2 & #3 Next Highest Concerns */}
                  <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                    {categorizationSummary.categories.slice(1, 3).map((cat, idx) => (
                      <button
                        key={cat.category}
                        type="button"
                        onClick={() => jumpToCategoryTickets(cat.category)}
                        className="text-left p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/80 dark:bg-stone-800/40 hover:border-orange-300 dark:hover:border-orange-800 transition-colors flex flex-col justify-between gap-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                            #{idx + 2} Category Needed
                          </span>
                          <span className="font-mono text-xs font-semibold tabular-nums text-stone-700 dark:text-stone-300">
                            {cat.sharePct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-bold text-stone-900 dark:text-stone-100">
                            {cat.category}
                          </span>
                          <span className="font-mono text-sm font-bold tabular-nums text-orange-600 dark:text-orange-400">
                            {cat.count.toLocaleString()} tickets
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-orange-500"
                            style={{ width: `${Math.min(100, Math.round(cat.sharePct * 2))}%` }}
                          />
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Software vs Hardware & Work Nature Summary */}
                  <div className="lg:col-span-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/80 dark:bg-stone-800/40 p-4 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-800 dark:text-stone-200">
                        <Layers className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                        <span>Classification Split</span>
                      </div>
                      <div className="mt-2.5 space-y-1.5">
                        <div className="flex justify-between text-[11px] font-mono tabular-nums">
                          <span className="text-stone-700 dark:text-stone-300">
                            Software: <strong>{categorizationSummary.softwareCount.toLocaleString()}</strong> (
                            {((categorizationSummary.softwareCount / categorizationSummary.totalTickets) * 100).toFixed(1)}%)
                          </span>
                          <span className="text-stone-700 dark:text-stone-300">
                            HW: <strong>{categorizationSummary.hardwareCount.toLocaleString()}</strong>
                          </span>
                        </div>
                        <div className="h-2.5 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden flex">
                          <div
                            className="h-full bg-orange-600"
                            style={{
                              width: `${
                                (categorizationSummary.softwareCount /
                                  categorizationSummary.totalTickets) *
                                100
                              }%`,
                            }}
                          />
                          <div
                            className="h-full bg-amber-500"
                            style={{
                              width: `${
                                (categorizationSummary.hardwareCount /
                                  categorizationSummary.totalTickets) *
                                100
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-stone-200 dark:border-stone-700 space-y-1.5">
                      <p className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                        Top Nature of Work
                      </p>
                      {categorizationSummary.naturesOfWork.slice(0, 3).map((n) => (
                        <div
                          key={n.name}
                          className="flex items-center justify-between gap-2 text-[11px]"
                        >
                          <span className="text-stone-700 dark:text-stone-300 truncate">
                            {n.name}
                          </span>
                          <span className="font-mono font-semibold tabular-nums text-stone-900 dark:text-stone-100 shrink-0">
                            {n.count.toLocaleString()} ({n.sharePct.toFixed(0)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Branch / Location Top Concern Cards */}
                {branchOverviewSummary.byBranch.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5 uppercase tracking-wider">
                        <MapPin className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                        <span>Most Needed Concern by Branch / Location</span>
                      </h3>
                      {catBranchFilter !== 'ALL' && (
                        <button
                          type="button"
                          onClick={() => setCatBranchFilter('ALL')}
                          className="text-[11px] font-medium text-orange-600 dark:text-orange-400 hover:underline"
                        >
                          Show all branches ({catBranchFilter} selected)
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {branchOverviewSummary.byBranch
                        .filter((b) => b.isOfficial || b.totalTickets > 0)
                        .map((b) => {
                          const isSelected = catBranchFilter === b.branch;
                          return (
                            <div
                              key={b.branch}
                              className={`rounded-xl border p-3.5 transition-colors flex flex-col justify-between gap-2.5 ${
                                isSelected
                                  ? 'border-orange-500 bg-orange-50/70 dark:bg-orange-950/30'
                                  : 'border-stone-200 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-800/30 hover:border-orange-300 dark:hover:border-orange-800'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setCatBranchFilter(isSelected ? 'ALL' : b.branch)
                                }
                                className="text-left space-y-1.5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                                    {b.branch}
                                  </span>
                                  <span className="font-mono text-xs font-bold tabular-nums text-stone-700 dark:text-stone-300 shrink-0">
                                    {b.totalTickets.toLocaleString()}
                                  </span>
                                </div>

                                <div className="text-[11px] text-stone-600 dark:text-stone-300">
                                  Top:{' '}
                                  <strong className="text-orange-700 dark:text-orange-400">
                                    {b.topCategory}
                                  </strong>{' '}
                                  {b.topCategoryCount > 0 && (
                                    <span className="font-mono tabular-nums text-stone-500 dark:text-stone-400">
                                      ({b.topCategoryCount} · {b.topCategorySharePct.toFixed(0)}%)
                                    </span>
                                  )}
                                </div>

                                {b.topCategories.length > 1 && (
                                  <div className="pt-1 flex flex-wrap gap-1">
                                    {b.topCategories.slice(0, 3).map((tc) => (
                                      <span
                                        key={tc.category}
                                        className="px-1.5 py-0.5 rounded bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-[10px] font-mono text-stone-600 dark:text-stone-300"
                                      >
                                        {tc.category}: {tc.count}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </button>

                              <div className="pt-1.5 border-t border-stone-200/70 dark:border-stone-700/70 flex items-center justify-between text-[11px]">
                                <span className="font-mono text-stone-500 dark:text-stone-400">
                                  {b.sharePct.toFixed(1)}% share
                                </span>
                                <button
                                  type="button"
                                  onClick={() => jumpToCategoryTickets('ALL', b.branch)}
                                  className="font-semibold text-orange-700 dark:text-orange-400 hover:underline"
                                >
                                  View Branch →
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Longest Problems to Solve (Resolution Duration Analysis) */}
                <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/40 p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5 uppercase tracking-wider">
                        <Hourglass className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>Longest Problems to Solve (Date Start → Date Finish)</span>
                      </h3>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                        Identifies multi-day incidents and slowest-to-resolve concern categories across the logged requests
                      </p>
                    </div>
                    <span className="font-mono text-[11px] font-semibold px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/60">
                      {categorizationSummary.multiDayCount} multi-day ticket{categorizationSummary.multiDayCount === 1 ? '' : 's'} (1+ days)
                    </span>
                  </div>

                  {categorizationSummary.longestTickets.length === 0 ? (
                    <p className="text-xs text-stone-500 dark:text-stone-400 py-3">
                      All {categorizationSummary.totalTickets.toLocaleString()} tickets in this view were resolved on the same day.
                    </p>
                  ) : (
                    <>
                      {(() => {
                        const topLongest = categorizationSummary.longestTickets[0];
                        const tiedCount = categorizationSummary.longestTickets.filter(
                          (item) => item.days === topLongest.days
                        ).length;
                        const slowestCat = categorizationSummary.slowestCategory;
                        return (
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                            {/* #1 Longest Single Problem */}
                            <div className="lg:col-span-7 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 p-3.5 flex flex-col justify-between gap-2.5">
                              <div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                                    #1 Longest Single Problem to Solve
                                  </span>
                                  <span className="font-mono text-xs font-bold tabular-nums px-2 py-0.5 rounded bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                                    {topLongest.days} day{topLongest.days === 1 ? '' : 's'}
                                  </span>
                                </div>

                                <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
                                  <span className="font-mono text-sm font-bold text-stone-900 dark:text-stone-100">
                                    #{topLongest.ticket.ticketNo}
                                  </span>
                                  <span className="text-sm font-bold text-stone-900 dark:text-stone-100">
                                    {topLongest.ticket.description}
                                  </span>
                                </div>

                                <p className="mt-1 text-[11px] text-stone-600 dark:text-stone-300">
                                  Category: <strong>{topLongest.category}</strong> · Branch:{' '}
                                  <strong>{topLongest.branch}</strong> ·{' '}
                                  {topLongest.ticket.dateStart || topLongest.ticket.date} →{' '}
                                  {topLongest.ticket.dateFinish || topLongest.ticket.date}
                                </p>

                                {topLongest.ticket.solution && (
                                  <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
                                    Solution: {topLongest.ticket.solution}
                                    {tiedCount > 1
                                      ? ` (${tiedCount} incidents tied at ${topLongest.days} days)`
                                      : ''}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-amber-200/70 dark:border-amber-900/40 text-[11px]">
                                <span className="font-mono text-stone-600 dark:text-stone-400">
                                  Attended by: {topLongest.ticket.attendedBy || '—'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    jumpToCategoryTickets(
                                      topLongest.category,
                                      topLongest.branch !== '—' ? topLongest.branch : 'ALL',
                                      topLongest.ticket.description.slice(0, 28)
                                    )
                                  }
                                  className="inline-flex items-center gap-1 font-semibold text-amber-800 dark:text-amber-300 hover:underline"
                                >
                                  <span>Inspect Ticket #{topLongest.ticket.ticketNo}</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {/* Slowest Category on Average */}
                            {slowestCat && (
                              <div className="lg:col-span-5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-3.5 flex flex-col justify-between gap-2.5">
                                <div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                                      Slowest Category on Average
                                    </span>
                                    <span className="font-mono text-xs font-bold tabular-nums text-amber-700 dark:text-amber-400">
                                      {slowestCat.avgResolutionDays.toFixed(1)}d avg
                                    </span>
                                  </div>

                                  <div className="mt-1.5 flex items-baseline justify-between gap-2">
                                    <h4 className="font-display text-lg font-bold text-stone-900 dark:text-stone-100">
                                      {slowestCat.category}
                                    </h4>
                                    <span className="font-mono text-xs font-semibold tabular-nums text-stone-600 dark:text-stone-300">
                                      Max {slowestCat.maxResolutionDays}d · {slowestCat.count} tickets
                                    </span>
                                  </div>

                                  <p className="mt-1 text-[11px] text-stone-600 dark:text-stone-300">
                                    Top branch: <strong>{slowestCat.topBranch}</strong> · Primary work:{' '}
                                    <strong>{slowestCat.topNatureOfWork}</strong>
                                  </p>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-stone-200/70 dark:border-stone-800 text-[11px]">
                                  <span className="font-mono text-stone-500 dark:text-stone-400">
                                    Total elapsed: {slowestCat.totalResolutionDays} days
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => jumpToCategoryTickets(slowestCat.category)}
                                    className="inline-flex items-center gap-1 font-semibold text-orange-700 dark:text-orange-400 hover:underline"
                                  >
                                    <span>View {slowestCat.category} Log</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Top Longest-to-Solve Incidents Table */}
                      <div className="overflow-x-auto border border-stone-200 dark:border-stone-800 rounded-xl bg-white dark:bg-stone-900">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-stone-50 dark:bg-stone-950/70 border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400 uppercase tracking-wider text-[10px]">
                              <th className="py-2 px-3 font-semibold">#</th>
                              <th className="py-2 px-3 font-semibold">Ticket</th>
                              <th className="py-2 px-3 font-semibold text-right">Solve Time</th>
                              <th className="py-2 px-3 font-semibold">Concern &amp; Solution</th>
                              <th className="py-2 px-3 font-semibold">Category</th>
                              <th className="py-2 px-3 font-semibold">Branch</th>
                              <th className="py-2 px-3 font-semibold">Start → Finish</th>
                              <th className="py-2 px-3 font-semibold text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                            {categorizationSummary.longestTickets.map((item, idx) => (
                              <tr
                                key={item.ticket.id}
                                className="hover:bg-stone-50/80 dark:hover:bg-stone-800/40 transition-colors align-top"
                              >
                                <td className="py-2 px-3 font-mono font-bold text-stone-500 dark:text-stone-400">
                                  {idx + 1}
                                </td>
                                <td className="py-2 px-3 font-mono font-bold text-stone-900 dark:text-stone-100 whitespace-nowrap">
                                  #{item.ticket.ticketNo}
                                </td>
                                <td className="py-2 px-3 text-right whitespace-nowrap">
                                  <span
                                    className={`inline-block font-mono text-[11px] font-bold px-2 py-0.5 rounded ${
                                      item.days >= 14
                                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                        : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                    }`}
                                  >
                                    {item.days}d
                                  </span>
                                </td>
                                <td className="py-2 px-3 min-w-[220px] max-w-[360px]">
                                  <div className="font-medium text-stone-900 dark:text-stone-100 line-clamp-1">
                                    {item.ticket.description}
                                  </div>
                                  {item.ticket.solution && (
                                    <div className="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-1">
                                      Solution: {item.ticket.solution}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2 px-3 font-semibold text-stone-800 dark:text-stone-200 whitespace-nowrap">
                                  {item.category}
                                </td>
                                <td className="py-2 px-3 text-stone-700 dark:text-stone-300 whitespace-nowrap">
                                  {item.branch}
                                </td>
                                <td className="py-2 px-3 font-mono text-[11px] text-stone-500 dark:text-stone-400 whitespace-nowrap">
                                  {item.ticket.dateStart || item.ticket.date} →{' '}
                                  {item.ticket.dateFinish || item.ticket.date}
                                </td>
                                <td className="py-2 px-3 text-right whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      jumpToCategoryTickets(
                                        item.category,
                                        item.branch !== '—' ? item.branch : 'ALL',
                                        item.ticket.description.slice(0, 28)
                                      )
                                    }
                                    className="px-2 py-1 rounded text-[11px] font-medium text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/50 hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors"
                                  >
                                    Inspect
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>

                {/* Ranked Category Breakdown Table */}
                <div className="overflow-x-auto border border-stone-200 dark:border-stone-800 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-stone-50 dark:bg-stone-950/70 border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400 uppercase tracking-wider text-[11px]">
                        <th className="py-2.5 px-3 font-semibold">Rank</th>
                        <th className="py-2.5 px-3 font-semibold">Concern Category</th>
                        <th className="py-2.5 px-3 font-semibold min-w-[180px]">Volume Share</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Tickets</th>
                        <th className="py-2.5 px-3 font-semibold text-right">SW / HW</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Avg / Max Solve</th>
                        <th className="py-2.5 px-3 font-semibold">Top Branch</th>
                        <th className="py-2.5 px-3 font-semibold">Primary Nature</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Recorded Cost</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                      {categorizationSummary.categories.map((cat, idx) => {
                        const maxCount = categorizationSummary.topCategory?.count || 1;
                        const relWidth = Math.max(4, Math.round((cat.count / maxCount) * 100));
                        return (
                          <tr
                            key={cat.category}
                            className="hover:bg-stone-50/80 dark:hover:bg-stone-800/40 transition-colors"
                          >
                            <td className="py-2.5 px-3 font-mono font-bold text-stone-500 dark:text-stone-400">
                              #{idx + 1}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-stone-900 dark:text-stone-100 whitespace-nowrap">
                              {cat.category}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      idx === 0
                                        ? 'bg-orange-600'
                                        : idx < 3
                                        ? 'bg-orange-500/80'
                                        : 'bg-stone-400 dark:bg-stone-600'
                                    }`}
                                    style={{ width: `${relWidth}%` }}
                                  />
                                </div>
                                <span className="font-mono text-[11px] tabular-nums text-stone-600 dark:text-stone-400 w-11 text-right">
                                  {cat.sharePct.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-stone-900 dark:text-stone-100">
                              {cat.count.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-[11px] tabular-nums text-stone-600 dark:text-stone-300 whitespace-nowrap">
                              {cat.softwareCount} / {cat.hardwareCount}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-[11px] tabular-nums whitespace-nowrap">
                              {cat.count === 0 ? (
                                <span className="text-stone-400">—</span>
                              ) : cat.maxResolutionDays === 0 ? (
                                <span className="text-stone-500 dark:text-stone-400">Same day</span>
                              ) : (
                                <span className="text-amber-700 dark:text-amber-400 font-semibold">
                                  {cat.avgResolutionDays.toFixed(1)}d · {cat.maxResolutionDays}d max
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-stone-700 dark:text-stone-300 whitespace-nowrap">
                              {cat.topBranch}
                            </td>
                            <td className="py-2.5 px-3 text-stone-600 dark:text-stone-400 whitespace-nowrap">
                              {cat.topNatureOfWork}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-stone-700 dark:text-stone-300 whitespace-nowrap">
                              {cat.totalCost > 0
                                ? `₱${cat.totalCost.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}`
                                : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => jumpToCategoryTickets(cat.category)}
                                className="px-2.5 py-1 rounded-md text-xs font-medium text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/50 hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors whitespace-nowrap"
                              >
                                View Log
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* Bottom Data Table */}
      <section className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <span>
                {selectedView === 'ALL'
                  ? 'Annual Helpdesk Monitoring Summary (2022–Present)'
                  : `${activeYearReport?.year} Monthly Status Monitoring`}
              </span>
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              {selectedView === 'ALL'
                ? 'Click any year row to inspect or update monthly figures'
                : 'Edit monthly Done / Resolved, Pending, or On-Going figures directly'}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          {selectedView === 'ALL' ? (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-50 dark:bg-stone-950/70 border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 font-semibold">Year</th>
                  <th className="py-3 px-4 font-semibold text-right">Done / Resolved</th>
                  <th className="py-3 px-4 font-semibold text-right">Pending</th>
                  <th className="py-3 px-4 font-semibold text-right">On-Going</th>
                  <th className="py-3 px-4 font-semibold text-right">Overall</th>
                  <th className="py-3 px-4 font-semibold text-right">Resolution %</th>
                  <th className="py-3 px-4 font-semibold">Top Personnel</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {sortedReports.map((rep) => {
                  const sum = summarizeYear(rep);
                  return (
                    <tr
                      key={rep.year}
                      className="hover:bg-stone-50/80 dark:hover:bg-stone-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-stone-900 dark:text-stone-100">
                        {rep.year}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                        {sum.done.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-700 dark:text-stone-300">
                        {sum.pending.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-700 dark:text-stone-300">
                        {sum.onGoing.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-stone-900 dark:text-stone-100">
                        {sum.overall.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-700 dark:text-stone-300">
                        {sum.resolutionPct}%
                      </td>
                      <td className="py-3 px-4 text-stone-700 dark:text-stone-300">
                        {sum.topPersonnel
                          ? `${sum.topPersonnel.name} (${sum.topPersonnel.count.toLocaleString()})`
                          : '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedView(rep.year)}
                          className="px-2.5 py-1 rounded-md text-xs font-medium text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/50 hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors whitespace-nowrap"
                        >
                          Open Year
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-stone-100/80 dark:bg-stone-800/60 border-t-2 border-stone-200 dark:border-stone-700 font-bold">
                  <td className="py-3 px-4 text-stone-900 dark:text-stone-100">TOTAL</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                    {allYearsAggregate.done.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-900 dark:text-stone-100">
                    {allYearsAggregate.pending.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-900 dark:text-stone-100">
                    {allYearsAggregate.onGoing.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-900 dark:text-stone-100">
                    {allYearsAggregate.overall.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-900 dark:text-stone-100">
                    {allYearsAggregate.resolutionPct}%
                  </td>
                  <td colSpan={2} className="py-3 px-4 text-stone-500 dark:text-stone-400 font-normal">
                    {sortedReports.length} reporting years
                  </td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-50 dark:bg-stone-950/70 border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 font-semibold">Month</th>
                  <th className="py-3 px-4 font-semibold text-right">Done / Resolved</th>
                  <th className="py-3 px-4 font-semibold text-right">Pending</th>
                  <th className="py-3 px-4 font-semibold text-right">On-Going</th>
                  <th className="py-3 px-4 font-semibold text-right">Monthly Total</th>
                  <th className="py-3 px-4 font-semibold text-right">Rate %</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {activeYearReport?.months.map((row) => {
                  const rowTotal = row.doneResolved + row.pending + row.onGoing;
                  const pct =
                    rowTotal > 0
                      ? `${((row.doneResolved / rowTotal) * 100).toFixed(1)}%`
                      : '—';
                  const isEditing = editingMonth === row.month;

                  return (
                    <tr
                      key={row.month}
                      className="hover:bg-stone-50/80 dark:hover:bg-stone-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-4 font-semibold text-stone-900 dark:text-stone-100">
                        {row.month}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            value={monthDraft.doneResolved}
                            onChange={(e) =>
                              setMonthDraft((d) => ({
                                ...d,
                                doneResolved: Math.max(0, Number(e.target.value) || 0),
                              }))
                            }
                            className="w-20 px-2 py-1 text-right text-xs font-mono rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                          />
                        ) : (
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                            {row.doneResolved.toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            value={monthDraft.pending}
                            onChange={(e) =>
                              setMonthDraft((d) => ({
                                ...d,
                                pending: Math.max(0, Number(e.target.value) || 0),
                              }))
                            }
                            className="w-20 px-2 py-1 text-right text-xs font-mono rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                          />
                        ) : (
                          <span
                            className={
                              row.pending > 0
                                ? 'font-semibold text-rose-600 dark:text-rose-400'
                                : 'text-stone-500 dark:text-stone-400'
                            }
                          >
                            {row.pending.toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            value={monthDraft.onGoing}
                            onChange={(e) =>
                              setMonthDraft((d) => ({
                                ...d,
                                onGoing: Math.max(0, Number(e.target.value) || 0),
                              }))
                            }
                            className="w-20 px-2 py-1 text-right text-xs font-mono rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                          />
                        ) : (
                          <span
                            className={
                              row.onGoing > 0
                                ? 'font-semibold text-amber-600 dark:text-amber-400'
                                : 'text-stone-500 dark:text-stone-400'
                            }
                          >
                            {row.onGoing.toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-stone-900 dark:text-stone-100">
                        {rowTotal.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-stone-600 dark:text-stone-400">
                        {pct}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {isEditing ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleSaveMonth(row.month)}
                              className="px-2 py-1 rounded bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingMonth(null)}
                              className="px-2 py-1 rounded border border-stone-300 dark:border-stone-700 text-[11px] text-stone-600 dark:text-stone-300"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMonth(row.month);
                              setMonthDraft({
                                doneResolved: row.doneResolved,
                                pending: row.pending,
                                onGoing: row.onGoing,
                              });
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {activeSummary && (
                <tfoot>
                  <tr className="bg-stone-100/80 dark:bg-stone-800/60 border-t-2 border-stone-200 dark:border-stone-700 font-bold">
                    <td className="py-3 px-4 text-stone-900 dark:text-stone-100">TOTAL</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                      {activeSummary.done.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-900 dark:text-stone-100">
                      {activeSummary.pending.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-900 dark:text-stone-100">
                      {activeSummary.onGoing.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-900 dark:text-stone-100">
                      {activeSummary.overall.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-900 dark:text-stone-100">
                      {activeSummary.resolutionPct}%
                    </td>
                    <td className="py-3 px-4" />
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </section>
        </>
      )}

      {/* Add Year Modal */}
      <Modal
        isOpen={addYearOpen}
        onClose={() => setAddYearOpen(false)}
        title="Add Helpdesk Reporting Year"
        subtitle="Create a blank January–December monitoring sheet for a new year"
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleCreateYear} className="space-y-4">
          <div>
            <label
              htmlFor="new-helpdesk-year"
              className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5"
            >
              Reporting Year
            </label>
            <input
              id="new-helpdesk-year"
              type="number"
              min={2000}
              max={2100}
              required
              value={newYearInput}
              onChange={(e) => {
                setNewYearInput(e.target.value);
                setAddYearError('');
              }}
              className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
            />
          </div>
          {addYearError && (
            <p className="text-xs text-rose-600 dark:text-rose-400">{addYearError}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAddYearOpen(false)}
              className="px-3.5 py-2 rounded-lg text-xs font-medium border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-orange-600 text-white hover:bg-orange-700"
            >
              Create Year Sheet
            </button>
          </div>
        </form>
      </Modal>

      {/* Import Report CSV Modal */}
      <Modal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import IT Helpdesk Report CSV"
        subtitle="Supports multi-year IT Helpdesk Report matrix CSVs or flat Year,Month,Done,Pending,On-Going CSVs"
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-950/60 text-center space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-orange-600 text-white hover:bg-orange-700"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Select CSV File</span>
            </button>
            {importFileName && (
              <p className="text-xs font-mono text-stone-600 dark:text-stone-400">
                Loaded: {importFileName}
              </p>
            )}
          </div>

          {importError && (
            <p className="text-xs text-rose-600 dark:text-rose-400">{importError}</p>
          )}

          {importPreview.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                Detected Years Ready to Merge ({importPreview.length}):
              </p>
              <div className="divide-y divide-stone-100 dark:divide-stone-800 border border-stone-200 dark:border-stone-800 rounded-lg overflow-hidden">
                {importPreview.map((rep) => {
                  const sum = summarizeYear(rep);
                  return (
                    <div
                      key={rep.year}
                      className="px-3 py-2 flex items-center justify-between text-xs bg-white dark:bg-stone-900"
                    >
                      <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                        {rep.year}
                      </span>
                      <span className="font-mono text-stone-600 dark:text-stone-300 tabular-nums">
                        Overall: {sum.overall.toLocaleString()} · Personnels: {rep.personnels.length}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setImportOpen(false)}
              className="px-3.5 py-2 rounded-lg text-xs font-medium border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={importPreview.length === 0}
              onClick={handleApplyImport}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-40"
            >
              Merge into Helpdesk Reports
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
