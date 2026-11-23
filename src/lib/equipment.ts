import type { EquipmentItem, EquipmentLocation, Task } from './types';
import { daysUntil, formatDate } from './dates';
import type { PartStatus } from './parts';

export const LOCATION_LABEL: Record<EquipmentLocation, string> = {
  trunk: 'תא מטען',
  spare_well: 'גומחת הגלגל הרזרבי',
  under_seat: 'מתחת למושב',
  glovebox: 'תא כפפות',
  doors: 'כיסי דלתות',
  cabin: 'תא נוסעים',
  other: 'אחר',
};
export const LOCATIONS = Object.keys(LOCATION_LABEL) as EquipmentLocation[];

/** Suggested starter kit - the user picks what to add */
export const SUGGESTED: { name: string; location: EquipmentLocation; expires?: boolean }[] = [
  { name: 'משולש אזהרה', location: 'trunk' },
  { name: 'אפוד זוהר', location: 'glovebox' },
  { name: 'ערכת עזרה ראשונה', location: 'trunk', expires: true },
  { name: 'מטף כיבוי אש', location: 'trunk', expires: true },
  { name: 'ג׳ק ומפתח גלגלים', location: 'spare_well' },
  { name: 'כבלים להתנעה', location: 'trunk' },
  { name: 'פנס', location: 'glovebox' },
  { name: 'מד לחץ אוויר', location: 'glovebox' },
  { name: 'מטען לטלפון', location: 'cabin' },
  { name: 'מגבונים / מגבת', location: 'doors' },
  { name: 'נוזל לשמשה (רזרבי)', location: 'trunk' },
  { name: 'מטריה', location: 'doors' },
];

export interface ShoppingItem {
  key: string;
  text: string;
  reason: string;
  source: 'equipment' | 'part' | 'task';
  refId: string;
}

/** Everything that should be bought: missing/expired equipment, worn consumables, and the "buy when I have time" list */
export function buildShoppingList(equipment: EquipmentItem[], tasks: Task[], parts: PartStatus[], reminderDays: number): ShoppingItem[] {
  const out: ShoppingItem[] = [];
  for (const e of equipment) {
    if (e.status === 'missing') out.push({ key: `eq-${e.id}`, text: e.name, reason: 'חסר ברכב', source: 'equipment', refId: e.id });
    else if (e.status === 'replace') out.push({ key: `eq-${e.id}`, text: e.name, reason: 'להחלפה', source: 'equipment', refId: e.id });
    else if (e.expiryDate && daysUntil(e.expiryDate) <= reminderDays) {
      out.push({ key: `eq-${e.id}`, text: e.name, reason: daysUntil(e.expiryDate) < 0 ? `פג תוקף ${formatDate(e.expiryDate)}` : `תוקף עד ${formatDate(e.expiryDate)}`, source: 'equipment', refId: e.id });
    }
  }
  // Consumables you buy yourself (tires/brakes/battery are garage jobs and stay on the dashboard)
  for (const p of parts) {
    if (p.def.slot === 'wipers' && (p.severity === 'overdue' || p.severity === 'urgent')) {
      out.push({ key: 'part-wipers', text: 'מגבים', reason: 'עברו את אורך החיים המומלץ', source: 'part', refId: 'wipers' });
    }
  }
  for (const t of tasks) {
    if (t.list === 'someday' && !t.done) out.push({ key: `task-${t.id}`, text: t.text, reason: 'לקנות כשיש זמן', source: 'task', refId: t.id });
  }
  return out;
}

export function shoppingText(items: ShoppingItem[], carName: string): string {
  return [`🛒 רשימת קניות לרכב – ${carName}`, '', ...items.map((i) => `☐ ${i.text}${i.reason ? ` (${i.reason})` : ''}`)].join('\n');
}
