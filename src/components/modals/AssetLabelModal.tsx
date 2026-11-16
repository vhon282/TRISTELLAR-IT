import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Printer, Download } from 'lucide-react';
import { Asset } from '../../types/cmms';
import { Modal } from '../ui/Modal';

interface AssetLabelModalProps {
  asset: Asset | null;
  onClose: () => void;
}

/**
 * Generates deterministic linear barcode bar widths for an alphanumeric asset code
 * (Code-39 inspired visual encoding so thermal labels include both QR + linear barcode).
 */
function buildBarcodeBars(code: string): { x: number; w: number }[] {
  const clean = (code || '00000-00').toUpperCase();
  const bars: { x: number; w: number }[] = [];
  let cursor = 4;

  // Start guard
  bars.push({ x: cursor, w: 2 });
  cursor += 4;
  bars.push({ x: cursor, w: 1 });
  cursor += 3;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean.charCodeAt(i);
    for (let bit = 0; bit < 5; bit++) {
      const isWide = ((ch >> bit) & 1) === 1;
      const barW = isWide ? 2.5 : 1.1;
      bars.push({ x: cursor, w: barW });
      const spaceW = ((ch >> ((bit + 2) % 6)) & 1) === 1 ? 2.2 : 1.2;
      cursor += barW + spaceW;
    }
  }

  // Stop guard
  bars.push({ x: cursor, w: 1 });
  cursor += 3;
  bars.push({ x: cursor, w: 2 });
  return bars;
}

export const AssetLabelModal: React.FC<AssetLabelModalProps> = ({ asset, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const qrPayload = useMemo(() => {
    if (!asset) return '';
    return JSON.stringify({
      code: asset.assetCode,
      name: asset.equipmentName,
      sn: asset.serialNumber,
      branch: asset.branchLocation,
      assigned: asset.assignedTo,
    });
  }, [asset]);

  useEffect(() => {
    if (!asset || !qrPayload) return;
    QRCode.toDataURL(qrPayload, {
      width: 180,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));

    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, qrPayload, {
        width: 156,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
      }).catch(() => undefined);
    }
  }, [asset, qrPayload]);

  const barcodeBars = useMemo(
    () => buildBarcodeBars(asset?.assetCode ?? ''),
    [asset?.assetCode]
  );

  const totalBarcodeWidth = useMemo(() => {
    if (barcodeBars.length === 0) return 180;
    const last = barcodeBars[barcodeBars.length - 1];
    return Math.ceil(last.x + last.w + 4);
  }, [barcodeBars]);

  const handleDownloadQr = () => {
    if (!qrDataUrl || !asset) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `asset-qr-${asset.assetCode}.png`;
    a.click();
  };

  return (
    <Modal
      isOpen={Boolean(asset)}
      onClose={onClose}
      title="Asset QR & Barcode Label"
      subtitle="Print-ready thermal tag for physical equipment chassis labeling"
      maxWidthClass="max-w-lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleDownloadQr}
            disabled={!qrDataUrl}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download QR PNG</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Label</span>
          </button>
        </>
      }
    >
      {asset && (
        <div className="space-y-4">
          <div
            id="printable-label-area"
            className="bg-white text-stone-900 border-2 border-stone-900 rounded-lg p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4 border-b border-stone-300 pb-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-wider text-stone-500 uppercase">
                  TRISTELLAR IT DEPT. · {asset.branchLocation}
                </p>
                <h3 className="text-base font-bold text-stone-900 leading-tight mt-0.5">
                  {asset.equipmentName}
                </h3>
                <p className="text-xs text-stone-600 mt-1">
                  {asset.brand} {asset.model}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-medium text-stone-500">ASSET CODE</p>
                <p className="text-lg font-mono font-bold text-stone-900 tabular-nums">
                  {asset.assetCode}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-[140px_1fr] gap-4 pt-3 items-center">
              <div className="flex items-center justify-center border border-stone-200 rounded p-1.5 bg-white">
                <canvas ref={canvasRef} className="w-[124px] h-[124px]" />
              </div>
              <div className="space-y-2 min-w-0">
                <div className="text-xs space-y-1">
                  <div className="flex justify-between gap-2">
                    <span className="text-stone-500">Serial No:</span>
                    <span className="font-mono font-medium text-stone-900 truncate">
                      {asset.serialNumber || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-stone-500">Category:</span>
                    <span className="font-medium text-stone-900">{asset.category}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-stone-500">Assigned:</span>
                    <span className="font-medium text-stone-900 truncate">
                      {asset.assignedTo || 'Unassigned'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-200">
                  <svg
                    viewBox={`0 0 ${totalBarcodeWidth} 38`}
                    className="w-full h-9"
                    role="img"
                    aria-label={`Barcode for ${asset.assetCode}`}
                  >
                    <rect x="0" y="0" width={totalBarcodeWidth} height="38" fill="#ffffff" />
                    {barcodeBars.map((bar, idx) => (
                      <rect
                        key={idx}
                        x={bar.x}
                        y={2}
                        width={bar.w}
                        height={26}
                        fill="#0f172a"
                      />
                    ))}
                  </svg>
                  <p className="text-center font-mono text-[10px] tracking-widest text-stone-700 mt-0.5">
                    *{asset.assetCode}*
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-stone-500 dark:text-stone-400">
            QR payload embeds asset code, equipment name, serial number, branch, and assignee for instant mobile scanner verification.
          </p>
        </div>
      )}
    </Modal>
  );
};
