import type { FuelEntry, MaintenanceEntry, PartInfo, PartSlot, Settings, TestEntry } from './types';
import { addDays, addMonths, daysBetween, todayISO } from './dates';
import type { Severity } from './calc';

export type PartGroup = 'battery' | 'tires' | 'brakes' | 'wipers' | 'engine';

export interface SlotDef {
  slot: PartSlot;
  label: string;
  group: PartGroup;
  /** Default replacement interval - general guidance, editable per part */
  lifeKm?: number;
  lifeMonths?: number;
}

export const SLOTS: SlotDef[] = [
  { slot: 'battery', label: 'מצבר', group: 'battery', lifeMonths: 48 },
  { slot: 'tire_fl', label: 'צמיג קדמי שמאלי', group: 'tires', lifeKm: 50000, lifeMonths: 72 },
  { slot: 'tire_fr', label: 'צמיג קדמי ימני', group: 'tires', lifeKm: 50000, lifeMonths: 72 },
  { slot: 'tire_rl', label: 'צמיג אחורי שמאלי', group: 'tires', lifeKm: 50000, lifeMonths: 72 },
  { slot: 'tire_rr', label: 'צמיג אחורי ימני', group: 'tires', lifeKm: 50000, lifeMonths: 72 },
  { slot: 'tire_spare', label: 'גלגל רזרבי', group: 'tires', lifeMonths: 72 },
  { slot: 'pads_front', label: 'רפידות בלם קדמיות', group: 'brakes', lifeKm: 40000 },
  { slot: 'pads_rear', label: 'רפידות בלם אחוריות', group: 'brakes', lifeKm: 60000 },
  { slot: 'discs_front', label: 'צלחות בלם קדמיות', group: 'brakes', lifeKm: 80000 },
  { slot: 'discs_rear', label: 'צלחות בלם אחוריות', group: 'brakes', lifeKm: 100000 },
  { slot: 'wipers', label: 'מגבים', group: 'wipers', lifeMonths: 12 },
  { slot: 'timing_belt', label: 'רצועת תזמון', group: 'engine', lifeKm: 100000, lifeMonths: 72 },
];

export const SLOT_BY_ID = Object.fromEntries(SLOTS.map((s) => [s.slot, s])) as Record<PartSlot, SlotDef>;

const ROAD_TIRES: PartSlot[] = ['tire_fl', 'tire_fr', 'tire_rl', 'tire_rr'];
const ALL_TIRES: PartSlot[] = [...ROAD_TIRES, 'tire_spare'];

/** Which part slots does a single maintenance line item refer to? */
export function slotsForText(text: string): PartSlot[] {
  const s = text.toLowerCase();
  const front = /קדמ|front/.test(s);
  const rear = /אחור|rear/.test(s);
  const right = /ימנ|ימין|right/.test(s);
  const left = /שמאל|left/.test(s);
  const pick = (f: PartSlot, r: PartSlot): PartSlot[] => (rear && !front ? [r] : front && rear ? [f, r] : [f]);

  if (/מצבר|battery/.test(s)) return ['battery'];
  if (/רצועת\s*תזמון|timing\s*belt/.test(s)) return ['timing_belt'];
  if (/רפיד|brake\s*pad/.test(s)) return pick('pads_front', 'pads_rear');
  if (/צלחות|דיסק|brake\s*disc/.test(s)) return pick('discs_front', 'discs_rear');
  if (/מגב(?!ת)|wiper/.test(s)) return ['wipers'];
  if (/צמיג|tire|tyre/.test(s)) {
    if (/(^|\s)5(\s|$)|חמישה|כולל\s*רזרב/.test(s)) return ALL_TIRES;
    if (/רזרב|spare/.test(s)) return ['tire_spare'];
    if (front && !rear) return right && !left ? ['tire_fr'] : left && !right ? ['tire_fl'] : ['tire_fl', 'tire_fr'];
    if (rear && !front) return right && !left ? ['tire_rr'] : left && !right ? ['tire_rl'] : ['tire_rl', 'tire_rr'];
    return ROAD_TIRES;
  }
  return [];
}

export function slotsForEntry(m: MaintenanceEntry): PartSlot[] {
  const set = new Set<PartSlot>();
  for (const p of m.parts) slotsForText(p).forEach((x) => set.add(x));
  // The description only counts if no line item already identified the parts
  if (!set.size) slotsForText(m.description).forEach((x) => set.add(x));
  return [...set];
}

// ---------------------------------------------------------------------------
// Odometer at an arbitrary date (interpolated between known readings)
// ---------------------------------------------------------------------------

export interface KmAt {
  km: number;
  estimated: boolean;
}

