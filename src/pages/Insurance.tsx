import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ExternalLink, FilePlus2, Pencil, ShieldCheck, Trash2 } from 'lucide-react';
import { useData } from '../lib/data';
import {
  COVER_LABEL, COVERS, compareQuotes, currentPolicy, currentTotal, INSURERS, isFreshQuote, renewal,
  type Cover, type CurrentPolicy, type QuoteComparison,
} from '../lib/insurance';
import { addDays, addMonths, daysUntil, formatDate, isValidISO, relativeDays, todayISO } from '../lib/dates';
import { formatMoney, parseNum } from '../lib/format';
import { useSave } from '../lib/hooks';
import type { InsuranceQuote } from '../lib/types';
import { Alert, Badge, Button, Card, cx, EmptyState, Fab, Field, IconButton, Modal, PageHeader, useConfirm, useToast } from '../components/ui';

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

function Savings({ c, currentTotalValue }: { c: QuoteComparison; currentTotalValue?: number }) {
  if (c.savings == null) return <span className="text-sm muted">אין מחיר נוכחי להשוואה</span>;
  if (Math.abs(c.savings) < 1) return <span className="text-sm font-medium">אותו מחיר כמו היום</span>;
  const cheaper = c.savings > 0;
  return (
    <span className={cx('text-sm font-semibold', cheaper ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400')}>
      {cheaper ? 'חיסכון של ' : 'יקר יותר ב-'}{formatMoney(Math.abs(c.savings))}
      {currentTotalValue ? ` (${pct(Math.abs(c.savings), currentTotalValue)}%)` : ''} בשנה
    </span>
  );
}

function QuoteForm({ quote, onClose }: { quote: InsuranceQuote | null; onClose: () => void }) {
  const save = useSave('quotes');
  const s = (n?: number) => (n == null ? '' : String(n));
  const [f, setF] = useState({
    insurer: quote?.insurer ?? '', date: quote?.date ?? todayISO(),
    comprehensive: s(quote?.comprehensive), compulsory: s(quote?.compulsory),
    deductible: s(quote?.deductible), deductibleNetwork: s(quote?.deductibleNetwork),
    thirdPartyDeductible: s(quote?.thirdPartyDeductible), thirdPartyLimit: s(quote?.thirdPartyLimit),
    validUntil: quote?.validUntil ?? '', agent: quote?.agent ?? '', url: quote?.url ?? '', notes: quote?.notes ?? '',
  });
  const [flags, setFlags] = useState({ towing: !!quote?.towing, glass: !!quote?.glass, replacementCar: !!quote?.replacementCar });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const n = (k: keyof typeof f) => parseNum(f[k]);

  const errors: string[] = [];
  if (!f.insurer.trim()) errors.push('יש להזין את שם חברת הביטוח');
  if (!isValidISO(f.date)) errors.push('תאריך קבלת ההצעה לא תקין');
  if (n('comprehensive') == null && n('compulsory') == null) errors.push('יש להזין מחיר שנתי למקיף, לחובה או לשניהם');
  for (const [k, label] of [['comprehensive', 'מחיר מקיף'], ['compulsory', 'מחיר חובה']] as const) {
    const v = n(k);
    if (f[k].trim() && (v == null || v <= 0 || v > 50000)) errors.push(`${label}: יש להזין סכום שנתי בין 1 ל-50,000 ₪`);
  }
  for (const k of ['deductible', 'deductibleNetwork', 'thirdPartyDeductible', 'thirdPartyLimit'] as const) {
    const v = n(k);
    if (f[k].trim() && (v == null || v < 0)) errors.push('השתתפות עצמית וגבול אחריות חייבים להיות מספר חיובי');
  }
  if (f.url.trim() && !/^https?:\/\//.test(f.url.trim())) errors.push('קישור חייב להתחיל ב-https://');
  const uniqErrors = [...new Set(errors)];

  const submit = async () => {
    if (uniqErrors.length) return;
    const ok = await save({
      insurer: f.insurer.trim(), date: f.date,
      comprehensive: n('comprehensive'), compulsory: n('compulsory'),
      deductible: n('deductible'), deductibleNetwork: n('deductibleNetwork'),
      thirdPartyDeductible: n('thirdPartyDeductible'), thirdPartyLimit: n('thirdPartyLimit'),
      ...flags, validUntil: f.validUntil || undefined, agent: f.agent.trim() || undefined,
      url: f.url.trim() || undefined, notes: f.notes.trim() || undefined,
    }, quote?.id);
    if (ok) onClose();
  };

  const money = (k: keyof typeof f, label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <input type="number" inputMode="decimal" min={0} className="input" value={f[k]} onChange={(e) => set(k, e.target.value)} />
    </Field>
  );

  return (
    <Modal open title={quote ? 'עריכת הצעה' : 'הצעת ביטוח חדשה'} onClose={onClose}
      footer={<>
        <Button className="flex-1" onClick={submit} disabled={uniqErrors.length > 0}>שמירה</Button>
        <Button variant="secondary" className="flex-1" onClick={onClose}>ביטול</Button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="חברת ביטוח">
          <input className="input" list="insurers" value={f.insurer} onChange={(e) => set('insurer', e.target.value)} placeholder="הראל" />
          <datalist id="insurers">{INSURERS.map((i) => <option key={i} value={i} />)}</datalist>
        </Field>
        <Field label="התקבלה בתאריך"><input type="date" className="input" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
        {money('comprehensive', 'מקיף – מחיר שנתי ₪', 'ריק = לא כלול בהצעה')}
        {money('compulsory', 'חובה – מחיר שנתי ₪', 'ריק = לא כלול בהצעה')}
        {money('deductible', 'השתתפות עצמית – מוסך רגיל')}
        {money('deductibleNetwork', 'השתתפות עצמית – מוסך הסדר')}
        {money('thirdPartyDeductible', 'השתתפות עצמית – צד ג׳')}
        {money('thirdPartyLimit', 'גבול אחריות צד ג׳ ₪')}
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">כלול בהצעה</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          {([['towing', 'גרירה'], ['glass', 'שמשות'], ['replacementCar', 'רכב חלופי']] as const).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2">
              <input type="checkbox" className="h-5 w-5 accent-blue-700" checked={flags[k]} onChange={(e) => setFlags((x) => ({ ...x, [k]: e.target.checked }))} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Field label="המחיר בתוקף עד" hint="לא חובה"><input type="date" className="input" value={f.validUntil} onChange={(e) => set('validUntil', e.target.value)} /></Field>
        <Field label="סוכן / ערוץ" hint="לא חובה"><input className="input" value={f.agent} onChange={(e) => set('agent', e.target.value)} placeholder="אתר / סוכן" /></Field>
      </div>
      <Field label="קישור להצעה (Drive)" hint="לא חובה"><input className="input" dir="ltr" value={f.url} onChange={(e) => set('url', e.target.value)} placeholder="https://drive.google.com/..." /></Field>
      <Field label="הערות"><input className="input" value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="נהג צעיר, החרגות, תנאים..." /></Field>
      {uniqErrors.length > 0 && f.insurer && <Alert tone="error">{uniqErrors.map((x) => <p key={x}>{x}</p>)}</Alert>}
    </Modal>
  );
}

/** After choosing a quote and signing: create the new policy documents (the old ones are kept as history) */
function AdoptForm({ c, cur, onClose }: { c: QuoteComparison; cur: CurrentPolicy; onClose: () => void }) {
  const { add } = useData();
  const toast = useToast();
  const q = c.quote;
  const covers = COVERS.filter((k) => q[k] != null);
  const ren = renewal(cur);
  const [start, setStart] = useState(ren ? addDays(ren.date, 1) : todayISO());
  const end = isValidISO(start) ? addDays(addMonths(start, 12), -1) : '';
  const terms = [
    q.deductible != null && `השתתפות עצמית: ${formatMoney(q.deductible)} במוסך רגיל`,
    q.deductibleNetwork != null && `${formatMoney(q.deductibleNetwork)} במוסך הסדר`,
    (q.thirdPartyDeductible != null || q.thirdPartyLimit != null) && `צד ג׳: ${[q.thirdPartyLimit != null && `גבול אחריות ${formatMoney(q.thirdPartyLimit)}`, q.thirdPartyDeductible != null && `השתתפות עצמית ${formatMoney(q.thirdPartyDeductible)}`].filter(Boolean).join(', ')}`,
  ].filter(Boolean).join(' · ');

  const submit = async () => {
    if (!end) return;
    try {
      for (const k of covers) {
        await add('documents', {
          type: k === 'comprehensive' ? 'comprehensive_insurance' : 'compulsory_insurance',
          title: `ביטוח ${COVER_LABEL[k]} ${start.slice(0, 4)}`,
          provider: q.insurer, cost: q[k], expiryDate: end, phones: [], fileUrl: q.url,
          notes: [`תקופה: ${formatDate(start)}–${formatDate(end)}`, k === 'comprehensive' ? terms : '', q.agent && `סוכן/ערוץ: ${q.agent}`].filter(Boolean).join(' · '),
        });
      }
      toast(`נוספו ${covers.length} מסמכי ביטוח`);
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <Modal open title={`מעבר ל${q.insurer}`} onClose={onClose}
      footer={<>
        <Button className="flex-1" onClick={submit} disabled={!end}>יצירת מסמכים</Button>
        <Button variant="secondary" className="flex-1" onClick={onClose}>ביטול</Button>
      </>}>
      <p className="text-sm">ייווצרו מסמכי ביטוח {covers.map((k) => COVER_LABEL[k]).join(' ו')} חדשים, כדי שהתזכורות והעלות השנתית יתעדכנו. המסמכים הקיימים נשארים כהיסטוריה – שום דבר לא נמחק.</p>
      <Field label="תחילת הפוליסה החדשה" hint={end ? `בתוקף עד ${formatDate(end)}` : undefined}>
        <input type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
      </Field>
      {c.fromCurrent.length > 0 && <Alert tone="info">ביטוח {c.fromCurrent.map((k) => COVER_LABEL[k]).join(' ו')} לא כלול בהצעה – זכור לחדש אותו בנפרד.</Alert>}
    </Modal>
  );
}

function CurrentCard({ cur, total }: { cur: CurrentPolicy; total?: number }) {
  const ren = renewal(cur);
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="h-5 w-5 text-blue-700 dark:text-blue-400" />הביטוח הנוכחי</h2>
        {ren && <Badge severity={ren.days < 0 ? 'overdue' : ren.days <= 30 ? 'urgent' : ren.days <= 60 ? 'soon' : 'ok'}>{ren.days < 0 ? 'פג תוקף' : `מתחדש ${relativeDays(ren.days)}`}</Badge>}
      </div>
      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {COVERS.map((k) => {
          const c = cur[k];
          return (
            <li key={k} className="py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{COVER_LABEL[k]}{c?.doc.provider ? ` · ${c.doc.provider}` : ''}</span>
                <span className="tabular-nums font-semibold">{c ? formatMoney(c.cost) : '—'}</span>
              </div>
              {c ? (
                <p className="text-sm muted">{c.doc.expiryDate ? `בתוקף עד ${formatDate(c.doc.expiryDate)}` : 'ללא תאריך תפוגה'}{c.cost == null ? ' · לא הוזן מחיר' : ''}</p>
              ) : <p className="text-sm muted">לא הוזן מסמך</p>}
              {k === 'comprehensive' && c?.doc.notes && <p className="mt-1 text-xs muted">{c.doc.notes}</p>}
            </li>
          );
        })}
      </ul>
      <div className="mt-2 flex items-baseline justify-between border-t border-slate-200 pt-2 dark:border-slate-700">
        <span className="font-semibold">סה״כ בשנה</span>
        <span className="text-lg font-bold tabular-nums">{formatMoney(total)}</span>
      </div>
      {ren && ren.days > 60 && <p className="mt-1 text-xs muted">כדאי להתחיל לאסוף הצעות מ-{formatDate(ren.windowStart)} (חודשיים לפני החידוש).</p>}
      <Link to="/documents" className="mt-2 inline-block text-sm text-blue-700 hover:underline dark:text-blue-400">עריכה במסמכים ←</Link>
    </Card>
  );
}

/** Annual total per option, current policy first; single-hue bars, the current one in neutral gray */
function CompareBars({ rows, current }: { rows: QuoteComparison[]; current?: number }) {
  const all = [
    ...(current != null ? [{ key: 'current', label: 'הביטוח הנוכחי', value: current, isCurrent: true, note: '' }] : []),
    ...rows.map((c) => ({ key: c.quote.id, label: c.quote.insurer, value: c.total, isCurrent: false, note: c.fromCurrent.length ? `כולל ${c.fromCurrent.map((k) => COVER_LABEL[k]).join(' ו')} במחיר הנוכחי` : '' })),
  ];
  const max = Math.max(...all.map((r) => r.value), 1);
  return (
    <ul className="space-y-2.5" aria-label="מחיר שנתי לפי הצעה">
      {all.map((r) => (
        <li key={r.key} title={`${r.label}: ${formatMoney(r.value)}${r.note ? ` · ${r.note}` : ''}`} className="rounded-lg px-1 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800/60">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className={cx('font-medium', r.isCurrent ? 'text-slate-600 dark:text-slate-400' : 'text-slate-900 dark:text-slate-100')}>{r.label}{r.note && <span className="ms-1 text-xs muted">*</span>}</span>
            <span className="tabular-nums text-slate-700 dark:text-slate-300">{formatMoney(r.value)}</span>
          </div>
          <div className="mt-1 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800">
            <div className={cx('h-full rounded-full', r.isCurrent ? 'bg-slate-400 dark:bg-slate-500' : 'bg-[#1d4ed8] dark:bg-[#3b82f6]')} style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
      {all.some((r) => r.note) && <li className="text-xs muted">* הצעה לכיסוי אחד בלבד – הכיסוי החסר מחושב לפי המחיר הנוכחי, כדי שההשוואה תהיה הוגנת.</li>}
    </ul>
  );
}

function QuoteCard({ c, best, currentTotalValue, onEdit, onDelete, onChoose, onAdopt }: {
  c: QuoteComparison; best: boolean; currentTotalValue?: number;
  onEdit: () => void; onDelete: () => void; onChoose: () => void; onAdopt: () => void;
}) {
  const q = c.quote;
  const expired = q.validUntil ? daysUntil(q.validUntil) < 0 : false;
  const extras = [q.towing && 'גרירה', q.glass && 'שמשות', q.replacementCar && 'רכב חלופי'].filter(Boolean) as string[];
  const terms: [string, number | undefined][] = [
    ['השתתפות – מוסך רגיל', q.deductible], ['השתתפות – מוסך הסדר', q.deductibleNetwork],
    ['השתתפות – צד ג׳', q.thirdPartyDeductible], ['גבול אחריות צד ג׳', q.thirdPartyLimit],
  ];
  return (
    <Card className={cx(q.chosen && 'ring-2 ring-blue-600 dark:ring-blue-400')}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{q.insurer}</h3>
            {q.chosen && <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-900 dark:bg-blue-950 dark:text-blue-200"><CheckCircle2 className="h-3.5 w-3.5" />נבחרה</span>}
            {best && !q.chosen && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800 dark:bg-slate-800 dark:text-slate-200">הזולה ביותר</span>}
            {expired && <Badge severity="overdue">פג תוקף ההצעה</Badge>}
          </div>
          <p className="text-sm muted">התקבלה {formatDate(q.date)}{q.validUntil && !expired ? ` · בתוקף עד ${formatDate(q.validUntil)}` : ''}{q.agent ? ` · ${q.agent}` : ''}</p>
        </div>
        <IconButton label="עריכה" onClick={onEdit}><Pencil className="h-4 w-4" /></IconButton>
        <IconButton label="מחיקה" onClick={onDelete}><Trash2 className="h-4 w-4" /></IconButton>
      </div>

      <ul className="mt-2 space-y-1 text-sm">
        {COVERS.map((k: Cover) => {
          const own = q[k];
          const diff = c.savingsByCover[k];
          if (own == null && !c.fromCurrent.includes(k)) return null;
          return (
            <li key={k} className="flex items-baseline justify-between gap-2">
              <span>{COVER_LABEL[k]}</span>
              {own != null ? (
                <span className="tabular-nums">
                  {formatMoney(own)}
                  {diff != null && Math.abs(diff) >= 1 && <span className="ms-2 text-xs muted">({diff > 0 ? '−' : '+'}{formatMoney(Math.abs(diff))} מהיום)</span>}
                </span>
              ) : <span className="text-xs muted">לא כלול · {formatMoney(c.prices[k])} לפי המחיר הנוכחי</span>}
            </li>
          );
        })}
        <li className="flex items-baseline justify-between gap-2 border-t border-slate-200 pt-1 font-semibold dark:border-slate-700">
          <span>סה״כ בשנה</span><span className="tabular-nums">{formatMoney(c.total)}</span>
        </li>
      </ul>
      <div className="mt-1"><Savings c={c} currentTotalValue={currentTotalValue} /></div>

      {(terms.some(([, v]) => v != null) || extras.length > 0) && (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-800/60">
          {terms.filter(([, v]) => v != null).map(([label, v]) => (
            <div key={label} className="flex justify-between gap-2"><dt className="muted">{label}</dt><dd className="tabular-nums">{formatMoney(v)}</dd></div>
          ))}
          {extras.length > 0 && <div className="col-span-2"><dt className="inline muted">כולל: </dt><dd className="inline">{extras.join(', ')}</dd></div>}
        </dl>
      )}
      {q.notes && <p className="mt-2 text-sm muted">{q.notes}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant={q.chosen ? 'secondary' : 'primary'} onClick={onChoose}>{q.chosen ? 'ביטול הבחירה' : 'בחירת ההצעה'}</Button>
        {q.chosen && <Button variant="secondary" onClick={onAdopt}><FilePlus2 className="h-4 w-4" /> חתמתי – עדכון מסמכים</Button>}
        {q.url && (
          <a href={q.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-2 text-sm text-blue-700 hover:underline dark:text-blue-400">
            <ExternalLink className="h-4 w-4" /> ההצעה
          </a>
        )}
      </div>
    </Card>
  );
}

export default function InsurancePage() {
  const { documents, quotes, update, remove } = useData();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<InsuranceQuote | null | 'new'>(null);
  const [adopt, setAdopt] = useState<QuoteComparison | null>(null);
  const [showOld, setShowOld] = useState(false);

  const cur = useMemo(() => currentPolicy(documents), [documents]);
  const total = currentTotal(cur);
  const ren = renewal(cur);
  // Quotes for the coming renewal; older ones (from previous years) are hidden by default
  const periodStart = ren?.periodStart ?? '0000-00-00';
  const fresh = quotes.filter((q) => isFreshQuote(q, periodStart));
  const old = quotes.filter((q) => !isFreshQuote(q, periodStart));
  const rows = useMemo(() => compareQuotes(showOld ? quotes : fresh, cur), [showOld, quotes, fresh, cur]);
  const bestId = rows.find((r) => !(r.quote.validUntil && daysUntil(r.quote.validUntil) < 0))?.quote.id;
  const bestSaving = rows.reduce<number | undefined>((m, r) => (r.savings != null && r.savings > (m ?? 0) ? r.savings : m), undefined);

  const choose = (q: InsuranceQuote) => {
    if (q.chosen) { update('quotes', q.id, { chosen: false }); return; }
    for (const o of quotes) if (o.chosen && o.id !== q.id) update('quotes', o.id, { chosen: false });
    update('quotes', q.id, { chosen: true });
  };
  const del = async (q: InsuranceQuote) => {
    if (await confirm({ title: 'מחיקת הצעה', message: `למחוק את ההצעה של ${q.insurer} מ-${formatDate(q.date)}?` })) remove('quotes', q.id);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="השוואת ביטוחים" subtitle={fresh.length ? `${fresh.length} הצעות לחידוש הקרוב` : 'הוסף הצעות כדי להשוות'} />

      <div className="grid gap-4 lg:grid-cols-2">
        <CurrentCard cur={cur} total={total} />
        <Card>
          <h2 className="mb-1 text-lg font-semibold">מחיר שנתי</h2>
          {rows.length === 0 ? <p className="text-sm muted">עוד אין הצעות. כשתוסיף הצעה, תופיע כאן השוואה מול הביטוח הנוכחי.</p> : (
            <>
              <p className="mb-3 text-sm">
                {bestSaving != null
                  ? <>החיסכון הגדול ביותר: <span className="font-semibold text-emerald-700 dark:text-emerald-400">{formatMoney(bestSaving)} בשנה</span></>
                  : <span className="muted">אף הצעה לא זולה מהביטוח הנוכחי.</span>}
              </p>
              <CompareBars rows={rows} current={total} />
            </>
          )}
        </Card>
      </div>

      {total == null && <Alert>לא הוזן מחיר לביטוח הנוכחי – הוסף את הסכום במסמכי הביטוח כדי לחשב חיסכון.</Alert>}
      <p className="text-xs muted">ההשוואה לפי מחיר בלבד. לפני מעבר, השווה גם השתתפות עצמית, גבולות אחריות, נהגים מורשים ושירותים נלווים.</p>

      {rows.length === 0 && quotes.length === 0 ? (
        <EmptyState icon={<ShieldCheck className="h-10 w-10" />} text="קיבלת הצעת מחיר לביטוח? הוסף אותה כדי לראות כמה אפשר לחסוך."
          action={<Button onClick={() => setEditing('new')}>הוספת הצעה</Button>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((c) => (
            <QuoteCard key={c.quote.id} c={c} best={c.quote.id === bestId && rows.length > 1} currentTotalValue={total}
              onEdit={() => setEditing(c.quote)} onDelete={() => del(c.quote)} onChoose={() => choose(c.quote)} onAdopt={() => setAdopt(c)} />
          ))}
        </div>
      )}
      {old.length > 0 && (
        <button className="text-sm text-blue-700 hover:underline dark:text-blue-400" onClick={() => setShowOld((x) => !x)}>
          {showOld ? 'הסתרת הצעות מחידושים קודמים' : `הצגת ${old.length} הצעות מחידושים קודמים`}
        </button>
      )}

      <Fab label="הצעה" onClick={() => setEditing('new')} />
      {editing && <QuoteForm quote={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {adopt && <AdoptForm c={adopt} cur={cur} onClose={() => setAdopt(null)} />}
    </div>
  );
}
