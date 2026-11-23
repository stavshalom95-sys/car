import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { useData } from '../lib/data';
import { buildDueItems } from '../lib/calc';
import { buildCalendarEvents, CALENDAR_NAME, eventBody, staleEvents } from '../lib/calendar';
import { calendarAppEvents, calendarDelete, calendarEnsure, calendarUpsert, googleToken, SCOPES } from '../lib/google';
import { formatDate } from '../lib/dates';
import { Alert, Button, Card, useConfirm, useToast } from './ui';

export default function CalendarSync() {
  const data = useData();
  const { settings, saveSettings } = data;
  const confirm = useConfirm();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sync = async () => {
    setBusy(true); setError(null); setResult(null);
    try {
      const token = await googleToken([SCOPES.calendar]);
      const calendarId = await calendarEnsure(token, CALENDAR_NAME, settings.calendarId);
      const wanted = buildCalendarEvents(buildDueItems(data));
      let created = 0, updated = 0;
      for (const e of wanted) (await calendarUpsert(token, calendarId, eventBody(e))) === 'created' ? created++ : updated++;

      // Events from reminders that no longer exist (done/renewed): delete only after the user confirms
      const stale = staleEvents(await calendarAppEvents(token, calendarId), wanted);
      let removed = 0;
      if (stale.length) {
        const list = stale.slice(0, 8).map((e) => `• ${e.summary ?? ''}${e.start?.date ? ` (${formatDate(e.start.date)})` : ''}`).join('\n');
        const ok = await confirm({
          title: 'אירועים שכבר לא רלוונטיים',
          message: <div className="whitespace-pre-line">{`ביומן "${CALENDAR_NAME}" יש ${stale.length} אירועים שהאפליקציה יצרה בעבר ושכבר אין להם תזכורת (למשל משימה שבוצעה או ביטוח שחודש):\n${list}${stale.length > 8 ? '\n…' : ''}\n\nלמחוק אותם מהיומן? אירועים אחרים ביומן לא ייגעו.`}</div>,
          confirmText: 'מחיקה מהיומן',
        });
        if (ok) for (const e of stale) { await calendarDelete(token, calendarId, e.id); removed++; }
      }

      await saveSettings({ calendarId, calendarSyncedAt: new Date().toISOString() });
      const parts = [`${created} חדשים`, `${updated} עודכנו`];
      if (removed) parts.push(`${removed} נמחקו`);
      else if (stale.length) parts.push(`${stale.length} ישנים נשארו`);
      setResult(`היומן "${CALENDAR_NAME}" סונכרן: ${parts.join(', ')}.`);
      toast('היומן סונכרן');
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(code === 'auth/popup-closed-by-user' ? 'החיבור ל-Google בוטל.' : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-3">
      <h2 className="flex items-center gap-2 font-semibold"><CalendarDays className="h-5 w-5 text-blue-700 dark:text-blue-400" />Google Calendar</h2>
      <p className="text-sm muted">
        כל התזכורות עם תאריך (טסט, ביטוחים, טיפול, חלקים, אחריות, תוקף ציוד, דוחות ומשימות) נכנסות כאירועי יום שלם ליומן נפרד בשם "{CALENDAR_NAME}", עם התראה שבוע ויום לפני.
        סנכרון חוזר מעדכן את אותם אירועים – בלי כפילויות.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={sync} disabled={busy}>{busy ? 'מסנכרן…' : 'סנכרון ליומן'}</Button>
        {settings.calendarSyncedAt && <span className="text-xs muted">סנכרון אחרון: {formatDate(settings.calendarSyncedAt.slice(0, 10))}</span>}
      </div>
      {result && <Alert tone="info">{result}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
    </Card>
  );
}
