import React, { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Download,
  Upload,
  Pencil,
  Trash2,
  AlertTriangle,
  Package,
  Archive,
} from 'lucide-react';
import {
  DisposalKeepItem,
  DisposalStatus,
  SparePartRequest,
} from '../../types/cmms';
import { BRANCHES } from '../../data/seedData';
import { StatusBadge } from '../ui/StatusBadge';
import { Modal } from '../ui/Modal';
import { CsvImportModal } from '../modals/CsvImportModal';
import { exportToCsv, generateUid, pickField } from '../../utils/csv';

interface PartsDisposalModuleProps {
  spareParts: SparePartRequest[];
  disposalItems: DisposalKeepItem[];
  onSaveSparePart: (item: SparePartRequest) => void;
  onDeleteSparePart: (id: string) => void;
  onBulkImportSpareParts: (items: SparePartRequest[]) => void;
  onSaveDisposalItem: (item: DisposalKeepItem) => void;
  onDeleteDisposalItem: (id: string) => void;
  onBulkImportDisposalItems: (items: DisposalKeepItem[]) => void;
}

const EMPTY_PART: Omit<SparePartRequest, 'id'> = {
  item: '',
  type: 'Storage',
  description: '',
  requestQuantity: 1,
  stockLeft: 0,
  isUrgent: false,
  fromJack: false,
  notes: '',
};

const EMPTY_DISPOSAL: Omit<DisposalKeepItem, 'id'> = {
  model: '',
  brand: '',
  status: 'For Disposal',
  fromBranch: 'Main',
  assetTag: '',
  turnoverDate: new Date().toISOString().slice(0, 10),
  department: 'IT',
  equipmentType: 'Desktop PC',
  endBranch: 'Main Warehouse',
  assortedItem: '',
  qty: 1,
  area: '',
};

