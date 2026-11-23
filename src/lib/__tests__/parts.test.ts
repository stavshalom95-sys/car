import { describe, expect, it } from 'vitest';
import { computeParts, odometerAt, slotsForEntry, slotsForText } from '../parts';
import type { MaintenanceEntry, Settings } from '../types';

const settings: Settings = { carName: 'x', serviceIntervalKm: 15000, serviceIntervalMonths: 12, reminderDays: 30, testChecklist: [] };
const me = (id: string, date: string, parts: string[], odometer?: number, description = 'x'): MaintenanceEntry =>
  ({ id, date, odometer, parts, description, kind: 'other', cost: 0, garage: '' });

describe('slot matching', () => {
  it('recognises parts in Hebrew line items', () => {
    expect(slotsForText('מצבר Start&Stop 70Ah')).toEqual(['battery']);
    expect(slotsForText('רפידות בלם אחוריות')).toEqual(['pads_rear']);
    expect(slotsForText('רפידות בלם קדמיות')).toEqual(['pads_front']);
    expect(slotsForText('צלחות בלם קדמיות')).toEqual(['discs_front']);
    expect(slotsForText('4 צמיגי Greenlander 225/55R18')).toEqual(['tire_fl', 'tire_fr', 'tire_rl', 'tire_rr']);
    expect(slotsForText('צמיג רזרבי')).toEqual(['tire_spare']);
    expect(slotsForText('צמיג קדמי ימני')).toEqual(['tire_fr']);
    expect(slotsForText('2 צמיגים אחוריים')).toEqual(['tire_rl', 'tire_rr']);
    expect(slotsForText('מגב')).toEqual(['wipers']);
    expect(slotsForText('רצועת תזמון')).toEqual(['timing_belt']);
    expect(slotsForText('מסנן שמן')).toEqual([]);
    expect(slotsForText('גריז לבלמים קדמיים')).toEqual([]);
  });
  it('uses the description only when no line item matched', () => {
    expect(slotsForEntry(me('a', '2025-01-01', [], undefined, 'החלפת מצבר'))).toEqual(['battery']);
    expect(slotsForEntry(me('a', '2025-01-01', ['מסנן שמן'], undefined, 'טיפול + החלפת בלמים'))).toEqual([]);
  });
});

describe('odometer interpolation', () => {
  const ctx = { settings, tests: [], fuel: [], maintenance: [me('a', '2023-01-01', [], 40000), me('b', '2024-01-01', [], 50000)] };
  it('interpolates between readings', () => {
    const r = odometerAt('2023-07-02', ctx);
    expect(r?.estimated).toBe(true);
    expect(r!.km).toBeGreaterThan(44900);
    expect(r!.km).toBeLessThan(45100);
  });
  it('returns exact readings', () => expect(odometerAt('2024-01-01', ctx)).toEqual({ km: 50000, estimated: false }));
});

describe('part status', () => {
  it('takes the latest replacement and computes wear', () => {
    const maintenance = [me('a', '2020-01-01', ['רפידות בלם קדמיות'], 20000), me('b', '2024-01-01', ['רפידות בלם קדמיות', 'מגב'], 50000)];
    const res = computeParts({ settings, maintenance, tests: [], fuel: [], parts: [], currentKm: 70000 });
    const pads = res.find((p) => p.def.slot === 'pads_front')!;
    expect(pads.installedDate).toBe('2024-01-01');
    expect(pads.kmUsed).toBe(20000);
    expect(pads.wear).toBeCloseTo(0.5);
    expect(res.find((p) => p.def.slot === 'tire_spare')!.severity).toBe('missing');
  });
  it('a newer manual entry overrides the maintenance log; low tread is urgent', () => {
    const maintenance = [me('a', '2023-01-01', ['4 צמיגים'], 40000)];
    const res = computeParts({
      settings, maintenance, tests: [], fuel: [], currentKm: 45000,
      parts: [{ id: 'tire_fl', manualDate: '2024-06-01', manualKm: 44000 }, { id: 'tire_rr', treadMm: 1.5 }],
    });
    expect(res.find((p) => p.def.slot === 'tire_fl')!.source?.kind).toBe('manual');
    expect(res.find((p) => p.def.slot === 'tire_fr')!.source?.kind).toBe('maintenance');
    expect(res.find((p) => p.def.slot === 'tire_rr')!.severity).toBe('overdue');
  });
});
