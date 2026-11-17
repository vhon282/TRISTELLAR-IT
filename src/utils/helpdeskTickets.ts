import { HelpdeskTicket } from '../types/cmms';
import { generateUid } from './csv';

export const HELPDESK_TICKET_ASSET_PATH = `${import.meta.env.BASE_URL}assets/aistudio/IT_HELPDESK_REPORT_2026_1cf75d0c.csv`;

function cleanCell(value: string | undefined): string {
  return (value ?? '').replace(/\u00A0/g, ' ').trim();
}

function normalizeDateTypo(value: string): string {
  return value.replace(/\b20226\b/g, '2026');
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cleanCell(field));
      field = '';
    } else {
      field += ch;
    }
  }
  cells.push(cleanCell(field));
  return cells;
}

function normalizeAttendedBy(raw: string): string {
  const upper = raw.trim().toUpperCase();
  if (!upper) return '';
  if (upper === 'IT_PATRICK') return 'PATRICK';
  if (upper === 'FRANCIS_IT') return 'FRANCIS';
  return upper;
}

function isStatusText(val: string): boolean {
  const u = val.trim().toUpperCase();
  return (
    u === 'DONE / RESOLVED' ||
    u === 'PENDING' ||
    u === 'ON-GOING' ||
    u === 'ON GOING' ||
    u === 'RESOLVED' ||
    u === 'DONE'
  );
}

/**
 * Parses tab-separated (Excel/Sheets paste) or comma-separated IT Maintenance Helpdesk logs.
 * Automatically skips title preamble rows until the column header row is found,
 * or parses raw headerless rows matching the 17-column schema.
 */