export function odometerAt(
  date: string,
  ctx: { settings: Settings; maintenance: MaintenanceEntry[]; tests: TestEntry[]; fuel: FuelEntry[] },
): KmAt | null {
  const anchors: { date: string; km: number }[] = [];
  if (ctx.settings.baseOdometer != null && ctx.settings.baseOdometerDate)
    anchors.push({ date: ctx.settings.baseOdometerDate, km: ctx.settings.baseOdometer });
  for (const m of ctx.maintenance) if (m.odometer) anchors.push({ date: m.date, km: m.odometer });
  for (const t of ctx.tests) if (t.odometer) anchors.push({ date: t.date, km: t.odometer });
  if (!anchors.length) return null;
  anchors.sort((a, b) => a.date.localeCompare(b.date) || a.km - b.km);

  const exact = anchors.filter((a) => a.date === date).pop();
  if (exact) return { km: exact.km, estimated: false };
  const before = [...anchors].reverse().find((a) => a.date < date);
  const after = anchors.find((a) => a.date > date);
  if (before && after) {
    const ratio = daysBetween(before.date, date) / daysBetween(before.date, after.date);
    return { km: Math.round(before.km + (after.km - before.km) * ratio), estimated: true };
  }
  if (before) {
    // After the last known reading: add trip km from the fuel log
    const trips = ctx.fuel.filter((f) => f.date > before.date && f.date <= date).reduce((s, f) => s + (f.tripKm || 0), 0);
    return { km: before.km + trips, estimated: true };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Part status
// ---------------------------------------------------------------------------

export interface PartStatus {
  def: SlotDef;
  info?: PartInfo;
  installedDate?: string;
  installedKm?: KmAt | null;
  source?: { kind: 'maintenance'; entry: MaintenanceEntry } | { kind: 'manual' };
  lifeKm?: number;
  lifeMonths?: number;
  kmUsed?: number;
  monthsUsed?: number;
  /** 0..1+ (1 = end of expected life) */
  wear?: number;
  dueDate?: string;
  dueReason?: 'km' | 'time';
  severity: Severity;
  warning?: string;
}

const monthsBetween = (a: string, b: string) => daysBetween(a, b) / 30.44;

export function computeParts(ctx: {
  settings: Settings;
  maintenance: MaintenanceEntry[];
  tests: TestEntry[];
  fuel: FuelEntry[];
  parts: PartInfo[];
  currentKm?: number;
  kmPerDay?: number | null;
}): PartStatus[] {
  const today = todayISO();
  // Latest maintenance entry per slot
  const latest = new Map<PartSlot, MaintenanceEntry>();
  for (const m of [...ctx.maintenance].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const slot of slotsForEntry(m)) latest.set(slot, m);
  }
  const infoBySlot = new Map(ctx.parts.map((p) => [p.id as PartSlot, p]));

  return SLOTS.map((def) => {
    const info = infoBySlot.get(def.slot);
    const auto = latest.get(def.slot);
    const st: PartStatus = { def, info, severity: 'missing', lifeKm: info?.lifeKm ?? def.lifeKm, lifeMonths: info?.lifeMonths ?? def.lifeMonths };

    if (info?.manualDate && (!auto || info.manualDate >= auto.date)) {
      st.installedDate = info.manualDate;
      st.installedKm = info.manualKm != null ? { km: info.manualKm, estimated: false } : odometerAt(info.manualDate, ctx);
      st.source = { kind: 'manual' };
    } else if (auto) {
      st.installedDate = auto.date;
      st.installedKm = auto.odometer ? { km: auto.odometer, estimated: false } : odometerAt(auto.date, ctx);
      st.source = { kind: 'maintenance', entry: auto };
    }
    if (!st.installedDate) return st;

    st.monthsUsed = Math.max(0, monthsBetween(st.installedDate, today));
    if (ctx.currentKm != null && st.installedKm) st.kmUsed = Math.max(0, ctx.currentKm - st.installedKm.km);

    const wears: number[] = [];
    if (st.lifeKm && st.kmUsed != null) wears.push(st.kmUsed / st.lifeKm);
    if (st.lifeMonths) wears.push(st.monthsUsed / st.lifeMonths);
    st.wear = wears.length ? Math.max(...wears) : undefined;

    const byTime = st.lifeMonths ? addMonths(st.installedDate, st.lifeMonths) : undefined;
    let byKm: string | undefined;
    if (st.lifeKm && st.kmUsed != null && ctx.kmPerDay && ctx.kmPerDay > 0) {
      byKm = addDays(today, Math.round(Math.max(0, st.lifeKm - st.kmUsed) / ctx.kmPerDay));
    }
    if (byKm && (!byTime || byKm < byTime)) { st.dueDate = byKm; st.dueReason = 'km'; }
    else if (byTime) { st.dueDate = byTime; st.dueReason = 'time'; }

    const w = st.wear ?? 0;
    st.severity = w >= 1 ? 'overdue' : w >= 0.85 ? 'urgent' : w >= 0.7 ? 'soon' : 'ok';

    // A measured tread depth overrides the estimate (legal minimum in Israel: 1.6 mm)
    if (def.group === 'tires' && info?.treadMm != null) {
      if (info.treadMm <= 1.6) { st.severity = 'overdue'; st.warning = `עומק חריץ ${info.treadMm} מ״מ – מתחת למינימום החוקי`; }
      else if (info.treadMm <= 3 && (st.severity === 'ok' || st.severity === 'soon')) { st.severity = 'urgent'; st.warning = `עומק חריץ ${info.treadMm} מ״מ – להחליף בקרוב`; }
    }
    return st;
  });
}
