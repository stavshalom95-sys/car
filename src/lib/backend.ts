import {
  collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc, type Firestore,
} from 'firebase/firestore';
import type { BaseDoc } from './types';
import { scanObject, SensitiveDataError } from './validation';
import { uid as genId } from './format';

export type Unsubscribe = () => void;

/** Storage abstraction: Firestore (synced) or localStorage (local-only mode). */
export interface Backend {
  readonly kind: 'firestore' | 'local';
  subscribe<T extends BaseDoc>(col: string, cb: (items: T[]) => void, onError?: (e: Error) => void): Unsubscribe;
  add(col: string, data: object): Promise<string>;
  update(col: string, id: string, data: object): Promise<void>;
  remove(col: string, id: string): Promise<void>;
  subscribeDoc<T>(key: string, cb: (data: T | null) => void): Unsubscribe;
  setDoc(key: string, data: object): Promise<void>;
}

function guard(data: object) {
  const found = scanObject(data);
  if (found) throw new SensitiveDataError(found);
}

/** Removes undefined values (and keeps the stored documents clean). */
function clean<T extends object>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

export class FirestoreBackend implements Backend {
  readonly kind = 'firestore' as const;
  constructor(private db: Firestore, private userId: string) {}

  private col(name: string) {
    return collection(this.db, 'users', this.userId, name);
  }

  subscribe<T extends BaseDoc>(name: string, cb: (items: T[]) => void, onError?: (e: Error) => void) {
    return onSnapshot(
      this.col(name),
      (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as T)),
      (e) => onError?.(e),
    );
  }

  async add(name: string, data: object) {
    guard(data);
    // Don't await the server round-trip: with the offline cache the write is applied locally at once
    const ref = doc(this.col(name));
    setDoc(ref, clean({ ...data, createdAt: Date.now(), updatedAt: Date.now() })).catch(console.error);
    return ref.id;
  }

  async update(name: string, id: string, data: object) {
    guard(data);
    const { id: _ignored, ...rest } = data as BaseDoc;
    void _ignored;
    updateDoc(doc(this.col(name), id), clean({ ...rest, updatedAt: Date.now() })).catch(console.error);
  }

  async remove(name: string, id: string) {
    deleteDoc(doc(this.col(name), id)).catch(console.error);
  }

  subscribeDoc<T>(key: string, cb: (data: T | null) => void) {
    return onSnapshot(doc(this.db, 'users', this.userId, 'meta', key), (s) => cb(s.exists() ? (s.data() as T) : null));
  }

  async setDoc(key: string, data: object) {
    guard(data);
    setDoc(doc(this.db, 'users', this.userId, 'meta', key), clean(data), { merge: true }).catch(console.error);
  }
}


export class LocalBackend implements Backend {
  readonly kind = 'local' as const;
  private listeners = new Map<string, Set<() => void>>();

  constructor() {
    window.addEventListener('storage', (e) => {
      if (e.key?.startsWith('car:')) this.emit(e.key.slice(4));
    });
  }

  private read<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(`car:${key}`);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  private write(key: string, value: unknown) {
    localStorage.setItem(`car:${key}`, JSON.stringify(value));
    this.emit(key);
  }

  private emit(key: string) {
    this.listeners.get(key)?.forEach((l) => l());
  }

  private listen(key: string, fn: () => void): Unsubscribe {
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key)!.add(fn);
    fn();
    return () => this.listeners.get(key)?.delete(fn);
  }

  subscribe<T extends BaseDoc>(col: string, cb: (items: T[]) => void) {
    return this.listen(col, () => cb(this.read<T[]>(col, [])));
  }

  async add(col: string, data: object) {
    guard(data);
    const id = genId();
    const items = this.read<BaseDoc[]>(col, []);
    items.push(clean({ ...data, id, createdAt: Date.now(), updatedAt: Date.now() }));
    this.write(col, items);
    return id;
  }

  async update(col: string, id: string, data: object) {
    guard(data);
    const items = this.read<BaseDoc[]>(col, []).map((it) =>
      it.id === id ? clean({ ...it, ...data, id, updatedAt: Date.now() }) : it,
    );
    this.write(col, items);
  }

  async remove(col: string, id: string) {
    this.write(col, this.read<BaseDoc[]>(col, []).filter((it) => it.id !== id));
  }

  subscribeDoc<T>(key: string, cb: (data: T | null) => void) {
    return this.listen(`meta/${key}`, () => cb(this.read<T | null>(`meta/${key}`, null)));
  }

  async setDoc(key: string, data: object) {
    guard(data);
    this.write(`meta/${key}`, clean({ ...this.read<object>(`meta/${key}`, {}), ...data }));
  }
}
