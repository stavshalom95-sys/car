import { useRef, useState } from 'react';
import { CloudUpload } from 'lucide-react';
import { useData } from '../lib/data';
import { useAuth } from '../lib/auth';
import { cachedToken, driveEnsureFolder, driveUpload, googleToken, SCOPES } from '../lib/google';
import { ACCEPT, MAX_UPLOAD_MB, UPLOAD_FOLDER, uploadName, type UploadKind } from '../lib/upload';
import { useToast } from './ui';

/**
 * "Upload to Drive" next to a link field: uploads a photo/PDF into the car folder's subfolder
 * and hands back the Drive link. Two clicks the first time in a session (connect, then pick a file),
 * because browsers only open the Google popup and the file picker from a direct click.
 */
export default function DriveUpload({ kind, date, label, onUploaded }: {
  kind: UploadKind; date?: string; label: string; onUploaded: (url: string) => void;
}) {
  const { user } = useAuth();
  const { settings } = useData();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(() => !!cachedToken([SCOPES.drive]));

  if (user?.local || !settings.driveFolderId) return null;

  const connect = async () => {
    try { await googleToken([SCOPES.drive]); setConnected(true); } catch (e) {
      if ((e as { code?: string }).code !== 'auth/popup-closed-by-user') toast((e as Error).message, 'error');
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) { toast(`הקובץ גדול מ-${MAX_UPLOAD_MB}MB`, 'error'); return; }
    setBusy(true);
    try {
      const token = await googleToken([SCOPES.drive]);
      const folder = await driveEnsureFolder(token, settings.driveFolderId!, UPLOAD_FOLDER[kind]);
      const up = await driveUpload(token, folder.id, file, uploadName(date, label, file.name));
      onUploaded(up.webViewLink ?? `https://drive.google.com/file/d/${up.id}/view`);
      toast(`הועלה ל-Drive › ${UPLOAD_FOLDER[kind]}`);
    } catch (e) {
      toast((e as Error).message, 'error');
      if (!cachedToken([SCOPES.drive])) setConnected(false);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const cls = 'inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:border-slate-700 dark:text-blue-400 dark:hover:bg-slate-800';
  return (
    <>
      <input ref={input} type="file" accept={ACCEPT} className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      {connected ? (
        <button type="button" className={cls} disabled={busy} onClick={() => input.current?.click()}>
          <CloudUpload className="h-4 w-4" /> {busy ? 'מעלה…' : 'העלאה ל-Drive'}
        </button>
      ) : (
        <button type="button" className={cls} onClick={connect}><CloudUpload className="h-4 w-4" /> חיבור ל-Drive</button>
      )}
    </>
  );
}
