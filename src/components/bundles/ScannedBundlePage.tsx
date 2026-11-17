import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  Cpu,
  Keyboard,
  MapPin,
  Printer,
  QrCode,
  ShieldCheck,
  User,
  Calendar,
  AlertTriangle,
  Sun,
  Moon,
} from 'lucide-react';
import { Asset, AssetBundle } from '../../types/cmms';
import { StatusBadge } from '../ui/StatusBadge';
import { countBundleTotalItems } from '../../utils/assetBundles';

interface ScannedBundlePageProps {
  bundle: AssetBundle | null;
  error?: string;
  liveAssets?: Asset[];
  isAuthenticated?: boolean;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onBackToPortal: () => void;
}

export const ScannedBundlePage: React.FC<ScannedBundlePageProps> = ({
  bundle,
  error,
  liveAssets = [],
  isAuthenticated = false,
  theme = 'light',
  onToggleTheme,
  onBackToPortal,
}) => {
  const [copied, setCopied] = useState(false);

  const liveByCode = useMemo(() => {
    const map = new Map<string, Asset>();
    for (const a of liveAssets) {
      if (a.assetCode) map.set(a.assetCode.toLowerCase(), a);
    }
    return map;
  }, [liveAssets]);

  const totalItems = bundle ? countBundleTotalItems(bundle) : 0;

  const handleCopySummary = () => {
    if (!bundle) return;
    const lines = [
      `TRISTELLAR IT DEPT. — ISSUED COMPUTER SET`,
      `Bundle Code: ${bundle.bundleCode}`,
      `Set Name: ${bundle.bundleName}`,
      `Issued To: ${bundle.assigneeName}${bundle.department ? ` (${bundle.department})` : ''}`,
      `Branch: ${bundle.branchLocation}`,
      `Issued Date: ${bundle.issuedDate || 'N/A'}`,
      ``,
      `Tracked Assets (${bundle.registryAssets.length}):`,
      ...bundle.registryAssets.map(
        (r) =>
          `- [${r.assetCode}] ${r.equipmentName}${r.brandModel ? ` (${r.brandModel})` : ''}${
            r.serialNumber ? ` · SN: ${r.serialNumber}` : ''
          }`
      ),
      ``,
      `Bundled Accessories (${bundle.accessories.length}):`,
      ...bundle.accessories.map(
        (acc) =>
          `- ${acc.quantity}x ${acc.name} [${acc.category}]${
            acc.brandModel ? ` (${acc.brandModel})` : ''
          }${acc.serialNumber ? ` · SN: ${acc.serialNumber}` : ''}`
      ),
    ];
    navigator.clipboard?.writeText(lines.join('\n')).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 bg-white/95 dark:bg-stone-900/95 backdrop-blur border-b border-stone-200 dark:border-stone-800 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="inline-flex items-center justify-center rounded-md bg-white dark:bg-white/95 px-1.5 py-0.5 shrink-0">
              <img
                src={`${import.meta.env.BASE_URL}assets/aistudio/TTC.Logo.Tagline_MKT_Ver7824_3b47c9b8.png`}
                alt="TriStellar — Bigas ng Bayan"
                className="h-6 w-auto max-w-[92px] object-contain"
              />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-wider uppercase text-orange-600 dark:text-orange-400">
                IT DEPT. · ISSUED EQUIPMENT
              </p>
              <p className="text-xs font-mono text-stone-500 dark:text-stone-400 truncate">
                {bundle ? bundle.bundleCode : 'QR Verification'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label="Toggle theme"
                className="p-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                {theme === 'light' ? (
                  <Moon className="w-4 h-4" />
                ) : (
                  <Sun className="w-4 h-4" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onBackToPortal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{isAuthenticated ? 'Back to Portal' : 'IT Portal Login'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
        {!bundle || error ? (
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-6 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h1 className="text-base font-bold text-stone-900 dark:text-stone-100">
              Invalid or Incomplete QR Link
            </h1>
            <p className="text-xs text-stone-500 dark:text-stone-400 max-w-md mx-auto">
              {error || 'No issued computer set data was found in this QR code.'}
            </p>
            <button
              type="button"
              onClick={onBackToPortal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-700"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Open IT Portal</span>
            </button>
          </div>
        ) : (
          <div id="printable-label-area" className="space-y-4">
            {/* Assignee Hero Card */}
            <section className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-stone-100 dark:border-stone-800">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Verified Workstation Bundle</span>
                  </div>
                  <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100 mt-1">
                    {bundle.assigneeName}
                  </h1>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    {bundle.bundleName}
                    {bundle.department ? ` · ${bundle.department}` : ''}
                  </p>
                </div>

                <div className="text-left sm:text-right shrink-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                    Bundle Code
                  </p>
                  <p className="text-lg font-mono font-bold tabular-nums text-orange-600 dark:text-orange-400">
                    {bundle.bundleCode}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-4 text-xs">
                <div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span>Branch</span>
                  </p>
                  <p className="font-semibold text-stone-900 dark:text-stone-100 mt-0.5">
                    {bundle.branchLocation}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>Issued Date</span>
                  </p>
                  <p className="font-mono font-semibold tabular-nums text-stone-900 dark:text-stone-100 mt-0.5">
                    {bundle.issuedDate || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1">
                    <QrCode className="w-3 h-3" />
                    <span>Total Issued</span>
                  </p>
                  <p className="font-mono font-bold tabular-nums text-stone-900 dark:text-stone-100 mt-0.5">
                    {totalItems} item{totalItems === 1 ? '' : 's'}
                  </p>
                </div>
              </div>

              {bundle.notes && (
                <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 text-xs text-stone-600 dark:text-stone-300">
                  <span className="font-semibold text-stone-700 dark:text-stone-200">
                    Notes:{' '}
                  </span>
                  {bundle.notes}
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copied Summary</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Equipment List</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Receipt</span>
                </button>
              </div>
            </section>

            {/* Tracked Registry Equipment */}
            <section className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200">
                    Tracked Asset Registry Units
                  </h2>
                </div>
                <span className="font-mono text-xs font-semibold tabular-nums text-stone-500 dark:text-stone-400">
                  {bundle.registryAssets.length}
                </span>
              </div>

              {bundle.registryAssets.length === 0 ? (
                <div className="p-5 text-xs text-stone-500 dark:text-stone-400">
                  No tracked registry PCs or printers linked to this bundle.
                </div>
              ) : (
                <div className="divide-y divide-stone-100 dark:divide-stone-800">
                  {bundle.registryAssets.map((item, idx) => {
                    const liveMatch = item.assetCode
                      ? liveByCode.get(item.assetCode.toLowerCase())
                      : undefined;
                    return (
                      <div
                        key={`${item.assetCode}-${idx}`}
                        className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                            {liveMatch?.equipmentName || item.equipmentName}
                          </p>
                          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 font-mono tabular-nums">
                            Code: {item.assetCode || '—'} ·{' '}
                            {item.brandModel || item.category}
                            {item.serialNumber ? ` · SN: ${item.serialNumber}` : ''}
                          </p>
                        </div>
                        {liveMatch ? (
                          <StatusBadge value={liveMatch.operationalStatus} />
                        ) : (
                          <span className="font-mono text-[11px] font-semibold text-stone-600 dark:text-stone-300">
                            {item.category}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Bundled Peripherals & Accessories */}
            <section className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Keyboard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200">
                    Bundled Peripherals &amp; Accessories
                  </h2>
                </div>
                <span className="font-mono text-xs font-semibold tabular-nums text-stone-500 dark:text-stone-400">
                  {bundle.accessories.reduce(
                    (s, a) => s + Math.max(1, Number(a.quantity) || 1),
                    0
                  )}
                </span>
              </div>

              {bundle.accessories.length === 0 ? (
                <div className="p-5 text-xs text-stone-500 dark:text-stone-400">
                  No additional keyboards, mice, or peripherals listed.
                </div>
              ) : (
                <div className="divide-y divide-stone-100 dark:divide-stone-800">
                  {bundle.accessories.map((acc) => (
                    <div
                      key={acc.id}
                      className="px-5 py-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                          {acc.name}
                        </p>
                        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 font-mono tabular-nums">
                          {acc.category}
                          {acc.brandModel ? ` · ${acc.brandModel}` : ''}
                          {acc.serialNumber ? ` · SN: ${acc.serialNumber}` : ''}
                        </p>
                      </div>
                      <span className="font-mono text-sm font-bold tabular-nums text-stone-900 dark:text-stone-100 shrink-0">
                        ×{Math.max(1, Number(acc.quantity) || 1)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <p className="text-center text-[11px] text-stone-400 dark:text-stone-500 pt-1 flex items-center justify-center gap-1.5">
              <User className="w-3 h-3" />
              <span>
                Issued equipment accountability record · TRISTELLAR IT DEPT.
              </span>
            </p>
          </div>
        )}
      </main>
    </div>
  );
};
