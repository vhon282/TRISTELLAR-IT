import { VoucherDeviceType, VoucherStatus, WifiVoucher } from '../types/cmms';
import { generateUid, parseCsv, pickField } from './csv';

export const WIFI_VOUCHER_ASSET_PATH = `${import.meta.env.BASE_URL}assets/aistudio/Voucher__2__1cb8fc1e.csv`;

function formatPortalDate(raw: string): string {
  const cleaned = (raw || '').trim();
  if (!cleaned || cleaned === '-') return '';
  const datePart = cleaned.split(' ')[0] || '';
  return datePart.replace(/\//g, '-');
}

function inferDeviceType(
  userGroup: string,
  alias: string,
  explicitDevice: string
): VoucherDeviceType {
  const combined = `${explicitDevice} ${alias}`.toLowerCase();
  if (userGroup.toLowerCase() === 'guest' && !combined.trim()) {
    return 'Guest Device';
  }
  if (combined.includes('tablet')) return 'Tablet';
  if (combined.includes('companyphone') || combined.includes('company phone')) {
    return 'Company Phone';
  }
  if (combined.includes('phone') || combined.includes('personal')) {
    return 'Personal Phone';
  }
  if (combined.includes('guest')) return 'Guest Device';
  return 'Company Laptop';
}

function normalizeVoucherStatus(
  rawStatus: string,
  hasEmployeeName: boolean,
  isPortalFormat: boolean
): VoucherStatus {
  const s = (rawStatus || '').trim().toLowerCase();
  if (s === 'expired') return 'Expired';
  if (s === 'in use' || s === 'used') return 'Used';
  if (s === 'not used' || s === 'available') return 'Available';
  if (!isPortalFormat && hasEmployeeName) return 'Used';
  return 'Available';
}

export function isPortalVoucherRowSet(rows: Record<string, string>[]): boolean {
  if (rows.length === 0) return false;
  const keys = Object.keys(rows[0]).join(' ').toLowerCase();
  return (
    keys.includes('user group') ||
    keys.includes('traffic used') ||
    keys.includes('mac binding') ||
    keys.includes('created at')
  );
}

export function parsePortalVoucherRows(
  rows: Record<string, string>[]
): WifiVoucher[] {
  const portalFormat = isPortalVoucherRowSet(rows);

  return rows
    .map((row, idx) => {
      const voucherCode =
        pickField(row, ['Voucher code', 'Voucher Code', 'Code', 'Voucher']) ||
        (Object.values(row)[0]?.trim() ?? '');
      if (!voucherCode) return null;

      const userGroup = pickField(row, ['User group', 'User Group', 'Group']) || 'Employee';
      const rawStatus = pickField(row, ['Status']);
      const firstName = pickField(row, ['First name', 'First Name']);
      const lastName = pickField(row, ['Last name', 'Last Name']);
      const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
      const employeeName =
        fullName || pickField(row, ['Employee Name', 'Employee']);
      const alias = pickField(row, ['Alias']);
      const createdAt = pickField(row, ['Created at', 'Created At']);
      const activatedAt = pickField(row, ['Activated at', 'Activated At']);
      const expiredAt = pickField(row, ['Expired at', 'Expired At']);
      const period = pickField(row, ['Period']) || (userGroup === 'GUEST' ? '1Days' : 'Unlimited');
      const devices = pickField(row, ['Devices']);
      const macBinding = pickField(row, ['MAC Binding', 'Mac Binding']);
      const trafficUsed = pickField(row, ['Traffic Used/Total', 'Traffic Used', 'Traffic']);
      const explicitDevice = pickField(row, ['Device Type', 'Device']);

      const status = normalizeVoucherStatus(
        rawStatus,
        Boolean(employeeName),
        portalFormat
      );

      const date =
        formatPortalDate(activatedAt) ||
        formatPortalDate(createdAt) ||
        pickField(row, ['Date']) ||
        new Date().toISOString().slice(0, 10);

      const deviceType = inferDeviceType(userGroup, alias, explicitDevice);

      const voucher: WifiVoucher = {
        id: `wv-${voucherCode.toLowerCase()}-${idx + 1}`,
        date,
        voucherCode,
        employeeName,
        employeeNumber: pickField(row, ['Employee #', 'Employee Number', 'Emp No']),
        deviceType,
        status,
        userGroup,
        portalStatus: rawStatus || (status === 'Used' ? 'In use' : status === 'Expired' ? 'Expired' : 'Not used'),
        period,
        alias: alias || undefined,
        createdAt: createdAt && createdAt !== '-' ? createdAt : undefined,
        activatedAt: activatedAt && activatedAt !== '-' ? activatedAt : undefined,
        expiredAt: expiredAt && expiredAt !== '-' ? expiredAt : undefined,
        devices: devices || undefined,
        macBinding: macBinding || undefined,
        trafficUsed: trafficUsed || undefined,
      };

      return voucher;
    })
    .filter((v): v is WifiVoucher => v !== null);
}

export function parsePortalVoucherCsvText(rawText: string): WifiVoucher[] {
  const parsed = parseCsv(rawText);
  return parsePortalVoucherRows(parsed.rows);
}

export async function fetchSeedWifiVouchers(): Promise<WifiVoucher[]> {
  const res = await fetch(WIFI_VOUCHER_ASSET_PATH);
  if (!res.ok) {
    throw new Error(`Failed to fetch Wi-Fi voucher CSV (${res.status})`);
  }
  const text = await res.text();
  return parsePortalVoucherCsvText(text);
}

export function mergeWifiVouchers(
  existing: WifiVoucher[],
  incoming: WifiVoucher[]
): WifiVoucher[] {
  const byCode = new Map<string, WifiVoucher>();
  for (const v of existing) {
    byCode.set(v.voucherCode.trim().toLowerCase(), v);
  }

  const orderedCodes: string[] = [];
  const seen = new Set<string>();

  for (const inc of incoming) {
    const key = inc.voucherCode.trim().toLowerCase();
    if (!key) continue;
    const prev = byCode.get(key);
    if (prev) {
      byCode.set(key, {
        ...prev,
        ...inc,
        id: prev.id || inc.id || generateUid('wv'),
        employeeName: inc.employeeName || prev.employeeName,
        employeeNumber: inc.employeeNumber || prev.employeeNumber,
      });
    } else {
      byCode.set(key, inc);
    }
    if (!seen.has(key)) {
      orderedCodes.push(key);
      seen.add(key);
    }
  }

  for (const v of existing) {
    const key = v.voucherCode.trim().toLowerCase();
    if (key && !seen.has(key)) {
      orderedCodes.push(key);
      seen.add(key);
    }
  }

  return orderedCodes
    .map((k) => byCode.get(k)!)
    .filter(Boolean);
}
