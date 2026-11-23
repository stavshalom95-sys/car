import { describe, expect, it } from 'vitest';
import { averageConsumption, consumptionAnomalies, consumptionById, estimateOdometer, predictService } from '../calc';
import { findSensitive, validateFuel, validateTest } from '../validation';
import { addMonths } from '../dates';
import type { FuelEntry, MaintenanceEntry, Settings } from '../types';

const f = (id: string, date: string, liters: number, tripKm: number, fullTank = true, totalPrice = liters * 7.5): FuelEntry =>
  ({ id, date, station: 'פז', liters, totalPrice, tripKm, fullTank });

const settings: Settings = { carName: 'x', serviceIntervalKm: 15000, serviceIntervalMonths: 12, reminderDays: 30, testChecklist: [] };

describe('consumption', () => {
  it('computes km/L and merges partial fills into the next full fill', () => {
    const c = consumptionById([f('a', '2026-01-01', 40, 600), f('b', '2026-01-10', 10, 150, false), f('c', '2026-01-20', 30, 450)]);
    expect(c.get('a')).toBeCloseTo(15);
    expect(c.has('b')).toBe(false);
    expect(c.get('c')).toBeCloseTo(15); // (150+450)/(10+30)
  });

  it('flags an abnormal drop', () => {
    const rows = [1, 2, 3, 4].map((i) => f(`n${i}`, `2026-0${i}-01`, 40, 600)); // 15 km/L
    rows.push(f('bad', '2026-05-01', 40, 440)); // 11 km/L
    const a = consumptionAnomalies(rows);
    expect(a).toHaveLength(1);
    expect(a[0].entryId).toBe('bad');
    expect(a[0].deviation).toBeLessThan(-0.15);
  });

  it('averages weighted by distance', () => {
    expect(averageConsumption([f('a', '2026-01-01', 40, 600), f('b', '2026-02-01', 20, 200)])).toBeCloseTo(800 / 60);
  });
});

describe('cost-only entries', () => {
  const co = (id: string, date: string, totalPrice: number): FuelEntry => ({ id, date, station: 'פז', totalPrice, fullTank: false, costOnly: true, excluded: true });
  it('are ignored by consumption and anomaly detection', () => {
    const rows = [f('a', '2026-01-01', 40, 600), co('b', '2026-01-15', 300), f('c', '2026-02-01', 40, 600)];
    expect(consumptionById(rows).has('b')).toBe(false);
    expect(consumptionById(rows).get('c')).toBeCloseTo(15);
    expect(consumptionAnomalies([...rows, co('d', '2026-03-01', 250)])).toHaveLength(0);
  });
  it('validate the amount only', () => {
    expect(validateFuel({ date: '2026-01-01', totalPrice: 250, costOnly: true }, []).errors).toHaveLength(0);
    expect(validateFuel({ date: '2026-01-01', totalPrice: 0, costOnly: true }, []).errors).toHaveLength(1);
  });
});

describe('odometer + service prediction', () => {
  const maint: MaintenanceEntry[] = [{ id: 'm', date: '2026-01-01', odometer: 60000, kind: 'service', description: 's', parts: [], cost: 0, garage: '' }];

  it('adds trip km after the latest anchor', () => {
    const odo = estimateOdometer(settings, [f('a', '2025-12-01', 40, 500), f('b', '2026-02-01', 40, 600)], maint, []);
    expect(odo?.km).toBe(60600);
  });

  it('predicts due km and time', () => {
    const odo = { km: 70000, anchorDate: '2026-01-01', anchorKm: 60000, addedKm: 10000 };
    const p = predictService(settings, maint, odo, null);
    expect(p.dueKm).toBe(75000);
    expect(p.kmLeft).toBe(5000);
    expect(p.dueByTime).toBe(addMonths('2026-01-01', 12));
  });
});

describe('validation', () => {
  it('warns on odometer-like trip values and over-capacity liters', () => {
    const v = validateFuel({ date: '2026-01-01', liters: 450, totalPrice: 300, tripKm: 65000, fullTank: true }, []);
    expect(v.errors).toHaveLength(0);
    expect(v.warnings.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects future dates and missing values', () => {
    expect(validateFuel({ date: '2999-01-01', liters: 40, totalPrice: 300, tripKm: 600 }, []).errors.length).toBe(1);
    expect(validateFuel({ date: '2026-01-01', liters: 0, totalPrice: 300, tripKm: 600 }, []).errors.length).toBe(1);
  });

  it('blocks duplicate tests on the same date', () => {
    const v = validateTest({ date: '2026-03-01', validUntil: '2027-03-01' }, [{ id: 't', date: '2026-03-01', passed: true, validUntil: '2027-03-01' }]);
    expect(v.errors.length).toBe(1);
  });

  it('detects sensitive data but allows normal text', () => {
    expect(findSensitive('ת"ז 123456782')).toBe('מספר תעודת זהות');
    expect(findSensitive('כרטיס 4580 1234 5678 9014')).toBe('מספר כרטיס אשראי'); // card layout
    expect(findSensitive('4111111111111111')).toBe('מספר כרטיס אשראי'); // Luhn-valid
    expect(findSensitive('קבלה 20261122153045')).toBeNull(); // long number, not Luhn-valid
    expect(findSensitive('IBAN IL62 0108 0000 0009 9999 999')).toBe('פרטי חשבון בנק');
    expect(findSensitive('טיפול 60,000 ק"מ, מוסך שלום')).toBeNull();
    expect(findSensitive('*5678')).toBeNull();
  });
});
