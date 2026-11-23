import { describe, expect, it } from 'vitest';
import { buildCalendarEvents, eventBody, eventIdFor, staleEvents } from '../calendar';
import type { DueItem } from '../calc';

const item = (id: string, dueDate?: string): DueItem => ({ id, title: `t-${id}`, detail: 'd', dueDate, severity: 'soon', link: '/test' });

describe('calendar sync', () => {
  it('makes stable, valid Google event ids', () => {
    const a = eventIdFor('test');
    expect(a).toBe(eventIdFor('test'));
    expect(a).not.toBe(eventIdFor('doc-x'));
    expect(a).toMatch(/^[a-v0-9]{5,1024}$/);
  });

  it('only future-dated items become all-day events', () => {
    const ev = buildCalendarEvents([item('a', '2026-12-01'), item('b', '2026-11-01'), item('c')], '2026-11-23');
    expect(ev.map((e) => e.sourceId)).toEqual(['a']);
    const body = eventBody(ev[0]);
    expect(body.start).toEqual({ date: '2026-12-01' });
    expect(body.end).toEqual({ date: '2026-12-02' });
    expect(body.extendedProperties.private.carApp).toBe('1');
    expect(ev[0].description).toContain('#/test');
  });

  it('flags only app events that no longer have a reminder', () => {
    const wanted = buildCalendarEvents([item('a', '2026-12-01')], '2026-11-23');
    const existing = [{ id: wanted[0].id }, { id: 'carold' }, { id: 'cargone', status: 'cancelled' }];
    expect(staleEvents(existing, wanted).map((e) => e.id)).toEqual(['carold']);
  });
});
