import React, { useState } from 'react';
import { Download, Upload, RotateCcw, CheckCircle2, AlertCircle, Database } from 'lucide-react';
import { CmmsDatabase } from '../../types/cmms';
import { Modal } from '../ui/Modal';
import { normalizeDatabase } from '../../services/storageAdapter';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  db: CmmsDatabase;
  onRestore: (newDb: CmmsDatabase) => void;
  onResetSeed: () => void;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  db,
  onRestore,
  onResetSeed,
}) => {
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const handleDownloadJson = () => {
    const payload = JSON.stringify(db, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `tristellar-it-dept-backup-${dateStamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setErrorMsg('');
    setStatusMsg('Full CMMS JSON backup downloaded.');
  };

  const handleUploadJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg('');
    setStatusMsg('');

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result ?? '')) as Partial<CmmsDatabase>;
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.assets)) {
          throw new Error('Invalid CMMS backup schema: missing assets array.');
        }
        const normalized = normalizeDatabase(parsed);
        onRestore(normalized);
        setStatusMsg(
          `Restored ${normalized.assets.length} assets, ${normalized.maintenanceTasks.length} PM tasks, and all comms directories.`
        );
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Invalid JSON backup file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleReset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    onResetSeed();
    setConfirmReset(false);
    setErrorMsg('');
    setStatusMsg('Workspace reset to default TRISTELLAR IT operations dataset.');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setConfirmReset(false);
        setStatusMsg('');
        setErrorMsg('');
        onClose();
      }}
      title="Backup & Restore Workspace Data"
      subtitle="All changes persist locally in your browser. Export JSON snapshots or prepare for cloud sync."
      maxWidthClass="max-w-xl"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-3 p-3.5 rounded-lg bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-800">
          <div>
            <p className="text-xs text-stone-500 dark:text-stone-400">Assets</p>
            <p className="text-lg font-semibold font-mono tabular-nums text-stone-900 dark:text-stone-100">
              {db.assets.length}
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500 dark:text-stone-400">PM Tasks</p>
            <p className="text-lg font-semibold font-mono tabular-nums text-stone-900 dark:text-stone-100">
              {db.maintenanceTasks.length}
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500 dark:text-stone-400">Comms & Vouchers</p>
            <p className="text-lg font-semibold font-mono tabular-nums text-stone-900 dark:text-stone-100">
              {db.anydeskEntries.length +
                db.cctvEntries.length +
                db.radioEntries.length +
                db.wifiVouchers.length}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 p-4 rounded-lg border border-stone-200 dark:border-stone-800">
            <div>
              <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                Export JSON Backup
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Download every asset, PM checklist, spare part, disposal log, and comms record.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadJson}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 p-4 rounded-lg border border-stone-200 dark:border-stone-800">
            <div>
              <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                Restore from JSON Backup
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Load a previously exported TRISTELLAR IT DEPT. JSON snapshot file.
              </p>
            </div>
            <label className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors whitespace-nowrap shrink-0">
              <Upload className="w-3.5 h-3.5" />
              <span>Choose JSON</span>
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleUploadJson}
              />
            </label>
          </div>

          <div className="flex items-center justify-between gap-4 p-4 rounded-lg border border-stone-200 dark:border-stone-800">
            <div>
              <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                Reset Default Dataset
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Restore initial IT operations data across all 5 branches and communications hubs.
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                confirmReset
                  ? 'bg-rose-600 text-white hover:bg-rose-700'
                  : 'border border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{confirmReset ? 'Click to Confirm Reset' : 'Reset Data'}</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 pt-1">
          <Database className="w-3.5 h-3.5 shrink-0" />
          <span>
            Storage Adapter: localStorage (clean async repository ready for Firebase Firestore or Google Sheets).
          </span>
        </div>

        {statusMsg && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>
    </Modal>
  );
};
