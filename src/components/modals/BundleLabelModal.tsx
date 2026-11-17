import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Download, Printer, Smartphone } from 'lucide-react';
import { AssetBundle } from '../../types/cmms';
import {
  buildBarcodeBars,
  buildBundleScanUrl,
  countBundleTotalItems,
} from '../../utils/assetBundles';
import { Modal } from '../ui/Modal';

interface BundleLabelModalProps {
  bundle: AssetBundle | null;
  onClose: () => void;
  onPreviewMobile: (bundle: AssetBundle) => void;
}

export const BundleLabelModal: React.FC<BundleLabelModalProps> = ({
  bundle,
  onClose,
  onPreviewMobile,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedUrl, setCopiedUrl] = useState(false);

  const scanUrl = useMemo(() => {
    if (!bundle) return '';
    return buildBundleScanUrl(bundle);
  }, [bundle]);

  const barcodeBars = useMemo(
    () => buildBarcodeBars(bundle?.bundleCode ?? 'SET-001'),
    [bundle?.bundleCode]
  );

  const totalBarcodeWidth = useMemo(() => {
    if (barcodeBars.length === 0) return 180;
    const last = barcodeBars[barcodeBars.length - 1];
    return Math.ceil(last.x + last.w + 4);
  }, [barcodeBars]);

  useEffect(() => {
    if (!bundle || !scanUrl) return;
    QRCode.toDataURL(scanUrl, {
      width: 240,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));

    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, scanUrl, {
        width: 156,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#0f172a', light: '#ffffff' },
      }).catch(() => undefined);
    }
  }, [bundle, scanUrl]);

  const contentsLines = useMemo(() => {
    if (!bundle) return [];
    const reg = bundle.registryAssets.map(
      (r) => `[${r.assetCode}] ${r.equipmentName}`
    );
    const acc = bundle.accessories.map(
      (a) => `${Math.max(1, Number(a.quantity) || 1)}x ${a.name}`
    );
    return [...reg, ...acc];
  }, [bundle]);

  const handleCopyLink = () => {
    if (!scanUrl) return;
    navigator.clipboard?.writeText(scanUrl).catch(() => undefined);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 1800);
  };

  const handleDownloadStickerPng = () => {
    if (!bundle || !qrDataUrl) return;

    const qrImg = new Image();
    qrImg.onload = () => {
      const width = 720;
      const itemRowsHeight = Math.max(1, Math.ceil(contentsLines.length / 2)) * 22;
      const height = 340 + itemRowsHeight;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // White sticker card background + dark border
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 4;
      ctx.strokeRect(10, 10, width - 20, height - 20);

      // Header
      ctx.fillStyle = '#57534e';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(
        `TRISTELLAR IT DEPT. · ${bundle.branchLocation.toUpperCase()}`,
        28,
        38
      );

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(bundle.assigneeName, 28, 66);

      ctx.fillStyle = '#44403c';
      ctx.font = '14px sans-serif';
      ctx.fillText(
        `${bundle.bundleName}${bundle.department ? ` · ${bundle.department}` : ''}`,
        28,
        88
      );

      // Top-right Bundle Code
      ctx.textAlign = 'right';
      ctx.fillStyle = '#57534e';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('BUNDLE CODE', width - 28, 38);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 26px monospace';
      ctx.fillText(bundle.bundleCode, width - 28, 68);
      ctx.textAlign = 'left';

      // Divider
      ctx.strokeStyle = '#d6d3d1';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(28, 104);
      ctx.lineTo(width - 28, 104);
      ctx.stroke();

      // Left QR Code
      ctx.strokeRect(28, 118, 176, 176);
      ctx.drawImage(qrImg, 34, 124, 164, 164);

      // Right Metadata + Linear Barcode
      ctx.fillStyle = '#44403c';
      ctx.font = '13px sans-serif';
      ctx.fillText(`Issued Date: ${bundle.issuedDate || 'N/A'}`, 224, 138);
      ctx.fillText(
        `Total Items: ${countBundleTotalItems(bundle)} (${bundle.registryAssets.length} Registry · ${bundle.accessories.length} Peripherals)`,
        224,
        160
      );

      // Linear Barcode Bars
      const barAreaX = 224;
      const barAreaY = 178;
      const barAreaW = width - 252;
      const scale = Math.min(2.2, barAreaW / totalBarcodeWidth);
      ctx.fillStyle = '#0f172a';
      for (const bar of barcodeBars) {
        ctx.fillRect(
          barAreaX + bar.x * scale,
          barAreaY,
          bar.w * scale,
          58
        );
      }
      ctx.textAlign = 'center';
      ctx.font = '13px monospace';
      ctx.fillText(
        `*${bundle.bundleCode}*`,
        barAreaX + (totalBarcodeWidth * scale) / 2,
        barAreaY + 76
      );
      ctx.textAlign = 'left';

      ctx.fillStyle = '#78716c';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('SCAN QR ON MOBILE FOR ISSUED EQUIPMENT LIST', 224, 286);

      // Itemized Manifest Divider
      ctx.strokeStyle = '#d6d3d1';
      ctx.beginPath();
      ctx.moveTo(28, 308);
      ctx.lineTo(width - 28, 308);
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('ISSUED SET CONTENTS:', 28, 330);

      ctx.font = '13px monospace';
      contentsLines.forEach((line, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const x = col === 0 ? 28 : 372;
        const y = 352 + row * 22;
        const truncated = line.length > 36 ? `${line.slice(0, 35)}…` : line;
        ctx.fillText(`• ${truncated}`, x, y);
      });

      const outUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = outUrl;
      a.download = `bundle-sticker-${bundle.bundleCode}.png`;
      a.click();
    };
    qrImg.src = qrDataUrl;
  };

  return (
    <Modal
      isOpen={Boolean(bundle)}
      onClose={onClose}
      title="Computer Set QR & Barcode Sticker"
      subtitle="Scan the QR code with any phone camera to view all equipment & peripherals issued to this person."
      maxWidthClass="max-w-2xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            Close
          </button>
          {bundle && (
            <button
              type="button"
              onClick={() => onPreviewMobile(bundle)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Preview Mobile Page</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleCopyLink}
            disabled={!scanUrl}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors disabled:opacity-50"
          >
            {copiedUrl ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Copied Link</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Scan Link</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleDownloadStickerPng}
            disabled={!qrDataUrl}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Sticker PNG</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Sticker</span>
          </button>
        </>
      }
    >
      {bundle && (
        <div className="space-y-4">
          <div
            id="printable-label-area"
            className="bg-white text-stone-900 border-2 border-stone-900 rounded-lg p-4 shadow-sm"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-stone-300 pb-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-wider text-stone-500 uppercase">
                  TRISTELLAR IT DEPT. · {bundle.branchLocation}
                </p>
                <h3 className="text-base font-bold text-stone-900 leading-tight mt-0.5">
                  {bundle.assigneeName}
                </h3>
                <p className="text-xs text-stone-600 mt-0.5">
                  {bundle.bundleName}
                  {bundle.department ? ` · ${bundle.department}` : ''}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-medium text-stone-500 uppercase">
                  Bundle Code
                </p>
                <p className="text-lg font-mono font-bold text-stone-900 tabular-nums">
                  {bundle.bundleCode}
                </p>
              </div>
            </div>

            {/* QR + Barcode + Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-[152px_1fr] gap-4 pt-3 items-center">
              <div className="flex flex-col items-center justify-center border border-stone-200 rounded p-2 bg-white mx-auto sm:mx-0">
                <canvas ref={canvasRef} className="w-[136px] h-[136px]" />
                <span className="text-[9px] font-mono font-bold tracking-wider text-stone-600 mt-1 uppercase">
                  Scan for Full Set
                </span>
              </div>

              <div className="space-y-2.5 min-w-0">
                <div className="text-xs space-y-1">
                  <div className="flex justify-between gap-2">
                    <span className="text-stone-500">Issued Date:</span>
                    <span className="font-mono font-medium text-stone-900 tabular-nums">
                      {bundle.issuedDate || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-stone-500">Tracked Assets:</span>
                    <span className="font-mono font-medium text-stone-900 tabular-nums">
                      {bundle.registryAssets.length} unit
                      {bundle.registryAssets.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-stone-500">Peripherals:</span>
                    <span className="font-mono font-medium text-stone-900 tabular-nums">
                      {bundle.accessories.reduce(
                        (s, a) => s + Math.max(1, Number(a.quantity) || 1),
                        0
                      )}{' '}
                      item
                      {bundle.accessories.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>

                {/* Linear Barcode */}
                <div className="pt-2 border-t border-stone-200">
                  <svg
                    viewBox={`0 0 ${totalBarcodeWidth} 40`}
                    className="w-full h-10"
                    role="img"
                    aria-label={`Linear barcode for ${bundle.bundleCode}`}
                  >
                    <rect
                      x="0"
                      y="0"
                      width={totalBarcodeWidth}
                      height="40"
                      fill="#ffffff"
                    />
                    {barcodeBars.map((bar, idx) => (
                      <rect
                        key={idx}
                        x={bar.x}
                        y={2}
                        width={bar.w}
                        height={28}
                        fill="#0f172a"
                      />
                    ))}
                  </svg>
                  <p className="text-center font-mono text-[10px] tracking-widest text-stone-700 mt-0.5">
                    *{bundle.bundleCode}*
                  </p>
                </div>
              </div>
            </div>

            {/* Itemized Sticker Manifest */}
            <div className="mt-3 pt-2.5 border-t border-stone-200">
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                Bundled Equipment &amp; Accessories ({countBundleTotalItems(bundle)})
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono text-stone-800">
                {contentsLines.map((line, i) => (
                  <p key={i} className="truncate">
                    • {line}
                  </p>
                ))}
              </div>
            </div>
          </div>

          <p className="text-xs text-stone-500 dark:text-stone-400">
            Scanning this QR code opens a mobile-ready Issued Equipment page showing all tracked PCs, printers, and peripherals assigned to{' '}
            <strong className="text-stone-700 dark:text-stone-200">
              {bundle.assigneeName}
            </strong>
            .
          </p>
        </div>
      )}
    </Modal>
  );
};
