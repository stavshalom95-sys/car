import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Gauge, ShoppingCart, Siren, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { useData } from '../lib/data';
import { annualCost, buildDueItems, estimateOdometer, latestAnomaly, type DueItem } from '../lib/calc';
import { formatMoney } from '../lib/format';
import { formatDate, relativeDays } from '../lib/dates';
import { formatNumber } from '../lib/format';
import { Alert, Badge, Button, Card, cx, IconButton, SEVERITY_BORDER, useConfirm, useToast } from '../components/ui';
import type { Task, TaskList } from '../lib/types';

const SEV_LABEL = { overdue: 'באיחור', urgent: 'דחוף', soon: 'בקרוב', ok: 'בסדר', missing: 'חסר מידע' } as const;

function DueRow({ item }: { item: DueItem }) {
  return (
    <Link to={item.link} className={cx('card flex items-center gap-3 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60', SEVERITY_BORDER[item.severity])}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{item.title}</span>
          <Badge severity={item.severity}>{item.daysLeft != null ? relativeDays(item.daysLeft) : SEV_LABEL[item.severity]}</Badge>
        </div>
        <p className="mt-0.5 text-sm muted">{item.detail}</p>
      </div>
      <ChevronLeft className="h-5 w-5 shrink-0 text-slate-400" />
    </Link>
  );
}

function TaskSection({ list, title, icon, placeholder }: { list: TaskList; title: string; icon: React.ReactNode; placeholder: string }) {
  const { tasks, add, update, remove } = useData();
  const confirm = useConfirm();
  const toast = useToast();
  const [text, setText] = useState('');
  const [due, setDue] = useState('');
  const items = tasks.filter((t) => t.list === list);
  const open = items.filter((t) => !t.done);
  const done = items.filter((t) => t.done);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await add('tasks', { text: text.trim(), list, done: false, ...(due ? { dueDate: due } : {}) });
      setText('');
      setDue('');
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };

  const del = async (t: Task) => {
    if (await confirm({ title: 'מחיקת פריט', message: `למחוק את "${t.text}"?` })) remove('tasks', t.id);
  };

  const clearDone = async () => {
    if (await confirm({ title: 'ניקוי פריטים שבוצעו', message: `למחוק ${done.length} פריטים שסומנו כבוצעו?` }))
      done.forEach((t) => remove('tasks', t.id));
  };

  const Row = (t: Task) => (
    <li key={t.id} className="flex items-center gap-3 py-2">
      <input type="checkbox" checked={t.done} onChange={() => update('tasks', t.id, { done: !t.done })}
        className="h-5 w-5 shrink-0 accent-blue-700 dark:accent-blue-400" aria-label={`סימון ${t.text}`} />
      <span className={cx('flex-1', t.done && 'line-through muted')}>
        {t.text}
        {t.dueDate && <span className="ms-2 text-xs muted">עד {formatDate(t.dueDate)}</span>}
      </span>
      <IconButton label="מחיקה" onClick={() => del(t)}><Trash2 className="h-4 w-4" /></IconButton>
    </li>
  );

  return (
    <Card>
      <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">{icon}{title}</h2>
      <form onSubmit={submit} className="flex flex-wrap gap-2">
        <input className="input min-w-0 flex-[3]" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
        {list === 'urgent' && <input type="date" className="input w-auto flex-1" value={due} onChange={(e) => setDue(e.target.value)} aria-label="תאריך יעד" />}
        <Button type="submit" disabled={!text.trim()}>הוספה</Button>
      </form>
      {open.length === 0 && done.length === 0 ? (
        <p className="mt-3 text-sm muted">אין פריטים ברשימה.</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-200 dark:divide-slate-800">
          {open.map(Row)}
          {done.map(Row)}
        </ul>
      )}
      {list === 'someday' && (
        <Link to="/equipment" className="mt-2 me-4 inline-block text-sm text-blue-700 hover:underline dark:text-blue-400">לרשימת הקניות המלאה ולשיתוף ←</Link>
      )}
      {done.length > 0 && (
        <button onClick={clearDone} className="mt-2 text-sm text-blue-700 hover:underline dark:text-blue-400">ניקוי פריטים שבוצעו ({done.length})</button>
      )}
    </Card>
  );
}

