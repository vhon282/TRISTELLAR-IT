import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  PackagePlus,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  Asset,
  AssetBundle,
  BundleAccessoryCategory,
  BundleAccessoryItem,
  BundleRegistryItem,
} from '../../types/cmms';
import { BRANCHES } from '../../data/seedData';
import { buildNextBundleCode } from '../../utils/assetBundles';
import { generateUid } from '../../utils/csv';
import { Modal } from '../ui/Modal';

interface AssetBundleBuilderModalProps {
  isOpen: boolean;
  editingBundle: AssetBundle | null;
  existingBundles: AssetBundle[];
  assets: Asset[];
  onClose: () => void;
  onSave: (bundle: AssetBundle) => void;
}

const ACCESSORY_CATEGORIES: BundleAccessoryCategory[] = [
  'Monitor',
  'Keyboard',
  'Mouse',
  'UPS',
  'Audio / Webcam',
  'Cable / Adapter',
  'Other',
];

const QUICK_ACCESSORY_PRESETS: {
  label: string;
  name: string;
  category: BundleAccessoryCategory;
}[] = [
  { label: '+ Monitor', name: 'LED Monitor', category: 'Monitor' },
  { label: '+ Keyboard', name: 'Wired USB Keyboard', category: 'Keyboard' },
  { label: '+ Mouse', name: 'Wired Optical Mouse', category: 'Mouse' },
  { label: '+ UPS / AVR', name: 'Desktop UPS / AVR', category: 'UPS' },
  { label: '+ Headset', name: 'USB Headset w/ Mic', category: 'Audio / Webcam' },
  { label: '+ Webcam', name: 'HD USB Webcam', category: 'Audio / Webcam' },
  { label: '+ Surge Strip', name: '4-Socket Surge Protector', category: 'Cable / Adapter' },
  { label: '+ Patch Cable', name: 'Cat6 LAN Patch Cable', category: 'Cable / Adapter' },
];

function assetToRegistryItem(asset: Asset): BundleRegistryItem {
  return {
    assetId: asset.id,
    assetCode: asset.assetCode,
    equipmentName: asset.equipmentName,
    category: asset.category,
    serialNumber: asset.serialNumber,
    brandModel: [asset.brand, asset.model].filter(Boolean).join(' ').trim(),
  };
}

