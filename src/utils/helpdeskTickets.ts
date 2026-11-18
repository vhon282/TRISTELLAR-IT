import { HelpdeskTicket } from '../types/cmms';
import { generateUid } from './csv';

export const HELPDESK_TICKET_ASSET_PATH = `${import.meta.env.BASE_URL}assets/aistudio/IT_HELPDESK_REPORT_2026_-_DATA_REPORT_2026_1cf75d0c.csv`;

export const OFFICIAL_BRANCH_LOCATIONS = [
  'TANZA WAREHOUSE',
  'JACK BUILDING',
  'CONCHU WAREHOUSE',
  'TRISTELLAR BACOOR',
] as const;

export const OFFICIAL_HELPDESK_CATEGORIES = [
  'DST',
  'Computer/Peripherals',
  'Printer',
  'KIOSK',
  'Dropbox',
  'BIS/APPS',
  'OS/MS Office',
  'Branch Allocation',
  'Network',
  'CCTV',
  'VMware',
] as const;

const CANONICAL_CATEGORIES: Record<string, string> = {
  DST: 'DST',
  'COMPUTER/PERIPHERALS': 'Computer/Peripherals',
  COMPUTER: 'Computer/Peripherals',
  PERIPHERALS: 'Computer/Peripherals',
  PRINTER: 'Printer',
  KIOSK: 'KIOSK',
  DROPBOX: 'Dropbox',
  'BIS/APPS': 'BIS/APPS',
  BIS: 'BIS/APPS',
  'OS/MS OFFICE': 'OS/MS Office',
  'BRANCH ALLOCATION': 'Branch Allocation',
  NETWORK: 'Network',
  CCTV: 'CCTV',
  VMWARE: 'VMware',
};

export function normalizeBranchLocation(rawBranch: string): string {
  const upper = (rawBranch || '').replace(/\s+/g, ' ').trim().toUpperCase();
  if (!upper) return '';
  if (upper === 'TANZA' || upper === 'TANZA WAREHOUSE' || upper === 'AMAYA') {
    return 'TANZA WAREHOUSE';
  }
  if (upper === 'JACK' || upper === 'JACK BUILDING') {
    return 'JACK BUILDING';
  }
  if (upper === 'CONCHU' || upper === 'CONCHU WAREHOUSE' || upper === 'MAIN') {
    return 'CONCHU WAREHOUSE';
  }
  if (upper.startsWith('BACOOR') || upper === 'TRISTELLAR BACOOR') {
    return 'TRISTELLAR BACOOR';
  }
  if (upper.startsWith('CATTALEY')) {
    return 'CATTALEYA';
  }
  return upper;
}

export function suggestHelpdeskCategory(
  description: string,
  classification = '',
  solution = ''
): string {
  const hay = `${description} ${solution} ${classification}`.toLowerCase();
  if (!hay.trim()) return 'BIS/APPS';
  if (/\bkiosk\b/.test(hay)) return 'KIOSK';
  if (/\bdropbox\b/.test(hay)) return 'Dropbox';
  if (/\bvmware\b/.test(hay)) return 'VMware';
  if (/\b(branch allocation|stock allocation|allocation)\b/.test(hay)) {
    return 'Branch Allocation';
  }
  if (/\bdst\b/.test(hay)) return 'DST';
  if (/\b(cctv|dvr|camera|playback|channel)\b/.test(hay)) return 'CCTV';
  if (
    /\b(printer|print|printing|epson|lx-?310|lx310|l120|l121|l5190|l3210|ink|toner|paper jam|spooler)\b/.test(
      hay
    )
  ) {
    return 'Printer';
  }
  if (
    /\b(network|internet|wifi|wi-fi|lan|converge|pldt|router|switch|ip address|ping|cable)\b/.test(
      hay
    )
  ) {
    return 'Network';
  }
  if (
    /\b(mouse|keyboard|monitor|ups|avr|cpu|pc|laptop|ram|ssd|hdd|battery|speaker|headset|webcam)\b/.test(
      hay
    ) &&
    !/\b(bis|dropbox|excel|office|kiosk)\b/.test(hay)
  ) {
    return 'Computer/Peripherals';
  }
  if (
    /\b(excel|word|office|visio|windows|crystal report|outlook|activate|license|formula)\b/.test(
      hay
    )
  ) {
    return 'OS/MS Office';
  }
  if (/\b(bis|anydesk|pos|si receipt|warehouse|backdat|change date|google sheets|app)\b/.test(hay)) {
    return 'BIS/APPS';
  }
  if (classification.trim().toLowerCase() === 'hardware') {
    return 'Computer/Peripherals';
  }
  return 'BIS/APPS';
}

