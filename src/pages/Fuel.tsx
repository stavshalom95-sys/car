import { useMemo, useState } from 'react';
import { Fuel as FuelIcon, Pencil, Trash2 } from 'lucide-react';
import { useData } from '../lib/data';
import { consumptionAnomalies, consumptionById, averageConsumption } from '../lib/calc';
import { formatDate, monthKey, monthLabel, todayISO } from '../lib/dates';
import { formatMoney, formatNumber, parseNum } from '../lib/format';
import { validateFuel } from '../lib/validation';
import { useSave } from '../lib/hooks';
import type { FuelEntry } from '../lib/types';
import { Alert, Button, Card, cx, EmptyState, Fab, Field, IconButton, Modal, PageHeader, useConfirm } from '../components/ui';

interface FormState {
  date: string; station: string; liters: string; totalPrice: string; tripKm: string;
  fullTank: boolean; excluded: boolean; costOnly: boolean; notes: string;
}

const empty = (): FormState => ({ date: todayISO(), station: '', liters: '', totalPrice: '', tripKm: '', fullTank: true, excluded: false, costOnly: false, notes: '' });

function FuelForm({ entry, onClose }: { entry: FuelEntry | null; onClose: () => void }) {
  const { fuel } = useData();
  const save = useSave('fuel');
  const [f, setF] = useState<FormState>(() =>
    entry
      ? { date: entry.date, station: entry.station, liters: entry.liters != null ? String(entry.liters) : '', totalPrice: String(entry.totalPrice), tripKm: entry.tripKm != null ? String(entry.tripKm) : '', fullTank: entry.fullTank, excluded: !!entry.excluded, costOnly: !!entry.costOnly, notes: entry.notes ?? '' }
      : empty(),
  );
  const [ack, setAck] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => { setF((s) => ({ ...s, [k]: v })); setAck(false); };

  const stations = useMemo(() => [...new Set(fuel.map((e) => e.station).filter(Boolean))], [fuel]);
  const parsed: Partial<FuelEntry> = {
    id: entry?.id, date: f.date, station: f.station.trim(), liters: parseNum(f.liters), totalPrice: parseNum(f.totalPrice),
    tripKm: parseNum(f.tripKm), fullTank: f.fullTank, costOnly: f.costOnly,
  };
  if (f.costOnly) { parsed.liters = undefined; parsed.tripKm = undefined; parsed.fullTank = false; }
  const touched = f.costOnly ? f.totalPrice !== '' : f.liters !== '' && f.totalPrice !== '' && f.tripKm !== '';
  const v = touched ? validateFuel(parsed, fuel) : { errors: [], warnings: [] };
  const ppl = parsed.liters && parsed.totalPrice ? parsed.totalPrice / parsed.liters : undefined;
  const kmpl = parsed.liters && parsed.tripKm ? parsed.tripKm / parsed.liters : undefined;

  const submit = async () => {
    const res = validateFuel(parsed, fuel);
    if (res.errors.length || (res.warnings.length && !ack)) return;
    const { id: _id, ...data } = parsed;
    void _id;
    if (await save({ ...data, excluded: f.costOnly || f.excluded, notes: f.notes.trim() }, entry?.id)) onClose();
  };

  const blocked = !touched || v.errors.length > 0 || (v.warnings.length > 0 && !ack);

  return (
    <Modal open title={entry ? 'עריכת תדלוק' : 'תדלוק חדש'} onClose={onClose}
      footer={<>
        <Button className="flex-1" onClick={submit} disabled={blocked}>{v.warnings.length && ack ? 'שמירה בכל זאת' : 'שמירה'}</Button>
        <Button variant="secondary" className="flex-1" onClick={onClose}>ביטול</Button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="תאריך"><input type="date" className="input" value={f.date} max={todayISO()} onChange={(e) => set('date', e.target.value)} /></Field>
        <Field label="תחנת דלק">
          <input className="input" list="stations" value={f.station} onChange={(e) => set('station', e.target.value)} placeholder="פז, דלק, סונול…" />
          <datalist id="stations">{stations.map((s) => <option key={s} value={s} />)}</datalist>
        </Field>
        {!f.costOnly && <Field label="ליטרים"><input type="number" inputMode="decimal" step="0.01" className="input" value={f.liters} onChange={(e) => set('liters', e.target.value)} /></Field>}
        <Field label="מחיר כולל (₪)" hint={ppl ? `₪${ppl.toFixed(2)} לליטר` : undefined}>
          <input type="number" inputMode="decimal" step="0.01" className="input" value={f.totalPrice} onChange={(e) => set('totalPrice', e.target.value)} />
        </Field>
        {!f.costOnly && <Field label="ק״מ מאז התדלוק הקודם" className="col-span-2" hint={kmpl && f.fullTank ? `צריכה: ${kmpl.toFixed(1)} ק״מ/ל׳` : 'מד המרחק היומי (Trip) לפני האיפוס'}>
          <input type="number" inputMode="numeric" className="input" value={f.tripKm} onChange={(e) => set('tripKm', e.target.value)} />
        </Field>}
      </div>
      {!f.costOnly && (
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-5 w-5 accent-blue-700" checked={f.fullTank} onChange={(e) => set('fullTank', e.target.checked)} />
          מילאתי מיכל מלא
        </label>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4" checked={f.costOnly} onChange={(e) => set('costOnly', e.target.checked)} />
        יש לי רק את הסכום (ללא ליטרים וק״מ) – ייספר בהוצאות בלבד
      </label>
      <Field label="הערות"><input className="input" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>

      {v.errors.length > 0 && <Alert tone="error">{v.errors.map((x) => <p key={x}>{x}</p>)}</Alert>}
      {v.errors.length === 0 && v.warnings.length > 0 && (
        <Alert tone="warning">
          {v.warnings.map((x) => <p key={x}>{x}</p>)}
          <label className="mt-2 flex items-center gap-2 font-medium">
            <input type="checkbox" className="h-4 w-4" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            בדקתי – הנתונים נכונים
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4" checked={f.excluded} onChange={(e) => setF((s) => ({ ...s, excluded: e.target.checked }))} />
            אל תכלול את התדלוק הזה בחישובי הצריכה
          </label>
        </Alert>
      )}
      {entry && !f.costOnly && v.warnings.length === 0 && (
        <label className="flex items-center gap-2 text-sm muted">
          <input type="checkbox" className="h-4 w-4" checked={f.excluded} onChange={(e) => setF((s) => ({ ...s, excluded: e.target.checked }))} />
          אל תכלול בחישובי הצריכה
        </label>
      )}
    </Modal>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-3">
      <div className="text-xs muted">{label}</div>
      <div className="text-lg font-bold">{value}</div>
      {sub && <div className="text-xs muted">{sub}</div>}
    </Card>
  );
}

export default function FuelPage() {
  const { fuel, remove } = useData();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<FuelEntry | null | 'new'>(null);
  const [station, setStation] = useState('');
  const [year, setYear] = useState('');

  const kmpl = useMemo(() => consumptionById(fuel), [fuel]);
  const anomalies = useMemo(() => new Map(consumptionAnomalies(fuel).map((a) => [a.entryId, a])), [fuel]);
  const stations = useMemo(() => [...new Set(fuel.map((e) => e.station).filter(Boolean))].sort(), [fuel]);
  const years = useMemo(() => [...new Set(fuel.map((e) => e.date.slice(0, 4)))].sort().reverse(), [fuel]);

  const filtered = fuel.filter((e) => (!station || e.station === station) && (!year || e.date.startsWith(year)));

  // year -> month -> entries
  const grouped = useMemo(() => {
    const g = new Map<string, Map<string, FuelEntry[]>>();
    for (const e of filtered) {
      const y = e.date.slice(0, 4);
      const m = monthKey(e.date);
      if (!g.has(y)) g.set(y, new Map());
      const ym = g.get(y)!;
      if (!ym.has(m)) ym.set(m, []);
      ym.get(m)!.push(e);
    }
    return g;
  }, [filtered]);

  const now = todayISO();
  const thisMonth = fuel.filter((e) => monthKey(e.date) === monthKey(now)).reduce((s, e) => s + e.totalPrice, 0);
  const thisYear = fuel.filter((e) => e.date.startsWith(now.slice(0, 4))).reduce((s, e) => s + e.totalPrice, 0);
  // Average over the months of this year that the log covers (from the first fill-up of the year)
  const firstThisYear = fuel.filter((e) => e.date.startsWith(now.slice(0, 4))).map((e) => e.date).sort()[0];
  const monthsCovered = firstThisYear ? Number(now.slice(5, 7)) - Number(firstThisYear.slice(5, 7)) + 1 : 1;
  const avg5 = averageConsumption(fuel, 5);
  const avgAll = averageConsumption(fuel);

  const del = async (e: FuelEntry) => {
    if (await confirm({ title: 'מחיקת תדלוק', message: `למחוק את התדלוק מתאריך ${formatDate(e.date)} (${formatMoney(e.totalPrice, true)})?` }))
      remove('fuel', e.id);
  };

  const sum = (xs: FuelEntry[]) => {
    const cost = xs.reduce((s, e) => s + e.totalPrice, 0);
    const liters = xs.reduce((s, e) => s + (e.liters ?? 0), 0);
    const km = xs.reduce((s, e) => s + (e.tripKm ?? 0), 0);
    const avg = averageConsumption(xs.filter((e) => kmpl.has(e.id)));
    return { cost, liters, km, avg };
  };

  return (
    <div>
      <PageHeader title="יומן תדלוקים" subtitle={`${fuel.length} תדלוקים`} />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="צריכה (5 אחרונים)" value={avg5 ? `${formatNumber(avg5, 1)} ק״מ/ל׳` : '—'} sub={avgAll ? `כללי: ${formatNumber(avgAll, 1)}` : undefined} />
        <Stat label="החודש" value={formatMoney(thisMonth)} />
        <Stat label={`שנת ${now.slice(0, 4)}`} value={formatMoney(thisYear)} />
        <Stat label="ממוצע חודשי השנה" value={formatMoney(thisYear / monthsCovered)} />
      </div>

      {fuel.length > 0 && (
        <div className="mb-4 flex gap-2">
          <select className="input" value={year} onChange={(e) => setYear(e.target.value)} aria-label="סינון לפי שנה">
            <option value="">כל השנים</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="input" value={station} onChange={(e) => setStation(e.target.value)} aria-label="סינון לפי תחנה">
            <option value="">כל התחנות</option>
            {stations.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      {fuel.length === 0 ? (
        <EmptyState icon={<FuelIcon className="h-10 w-10" />} text="עדיין אין תדלוקים. הוסף את התדלוק הראשון." action={<Button onClick={() => setEditing('new')}>תדלוק חדש</Button>} />
      ) : filtered.length === 0 ? (
        <EmptyState text="אין תדלוקים שתואמים לסינון." />
      ) : (
        <div className="space-y-6">
          {[...grouped.entries()].map(([y, months]) => {
            const ys = sum([...months.values()].flat());
            return (
              <section key={y}>
                <div className="mb-2 flex items-baseline justify-between">
                  <h2 className="text-xl font-bold">{y}</h2>
                  <span className="text-sm muted">{formatMoney(ys.cost)}{ys.liters > 0 && ` · ${formatNumber(ys.liters)} ל׳`}{ys.km > 0 && ` · ${formatNumber(ys.km)} ק״מ`}</span>
                </div>
                <div className="space-y-3">
                  {[...months.entries()].map(([m, entries]) => {
                    const ms = sum(entries);
                    return (
                      <Card key={m} className="p-0">
                        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
                          <h3 className="font-semibold">{monthLabel(m)}</h3>
                          <span className="text-sm muted">
                            {formatMoney(ms.cost)}{ms.liters > 0 && ` · ${formatNumber(ms.liters, 1)} ל׳`}{ms.avg ? ` · ${formatNumber(ms.avg, 1)} ק״מ/ל׳` : ''}
                          </span>
                        </div>
                        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                          {entries.map((e) => {
                            const a = anomalies.get(e.id);
                            const c = kmpl.get(e.id);
                            return (
                              <li key={e.id} className="flex items-center gap-2 px-4 py-2.5">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-x-2 text-sm">
                                    <span className="font-medium">{formatDate(e.date)}</span>
                                    <span className="muted">{e.station || '—'}</span>
                                    {e.costOnly && <span className="rounded bg-slate-200 px-1.5 text-xs dark:bg-slate-800">סכום בלבד</span>}
                                    {!e.costOnly && !e.fullTank && <span className="rounded bg-slate-200 px-1.5 text-xs dark:bg-slate-800">חלקי</span>}
                                    {!e.costOnly && e.excluded && <span className="rounded bg-slate-200 px-1.5 text-xs dark:bg-slate-800">לא נכלל</span>}
                                  </div>
                                  <div className="text-sm">
                                    {formatMoney(e.totalPrice, true)}{!e.costOnly && <> · {formatNumber(e.liters, 2)} ל׳ · {formatNumber(e.tripKm)} ק״מ</>}
                                    {c && (
                                      <span className={cx('ms-1 font-medium', a ? (a.deviation < 0 ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400') : 'text-emerald-700 dark:text-emerald-400')}>
                                        · {formatNumber(c, 1)} ק״מ/ל׳{a ? ` (${a.deviation > 0 ? '+' : ''}${Math.round(a.deviation * 100)}%)` : ''}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <IconButton label="עריכה" onClick={() => setEditing(e)}><Pencil className="h-4 w-4" /></IconButton>
                                <IconButton label="מחיקה" onClick={() => del(e)}><Trash2 className="h-4 w-4" /></IconButton>
                              </li>
                            );
                          })}
                        </ul>
                      </Card>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Fab label="תדלוק" onClick={() => setEditing('new')} />
      {editing && <FuelForm entry={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
