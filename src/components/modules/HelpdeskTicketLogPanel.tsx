import React, { useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ClipboardPaste,
  Clock,
  Download,
  Eye,
  Filter,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  Wallet,
} from 'lucide-react';
import { HelpdeskTicket } from '../../types/cmms';
import { exportToCsv } from '../../utils/csv';
import {
  createTicketUid,
  parseHelpdeskTicketLog,
  parseTicketCostAmount,
} from '../../utils/helpdeskTickets';
import { Modal } from '../ui/Modal';

interface HelpdeskTicketLogPanelProps {
  tickets: HelpdeskTicket[];
  onSaveTickets: (nextTickets: HelpdeskTicket[]) => void;
  onReloadInitialLog?: () => Promise<void>;
  reloadingLog?: boolean;
}

const PAGE_SIZE = 25;

const DEFAULT_BRANCHES = [
  'CONCHU WAREHOUSE',
  'TANZA WAREHOUSE',
  'TRISTELLAR BACOOR',
  'JACK BUILDING',
];

const DEFAULT_DEPARTMENTS = [
  'OPERATION',
  'SALES & MARKETING',
  'EXECUTIVE',
  'FINANCE',
  'HUMAN RESOURCE',
];

const DEFAULT_CATEGORIES = [
  'KIOSK',
  'Dropbox',
  'Network',
  'DST',
  'Printer',
  'Computer/Peripherals',
  'OS/MS Office',
  'BIS/APPS',
  'CCTV',
];

const DEFAULT_WORK_NATURES = [
  'Provide Assistance',
  'Troubleshoot',
  'Fix Formula Or Error',
  'Installation/Activate',
  'Asset Deployment/Retrieval',
  'Update/Adjustment',
  'Repair',
];

const DEFAULT_STATUSES = ['DONE / RESOLVED', 'PENDING', 'ON-GOING'];

