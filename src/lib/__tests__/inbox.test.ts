import { describe, expect, it } from 'vitest';
import { nearbySameCategory, parseInboxDoc, pendingItems, toExpense, type InboxItem } from '../inbox';
import type { Expense } from '../types';

const ok = { key: 'x', status: 'pending', category: 'parking', date: '2026-11-12', amount: 7.5, description: 'פנגו: רעננה', receiptUrl: 'https://mail.google.com/mail/#all/abc' };

describe('gmail import inbox', () => {
  it('accepts valid docs and rejects bad ones', () => {
    expect(parseInboxDoc(ok, 'imp-p-2026-11-12-0930')?.amount).toBe(7.5);
    expect(parseInboxDoc(ok, 'evil id')).toBeNull();
    expect(parseInboxDoc({ ...ok, category: 'casino' }, 'imp-x')).toBeNull();
    expect(parseInboxDoc({ ...ok, receiptUrl: 'https://phish.example.com' }, 'imp-y')).toBeNull();
    expect(parseInboxDoc({ ...ok, amount: -3 }, 'imp-z')).toBeNull();
    expect(parseInboxDoc({ ...ok, date: '2026-13-45' }, 'imp-w')).toBeNull();
    const t = parseInboxDoc({ ...ok, category: 'toll', amount: null }, 'imp-t6-254087');
    expect(t?.needsReview).toBe(true);
    // the key never leaks into the parsed item
    expect(JSON.stringify(t)).not.toContain('"key"');
  });

  it('shows only pending items that are not already expenses', () => {
    const items = [
      parseInboxDoc(ok, 'imp-a')!, parseInboxDoc({ ...ok, date: '2026-11-01' }, 'imp-b')!,
      parseInboxDoc({ ...ok, status: 'dismissed' }, 'imp-c')!, parseInboxDoc({ ...ok, status: 'imported' }, 'imp-d')!,
    ];
    expect(pendingItems(items, [{ id: 'imp-a' }]).map((i) => i.id)).toEqual(['imp-b']);
  });

  it('finds toll entries that a monthly invoice may duplicate', () => {
    const inv = parseInboxDoc({ ...ok, category: 'toll', date: '2026-11-20' }, 'imp-t6-1') as InboxItem;
    const ex: Expense[] = [
      { id: '1', date: '2026-11-09', category: 'toll', amount: 15.33 },
      { id: '2', date: '2026-08-01', category: 'toll', amount: 15 },
      { id: '3', date: '2026-11-10', category: 'parking', amount: 5 },
    ];
    expect(nearbySameCategory(inv, ex).map((e) => e.id)).toEqual(['1']);
    expect(toExpense(inv, 15.33).notes).toContain('Gmail');
  });
});
