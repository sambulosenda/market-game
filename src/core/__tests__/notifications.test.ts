import { describe, expect, it } from 'vitest';

import { outsideQuietHours, planNotifications } from '../notifications';
import { startBatch } from '../production';
import { createInitialState } from '../state';
import type { GameState } from '../types';
import { HOUR, MIN, T0, testContent } from './fixtures';

const rules = testContent.economy.notifications;
const DAY = 24 * HOUR;
/** Midnight UTC at the start of T0's day. T0 itself is 09:00. */
const MIDNIGHT = T0 - 9 * HOUR;
const at = (hour: number, minute = 0) => MIDNIGHT + hour * HOUR + minute * MIN;

function bakingUntil(start: number, ...recipes: string[]): GameState {
  let s: GameState = { ...createInitialState(testContent, start, 1), pantry: { butter: 4 } };
  for (const recipe of recipes) {
    const result = startBatch(s, testContent, 'bakery', recipe, start);
    if (!result.ok) throw new Error(result.reason);
    s = result.state;
  }
  return s;
}

describe('quiet hours', () => {
  it('leave daytime alone and move the night to 9 in the morning', () => {
    expect(outsideQuietHours(at(9), 0, rules)).toBe(at(9));
    expect(outsideQuietHours(at(20, 59), 0, rules)).toBe(at(20, 59));
    expect(outsideQuietHours(at(21), 0, rules)).toBe(at(9) + DAY);
    expect(outsideQuietHours(at(23, 30), 0, rules)).toBe(at(9) + DAY);
    expect(outsideQuietHours(at(3), 0, rules)).toBe(at(9));
    expect(outsideQuietHours(at(8, 59), 0, rules)).toBe(at(9));
  });

  it('follow the local clock, not UTC', () => {
    // 14:00 UTC is 23:00 in Tokyo (offset -540): quiet. The next 09:00 there is 00:00 UTC.
    expect(outsideQuietHours(at(14), -540, rules)).toBe(at(24));
    // 02:00 UTC is 21:00 the evening before in New York (offset 300): quiet until 09:00 there, 14:00 UTC.
    expect(outsideQuietHours(at(2), 300, rules)).toBe(at(14));
    // 14:00 UTC is 09:00 in New York: fine.
    expect(outsideQuietHours(at(14), 300, rules)).toBe(at(14));
  });

  it('handle quiet hours that do not cross midnight', () => {
    const siesta = { ...rules, quietStartHour: 13, quietEndHour: 15 };
    expect(outsideQuietHours(at(12), 0, siesta)).toBe(at(12));
    expect(outsideQuietHours(at(14), 0, siesta)).toBe(at(15));
  });
});

describe('planning notifications', () => {
  it('tells the player when everything is ready, and about tomorrow', () => {
    // A croissant (5 minutes) then a loaf (1 minute), started at 10:00.
    const s = bakingUntil(at(10), 'croissant', 'loaf');
    expect(planNotifications(s, testContent, at(10), 0)).toEqual([
      { kind: 'goods_ready', at: at(10, 6) },
      { kind: 'daily_goals', at: at(9) + DAY },
    ]);
  });

  it('says nothing about goods when nothing is being made or it is already done', () => {
    const idle = createInitialState(testContent, at(10), 1);
    expect(planNotifications(idle, testContent, at(10), 0)).toEqual([{ kind: 'daily_goals', at: at(9) + DAY }]);
    const done = bakingUntil(at(10), 'loaf');
    expect(planNotifications(done, testContent, at(11), 0).map((n) => n.kind)).toEqual(['daily_goals']);
  });

  it('never fires at night: late goods wait for the morning, as one notification', () => {
    const s = bakingUntil(at(20, 58), 'croissant');
    const plan = planNotifications(s, testContent, at(20, 58), 0);
    // Ready at 21:03, which is quiet, so it moves to 09:00, where it stands in for the daily one too.
    expect(plan).toEqual([{ kind: 'goods_ready', at: at(9) + DAY }]);
  });

  it('never plans more than the cap for one day, or anything in quiet hours', () => {
    for (const hour of [0, 6, 9, 12, 18, 20, 22]) {
      for (const offset of [0, 300, -540]) {
        const s = bakingUntil(at(hour), 'croissant', 'loaf');
        const plan = planNotifications(s, testContent, at(hour), offset);
        expect(plan.length).toBeLessThanOrEqual(2);
        const perDay = new Map<number, number>();
        for (const n of plan) {
          expect(n.at).toBeGreaterThan(at(hour));
          expect(outsideQuietHours(n.at, offset, rules)).toBe(n.at);
          const day = Math.floor((n.at - offset * MIN) / DAY);
          perDay.set(day, (perDay.get(day) ?? 0) + 1);
        }
        for (const count of perDay.values()) expect(count).toBeLessThanOrEqual(rules.maxPerDay);
      }
    }
  });

  it('plans nothing when the cap is zero', () => {
    const off = { ...testContent, economy: { ...testContent.economy, notifications: { ...rules, maxPerDay: 0 } } };
    expect(planNotifications(bakingUntil(at(10), 'loaf'), off, at(10), 0)).toEqual([]);
  });
});