export const PartsDisposalModule: React.FC<PartsDisposalModuleProps> = ({
  spareParts,
  disposalItems,
  onSaveSparePart,
  onDeleteSparePart,
  onBulkImportSpareParts,
  onSaveDisposalItem,
  onDeleteDisposalItem,
  onBulkImportDisposalItems,
}) => {
  const [activeTab, setActiveTab] = useState<'buy' | 'disposal'>('buy');
  const [searchQuery, setSearchQuery] = useState('');
  const [buyFilter, setBuyFilter] = useState<'ALL' | 'URGENT' | 'ZERO_STOCK' | 'FROM_JACK'>('ALL');
  const [disposalStatusFilter, setDisposalStatusFilter] = useState<'ALL' | DisposalStatus>('ALL');

  const [partModalOpen, setPartModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<SparePartRequest | null>(null);
  const [partForm, setPartForm] = useState<Omit<SparePartRequest, 'id'>>(EMPTY_PART);

  const [disposalModalOpen, setDisposalModalOpen] = useState(false);
  const [editingDisposal, setEditingDisposal] = useState<DisposalKeepItem | null>(null);
  const [disposalForm, setDisposalForm] = useState<Omit<DisposalKeepItem, 'id'>>(EMPTY_DISPOSAL);

  const [isCsvOpen, setIsCsvOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredParts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return spareParts.filter((p) => {
      if (buyFilter === 'URGENT' && !p.isUrgent) return false;
      if (buyFilter === 'ZERO_STOCK' && p.stockLeft !== 0) return false;
      if (buyFilter === 'FROM_JACK' && !p.fromJack) return false;
      if (!q) return true;
      return (
        p.item.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.notes ?? '').toLowerCase().includes(q)
      );
    });
  }, [spareParts, buyFilter, searchQuery]);

  const filteredDisposals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return disposalItems.filter((d) => {
      if (disposalStatusFilter !== 'ALL' && d.status !== disposalStatusFilter) return false;
      if (!q) return true;
      return (
        d.model.toLowerCase().includes(q) ||
        d.brand.toLowerCase().includes(q) ||
        d.assetTag.toLowerCase().includes(q) ||
        d.fromBranch.toLowerCase().includes(q) ||
        d.department.toLowerCase().includes(q) ||
        d.equipmentType.toLowerCase().includes(q) ||
        d.assortedItem.toLowerCase().includes(q) ||
        d.area.toLowerCase().includes(q)
      );
    });
  }, [disposalItems, disposalStatusFilter, searchQuery]);

  const urgentCount = useMemo(
    () => spareParts.filter((p) => p.isUrgent || p.stockLeft === 0).length,
    [spareParts]
  );

  const handleExport = () => {
    if (activeTab === 'buy') {
      exportToCsv(
        `spare-parts-need-to-buy-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          { key: 'item', label: 'Item' },
          { key: 'type', label: 'Type' },
          { key: 'description', label: 'Description' },
          { key: 'requestQuantity', label: 'Request Quantity' },
          { key: 'stockLeft', label: 'Stock Left' },
          { key: 'isUrgent', label: 'Urgent', format: (r) => (r.isUrgent ? 'Yes' : 'No') },
          { key: 'fromJack', label: 'From Jack', format: (r) => (r.fromJack ? 'Yes' : 'No') },
          { key: 'notes', label: 'Notes' },
        ],
        filteredParts
      );
    } else {
      exportToCsv(
        `disposal-keep-turnover-log-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          { key: 'model', label: 'Model' },
          { key: 'brand', label: 'Brand' },
          { key: 'status', label: 'Status' },
          { key: 'fromBranch', label: 'From Branch' },
          { key: 'assetTag', label: 'Asset Tag' },
          { key: 'turnoverDate', label: 'Turnover Date' },
          { key: 'department', label: 'Department' },
          { key: 'equipmentType', label: 'Equipment Type' },
          { key: 'endBranch', label: 'End Branch' },
          { key: 'assortedItem', label: 'Assorted Item' },
          { key: 'qty', label: 'Qty' },
          { key: 'area', label: 'Area' },
        ],
        filteredDisposals
      );
    }
  };

  const handleImportCsv = (rows: Record<string, string>[]) => {
    if (activeTab === 'buy') {
      const items: SparePartRequest[] = rows.map((row) => ({
        id: generateUid('sp'),
        item: pickField(row, ['Item', 'Part Name', 'Name']) || 'Spare Part',
        type: pickField(row, ['Type', 'Category']) || 'Hardware',
        description: pickField(row, ['Description', 'Specs']),
        requestQuantity: Number(pickField(row, ['Request Quantity', 'Req Qty', 'Qty'])) || 1,
        stockLeft: Number(pickField(row, ['Stock Left', 'Stock'])) || 0,
        isUrgent: ['yes', 'true', '1', 'urgent'].includes(
          pickField(row, ['Urgent', 'Is Urgent']).toLowerCase()
        ),
        fromJack: ['yes', 'true', '1', 'jack'].includes(
          pickField(row, ['From Jack', 'Jack']).toLowerCase()
        ),
        notes: pickField(row, ['Notes', 'Remarks']),
      }));
      onBulkImportSpareParts(items);
      return {
        importedCount: items.length,
        summary: `Imported ${items.length} spare part procurement entries.`,
      };
    }

    const items: DisposalKeepItem[] = rows.map((row) => {
      const rawStatus = pickField(row, ['Status']);
      const status: DisposalStatus = rawStatus.toLowerCase().includes('keep')
        ? 'Keep'
        : rawStatus.toLowerCase().includes('defect')
        ? 'Defective'
        : 'For Disposal';
      return {
        id: generateUid('dk'),
        model: pickField(row, ['Model']) || 'Unknown Model',
        brand: pickField(row, ['Brand']),
        status,
        fromBranch: pickField(row, ['From Branch', 'Branch']) || 'Main',
        assetTag: pickField(row, ['Asset Tag', 'Asset Code', 'Tag']),
        turnoverDate: pickField(row, ['Turnover Date', 'Date']) || new Date().toISOString().slice(0, 10),
        department: pickField(row, ['Department', 'Dept']),
        equipmentType: pickField(row, ['Equipment Type', 'Type']),
        endBranch: pickField(row, ['End Branch', 'Destination']),
        assortedItem: pickField(row, ['Assorted Item', 'Accessories']),
        qty: Number(pickField(row, ['Qty', 'Quantity'])) || 1,
        area: pickField(row, ['Area', 'Location']),
      };
    });
    onBulkImportDisposalItems(items);
    return {
      importedCount: items.length,
      summary: `Imported ${items.length} disposal / keep turnover records.`,
    };
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Spare Parts &amp; Disposal / Keep Log
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5 tabular-nums">
            {urgentCount} urgent or zero-stock procurement items · {disposalItems.length} turnover entries logged
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
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (activeTab === 'buy') {
                setEditingPart(null);
                setPartForm(EMPTY_PART);
                setPartModalOpen(true);
              } else {
                setEditingDisposal(null);
                setDisposalForm(EMPTY_DISPOSAL);
                setDisposalModalOpen(true);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{activeTab === 'buy' ? 'Add Part Request' : 'Log Turnover Item'}</span>
          </button>
        </div>
      </div>

      {/* Sub-tabs & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-stone-800 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setActiveTab('buy');
                setSearchQuery('');
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'buy'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Tab A — Need to Buy ({spareParts.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('disposal');
                setSearchQuery('');
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'disposal'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Tab B — Disposal / Keep ({disposalItems.length})</span>
            </button>
          </div>

          {activeTab === 'buy' ? (
            <select
              value={buyFilter}
              onChange={(e) =>
                setBuyFilter(e.target.value as 'ALL' | 'URGENT' | 'ZERO_STOCK' | 'FROM_JACK')
              }
              aria-label="Filter Spare Parts"
              className="px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
            >
              <option value="ALL">All Requests</option>
              <option value="URGENT">Urgent Only</option>
              <option value="ZERO_STOCK">Out of Stock (Stock = 0)</option>
              <option value="FROM_JACK">Flagged: From Jack</option>
            </select>
          ) : (
            <select
              value={disposalStatusFilter}
              onChange={(e) =>
                setDisposalStatusFilter(e.target.value as 'ALL' | DisposalStatus)
              }
              aria-label="Filter Disposal Status"
              className="px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
            >
              <option value="ALL">All Turnover Statuses</option>
              <option value="For Disposal">For Disposal</option>
              <option value="Defective">Defective</option>
              <option value="Keep">Keep</option>
            </select>
          )}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'buy'
                ? 'Search item, type, description...'
                : 'Search model, asset tag, branch...'
            }
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
          />
        </div>
      </div>

      {/* Tables */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          {activeTab === 'buy' ? (
            filteredParts.length === 0 ? (
              <div className="p-10 text-center text-xs text-stone-500 dark:text-stone-400">
                No spare part procurement requests match the current filter.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                    <th className="px-4 py-3 whitespace-nowrap">Item</th>
                    <th className="px-4 py-3 whitespace-nowrap">Type</th>
                    <th className="px-4 py-3 whitespace-nowrap">Description</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Request Qty</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Stock Left</th>
                    <th className="px-4 py-3 whitespace-nowrap">Priority Flags</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 dark:divide-stone-800 text-xs">
                  {filteredParts.map((part) => {
                    const isCritical = part.stockLeft === 0 || part.isUrgent;
                    return (
                      <tr
                        key={part.id}
                        className={
                          part.stockLeft === 0
                            ? 'bg-rose-50/70 dark:bg-rose-950/25 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors'
                            : part.isUrgent
                            ? 'bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors'
                            : 'hover:bg-stone-50/80 dark:hover:bg-stone-800/40 transition-colors'
                        }
                      >
                        <td className="px-4 py-3 align-top min-w-[190px]">
                          <div className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                            {isCritical && (
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                            )}
                            <span>{part.item}</span>
                          </div>
                          {part.notes && (
                            <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                              {part.notes}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top whitespace-nowrap text-stone-700 dark:text-stone-300">
                          {part.type}
                        </td>
                        <td className="px-4 py-3 align-top max-w-[280px] text-stone-600 dark:text-stone-300">
                          {part.description || '—'}
                        </td>
                        <td className="px-4 py-3 align-top text-right whitespace-nowrap font-mono font-semibold tabular-nums text-stone-900 dark:text-stone-100">
                          {part.requestQuantity}
                        </td>
                        <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                          <span
                            className={`font-mono font-bold tabular-nums ${
                              part.stockLeft === 0
                                ? 'text-rose-700 dark:text-rose-400'
                                : 'text-stone-900 dark:text-stone-100'
                            }`}
                          >
                            {part.stockLeft}
                          </span>
                          {part.stockLeft === 0 && (
                            <span className="block text-[10px] font-semibold text-rose-700 dark:text-rose-400">
                              OUT OF STOCK
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top whitespace-nowrap">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {part.isUrgent && <StatusBadge value="Urgent" />}
                            {part.fromJack && <StatusBadge value="From Jack" />}
                            {!part.isUrgent && !part.fromJack && (
                              <span className="text-stone-400 dark:text-stone-500">Standard</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPart(part);
                                const { id: _ignored, ...rest } = part;
                                setPartForm(rest);
                                setPartModalOpen(true);
                              }}
                              aria-label={`Edit ${part.item}`}
                              className="p-1.5 rounded-md text-stone-500 hover:text-stone-900 hover:bg-stone-100 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-800 transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirmDeleteId === part.id) {
                                  onDeleteSparePart(part.id);
                                  setConfirmDeleteId(null);
                                } else {
                                  setConfirmDeleteId(part.id);
                                }
                              }}
                              aria-label={`Delete ${part.item}`}
                              className={`p-1.5 rounded-md transition-colors ${
                                confirmDeleteId === part.id
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
            )
          ) : filteredDisposals.length === 0 ? (
            <div className="p-10 text-center text-xs text-stone-500 dark:text-stone-400">
              No disposal or keep turnover records match the current filter.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  <th className="px-3.5 py-3 whitespace-nowrap">Asset Tag</th>
                  <th className="px-3.5 py-3 whitespace-nowrap">Brand &amp; Model</th>
                  <th className="px-3.5 py-3 whitespace-nowrap">Status</th>
                  <th className="px-3.5 py-3 whitespace-nowrap">From Branch / Dept</th>
                  <th className="px-3.5 py-3 whitespace-nowrap">Equipment Type</th>
                  <th className="px-3.5 py-3 whitespace-nowrap">Turnover Date</th>
                  <th className="px-3.5 py-3 whitespace-nowrap">End Branch / Area</th>
                  <th className="px-3.5 py-3 whitespace-nowrap">Assorted Item</th>
                  <th className="px-3.5 py-3 text-right whitespace-nowrap">Qty</th>
                  <th className="px-3.5 py-3 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 dark:divide-stone-800 text-xs">
                {filteredDisposals.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-stone-50/80 dark:hover:bg-stone-800/40 transition-colors"
                  >
                    <td className="px-3.5 py-3 font-mono font-semibold tabular-nums text-stone-900 dark:text-stone-100 whitespace-nowrap">
                      {item.assetTag || '—'}
                    </td>
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <div className="font-semibold text-stone-900 dark:text-stone-100">
                        {item.model}
                      </div>
                      <div className="text-[11px] text-stone-500 dark:text-stone-400">
                        {item.brand || '—'}
                      </div>
                    </td>
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <StatusBadge value={item.status} />
                    </td>
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <div className="font-medium text-stone-800 dark:text-stone-200">
                        {item.fromBranch}
                      </div>
                      <div className="text-[11px] text-stone-500 dark:text-stone-400">
                        {item.department || '—'}
                      </div>
                    </td>
                    <td className="px-3.5 py-3 whitespace-nowrap text-stone-700 dark:text-stone-300">
                      {item.equipmentType || '—'}
                    </td>
                    <td className="px-3.5 py-3 whitespace-nowrap font-mono tabular-nums text-stone-600 dark:text-stone-300">
                      {item.turnoverDate || '—'}
                    </td>
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <div className="text-stone-800 dark:text-stone-200">
                        {item.endBranch || '—'}
                      </div>
                      <div className="text-[11px] text-stone-500 dark:text-stone-400">
                        {item.area || '—'}
                      </div>
                    </td>
                    <td className="px-3.5 py-3 max-w-[180px] text-stone-600 dark:text-stone-300 truncate">
                      {item.assortedItem || '—'}
                    </td>
                    <td className="px-3.5 py-3 text-right font-mono font-semibold tabular-nums text-stone-900 dark:text-stone-100 whitespace-nowrap">
                      {item.qty}
                    </td>
                    <td className="px-3.5 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDisposal(item);
                            const { id: _ignored, ...rest } = item;
                            setDisposalForm(rest);
                            setDisposalModalOpen(true);
                          }}
                          aria-label={`Edit ${item.model}`}
                          className="p-1.5 rounded-md text-stone-500 hover:text-stone-900 hover:bg-stone-100 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-800 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirmDeleteId === item.id) {
                              onDeleteDisposalItem(item.id);
                              setConfirmDeleteId(null);
                            } else {
                              setConfirmDeleteId(item.id);
                            }
                          }}
                          aria-label={`Delete ${item.model}`}
                          className={`p-1.5 rounded-md transition-colors ${
                            confirmDeleteId === item.id
                              ? 'bg-rose-600 text-white'
                              : 'text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
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
          )}
        </div>
      </div>

      {/* Add / Edit Spare Part Modal */}
      <Modal
        isOpen={partModalOpen}
        onClose={() => setPartModalOpen(false)}
        title={editingPart ? `Edit Part · ${editingPart.item}` : 'Add Spare Part Request'}
        maxWidthClass="max-w-lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!partForm.item.trim()) return;
            onSaveSparePart({
              id: editingPart ? editingPart.id : generateUid('sp'),
              ...partForm,
              item: partForm.item.trim(),
            });
            setPartModalOpen(false);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Item *
              </label>
              <input
                type="text"
                required
                value={partForm.item}
                onChange={(e) => setPartForm({ ...partForm, item: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Type
              </label>
              <input
                type="text"
                value={partForm.type}
                onChange={(e) => setPartForm({ ...partForm, type: e.target.value })}
                placeholder="Storage, Power, Memory, Consumable..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
              Description
            </label>
            <input
              type="text"
              value={partForm.description}
              onChange={(e) => setPartForm({ ...partForm, description: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Request Quantity
              </label>
              <input
                type="number"
                min={1}
                value={partForm.requestQuantity}
                onChange={(e) =>
                  setPartForm({ ...partForm, requestQuantity: Number(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Stock Left
              </label>
              <input
                type="number"
                min={0}
                value={partForm.stockLeft}
                onChange={(e) =>
                  setPartForm({ ...partForm, stockLeft: Number(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>

          <div className="flex items-center gap-6 pt-1">
            <label className="inline-flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300 cursor-pointer">
              <input
                type="checkbox"
                checked={partForm.isUrgent}
                onChange={(e) => setPartForm({ ...partForm, isUrgent: e.target.checked })}
                className="rounded border-stone-300 text-rose-600 focus:ring-rose-500"
              />
              <span>Flag as Urgent</span>
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300 cursor-pointer">
              <input
                type="checkbox"
                checked={partForm.fromJack}
                onChange={(e) => setPartForm({ ...partForm, fromJack: e.target.checked })}
                className="rounded border-stone-300 text-orange-600 focus:ring-orange-500"
              />
              <span>From Jack</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
              Notes
            </label>
            <input
              type="text"
              value={partForm.notes ?? ''}
              onChange={(e) => setPartForm({ ...partForm, notes: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-stone-200 dark:border-stone-800">
            <button
              type="button"
              onClick={() => setPartModalOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium rounded-lg bg-orange-600 text-white hover:bg-orange-700"
            >
              {editingPart ? 'Save Part' : 'Add Request'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add / Edit Disposal/Keep Modal */}
      <Modal
        isOpen={disposalModalOpen}
        onClose={() => setDisposalModalOpen(false)}
        title={
          editingDisposal
            ? `Edit Turnover · ${editingDisposal.model}`
            : 'Log Disposal / Keep Turnover Item'
        }
        maxWidthClass="max-w-2xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!disposalForm.model.trim()) return;
            onSaveDisposalItem({
              id: editingDisposal ? editingDisposal.id : generateUid('dk'),
              ...disposalForm,
              model: disposalForm.model.trim(),
            });
            setDisposalModalOpen(false);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Model *
              </label>
              <input
                type="text"
                required
                value={disposalForm.model}
                onChange={(e) => setDisposalForm({ ...disposalForm, model: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Brand
              </label>
              <input
                type="text"
                value={disposalForm.brand}
                onChange={(e) => setDisposalForm({ ...disposalForm, brand: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Status
              </label>
              <select
                value={disposalForm.status}
                onChange={(e) =>
                  setDisposalForm({
                    ...disposalForm,
                    status: e.target.value as DisposalStatus,
                  })
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              >
                <option value="For Disposal">For Disposal</option>
                <option value="Defective">Defective</option>
                <option value="Keep">Keep</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                From Branch
              </label>
              <select
                value={disposalForm.fromBranch}
                onChange={(e) =>
                  setDisposalForm({ ...disposalForm, fromBranch: e.target.value })
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              >
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Asset Tag
              </label>
              <input
                type="text"
                value={disposalForm.assetTag}
                onChange={(e) => setDisposalForm({ ...disposalForm, assetTag: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Turnover Date
              </label>
              <input
                type="date"
                value={disposalForm.turnoverDate}
                onChange={(e) =>
                  setDisposalForm({ ...disposalForm, turnoverDate: e.target.value })
                }
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Department
              </label>
              <input
                type="text"
                value={disposalForm.department}
                onChange={(e) => setDisposalForm({ ...disposalForm, department: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Equipment Type
              </label>
              <input
                type="text"
                value={disposalForm.equipmentType}
                onChange={(e) =>
                  setDisposalForm({ ...disposalForm, equipmentType: e.target.value })
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                End Branch
              </label>
              <input
                type="text"
                value={disposalForm.endBranch}
                onChange={(e) => setDisposalForm({ ...disposalForm, endBranch: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Assorted Item
              </label>
              <input
                type="text"
                value={disposalForm.assortedItem}
                onChange={(e) =>
                  setDisposalForm({ ...disposalForm, assortedItem: e.target.value })
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Qty
              </label>
              <input
                type="number"
                min={1}
                value={disposalForm.qty}
                onChange={(e) =>
                  setDisposalForm({ ...disposalForm, qty: Number(e.target.value) || 1 })
                }
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
              Area
            </label>
            <input
              type="text"
              value={disposalForm.area}
              onChange={(e) => setDisposalForm({ ...disposalForm, area: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-stone-200 dark:border-stone-800">
            <button
              type="button"
              onClick={() => setDisposalModalOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium rounded-lg bg-orange-600 text-white hover:bg-orange-700"
            >
              {editingDisposal ? 'Save Turnover' : 'Log Turnover'}
            </button>
          </div>
        </form>
      </Modal>

      <CsvImportModal
        isOpen={isCsvOpen}
        onClose={() => setIsCsvOpen(false)}
        title={
          activeTab === 'buy'
            ? 'Import Spare Parts Procurement CSV'
            : 'Import Disposal / Keep Turnover CSV'
        }
        description={
          activeTab === 'buy'
            ? 'Bulk import parts requests with urgent & From Jack priority flags.'
            : 'Bulk import turnover logs with branch, asset tag, and status.'
        }
        sampleHeaders={
          activeTab === 'buy'
            ? ['Item', 'Type', 'Description', 'Request Quantity', 'Stock Left', 'Urgent', 'From Jack']
            : [
                'Model',
                'Brand',
                'Status',
                'From Branch',
                'Asset Tag',
                'Turnover Date',
                'Department',
                'Equipment Type',
                'End Branch',
                'Assorted Item',
                'Qty',
                'Area',
              ]
        }
        sampleRow={
          activeTab === 'buy'
            ? ['256GB SATA SSD', 'Storage', '2.5 inch SSD for legacy PCs', '4', '0', 'Yes', 'Yes']
            : [
                'LaserJet M15w',
                'HP',
                'For Disposal',
                'Bacoor',
                '00422-03',
                '2026-11-12',
                'Dispatch',
                'Printer',
                'Main Warehouse',
                'Power Cord',
                '1',
                'Front Counter',
              ]
        }
        onImportRows={handleImportCsv}
      />
    </div>
  );
};
