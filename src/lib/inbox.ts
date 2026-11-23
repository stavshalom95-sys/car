import type { Expense, ExpenseCategory } from './types';
import { addDays, isValidISO } from './dates';

/**
 * Gmail → app import inbox (Firestore collection "inbox").
 * A monthly cloud routine reads receipts from Gmail and may only CREATE pending items there
 * (enforced by firestore.rules). Items reach the expenses only after the user approves them.
 * Contents are untrusted – everything is validated again here before use.
 */
export type InboxStatus = 'pending' | 'imported' | 'dismissed';

export interface InboxItem {
  id: string;
  status: InboxStatus;
  category: ExpenseCategory;
  date: string;
  /** null = the routine couldn't read the amount; the user must enter it */
  amount: number | null;
  location?: string;
  description: string;
  receiptUrl?: string;
  notes?: string;
  needsReview?: boolean;
  reviewReason?: string;
  source?: string;
}

const CATS: ExpenseCategory[] = ['parking', 'toll', 'fine', 'wash', 'other'];
const STATUSES: InboxStatus[] = ['pending', 'imported', 'dismissed'];
const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);

/** Validate one inbox document; returns null if it doesn't look right */
export function parseInboxDoc(raw: Record<string, unknown>, docId: string): InboxItem | null {
  const date = str(raw?.date, 10);
  const category = raw?.category as ExpenseCategory;
  const status = (raw?.status ?? 'pending') as InboxStatus;
  const amount = raw?.amount === null ? null : typeof raw?.amount === 'number' && raw.amount > 0 && raw.amount < 100000 ? Math.round(raw.amount * 100) / 100 : undefined;
  const description = str(raw?.description);
  const receiptUrl = str(raw?.receiptUrl, 500);
  if (!/^imp-[a-z0-9-]+$/.test(docId) || !date || !isValidISO(date) || !CATS.includes(category) || !STATUSES.includes(status)
    || amount === undefined || !description || (receiptUrl && !/^https:\/\/mail\.google\.com\//.test(receiptUrl))) return null;
  return {
    id: docId, status, date, category, amount, description,
    location: str(raw.location, 120), receiptUrl, notes: str(raw.notes, 500),
    needsReview: raw.needsReview === true || amount === null, reviewReason: str(raw.reviewReason, 300), source: str(raw.source, 20),
  };
}

/** Pending items that aren't already in the expenses (same id), oldest first */
export function pendingItems(all: InboxItem[], expenses: Pick<Expense, 'id'>[]): InboxItem[] {
  const have = new Set(expenses.map((e) => e.id));
  return all.filter((i) => i.status === 'pending' && !have.has(i.id)).sort((a, b) => a.date.localeCompare(b.date));
}

/** Expenses of the same category near the item's date – shown so a monthly invoice isn't counted twice next to per-trip entries */
export function nearbySameCategory(item: InboxItem, expenses: Expense[], days = 40): Expense[] {
  const from = addDays(item.date, -days);
  return expenses.filter((e) => e.category === item.category && e.date >= from && e.date <= item.date);
}

export function toExpense(i: InboxItem, amount: number): Omit<Expense, 'id'> {
  return {
    date: i.date, category: i.category, amount, description: i.description,
    location: i.location, receiptUrl: i.receiptUrl,
    notes: [i.notes, 'יובא מ-Gmail (שגרה חודשית)'].filter(Boolean).join(' · '),
  };
}
