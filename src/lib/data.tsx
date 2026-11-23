import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  CarDocument, ChecklistItem, CollectionName, EquipmentItem, Expense, FuelEntry, MaintenanceEntry, PartInfo, Settings, Task, TestEntry,
} from './types';
import { FirestoreBackend, LocalBackend, type Backend } from './backend';
import { firestore } from './firebase';
import type { AppUser } from './auth';
import { uid } from './format';

const checklist = (texts: string[]): ChecklistItem[] => texts.map((text) => ({ id: uid(), text, done: false }));

export const DEFAULT_CHECKLIST = [
  'תשלום אגרת רישוי שנתית',
  'ביטוח חובה בתוקף',
  'רישיון רכב ותעודה מזהה (להביא, לא לשמור באפליקציה)',
  'פנסים: ראשיים, גבוהים, בלמים, איתות, רוורס, ערפל, לוחית רישוי',
  'צמיגים: עומק חריץ ולחץ אוויר, כולל גלגל רזרבי',
  'מגבים תקינים ומיכל נוזל לשמשה מלא',
  'שמשות ללא סדקים בשדה הראייה',
  'נורות אזהרה בלוח השעונים כבויות',
  'צופר וחגורות בטיחות תקינים',
  'מפלסי שמן מנוע, נוזל קירור ונוזל בלמים',
  'משולש אזהרה ואפוד זוהר ברכב',
  'בלם יד אוחז',
];

export const DEFAULT_SETTINGS: Settings = {
  carName: 'פיג׳ו 3008 (2019)',
  serviceIntervalKm: 15000,
  serviceIntervalMonths: 12,
  reminderDays: 30,
  testChecklist: [],
};

interface DataState {
  ready: boolean;
  backend: Backend;
  settings: Settings;
  fuel: FuelEntry[];
  maintenance: MaintenanceEntry[];
  tests: TestEntry[];
  documents: CarDocument[];
  tasks: Task[];
  parts: PartInfo[];
  expenses: Expense[];
  equipment: EquipmentItem[];
  add: (col: CollectionName, data: object) => Promise<string>;
  update: (col: CollectionName, id: string, data: object) => Promise<void>;
  /** Callers MUST ask the user for confirmation before calling this. */
  remove: (col: CollectionName, id: string) => Promise<void>;
  /** Replace a document with a known id (used for parts, keyed by slot) */
  set: (col: CollectionName, id: string, data: object) => Promise<void>;
  saveSettings: (s: Partial<Settings>) => Promise<void>;
  lastError: string | null;
}

const Ctx = createContext<DataState | null>(null);

const byDateDesc = <T extends { date: string }>(xs: T[]) => [...xs].sort((a, b) => b.date.localeCompare(a.date) || 0);

export function DataProvider({ user, children }: { user: AppUser; children: ReactNode }) {
  const backend = useMemo<Backend>(
    () => (user.local || !firestore ? new LocalBackend() : new FirestoreBackend(firestore, user.uid)),
    [user],
  );
  const [settings, setSettings] = useState<Settings | null>(null);
  const [fuel, setFuel] = useState<FuelEntry[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceEntry[]>([]);
  const [tests, setTests] = useState<TestEntry[]>([]);
  const [documents, setDocuments] = useState<CarDocument[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [parts, setParts] = useState<PartInfo[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [loaded, setLoaded] = useState<Set<string>>(new Set());
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    const mark = (k: string) => setLoaded((s) => (s.has(k) ? s : new Set(s).add(k)));
    const onErr = (e: Error) => {
      console.error(e);
      setLastError('שגיאה בסנכרון הנתונים. בדוק חיבור או הרשאות.');
    };
    const unsubs = [
      backend.subscribe<FuelEntry>('fuel', (x) => { setFuel(byDateDesc(x)); mark('fuel'); }, onErr),
      backend.subscribe<MaintenanceEntry>('maintenance', (x) => { setMaintenance(byDateDesc(x)); mark('maintenance'); }, onErr),
      backend.subscribe<TestEntry>('tests', (x) => { setTests(byDateDesc(x)); mark('tests'); }, onErr),
      backend.subscribe<CarDocument>('documents', (x) => { setDocuments(x); mark('documents'); }, onErr),
      backend.subscribe<Task>('tasks', (x) => { setTasks(x.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))); mark('tasks'); }, onErr),
      backend.subscribe<EquipmentItem>('equipment', (x) => { setEquipment(x.sort((a, b) => a.name.localeCompare(b.name, 'he'))); mark('equipment'); }, onErr),
      backend.subscribe<Expense>('expenses', (x) => { setExpenses(byDateDesc(x)); mark('expenses'); }, onErr),
      backend.subscribe<PartInfo>('parts', (x) => { setParts(x); mark('parts'); }, onErr),
      backend.subscribeDoc<Partial<Settings>>('settings', (s) => {
        const merged = { ...DEFAULT_SETTINGS, ...(s ?? {}) };
        // Seed the pre-test checklist the first time
        if (!s?.testChecklist) merged.testChecklist = checklist(DEFAULT_CHECKLIST);
        setSettings(merged);
        mark('settings');
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [backend]);

  const value: DataState = {
    ready: loaded.size >= 9 && !!settings,
    backend,
    settings: settings ?? DEFAULT_SETTINGS,
    fuel, maintenance, tests, documents, tasks, parts, expenses, equipment,
    add: (c, d) => backend.add(c, d),
    update: (c, id, d) => backend.update(c, id, d),
    remove: (c, id) => backend.remove(c, id),
    set: (c, id, d) => backend.set(c, id, d),
    saveSettings: (s) => backend.setDoc('settings', { ...(settings ?? DEFAULT_SETTINGS), ...s }),
    lastError,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useData outside DataProvider');
  return c;
}
