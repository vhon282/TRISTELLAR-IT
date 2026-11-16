import React, { useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { parseCsv } from '../../utils/csv';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  sampleHeaders: string[];
  sampleRow: string[];
  onImportRows: (rows: Record<string, string>[], headers: string[]) => {
    importedCount: number;
    summary: string;
  };
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  sampleHeaders,
  sampleRow,
  onImportRows,
}) => {
  const [rawText, setRawText] = useState('');
  const [error, setError] = useState('');
  const [resultMsg, setResultMsg] = useState('');

  const parsed = rawText.trim() ? parseCsv(rawText) : { headers: [], rows: [] };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setResultMsg('');
    const reader = new FileReader();
    reader.onload = () => {
      setRawText(String(reader.result ?? ''));
    };
    reader.onerror = () => {
      setError('Failed to read the selected CSV file.');
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    setError('');
    setResultMsg('');
    setRawText(`${sampleHeaders.join(',')}\n${sampleRow.join(',')}`);
  };

  const handleConfirmImport = () => {
    if (parsed.rows.length === 0) {
      setError('Please upload a CSV file or paste CSV rows with a header line.');
      return;
    }
    try {
      const res = onImportRows(parsed.rows, parsed.headers);
      setResultMsg(res.summary);
      setError('');
      setTimeout(() => {
        setRawText('');
        setResultMsg('');
        onClose();
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV records.');
    }
  };

  const handleResetAndClose = () => {
    setRawText('');
    setError('');
    setResultMsg('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleResetAndClose}
      title={title}
      subtitle={description}
      maxWidthClass="max-w-3xl"
      footer={
        <>
          <button
            type="button"
            onClick={handleResetAndClose}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={parsed.rows.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import {parsed.rows.length > 0 ? `${parsed.rows.length} Rows` : 'CSV'}</span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg border border-dashed border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/40">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0" />
            <div>
              <p className="text-xs font-medium text-stone-900 dark:text-stone-100">
                Select a .csv file or paste spreadsheet rows below
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Expected columns: {sampleHeaders.slice(0, 6).join(', ')}
                {sampleHeaders.length > 6 ? `, +${sampleHeaders.length - 6} more` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLoadSample}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
            >
              Load Sample Row
            </button>
            <label className="cursor-pointer px-3 py-1.5 text-xs font-medium rounded-md bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:opacity-90 transition-opacity whitespace-nowrap shrink-0">
              Choose CSV File
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
            CSV Content
          </label>
          <textarea
            value={rawText}
            onChange={(e) => {
              setRawText(e.target.value);
              setError('');
              setResultMsg('');
            }}
            rows={5}
            placeholder={`${sampleHeaders.join(',')}\n${sampleRow.join(',')}`}
            className="w-full rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 px-3 py-2 text-xs font-mono text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {resultMsg && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{resultMsg}</span>
          </div>
        )}

        {parsed.rows.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-stone-700 dark:text-stone-300">
              Preview ({parsed.rows.length} rows detected · showing first 5)
            </p>
            <div className="overflow-x-auto border border-stone-200 dark:border-stone-800 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 dark:bg-stone-800/60 text-stone-600 dark:text-stone-300">
                  <tr>
                    {parsed.headers.map((h) => (
                      <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                  {parsed.rows.slice(0, 5).map((row, idx) => (
                    <tr key={idx} className="bg-white dark:bg-stone-900">
                      {parsed.headers.map((h) => (
                        <td
                          key={h}
                          className="px-3 py-2 text-stone-700 dark:text-stone-300 whitespace-nowrap max-w-[180px] truncate"
                        >
                          {row[h]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
