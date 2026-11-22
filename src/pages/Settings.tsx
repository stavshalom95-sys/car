import { useState } from 'react';
import { Download, LogOut } from 'lucide-react';
import { useData } from '../lib/data';
import { useAuth } from '../lib/auth';
import { useTheme, type ThemePref } from '../lib/hooks';
import { parseNum } from '../lib/format';
import { todayISO } from '../lib/dates';
import { Alert, Button, Card, Field, PageHeader, useToast } from '../components/ui';

export default function SettingsPage() {
  const data = useData();
  const { settings, saveSettings } = data;
  const { user, signOut } = useAuth();
  const [theme, setTheme] = useTheme();
  const toast = useToast();
  const [f, setF] = useState({
    carName: settings.carName,
    plate: settings.plate ?? '',
    baseOdometer: settings.baseOdometer != null ? String(settings.baseOdometer) : '',
    baseOdometerDate: settings.baseOdometerDate ?? todayISO(),
    serviceIntervalKm: String(settings.serviceIntervalKm),
    serviceIntervalMonths: String(settings.serviceIntervalMonths),
    reminderDays: String(settings.reminderDays),
  });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  const save = async () => {
    try {
      await saveSettings({
        carName: f.carName.trim() || 'הרכב שלי',
        plate: f.plate.trim() || undefined,
        baseOdometer: parseNum(f.baseOdometer),
        baseOdometerDate: f.baseOdometer ? f.baseOdometerDate : undefined,
        serviceIntervalKm: parseNum(f.serviceIntervalKm) || 15000,
        serviceIntervalMonths: parseNum(f.serviceIntervalMonths) || 12,
        reminderDays: parseNum(f.reminderDays) || 30,
      });
      toast('ההגדרות נשמרו');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const exportJson = () => {
    const { settings, fuel, maintenance, tests, documents, tasks } = data;
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), settings, fuel, maintenance, tests, documents, tasks }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `car-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="הגדרות" />

      <Card className="space-y-3">
        <h2 className="font-semibold">פרטי הרכב</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="שם הרכב"><input className="input" value={f.carName} onChange={(e) => set('carName', e.target.value)} /></Field>
          <Field label="מספר רישוי (אופציונלי)"><input className="input" value={f.plate} onChange={(e) => set('plate', e.target.value)} /></Field>
          <Field label="קריאת מד אוץ ידועה (ק״מ)" hint="נקודת התחלה להערכת הקילומטראז׳">
            <input type="number" inputMode="numeric" className="input" value={f.baseOdometer} onChange={(e) => set('baseOdometer', e.target.value)} />
          </Field>
          <Field label="נכון לתאריך"><input type="date" className="input" value={f.baseOdometerDate} onChange={(e) => set('baseOdometerDate', e.target.value)} /></Field>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">טיפולים ותזכורות</h2>
        <div className="grid grid-cols-3 gap-3">
          <Field label="טיפול כל (ק״מ)"><input type="number" className="input" value={f.serviceIntervalKm} onChange={(e) => set('serviceIntervalKm', e.target.value)} /></Field>
          <Field label="או כל (חודשים)"><input type="number" className="input" value={f.serviceIntervalMonths} onChange={(e) => set('serviceIntervalMonths', e.target.value)} /></Field>
          <Field label="דחוף כש-X ימים"><input type="number" className="input" value={f.reminderDays} onChange={(e) => set('reminderDays', e.target.value)} /></Field>
        </div>
        <p className="text-xs muted">ברירת מחדל לפיג׳ו 3008 1.2 PureTech: כל 15,000 ק״מ או שנה – המוקדם מביניהם. בדוק בספר הרכב.</p>
      </Card>

      <Button className="w-full" onClick={save}>שמירת הגדרות</Button>

      <Card className="space-y-3">
        <h2 className="font-semibold">תצוגה</h2>
        <Field label="ערכת נושא">
          <select className="input" value={theme} onChange={(e) => setTheme(e.target.value as ThemePref)}>
            <option value="system">לפי הגדרות המכשיר</option>
            <option value="light">בהיר</option>
            <option value="dark">כהה</option>
          </select>
        </Field>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">חשבון וגיבוי</h2>
        <p className="text-sm muted">
          {user?.local ? 'מצב מקומי – הנתונים לא מסונכרנים בין מכשירים.' : `מחובר כ-${user?.name}. הנתונים מסונכרנים בין כל המכשירים שלך.`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportJson}><Download className="h-4 w-4" /> ייצוא גיבוי (JSON)</Button>
          <Button variant="secondary" onClick={signOut}><LogOut className="h-4 w-4" /> התנתקות</Button>
        </div>
      </Card>

      <Alert tone="info">
        האפליקציה חוסמת שמירה של מספרי תעודת זהות, כרטיסי אשראי, פרטי חשבון בנק וכתובת מגורים.
      </Alert>
    </div>
  );
}
