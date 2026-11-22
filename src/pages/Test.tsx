import { useMemo, useState } from 'react';
import { CalendarCheck, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { useData } from '../lib/data';
import { licenseValidUntil, severityFor } from '../lib/calc';
import { addMonths, daysUntil, formatDate, todayISO } from '../lib/dates';
import { formatMoney, formatNumber, parseNum, uid } from '../lib/format';
import { validateTest } from '../lib/validation';
import { useSave } from '../lib/hooks';
import type { ChecklistItem, TestEntry } from '../lib/types';
import { Alert, Badge, Button, Card, cx, EmptyState, Field, IconButton, Modal, PageHeader, useConfirm, useToast } from '../components/ui';

function TestForm({ entry, onClose }: { entry: TestEntry | null; onClose: () => void }) {
  const { tests } = useData();
  const save = useSave('tests');
  const [f, setF] = useState({
    date: entry?.date ?? todayISO(),
    passed: entry?.passed ?? true,
    station: entry?.station ?? '',
    cost: entry?.cost != null ? String(entry.cost) : '',
    odometer: entry?.odometer != null ? String(entry.odometer) : '',
    validUntil: entry?.validUntil ?? addMonths(todayISO(), 12),
    notes: entry?.notes ?? '',
  });
  const [ack, setAck] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => { setF((s) => ({ ...s, [k]: v })); setAck(false); };
  const data = { id: entry?.id, date: f.date, passed: f.passed, validUntil: f.validUntil };
  const v = validateTest(data, tests);

  const submit = async () => {
    if (v.errors.length || (v.warnings.length && !ack)) return;
    const ok = await save({
      date: f.date, passed: f.passed, station: f.station.trim(), cost: parseNum(f.cost), odometer: parseNum(f.odometer),
      validUntil: f.validUntil, notes: f.notes.trim(),
    }, entry?.id);
    if (ok) onClose();
  };

  return (
    <Modal open title={entry ? 'עריכת טסט' : 'טסט חדש'} onClose={onClose}
      footer={<>
        <Button className="flex-1" onClick={submit} disabled={v.errors.length > 0 || (v.warnings.length > 0 && !ack)}>שמירה</Button>
        <Button variant="secondary" className="flex-1" onClick={onClose}>ביטול</Button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="תאריך הטסט">
          <input type="date" className="input" value={f.date} onChange={(e) => { set('date', e.target.value); if (!entry) setF((s) => ({ ...s, date: e.target.value, validUntil: addMonths(e.target.value, 12) })); }} />
        </Field>
        <Field label="תוצאה">
          <select className="input" value={f.passed ? '1' : '0'} onChange={(e) => set('passed', e.target.value === '1')}>
            <option value="1">עבר</option>
            <option value="0">לא עבר</option>
          </select>
        </Field>
        <Field label="רישיון בתוקף עד" className="col-span-2" hint="מופיע ברישיון הרכב החדש">
          <input type="date" className="input" value={f.validUntil} onChange={(e) => set('validUntil', e.target.value)} />
        </Field>
        <Field label="מכון רישוי"><input className="input" value={f.station} onChange={(e) => set('station', e.target.value)} /></Field>
        <Field label="עלות (₪)"><input type="number" inputMode="decimal" className="input" value={f.cost} onChange={(e) => set('cost', e.target.value)} /></Field>
        <Field label="ק״מ ברכב" className="col-span-2"><input type="number" inputMode="numeric" className="input" value={f.odometer} onChange={(e) => set('odometer', e.target.value)} /></Field>
      </div>
      <Field label="הערות"><input className="input" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
      {v.errors.length > 0 && <Alert tone="error">{v.errors.map((x) => <p key={x}>{x}</p>)}</Alert>}
      {v.errors.length === 0 && v.warnings.length > 0 && (
        <Alert>
          {v.warnings.map((x) => <p key={x}>{x}</p>)}
          <label className="mt-2 flex items-center gap-2 font-medium">
            <input type="checkbox" className="h-4 w-4" checked={ack} onChange={(e) => setAck(e.target.checked)} /> זה לא כפול – לשמור
          </label>
        </Alert>
      )}
    </Modal>
  );
}

function Checklist() {
  const { settings, saveSettings } = useData();
  const confirm = useConfirm();
  const toast = useToast();
  const [text, setText] = useState('');
  const items = settings.testChecklist;
  const done = items.filter((i) => i.done).length;

  const write = async (next: ChecklistItem[]) => {
    try { await saveSettings({ testChecklist: next }); } catch (e) { toast((e as Error).message, 'error'); }
  };
  const toggle = (id: string) => write(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    write([...items, { id: uid(), text: text.trim(), done: false }]);
    setText('');
  };
  const del = async (i: ChecklistItem) => {
    if (await confirm({ title: 'מחיקת פריט מהרשימה', message: `למחוק את "${i.text}"?` })) write(items.filter((x) => x.id !== i.id));
  };
  const reset = async () => {
    if (await confirm({ title: 'איפוס הרשימה', message: 'לבטל את הסימון של כל הפריטים (לקראת הטסט הבא)?', confirmText: 'איפוס', danger: false }))
      write(items.map((i) => ({ ...i, done: false })));
  };

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold">רשימת בדיקות לפני טסט</h2>
        <span className="text-sm muted">{done}/{items.length}</span>
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className="h-full bg-emerald-600 transition-all dark:bg-emerald-400" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
      </div>
      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-3 py-2">
            <input type="checkbox" checked={i.done} onChange={() => toggle(i.id)} className="h-5 w-5 shrink-0 accent-emerald-600" aria-label={i.text} />
            <span className={cx('flex-1 text-sm', i.done && 'line-through muted')}>{i.text}</span>
            <IconButton label="מחיקה" onClick={() => del(i)}><Trash2 className="h-4 w-4" /></IconButton>
          </li>
        ))}
      </ul>
      <form onSubmit={addItem} className="mt-3 flex gap-2">
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="פריט נוסף לבדיקה" />
        <Button type="submit" disabled={!text.trim()}>הוספה</Button>
      </form>
      {done > 0 && (
        <button onClick={reset} className="mt-3 inline-flex items-center gap-1 text-sm text-blue-700 hover:underline dark:text-blue-400">
          <RotateCcw className="h-4 w-4" /> איפוס הסימונים
        </button>
      )}
    </Card>
  );
}

