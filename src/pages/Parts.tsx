import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BatteryCharging, CircleDot, Cog, Disc3, Pencil, ShieldCheck, Wind } from 'lucide-react';
import { useData } from '../lib/data';
import { avgKmPerDay, estimateOdometer } from '../lib/calc';
import { computeParts, type PartGroup, type PartStatus } from '../lib/parts';
import { daysUntil, formatDate, relativeDays, todayISO } from '../lib/dates';
import { formatNumber, parseNum } from '../lib/format';
import type { PartInfo } from '../lib/types';
import { Alert, Badge, Button, Card, cx, Field, IconButton, Modal, PageHeader, SEVERITY_BORDER, useConfirm, useToast } from '../components/ui';

const GROUPS: { group: PartGroup; title: string; icon: React.ReactNode }[] = [
  { group: 'battery', title: 'מצבר', icon: <BatteryCharging className="h-5 w-5" /> },
  { group: 'tires', title: 'צמיגים', icon: <CircleDot className="h-5 w-5" /> },
  { group: 'brakes', title: 'בלמים', icon: <Disc3 className="h-5 w-5" /> },
  { group: 'wipers', title: 'מגבים', icon: <Wind className="h-5 w-5" /> },
  { group: 'engine', title: 'מנוע', icon: <Cog className="h-5 w-5" /> },
];

const SEV_TEXT = { overdue: 'להחליף', urgent: 'בקרוב מאוד', soon: 'בקרוב', ok: 'תקין', missing: 'אין נתונים' } as const;
const BAR = { overdue: 'bg-red-600 dark:bg-red-400', urgent: 'bg-orange-500', soon: 'bg-amber-400', ok: 'bg-emerald-500', missing: 'bg-slate-400' } as const;