export function parseHelpdeskTicketLog(rawText: string): HelpdeskTicket[] {
  const clean = rawText.replace(/^\uFEFF/, '');
  const rawLines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (rawLines.length === 0) return [];

  // Detect delimiter (TSV preferred if tabs exist in the header/data)
  const sampleLines = rawLines.slice(0, Math.min(10, rawLines.length));
  const usesTabs = sampleLines.some((l) => (l.match(/\t/g) || []).length >= 5);

  const splitRow = (line: string): string[] =>
    usesTabs ? line.split('\t').map(cleanCell) : splitCsvLine(line);

  let headerIdx = -1;
  for (let i = 0; i < Math.min(15, rawLines.length); i++) {
    const cols = splitRow(rawLines[i]).map((c) => c.toUpperCase());
    const hasBranch = cols.some((c) => c.includes('BRANCH'));
    const hasDesc = cols.some(
      (c) => c.includes('DESCRIPTION') || c.includes('CONCERN')
    );
    const hasAttended = cols.some((c) => c.includes('ATTENDED'));
    if (hasBranch && (hasDesc || hasAttended)) {
      headerIdx = i;
      break;
    }
  }

  const colMap: Record<string, number> = {
    ticketNo: 0,
    date: 1,
    branchLocation: 2,
    department: 3,
    description: 4,
    notedBy: 5,
    dateStart: 6,
    dateFinish: 7,
    attendedBy: 8,
    detailsOfNarration: 9,
    solution: 10,
    classification: 11,
    category: 12,
    natureOfWork: 13,
    remarks: 14,
    status: 15,
    cost: 16,
  };

  if (headerIdx >= 0) {
    const headerCols = splitRow(rawLines[headerIdx]).map((c) =>
      c.toUpperCase().replace(/[^A-Z0-9/# ]/g, '')
    );
    const findCol = (preds: ((h: string) => boolean)[], fallback: number): number => {
      for (const pred of preds) {
        const idx = headerCols.findIndex(pred);
        if (idx >= 0) return idx;
      }
      return fallback;
    };

    colMap.ticketNo = findCol([(h) => h === '#' || h === 'NO' || h === 'TICKET #'], 0);
    colMap.date = findCol([(h) => h === 'DATE'], 1);
    colMap.branchLocation = findCol([(h) => h.includes('BRANCH')], 2);
    colMap.department = findCol([(h) => h.includes('DEPARTMENT') || h === 'DEPT'], 3);
    colMap.description = findCol(
      [(h) => h.includes('DESCRIPTION') || h.includes('CONCERN')],
      4
    );
    colMap.notedBy = findCol([(h) => h.includes('NOTED')], 5);
    colMap.dateStart = findCol([(h) => h.includes('START')], 6);
    colMap.dateFinish = findCol([(h) => h.includes('FINISH')], 7);
    colMap.attendedBy = findCol([(h) => h.includes('ATTENDED')], 8);
    colMap.detailsOfNarration = findCol(
      [(h) => h.includes('NARRATION') || h.includes('DETAILS')],
      9
    );
    colMap.solution = findCol([(h) => h.includes('SOLUTION')], 10);
    colMap.classification = findCol([(h) => h.includes('CLASSIFICATION')], 11);
    colMap.category = findCol([(h) => h.includes('CATEGORY')], 12);
    colMap.natureOfWork = findCol([(h) => h.includes('NATURE')], 13);
    colMap.remarks = findCol([(h) => h.includes('REMARK')], 14);
    colMap.status = findCol([(h) => h === 'STATUS'], 15);
    colMap.cost = findCol([(h) => h === 'COST'], 16);
  }

  const startRow = headerIdx >= 0 ? headerIdx + 1 : 0;
  const tickets: HelpdeskTicket[] = [];

  for (let i = startRow; i < rawLines.length; i++) {
    const cols = splitRow(rawLines[i]);
    const description = cols[colMap.description] ?? '';
    const date = normalizeDateTypo(cols[colMap.date] ?? '');
    const branchLocation = cols[colMap.branchLocation] ?? '';
    if (!description && !branchLocation && !date) continue;

    const rawNo = Number((cols[colMap.ticketNo] ?? '').replace(/[^0-9]/g, ''));
    const ticketNo = Number.isFinite(rawNo) && rawNo > 0 ? rawNo : tickets.length + 1;

    let attendedBy = normalizeAttendedBy(cols[colMap.attendedBy] ?? '');
    let detailsOfNarration = cols[colMap.detailsOfNarration] ?? '';
    let solution = cols[colMap.solution] ?? '';
    let classification = cols[colMap.classification] ?? '';
    let category = cols[colMap.category] ?? '';
    let natureOfWork = cols[colMap.natureOfWork] ?? '';
    let remarks = cols[colMap.remarks] ?? '';
    let status = cols[colMap.status] ?? '';
    let cost = cols[colMap.cost] ?? '';

    // Auto-realign spreadsheet rows where an extra column shifted Classification into col 12
    const classLower = classification.trim().toLowerCase();
    const nextLower = category.trim().toLowerCase();
    const isShiftedRow =
      classLower !== 'software' &&
      classLower !== 'hardware' &&
      (nextLower === 'software' || nextLower === 'hardware');

    if (isShiftedRow) {
      const col9 = detailsOfNarration.trim();
      if (col9 && (col9.toLowerCase().includes('it') || col9.toLowerCase().includes('francis'))) {
        const extraAttended = normalizeAttendedBy(col9);
        if (extraAttended && extraAttended !== attendedBy) {
          attendedBy = attendedBy ? `${attendedBy} / ${extraAttended}` : extraAttended;
        }
      }
      detailsOfNarration = solution || description;
      solution = classification;
      classification = category;
      category = natureOfWork;
      natureOfWork = remarks;
      remarks = '';
      if (!isStatusText(status) && isStatusText(cost)) {
        status = cost;
      }
      cost = '';
    }

    if (isStatusText(cost)) {
      if (!isStatusText(status)) status = cost;
      cost = '';
    }

    tickets.push({
      id: `hdt-${ticketNo}-${i}`,
      ticketNo,
      date,
      branchLocation,
      department: cols[colMap.department] ?? '',
      description,
      notedBy: cols[colMap.notedBy] ?? '',
      dateStart: normalizeDateTypo(cols[colMap.dateStart] ?? date),
      dateFinish: normalizeDateTypo(cols[colMap.dateFinish] ?? ''),
      attendedBy,
      detailsOfNarration: detailsOfNarration || description,
      solution,
      classification: classification || 'Software',
      category,
      natureOfWork,
      remarks,
      status: (status || 'DONE / RESOLVED').toUpperCase(),
      cost,
    });
  }

  return tickets;
}

export async function fetchSeedHelpdeskTickets(): Promise<HelpdeskTicket[]> {
  const res = await fetch(HELPDESK_TICKET_ASSET_PATH);
  if (!res.ok) {
    throw new Error(`Failed to fetch Helpdesk log (${res.status})`);
  }
  const text = await res.text();
  return parseHelpdeskTicketLog(text);
}

export function createTicketUid(): string {
  return generateUid('hdt');
}

export function parseTicketCostAmount(costStr: string): number {
  const numeric = Number((costStr || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}
