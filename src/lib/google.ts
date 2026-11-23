import { GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth';
import { auth } from './firebase';

/** Google API access for the signed-in user (Drive now; Calendar later). Tokens live ~1h and only in this tab's sessionStorage. */
export const SCOPES = {
  drive: 'https://www.googleapis.com/auth/drive',
  calendar: 'https://www.googleapis.com/auth/calendar',
} as const;

const KEY = 'car-google-token';
interface Cached { token: string; exp: number; scopes: string[] }

const read = (): Cached | null => {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? 'null'); } catch { return null; }
};

export const googleAvailable = () => !!auth?.currentUser;

/** A cached token that covers the scopes, without opening a popup */
export function cachedToken(scopes: string[]): string | null {
  const c = read();
  return c && c.exp > Date.now() && scopes.every((s) => c.scopes.includes(s)) ? c.token : null;
}

/** Get an access token, asking the user (popup) if needed. Must be called from a click handler. */
export async function googleToken(scopes: string[]): Promise<string> {
  const hit = cachedToken(scopes);
  if (hit) return hit;
  const user = auth?.currentUser;
  if (!user) throw new Error('יש להתחבר עם חשבון Google');
  const prev = read();
  const all = [...new Set([...(prev?.scopes ?? []), ...scopes])];
  const provider = new GoogleAuthProvider();
  all.forEach((s) => provider.addScope(s));
  provider.setCustomParameters({ login_hint: user.email ?? '', include_granted_scopes: 'true' });
  const res = await reauthenticateWithPopup(user, provider);
  const token = GoogleAuthProvider.credentialFromResult(res)?.accessToken;
  if (!token) throw new Error('לא התקבלה הרשאה מ-Google');
  sessionStorage.setItem(KEY, JSON.stringify({ token, exp: Date.now() + 55 * 60_000, scopes: all } satisfies Cached));
  return token;
}

export function forgetGoogleToken() {
  sessionStorage.removeItem(KEY);
}

async function api<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) } });
  if (r.status === 401) { forgetGoogleToken(); throw new Error('ההרשאה ל-Google פגה – התחבר שוב'); }
  if (!r.ok) throw new Error(`Google API ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (r.status === 204 ? undefined : r.json()) as T;
}

// ---------------------------------------------------------------------------
// Drive
// ---------------------------------------------------------------------------

const DRIVE = 'https://www.googleapis.com/drive/v3';
export interface DriveFile { id: string; name: string; mimeType: string; modifiedTime?: string; webViewLink?: string }
const FOLDER = 'application/vnd.google-apps.folder';
const q = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export async function driveList(token: string, parentId: string, extra = ''): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({
      q: `'${q(parentId)}' in parents and trashed = false${extra ? ` and ${extra}` : ''}`,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, webViewLink)',
      pageSize: '200', orderBy: 'modifiedTime desc',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const r = await api<{ files: DriveFile[]; nextPageToken?: string }>(token, `${DRIVE}/files?${params}`);
    out.push(...r.files);
    pageToken = r.nextPageToken ?? '';
  } while (pageToken);
  return out;
}

export async function driveFindFolder(token: string, parentId: string, name: string): Promise<DriveFile | undefined> {
  return (await driveList(token, parentId, `mimeType = '${FOLDER}' and name = '${q(name)}'`))[0];
}

export async function driveEnsureFolder(token: string, parentId: string, name: string): Promise<DriveFile> {
  const found = await driveFindFolder(token, parentId, name);
  if (found) return found;
  return api<DriveFile>(token, `${DRIVE}/files?fields=id,name,mimeType,webViewLink`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER, parents: [parentId] }),
  });
}

export async function driveReadText(token: string, fileId: string): Promise<string> {
  const r = await fetch(`${DRIVE}/files/${encodeURIComponent(fileId)}?alt=media`, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 401) { forgetGoogleToken(); throw new Error('ההרשאה ל-Google פגה – התחבר שוב'); }
  if (!r.ok) throw new Error(`Google Drive ${r.status}`);
  return r.text();
}

/** Upload a file (multipart) into a folder. Returns the created file with its view link. */
export async function driveUpload(token: string, parentId: string, file: Blob, name: string): Promise<DriveFile> {
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify({ name, parents: [parentId] })], { type: 'application/json' }));
  form.append('file', file);
  return api<DriveFile>(token, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink', {
    method: 'POST', body: form,
  });
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

const CAL = 'https://www.googleapis.com/calendar/v3';
export interface CalendarEvent { id: string; status?: string; summary?: string; start?: { date?: string } }

/** Find the dedicated calendar by name, or create it */
export async function calendarEnsure(token: string, name: string, knownId?: string): Promise<string> {
  if (knownId) {
    const r = await fetch(`${CAL}/calendars/${encodeURIComponent(knownId)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) return knownId;
  }
  let pageToken = '';
  do {
    const r = await api<{ items: { id: string; summary: string; accessRole: string }[]; nextPageToken?: string }>(
      token, `${CAL}/users/me/calendarList?minAccessRole=owner${pageToken ? `&pageToken=${pageToken}` : ''}`);
    const hit = r.items.find((c) => c.summary === name);
    if (hit) return hit.id;
    pageToken = r.nextPageToken ?? '';
  } while (pageToken);
  const created = await api<{ id: string }>(token, `${CAL}/calendars`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary: name, timeZone: 'Asia/Jerusalem', description: 'תזכורות מאפליקציית הרכב' }),
  });
  return created.id;
}

/** Events this app created in the calendar (tagged with a private property) */
export async function calendarAppEvents(token: string, calendarId: string): Promise<CalendarEvent[]> {
  const out: CalendarEvent[] = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({ privateExtendedProperty: 'carApp=1', showDeleted: 'false', maxResults: '2500' });
    if (pageToken) params.set('pageToken', pageToken);
    const r = await api<{ items: CalendarEvent[]; nextPageToken?: string }>(token, `${CAL}/calendars/${encodeURIComponent(calendarId)}/events?${params}`);
    out.push(...r.items);
    pageToken = r.nextPageToken ?? '';
  } while (pageToken);
  return out;
}

/** Create or update an event with a known id. Returns 'created' | 'updated'. */
export async function calendarUpsert(token: string, calendarId: string, body: { id: string }): Promise<'created' | 'updated'> {
  const base = `${CAL}/calendars/${encodeURIComponent(calendarId)}/events`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const put = await fetch(`${base}/${body.id}`, { method: 'PUT', headers, body: JSON.stringify(body) });
  if (put.ok) return 'updated';
  if (put.status === 401) { forgetGoogleToken(); throw new Error('ההרשאה ל-Google פגה – התחבר שוב'); }
  if (put.status !== 404) throw new Error(`Google Calendar ${put.status}: ${(await put.text()).slice(0, 200)}`);
  await api(token, base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return 'created';
}

export async function calendarDelete(token: string, calendarId: string, eventId: string): Promise<void> {
  const r = await fetch(`${CAL}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok && r.status !== 410 && r.status !== 404) throw new Error(`Google Calendar ${r.status}`);
}
