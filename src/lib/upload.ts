import type { DocType } from './types';

/** Where uploads go inside the car's Drive folder (existing folder names are reused) */
export type UploadKind = 'maintenance' | 'insurance' | 'vehicle_license' | 'test' | 'documents' | 'expenses';

export const UPLOAD_FOLDER: Record<UploadKind, string> = {
  maintenance: 'טיפולים',
  insurance: 'ביטוחים',
  vehicle_license: 'רישיון רכב',
  test: 'בדיקה טסט',
  documents: 'מסמכים',
  expenses: 'הוצאות',
};

export const MAX_UPLOAD_MB = 25;
export const ACCEPT = 'image/*,application/pdf';

/** "2026-11-23 – טיפול 60,000.pdf": date first so files sort by time; characters Drive/OSes dislike are removed */
export function uploadName(date: string | undefined, label: string, original: string): string {
  const ext = (original.match(/\.([a-z0-9]{1,5})$/i)?.[1] ?? '').toLowerCase();
  const clean = label.replace(/[\/:*?"<>|#%\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'קובץ';
  return `${date ? `${date} – ` : ''}${clean}${ext ? `.${ext}` : ''}`;
}

export function docUploadKind(t: DocType): UploadKind {
  if (t === 'compulsory_insurance' || t === 'comprehensive_insurance') return 'insurance';
  if (t === 'vehicle_license') return 'vehicle_license';
  return 'documents';
}
