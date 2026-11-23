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
