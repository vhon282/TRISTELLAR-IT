import { AssetBundle, AssetCategory } from '../types/cmms';

/**
 * Generates deterministic linear barcode bar widths for an alphanumeric code
 * (Code-39 inspired visual encoding so thermal labels include both QR + linear barcode).
 */
export function buildBarcodeBars(code: string): { x: number; w: number }[] {
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

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(b64: string): Uint8Array {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const full = padded + '='.repeat(padLen);
  const binary = atob(full);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

interface CompactBundlePayload {
  v: 1;
  id: string;
  c: string;
  n: string;
  a: string;
  d?: string;
  b: string;
  i: string;
  t?: string;
  r: [string, string, string, string, string][];
  x: [string, string, number, string, string][];
}

export function encodeBundlePayload(bundle: AssetBundle): string {
  const compact: CompactBundlePayload = {
    v: 1,
    id: bundle.id,
    c: bundle.bundleCode,
    n: bundle.bundleName,
    a: bundle.assigneeName,
    ...(bundle.department ? { d: bundle.department } : {}),
    b: bundle.branchLocation,
    i: bundle.issuedDate,
    ...(bundle.notes ? { t: bundle.notes } : {}),
    r: bundle.registryAssets.map((r) => [
      r.assetCode,
      r.equipmentName,
      r.serialNumber || '',
      r.brandModel || '',
      r.category,
    ]),
    x: bundle.accessories.map((acc) => [
      acc.name,
      acc.category || 'Other',
      Math.max(1, Number(acc.quantity) || 1),
      acc.brandModel || '',
      acc.serialNumber || '',
    ]),
  };

  const json = JSON.stringify(compact);
  const bytes = new TextEncoder().encode(json);
  return bytesToBase64Url(bytes);
}

export function buildBundleScanUrl(bundle: AssetBundle): string {
  const encoded = encodeBundlePayload(bundle);
  if (typeof window === 'undefined') {
    return `?bundle=${encoded}`;
  }
  const basePath = import.meta.env.BASE_URL || '/';
  const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
  return `${window.location.origin}${normalizedBase}?bundle=${encoded}`;
}

export function decodeBundleFromQueryParam(rawParam: string): {
  bundle: AssetBundle | null;
  error?: string;
} {
  try {
    if (!rawParam || !rawParam.trim()) {
      return { bundle: null, error: 'Missing bundle data in QR link.' };
    }
    const bytes = base64UrlToBytes(rawParam.trim());
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as Partial<CompactBundlePayload>;
    if (!parsed || typeof parsed.c !== 'string' || typeof parsed.a !== 'string') {
      return { bundle: null, error: 'Unrecognized issued equipment QR format.' };
    }

    const validCat = (cat: string): AssetCategory =>
      cat === 'Computer' || cat === 'Printer' || cat === 'Peripherals'
        ? cat
        : 'Computer';

    const bundle: AssetBundle = {
      id: typeof parsed.id === 'string' && parsed.id ? parsed.id : `scan-${parsed.c}`,
      bundleCode: parsed.c,
      bundleName: parsed.n || 'Issued Workstation Set',
      assigneeName: parsed.a,
      department: parsed.d || '',
      branchLocation: parsed.b || 'Main',
      issuedDate: parsed.i || '',
      notes: parsed.t || '',
      registryAssets: Array.isArray(parsed.r)
        ? parsed.r.map((row, idx) => ({
            assetId: `scan-ast-${idx}`,
            assetCode: String(row[0] ?? ''),
            equipmentName: String(row[1] ?? 'Tracked Equipment'),
            serialNumber: String(row[2] ?? ''),
            brandModel: String(row[3] ?? ''),
            category: validCat(String(row[4] ?? 'Computer')),
          }))
        : [],
      accessories: Array.isArray(parsed.x)
        ? parsed.x.map((row, idx) => ({
            id: `scan-acc-${idx}`,
            name: String(row[0] ?? 'Accessory'),
            category: String(row[1] ?? 'Other'),
            quantity: Math.max(1, Number(row[2]) || 1),
            brandModel: String(row[3] ?? ''),
            serialNumber: String(row[4] ?? ''),
          }))
        : [],
      updatedAt: new Date().toISOString(),
    };

    return { bundle };
  } catch {
    return {
      bundle: null,
      error: 'Unable to read this QR code link. Please regenerate the bundle sticker.',
    };
  }
}

export function buildNextBundleCode(bundles: AssetBundle[]): string {
  let maxNum = 0;
  for (const b of bundles) {
    const m = b.bundleCode.match(/SET-(\d+)/i);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > maxNum) maxNum = n;
    }
  }
  const next = Math.max(maxNum + 1, bundles.length + 1);
  return `SET-${String(next).padStart(3, '0')}`;
}

export function countBundleTotalItems(bundle: AssetBundle): number {
  const regCount = bundle.registryAssets.length;
  const accCount = bundle.accessories.reduce(
    (sum, acc) => sum + Math.max(1, Number(acc.quantity) || 1),
    0
  );
  return regCount + accCount;
}
