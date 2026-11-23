import { describe, expect, it } from 'vitest';
import { annualCost } from '../calc';
import type { CarDocument, Expense, FuelEntry, MaintenanceEntry } from '../types';

const fuel: FuelEntry[] = [
  { id: 'a', date: '2025-09-22', station: 'x', totalPrice: 130.88, fullTank: false, costOnly: true },
  { id: 'b', date: '2026-01-27', station: 'x', totalPrice: 223.07, fullTank: false, costOnly: true },
];
const maintenance: MaintenanceEntry[] = [{ id: 'm', date: '2026-02-08', kind: 'service', description: 's', parts: [], cost: 940, garage: 'g' }];
const doc = (id: string, type: CarDocument['type'], expiryDate: string, cost?: number): CarDocument => ({ id, type, title: id, expiryDate, cost, phones: [] });
const documents = [
  doc('chova', 'compulsory_insurance', '2027-02-28', 1427), doc('makif', 'comprehensive_insurance', '2027-02-28', 2397),
  doc('lic', 'vehicle_license', '2027-02-16', 1895), doc('start', 'other', '2027-02-28', 800), doc('dl', 'driver_license', '2029-08-19'),
];
const expenses: Expense[] = [
  { id: 'p', date: '2026-03-01', category: 'parking', amount: 20 },
  { id: 't', date: '2026-03-02', category: 'toll', amount: 35.5 },
  { id: 'old', date: '2025-03-02', category: 'wash', amount: 50 },
];

describe('annual cost', () => {
  const input = { fuel, maintenance, tests: [], documents, expenses };
  it('sums every category for the year, insurance by policy start year', () => {
    const c = annualCost('2026', input);
    expect(c.total).toBeCloseTo(223.07 + 940 + 1427 + 2397 + 1895 + 800 + 20 + 35.5);
    expect(c.rows[0].key).toBe('insurance');
    expect(c.rows.find((r) => r.key === 'insurance')!.amount).toBe(3824);
    expect(c.byMonth[1]).toBeCloseTo(940 + 1427 + 2397 + 1895 + 800); // February
    expect(c.byMonth.reduce((s, v) => s + v, 0)).toBeCloseTo(c.total);
  });
  it('keeps other years separate', () => {
    expect(annualCost('2025', input).total).toBeCloseTo(130.88 + 50);
  });
});
