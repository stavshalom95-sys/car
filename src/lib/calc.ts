import type { CarDocument, EquipmentItem, Expense, ExpenseCategory, FuelEntry, InsuranceQuote, MaintenanceEntry, PartInfo, Settings, Task, TestEntry } from './types';
import { computeParts } from './parts';
import { currentPolicy, isFreshQuote, renewal } from './insurance';
import { addDays, addMonths, daysBetween, daysUntil, formatDate, todayISO } from './dates';
import { formatNumber } from './format';

const byDateAsc = <T extends { date: string }>(a: T, b: T) => a.date.localeCompare(b.date);

// ---------------------------------------------------------------------------
// Fuel consumption
// ---------------------------------------------------------------------------

/**
 * km/L for each fill-up, keyed by entry id. Partial fills are accumulated
 * into the next full-tank fill-up. Excluded entries are ignored.
 */
export function consumptionById(fuel: FuelEntry[]): Map<string, number> {
  const res = new Map<string, number>();
  let accKm = 0;
  let accL = 0;
  for (const e of [...fuel].filter((f) => !f.excluded && !f.costOnly).sort(byDateAsc)) {
    accKm += e.tripKm || 0;
    accL += e.liters || 0;
    if (e.fullTank) {
      if (accKm > 0 && accL > 0) res.set(e.id, accKm / accL);
      accKm = 0;
      accL = 0;
    }
  }
  return res;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export interface ConsumptionAlert {
  entryId: string;
  date: string;
  kmpl: number;
  baseline: number;
  /** Relative deviation, e.g. -0.2 = 20% worse */
  deviation: number;
}

/** Threshold for an abnormal change in consumption */
export const ANOMALY_THRESHOLD = 0.15;

/** Compares each fill-up against the median of the previous 6 and returns abnormal ones. */
export function consumptionAnomalies(fuel: FuelEntry[]): ConsumptionAlert[] {
  const kmpl = consumptionById(fuel);
  const series = [...fuel].filter((f) => kmpl.has(f.id)).sort(byDateAsc);
  const out: ConsumptionAlert[] = [];
  for (let i = 3; i < series.length; i++) {
    const prev = series.slice(Math.max(0, i - 6), i).map((f) => kmpl.get(f.id)!);
    const baseline = median(prev);
    const v = kmpl.get(series[i].id)!;
    const deviation = (v - baseline) / baseline;
    if (Math.abs(deviation) >= ANOMALY_THRESHOLD) {
      out.push({ entryId: series[i].id, date: series[i].date, kmpl: v, baseline, deviation });
    }
  }
  return out;
}

/** The anomaly for the most recent measured fill-up, if any. */
export function latestAnomaly(fuel: FuelEntry[]): ConsumptionAlert | null {
  const kmpl = consumptionById(fuel);
  const latest = [...fuel].filter((f) => kmpl.has(f.id)).sort(byDateAsc).pop();
  if (!latest) return null;
  return consumptionAnomalies(fuel).find((a) => a.entryId === latest.id) ?? null;
}

export function averageConsumption(fuel: FuelEntry[], lastN?: number): number | null {
  const kmpl = consumptionById(fuel);
  let rows = [...fuel].filter((f) => kmpl.has(f.id)).sort(byDateAsc);
  if (lastN) rows = rows.slice(-lastN);
  if (!rows.length) return null;
  // Distance-weighted (total km / total liters) is more accurate than averaging ratios
  const km = rows.reduce((s, f) => s + (f.tripKm ?? 0), 0);
  const liters = rows.reduce((s, f) => s + (f.tripKm ?? 0) / kmpl.get(f.id)!, 0);
  return liters > 0 ? km / liters : null;
}

// ---------------------------------------------------------------------------
// Odometer estimation (the fuel log records the trip meter only)
// ---------------------------------------------------------------------------

export interface OdometerEstimate {
  km: number;
  anchorDate: string;
  anchorKm: number;
  addedKm: number;
}

export function estimateOdometer(
  settings: Settings,
  fuel: FuelEntry[],
  maintenance: MaintenanceEntry[],
  tests: TestEntry[],
): OdometerEstimate | null {
  const anchors: { date: string; km: number }[] = [];
  if (settings.baseOdometer != null && settings.baseOdometerDate)
    anchors.push({ date: settings.baseOdometerDate, km: settings.baseOdometer });
  for (const m of maintenance) if (m.odometer) anchors.push({ date: m.date, km: m.odometer });
  for (const t of tests) if (t.odometer) anchors.push({ date: t.date, km: t.odometer });
  if (!anchors.length) return null;
  anchors.sort((a, b) => a.date.localeCompare(b.date) || a.km - b.km);
  const anchor = anchors[anchors.length - 1];
  const addedKm = fuel.filter((f) => f.date > anchor.date).reduce((s, f) => s + (f.tripKm || 0), 0);
  return { km: anchor.km + addedKm, anchorDate: anchor.date, anchorKm: anchor.km, addedKm };
}

/** Average km per day over the last `days` days of fuel log. */
export function avgKmPerDay(fuel: FuelEntry[], days = 180): number | null {
  const from = addDays(todayISO(), -days);
  // Cost-only entries have no trip km, so they would wrongly lower the rate
  const rows = fuel.filter((f) => f.date >= from && !f.costOnly && (f.tripKm ?? 0) > 0).sort(byDateAsc);
  if (rows.length < 2) return null;
  const span = daysBetween(rows[0].date, rows[rows.length - 1].date);
  if (span < 7) return null;
  // The first fill-up's trip happened before the window started
  const km = rows.slice(1).reduce((s, f) => s + (f.tripKm || 0), 0);
  return km / span;
}

// ---------------------------------------------------------------------------
// Next service prediction
// ---------------------------------------------------------------------------

export interface ServicePrediction {
  lastService?: MaintenanceEntry;
  dueKm?: number;
  kmLeft?: number;
  dueByTime?: string;
  dueByKmEstimate?: string;
  /** The earlier of the two */
  dueDate?: string;
  reason?: 'km' | 'time';
}

export function predictService(
  settings: Settings,
  maintenance: MaintenanceEntry[],
  odometer: OdometerEstimate | null,
  kmPerDay: number | null,
): ServicePrediction {
  const services = maintenance.filter((m) => m.kind === 'service').sort(byDateAsc);
  const lastService = services[services.length - 1];
  if (!lastService) return {};
  const res: ServicePrediction = { lastService };
  res.dueByTime = addMonths(lastService.date, settings.serviceIntervalMonths);
  if (lastService.odometer) {
    res.dueKm = lastService.odometer + settings.serviceIntervalKm;
    if (odometer) {
      res.kmLeft = res.dueKm - odometer.km;
      if (kmPerDay && kmPerDay > 0) {
        res.dueByKmEstimate = addDays(todayISO(), Math.round(Math.max(res.kmLeft, 0) / kmPerDay));
      }
    }
  }
  if (res.dueByKmEstimate && res.dueByKmEstimate < res.dueByTime) {
    res.dueDate = res.dueByKmEstimate;
    res.reason = 'km';
  } else {
    res.dueDate = res.dueByTime;
    res.reason = 'time';
  }
  if (res.kmLeft != null && res.kmLeft <= 0) res.reason = 'km';
  return res;
}

// ---------------------------------------------------------------------------
// Test / vehicle license
// ---------------------------------------------------------------------------

/** The date the vehicle license (and therefore the annual test) expires. */
export function licenseValidUntil(tests: TestEntry[], docs: CarDocument[]): string | undefined {
  const fromTests = tests.filter((t) => t.passed).map((t) => t.validUntil);
  const fromDocs = docs.filter((d) => d.type === 'vehicle_license' && d.expiryDate).map((d) => d.expiryDate!);
  const all = [...fromTests, ...fromDocs].sort();
  return all[all.length - 1];
}

// ---------------------------------------------------------------------------
// "What's urgent" dashboard
// ---------------------------------------------------------------------------

export type Severity = 'overdue' | 'urgent' | 'soon' | 'ok' | 'missing';

export interface DueItem {
  id: string;
  title: string;
  detail: string;
  dueDate?: string;
  daysLeft?: number;
  severity: Severity;
  link: string;
}

const DOC_LABEL: Record<string, string> = {
  driver_license: 'רישיון נהיגה',
  compulsory_insurance: 'ביטוח חובה',
  comprehensive_insurance: 'ביטוח מקיף',
  other: 'מסמך',
};

export function severityFor(daysLeft: number, reminderDays: number): Severity {
  if (daysLeft < 0) return 'overdue';
  if (daysLeft <= reminderDays) return 'urgent';
  if (daysLeft <= 90) return 'soon';
  return 'ok';
}

const SEVERITY_ORDER: Record<Severity, number> = { overdue: 0, urgent: 1, missing: 2, soon: 3, ok: 4 };

export function buildDueItems(input: {
  settings: Settings;
  fuel: FuelEntry[];
  maintenance: MaintenanceEntry[];
  tests: TestEntry[];
  documents: CarDocument[];
  tasks: Task[];
  parts?: PartInfo[];
  expenses?: Expense[];
  equipment?: EquipmentItem[];
  quotes?: InsuranceQuote[];
}): DueItem[] {
  const { settings, fuel, maintenance, tests, documents, tasks } = input;
  const items: DueItem[] = [];
  const rd = settings.reminderDays;

  // Annual test
  const lic = licenseValidUntil(tests, documents);
  if (lic) {
    const d = daysUntil(lic);
    items.push({
      id: 'test', title: 'טסט שנתי / רישיון רכב', detail: `בתוקף עד ${formatDate(lic)}`,
      dueDate: lic, daysLeft: d, severity: severityFor(d, rd), link: '/test',
    });
  } else {
    items.push({ id: 'test', title: 'טסט שנתי', detail: 'לא הוזן תאריך תוקף לרישיון הרכב', severity: 'missing', link: '/test' });
  }

  // Documents (vehicle license is covered by the test item)
  for (const doc of documents) {
    if (doc.type === 'vehicle_license' || !doc.expiryDate) continue;
    // Renewed: a newer document of the same type supersedes this one (e.g. last year's insurance)
    if (doc.type !== 'other' && documents.some((o) => o.id !== doc.id && o.type === doc.type && (o.expiryDate ?? '') > doc.expiryDate!)) continue;
    const d = daysUntil(doc.expiryDate);
    items.push({
      id: `doc-${doc.id}`, title: `חידוש ${doc.title || DOC_LABEL[doc.type]}`,
      detail: `${doc.provider ? doc.provider + ' · ' : ''}בתוקף עד ${formatDate(doc.expiryDate)}`,
      dueDate: doc.expiryDate, daysLeft: d, severity: severityFor(d, rd), link: '/documents',
    });
  }
  for (const t of ['compulsory_insurance', 'comprehensive_insurance'] as const) {
    if (!documents.some((d) => d.type === t)) {
      items.push({ id: `missing-${t}`, title: DOC_LABEL[t], detail: 'לא הוזן מסמך – הוסף כדי לקבל תזכורת חידוש', severity: 'missing', link: '/documents' });
    }
  }

  // Insurance renewal: nudge to collect quotes before the policy ends
  const ren = renewal(currentPolicy(documents));
  if (ren && ren.days >= 0 && todayISO() >= ren.windowStart) {
    const fresh = (input.quotes ?? []).filter((q) => isFreshQuote(q, ren.periodStart)).length;
    items.push({
      id: 'insurance-quotes', title: 'השוואת הצעות לביטוח',
      detail: `הביטוח מתחדש ב-${formatDate(ren.date)} · ${fresh ? `התקבלו ${fresh} הצעות` : 'עדיין לא התקבלו הצעות'}`,
      dueDate: ren.date, daysLeft: ren.days, severity: fresh >= 2 ? 'ok' : 'soon', link: '/insurance',
    });
  }

  // Service
  const odo = estimateOdometer(settings, fuel, maintenance, tests);
  const svc = predictService(settings, maintenance, odo, avgKmPerDay(fuel));
  if (svc.dueDate) {
    const d = daysUntil(svc.dueDate);
    let sev = severityFor(d, rd);
    if (svc.kmLeft != null && svc.kmLeft <= 0) sev = 'overdue';
    else if (svc.kmLeft != null && svc.kmLeft <= 1000 && sev !== 'overdue') sev = 'urgent';
    const parts = [];
    if (svc.kmLeft != null) parts.push(svc.kmLeft > 0 ? `עוד כ-${formatNumber(svc.kmLeft)} ק״מ` : `חריגה של ${formatNumber(-svc.kmLeft)} ק״מ`);
    parts.push(`${svc.reason === 'km' ? 'הערכה לפי קילומטראז׳' : 'לפי זמן'}: ${formatDate(svc.dueDate)}`);
    items.push({ id: 'service', title: 'טיפול תקופתי', detail: parts.join(' · '), dueDate: svc.dueDate, daysLeft: d, severity: sev, link: '/maintenance' });
  } else {
    items.push({ id: 'service', title: 'טיפול תקופתי', detail: 'הזן את הטיפול האחרון (עם ק״מ) כדי לקבל תחזית', severity: 'missing', link: '/maintenance' });
  }

  // Wear-and-tear parts (road tires with the same status are merged into one item)
  const parts = computeParts({ settings, maintenance, tests, fuel, parts: input.parts ?? [], currentKm: odo?.km, kmPerDay: avgKmPerDay(fuel) });
  const merged = new Map<string, { labels: string[]; p: (typeof parts)[number] }>();
  for (const p of parts) {
    if (p.severity !== 'overdue' && p.severity !== 'urgent' && p.severity !== 'soon') continue;
    const key = p.def.group === 'tires' && p.def.slot !== 'tire_spare' ? `tires|${p.installedDate}|${p.severity}|${p.warning ?? ''}` : p.def.slot;
    if (!merged.has(key)) merged.set(key, { labels: [], p });
    merged.get(key)!.labels.push(p.def.label);
  }
  for (const [key, { labels, p }] of merged) {
    const d = p.dueDate ? daysUntil(p.dueDate) : undefined;
    const title = labels.length > 1 ? `צמיגים (${labels.length})` : p.def.label;
    const parts2 = [p.severity === 'overdue' ? 'עבר את אורך החיים המומלץ' : `${Math.round((p.wear ?? 0) * 100)}% מאורך החיים`];
    if (p.warning) parts2.unshift(p.warning);
    if (p.installedDate) parts2.push(`הוחלף ${formatDate(p.installedDate)}`);
    items.push({ id: `part-${key}`, title: `${p.severity === 'soon' ? 'בקרוב: ' : ''}החלפת ${title}`, detail: parts2.join(' · '), dueDate: p.dueDate, daysLeft: d, severity: p.severity, link: '/parts' });
  }
  for (const p of parts) {
    const w = p.info?.warrantyUntil;
    if (!w) continue;
    const d = daysUntil(w);
    if (d >= 0 && d <= rd) items.push({ id: `warranty-${p.def.slot}`, title: `אחריות ${p.def.label} מסתיימת`, detail: `עד ${formatDate(w)}`, dueDate: w, daysLeft: d, severity: 'soon', link: '/parts' });
  }

  // Car equipment expiring (first-aid kit, fire extinguisher...)
  for (const e of input.equipment ?? []) {
    if (!e.expiryDate || e.status === 'missing') continue;
    const d = daysUntil(e.expiryDate);
    const sev = severityFor(d, rd);
    if (sev === 'ok') continue;
    items.push({ id: `equip-${e.id}`, title: `${d < 0 ? 'פג תוקף' : 'תוקף מסתיים'}: ${e.name}`, detail: `בתוקף עד ${formatDate(e.expiryDate)}`, dueDate: e.expiryDate, daysLeft: d, severity: sev, link: '/equipment' });
  }

  // Unpaid fines
  for (const e of input.expenses ?? []) {
    if (e.category !== 'fine' || e.paid) continue;
    const d = e.dueDate ? daysUntil(e.dueDate) : undefined;
    items.push({
      id: `fine-${e.id}`, title: 'תשלום דוח',
      detail: [e.description, `₪${formatNumber(e.amount)}`, e.dueDate ? `לתשלום עד ${formatDate(e.dueDate)}` : 'לא הוזן מועד תשלום'].filter(Boolean).join(' · '),
      dueDate: e.dueDate, daysLeft: d, severity: d == null ? 'urgent' : d < 0 ? 'overdue' : 'urgent', link: '/expenses',
    });
  }

  // Tasks with due dates
  for (const t of tasks) {
    if (t.done || t.list !== 'urgent' || !t.dueDate) continue;
    const d = daysUntil(t.dueDate);
    items.push({ id: `task-${t.id}`, title: t.text, detail: `עד ${formatDate(t.dueDate)}`, dueDate: t.dueDate, daysLeft: d, severity: severityFor(d, rd), link: '/' });
  }

  return items.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999),
  );
}