export default function Dashboard() {
  const data = useData();
  const { settings, fuel, maintenance, tests } = data;
  const items = useMemo(() => buildDueItems(data), [data]);
  const odo = useMemo(() => estimateOdometer(settings, fuel, maintenance, tests), [settings, fuel, maintenance, tests]);
  const anomaly = useMemo(() => latestAnomaly(fuel), [fuel]);
  const ytd = useMemo(() => annualCost(new Date().getFullYear().toString(), data), [data]);

  const urgent = items.filter((i) => i.severity === 'overdue' || i.severity === 'urgent');
  const later = items.filter((i) => i.severity === 'soon' || i.severity === 'missing');
  const ok = items.filter((i) => i.severity === 'ok');

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Card className="flex items-center gap-3">
          <Gauge className="h-8 w-8 text-blue-700 dark:text-blue-400" />
          <div>
            <div className="text-xs muted">ק״מ משוער</div>
            <div className="text-xl font-bold">{odo ? formatNumber(odo.km) : '—'}</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <Siren className={cx('h-8 w-8', urgent.length ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')} />
          <div>
            <div className="text-xs muted">פריטים דחופים</div>
            <div className="text-xl font-bold">{urgent.length}</div>
          </div>
        </Card>
      </div>
      <Link to="/expenses" className="card flex items-center justify-between py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60">
        <span className="text-sm muted">עלות הרכב השנה עד כה</span>
        <span className="flex items-center gap-1 text-lg font-bold tabular-nums">{formatMoney(ytd.total)} <ChevronLeft className="h-5 w-5 text-slate-400" /></span>
      </Link>
      {!odo && (
        <Alert tone="info">
          כדי להעריך קילומטראז׳, הזן קריאת מד אוץ ידועה ב<Link to="/settings" className="font-medium underline">הגדרות</Link> או ק״מ בטיפול האחרון.
        </Alert>
      )}

      {anomaly && (
        <Link to="/fuel" className="block">
          <Alert tone="warning">
            <p className="flex items-center gap-1 font-semibold">
              {anomaly.deviation < 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
              שינוי חריג בצריכת הדלק
            </p>
            <p>
              בתדלוק האחרון ({formatDate(anomaly.date)}): {formatNumber(anomaly.kmpl, 1)} ק״מ/ל׳ לעומת ממוצע של {formatNumber(anomaly.baseline, 1)} –{' '}
              {anomaly.deviation < 0 ? 'ירידה' : 'עלייה'} של {Math.round(Math.abs(anomaly.deviation) * 100)}%.
              {anomaly.deviation < 0 && ' כדאי לבדוק לחץ אוויר בצמיגים או לשקול טיפול.'}
            </p>
          </Alert>
        </Link>
      )}

      <section className="space-y-2">
        <h2 className="text-xl font-bold">מה דחוף</h2>
        {urgent.length ? urgent.map((i) => <DueRow key={i.id} item={i} />) : (
          <Card className="text-emerald-700 dark:text-emerald-400">אין משהו דחוף כרגע 👍</Card>
        )}
      </section>

      {later.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">בקרוב / חסר מידע</h2>
          {later.map((i) => <DueRow key={i.id} item={i} />)}
        </section>
      )}

      <TaskSection list="urgent" title="משימות דחופות" icon={<Siren className="h-5 w-5 text-red-600 dark:text-red-400" />} placeholder="למשל: להחליף נורת בלם" />
      <TaskSection list="someday" title="לקנות כשיש זמן" icon={<ShoppingCart className="h-5 w-5 text-blue-700 dark:text-blue-400" />} placeholder="למשל: מטהר אוויר, מטען לרכב" />

      {ok.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">בתוקף</h2>
          {ok.map((i) => <DueRow key={i.id} item={i} />)}
        </section>
      )}
    </div>
  );
}
