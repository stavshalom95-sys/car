import type { FuelEntry, TestEntry } from './types';
import { daysBetween, isValidISO, todayISO } from './dates';

// ---------------------------------------------------------------------------
// Sensitive data guard: the app must never store Israeli ID numbers,
// credit card / bank account numbers, or a home address.
// ---------------------------------------------------------------------------

function isValidIsraeliId(id: string): boolean {
  if (!/^\d{9}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let n = Number(id[i]) * ((i % 2) + 1);
    if (n > 9) n -= 9;
    sum += n;
  }
  return sum % 10 === 0;
}

function luhn(num: string): boolean {
  let sum = 0;
  let dbl = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = Number(num[i]);
    if (dbl) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

const ADDRESS_WORDS = /(כתובת\s*(מגורים|בית|מלאה)?\s*[:：])|(home\s*address)/i;
const BANK_WORDS = /(מספר\s*חשבון|חשבון\s*בנק|מס['׳]?\s*חשבון|סניף\s*\d+|IBAN|IL\d{2}\s?\d{4})/i;
const ID_WORDS = /(ת[.״"']?ז|תעודת\s*זהות|מספר\s*זהות)/;

/** Returns a Hebrew description of the sensitive data found in a free-text value, or null. */
export function findSensitive(text: string): string | null {
  if (!text) return null;
  if (ID_WORDS.test(text) && /\d{5,}/.test(text)) return 'מספר תעודת זהות';
  if (BANK_WORDS.test(text)) return 'פרטי חשבון בנק';
  if (ADDRESS_WORDS.test(text)) return 'כתובת מגורים';
  // Card numbers: the classic 4-4-4-4 layout, or 13-19 digits passing the Luhn check
  if (/(?<!\d)\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{4}(?!\d)/.test(text)) return 'מספר כרטיס אשראי';
  for (const m of text.matchAll(/\b(?:\d[ -]?){13,19}\b/g)) {
    const digits = m[0].replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) return 'מספר כרטיס אשראי';
  }
  // Israeli IDs: standalone 9-digit number with a valid check digit (that is not a phone number)
  for (const m of text.matchAll(/(?<![\d-])\d{9}(?![\d-])/g)) {
    if (isValidIsraeliId(m[0]) && !/^0[2-9]/.test(m[0])) return 'מספר תעודת זהות';
  }
  return null;
}

/** Recursively scans every string in an object. Keys listed in `skipKeys` (e.g. phone numbers) are only checked for card numbers. */
export function scanObject(obj: unknown, path = ''): string | null {
  if (typeof obj === 'string') {
    if (path.endsWith('.number')) {
      // Phone fields: allow phone formats only
      const digits = obj.replace(/\D/g, '');
      if (digits.length > 12) return 'מספר שאינו טלפון';
      return null;
    }
    return findSensitive(obj);
  }
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const r = scanObject(obj[i], `${path}[${i}]`);
      if (r) return r;
    }
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      const r = scanObject(v, `${path}.${k}`);
      if (r) return r;
    }
  }
  return null;
}

export class SensitiveDataError extends Error {
  constructor(what: string) {
    super(`לא ניתן לשמור: נראה שהוזן ${what}. האפליקציה לא שומרת מידע אישי רגיש.`);
  }
}

// ---------------------------------------------------------------------------
// Fuel entry validation
// ---------------------------------------------------------------------------

/** Peugeot 3008 (2019) tank is ~53 L */
export const TANK_LITERS = 53;

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export function validateFuel(e: Partial<FuelEntry>, history: FuelEntry[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { liters, totalPrice, tripKm, date } = e;

  if (!isValidISO(date)) errors.push('תאריך לא תקין');
  else if (date > todayISO()) errors.push('התאריך בעתיד');

  if (liters == null || liters <= 0) errors.push('יש להזין כמות ליטרים חיובית');
  if (totalPrice == null || totalPrice <= 0) errors.push('יש להזין מחיר כולל חיובי');
  if (tripKm == null || tripKm < 0) errors.push('יש להזין ק״מ (מד מרחק יומי) אפס או יותר');
  if (errors.length) return { errors, warnings };

  if (liters! > TANK_LITERS + 5) warnings.push(`${liters} ליטר – יותר מקיבולת המיכל (~${TANK_LITERS} ל׳). אולי טעות הקלדה?`);
  else if (liters! < 3) warnings.push(`רק ${liters} ליטר – בטוח?`);

  const ppl = totalPrice! / liters!;
  if (ppl < 4 || ppl > 12) warnings.push(`מחיר לליטר יוצא ₪${ppl.toFixed(2)} – לא הגיוני. בדוק ליטרים/מחיר.`);

  if (tripKm! > 1300) warnings.push(`${tripKm} ק״מ בתדלוק אחד – יותר ממה שאפשר במיכל אחד. אולי הוזן מד המרחק הכולל?`);

  if (e.fullTank && tripKm! > 0) {
    const kmpl = tripKm! / liters!;
    if (kmpl < 5) warnings.push(`צריכה של ${kmpl.toFixed(1)} ק״מ/ל׳ – נמוכה באופן חריג.`);
    if (kmpl > 25) warnings.push(`צריכה של ${kmpl.toFixed(1)} ק״מ/ל׳ – גבוהה באופן חריג (אולי לא תודלק מיכל מלא בפעם הקודמת?).`);
  }
  if (tripKm === 0) warnings.push('מד המרחק היומי הוא 0 – התדלוק לא ייכלל בחישוב הצריכה.');

  const dup = history.find(
    (h) => h.id !== e.id && h.date === date && Math.abs(h.liters - liters!) < 0.01 && Math.abs(h.totalPrice - totalPrice!) < 0.01,
  );
  if (dup) warnings.push('קיים כבר תדלוק זהה באותו תאריך – ייתכן כפילות.');

  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// Test (annual inspection) duplicate safeguard
// ---------------------------------------------------------------------------

export function validateTest(e: Partial<TestEntry>, history: TestEntry[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isValidISO(e.date)) errors.push('תאריך טסט לא תקין');
  if (!isValidISO(e.validUntil)) errors.push('תאריך תוקף לא תקין');
  if (errors.length) return { errors, warnings };
  if (e.validUntil! <= e.date!) errors.push('תאריך התוקף חייב להיות אחרי תאריך הטסט');

  for (const h of history) {
    if (h.id === e.id) continue;
    if (h.date === e.date) {
      errors.push('כבר קיים טסט באותו תאריך – אין צורך להזין שוב.');
      break;
    }
    const gap = Math.abs(daysBetween(h.date, e.date!));
    // A failed test followed by a re-test is legitimate, so this is only a warning
    if (gap < 60) warnings.push(`קיים טסט נוסף רק ${gap} ימים מתאריך זה (${h.date}). האם זו כפילות?`);
  }
  return { errors, warnings };
}