// ---------------------------------------------------------------------------
// Total cost of ownership per year
// ---------------------------------------------------------------------------

export const EXPENSE_LABEL: Record<ExpenseCategory, string> = {
  parking: 'חניה',
  toll: 'כבישי אגרה',
  fine: 'דוחות',
  wash: 'שטיפות',
  other: 'אחר',
};

export interface CostRow {
  key: string;
  label: string;
  amount: number;
  count: number;
}

export interface AnnualCost {
  year: string;
  total: number;
  rows: CostRow[];
  /** Months the average is spread over (elapsed months for the current year) */
  months: number;
  byMonth: number[];
}

/** A yearly document (insurance, license, service plan) belongs to the year its period starts */
export const docPeriodStart = (d: CarDocument) => (d.expiryDate ? addMonths(d.expiryDate, -12) : undefined);

export function availableYears(input: { fuel: FuelEntry[]; maintenance: MaintenanceEntry[]; tests: TestEntry[]; documents: CarDocument[]; expenses: Expense[] }): string[] {
  const ys = new Set<string>([todayISO().slice(0, 4)]);
  for (const x of [...input.fuel, ...input.maintenance, ...input.tests, ...input.expenses]) ys.add(x.date.slice(0, 4));
  for (const d of input.documents) { const s = docPeriodStart(d); if (s && d.cost) ys.add(s.slice(0, 4)); }
  return [...ys].sort().reverse();
}