export function normalizeHelpdeskCategory(
  rawCategory: string,
  description = '',
  classification = '',
  solution = ''
): string {
  const cleaned = (rawCategory || '').replace(/\s+/g, ' ').trim();
  const upper = cleaned.toUpperCase();
  if (!cleaned || upper === 'SYSTEM') {
    return suggestHelpdeskCategory(description, classification, solution);
  }
  const canonical = CANONICAL_CATEGORIES[upper];
  return canonical || cleaned;
}

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
    const rawBranch = cols[colMap.branchLocation] ?? '';
    const branchLocation = normalizeBranchLocation(rawBranch);
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

    const finalClassification = classification || 'Software';
    const finalCategory = normalizeHelpdeskCategory(
      category,
      description,
      finalClassification,
      solution
    );

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
      classification: finalClassification,
      category: finalCategory,
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

export function parseHelpdeskDateMs(raw: string): number | null {
  const cleaned = normalizeDateTypo(raw || '')
    .replace(/,/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  const ts = Date.parse(cleaned);
  if (Number.isNaN(ts)) return null;
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function getTicketResolutionDays(ticket: HelpdeskTicket): number | null {
  const startMs = parseHelpdeskDateMs(ticket.dateStart || ticket.date);
  const finishMs = parseHelpdeskDateMs(ticket.dateFinish);
  if (startMs === null || finishMs === null) return null;
  const diffDays = Math.round((finishMs - startMs) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 ? diffDays : 0;
}

export interface HelpdeskCategoryStat {
  category: string;
  count: number;
  sharePct: number;
  softwareCount: number;
  hardwareCount: number;
  resolvedCount: number;
  pendingCount: number;
  onGoingCount: number;
  totalCost: number;
  totalResolutionDays: number;
  timedTicketCount: number;
  avgResolutionDays: number;
  maxResolutionDays: number;
  topNatureOfWork: string;
  topBranch: string;
  sampleConcerns: string[];
}

export interface LongestSolvedTicket {
  ticket: HelpdeskTicket;
  category: string;
  branch: string;
  days: number;
}

export interface HelpdeskBranchBreakdown {
  branch: string;
  isOfficial: boolean;
  totalTickets: number;
  sharePct: number;
  softwareCount: number;
  hardwareCount: number;
  topCategory: string;
  topCategoryCount: number;
  topCategorySharePct: number;
  topCategories: { category: string; count: number; sharePct: number }[];
}

export interface HelpdeskCategorizationSummary {
  totalTickets: number;
  totalCost: number;
  softwareCount: number;
  hardwareCount: number;
  multiDayCount: number;
  topCategory: HelpdeskCategoryStat | null;
  slowestCategory: HelpdeskCategoryStat | null;
  longestTickets: LongestSolvedTicket[];
  categories: HelpdeskCategoryStat[];
  byBranch: HelpdeskBranchBreakdown[];
  naturesOfWork: { name: string; count: number; sharePct: number }[];
}

export function summarizeHelpdeskCategories(
  tickets: HelpdeskTicket[],
  includeAllOfficialCategories = true
): HelpdeskCategorizationSummary {
  const totalTickets = tickets.length;
  let softwareCount = 0;
  let hardwareCount = 0;
  let totalCost = 0;
  let multiDayCount = 0;

  const natureOverall = new Map<string, number>();
  const longestPool: LongestSolvedTicket[] = [];

  interface Bucket {
    count: number;
    softwareCount: number;
    hardwareCount: number;
    resolvedCount: number;
    pendingCount: number;
    onGoingCount: number;
    totalCost: number;
    totalResolutionDays: number;
    timedTicketCount: number;
    maxResolutionDays: number;
    natures: Map<string, number>;
    branches: Map<string, number>;
    samples: string[];
  }

  const makeEmptyBucket = (): Bucket => ({
    count: 0,
    softwareCount: 0,
    hardwareCount: 0,
    resolvedCount: 0,
    pendingCount: 0,
    onGoingCount: 0,
    totalCost: 0,
    totalResolutionDays: 0,
    timedTicketCount: 0,
    maxResolutionDays: 0,
    natures: new Map(),
    branches: new Map(),
    samples: [],
  });

  const buckets = new Map<string, Bucket>();
  if (includeAllOfficialCategories) {
    for (const officialCat of OFFICIAL_HELPDESK_CATEGORIES) {
      buckets.set(officialCat, makeEmptyBucket());
    }
  }

  interface BranchBucket {
    totalTickets: number;
    softwareCount: number;
    hardwareCount: number;
    categories: Map<string, number>;
  }
  const branchBuckets = new Map<string, BranchBucket>();
  for (const officialBranch of OFFICIAL_BRANCH_LOCATIONS) {
    branchBuckets.set(officialBranch, {
      totalTickets: 0,
      softwareCount: 0,
      hardwareCount: 0,
      categories: new Map(),
    });
  }

  for (const t of tickets) {
    const cat = normalizeHelpdeskCategory(
      t.category || '',
      t.description,
      t.classification,
      t.solution
    );
    const branch = normalizeBranchLocation(t.branchLocation || '');
    const isHardware = t.classification.trim().toLowerCase() === 'hardware';
    if (isHardware) hardwareCount += 1;
    else softwareCount += 1;

    const costAmt = parseTicketCostAmount(t.cost);
    totalCost += costAmt;

    const nature = (t.natureOfWork || '').trim() || 'Provide Assistance';
    natureOverall.set(nature, (natureOverall.get(nature) || 0) + 1);

    let b = buckets.get(cat);
    if (!b) {
      b = makeEmptyBucket();
      buckets.set(cat, b);
    }

    b.count += 1;
    if (isHardware) b.hardwareCount += 1;
    else b.softwareCount += 1;

    const st = (t.status || '').toUpperCase();
    if (st.includes('DONE') || st.includes('RESOLVED')) {
      b.resolvedCount += 1;
    } else if (st.includes('PENDING')) {
      b.pendingCount += 1;
    } else {
      b.onGoingCount += 1;
    }

    const resDays = getTicketResolutionDays(t);
    if (resDays !== null) {
      b.timedTicketCount += 1;
      b.totalResolutionDays += resDays;
      if (resDays > b.maxResolutionDays) {
        b.maxResolutionDays = resDays;
      }
      if (resDays >= 1) {
        multiDayCount += 1;
        longestPool.push({
          ticket: t,
          category: cat,
          branch: branch || '—',
          days: resDays,
        });
      }
    }

    b.totalCost += costAmt;
    b.natures.set(nature, (b.natures.get(nature) || 0) + 1);

    if (branch) {
      b.branches.set(branch, (b.branches.get(branch) || 0) + 1);

      let bb = branchBuckets.get(branch);
      if (!bb) {
        bb = {
          totalTickets: 0,
          softwareCount: 0,
          hardwareCount: 0,
          categories: new Map(),
        };
        branchBuckets.set(branch, bb);
      }
      bb.totalTickets += 1;
      if (isHardware) bb.hardwareCount += 1;
      else bb.softwareCount += 1;
      bb.categories.set(cat, (bb.categories.get(cat) || 0) + 1);
    }

    const desc = (t.description || '').trim();
    if (desc && b.samples.length < 3 && !b.samples.includes(desc)) {
      b.samples.push(desc);
    }
  }

  const officialOrderMap = new Map<string, number>(
    OFFICIAL_HELPDESK_CATEGORIES.map((c, idx) => [c, idx])
  );

  const categories: HelpdeskCategoryStat[] = Array.from(buckets.entries())
    .map(([category, b]) => {
      const topNature =
        b.count > 0
          ? Array.from(b.natures.entries()).sort((x, y) => y[1] - x[1])[0]?.[0] ||
            'Provide Assistance'
          : '—';
      const topBranch =
        b.count > 0
          ? Array.from(b.branches.entries()).sort((x, y) => y[1] - x[1])[0]?.[0] ||
            '—'
          : '—';
      return {
        category,
        count: b.count,
        sharePct: totalTickets > 0 ? (b.count / totalTickets) * 100 : 0,
        softwareCount: b.softwareCount,
        hardwareCount: b.hardwareCount,
        resolvedCount: b.resolvedCount,
        pendingCount: b.pendingCount,
        onGoingCount: b.onGoingCount,
        totalCost: b.totalCost,
        totalResolutionDays: b.totalResolutionDays,
        timedTicketCount: b.timedTicketCount,
        avgResolutionDays:
          b.timedTicketCount > 0
            ? b.totalResolutionDays / b.timedTicketCount
            : 0,
        maxResolutionDays: b.maxResolutionDays,
        topNatureOfWork: topNature,
        topBranch,
        sampleConcerns: b.samples,
      };
    })
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      const oa = officialOrderMap.get(a.category) ?? 999;
      const ob = officialOrderMap.get(b.category) ?? 999;
      if (oa !== ob) return oa - ob;
      return a.category.localeCompare(b.category);
    });

  const officialBranchSet = new Set<string>(OFFICIAL_BRANCH_LOCATIONS);
  const byBranch: HelpdeskBranchBreakdown[] = Array.from(branchBuckets.entries())
    .filter(
      ([branchName, bb]) =>
        officialBranchSet.has(branchName) || bb.totalTickets > 0
    )
    .map(([branch, bb]) => {
      const sortedCats = Array.from(bb.categories.entries())
        .sort((x, y) => y[1] - x[1])
        .map(([category, count]) => ({
          category,
          count,
          sharePct: bb.totalTickets > 0 ? (count / bb.totalTickets) * 100 : 0,
        }));
      const top = sortedCats[0];
      return {
        branch,
        isOfficial: officialBranchSet.has(branch),
        totalTickets: bb.totalTickets,
        sharePct: totalTickets > 0 ? (bb.totalTickets / totalTickets) * 100 : 0,
        softwareCount: bb.softwareCount,
        hardwareCount: bb.hardwareCount,
        topCategory: top?.category ?? '—',
        topCategoryCount: top?.count ?? 0,
        topCategorySharePct: top?.sharePct ?? 0,
        topCategories: sortedCats.slice(0, 3),
      };
    })
    .sort((a, b) => {
      if (a.isOfficial !== b.isOfficial) return a.isOfficial ? -1 : 1;
      return b.totalTickets - a.totalTickets;
    });

  const naturesOfWork = Array.from(natureOverall.entries())
    .map(([name, count]) => ({
      name,
      count,
      sharePct: totalTickets > 0 ? (count / totalTickets) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const nonZeroCategories = categories.filter((c) => c.count > 0);
  const slowestCategory =
    [...nonZeroCategories]
      .filter((c) => c.maxResolutionDays > 0 || c.avgResolutionDays > 0)
      .sort(
        (a, b) =>
          b.avgResolutionDays - a.avgResolutionDays ||
          b.maxResolutionDays - a.maxResolutionDays ||
          b.count - a.count
      )[0] ?? null;

  const longestTickets = longestPool
    .sort((a, b) => b.days - a.days || a.ticket.ticketNo - b.ticket.ticketNo)
    .slice(0, 10);

  return {
    totalTickets,
    totalCost,
    softwareCount,
    hardwareCount,
    multiDayCount,
    topCategory: nonZeroCategories[0] ?? categories[0] ?? null,
    slowestCategory,
    longestTickets,
    categories,
    byBranch,
    naturesOfWork,
  };
}

