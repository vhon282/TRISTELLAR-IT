import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { GoogleSheetLink, GoogleSheetTargetModule } from '../../types/cmms';
import {
  extractSheetMeta,
  MODULE_TARGET_OPTIONS,
  normalizeGoogleSheetUrl,
} from '../../utils/googleSheets';
import { generateUid } from '../../utils/csv';
import { Modal } from '../ui/Modal';

interface GoogleSheetLinkModalProps {
  isOpen: boolean;
  editingLink: GoogleSheetLink | null;
  defaultModuleTarget?: GoogleSheetTargetModule;
  onClose: () => void;
  onSave: (link: GoogleSheetLink) => void;
}

export const GoogleSheetLinkModal: React.FC<GoogleSheetLinkModalProps> = ({
  isOpen,
  editingLink,
  defaultModuleTarget = 'dashboard',
  onClose,
  onSave,
}) => {
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [moduleTarget, setModuleTarget] =
    useState<GoogleSheetTargetModule>(defaultModuleTarget);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (editingLink) {
      setLabel(editingLink.label);
      setUrl(editingLink.url);
      setModuleTarget(editingLink.moduleTarget);
      setDescription(editingLink.description || '');
    } else {
      setLabel('');
      setUrl('');
      setModuleTarget(defaultModuleTarget);
      setDescription('');
    }
    setError(null);
  }, [isOpen, editingLink, defaultModuleTarget]);

  const urlMeta = useMemo(() => {
    const check = normalizeGoogleSheetUrl(url);
    if (!check.valid) return null;
    return {
      normalizedUrl: check.normalizedUrl,
      ...extractSheetMeta(check.normalizedUrl),
    };
  }, [url]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setError('Please provide a display title for the Google Sheet.');
      return;
    }

    const urlCheck = normalizeGoogleSheetUrl(url);
    if (!urlCheck.valid) {
      setError(urlCheck.error || 'Please enter a valid Google Sheets URL.');
      return;
    }

    onSave({
      id: editingLink?.id || generateUid('gs'),
      label: trimmedLabel,
      url: urlCheck.normalizedUrl,
      moduleTarget,
      description: description.trim(),
      isDefault: editingLink?.isDefault ?? false,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingLink ? 'Edit Google Sheet Link' : 'Add Google Sheet Link'}
      subtitle="Links appear in the Dashboard Quick Links card and inside the assigned module header."
      maxWidthClass="max-w-lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="google-sheet-link-form"
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors"
          >
            {editingLink ? 'Save Changes' : 'Add Sheet Link'}
          </button>
        </>
      }
    >
      <form id="google-sheet-link-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label
            htmlFor="gs-label-input"
            className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1"
          >
            Sheet Title <span className="text-rose-600">*</span>
          </label>
          <input
            id="gs-label-input"
            type="text"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. IT HELPDESK REPORT"
            className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            autoFocus
          />
        </div>

        <div>
          <label
            htmlFor="gs-url-input"
            className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1"
          >
            Google Sheets URL <span className="text-rose-600">*</span>
          </label>
          <input
            id="gs-url-input"
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError(null);
            }}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
          />
          {urlMeta && (
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-500 dark:text-stone-400">
              <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                {urlMeta.gid ? `gid ${urlMeta.gid}` : 'Valid spreadsheet link'}
                {urlMeta.sheetId && ` · ${urlMeta.sheetId.slice(0, 10)}…`}
              </span>
              <a
                href={urlMeta.normalizedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                <span>Test Link</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        <div>
          <label
            htmlFor="gs-module-select"
            className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1"
          >
            Assigned Module
          </label>
          <select
            id="gs-module-select"
            value={moduleTarget}
            onChange={(e) => setModuleTarget(e.target.value as GoogleSheetTargetModule)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
          >
            {MODULE_TARGET_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="gs-desc-input"
            className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1"
          >
            Description / Tab Notes <span className="text-stone-400">(optional)</span>
          </label>
          <input
            id="gs-desc-input"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Branch hardware tracker tab or annual summary sheet"
            className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
          />
        </div>
      </form>
    </Modal>
  );
};
