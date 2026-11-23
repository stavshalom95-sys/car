import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Car, ExternalLink, Mail, Pencil, Receipt, Trash2 } from 'lucide-react';
import { useData } from '../lib/data';
import { annualCost, availableYears, EXPENSE_LABEL, type AnnualCost } from '../lib/calc';
import { daysUntil, formatDate, HE_MONTHS, monthKey, monthLabel, relativeDays, todayISO } from '../lib/dates';
import { formatMoney, parseNum } from '../lib/format';
import { useSave } from '../lib/hooks';
import type { Expense, ExpenseCategory } from '../lib/types';
import { Alert, Badge, Button, Card, cx, EmptyState, Fab, Field, IconButton, Modal, PageHeader, useConfirm } from '../components/ui';

const CATS = Object.keys(EXPENSE_LABEL) as ExpenseCategory[];
const PLACEHOLDER: Record<ExpenseCategory, string> = {
  parking: 'חניון עזריאלי, פנגו…', toll: 'כביש 6, מנהרות הכרמל, נתיב מהיר…', fine: 'דוח חניה עיריית ת״א…', wash: 'שטיפה + ואקום…', other: '',
};

function ExpenseForm({ entry, onClose }: { entry: Expense | null; onClose: () => void }) {
  const save = useSave('expenses');
  const [f, setF] = useState({
    date: entry?.date ?? todayISO(),
    category: entry?.category ?? ('parking' as ExpenseCategory),
    amount: entry?.amount != null ? String(entry.amount) : '',
    description: entry?.description ?? '',
    location: entry?.location ?? '',
    receiptUrl: entry?.receiptUrl ?? '',
    notes: entry?.notes ?? '',
    dueDate: entry?.dueDate ?? '',
    paid: entry?.paid ?? false,
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));
  const amount = parseNum(f.amount);
  const isFine = f.category === 'fine';
  const errors: string[] = [];
  if (f.amount !== '' && (amount == null || amount <= 0)) errors.push('סכום חייב להיות חיובי');
  if (f.date > todayISO()) errors.push('התאריך בעתיד');
  if (f.receiptUrl && !/^https?:\/\//.test(f.receiptUrl)) errors.push('קישור לקבלה חייב להתחיל ב-https://');
  const warn = amount != null && amount > (isFine ? 5000 : 2000) ? `₪${amount} – סכום גבוה במיוחד. בדוק שאין טעות הקלדה.` : null;

  const submit = async () => {
    if (errors.length || amount == null) return;
    const ok = await save({
      date: f.date, category: f.category, amount, description: f.description.trim(), location: f.location.trim(),
      receiptUrl: f.receiptUrl.trim() || undefined, notes: f.notes.trim(),
      dueDate: isFine ? f.dueDate || undefined : undefined, paid: isFine ? f.paid : undefined,
    }, entry?.id);
    if (ok) onClose();
  };

  return (
    <Modal open title={entry ? 'עריכת הוצאה' : 'הוצאה חדשה'} onClose={onClose}
      footer={<>
        <Button className="flex-1" onClick={submit} disabled={errors.length > 0 || amount == null}>שמירה</Button>
        <Button variant="secondary" className="flex-1" onClick={onClose}>ביטול</Button>
      </>}>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="קטגוריה">
        {CATS.map((c) => (
          <button key={c} role="radio" aria-checked={f.category === c} onClick={() => set('category', c)}
            className={cx('rounded-full border px-3 py-1.5 text-sm',
              f.category === c ? 'border-blue-700 bg-blue-700 text-white dark:border-blue-400 dark:bg-blue-500 dark:text-slate-950' : 'border-slate-300 dark:border-slate-600')}>
            {EXPENSE_LABEL[c]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="תאריך"><input type="date" className="input" value={f.date} max={todayISO()} onChange={(e) => set('date', e.target.value)} /></Field>
        <Field label="סכום (₪)"><input type="number" inputMode="decimal" step="0.01" className="input" value={f.amount} onChange={(e) => set('amount', e.target.value)} /></Field>
      </div>
      <Field label="תיאור"><input className="input" value={f.description} onChange={(e) => set('description', e.target.value)} placeholder={PLACEHOLDER[f.category]} /></Field>
      <Field label="מקום"><input className="input" value={f.location} onChange={(e) => set('location', e.target.value)} /></Field>
      {isFine && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="לתשלום עד"><input type="date" className="input" value={f.dueDate} onChange={(e) => set('dueDate', e.target.value)} /></Field>
          <label className="mt-6 flex items-center gap-2">
            <input type="checkbox" className="h-5 w-5 accent-blue-700" checked={f.paid} onChange={(e) => set('paid', e.target.checked)} /> שולם
          </label>
        </div>
      )}
      <Field label="קישור לקבלה" hint="קישור ל-Google Drive"><input type="url" className="input" value={f.receiptUrl} onChange={(e) => set('receiptUrl', e.target.value)} placeholder="https://drive.google.com/…" /></Field>
      <Field label="הערות"><input className="input" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
      {errors.length > 0 && <Alert tone="error">{errors.map((x) => <p key={x}>{x}</p>)}</Alert>}
      {warn && <Alert>{warn}</Alert>}
    </Modal>
  );
}

/** Single-series magnitude breakdown: sorted horizontal bars, every value labelled (the list doubles as the table view). */
function CostBreakdown({ cost }: { cost: AnnualCost }) {
  const max = cost.rows[0]?.amount ?? 0;
  return (
    <ul className="space-y-2.5" aria-label={`פירוט עלויות ${cost.year}`}>
      {cost.rows.map((r) => {
        const pct = cost.total ? Math.round((r.amount / cost.total) * 100) : 0;
        return (
          <li key={r.key} title={`${r.label}: ${formatMoney(r.amount)} · ${pct}% · ${r.count} פריטים`}
            className="group rounded-lg px-1 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800/60">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium text-slate-900 dark:text-slate-100">{r.label}</span>
              <span className="tabular-nums text-slate-700 dark:text-slate-300">{formatMoney(r.amount)} <span className="text-xs muted">({pct}%)</span></span>
            </div>
            <div className="mt-1 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded-full bg-[#1d4ed8] dark:bg-[#3b82f6]" style={{ width: `${max ? Math.max(2, (r.amount / max) * 100) : 0}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function MonthBars({ cost }: { cost: AnnualCost }) {
  const max = Math.max(...cost.byMonth, 1);
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? null;
  return (
    <div>
      <div className="mb-1 h-5 text-sm">
        {shown != null ? <span><span className="font-medium">{HE_MONTHS[shown]}</span>: {formatMoney(cost.byMonth[shown])}</span> : <span className="muted">הצבע על חודש לפרטים</span>}
      </div>
      <div className="flex h-28 items-end gap-[2px]" role="img" aria-label={`עלות לפי חודש ב-${cost.year}`}>
        {cost.byMonth.map((v, i) => (
          <button key={i} className="flex h-full flex-1 items-end rounded-t focus:outline-none" aria-label={`${HE_MONTHS[i]}: ${formatMoney(v)}`}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} onClick={() => setHover(i)}>
            <div className={cx('w-full rounded-t-[4px]', hover === i ? 'bg-[#1e40af] dark:bg-[#60a5fa]' : 'bg-[#1d4ed8] dark:bg-[#3b82f6]')}
              style={{ height: v > 0 ? `${Math.max(3, (v / max) * 100)}%` : '0' }} />
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px] border-t border-slate-200 pt-1 text-[10px] muted dark:border-slate-700">
        {HE_MONTHS.map((m) => <span key={m} className="flex-1 text-center">{m.slice(0, 3)}</span>)}
      </div>
    </div>
  );
}

export default function ExpensesPage() {
  const data = useData();
  const { expenses, remove } = data;
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Expense | null | 'new'>(null);
  const years = useMemo(() => availableYears(data), [data]);
  const [year, setYear] = useState(todayISO().slice(0, 4));
  const [cat, setCat] = useState<ExpenseCategory | ''>('');
  const cost = useMemo(() => annualCost(year, data), [year, data]);

  const list = expenses.filter((e) => e.date.startsWith(year) && (!cat || e.category === cat));
  const byMonth = useMemo(() => {
    const g = new Map<string, Expense[]>();
    for (const e of list) { const k = monthKey(e.date); if (!g.has(k)) g.set(k, []); g.get(k)!.push(e); }
    return g;
  }, [list]);
  const unpaid = expenses.filter((e) => e.category === 'fine' && !e.paid);

  const del = async (e: Expense) => {
    if (await confirm({ title: 'מחיקת הוצאה', message: `למחוק את ההוצאה מ-${formatDate(e.date)} (${formatMoney(e.amount, true)})?` })) remove('expenses', e.id);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="הוצאות ועלות שנתית" action={
        <div className="flex items-center gap-2">
          <Link to="/import" className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-800"><Mail className="h-4 w-4" /> ייבוא מ-Gmail</Link>
          <select className="input w-auto" value={year} onChange={(e) => setYear(e.target.value)} aria-label="שנה">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      } />

      <Card>
        <div className="flex items-center gap-3">
          <Car className="h-8 w-8 text-blue-700 dark:text-blue-400" />
          <div>
            <div className="text-sm muted">עלות אחזקת הרכב ב-{year}{year === todayISO().slice(0, 4) ? ' (עד היום)' : ''}</div>
            <div className="text-3xl font-bold tabular-nums">{formatMoney(cost.total)}</div>
            <div className="text-sm muted">ממוצע {formatMoney(cost.total / cost.months)} לחודש</div>
          </div>
        </div>
        {cost.rows.length > 0 ? (
          <div className="mt-4 space-y-5">
            <CostBreakdown cost={cost} />
            <MonthBars cost={cost} />
          </div>
        ) : <p className="mt-3 text-sm muted">אין הוצאות רשומות לשנה זו.</p>}
        <p className="mt-3 text-xs muted">
          כולל דלק, טיפולים, ביטוחים (לפי שנת תחילת הפוליסה), רישוי וטסט, כתבי שירות והוצאות נוספות. מסמכים שלא הוזנו (למשל ביטוח של שנה קודמת) לא נכללים.
        </p>
      </Card>

      {unpaid.length > 0 && (
        <Alert tone="error">
          <p className="font-semibold">{unpaid.length} דוחות לא שולמו</p>
          {unpaid.map((e) => <p key={e.id}>{e.description || 'דוח'} – {formatMoney(e.amount)}{e.dueDate ? ` · עד ${formatDate(e.dueDate)} (${relativeDays(daysUntil(e.dueDate))})` : ''}</p>)}
        </Alert>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">הוצאות נוספות</h2>
          <select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value as ExpenseCategory | '')} aria-label="סינון לפי קטגוריה">
            <option value="">כל הקטגוריות</option>
            {CATS.map((c) => <option key={c} value={c}>{EXPENSE_LABEL[c]}</option>)}
          </select>
        </div>
        {list.length === 0 ? (
          <EmptyState icon={<Receipt className="h-10 w-10" />} text={`אין הוצאות נוספות ב-${year}${cat ? ` בקטגוריה ${EXPENSE_LABEL[cat]}` : ''}.`} action={<Button onClick={() => setEditing('new')}>הוצאה חדשה</Button>} />
        ) : (
          <div className="space-y-3">
            {[...byMonth.entries()].map(([m, items]) => (
              <Card key={m} className="p-0">
                <div className="flex justify-between border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
                  <h3 className="font-semibold">{monthLabel(m)}</h3>
                  <span className="text-sm muted">{formatMoney(items.reduce((s, e) => s + e.amount, 0), true)}</span>
                </div>
                <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                  {items.map((e) => (
                    <li key={e.id} className="flex items-center gap-2 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="rounded bg-slate-200 px-1.5 text-xs dark:bg-slate-800">{EXPENSE_LABEL[e.category]}</span>
                          <span className="font-medium">{formatMoney(e.amount, true)}</span>
                          <span className="muted">{formatDate(e.date)}</span>
                          {e.category === 'fine' && <Badge severity={e.paid ? 'ok' : 'overdue'}>{e.paid ? 'שולם' : 'לא שולם'}</Badge>}
                        </div>
                        {(e.description || e.location) && <p className="text-sm muted">{[e.description, e.location].filter(Boolean).join(' · ')}</p>}
                        {e.receiptUrl && <a href={e.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline dark:text-blue-400"><ExternalLink className="h-3.5 w-3.5" /> קבלה</a>}
                      </div>
                      <IconButton label="עריכה" onClick={() => setEditing(e)}><Pencil className="h-4 w-4" /></IconButton>
                      <IconButton label="מחיקה" onClick={() => del(e)}><Trash2 className="h-4 w-4" /></IconButton>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Fab label="הוצאה" onClick={() => setEditing('new')} />
      {editing && <ExpenseForm entry={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