export const AssetBundleBuilderModal: React.FC<AssetBundleBuilderModalProps> = ({
  isOpen,
  editingBundle,
  existingBundles,
  assets,
  onClose,
  onSave,
}) => {
  const [bundleCode, setBundleCode] = useState('');
  const [bundleName, setBundleName] = useState('');
  const [assigneeName, setAssigneeName] = useState('');
  const [department, setDepartment] = useState('');
  const [branchLocation, setBranchLocation] = useState('Main');
  const [issuedDate, setIssuedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedRegistryAssets, setSelectedRegistryAssets] = useState<
    BundleRegistryItem[]
  >([]);
  const [accessories, setAccessories] = useState<BundleAccessoryItem[]>([]);
  const [assetSearch, setAssetSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (editingBundle) {
      setBundleCode(editingBundle.bundleCode);
      setBundleName(editingBundle.bundleName);
      setAssigneeName(editingBundle.assigneeName);
      setDepartment(editingBundle.department || '');
      setBranchLocation(editingBundle.branchLocation || 'Main');
      setIssuedDate(editingBundle.issuedDate || new Date().toISOString().slice(0, 10));
      setNotes(editingBundle.notes || '');
      setSelectedRegistryAssets(editingBundle.registryAssets || []);
      setAccessories(editingBundle.accessories || []);
    } else {
      setBundleCode(buildNextBundleCode(existingBundles));
      setBundleName('');
      setAssigneeName('');
      setDepartment('');
      setBranchLocation('Main');
      setIssuedDate(new Date().toISOString().slice(0, 10));
      setNotes('');
      setSelectedRegistryAssets([]);
      setAccessories([
        {
          id: generateUid('acc'),
          name: 'Wired USB Keyboard',
          category: 'Keyboard',
          quantity: 1,
          brandModel: '',
          serialNumber: '',
        },
        {
          id: generateUid('acc'),
          name: 'Wired Optical Mouse',
          category: 'Mouse',
          quantity: 1,
          brandModel: '',
          serialNumber: '',
        },
      ]);
    }
    setAssetSearch('');
    setError(null);
  }, [isOpen, editingBundle, existingBundles]);

  const branchOptions = useMemo(() => {
    return Array.from(
      new Set([...BRANCHES, ...assets.map((a) => a.branchLocation).filter(Boolean)])
    );
  }, [assets]);

  const assigneeSuggestions = useMemo(() => {
    const names = new Set<string>();
    assets.forEach((a) => {
      if (a.assignedTo && a.assignedTo.trim()) names.add(a.assignedTo.trim());
    });
    existingBundles.forEach((b) => {
      if (b.assigneeName && b.assigneeName.trim()) names.add(b.assigneeName.trim());
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [assets, existingBundles]);

  const matchingAssigneeAssets = useMemo(() => {
    const target = assigneeName.trim().toLowerCase();
    if (target.length < 2) return [];
    return assets.filter((a) => a.assignedTo.toLowerCase().includes(target));
  }, [assets, assigneeName]);

  const sortedAndFilteredAssets = useMemo(() => {
    const q = assetSearch.trim().toLowerCase();
    const target = assigneeName.trim().toLowerCase();

    return [...assets]
      .filter((a) => {
        if (!q) return true;
        return (
          a.equipmentName.toLowerCase().includes(q) ||
          a.assetCode.toLowerCase().includes(q) ||
          a.serialNumber.toLowerCase().includes(q) ||
          a.assignedTo.toLowerCase().includes(q) ||
          a.branchLocation.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aSelected = selectedRegistryAssets.some(
          (r) => r.assetId === a.id || r.assetCode === a.assetCode
        );
        const bSelected = selectedRegistryAssets.some(
          (r) => r.assetId === b.id || r.assetCode === b.assetCode
        );
        if (aSelected !== bSelected) return aSelected ? -1 : 1;

        if (target.length >= 2) {
          const aMatch = a.assignedTo.toLowerCase().includes(target);
          const bMatch = b.assignedTo.toLowerCase().includes(target);
          if (aMatch !== bMatch) return aMatch ? -1 : 1;
        }
        return a.assetCode.localeCompare(b.assetCode);
      });
  }, [assets, assetSearch, assigneeName, selectedRegistryAssets]);

  const isAssetSelected = (asset: Asset) =>
    selectedRegistryAssets.some(
      (r) => r.assetId === asset.id || r.assetCode === asset.assetCode
    );

  const toggleAssetSelection = (asset: Asset) => {
    if (error) setError(null);
    setSelectedRegistryAssets((prev) => {
      const exists = prev.some(
        (r) => r.assetId === asset.id || r.assetCode === asset.assetCode
      );
      if (exists) {
        return prev.filter(
          (r) => r.assetId !== asset.id && r.assetCode !== asset.assetCode
        );
      }
      return [...prev, assetToRegistryItem(asset)];
    });
  };

  const handleAutoSelectForAssignee = () => {
    if (matchingAssigneeAssets.length === 0) return;
    setSelectedRegistryAssets((prev) => {
      const next = [...prev];
      for (const asset of matchingAssigneeAssets) {
        const exists = next.some(
          (r) => r.assetId === asset.id || r.assetCode === asset.assetCode
        );
        if (!exists) next.push(assetToRegistryItem(asset));
      }
      return next;
    });
    if (!branchLocation && matchingAssigneeAssets[0]?.branchLocation) {
      setBranchLocation(matchingAssigneeAssets[0].branchLocation);
    } else if (matchingAssigneeAssets[0]?.branchLocation) {
      setBranchLocation(matchingAssigneeAssets[0].branchLocation);
    }
  };

  const handleAddAccessory = (
    name = '',
    category: BundleAccessoryCategory = 'Other'
  ) => {
    if (error) setError(null);
    setAccessories((prev) => [
      ...prev,
      {
        id: generateUid('acc'),
        name,
        category,
        quantity: 1,
        brandModel: '',
        serialNumber: '',
      },
    ]);
  };

  const handleUpdateAccessory = (
    id: string,
    patch: Partial<BundleAccessoryItem>
  ) => {
    setAccessories((prev) =>
      prev.map((acc) => (acc.id === id ? { ...acc, ...patch } : acc))
    );
  };

  const handleRemoveAccessory = (id: string) => {
    setAccessories((prev) => prev.filter((acc) => acc.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = bundleCode.trim().toUpperCase();
    const cleanAssignee = assigneeName.trim();
    const cleanAccessories = accessories
      .filter((a) => a.name.trim().length > 0)
      .map((a) => ({
        ...a,
        name: a.name.trim(),
        quantity: Math.max(1, Number(a.quantity) || 1),
        brandModel: (a.brandModel || '').trim(),
        serialNumber: (a.serialNumber || '').trim(),
      }));

    if (!cleanCode) {
      setError('Please enter a Bundle Code (for example, SET-003).');
      return;
    }
    if (!cleanAssignee) {
      setError('Please enter the employee or recipient name.');
      return;
    }
    if (selectedRegistryAssets.length === 0 && cleanAccessories.length === 0) {
      setError('Select at least one Asset Registry unit or add an accessory item.');
      return;
    }

    onSave({
      id: editingBundle?.id || generateUid('bnd'),
      bundleCode: cleanCode,
      bundleName:
        bundleName.trim() || `${cleanAssignee.split('(')[0].trim()} Workstation Set`,
      assigneeName: cleanAssignee,
      department: department.trim(),
      branchLocation: branchLocation || 'Main',
      issuedDate: issuedDate || new Date().toISOString().slice(0, 10),
      registryAssets: selectedRegistryAssets,
      accessories: cleanAccessories,
      notes: notes.trim(),
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        editingBundle
          ? `Edit Computer Set · ${editingBundle.bundleCode}`
          : 'Bundle New Computer Set'
      }
      subtitle="Combine tracked Asset Registry units and peripherals under one scannable QR & barcode sticker."
      maxWidthClass="max-w-4xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="asset-bundle-builder-form"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors"
          >
            <PackagePlus className="w-3.5 h-3.5" />
            <span>{editingBundle ? 'Save Bundle Changes' : 'Create Set & Save'}</span>
          </button>
        </>
      }
    >
      <form id="asset-bundle-builder-form" onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Bundle Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
              Issued To (Employee) <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              list="bundle-assignee-suggestions"
              value={assigneeName}
              onChange={(e) => {
                setAssigneeName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g., Clarissa Reyes"
              className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              autoFocus
            />
            <datalist id="bundle-assignee-suggestions">
              {assigneeSuggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
              Set / Workstation Name
            </label>
            <input
              type="text"
              value={bundleName}
              onChange={(e) => setBundleName(e.target.value)}
              placeholder="e.g., Accounting Workstation Set"
              className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
              Bundle Code <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={bundleCode}
              onChange={(e) => setBundleCode(e.target.value)}
              placeholder="SET-001"
              className="w-full px-3 py-2 text-xs font-mono uppercase rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
              Department / Role
            </label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g., Accounting, Dispatch"
              className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
              Branch Location
            </label>
            <select
              value={branchLocation}
              onChange={(e) => setBranchLocation(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
            >
              {branchOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
              Issued Date
            </label>
            <input
              type="date"
              value={issuedDate}
              onChange={(e) => setIssuedDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
            />
          </div>
        </div>

        {/* Auto-suggest banner if assignee matches Asset Registry items */}
        {matchingAssigneeAssets.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg border border-orange-200 dark:border-orange-800/70 bg-orange-50/70 dark:bg-orange-950/30 text-xs">
            <div className="flex items-center gap-2 text-orange-900 dark:text-orange-200">
              <Sparkles className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
              <span>
                Found <strong className="font-mono">{matchingAssigneeAssets.length}</strong>{' '}
                registry unit{matchingAssigneeAssets.length === 1 ? '' : 's'} assigned to{' '}
                <strong>{assigneeName.trim()}</strong>.
              </span>
            </div>
            <button
              type="button"
              onClick={handleAutoSelectForAssignee}
              className="px-2.5 py-1 text-xs font-semibold rounded-md bg-orange-600 text-white hover:bg-orange-700 transition-colors whitespace-nowrap shrink-0"
            >
              Auto-Select Assigned Assets
            </button>
          </div>
        )}

        {/* Section A: Linked Registry Assets */}
        <div className="border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-stone-50 dark:bg-stone-800/50 border-b border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200">
                1. Linked Asset Registry Equipment ({selectedRegistryAssets.length} selected)
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Check the PC, laptop, printer, or UPS assigned from the Master Asset Registry.
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
                placeholder="Search code, PC, assignee..."
                className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto divide-y divide-stone-100 dark:divide-stone-800">
            {sortedAndFilteredAssets.length === 0 ? (
              <div className="p-4 text-xs text-stone-500 dark:text-stone-400 text-center">
                No matching registry assets found.
              </div>
            ) : (
              sortedAndFilteredAssets.map((asset) => {
                const checked = isAssetSelected(asset);
                return (
                  <label
                    key={asset.id}
                    className={`flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                      checked
                        ? 'bg-orange-50/60 dark:bg-orange-950/20'
                        : 'hover:bg-stone-50 dark:hover:bg-stone-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          checked
                            ? 'bg-orange-600 border-orange-600 text-white'
                            : 'border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900'
                        }`}
                      >
                        {checked && <Check className="w-3 h-3" />}
                      </span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAssetSelection(asset)}
                        className="sr-only"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">
                          <span className="font-mono text-orange-600 dark:text-orange-400 mr-1.5">
                            {asset.assetCode}
                          </span>
                          {asset.equipmentName}
                        </p>
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                          {asset.branchLocation} · {asset.assignedTo || 'Unassigned'}
                          {asset.serialNumber ? ` · SN: ${asset.serialNumber}` : ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-stone-500 dark:text-stone-400 shrink-0">
                      {asset.category}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Section B: Custom Accessories & Peripherals */}
        <div className="border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-stone-50 dark:bg-stone-800/50 border-b border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200">
                2. Peripherals &amp; Accessories ({accessories.length})
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Add keyboard, mouse, monitor, UPS, headset, cables, or other un-tagged gear issued with this set.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleAddAccessory('', 'Other')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5 text-orange-600" />
              <span>Add Custom Item</span>
            </button>
          </div>

          <div className="p-3.5 space-y-3">
            {/* Quick-add preset chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {QUICK_ACCESSORY_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleAddAccessory(preset.name, preset.category)}
                  className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-700 dark:text-stone-300 hover:border-orange-300 hover:text-orange-700 dark:hover:border-orange-700 dark:hover:text-orange-300 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {accessories.length === 0 ? (
              <p className="text-xs text-stone-500 dark:text-stone-400 py-2">
                No peripherals added yet. Use the quick buttons above or click &ldquo;Add Custom Item&rdquo;.
              </p>
            ) : (
              <div className="space-y-2">
                {accessories.map((acc) => (
                  <div
                    key={acc.id}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2.5 rounded-lg border border-stone-200/80 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/30"
                  >
                    <div className="sm:col-span-4">
                      <input
                        type="text"
                        value={acc.name}
                        onChange={(e) =>
                          handleUpdateAccessory(acc.id, { name: e.target.value })
                        }
                        placeholder="Item name (e.g., USB Keyboard)"
                        className="w-full px-2.5 py-1.5 text-xs rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <select
                        value={acc.category}
                        onChange={(e) =>
                          handleUpdateAccessory(acc.id, { category: e.target.value })
                        }
                        aria-label="Accessory Category"
                        className="w-full px-2 py-1.5 text-xs rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                      >
                        {ACCESSORY_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-1">
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={acc.quantity}
                        onChange={(e) =>
                          handleUpdateAccessory(acc.id, {
                            quantity: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        aria-label="Quantity"
                        title="Quantity"
                        className="w-full px-2 py-1.5 text-xs font-mono tabular-nums rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        value={acc.brandModel || ''}
                        onChange={(e) =>
                          handleUpdateAccessory(acc.id, { brandModel: e.target.value })
                        }
                        placeholder="Brand / Model"
                        className="w-full px-2.5 py-1.5 text-xs rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        value={acc.serialNumber || ''}
                        onChange={(e) =>
                          handleUpdateAccessory(acc.id, { serialNumber: e.target.value })
                        }
                        placeholder="Serial (opt.)"
                        className="w-full px-2.5 py-1.5 text-xs font-mono rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                      />
                    </div>
                    <div className="sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveAccessory(acc.id)}
                        aria-label="Remove accessory item"
                        className="p-1.5 rounded-md text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
            Issuance Notes <span className="text-stone-400">(optional)</span>
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., Turned over complete with power cables and mouse pad"
            className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
          />
        </div>
      </form>
    </Modal>
  );
};