export function annualCost(
  year: string,
  input: { fuel: FuelEntry[]; maintenance: MaintenanceEntry[]; tests: TestEntry[]; documents: CarDocument[]; expenses: Expense[] },
): AnnualCost {
  const inYear = (d?: string) => !!d && d.startsWith(year);
  const byMonth = Array(12).fill(0) as number[];
  const add = (date: string | undefined, amount: number) => { if (date) byMonth[Number(date.slice(5, 7)) - 1] += amount; };
  const rows: CostRow[] = [];
  const push = (key: string, label: string, items: { date?: string; amount: number }[]) => {
    const amount = items.reduce((s, i) => s + i.amount, 0);
    items.forEach((i) => add(i.date, i.amount));
    if (amount > 0) rows.push({ key, label, amount, count: items.length });
  };

  push('fuel', 'דלק', input.fuel.filter((f) => inYear(f.date)).map((f) => ({ date: f.date, amount: f.totalPrice || 0 })));
  push('maintenance', 'טיפולים ותיקונים', input.maintenance.filter((m) => inYear(m.date)).map((m) => ({ date: m.date, amount: m.cost || 0 })).filter((x) => x.amount > 0));
  const docsIn = (types: string[]) => input.documents
    .filter((d) => types.includes(d.type) && d.cost && inYear(docPeriodStart(d)))
    .map((d) => ({ date: docPeriodStart(d), amount: d.cost! }));
  push('insurance', 'ביטוחים', docsIn(['compulsory_insurance', 'comprehensive_insurance']));
  push('license', 'רישוי וטסט', [
    ...docsIn(['vehicle_license', 'driver_license']),
    ...input.tests.filter((t) => inYear(t.date) && t.cost).map((t) => ({ date: t.date, amount: t.cost! })),
  ]);
  push('plans', 'כתבי שירות ואחר', docsIn(['other']));
  for (const c of Object.keys(EXPENSE_LABEL) as ExpenseCategory[]) {
    push(`exp-${c}`, EXPENSE_LABEL[c], input.expenses.filter((e) => e.category === c && inYear(e.date)).map((e) => ({ date: e.date, amount: e.amount || 0 })));
  }

  rows.sort((a, b) => b.amount - a.amount);
  const now = todayISO();
  const months = year === now.slice(0, 4) ? Number(now.slice(5, 7)) : 12;
  return { year, total: rows.reduce((s, r) => s + r.amount, 0), rows, months, byMonth };
}
