const money = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });
const money2 = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatMoney = (n: number | undefined, precise = false) =>
  n == null || isNaN(n) ? '—' : (precise ? money2 : money).format(n);

export function formatNumber(n: number | undefined | null, digits = 0): string {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('he-IL', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function parseNum(s: string): number | undefined {
  const t = s.replace(/,/g, '').trim();
  if (t === '') return undefined;
  const n = Number(t);
  return isNaN(n) ? undefined : n;
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