export default function TestPage() {
  const { tests, documents, settings, remove } = useData();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<TestEntry | null | 'new'>(null);
  const validUntil = useMemo(() => licenseValidUntil(tests, documents), [tests, documents]);
  const days = validUntil ? daysUntil(validUntil) : undefined;
  const sev = days != null ? severityFor(days, settings.reminderDays) : 'missing';

  const del = async (t: TestEntry) => {
    if (await confirm({ title: 'מחיקת טסט', message: `למחוק את הטסט מתאריך ${formatDate(t.date)}?` })) remove('tests', t.id);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="טסט ורישיון רכב" action={<Button onClick={() => setEditing('new')}>טסט חדש</Button>} />

      <Card className="text-center">
        {validUntil && days != null ? (
          <>
            <p className="text-sm muted">רישיון הרכב בתוקף עד {formatDate(validUntil)}</p>
            <p className={cx('my-2 text-6xl font-bold tabular-nums',
              sev === 'overdue' ? 'text-red-700 dark:text-red-400' : sev === 'urgent' ? 'text-orange-600 dark:text-orange-400' : 'text-slate-900 dark:text-slate-100')}>
              {Math.abs(days)}
            </p>
            <p className="font-medium">{days >= 0 ? 'ימים לטסט' : 'ימים שהרישיון פג!'}</p>
          </>
        ) : (
          <p className="py-4 muted">הוסף את הטסט האחרון או את רישיון הרכב (במסמכים) כדי להתחיל ספירה לאחור.</p>
        )}
      </Card>

      <Checklist />

      <section>
        <h2 className="mb-2 text-lg font-semibold">היסטוריית טסטים</h2>
        {tests.length === 0 ? (
          <EmptyState icon={<CalendarCheck className="h-10 w-10" />} text="עדיין לא נרשמו טסטים." />
        ) : (
          <div className="space-y-2">
            {tests.map((t) => (
              <Card key={t.id} className="flex items-center gap-2 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{formatDate(t.date)}</span>
                    <Badge severity={t.passed ? 'ok' : 'overdue'}>{t.passed ? 'עבר' : 'לא עבר'}</Badge>
                  </div>
                  <p className="text-sm muted">
                    בתוקף עד {formatDate(t.validUntil)}{t.station ? ` · ${t.station}` : ''}{t.cost ? ` · ${formatMoney(t.cost)}` : ''}{t.odometer ? ` · ${formatNumber(t.odometer)} ק״מ` : ''}
                  </p>
                  {t.notes && <p className="text-sm muted">{t.notes}</p>}
                </div>
                <IconButton label="עריכה" onClick={() => setEditing(t)}><Pencil className="h-4 w-4" /></IconButton>
                <IconButton label="מחיקה" onClick={() => del(t)}><Trash2 className="h-4 w-4" /></IconButton>
              </Card>
            ))}
          </div>
        )}
      </section>

      {editing && <TestForm entry={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
