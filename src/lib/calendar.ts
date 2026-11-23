import type { DueItem } from './calc';
import { addDays, todayISO } from './dates';

/**
 * Google Calendar sync: every dated reminder becomes an all-day event in a dedicated "רכב" calendar.
 * Event ids are derived from the reminder id, so syncing again updates the same events instead of duplicating them.
 */
export const CALENDAR_NAME = 'רכב';
export const APP_URL = 'https://stavshalom95-sys.github.io/car/#';

export interface CarEvent {
  /** Google event id: base32hex chars only (0-9, a-v) */
  id: string;
  sourceId: string;
  summary: string;
  description: string;
  date: string;
}

/** FNV-1a 64-bit as hex (deterministic, dependency-free; hex is valid base32hex) */
function hash64(s: string): string {
  let h = 0xcbf29ce484222325n;
  const bytes = new TextEncoder().encode(s);
  for (const b of bytes) {
    h ^= BigInt(b);
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, '0');
}

export const eventIdFor = (sourceId: string) => `car${hash64(sourceId)}`;

/** Future-dated reminders → calendar events (past/overdue items stay in the app only) */
export function buildCalendarEvents(items: DueItem[], today = todayISO()): CarEvent[] {
  return items
    .filter((i) => i.dueDate && i.dueDate >= today)
    .map((i) => ({
      id: eventIdFor(i.id),
      sourceId: i.id,
      summary: `🚗 ${i.title}`,
      description: `${i.detail}\n\nנוצר אוטומטית מאפליקציית הרכב: ${APP_URL}${i.link}`,
      date: i.dueDate!,
    }));
}

/** The Calendar API body for an all-day event with popup reminders a week and a day before */
export function eventBody(e: CarEvent) {
  return {
    id: e.id,
    status: 'confirmed',
    summary: e.summary,
    description: e.description,
    start: { date: e.date },
    end: { date: addDays(e.date, 1) },
    transparency: 'transparent',
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 7 * 24 * 60 }, { method: 'popup', minutes: 24 * 60 }] },
    extendedProperties: { private: { carApp: '1', sourceId: e.sourceId } },
  };
}

/** Events the app created earlier that no longer match any current reminder */
export function staleEvents<T extends { id: string; status?: string }>(existing: T[], wanted: CarEvent[]): T[] {
  const keep = new Set(wanted.map((w) => w.id));
  return existing.filter((e) => e.status !== 'cancelled' && !keep.has(e.id));
}