function PartForm({ st, onClose }: { st: PartStatus; onClose: () => void }) {
  const { set } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const i = st.info;
  const [f, setF] = useState({
    brand: i?.brand ?? '',
    manualDate: i?.manualDate ?? '',
    manualKm: i?.manualKm != null ? String(i.manualKm) : '',
    lifeKm: i?.lifeKm != null ? String(i.lifeKm) : '',
    lifeMonths: i?.lifeMonths != null ? String(i.lifeMonths) : '',
    warrantyUntil: i?.warrantyUntil ?? '',
    treadMm: i?.treadMm != null ? String(i.treadMm) : '',
    treadDate: i?.treadDate ?? todayISO(),
    notes: i?.notes ?? '',
  });
  const s = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const isTire = st.def.group === 'tires';
  const tread = parseNum(f.treadMm);
  const errors: string[] = [];
  if (f.manualDate && f.manualDate > todayISO()) errors.push('תאריך ההחלפה בעתיד');
  if (tread != null && (tread < 0 || tread > 12)) errors.push('עומק חריץ צריך להיות בין 0 ל-12 מ״מ');

  const save = async () => {
    if (errors.length) return;
    const data: Partial<PartInfo> = {
      brand: f.brand.trim() || undefined,
      manualDate: f.manualDate || undefined,
      manualKm: f.manualDate ? parseNum(f.manualKm) : undefined,
      lifeKm: parseNum(f.lifeKm),
      lifeMonths: parseNum(f.lifeMonths),
      warrantyUntil: f.warrantyUntil || undefined,
      treadMm: isTire ? tread : undefined,
      treadDate: isTire && tread != null ? f.treadDate : undefined,
      notes: f.notes.trim() || undefined,
    };
    try {
      await set('parts', st.def.slot, data);
      toast('נשמר');
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const reset = async () => {
    if (await confirm({ title: 'איפוס פרטי החלק', message: `למחוק את כל הפרטים שהוזנו ידנית עבור "${st.def.label}"? המצב יחושב שוב רק מיומן הטיפולים.`, confirmText: 'איפוס' })) {
      await set('parts', st.def.slot, {});
      onClose();
    }
  };

  return (
    <Modal open title={st.def.label} onClose={onClose}
      footer={<>
        <Button className="flex-1" onClick={save} disabled={errors.length > 0}>שמירה</Button>
        <Button variant="secondary" className="flex-1" onClick={onClose}>ביטול</Button>
      </>}>
      <Alert tone="info">
        החלפות שנעשו במוסך עדיף לרשום ב<Link to="/maintenance" className="font-medium underline" onClick={onClose}>טיפולים ותיקונים</Link> – החלק יתעדכן אוטומטית. כאן אפשר להוסיף פרטים או החלפה שלא נרשמה.
      </Alert>
      <Field label="יצרן / דגם"><input className="input" value={f.brand} onChange={(e) => s('brand', e.target.value)} placeholder={isTire ? 'Michelin Primacy 4' : st.def.group === 'battery' ? 'Varta 70Ah' : ''} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="הוחלף בתאריך (ידני)" hint="רק אם לא רשום בטיפולים">
          <input type="date" className="input" value={f.manualDate} max={todayISO()} onChange={(e) => s('manualDate', e.target.value)} />
        </Field>
        <Field label="ק״מ בהחלפה" hint="ריק = הערכה אוטומטית">
          <input type="number" inputMode="numeric" className="input" value={f.manualKm} disabled={!f.manualDate} onChange={(e) => s('manualKm', e.target.value)} />
        </Field>
        <Field label="אורך חיים (ק״מ)" hint={st.def.lifeKm ? `ברירת מחדל: ${formatNumber(st.def.lifeKm)}` : 'ללא ברירת מחדל'}>
          <input type="number" inputMode="numeric" className="input" value={f.lifeKm} onChange={(e) => s('lifeKm', e.target.value)} />
        </Field>
        <Field label="אורך חיים (חודשים)" hint={st.def.lifeMonths ? `ברירת מחדל: ${st.def.lifeMonths}` : 'ללא ברירת מחדל'}>
          <input type="number" inputMode="numeric" className="input" value={f.lifeMonths} onChange={(e) => s('lifeMonths', e.target.value)} />
        </Field>
        <Field label="אחריות עד" className="col-span-2"><input type="date" className="input" value={f.warrantyUntil} onChange={(e) => s('warrantyUntil', e.target.value)} /></Field>
        {isTire && <>
          <Field label="עומק חריץ (מ״מ)" hint="מינימום חוקי: 1.6 מ״מ">
            <input type="number" inputMode="decimal" step="0.1" className="input" value={f.treadMm} onChange={(e) => s('treadMm', e.target.value)} />
          </Field>
          <Field label="נמדד בתאריך"><input type="date" className="input" value={f.treadDate} onChange={(e) => s('treadDate', e.target.value)} /></Field>
        </>}
      </div>
      <Field label="הערות"><input className="input" value={f.notes} onChange={(e) => s('notes', e.target.value)} /></Field>
      {errors.length > 0 && <Alert tone="error">{errors.map((x) => <p key={x}>{x}</p>)}</Alert>}
      {st.info && Object.keys(st.info).some((k) => !['id', 'updatedAt', 'createdAt'].includes(k)) && (
        <button onClick={reset} className="text-sm text-red-700 hover:underline dark:text-red-400">איפוס הפרטים הידניים</button>
      )}
    </Modal>
  );
}

function PartCard({ st, onEdit }: { st: PartStatus; onEdit: () => void }) {
  const pct = st.wear != null ? Math.min(100, Math.round(st.wear * 100)) : 0;
  const w = st.info?.warrantyUntil;
  return (
    <Card className={cx('p-3', SEVERITY_BORDER[st.severity])}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{st.def.label}</h3>
            <Badge severity={st.severity}>{SEV_TEXT[st.severity]}</Badge>
          </div>
          {st.info?.brand && <p className="text-sm muted">{st.info.brand}</p>}
          {st.installedDate ? (
            <>
              <p className="mt-1 text-sm">
                הוחלף {formatDate(st.installedDate)}
                {st.installedKm && ` · ${st.installedKm.estimated ? '~' : ''}${formatNumber(st.installedKm.km)} ק״מ`}
              </p>
              <p className="text-xs muted">
                {st.source?.kind === 'manual' ? 'הוזן ידנית' : `מתוך: ${st.source?.entry.description}`}
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="שחיקה משוערת">
                <div className={cx('h-full', BAR[st.severity])} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-xs muted">
                {st.wear != null && (st.wear >= 1 ? 'עבר את אורך החיים המומלץ' : `${Math.round(st.wear * 100)}% מאורך החיים`)}
                {st.kmUsed != null && ` · ${formatNumber(st.kmUsed)} ק״מ`}
                {st.monthsUsed != null && ` · ${formatNumber(st.monthsUsed, 0)} חודשים`}
              </p>
              {st.dueDate && (
                <p className="text-sm">
                  החלפה הבאה: {formatDate(st.dueDate)} ({relativeDays(daysUntil(st.dueDate))}){st.dueReason === 'km' ? ' – לפי ק״מ' : ' – לפי זמן'}
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm muted">לא נמצאה החלפה ביומן הטיפולים. לחץ על העריכה כדי להוסיף.</p>
          )}
          {st.warning && <p className="mt-1 text-sm font-medium text-red-700 dark:text-red-400">{st.warning}</p>}
          {st.info?.treadMm != null && !st.warning && <p className="text-sm">עומק חריץ: {st.info.treadMm} מ״מ ({formatDate(st.info.treadDate)})</p>}
          {w && (
            <p className={cx('mt-1 flex items-center gap-1 text-sm', daysUntil(w) < 0 ? 'muted' : 'text-emerald-700 dark:text-emerald-400')}>
              <ShieldCheck className="h-4 w-4" /> אחריות {daysUntil(w) < 0 ? 'הסתיימה' : 'עד'} {formatDate(w)}
            </p>
          )}
          {st.info?.notes && <p className="text-sm muted">{st.info.notes}</p>}
        </div>
        <IconButton label={`עריכת ${st.def.label}`} onClick={onEdit}><Pencil className="h-4 w-4" /></IconButton>
      </div>
    </Card>
  );
}

export default function PartsPage() {
  const { settings, maintenance, tests, fuel, parts } = useData();
  const [editing, setEditing] = useState<PartStatus | null>(null);
  const odo = useMemo(() => estimateOdometer(settings, fuel, maintenance, tests), [settings, fuel, maintenance, tests]);
  const statuses = useMemo(
    () => computeParts({ settings, maintenance, tests, fuel, parts, currentKm: odo?.km, kmPerDay: avgKmPerDay(fuel) }),
    [settings, maintenance, tests, fuel, parts, odo],
  );
  const attention = statuses.filter((s) => s.severity === 'overdue' || s.severity === 'urgent').length;

  return (
    <div>
      <PageHeader title="חלקים שמתבלים" subtitle={odo ? `ק״מ משוער: ${formatNumber(odo.km)}${attention ? ` · ${attention} דורשים טיפול` : ''}` : undefined} />
      <p className="mb-4 text-xs muted">
        המצב מחושב אוטומטית מיומן הטיפולים. ק״מ עם ~ הוא הערכה לפי הטיפולים שלפני ואחרי. אורכי החיים הם ברירות מחדל כלליות, ואפשר לשנות אותם לכל חלק.
      </p>
      <div className="space-y-6">
        {GROUPS.map(({ group, title, icon }) => {
          const items = statuses.filter((s) => s.def.group === group);
          return (
            <section key={group}>
              <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">{icon}{title}</h2>
              <div className={cx('grid gap-3', group === 'tires' || group === 'brakes' ? 'sm:grid-cols-2' : '')}>
                {items.map((st) => <PartCard key={st.def.slot} st={st} onEdit={() => setEditing(st)} />)}
              </div>
            </section>
          );
        })}
      </div>
      {editing && <PartForm st={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
