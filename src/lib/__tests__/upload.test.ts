import { describe, expect, it } from 'vitest';
import { docUploadKind, UPLOAD_FOLDER, uploadName } from '../upload';

describe('drive upload naming', () => {
  it('puts the date first and keeps the extension', () => {
    expect(uploadName('2026-11-23', 'טיפול 60,000', 'IMG_1234.JPG')).toBe('2026-11-23 – טיפול 60,000.jpg');
  });
  it('strips characters that break file names', () => {
    expect(uploadName(undefined, 'a/b:c*?"<>|#%d', 'x.pdf')).toBe('a b c d.pdf');
    expect(uploadName('2026-01-01', '   ', 'scan')).toBe('2026-01-01 – קובץ');
  });
  it('reuses the existing folders in the car Drive folder', () => {
    expect(UPLOAD_FOLDER[docUploadKind('comprehensive_insurance')]).toBe('ביטוחים');
    expect(UPLOAD_FOLDER[docUploadKind('vehicle_license')]).toBe('רישיון רכב');
    expect(UPLOAD_FOLDER[docUploadKind('driver_license')]).toBe('מסמכים');
    expect(UPLOAD_FOLDER.maintenance).toBe('טיפולים');
  });
});
