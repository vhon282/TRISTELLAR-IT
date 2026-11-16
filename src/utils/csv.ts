export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * RFC-4180 compliant CSV parser with BOM removal and empty-row filtering.
 */
export function parseCsv(text: string): ParsedCsv {
  const clean = text.replace(/^\uFEFF/, '');
  const matrix: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field.trim());
        field = '';
      } else if (ch === '\r' && next === '\n') {
        row.push(field.trim());
        matrix.push(row);
        row = [];
        field = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        row.push(field.trim());
        matrix.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    matrix.push(row);
  }

  const nonEmpty = matrix.filter((r) => r.some((cell) => cell.length > 0));
  if (nonEmpty.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = nonEmpty[0].map((h, idx) => h || `Column_${idx + 1}`);
  const rows = nonEmpty.slice(1).map((r) => {
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[header] = r[idx] ?? '';
    });
    return record;
  });

  return { headers, rows };
}

export function escapeCsvCell(value: string | number | boolean | undefined | null): string {
  const str = value === undefined || value === null ? '' : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCsv<T extends object>(
  filename: string,
  columns: { key: keyof T | string; label: string; format?: (row: T) => string | number | boolean }[],
  data: T[]
): void {
  const headerLine = columns.map((c) => escapeCsvCell(c.label)).join(',');
  const lines = data.map((row) =>
    columns
      .map((col) => {
        const val = col.format
          ? col.format(row)
          : (row as Record<string, unknown>)[col.key as string];
        return escapeCsvCell(val as string | number | boolean);
      })
      .join(',')
  );

  const csvContent = '\uFEFF' + [headerLine, ...lines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Case-insensitive header lookup helper for flexible CSV imports.
 */
export function pickField(row: Record<string, string>, candidates: string[]): string {
  const entries = Object.entries(row);
  for (const candidate of candidates) {
    const normCandidate = candidate.toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = entries.find(
      ([k]) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normCandidate
    );
    if (match && match[1] !== '') {
      return match[1].trim();
    }
  }
  return '';
}

export function generateUid(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
