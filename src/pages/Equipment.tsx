import { useMemo, useState } from 'react';
import { Copy, MessageCircle, Package, Pencil, Share2, ShoppingCart, Sparkles, Trash2 } from 'lucide-react';
import { useData } from '../lib/data';
import { avgKmPerDay, estimateOdometer, severityFor } from '../lib/calc';
import { computeParts } from '../lib/parts';
import { buildShoppingList, LOCATION_LABEL, LOCATIONS, shoppingText, SUGGESTED, type ShoppingItem } from '../lib/equipment';
import { addMonths, daysUntil, formatDate, relativeDays, todayISO } from '../lib/dates';
import { parseNum } from '../lib/format';
import { useSave } from '../lib/hooks';
import type { EquipmentItem, EquipmentLocation, EquipmentStatus } from '../lib/types';
import { Alert, Badge, Button, Card, cx, EmptyState, Fab, Field, IconButton, Modal, PageHeader, useConfirm, useToast } from '../components/ui';

const STATUS_LABEL: Record<EquipmentStatus, string> = { ok: 'קיים', missing: 'חסר', replace: 'להחלפה' };

function ItemForm({ item, onClose }: { item: EquipmentItem | null; onClose: () => void }) {
  const save = useSave('equipment');
  const [f, setF] = useState({
    name: item?.name ?? '',
    location: item?.location ?? ('trunk' as EquipmentLocation),
    quantity: String(item?.quantity ?? 1),
    status: item?.status ?? ('ok' as EquipmentStatus),
    expiryDate: item?.expiryDate ?? '',
    notes: item?.notes ?? '',
  });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const qty = parseNum(f.quantity);
  const errors: string[] = [];
  if (!f.name.trim()) errors.push('יש להזין שם פריט');
  if (qty == null || qty < 0 || !Number.isInteger(qty)) errors.push('כמות חייבת להיות מספר שלם');

  const submit = async () => {
    if (errors.length) return;
    const ok = await save({
      name: f.name.trim(), location: f.location, quantity: qty, status: f.status,
      expiryDate: f.expiryDate || undefined, notes: f.notes.trim(),
    }, item?.id);
    if (ok) onClose();
  };

  return (
    <Modal open title={item ? 'עריכת פריט' : 'פריט חדש'} onClose={onClose}
      footer={<>
        <Button className="flex-1" onClick={submit} disabled={errors.length > 0}>שמירה</Button>
        <Button variant="secondary" className="flex-1" onClick={onClose}>ביטול</Button>
      </>}>
      <Field label="שם הפריט"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="ערכת עזרה ראשונה" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="מיקום ברכב">
          <select className="input" value={f.location} onChange={(e) => set('location', e.target.value)}>
            {LOCATIONS.map((l) => <option key={l} value={l}>{LOCATION_LABEL[l]}</option>)}
          </select>
        </Field>
        <Field label="כמות"><input type="number" inputMode="numeric" min={0} className="input" value={f.quantity} onChange={(e) => set('quantity', e.target.value)} /></Field>
        <Field label="מצב">
          <select className="input" value={f.status} onChange={(e) => set('status', e.target.value)}>
            {(Object.keys(STATUS_LABEL) as EquipmentStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </Field>
        <Field label="תוקף עד" hint="ריק = ללא תוקף"><input type="date" className="input" value={f.expiryDate} onChange={(e) => set('expiryDate', e.target.value)} /></Field>
      </div>
      <Field label="הערות"><input className="input" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
      {errors.length > 0 && f.name && <Alert tone="error">{errors.map((x) => <p key={x}>{x}</p>)}</Alert>}
    </Modal>
  );
}

function SuggestForm({ existing, onClose }: { existing: EquipmentItem[]; onClose: () => void }) {
  const { add } = useData();
  const toast = useToast();
  const have = new Set(existing.map((e) => e.name.trim()));
  const options = SUGGESTED.filter((s) => !have.has(s.name));
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [owned, setOwned] = useState(true);

  const submit = async () => {
    const chosen = options.filter((o) => picked.has(o.name));
    for (const o of chosen) await add('equipment', { name: o.name, location: o.location, quantity: 1, status: owned ? 'ok' : 'missing' });
    toast(`נוספו ${chosen.length} פריטים`);
    onClose();
  };

  return (
    <Modal open title="הוספת ציוד מומלץ" onClose={onClose}
      footer={<>
        <Button className="flex-1" onClick={submit} disabled={picked.size === 0}>הוספה ({picked.size})</Button>
        <Button variant="secondary" className="flex-1" onClick={onClose}>ביטול</Button>
      </>}>
      {options.length === 0 ? <p className="muted">כל הפריטים המומלצים כבר ברשימה.</p> : (
        <>
          <p className="text-sm muted">סמן את הפריטים להוספה. אפשר לשנות מיקום ותוקף אחר כך.</p>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {options.map((o) => (
              <li key={o.name}>
                <label className="flex items-center gap-3 py-2">
                  <input type="checkbox" className="h-5 w-5 accent-blue-700" checked={picked.has(o.name)}
                    onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(o.name)) n.delete(o.name); else n.add(o.name); return n; })} />
                  <span className="flex-1">{o.name}</span>
                  <span className="text-xs muted">{LOCATION_LABEL[o.location]}{o.expires ? ' · יש תוקף' : ''}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="radio" checked={owned} onChange={() => setOwned(true)} /> יש לי אותם ברכב</label>
            <label className="flex items-center gap-2"><input type="radio" checked={!owned} onChange={() => setOwned(false)} /> חסרים – להוסיף לקניות</label>
          </div>
        </>
      )}
    </Modal>
  );
}

/** "Bought it" for an equipment item: back to OK, optionally with a new expiry date */
function BoughtForm({ item, onClose }: { item: EquipmentItem; onClose: () => void }) {
  const save = useSave('equipment');
  const [expiry, setExpiry] = useState(item.expiryDate ? addMonths(todayISO(), 24) : '');
  return (
    <Modal open title={`קניתי: ${item.name}`} onClose={onClose}
      footer={<>
        <Button className="flex-1" onClick={async () => { if (await save({ status: 'ok', expiryDate: expiry || undefined }, item.id)) onClose(); }}>עדכון</Button>
        <Button variant="secondary" className="flex-1" onClick={onClose}>ביטול</Button>
      </>}>
      <Field label="תוקף הפריט החדש" hint="ריק = ללא תוקף"><input type="date" className="input" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></Field>
    </Modal>
  );
}

function ShoppingList({ items, carName, onBought }: { items: ShoppingItem[]; carName: string; onBought: (i: ShoppingItem) => void }) {
  const toast = useToast();
  const text = shoppingText(items, carName);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); toast('הרשימה הועתקה'); } catch { toast('ההעתקה נכשלה', 'error'); }
  };
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'רשימת קניות לרכב', text }); } catch { /* user cancelled */ }
    } else copy();
  };
  return (
    <Card>
      <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold"><ShoppingCart className="h-5 w-5 text-blue-700 dark:text-blue-400" />רשימת קניות ({items.length})</h2>
      {items.length === 0 ? <p className="text-sm muted">אין מה לקנות כרגע 👍</p> : (
        <>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {items.map((i) => (
              <li key={i.key} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{i.text}</span>
                  <span className="ms-2 text-xs muted">{i.reason}</span>
                </div>
                <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => onBought(i)}>{i.source === 'part' ? 'הוחלף' : 'קניתי'}</Button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={share}><Share2 className="h-4 w-4" /> שיתוף</Button>
            <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 dark:bg-emerald-500 dark:text-slate-950">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
            <Button variant="secondary" onClick={copy}><Copy className="h-4 w-4" /> העתקה</Button>
          </div>
        </>
      )}
    </Card>
  );
}

export default function EquipmentPage() {
  const data = useData();
  const { equipment, tasks, settings, maintenance, tests, fuel, parts, update, remove, set } = data;
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState<EquipmentItem | null | 'new'>(null);
  const [suggest, setSuggest] = useState(false);
  const [bought, setBought] = useState<EquipmentItem | null>(null);

  const partStatus = useMemo(() => {
    const odo = estimateOdometer(settings, fuel, maintenance, tests);
    return computeParts({ settings, maintenance, tests, fuel, parts, currentKm: odo?.km, kmPerDay: avgKmPerDay(fuel) });
  }, [settings, maintenance, tests, fuel, parts]);
  const shopping = useMemo(() => buildShoppingList(equipment, tasks, partStatus, settings.reminderDays), [equipment, tasks, partStatus, settings.reminderDays]);

  const onBought = async (i: ShoppingItem) => {
    if (i.source === 'task') { update('tasks', i.refId, { done: true }); return; }
    if (i.source === 'part') {
      const existing = parts.find((p) => p.id === 'wipers');
      const { id: _id, ...rest } = existing ?? { id: '' };
      void _id;
      await set('parts', 'wipers', { ...rest, manualDate: todayISO() });
      toast('המגבים סומנו כמוחלפים היום');
      return;
    }
    const item = equipment.find((e) => e.id === i.refId);
    if (item) setBought(item);
  };

  const del = async (e: EquipmentItem) => {
    if (await confirm({ title: 'מחיקת פריט', message: `למחוק את "${e.name}" מרשימת הציוד?` })) remove('equipment', e.id);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="ציוד ברכב" subtitle={`${equipment.length} פריטים`}
        action={<Button variant="secondary" onClick={() => setSuggest(true)}><Sparkles className="h-4 w-4" /> ציוד מומלץ</Button>} />

      <ShoppingList items={shopping} carName={settings.carName} onBought={onBought} />

      {equipment.length === 0 ? (
        <EmptyState icon={<Package className="h-10 w-10" />} text="עדיין לא נרשם ציוד. התחל מרשימת הציוד המומלץ."
          action={<Button onClick={() => setSuggest(true)}>הוספת ציוד מומלץ</Button>} />
      ) : (
        LOCATIONS.filter((l) => equipment.some((e) => e.location === l)).map((l) => (
          <section key={l}>
            <h2 className="mb-2 text-lg font-semibold">{LOCATION_LABEL[l]}</h2>
            <Card className="p-0">
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {equipment.filter((e) => e.location === l).map((e) => {
                  const d = e.expiryDate ? daysUntil(e.expiryDate) : undefined;
                  const sev = d != null ? severityFor(d, settings.reminderDays) : undefined;
                  return (
                    <li key={e.id} className="flex items-center gap-2 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cx('font-medium', e.status === 'missing' && 'muted')}>{e.name}</span>
                          {e.quantity > 1 && <span className="text-sm muted">×{e.quantity}</span>}
                          {e.status !== 'ok' && <Badge severity={e.status === 'missing' ? 'overdue' : 'urgent'}>{STATUS_LABEL[e.status]}</Badge>}
                          {sev && sev !== 'ok' && <Badge severity={sev}>{d! < 0 ? 'פג תוקף' : relativeDays(d!)}</Badge>}
                        </div>
                        {(e.expiryDate || e.notes) && <p className="text-sm muted">{[e.expiryDate && `בתוקף עד ${formatDate(e.expiryDate)}`, e.notes].filter(Boolean).join(' · ')}</p>}
                      </div>
                      <IconButton label="עריכה" onClick={() => setEditing(e)}><Pencil className="h-4 w-4" /></IconButton>
                      <IconButton label="מחיקה" onClick={() => del(e)}><Trash2 className="h-4 w-4" /></IconButton>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>
        ))
      )}

      <Fab label="פריט" onClick={() => setEditing('new')} />
      {editing && <ItemForm item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {suggest && <SuggestForm existing={equipment} onClose={() => setSuggest(false)} />}
      {bought && <BoughtForm item={bought} onClose={() => setBought(null)} />}
    </div>
  );
}
