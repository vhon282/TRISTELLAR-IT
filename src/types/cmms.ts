export type AssetCategory = 'Computer' | 'Printer' | 'Peripherals';
export type BranchLocation = 'Conchu' | 'Main' | 'Bacoor' | 'Amaya' | 'Bulacan';
export type AssetCondition = 'GOOD' | 'FAIR' | 'POOR' | 'BAD';
export type OperationalStatus =
  | 'OPERATIONAL'
  | 'DEGRADED'
  | 'DOWN'
  | 'MAINTENANCE'
  | 'RETIRED';

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';
export type Technician = 'Mac' | 'Francis' | 'Shem';
export type MaintenanceStatus = 'Done' | 'Pending';

export interface Asset {
  id: string;
  equipmentName: string;
  assetCode: string;
  serialNumber: string;
  category: AssetCategory;
  brand: string;
  model: string;
  specification: string;
  branchLocation: BranchLocation | string;
  assignedTo: string;
  condition: AssetCondition;
  operationalStatus: OperationalStatus;
  lastMaintenanceDate: string;
  notes: string;
}

export type ChecklistSection =
  | 'GENERAL MAINTENANCE'
  | 'SECURITY MAINTENANCE'
  | 'HARDWARE MAINTENANCE'
  | 'SOFTWARE MAINTENANCE';

export interface MaintenanceChecklistItem {
  itemNo?: number;
  section?: ChecklistSection;
  label: string;
  note?: string;
  checked: boolean;
  remarks?: string;
}

export interface MaintenanceTask {
  id: string;
  assetId: string;
  assetCode: string;
  equipmentName: string;
  branchLocation: string;
  seqNumber?: string;
  formCode?: string;
  description?: string;
  incharge?: string;
  position?: string;
  department?: string;
  quarter: Quarter;
  year: number;
  technician: Technician;
  scheduledDate: string;
  actualDate: string;
  status: MaintenanceStatus;
  checklistItems: MaintenanceChecklistItem[];
  remarks: string;
  resultCondition: AssetCondition;
  setAssetStatusTo: OperationalStatus;
}

export interface SparePartRequest {
  id: string;
  item: string;
  type: string;
  description: string;
  requestQuantity: number;
  stockLeft: number;
  isUrgent: boolean;
  fromJack: boolean;
  notes?: string;
}

export type DisposalStatus = 'For Disposal' | 'Defective' | 'Keep';

export interface DisposalKeepItem {
  id: string;
  model: string;
  brand: string;
  status: DisposalStatus;
  fromBranch: string;
  assetTag: string;
  turnoverDate: string;
  department: string;
  equipmentType: string;
  endBranch: string;
  assortedItem: string;
  qty: number;
  area: string;
}

export interface AnyDeskEntry {
  id: string;
  anydeskId: string;
  serverOrPcName: string;
  branchDescription: string;
  categoryStatus: string;
  isFavorite: boolean;
}

export interface CctvEntry {
  id: string;
  branch: string;
  cameraNo: string;
  ipAddress: string;
  locationArea: string;
  statusNotes: string;
}

export type RadioDepartment =
  | 'PRES'
  | 'COO'
  | 'EXE'
  | 'Dispatch OM'
  | 'Procurement'
  | 'Sales'
  | 'Marketing'
  | 'IT'
  | 'Warehouse'
  | 'Mechanic';

export interface RadioEntry {
  id: string;
  personnelOrUnit: string;
  departmentRole: RadioDepartment | string;
  callsign: string;
  channelNo: string;
  notes: string;
}

export interface WifiAuthorizedDevice {
  id: string;
  employeeName: string;
  allowedQty: number;
  deviceBreakdown: string;
  department?: string;
}

export type VoucherDeviceType = 'Company Laptop' | 'Company Phone' | 'Personal Phone';
export type VoucherStatus = 'Used' | 'Available';

export interface WifiVoucher {
  id: string;
  date: string;
  voucherCode: string;
  employeeName: string;
  employeeNumber: string;
  deviceType: VoucherDeviceType;
  status: VoucherStatus;
}

export type ChatChannel =
  | 'general-it'
  | 'branch-support'
  | 'maintenance-ops'
  | 'parts-procurement';

export interface TeamChatMessage {
  id: string;
  channel: ChatChannel;
  sender: string;
  senderRole?: string;
  content: string;
  assetCode?: string;
  branchLocation?: string;
  createdAt: string;
}

export type NoteCategory =
  | 'Handover'
  | 'Runbook'
  | 'Incident'
  | 'Maintenance'
  | 'Config';

export interface ItNote {
  id: string;
  title: string;
  content: string;
  category: NoteCategory;
  branchLocation: string;
  assetCode?: string;
  author: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OnlinePresenceUser {
  clientId: string;
  userName: string;
  role: string;
}

export interface CmmsDatabase {
  version: number;
  updatedAt: string;
  assets: Asset[];
  maintenanceTasks: MaintenanceTask[];
  spareParts: SparePartRequest[];
  disposalItems: DisposalKeepItem[];
  anydeskEntries: AnyDeskEntry[];
  cctvEntries: CctvEntry[];
  radioEntries: RadioEntry[];
  wifiAuthorizedDevices: WifiAuthorizedDevice[];
  wifiVouchers: WifiVoucher[];
}

export type ActiveModule =
  | 'dashboard'
  | 'assets'
  | 'maintenance'
  | 'parts'
  | 'comms'
  | 'team';

export interface GlobalSearchResult {
  id: string;
  module: ActiveModule;
  subTab?: string;
  title: string;
  subtitle: string;
  code?: string;
}

export type MaintenanceResetMode = 'rollover' | 'reset-pending' | 'clear';

export interface MaintenanceResetPayload {
  mode: MaintenanceResetMode;
  sourceYear: 'ALL' | 'FROM_ASSETS' | number;
  targetYear: number;
  keepHistory: boolean;
  resetAssetLastPmDate: boolean;
}
