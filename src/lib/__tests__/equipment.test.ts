import { describe, expect, it } from 'vitest';
import { buildShoppingList, shoppingText } from '../equipment';
import { buildDueItems } from '../calc';
import { addDays, todayISO } from '../dates';
import type { EquipmentItem, Settings, Task } from '../types';
import type { PartStatus } from '../parts';

const settings: Settings = { carName: 'פיג׳ו', serviceIntervalKm: 15000, serviceIntervalMonths: 12, reminderDays: 30, testChecklist: [] };
const eq = (id: string, name: string, status: EquipmentItem['status'], expiryDate?: string): EquipmentItem =>
  ({ id, name, status, expiryDate, location: 'trunk', quantity: 1 });
const equipment = [
  eq('a', 'משולש אזהרה', 'ok'),
  eq('b', 'אפוד זוהר', 'missing'),
  eq('c', 'ערכת עזרה ראשונה', 'ok', addDays(todayISO(), -5)),
  eq('d', 'מטף כיבוי', 'ok', addDays(todayISO(), 10)),
  eq('e', 'פנס', 'ok', addDays(todayISO(), 400)),
  eq('f', 'כבלים', 'replace'),
];
const tasks: Task[] = [
  { id: 't1', text: 'מטען לרכב', list: 'someday', done: false },
  { id: 't2', text: 'נקנה כבר', list: 'someday', done: true },
  { id: 't3', text: 'דחוף', list: 'urgent', done: false },
];
const wipers = { def: { slot: 'wipers', label: 'מגבים', group: 'wipers' }, severity: 'overdue' } as PartStatus;

describe('shopping list', () => {
  it('collects missing, to-replace, expiring equipment, worn wipers and someday tasks', () => {
    const list = buildShoppingList(equipment, tasks, [wipers], 30);
    expect(list.map((i) => i.text)).toEqual(['אפוד זוהר', 'ערכת עזרה ראשונה', 'מטף כיבוי', 'כבלים', 'מגבים', 'מטען לרכב']);
    expect(shoppingText(list, 'פיג׳ו')).toContain('☐ אפוד זוהר (חסר ברכב)');
  });
  it('puts expiring equipment on the dashboard', () => {
    const items = buildDueItems({ settings, fuel: [], maintenance: [], tests: [], documents: [], tasks: [], equipment });
    const eqItems = items.filter((i) => i.id.startsWith('equip-'));
    expect(eqItems.map((i) => i.severity).sort()).toEqual(['overdue', 'urgent']);
  });
});
