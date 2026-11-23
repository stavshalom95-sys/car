export interface BaseDoc {
  id: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface FuelEntry extends BaseDoc {
  date: string; // YYYY-MM-DD
  station: string;
  /** Missing on cost-only entries */
  liters?: number;
  totalPrice: number;
  /** Trip meter: km driven since the previous fill-up. Missing on cost-only entries. */
  tripKm?: number;
  fullTank: boolean;
  /** Only the amount is known (e.g. imported history): counts toward costs, never toward consumption or mileage */
  costOnly?: boolean;
  /** Excluded from statistics (e.g. a known typo the user wants to keep) */
  excluded?: boolean;
  notes?: string;
}

export type MaintenanceKind = 'service' | 'repair' | 'tires' | 'battery' | 'brakes' | 'wipers' | 'other';

export interface MaintenanceEntry extends BaseDoc {
  date: string;
  odometer?: number;
  kind: MaintenanceKind;
  description: string;
  parts: string[];
  cost: number;
  garage: string;
  invoiceUrl?: string;
  notes?: string;
}

export interface TestEntry extends BaseDoc {
  date: string;
  passed: boolean;
  station?: string;
  cost?: number;
  odometer?: number;
  /** Vehicle license valid until (renewed by the test) */
  validUntil: string;
  notes?: string;
}

export type DocType =
  | 'vehicle_license'
  | 'driver_license'
  | 'compulsory_insurance'
  | 'comprehensive_insurance'
  | 'other';

export interface Phone {
  label: string;
  number: string;
}

export interface CarDocument extends BaseDoc {
  type: DocType;
  title: string;
  provider?: string;
  expiryDate?: string;
  cost?: number;
  phones: Phone[];
  fileUrl?: string;
  notes?: string;
}

export type TaskList = 'urgent' | 'someday';

export interface Task extends BaseDoc {
  text: string;
  list: TaskList;
  done: boolean;
  dueDate?: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Settings {
  carName: string;
  plate?: string;
  /** A known odometer reading, used as the anchor for mileage estimation */
  baseOdometer?: number;
  baseOdometerDate?: string;
  serviceIntervalKm: number;
  serviceIntervalMonths: number;
  /** Days before a due date at which an item becomes "urgent" */
  reminderDays: number;
  testChecklist: ChecklistItem[];
}

export type PartSlot =
  | 'battery'
  | 'tire_fl' | 'tire_fr' | 'tire_rl' | 'tire_rr' | 'tire_spare'
  | 'pads_front' | 'pads_rear' | 'discs_front' | 'discs_rear'
  | 'wipers' | 'timing_belt';

/** User-entered info for a tracked part. Document id = the slot. */
export interface PartInfo extends BaseDoc {
  brand?: string;
  /** A replacement not logged in maintenance (the newer of this and the maintenance log wins) */
  manualDate?: string;
  manualKm?: number;
  lifeKm?: number;
  lifeMonths?: number;
  warrantyUntil?: string;
  treadMm?: number;
  treadDate?: string;
  notes?: string;
}

export type ExpenseCategory = 'parking' | 'toll' | 'fine' | 'wash' | 'other';

export interface Expense extends BaseDoc {
  date: string;
  category: ExpenseCategory;
  amount: number;
  description?: string;
  location?: string;
  receiptUrl?: string;
  notes?: string;
  /** Fines: payment deadline and status */
  dueDate?: string;
  paid?: boolean;
}

export type EquipmentLocation = 'trunk' | 'under_seat' | 'glovebox' | 'doors' | 'cabin' | 'spare_well' | 'other';
export type EquipmentStatus = 'ok' | 'missing' | 'replace';

export interface EquipmentItem extends BaseDoc {
  name: string;
  location: EquipmentLocation;
  quantity: number;
  status: EquipmentStatus;
  expiryDate?: string;
  notes?: string;
}

/** A quote for renewing / switching car insurance. Prices are annual, in ILS. */
export interface InsuranceQuote extends BaseDoc {
  insurer: string;
  /** Date the quote was received */
  date: string;
  /** Annual price of comprehensive cover (missing = not part of this quote) */
  comprehensive?: number;
  /** Annual price of compulsory cover (missing = not part of this quote) */
  compulsory?: number;
  /** Comprehensive deductible at a non-network garage */
  deductible?: number;
  /** Comprehensive deductible at a network garage */
  deductibleNetwork?: number;
  thirdPartyDeductible?: number;
  thirdPartyLimit?: number;
  towing?: boolean;
  glass?: boolean;
  replacementCar?: boolean;
  /** The quoted price holds until */
  validUntil?: string;
  agent?: string;
  url?: string;
  notes?: string;
  chosen?: boolean;
}

export type CollectionName = 'fuel' | 'maintenance' | 'tests' | 'documents' | 'tasks' | 'parts' | 'expenses' | 'equipment' | 'quotes';