function todayFormatted(): string {
  return new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export const HelpdeskTicketLogPanel: React.FC<HelpdeskTicketLogPanelProps> = ({
  tickets,
  onSaveTickets,
  onReloadInitialLog,
  reloadingLog = false,
}) => {
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [attendedFilter, setAttendedFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  // Detail modal
  const [viewingTicket, setViewingTicket] = useState<HelpdeskTicket | null>(null);

  // Add / Edit ticket modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [formState, setFormState] = useState<Omit<HelpdeskTicket, 'id'>>({
    ticketNo: 1,
    date: todayFormatted(),
    branchLocation: 'CONCHU WAREHOUSE',
    department: 'OPERATION',
    description: '',
    notedBy: '',
    dateStart: todayFormatted(),
    dateFinish: todayFormatted(),
    attendedBy: 'PATRICK',
    detailsOfNarration: '',
    solution: '',
    classification: 'Software',
    category: 'KIOSK',
    natureOfWork: 'Provide Assistance',
    remarks: '',
    status: 'DONE / RESOLVED',
    cost: '',
  });

  // Paste / Import TSV or CSV modal
  const [importOpen, setImportOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [importError, setImportError] = useState('');
  const [importPreview, setImportPreview] = useState<HelpdeskTicket[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filterOptions = useMemo(() => {
    const branches = new Set<string>(DEFAULT_BRANCHES);
    const depts = new Set<string>(DEFAULT_DEPARTMENTS);
    const categoryMap = new Map<string, string>();
    for (const c of DEFAULT_CATEGORIES) {
      categoryMap.set(c.toUpperCase(), c);
    }
    const attended = new Set<string>(['PATRICK', 'FRANCIS', 'MAC', 'VHON']);

    for (const t of tickets) {
      const b = t.branchLocation.trim().toUpperCase();
      if (b) branches.add(b);
      const d = t.department.trim().toUpperCase();
      if (d) depts.add(d);
      const cRaw = t.category.trim();
      if (cRaw && !categoryMap.has(cRaw.toUpperCase())) {
        categoryMap.set(cRaw.toUpperCase(), cRaw);
      }
      const a = t.attendedBy.trim().toUpperCase();
      if (a) attended.add(a);
    }

    return {
      branches: Array.from(branches).sort(),
      depts: Array.from(depts).sort(),
      categories: Array.from(categoryMap.values()).sort((a, b) =>
        a.localeCompare(b)
      ),
      attended: Array.from(attended).sort(),
    };
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (
        branchFilter !== 'ALL' &&
        t.branchLocation.trim().toUpperCase() !== branchFilter
      ) {
        return false;
      }
      if (
        deptFilter !== 'ALL' &&
        t.department.trim().toUpperCase() !== deptFilter
      ) {
        return false;
      }
      if (
        categoryFilter !== 'ALL' &&
        t.category.trim().toUpperCase() !== categoryFilter.toUpperCase()
      ) {
        return false;
      }
      if (
        attendedFilter !== 'ALL' &&
        t.attendedBy.trim().toUpperCase() !== attendedFilter
      ) {
        return false;
      }
      if (statusFilter !== 'ALL' && t.status.trim().toUpperCase() !== statusFilter) {
        return false;
      }
      if (q) {
        const hay = `${t.ticketNo} ${t.date} ${t.branchLocation} ${t.department} ${t.description} ${t.notedBy} ${t.attendedBy} ${t.solution} ${t.category} ${t.classification} ${t.remarks}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    tickets,
    search,
    branchFilter,
    deptFilter,
    categoryFilter,
    attendedFilter,
    statusFilter,
  ]);

  const kpis = useMemo(() => {
    let resolved = 0;
    let pending = 0;
    let onGoing = 0;
    let totalCost = 0;

    for (const t of filteredTickets) {
      const st = t.status.toUpperCase();
      if (st.includes('DONE') || st.includes('RESOLVED')) {
        resolved += 1;
      } else if (st.includes('PENDING')) {
        pending += 1;
      } else {
        onGoing += 1;
      }
      totalCost += parseTicketCostAmount(t.cost);
    }

    return {
      total: filteredTickets.length,
      resolved,
      pending,
      onGoing,
      totalCost,
    };
  }, [filteredTickets]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const pagedTickets = useMemo(() => {
    const sorted = [...filteredTickets].sort((a, b) => b.ticketNo - a.ticketNo);
    const start = (safePage - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [filteredTickets, safePage]);

  const openNewTicketModal = () => {
    const maxNo = tickets.reduce((m, t) => Math.max(m, t.ticketNo || 0), 0);
    const today = todayFormatted();
    setEditingTicketId(null);
    setFormState({
      ticketNo: maxNo + 1,
      date: today,
      branchLocation: 'CONCHU WAREHOUSE',
      department: 'OPERATION',
      description: '',
      notedBy: '',
      dateStart: today,
      dateFinish: today,
      attendedBy: 'PATRICK',
      detailsOfNarration: '',
      solution: '',
      classification: 'Software',
      category: 'KIOSK',
      natureOfWork: 'Provide Assistance',
      remarks: '',
      status: 'DONE / RESOLVED',
      cost: '',
    });
    setFormOpen(true);
  };

  const openEditTicketModal = (t: HelpdeskTicket) => {
    setEditingTicketId(t.id);
    setFormState({
      ticketNo: t.ticketNo,
      date: t.date,
      branchLocation: t.branchLocation,
      department: t.department,
      description: t.description,
      notedBy: t.notedBy,
      dateStart: t.dateStart,
      dateFinish: t.dateFinish,
      attendedBy: t.attendedBy,
      detailsOfNarration: t.detailsOfNarration,
      solution: t.solution,
      classification: t.classification,
      category: t.category,
      natureOfWork: t.natureOfWork,
      remarks: t.remarks,
      status: t.status,
      cost: t.cost,
    });
    setFormOpen(true);
  };

  const handleSaveTicket = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTicket: HelpdeskTicket = {
      id: editingTicketId ?? createTicketUid(),
      ...formState,
      attendedBy: formState.attendedBy.trim().toUpperCase(),
      detailsOfNarration:
        formState.detailsOfNarration.trim() || formState.description.trim(),
      status: formState.status.trim().toUpperCase() || 'DONE / RESOLVED',
    };

    if (editingTicketId) {
      onSaveTickets(
        tickets.map((t) => (t.id === editingTicketId ? cleanTicket : t))
      );
    } else {
      onSaveTickets([cleanTicket, ...tickets]);
      setPage(1);
    }
    setFormOpen(false);
  };

  const handleDeleteTicket = (id: string) => {
    onSaveTickets(tickets.filter((t) => t.id !== id));
    if (viewingTicket?.id === id) setViewingTicket(null);
  };

  const handlePreviewImportText = (raw: string) => {
    setPasteText(raw);
    if (!raw.trim()) {
      setImportPreview([]);
      setImportError('');
      return;
    }
    const parsed = parseHelpdeskTicketLog(raw);
    if (parsed.length === 0) {
      setImportPreview([]);
      setImportError(
        'No ticket rows detected. Paste rows with columns (#, DATE, BRANCH/LOCATION, DEPARTMENT, DESCRIPTION, ...).'
      );
      return;
    }
    setImportError('');
    setImportPreview(parsed);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      handlePreviewImportText(String(reader.result || ''));
    };
    reader.readAsText(file);
  };

  const handleApplyImport = () => {
    if (importPreview.length === 0) return;
    if (importMode === 'replace') {
      onSaveTickets(importPreview);
    } else {
      const existingNos = new Set(tickets.map((t) => t.ticketNo));
      let nextNo = tickets.reduce((m, t) => Math.max(m, t.ticketNo || 0), 0);
      const appended = importPreview.map((t) => {
        const ticketNo = existingNos.has(t.ticketNo) ? ++nextNo : t.ticketNo;
        existingNos.add(ticketNo);
        return {
          ...t,
          id: createTicketUid(),
          ticketNo,
        };
      });
      onSaveTickets([...appended, ...tickets]);
    }
    setPage(1);
    setPasteText('');
    setImportPreview([]);
    setImportOpen(false);
  };

  const handleExportTicketsCsv = () => {
    exportToCsv(
      'IT_HELPDESK_TICKET_LOG.csv',
      [
        { key: 'ticketNo', label: '#' },
        { key: 'date', label: 'DATE' },
        { key: 'branchLocation', label: 'BRANCH/LOCATION' },
        { key: 'department', label: 'DEPARTMENT' },
        { key: 'description', label: 'DESCRIPTION / CONCERN' },
        { key: 'notedBy', label: 'NOTED BY' },
        { key: 'dateStart', label: 'DATE START' },
        { key: 'dateFinish', label: 'DATE FINISH' },
        { key: 'attendedBy', label: 'ATTENDED BY' },
        { key: 'detailsOfNarration', label: 'DETAILS OF NARRATION' },
        { key: 'solution', label: 'SOLUTION' },
        { key: 'classification', label: 'CLASSIFICATION' },
        { key: 'category', label: 'CATEGORY' },
        { key: 'natureOfWork', label: 'NATURE OF WORK' },
        { key: 'remarks', label: 'REMARKS' },
        { key: 'status', label: 'STATUS' },
        { key: 'cost', label: 'COST' },
      ],
      [...filteredTickets].sort((a, b) => a.ticketNo - b.ticketNo)
    );
  };

  return (
    <div className="space-y-5">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400">
            <span className="text-xs font-medium">Logged Tickets</span>
            <Filter className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-stone-900 dark:text-stone-100">
            {kpis.total.toLocaleString()}
          </p>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
            {filteredTickets.length === tickets.length
              ? 'All recorded IT requests'
              : `Filtered of ${tickets.length.toLocaleString()} total`}
          </p>
        </div>

        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400">
            <span className="text-xs font-medium">Done / Resolved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {kpis.resolved.toLocaleString()}
          </p>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
            {kpis.total > 0
              ? `${((kpis.resolved / kpis.total) * 100).toFixed(1)}% completion`
              : '0% completion'}
          </p>
        </div>

        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400">
            <span className="text-xs font-medium">Pending / On-Going</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p
            className={`mt-2 font-mono text-2xl font-bold tabular-nums ${
              kpis.pending + kpis.onGoing > 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-stone-900 dark:text-stone-100'
            }`}
          >
            {(kpis.pending + kpis.onGoing).toLocaleString()}
          </p>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
            Pending: {kpis.pending} · On-Going: {kpis.onGoing}
          </p>
        </div>

        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400">
            <span className="text-xs font-medium">Recorded Cost</span>
            <Wallet className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-stone-900 dark:text-stone-100">
            ₱{kpis.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
            Parts, batteries &amp; repair fees
          </p>
        </div>
      </div>

      {/* Action & Filter Toolbar */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search ticket #, concern, noted by, solution, branch..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openNewTicketModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-orange-600 text-white hover:bg-orange-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Ticket</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setImportError('');
                setImportPreview([]);
                setPasteText('');
                setImportOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>Paste / Import TSV</span>
            </button>

            <button
              type="button"
              onClick={handleExportTicketsCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Log</span>
            </button>

            {onReloadInitialLog && (
              <button
                type="button"
                disabled={reloadingLog}
                onClick={onReloadInitialLog}
                title="Reload 2026 Helpdesk tickets from updated CSV log"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${reloadingLog ? 'animate-spin' : ''}`}
                />
                <span>Reload 2026 Log</span>
              </button>
            )}
          </div>
        </div>

        {/* Multi-Dropdown Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <select
            value={branchFilter}
            onChange={(e) => {
              setBranchFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-800 dark:text-stone-200"
          >
            <option value="ALL">All Branches</option>
            {filterOptions.branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <select
            value={deptFilter}
            onChange={(e) => {
              setDeptFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-800 dark:text-stone-200"
          >
            <option value="ALL">All Departments</option>
            {filterOptions.depts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-800 dark:text-stone-200"
          >
            <option value="ALL">All Categories</option>
            {filterOptions.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={attendedFilter}
            onChange={(e) => {
              setAttendedFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-800 dark:text-stone-200"
          >
            <option value="ALL">All Personnel</option>
            {filterOptions.attended.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-800 dark:text-stone-200"
          >
            <option value="ALL">All Statuses</option>
            {DEFAULT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Ticket Log Table */}
      <section className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50 dark:bg-stone-950/70 border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3 font-semibold">#</th>
                <th className="py-3 px-3 font-semibold">Date</th>
                <th className="py-3 px-3 font-semibold">Branch &amp; Dept</th>
                <th className="py-3 px-3 font-semibold">Description / Solution</th>
                <th className="py-3 px-3 font-semibold">Noted By</th>
                <th className="py-3 px-3 font-semibold">Attended By</th>
                <th className="py-3 px-3 font-semibold">Category</th>
                <th className="py-3 px-3 font-semibold">Status</th>
                <th className="py-3 px-3 font-semibold text-right">Cost</th>
                <th className="py-3 px-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {pagedTickets.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="py-10 px-4 text-center text-xs text-stone-500 dark:text-stone-400"
                  >
                    {tickets.length === 0
                      ? 'No helpdesk tickets loaded yet. Click "Reload 2026 Log" or "Log Ticket".'
                      : 'No tickets match your current search and filter criteria.'}
                  </td>
                </tr>
              ) : (
                pagedTickets.map((t) => {
                  const isDone =
                    t.status.toUpperCase().includes('DONE') ||
                    t.status.toUpperCase().includes('RESOLVED');
                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-stone-50/80 dark:hover:bg-stone-800/40 transition-colors align-top"
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-stone-900 dark:text-stone-100 whitespace-nowrap">
                        #{t.ticketNo}
                      </td>
                      <td className="py-2.5 px-3 text-stone-600 dark:text-stone-300 whitespace-nowrap">
                        <div>{t.date}</div>
                        {t.dateFinish && t.dateFinish !== t.date && (
                          <div className="text-[10px] text-stone-400">
                            Finish: {t.dateFinish}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-semibold text-stone-900 dark:text-stone-100">
                          {t.branchLocation}
                        </div>
                        <div className="text-[11px] text-stone-500 dark:text-stone-400">
                          {t.department}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 min-w-[220px] max-w-[340px]">
                        <p className="font-medium text-stone-900 dark:text-stone-100 line-clamp-2">
                          {t.description}
                        </p>
                        {t.solution && (
                          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 line-clamp-1">
                            Solution: {t.solution}
                          </p>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-stone-700 dark:text-stone-300 whitespace-nowrap capitalize">
                        {t.notedBy || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-orange-700 dark:text-orange-400 whitespace-nowrap">
                        {t.attendedBy || '—'}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-medium text-stone-800 dark:text-stone-200">
                          {t.category || '—'}
                        </div>
                        <div className="text-[10px] text-stone-400">
                          {t.classification} · {t.natureOfWork}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                            isDone
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : t.status.toUpperCase().includes('PENDING')
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-stone-700 dark:text-stone-300 whitespace-nowrap">
                        {t.cost ? `₱${t.cost}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setViewingTicket(t)}
                            aria-label={`View ticket ${t.ticketNo}`}
                            className="p-1.5 rounded text-stone-500 hover:text-stone-900 hover:bg-stone-100 dark:hover:text-stone-100 dark:hover:bg-stone-800"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditTicketModal(t)}
                            aria-label={`Edit ticket ${t.ticketNo}`}
                            className="p-1.5 rounded text-stone-500 hover:text-orange-600 hover:bg-stone-100 dark:hover:bg-stone-800"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTicket(t.id)}
                            aria-label={`Delete ticket ${t.ticketNo}`}
                            className="p-1.5 rounded text-stone-400 hover:text-rose-600 hover:bg-stone-100 dark:hover:bg-stone-800"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredTickets.length > PAGE_SIZE && (
          <div className="px-4 py-3 border-t border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-600 dark:text-stone-400">
            <span>
              Showing {(safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, filteredTickets.length)} of{' '}
              {filteredTickets.length.toLocaleString()} tickets
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded border border-stone-200 dark:border-stone-700 disabled:opacity-40 hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                Prev
              </button>
              <span className="font-mono px-2">
                Page {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded border border-stone-200 dark:border-stone-700 disabled:opacity-40 hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Ticket Detail Modal */}
      <Modal
        isOpen={Boolean(viewingTicket)}
        onClose={() => setViewingTicket(null)}
        title={viewingTicket ? `Helpdesk Ticket #${viewingTicket.ticketNo}` : ''}
        subtitle={
          viewingTicket
            ? `${viewingTicket.date} · ${viewingTicket.branchLocation} (${viewingTicket.department})`
            : ''
        }
        maxWidthClass="max-w-2xl"
      >
        {viewingTicket && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
              <div>
                <span className="text-stone-500 dark:text-stone-400 block">Noted By</span>
                <strong className="text-stone-900 dark:text-stone-100 capitalize">
                  {viewingTicket.notedBy || '—'}
                </strong>
              </div>
              <div>
                <span className="text-stone-500 dark:text-stone-400 block">Attended By</span>
                <strong className="font-mono text-orange-600 dark:text-orange-400">
                  {viewingTicket.attendedBy || '—'}
                </strong>
              </div>
              <div>
                <span className="text-stone-500 dark:text-stone-400 block">Status</span>
                <strong className="text-emerald-700 dark:text-emerald-400">
                  {viewingTicket.status}
                </strong>
              </div>
              <div>
                <span className="text-stone-500 dark:text-stone-400 block">Date Start</span>
                <span className="text-stone-900 dark:text-stone-100">
                  {viewingTicket.dateStart || '—'}
                </span>
              </div>
              <div>
                <span className="text-stone-500 dark:text-stone-400 block">Date Finish</span>
                <span className="text-stone-900 dark:text-stone-100">
                  {viewingTicket.dateFinish || '—'}
                </span>
              </div>
              <div>
                <span className="text-stone-500 dark:text-stone-400 block">Cost</span>
                <span className="font-mono text-stone-900 dark:text-stone-100">
                  {viewingTicket.cost ? `₱${viewingTicket.cost}` : '—'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <span className="font-semibold text-stone-700 dark:text-stone-300 block mb-0.5">
                  Description / Concern
                </span>
                <p className="p-3 rounded-lg border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100">
                  {viewingTicket.description}
                </p>
              </div>
              {viewingTicket.detailsOfNarration &&
                viewingTicket.detailsOfNarration !== viewingTicket.description && (
                  <div>
                    <span className="font-semibold text-stone-700 dark:text-stone-300 block mb-0.5">
                      Details of Narration
                    </span>
                    <p className="p-3 rounded-lg border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100">
                      {viewingTicket.detailsOfNarration}
                    </p>
                  </div>
                )}
              <div>
                <span className="font-semibold text-stone-700 dark:text-stone-300 block mb-0.5">
                  Solution / Action Taken
                </span>
                <p className="p-3 rounded-lg border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100">
                  {viewingTicket.solution || '—'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-[11px] text-stone-600 dark:text-stone-400">
              <div>
                Classification:{' '}
                <strong className="text-stone-900 dark:text-stone-100">
                  {viewingTicket.classification || '—'}
                </strong>
              </div>
              <div>
                Category:{' '}
                <strong className="text-stone-900 dark:text-stone-100">
                  {viewingTicket.category || '—'}
                </strong>
              </div>
              <div>
                Nature:{' '}
                <strong className="text-stone-900 dark:text-stone-100">
                  {viewingTicket.natureOfWork || '—'}
                </strong>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const t = viewingTicket;
                  setViewingTicket(null);
                  openEditTicketModal(t);
                }}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-orange-600 text-white hover:bg-orange-700"
              >
                Edit Ticket
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Log / Edit Ticket Modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={
          editingTicketId
            ? `Edit Ticket #${formState.ticketNo}`
            : `Log New Helpdesk Ticket (#${formState.ticketNo})`
        }
        subtitle="Record branch IT support request, resolution details, and status"
        maxWidthClass="max-w-3xl"
      >
        <form onSubmit={handleSaveTicket} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Ticket #
              </label>
              <input
                type="number"
                min={1}
                required
                value={formState.ticketNo}
                onChange={(e) =>
                  setFormState((s) => ({
                    ...s,
                    ticketNo: Math.max(1, Number(e.target.value) || 1),
                  }))
                }
                className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 font-mono text-stone-900 dark:text-stone-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Request Date
              </label>
              <input
                type="text"
                required
                value={formState.date}
                onChange={(e) => setFormState((s) => ({ ...s, date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Status
              </label>
              <select
                value={formState.status}
                onChange={(e) => setFormState((s) => ({ ...s, status: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              >
                {DEFAULT_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Branch / Location
              </label>
              <input
                list="hd-branches"
                required
                value={formState.branchLocation}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, branchLocation: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
              <datalist id="hd-branches">
                {filterOptions.branches.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Department
              </label>
              <input
                list="hd-depts"
                required
                value={formState.department}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, department: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
              <datalist id="hd-depts">
                {filterOptions.depts.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Noted By
              </label>
              <input
                type="text"
                value={formState.notedBy}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, notedBy: e.target.value }))
                }
                placeholder="Requester / staff name"
                className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Description / Concern
              </label>
              <textarea
                rows={2}
                required
                value={formState.description}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, description: e.target.value }))
                }
                placeholder="Describe issue or support request..."
                className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Solution / Action Taken
              </label>
              <textarea
                rows={2}
                value={formState.solution}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, solution: e.target.value }))
                }
                placeholder="Resolution steps..."
                className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Attended By
              </label>
              <input
                list="hd-attended"
                value={formState.attendedBy}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, attendedBy: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 font-mono text-stone-900 dark:text-stone-100"
              />
              <datalist id="hd-attended">
                {filterOptions.attended.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Classification
              </label>
              <select
                value={formState.classification}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, classification: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              >
                <option value="Software">Software</option>
                <option value="Hardware">Hardware</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Category
              </label>
              <input
                list="hd-categories"
                value={formState.category}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, category: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
              <datalist id="hd-categories">
                {filterOptions.categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Cost (₱)
              </label>
              <input
                type="text"
                value={formState.cost}
                onChange={(e) => setFormState((s) => ({ ...s, cost: e.target.value }))}
                placeholder="e.g. 40.00"
                className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 font-mono text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Nature of Work
              </label>
              <input
                list="hd-natures"
                value={formState.natureOfWork}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, natureOfWork: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
              <datalist id="hd-natures">
                {DEFAULT_WORK_NATURES.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Date Start
              </label>
              <input
                type="text"
                value={formState.dateStart}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, dateStart: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Date Finish
              </label>
              <input
                type="text"
                value={formState.dateFinish}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, dateFinish: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-3.5 py-2 rounded-lg text-xs font-medium border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-orange-600 text-white hover:bg-orange-700"
            >
              {editingTicketId ? 'Save Changes' : 'Save Ticket'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Paste / Import TSV or CSV Modal */}
      <Modal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        title="Paste or Import IT Helpdesk Ticket Log"
        subtitle="Paste rows copied directly from Excel / Google Sheets (TSV) or upload a TSV/CSV file"
        maxWidthClass="max-w-2xl"
      >
        <div className="space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="ticket-import-mode"
                  checked={importMode === 'append'}
                  onChange={() => setImportMode('append')}
                />
                <span>Append to existing log</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="ticket-import-mode"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                />
                <span>Replace log</span>
              </label>
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-stone-50"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload File</span>
              </button>
            </div>
          </div>

          <textarea
            rows={7}
            value={pasteText}
            onChange={(e) => handlePreviewImportText(e.target.value)}
            placeholder="Paste spreadsheet rows here (with or without header row)..."
            className="w-full px-3 py-2 font-mono text-[11px] rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
          />

          {importError && (
            <p className="text-xs text-rose-600 dark:text-rose-400">{importError}</p>
          )}

          {importPreview.length > 0 && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
              Parsed <strong>{importPreview.length}</strong> helpdesk ticket rows ready to import.
            </div>
          )}

          <div className="flex justify-end gap-2">
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
              Import {importPreview.length > 0 ? `(${importPreview.length})` : ''}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
