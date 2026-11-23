import type { CarDocument, InsuranceQuote } from './types';
import { addDays, addMonths, daysUntil, todayISO } from './dates';

export type Cover = 'comprehensive' | 'compulsory';
export const COVERS: Cover[] = ['comprehensive', 'compulsory'];
export const COVER_LABEL: Record<Cover, string> = { comprehensive: 'מקיף', compulsory: 'חובה' };
const DOC_TYPE: Record<Cover, CarDocument['type']> = { comprehensive: 'comprehensive_insurance', compulsory: 'compulsory_insurance' };

export const INSURERS = [
  'מגדל', 'הראל', 'הפניקס', 'כלל', 'מנורה מבטחים', 'איילון', 'ביטוח ישיר', 'AIG', 'שלמה ביטוח', 'הכשרה', 'ליברה', 'שירביט', 'ווישור', '9 מיליון',
];

/** How many days before the current policy ends it's worth collecting quotes */
export const QUOTE_WINDOW_DAYS = 60;

export interface CurrentCover {
  doc: CarDocument;
  cost?: number;
}
export type CurrentPolicy = Partial<Record<Cover, CurrentCover>>;

/**
 * The current policy per cover: the document still in force (latest expiry),
 * or, if all have expired, the most recently expired one.
 */
export function currentPolicy(documents: CarDocument[], today = todayISO()): CurrentPolicy {
  const res: CurrentPolicy = {};
  for (const c of COVERS) {
    const docs = documents.filter((d) => d.type === DOC_TYPE[c]).sort((a, b) => (b.expiryDate ?? '').localeCompare(a.expiryDate ?? ''));
    const doc = docs.find((d) => !d.expiryDate || d.expiryDate >= today) ?? docs[0];
    if (doc) res[c] = { doc, cost: doc.cost };
  }
  return res;
}

export interface QuoteComparison {
  quote: InsuranceQuote;
  /** Price used per cover: the quote's own, or the current price if the quote doesn't include it */
  prices: Partial<Record<Cover, number>>;
  /** Covers taken from the current policy because the quote doesn't include them */
  fromCurrent: Cover[];
  total: number;
  /** current total − this total (positive = cheaper than now). Undefined when there's no current price to compare against */
  savings?: number;
  /** Savings on the covers the quote actually includes */
  savingsByCover: Partial<Record<Cover, number>>;
}

export function currentTotal(cur: CurrentPolicy): number | undefined {
  const xs = COVERS.map((c) => cur[c]?.cost).filter((x): x is number => x != null);
  return xs.length ? xs.reduce((s, x) => s + x, 0) : undefined;
}

export function compareQuote(quote: InsuranceQuote, cur: CurrentPolicy): QuoteComparison {
  const prices: Partial<Record<Cover, number>> = {};
  const fromCurrent: Cover[] = [];
  const savingsByCover: Partial<Record<Cover, number>> = {};
  for (const c of COVERS) {
    const q = quote[c];
    const now = cur[c]?.cost;
    if (q != null) {
      prices[c] = q;
      if (now != null) savingsByCover[c] = now - q;
    } else if (now != null) {
      prices[c] = now;
      fromCurrent.push(c);
    }
  }
  const total = COVERS.reduce((s, c) => s + (prices[c] ?? 0), 0);
  const covered = COVERS.filter((c) => quote[c] != null);
  // Comparable only if every cover the quote includes has a known current price
  const comparable = covered.length > 0 && covered.every((c) => cur[c]?.cost != null);
  const ct = currentTotal(cur);
  return { quote, prices, fromCurrent, total, savings: comparable && ct != null ? ct - total : undefined, savingsByCover };
}

/** Quotes compared to the current policy, cheapest first */
export function compareQuotes(quotes: InsuranceQuote[], cur: CurrentPolicy): QuoteComparison[] {
  return quotes.map((q) => compareQuote(q, cur)).sort((a, b) => a.total - b.total || a.quote.insurer.localeCompare(b.quote.insurer, 'he'));
}

/** The earliest end date of the current policy, and how many days until it */
export function renewal(cur: CurrentPolicy): { date: string; days: number; windowStart: string; periodStart: string } | undefined {
  const dates = COVERS.map((c) => cur[c]?.doc.expiryDate).filter((x): x is string => !!x).sort();
  if (!dates.length) return undefined;
  return { date: dates[0], days: daysUntil(dates[0]), windowStart: addDays(dates[0], -QUOTE_WINDOW_DAYS), periodStart: addDays(addMonths(dates[0], -12), 1) };
}

/** A quote counts toward the coming renewal if it was received during the current policy period */
export const isFreshQuote = (q: InsuranceQuote, periodStart: string) => q.date >= periodStart;
