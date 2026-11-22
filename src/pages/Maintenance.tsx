import { useMemo, useState } from 'react';
import { ExternalLink, Pencil, Trash2, Wrench } from 'lucide-react';
import { useData } from '../lib/data';
import { avgKmPerDay, estimateOdometer, predictService } from '../lib/calc';
import { daysUntil, formatDate, relativeDays, todayISO } from '../lib/dates';
import { formatMoney, formatNumber, parseNum } from '../lib/format';
import { useSave } from '../lib/hooks';
import type { MaintenanceEntry, MaintenanceKind } from '../lib/types';
import { Alert, Button, Card, EmptyState, Fab, Field, IconButton, Modal, PageHeader, useConfirm } from '../components/ui';

export const KIND_LABEL: Record<MaintenanceKind, string> = {
  service: 'טיפול תקופתי',
  repair: 'תיקון',
  tires: 'צמיגים',
  battery: 'מצבר',
  brakes: 'בלמים',
  wipers: 'מגבים',
  other: 'אחר',
};

function MaintenanceForm({ entry, onClose, odoKm }: { entry: MaintenanceEntry | null; onClose: () => void; odoKm?: number }) {
  const { maintenance } = useData();
  const save = useSave('maintenance');
  const [f, setF] = useState({
    date: entry?.date ?? todayISO(),
    odometer: entry?.odometer != null ? String(entry.odometer) : '',
    kind: entry?.kind ?? ('service' as MaintenanceKind),
    description: entry?.description ?? '',
    parts: entry?.parts.join('\n') ?? '',
    cost: entry?.cost != null ? String(entry.cost) : '',
    garage: entry?.garage ?? '',
    invoiceUrl: entry?.invoiceUrl ?? '',
    notes: entry?.notes ?? '',
  });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const garages = useMemo(() => [...new Set(maintenance.map((m) => m.garage).filter(Boolean))], [maintenance]);

  const odometer = parseNum(f.odometer);
  const errors: string[] = [];
  if (!f.description.trim()) errors.push('יש לתאר מה בוצע');
  if (f.date > todayISO()) errors.push('התאריך בעתיד');
  if (f.invoiceUrl && !/^https?:\/\//.test(f.invoiceUrl)) errors.push('קישור לחשבונית חייב להתחיל ב-https://');
  const warnings: string[] = [];
  if (odometer != null && odoKm != null && Math.abs(odometer - odoKm) > 5000 && f.date >= todayISO())
    warnings.push(`הק״מ שהוזן רחוק מההערכה הנוכחית (${formatNumber(odoKm)}). בדוק שאין טעות.`);
  const prevHigher = maintenance.find((m) => m.id !== entry?.id && m.odometer && odometer && m.date < f.date && m.odometer > odometer);
  if (prevHigher) warnings.push(`בטיפול מ-${formatDate(prevHigher.date)} נרשם ק״מ גבוה יותר (${formatNumber(prevHigher.odometer)}).`);

  const submit = async () => {
    if (errors.length) return;
    const data = {
      date: f.date, odometer, kind: f.kind, description: f.description.trim(),
      parts: f.parts.split(/\n|,/).map((p) => p.trim()).filter(Boolean),
      cost: parseNum(f.cost) ?? 0, garage: f.garage.trim(), invoiceUrl: f.invoiceUrl.trim() || undefined, notes: f.notes.trim(),
    };
    if (await save(data, entry?.id)) onClose();
  };

  return (
    <Modal open title={entry ? 'עריכת טיפול / תיקון' : 'טיפול / תיקון חדש'} onClose={onClose}
      footer={<>
        <Button className="flex-1" onClick={submit} disabled={errors.length > 0}>שמירה</Button>
        <Button variant="secondary" className="flex-1" onClick={onClose}>ביטול</Button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="תאריך"><input type="date" className="input" value={f.date} max={todayISO()} onChange={(e) => set('date', e.target.value)} /></Field>
        <Field label="סוג">
          <select className="input" value={f.kind} onChange={(e) => set('kind', e.target.value)}>
            {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="ק״מ ברכב" hint={odoKm != null ? `הערכה נוכחית: ${formatNumber(odoKm)}` : 'חשוב לתחזית הטיפול הבא'}>
          <input type="number" inputMode="numeric" className="input" value={f.odometer} onChange={(e) => set('odometer', e.target.value)} />
        </Field>
        <Field label="עלות (₪)"><input type="number" inputMode="decimal" className="input" value={f.cost} onChange={(e) => set('cost', e.target.value)} /></Field>
      </div>
      <Field label="מה בוצע"><input className="input" value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="טיפול 60,000, החלפת רפידות…" /></Field>
      <Field label="חלקים שהוחלפו" hint="שורה או פסיק לכל חלק">
        <textarea rows={3} className="input" value={f.parts} onChange={(e) => set('parts', e.target.value)} placeholder={'שמן מנוע\nמסנן שמן\nמסנן אוויר'} />
      </Field>
      <Field label="מוסך">
        <input className="input" list="garages" value={f.garage} onChange={(e) => set('garage', e.target.value)} />
        <datalist id="garages">{garages.map((g) => <option key={g} value={g} />)}</datalist>
      </Field>
      <Field label="קישור לחשבונית" hint="קישור לקובץ ב-Google Drive (העלאה ישירה תתווסף בשלב הבא)">
        <input type="url" className="input" value={f.invoiceUrl} onChange={(e) => set('invoiceUrl', e.target.value)} placeholder="https://drive.google.com/…" />
      </Field>
      <Field label="הערות"><input className="input" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
      {errors.length > 0 && f.description && <Alert tone="error">{errors.map((x) => <p key={x}>{x}</p>)}</Alert>}
      {warnings.length > 0 && <Alert>{warnings.map((x) => <p key={x}>{x}</p>)}</Alert>}
    </Modal>
  );
}

export default function MaintenancePage() {
  const { settings, fuel, maintenance, tests, remove } = useData();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<MaintenanceEntry | null | 'new'>(null);
  const odo = useMemo(() => estimateOdometer(settings, fuel, maintenance, tests), [settings, fuel, maintenance, tests]);
  const kpd = useMemo(() => avgKmPerDay(fuel), [fuel]);
  const svc = useMemo(() => predictService(settings, maintenance, odo, kpd), [settings, maintenance, odo, kpd]);
  const year = todayISO().slice(0, 4);
  const yearCost = maintenance.filter((m) => m.date.startsWith(year)).reduce((s, m) => s + (m.cost || 0), 0);

  const del = async (m: MaintenanceEntry) => {
    if (await confirm({ title: 'מחיקת רשומה', message: `למחוק את "${m.description}" מתאריך ${formatDate(m.date)}?` })) remove('maintenance', m.id);
  };

  return (
    <div>
      <PageHeader title="טיפולים ותיקונים" subtitle={`עלות ${year}: ${formatMoney(yearCost)}`} />

      <Card className="mb-4">
        <h2 className="mb-2 font-semibold">הטיפול התקופתי הבא</h2>
        {svc.lastService ? (
          <div className="space-y-1 text-sm">
            <p className="text-lg font-bold">
              {svc.dueDate ? `${formatDate(svc.dueDate)} (${relativeDays(daysUntil(svc.dueDate))})` : '—'}
            </p>
            {svc.dueKm && <p>או ב-{formatNumber(svc.dueKm)} ק״מ{svc.kmLeft != null && ` · ${svc.kmLeft > 0 ? `נותרו כ-${formatNumber(svc.kmLeft)} ק״מ` : `חריגה של ${formatNumber(-svc.kmLeft)} ק״מ`}`}</p>}
            <p className="muted">
              טיפול אחרון: {formatDate(svc.lastService.date)}{svc.lastService.odometer ? ` ב-${formatNumber(svc.lastService.odometer)} ק״מ` : ''} ·
              מרווח: {formatNumber(settings.serviceIntervalKm)} ק״מ או {settings.serviceIntervalMonths} חודשים
            </p>
            {kpd && <p className="muted">קצב נסיעה ממוצע: כ-{formatNumber(kpd * 30)} ק״מ בחודש (לפי יומן התדלוקים)</p>}
            {!svc.lastService.odometer && <p className="text-amber-700 dark:text-amber-400">הזן ק״מ בטיפול האחרון לתחזית לפי קילומטראז׳.</p>}
          </div>
        ) : (
          <p className="text-sm muted">הוסף את הטיפול התקופתי האחרון (סוג "טיפול תקופתי", עם ק״מ) כדי לקבל תחזית.</p>
        )}
      </Card>

      {maintenance.length === 0 ? (
        <EmptyState icon={<Wrench className="h-10 w-10" />} text="עדיין אין טיפולים או תיקונים." action={<Button onClick={() => setEditing('new')}>הוספה</Button>} />
      ) : (
        <div className="space-y-3">
          {maintenance.map((m) => (
            <Card key={m.id}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-950 dark:text-blue-300">{KIND_LABEL[m.kind]}</span>
                    <span className="text-sm muted">{formatDate(m.date)}{m.odometer ? ` · ${formatNumber(m.odometer)} ק״מ` : ''}</span>
                  </div>
                  <h3 className="mt-1 font-semibold">{m.description}</h3>
                  <p className="text-sm muted">{m.garage || 'מוסך לא צוין'} · {formatMoney(m.cost)}</p>
                  {m.parts.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {m.parts.map((p) => <span key={p} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">{p}</span>)}
                    </div>
                  )}
                  {m.notes && <p className="mt-1 text-sm muted">{m.notes}</p>}
                  {m.invoiceUrl && (
                    <a href={m.invoiceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-blue-700 hover:underline dark:text-blue-400">
                      <ExternalLink className="h-4 w-4" /> חשבונית
                    </a>
                  )}
                </div>
                <IconButton label="עריכה" onClick={() => setEditing(m)}><Pencil className="h-4 w-4" /></IconButton>
                <IconButton label="מחיקה" onClick={() => del(m)}><Trash2 className="h-4 w-4" /></IconButton>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Fab label="טיפול" onClick={() => setEditing('new')} />
      {editing && <MaintenanceForm entry={editing === 'new' ? null : editing} odoKm={odo?.km} onClose={() => setEditing(null)} />}
    </div>
  );
}
