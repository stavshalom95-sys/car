import { useState } from 'react';
import { ExternalLink, FileText, Pencil, Phone as PhoneIcon, Plus, ShieldAlert, Trash2, X } from 'lucide-react';
import { useData } from '../lib/data';
import { severityFor } from '../lib/calc';
import { daysUntil, formatDate, relativeDays, todayISO } from '../lib/dates';
import { formatMoney, parseNum } from '../lib/format';
import { useSave } from '../lib/hooks';
import type { CarDocument, DocType, Phone } from '../lib/types';
import { Alert, Badge, Button, Card, EmptyState, Fab, Field, IconButton, Modal, PageHeader, SEVERITY_BORDER, cx, useConfirm } from '../components/ui';
import DriveUpload from '../components/DriveUpload';
import { docUploadKind } from '../lib/upload';

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  vehicle_license: 'רישיון רכב',
  driver_license: 'רישיון נהיגה',
  compulsory_insurance: 'ביטוח חובה',
  comprehensive_insurance: 'ביטוח מקיף',
  other: 'אחר',
};

const DOC_ORDER: DocType[] = ['vehicle_license', 'driver_license', 'compulsory_insurance', 'comprehensive_insurance', 'other'];

function DocForm({ doc, onClose }: { doc: CarDocument | null; onClose: () => void }) {
  const save = useSave('documents');
  const [f, setF] = useState({
    type: doc?.type ?? ('compulsory_insurance' as DocType),
    title: doc?.title ?? '',
    provider: doc?.provider ?? '',
    expiryDate: doc?.expiryDate ?? '',
    cost: doc?.cost != null ? String(doc.cost) : '',
    fileUrl: doc?.fileUrl ?? '',
    notes: doc?.notes ?? '',
  });
  const [phones, setPhones] = useState<Phone[]>(doc?.phones?.length ? doc.phones : [{ label: '', number: '' }]);
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const errors: string[] = [];
  if (f.fileUrl && !/^https?:\/\//.test(f.fileUrl)) errors.push('קישור לקובץ חייב להתחיל ב-https://');
  for (const p of phones) if (p.number && !/^[\d\s\-+*()]{3,15}$/.test(p.number)) errors.push(`מספר טלפון לא תקין: ${p.number}`);

  const submit = async () => {
    if (errors.length) return;
    const ok = await save({
      type: f.type, title: f.title.trim() || DOC_TYPE_LABEL[f.type], provider: f.provider.trim(),
      expiryDate: f.expiryDate || undefined, cost: parseNum(f.cost), fileUrl: f.fileUrl.trim() || undefined, notes: f.notes.trim(),
      phones: phones.map((p) => ({ label: p.label.trim(), number: p.number.trim() })).filter((p) => p.number),
    }, doc?.id);
    if (ok) onClose();
  };

  return (
    <Modal open title={doc ? 'עריכת מסמך' : 'מסמך חדש'} onClose={onClose}
      footer={<>
        <Button className="flex-1" onClick={submit} disabled={errors.length > 0}>שמירה</Button>
        <Button variant="secondary" className="flex-1" onClick={onClose}>ביטול</Button>
      </>}>
      <Alert tone="info">
        <p className="flex items-center gap-1"><ShieldAlert className="h-4 w-4" /> אין לשמור כאן מספר תעודת זהות, מספר רישיון נהיגה אישי, פרטי אשראי/בנק או כתובת מגורים.</p>
      </Alert>
      <div className="grid grid-cols-2 gap-3">
        <Field label="סוג מסמך">
          <select className="input" value={f.type} onChange={(e) => set('type', e.target.value)}>
            {DOC_ORDER.map((t) => <option key={t} value={t}>{DOC_TYPE_LABEL[t]}</option>)}
          </select>
        </Field>
        <Field label="שם (אופציונלי)"><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder={DOC_TYPE_LABEL[f.type]} /></Field>
        <Field label="חברה / גוף מנפיק"><input className="input" value={f.provider} onChange={(e) => set('provider', e.target.value)} placeholder="הראל, מגדל, משרד התחבורה…" /></Field>
        <Field label="תוקף עד"><input type="date" className="input" value={f.expiryDate} onChange={(e) => set('expiryDate', e.target.value)} /></Field>
        <Field label="עלות (₪)" className="col-span-2"><input type="number" inputMode="decimal" className="input" value={f.cost} onChange={(e) => set('cost', e.target.value)} /></Field>
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">טלפונים חשובים</span>
        <div className="space-y-2">
          {phones.map((p, i) => (
            <div key={i} className="flex gap-2">
              <input className="input flex-1" value={p.label} placeholder="מוקד / סוכן / גרירה" aria-label="תיאור הטלפון"
                onChange={(e) => setPhones((ps) => ps.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <input type="tel" className="input flex-1" value={p.number} placeholder="*5678" aria-label="מספר טלפון"
                onChange={(e) => setPhones((ps) => ps.map((x, j) => (j === i ? { ...x, number: e.target.value } : x)))} />
              <IconButton label="הסרת טלפון" onClick={() => setPhones((ps) => ps.filter((_, j) => j !== i))}><X className="h-4 w-4" /></IconButton>
            </div>
          ))}
        </div>
        <button onClick={() => setPhones((ps) => [...ps, { label: '', number: '' }])} className="mt-2 inline-flex items-center gap-1 text-sm text-blue-700 hover:underline dark:text-blue-400">
          <Plus className="h-4 w-4" /> טלפון נוסף
        </button>
      </div>

      <Field label="קישור לקובץ" hint="קישור ל-Google Drive, או העלאה ישירה לתיקיית הרכב">
        <div className="flex gap-2">
          <input type="url" className="input" value={f.fileUrl} onChange={(e) => set('fileUrl', e.target.value)} placeholder="https://drive.google.com/…" />
          <DriveUpload kind={docUploadKind(f.type)} date={todayISO()} label={f.title.trim() || DOC_TYPE_LABEL[f.type]} onUploaded={(u) => set('fileUrl', u)} />
        </div>
      </Field>
      <Field label="הערות"><textarea rows={2} className="input" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
      {errors.length > 0 && <Alert tone="error">{errors.map((x) => <p key={x}>{x}</p>)}</Alert>}
    </Modal>
  );
}

export default function DocumentsPage() {
  const { documents, settings, remove } = useData();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<CarDocument | null | 'new'>(null);
  const sorted = [...documents].sort((a, b) => DOC_ORDER.indexOf(a.type) - DOC_ORDER.indexOf(b.type) || (a.expiryDate ?? '').localeCompare(b.expiryDate ?? ''));
  const missing = DOC_ORDER.filter((t) => t !== 'other' && !documents.some((d) => d.type === t));

  const del = async (d: CarDocument) => {
    if (await confirm({ title: 'מחיקת מסמך', message: `למחוק את "${d.title}"? הקובץ ב-Drive לא יימחק.` })) remove('documents', d.id);
  };

  return (
    <div>
      <PageHeader title="מסמכים" />
      {missing.length > 0 && documents.length > 0 && (
        <p className="mb-3 text-sm muted">חסרים: {missing.map((t) => DOC_TYPE_LABEL[t]).join(', ')}</p>
      )}
      {documents.length === 0 ? (
        <EmptyState icon={<FileText className="h-10 w-10" />} text="הוסף רישיון רכב, רישיון נהיגה וביטוחים כדי לקבל תזכורות חידוש." action={<Button onClick={() => setEditing('new')}>מסמך חדש</Button>} />
      ) : (
        <div className="space-y-3">
          {sorted.map((d) => {
            const days = d.expiryDate ? daysUntil(d.expiryDate) : undefined;
            const sev = days != null ? severityFor(days, settings.reminderDays) : 'missing';
            return (
              <Card key={d.id} className={cx(d.expiryDate && SEVERITY_BORDER[sev])}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{d.title}</h3>
                      {days != null && <Badge severity={sev}>{relativeDays(days)}</Badge>}
                    </div>
                    <p className="text-sm muted">
                      {DOC_TYPE_LABEL[d.type]}{d.provider ? ` · ${d.provider}` : ''}{d.expiryDate ? ` · תוקף עד ${formatDate(d.expiryDate)}` : ''}{d.cost ? ` · ${formatMoney(d.cost)}` : ''}
                    </p>
                    {d.phones.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {d.phones.map((p, i) => (
                          <a key={i} href={`tel:${p.number.replace(/[^\d+*#]/g, '')}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-sm text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300">
                            <PhoneIcon className="h-3.5 w-3.5" /> {p.label ? `${p.label}: ` : ''}<span dir="ltr">{p.number}</span>
                          </a>
                        ))}
                      </div>
                    )}
                    {d.notes && <p className="mt-1 text-sm muted">{d.notes}</p>}
                    {d.fileUrl && (
                      <a href={d.fileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-blue-700 hover:underline dark:text-blue-400">
                        <ExternalLink className="h-4 w-4" /> פתיחת הקובץ
                      </a>
                    )}
                  </div>
                  <IconButton label="עריכה" onClick={() => setEditing(d)}><Pencil className="h-4 w-4" /></IconButton>
                  <IconButton label="מחיקה" onClick={() => del(d)}><Trash2 className="h-4 w-4" /></IconButton>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <Fab label="מסמך" onClick={() => setEditing('new')} />
      {editing && <DocForm doc={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
