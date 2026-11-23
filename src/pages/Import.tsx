import { useState } from 'react';
import { CheckCheck, ExternalLink, Inbox } from 'lucide-react';
import { useData } from '../lib/data';
import { useAuth } from '../lib/auth';
import { EXPENSE_LABEL } from '../lib/calc';
import { nearbySameCategory, pendingItems, toExpense, type InboxItem } from '../lib/inbox';
import { formatDate } from '../lib/dates';
import { formatMoney, parseNum } from '../lib/format';
import { Alert, Button, Card, EmptyState, Field, PageHeader, useToast } from '../components/ui';

function ItemCard({ item, onAdd, onSkip }: { item: InboxItem; onAdd: (amount: number) => Promise<void>; onSkip: () => void }) {
  const { expenses } = useData();
  const [amount, setAmount] = useState(item.amount != null ? String(item.amount) : '');
  const [busy, setBusy] = useState(false);
  const n = parseNum(amount);
  const valid = n != null && n > 0 && n < 100000;
  const nearby = item.category === 'toll' ? nearbySameCategory(item, expenses) : [];
  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <span className="text-xs font-medium muted">{EXPENSE_LABEL[item.category]} · {formatDate(item.date)}</span>
          <p className="font-semibold">{item.description}</p>
          {item.location && <p className="text-sm muted">{item.location}</p>}
        </div>
        {item.amount != null && <span className="text-lg font-bold tabular-nums">{formatMoney(item.amount, true)}</span>}
      </div>
      {item.notes && <p className="mt-1 text-sm muted">{item.notes}</p>}
      {item.needsReview && <div className="mt-2"><Alert>{item.reviewReason || 'יש לבדוק את הפריט לפני ההוספה.'}</Alert></div>}
      {nearby.length > 0 && (
        <div className="mt-2"><Alert tone="info">
          כבר רשומות {nearby.length} הוצאות כביש 6 ב-40 הימים שלפני ({formatMoney(nearby.reduce((s, e) => s + e.amount, 0), true)}). אם החשבונית מכסה את אותן נסיעות – דלג עליה כדי לא לספור פעמיים.
        </Alert></div>
      )}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        {item.needsReview && (
          <Field label="סכום ₪" className="w-32">
            <input type="number" inputMode="decimal" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
        )}
        <Button disabled={!valid || busy} onClick={async () => { setBusy(true); try { await onAdd(n!); } finally { setBusy(false); } }}>הוספה להוצאות</Button>
        <Button variant="secondary" onClick={onSkip}>דילוג</Button>
        {item.receiptUrl && (
          <a href={item.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-2 text-sm text-blue-700 hover:underline dark:text-blue-400">
            <ExternalLink className="h-4 w-4" /> המייל
          </a>
        )}
      </div>
    </Card>
  );
}

export default function ImportPage() {
  const { user } = useAuth();
  const { expenses, inbox, set, setInboxStatus } = useData();
  const toast = useToast();
  const pending = pendingItems(inbox, expenses);
  const ready = pending.filter((i) => !i.needsReview && i.amount != null);
  const done = inbox.filter((i) => i.status !== 'pending').length;

  const add = async (i: InboxItem, amount: number) => {
    try {
      // Known id → the same receipt can never be added twice
      await set('expenses', i.id, toExpense(i, amount));
      await setInboxStatus(i.id, 'imported');
      toast('נוסף להוצאות');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const addAll = async () => {
    for (const i of ready) await add(i, i.amount!);
  };

  if (user?.local) return <div><PageHeader title="ייבוא מ-Gmail" /><Alert tone="info">הייבוא זמין רק כשמחוברים עם חשבון Google.</Alert></div>;

  return (
    <div className="space-y-4">
      <PageHeader title="ייבוא מ-Gmail" subtitle="קבלות שהשגרה החודשית מצאה – שום דבר לא נכנס להוצאות בלי אישורך" />
      {pending.length === 0 ? (
        <EmptyState icon={<Inbox className="h-10 w-10" />} text="אין קבלות חדשות לאישור. השגרה בודקת את Gmail בתחילת כל חודש (חניות פנגו לרכב שלך וחשבוניות כביש 6)." />
      ) : (
        <>
          {ready.length > 1 && <Button onClick={addAll}><CheckCheck className="h-4 w-4" /> הוספת {ready.length} הפריטים שלא דורשים בדיקה</Button>}
          {pending.map((i) => <ItemCard key={i.id} item={i} onAdd={(a) => add(i, a)} onSkip={() => setInboxStatus(i.id, 'dismissed')} />)}
        </>
      )}
      {done > 0 && <p className="text-xs muted">{done} פריטים כבר טופלו (נוספו או דולגו) ולא יוצגו שוב.</p>}
    </div>
  );
}
