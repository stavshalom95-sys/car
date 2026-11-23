import { describe, expect, it } from 'vitest';
import { compareQuote, compareQuotes, currentPolicy, currentTotal, isFreshQuote, renewal } from '../insurance';
import { buildDueItems } from '../calc';
import { addDays, addMonths, todayISO } from '../dates';
import type { CarDocument, InsuranceQuote, Settings } from '../types';

const today = todayISO();
const doc = (id: string, type: CarDocument['type'], cost: number | undefined, expiryDate: string, provider = 'מגדל'): CarDocument =>
  ({ id, type, title: id, provider, cost, expiryDate, phones: [] });
const docs = [
  doc('comp-old', 'comprehensive_insurance', 2100, addDays(today, -300)),
  doc('comp', 'comprehensive_insurance', 2397, addDays(today, 97)),
  doc('mand', 'compulsory_insurance', 1427, addDays(today, 97)),
];
const q = (id: string, p: Partial<InsuranceQuote>): InsuranceQuote => ({ id, insurer: id, date: today, ...p });

describe('insurance comparison', () => {
  const cur = currentPolicy(docs);

  it('picks the policy in force, not an expired one', () => {
    expect(cur.comprehensive?.doc.id).toBe('comp');
    expect(currentTotal(cur)).toBe(3824);
  });

  it('computes savings for a full package', () => {
    const c = compareQuote(q('הראל', { comprehensive: 2000, compulsory: 1300 }), cur);
    expect(c.total).toBe(3300);
    expect(c.savings).toBe(524);
    expect(c.savingsByCover).toEqual({ comprehensive: 397, compulsory: 127 });
    expect(c.fromCurrent).toEqual([]);
  });

  it('fills a missing cover with the current price so totals stay comparable', () => {
    const c = compareQuote(q('ישיר', { comprehensive: 2600 }), cur);
    expect(c.fromCurrent).toEqual(['compulsory']);
    expect(c.total).toBe(2600 + 1427);
    expect(c.savings).toBe(-203);
  });

  it('has no savings figure when the current price is unknown', () => {
    const noPrice = currentPolicy([doc('c', 'comprehensive_insurance', undefined, addDays(today, 90))]);
    expect(compareQuote(q('x', { comprehensive: 2000 }), noPrice).savings).toBeUndefined();
  });

  it('sorts cheapest first', () => {
    const rows = compareQuotes([q('b', { comprehensive: 2500, compulsory: 1400 }), q('a', { comprehensive: 1900, compulsory: 1400 })], cur);
    expect(rows.map((r) => r.quote.id)).toEqual(['a', 'b']);
  });

  it('treats quotes received during the current policy period as fresh', () => {
    const ren = renewal(cur)!;
    expect(ren.periodStart).toBe(addDays(addMonths(ren.date, -12), 1));
    expect(isFreshQuote(q('n', { date: today }), ren.periodStart)).toBe(true);
    expect(isFreshQuote(q('o', { date: addDays(today, -400) }), ren.periodStart)).toBe(false);
  });

  it('nudges on the dashboard only inside the 60-day window', () => {
    const settings: Settings = { carName: 'x', serviceIntervalKm: 15000, serviceIntervalMonths: 12, reminderDays: 30, testChecklist: [] };
    const base = { settings, fuel: [], maintenance: [], tests: [], tasks: [] };
    expect(buildDueItems({ ...base, documents: docs }).some((i) => i.id === 'insurance-quotes')).toBe(false);
    const soon = docs.map((d) => (d.id === 'comp-old' ? d : { ...d, expiryDate: addDays(today, 40) }));
    const item = buildDueItems({ ...base, documents: soon, quotes: [] }).find((i) => i.id === 'insurance-quotes');
    expect(item?.severity).toBe('soon');
    const two = [q('a', { comprehensive: 1 }), q('b', { comprehensive: 1 })];
    expect(buildDueItems({ ...base, documents: soon, quotes: two }).find((i) => i.id === 'insurance-quotes')?.severity).toBe('ok');
  });
});

describe('renewed documents', () => {
  it('reminds only about the newest document of each type', () => {
    const settings: Settings = { carName: 'x', serviceIntervalKm: 15000, serviceIntervalMonths: 12, reminderDays: 30, testChecklist: [] };
    const ids = buildDueItems({ settings, fuel: [], maintenance: [], tests: [], tasks: [], documents: docs }).map((i) => i.id);
    expect(ids).toContain('doc-comp');
    expect(ids).not.toContain('doc-comp-old');
  });
});
