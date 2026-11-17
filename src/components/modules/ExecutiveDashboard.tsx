import React, { useMemo, useState } from 'react';
import {
  Server,
  CheckCircle2,
  Wrench,
  AlertOctagon,
  ShoppingCart,
  Wifi,
  Download,
  ArrowUpRight,
  FileSpreadsheet,
  ExternalLink,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import {
  ActiveModule,
  CmmsDatabase,
  GoogleSheetLink,
  GoogleSheetTargetModule,
  Quarter,
} from '../../types/cmms';
import {
  BRANCHES,
  CATEGORIES,
  DEFAULT_GOOGLE_SHEET_LINKS,
  QUARTERS,
  TECHNICIANS,
} from '../../data/seedData';
import { exportToCsv } from '../../utils/csv';
import { extractSheetMeta, MODULE_TARGET_LABELS } from '../../utils/googleSheets';

interface ExecutiveDashboardProps {
  db: CmmsDatabase;
  onNavigate: (module: ActiveModule, subTab?: string) => void;
  onFilterAssetsByBranch: (branch: string) => void;
  onAddSheetLink: (defaultTarget?: GoogleSheetTargetModule) => void;
  onEditSheetLink: (link: GoogleSheetLink) => void;
  onDeleteSheetLink: (id: string) => void;
  onRestoreDefaultSheets: () => void;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  db,
  onNavigate,
  onFilterAssetsByBranch,
  onAddSheetLink,
  onEditSheetLink,
  onDeleteSheetLink,
  onRestoreDefaultSheets,
}) => {
  const [selectedQuarter, setSelectedQuarter] = useState<'ALL' | Quarter>('ALL');
  const [selectedYear, setSelectedYear] = useState<'ALL' | number>('ALL');
  const [confirmDeleteSheetId, setConfirmDeleteSheetId] = useState<string | null>(null);
  const [sheetStatusMsg, setSheetStatusMsg] = useState<string | null>(null);

  const sheetLinks = db.googleSheetLinks || [];
  const defaultsDiffer = useMemo(() => {
    return DEFAULT_GOOGLE_SHEET_LINKS.some((def) => {
      const match = sheetLinks.find((l) => l.id === def.id);
      return !match || match.url !== def.url || match.label !== def.label;
    });
  }, [sheetLinks]);

  const yearOptions = useMemo(() => {
    const years = new Set<number>([2025, 2026, 2027]);
    db.maintenanceTasks.forEach((t) => {
      if (t.year) years.add(t.year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [db.maintenanceTasks]);

  const tasksInSelectedYear = useMemo(() => {
    if (selectedYear === 'ALL') return db.maintenanceTasks;
    return db.maintenanceTasks.filter((t) => t.year === selectedYear);
  }, [db.maintenanceTasks, selectedYear]);

  const kpis = useMemo(() => {
    const totalAssets = db.assets.length;
    const operational = db.assets.filter((a) => a.operationalStatus === 'OPERATIONAL').length;
    const inMaintenance = db.assets.filter(
      (a) => a.operationalStatus === 'MAINTENANCE' || a.operationalStatus === 'DEGRADED'
    ).length;
    const downOrRetired = db.assets.filter(
      (a) => a.operationalStatus === 'DOWN' || a.operationalStatus === 'RETIRED'
    ).length;
    const urgentParts = db.spareParts.filter((p) => p.isUrgent || p.stockLeft === 0).length;
    const outOfStockParts = db.spareParts.filter((p) => p.stockLeft === 0).length;
    const usedVouchers = db.wifiVouchers.filter((v) => v.status === 'Used').length;
    const availableVouchers = db.wifiVouchers.filter((v) => v.status === 'Available').length;

    return {
      totalAssets,
      operational,
      operationalPct: totalAssets > 0 ? Math.round((operational / totalAssets) * 100) : 0,
      inMaintenance,
      downOrRetired,
      urgentParts,
      outOfStockParts,
      usedVouchers,
      availableVouchers,
      totalVouchers: db.wifiVouchers.length,
    };
  }, [db]);

  const quarterlyProgress = useMemo(() => {
    return QUARTERS.map((q) => {
      const tasks = tasksInSelectedYear.filter((t) => t.quarter === q);
      const done = tasks.filter((t) => t.status === 'Done').length;
      const pending = tasks.filter((t) => t.status === 'Pending').length;
      const total = tasks.length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      return { quarter: q, done, pending, total, pct };
    });
  }, [tasksInSelectedYear]);

  const overallPmTotals = useMemo(() => {
    const pool =
      selectedQuarter === 'ALL'
        ? tasksInSelectedYear
        : tasksInSelectedYear.filter((t) => t.quarter === selectedQuarter);
    const done = pool.filter((t) => t.status === 'Done').length;
    const pending = pool.filter((t) => t.status === 'Pending').length;
    const total = pool.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { done, pending, total, pct };
  }, [tasksInSelectedYear, selectedQuarter]);

  const technicianStats = useMemo(() => {
    const pool =
      selectedQuarter === 'ALL'
        ? tasksInSelectedYear
        : tasksInSelectedYear.filter((t) => t.quarter === selectedQuarter);

    return TECHNICIANS.map((tech) => {
      const tasks = pool.filter((t) => t.technician === tech);
      const done = tasks.filter((t) => t.status === 'Done').length;
      const pending = tasks.filter((t) => t.status === 'Pending').length;
      const total = tasks.length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      return { technician: tech, done, pending, total, pct };
    });
  }, [tasksInSelectedYear, selectedQuarter]);

  const branchBreakdown = useMemo(() => {
    const dynamicBranches = Array.from(
      new Set([...BRANCHES, ...db.assets.map((a) => a.branchLocation).filter(Boolean)])
    );
    const maxCount = Math.max(
      1,
      ...dynamicBranches.map((b) => db.assets.filter((a) => a.branchLocation === b).length)
    );

    return dynamicBranches.map((branch) => {
      const items = db.assets.filter((a) => a.branchLocation === branch);
      const operational = items.filter((a) => a.operationalStatus === 'OPERATIONAL').length;
      const attention = items.filter(
        (a) => a.operationalStatus === 'MAINTENANCE' || a.operationalStatus === 'DEGRADED'
      ).length;
      const down = items.filter(
        (a) => a.operationalStatus === 'DOWN' || a.operationalStatus === 'RETIRED'
      ).length;
      return {
        branch,
        total: items.length,
        operational,
        attention,
        down,
        widthPct: Math.round((items.length / maxCount) * 100),
      };
    });
  }, [db.assets]);

  const categoryBreakdown = useMemo(() => {
    const colors = ['#ea580c', '#d97706', '#57534e'];
    const total = Math.max(1, db.assets.length);
    return CATEGORIES.map((cat, idx) => {
      const items = db.assets.filter((a) => a.category === cat);
      const operational = items.filter((a) => a.operationalStatus === 'OPERATIONAL').length;
      const pct = Math.round((items.length / total) * 100);
      return {
        category: cat,
        count: items.length,
        operational,
        pct,
        color: colors[idx % colors.length],
      };
    });
  }, [db.assets]);

  // SVG Donut stroke calculations
  const donutSegments = useMemo(() => {
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    const totalCount = Math.max(
      1,
      categoryBreakdown.reduce((acc, c) => acc + c.count, 0)
    );
    let offset = 0;

    return categoryBreakdown.map((item) => {
      const segmentLen = (item.count / totalCount) * circumference;
      const seg = {
        ...item,
        dashArray: `${segmentLen} ${circumference - segmentLen}`,
        dashOffset: -offset,
      };
      offset += segmentLen;
      return seg;
    });
  }, [categoryBreakdown]);

  const handleExportSummary = () => {
    const rows = branchBreakdown.map((b) => ({
      branch: b.branch,
      totalAssets: b.total,
      operational: b.operational,
      maintenanceOrDegraded: b.attention,
      downOrRetired: b.down,
    }));
    exportToCsv(
      `tristellar-it-executive-summary-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: 'branch', label: 'Branch Location' },
        { key: 'totalAssets', label: 'Total Assets' },
        { key: 'operational', label: 'Operational' },
        { key: 'maintenanceOrDegraded', label: 'Maintenance / Degraded' },
        { key: 'downOrRetired', label: 'Down / Retired' },
      ],
      rows
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Executive Operations Dashboard
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
            Fleet health, quarterly preventive maintenance, parts urgency, and Wi-Fi voucher capacity across all branches.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportSummary}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Branch Summary CSV</span>
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('assets')}
          className="text-left p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-orange-300 dark:hover:border-orange-700 transition-colors group"
        >
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400">
            <span className="text-xs font-medium">Total Assets</span>
            <Server className="w-4 h-4 text-stone-400 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-stone-900 dark:text-stone-100 mt-2">
            {kpis.totalAssets}
          </p>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            5 active branches
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('assets')}
          className="text-left p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors group"
        >
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400">
            <span className="text-xs font-medium">Operational</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-2">
            {kpis.operational}
          </p>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 tabular-nums">
            {kpis.operationalPct}% of total fleet
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('maintenance')}
          className="text-left p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-amber-300 dark:hover:border-amber-700 transition-colors group"
        >
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400">
            <span className="text-xs font-medium">In Maintenance</span>
            <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-amber-700 dark:text-amber-400 mt-2">
            {kpis.inMaintenance}
          </p>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Maintenance or degraded
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('assets')}
          className="text-left p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-rose-300 dark:hover:border-rose-700 transition-colors group"
        >
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400">
            <span className="text-xs font-medium">Down / Retired</span>
            <AlertOctagon className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-rose-700 dark:text-rose-400 mt-2">
            {kpis.downOrRetired}
          </p>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Offline or turned over
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('parts')}
          className="text-left p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-rose-300 dark:hover:border-rose-700 transition-colors group"
        >
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400">
            <span className="text-xs font-medium">Urgent Parts</span>
            <ShoppingCart className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-stone-900 dark:text-stone-100 mt-2">
            {kpis.urgentParts}
          </p>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 tabular-nums">
            {kpis.outOfStockParts} out of stock
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('comms', 'wifi')}
          className="text-left p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-orange-300 dark:hover:border-orange-700 transition-colors group"
        >
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400">
            <span className="text-xs font-medium">Active Wi-Fi Vouchers</span>
            <Wifi className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-stone-900 dark:text-stone-100 mt-2">
            {kpis.availableVouchers}
          </p>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 tabular-nums">
            {kpis.usedVouchers} used · {kpis.totalVouchers} total
          </p>
        </button>
      </div>

      {/* Google Sheets Source Files Quick Links Card */}
      <section className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-100 dark:border-stone-800">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                Google Sheets Source Files
              </h2>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 tabular-nums">
              {sheetLinks.length} linked workbook{sheetLinks.length === 1 ? '' : 's'} · Opens live spreadsheets in a new browser tab
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {defaultsDiffer && (
              <button
                type="button"
                onClick={() => {
                  onRestoreDefaultSheets();
                  setConfirmDeleteSheetId(null);
                  setSheetStatusMsg('Restored the 4 default Google Sheets workbooks.');
                  setTimeout(() => setSheetStatusMsg(null), 3500);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore Defaults</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onAddSheetLink('dashboard')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Sheet Link</span>
            </button>
          </div>
        </div>

        {sheetStatusMsg && (
          <div className="mt-3 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-xs font-medium text-emerald-800 dark:text-emerald-200">
            {sheetStatusMsg}
          </div>
        )}

        {sheetLinks.length === 0 ? (
          <div className="pt-6 pb-2 text-center space-y-3">
            <p className="text-xs text-stone-500 dark:text-stone-400">
              No Google Sheets source links configured yet. Add a custom sheet or restore the 4 default IT workbooks.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => onAddSheetLink('dashboard')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Sheet Link</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onRestoreDefaultSheets();
                  setSheetStatusMsg('Restored the 4 default Google Sheets workbooks.');
                  setTimeout(() => setSheetStatusMsg(null), 3500);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore 4 Default Sheets</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4">
            {sheetLinks.map((link) => {
              const meta = extractSheetMeta(link.url);
              const moduleLabel = MODULE_TARGET_LABELS[link.moduleTarget] || 'Dashboard Only';
              const isConfirming = confirmDeleteSheetId === link.id;
              return (
                <div
                  key={link.id}
                  className="p-3.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-950/40 hover:border-emerald-300 dark:hover:border-emerald-800 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs sm:text-sm font-semibold text-stone-900 dark:text-stone-100 hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline truncate"
                      >
                        {link.label}
                      </a>
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 font-mono tabular-nums truncate">
                      {moduleLabel}
                      {meta.gid ? ` · GID ${meta.gid}` : ' · External Sheet'}
                      {link.description ? ` · ${link.description}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isConfirming ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteSheetLink(link.id);
                            setConfirmDeleteSheetId(null);
                            setSheetStatusMsg(`Removed "${link.label}".`);
                            setTimeout(() => setSheetStatusMsg(null), 3000);
                          }}
                          className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors whitespace-nowrap shrink-0"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteSheetId(null)}
                          className="px-2 py-1.5 text-[11px] font-medium rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0 group"
                        >
                          <span>Open Sheet</span>
                          <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </a>
                        <button
                          type="button"
                          onClick={() => onEditSheetLink(link)}
                          aria-label={`Edit ${link.label}`}
                          title="Edit sheet link"
                          className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors shrink-0"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteSheetId(link.id)}
                          aria-label={`Remove ${link.label}`}
                          title="Remove sheet link"
                          className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-500 dark:text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-800 transition-colors shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Quarterly Maintenance Progress & Technician Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-100 dark:border-stone-800">
            <div>
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                Quarterly Preventive Maintenance (Q1–Q4)
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 tabular-nums">
                Overall {selectedQuarter === 'ALL' ? 'Annual' : selectedQuarter}: {overallPmTotals.done} Done · {overallPmTotals.pending} Pending ({overallPmTotals.pct}%)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedYear}
                onChange={(e) =>
                  setSelectedYear(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
                }
                aria-label="Filter Quarterly Maintenance by Year"
                className="px-2.5 py-1.5 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 font-mono"
              >
                <option value="ALL">All Years</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onNavigate('maintenance')}
                className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline whitespace-nowrap shrink-0"
              >
                <span>Open Work Orders</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            {quarterlyProgress.map((q) => {
              const hasPending = q.pending > 0;
              const allDone = !hasPending && q.total > 0;
              return (
                <div
                  key={q.quarter}
                  className={`p-3.5 rounded-lg border transition-colors ${
                    hasPending
                      ? 'bg-rose-50/90 dark:bg-rose-950/35 border-rose-300 dark:border-rose-800/80'
                      : allDone
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                      : 'bg-stone-50 dark:bg-stone-800/50 border-stone-200/80 dark:border-stone-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-bold ${
                          hasPending
                            ? 'text-rose-700 dark:text-rose-300'
                            : 'text-stone-900 dark:text-stone-100'
                        }`}
                      >
                        {q.quarter} Schedule
                      </span>
                      {hasPending && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded bg-rose-600 text-white">
                          Pending
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-sm font-mono font-bold tabular-nums ${
                        hasPending
                          ? 'text-rose-700 dark:text-rose-300'
                          : allDone
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-orange-600 dark:text-orange-400'
                      }`}
                    >
                      {q.pct}%
                    </span>
                  </div>
                  <div
                    className={`w-full h-2.5 rounded-full overflow-hidden mt-2.5 ${
                      hasPending
                        ? 'bg-rose-200/80 dark:bg-rose-900/50'
                        : 'bg-stone-200 dark:bg-stone-700'
                    }`}
                  >
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        hasPending
                          ? 'bg-rose-600 dark:bg-rose-500'
                          : allDone
                          ? 'bg-emerald-600 dark:bg-emerald-500'
                          : 'bg-orange-600 dark:bg-orange-500'
                      }`}
                      style={{ width: `${q.pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-stone-600 dark:text-stone-400 mt-2 tabular-nums">
                    <span>Done: {q.done}</span>
                    <span
                      className={
                        hasPending
                          ? 'font-bold text-rose-700 dark:text-rose-300'
                          : undefined
                      }
                    >
                      Pending: {q.pending}
                    </span>
                    <span>Total: {q.total}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="lg:col-span-5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-stone-100 dark:border-stone-800">
              <div>
                <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                  Technician Completion Breakdown
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  Done vs. Pending PM assignments
                </p>
              </div>
              <div className="flex items-center gap-1 p-0.5 bg-stone-100 dark:bg-stone-800 rounded-lg">
                {(['ALL', ...QUARTERS] as const).map((q) => {
                  const qStats = quarterlyProgress.find((item) => item.quarter === q);
                  const hasPending = Boolean(qStats && qStats.pending > 0);
                  const isSelected = selectedQuarter === q;
                  return (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setSelectedQuarter(q)}
                      className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        hasPending
                          ? isSelected
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                          : isSelected
                          ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                          : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                      }`}
                    >
                      {q === 'ALL' ? 'All' : q}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4 pt-4">
              {technicianStats.map((t) => (
                <div key={t.technician} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-stone-900 dark:text-stone-100">
                      {t.technician}
                    </span>
                    <span className="font-mono tabular-nums text-stone-600 dark:text-stone-300">
                      {t.done} Done / {t.pending} Pending ({t.pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-300"
                      style={{ width: `${t.total > 0 ? (t.done / t.total) * 100 : 0}%` }}
                    />
                    <div
                      className="h-full bg-amber-400 dark:bg-amber-500/80 transition-all duration-300"
                      style={{ width: `${t.total > 0 ? (t.pending / t.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 pt-4 mt-4 border-t border-stone-100 dark:border-stone-800 text-xs text-stone-500 dark:text-stone-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 dark:bg-emerald-500 inline-block" />
              Done
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-400 dark:bg-amber-500/80 inline-block" />
              Pending
            </span>
          </div>
        </section>
      </div>

      {/* Visual Charts: Branch Location & Asset Category */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5">
          <div className="flex items-center justify-between pb-4 border-b border-stone-100 dark:border-stone-800">
            <div>
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                Assets by Branch Location
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Click any branch bar to filter the Master Asset Registry
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-stone-500 dark:text-stone-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                Operational
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
                Maint/Deg
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" />
                Down/Ret
              </span>
            </div>
          </div>

          <div className="space-y-3 pt-4">
            {branchBreakdown.map((b) => (
              <button
                key={b.branch}
                type="button"
                onClick={() => onFilterAssetsByBranch(b.branch)}
                className="w-full text-left group p-2 -mx-2 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors"
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-stone-800 dark:text-stone-200 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                    {b.branch}
                  </span>
                  <span className="font-mono tabular-nums text-stone-500 dark:text-stone-400">
                    {b.total} total ({b.operational} ok · {b.attention} maint · {b.down} down)
                  </span>
                </div>
                <div className="w-full h-3 bg-stone-100 dark:bg-stone-800 rounded-md overflow-hidden">
                  <div
                    className="h-full flex"
                    style={{ width: `${b.widthPct}%` }}
                  >
                    {b.operational > 0 && (
                      <div
                        className="h-full bg-emerald-600 dark:bg-emerald-500"
                        style={{ width: `${(b.operational / Math.max(1, b.total)) * 100}%` }}
                      />
                    )}
                    {b.attention > 0 && (
                      <div
                        className="h-full bg-amber-500"
                        style={{ width: `${(b.attention / Math.max(1, b.total)) * 100}%` }}
                      />
                    )}
                    {b.down > 0 && (
                      <div
                        className="h-full bg-rose-500"
                        style={{ width: `${(b.down / Math.max(1, b.total)) * 100}%` }}
                      />
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="lg:col-span-5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5">
          <div className="pb-4 border-b border-stone-100 dark:border-stone-800">
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Assets by Category
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Hardware distribution across Computer, Printer, and Peripherals
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 pt-5">
            <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 140 140" className="w-36 h-36 -rotate-90">
                <circle
                  cx="70"
                  cy="70"
                  r="52"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="18"
                  className="text-stone-100 dark:text-stone-800"
                />
                {donutSegments.map((seg) => (
                  <circle
                    key={seg.category}
                    cx="70"
                    cy="70"
                    r="52"
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="18"
                    strokeDasharray={seg.dashArray}
                    strokeDashoffset={seg.dashOffset}
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-bold font-mono tabular-nums text-stone-900 dark:text-stone-100">
                  {db.assets.length}
                </span>
                <span className="text-[11px] text-stone-500 dark:text-stone-400">Units</span>
              </div>
            </div>

            <div className="flex-1 w-full space-y-3">
              {categoryBreakdown.map((cat) => (
                <div
                  key={cat.category}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-stone-50 dark:bg-stone-800/40 border border-stone-200/70 dark:border-stone-800"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-xs shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div>
                      <p className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                        {cat.category}
                      </p>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">
                        {cat.operational} operational
                      </p>
                    </div>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <p className="text-sm font-bold text-stone-900 dark:text-stone-100">
                      {cat.count}
                    </p>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">{cat.pct}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
