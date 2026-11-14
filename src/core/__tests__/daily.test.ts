import { describe, expect, it } from 'vitest';

import {
  claimCalendarGift,
  claimDailyGoal,
  dailyWaiting,
  localDay,
  msUntilNextDay,
  recordDaily,
  refreshDaily,
  viewCalendar,
} from '../daily';
import { fillOrder } from '../orders';
import { collect, startBatch } from '../production';
import { deserializeSave, serializeSave } from '../save';
import { createInitialState } from '../state';
import type { ActionResult, DailyGoalKind, GameState } from '../types';
import { HOUR, MIN, T0, testContent } from './fixtures';

const DAY = 24 * HOUR;
/** T0 is 09:00 UTC. With no offset, local time is UTC. */
const UTC = 0;

function fresh(now = T0, tz = UTC): GameState {
  return refreshDaily(createInitialState(testContent, now, 7), testContent, now, tz);
}

function ok(result: ActionResult): GameState {
  if (!result.ok) throw new Error(`action failed: ${result.reason}`);
  return result.state;
}

/** Today's goals, all finished. */
function allDone(state: GameState): GameState {
  let s = state;
  for (const g of state.daily.goals) s = recordDaily(s, g.kind, g.target);
  return s;
}

describe('local days', () => {
  it('change at local midnight, not UTC midnight', () => {
    const midnightUtc = Date.UTC(2026, 10, 15, 0, 0, 0);
    expect(localDay(midnightUtc, 0)).toBe(localDay(midnightUtc - 1, 0) + 1);
    // New York in winter is UTC-5, so getTimezoneOffset() gives 300: midnight there is 05:00 UTC.
    expect(localDay(midnightUtc, 300)).toBe(localDay(midnightUtc - 1, 300));
    const midnightNewYork = midnightUtc + 5 * HOUR;
    expect(localDay(midnightNewYork, 300)).toBe(localDay(midnightNewYork - 1, 300) + 1);
    // Tokyo is UTC+9, so the offset is -540: midnight there is 15:00 UTC the day before.
    const midnightTokyo = midnightUtc - 9 * HOUR;
    expect(localDay(midnightTokyo, -540)).toBe(localDay(midnightTokyo - 1, -540) + 1);
  });

  it('know how long is left until midnight', () => {
    expect(msUntilNextDay(T0, UTC)).toBe(15 * HOUR);
    expect(msUntilNextDay(T0, 300)).toBe(20 * HOUR);
    expect(msUntilNextDay(T0 + 15 * HOUR, UTC)).toBe(DAY);
  });
});

describe('daily goals', () => {
  it('start empty and are set by the first refresh: 3 different goals, sized for the level', () => {
    expect(createInitialState(testContent, T0, 7).daily.goals).toEqual([]);
    const { goals } = fresh().daily;
    expect(goals).toHaveLength(3);
    expect(new Set(goals.map((g) => g.kind)).size).toBe(3);
    for (const g of goals) expect(g).toMatchObject({ progress: 0, claimed: false, coins: 10 });
    const higher = refreshDaily({ ...createInitialState(testContent, T0, 7), level: 2 }, testContent, T0, UTC);
    for (const g of higher.daily.goals) {
      expect(g.coins).toBe(20);
      if (g.kind === 'fill_orders') expect(g.target).toBe(4);
    }
  });

  it('stay the same all day and change at local midnight', () => {
    const s = fresh();
    expect(refreshDaily(s, testContent, T0 + 14 * HOUR + 59 * MIN, UTC)).toBe(s);
    const next = refreshDaily(recordDaily(s, s.daily.goals[0].kind, 1), testContent, T0 + 15 * HOUR, UTC);
    expect(next.daily.day).toBe(s.daily.day + 1);
    expect(next.daily.goals.every((g) => g.progress === 0 && !g.claimed)).toBe(true);
    // The same moment is still "today" five time zones west.
    const west = fresh(T0, 300);
    expect(refreshDaily(west, testContent, T0 + 15 * HOUR, 300)).toBe(west);
  });

  it('do not give a new day when the clock or the time zone is set back', () => {
    const s = refreshDaily(fresh(), testContent, T0 + DAY, UTC);
    expect(refreshDaily(s, testContent, T0 - 3 * DAY, UTC)).toBe(s);
    expect(refreshDaily(s, testContent, T0 + DAY, 720)).toBe(s);
  });

  it('count what the player does, up to the target', () => {
    const s = fresh();
    const kind = s.daily.goals[0].kind;
    const target = s.daily.goals[0].target;
    const counted = recordDaily(s, kind, target + 50);
    expect(counted.daily.goals[0].progress).toBe(target);
    expect(recordDaily(counted, kind, 1)).toBe(counted);
    expect(recordDaily(s, kind, 0)).toBe(s);
  });

  it('are fed by starting batches, collecting and filling orders', () => {
    const want = (state: GameState, kind: DailyGoalKind) => state.daily.goals.find((g) => g.kind === kind)?.progress;
    // Make every kind a goal, so each action can be seen.
    const base = fresh();
    const goal = (kind: DailyGoalKind) => ({ kind, target: 99, progress: 0, coins: 1, claimed: false });
    let s: GameState = {
      ...base,
      daily: {
        ...base.daily,
        goals: (['fill_orders', 'collect_goods', 'earn_coins', 'start_batches'] as const).map(goal),
      },
    };
    s = ok(startBatch(s, testContent, 'bakery', 'loaf', T0));
    s = ok(startBatch(s, testContent, 'bakery', 'loaf', T0));
    expect(want(s, 'start_batches')).toBe(2);
    s = ok(collect(s, testContent, 'bakery', T0 + 10 * MIN));
    expect(want(s, 'collect_goods')).toBe(2);
    const slot = s.orders.slots.find((x) => 'order' in x);
    if (!slot || !('order' in slot)) throw new Error('no order');
    s = { ...s, pantry: { loaf: 9, butter: 9, croissant: 9 } };
    const coinsBefore = s.wallet.coins;
    s = ok(fillOrder(s, testContent, slot.order.id, T0 + 11 * MIN));
    expect(want(s, 'fill_orders')).toBe(1);
    expect(want(s, 'earn_coins')).toBe(s.wallet.coins - coinsBefore);
  });

  it('pay coins once each when finished, and gems once for all three', () => {
    const s = fresh();
    expect(claimDailyGoal(s, testContent, 0, T0)).toEqual({ ok: false, reason: 'goal_not_done' });
    expect(claimDailyGoal(s, testContent, 5, T0)).toEqual({ ok: false, reason: 'unknown_goal' });

    const done = allDone(s);
    const first = claimDailyGoal(done, testContent, 0, T0);
    if (!first.ok) throw new Error('claim failed');
    expect(first.events).toEqual([{ type: 'dailyGoalClaimed', kind: done.daily.goals[0].kind, coins: 10, gems: 0 }]);
    expect(first.state.wallet.coins).toBe(s.wallet.coins + 10);
    expect(claimDailyGoal(first.state, testContent, 0, T0)).toEqual({ ok: false, reason: 'already_claimed' });

    const second = ok(claimDailyGoal(first.state, testContent, 1, T0));
    const third = claimDailyGoal(second, testContent, 2, T0);
    if (!third.ok) throw new Error('claim failed');
    expect(third.events[0]).toMatchObject({ coins: 10, gems: 2 });
    expect(third.state.wallet).toMatchObject({ coins: s.wallet.coins + 30, gems: s.wallet.gems + 2 });
    expect(third.state.daily.bonusClaimed).toBe(true);
    expect(third.state.wallet.log.map((l) => l.reason)).toEqual([
      'daily_goal',
      'daily_goal',
      'daily_goal',
      'daily_goal',
    ]);
  });

  it('survive a save and a load', () => {
    const s = ok(claimDailyGoal(allDone(fresh()), testContent, 1, T0));
    expect(deserializeSave(serializeSave(s), testContent).daily).toEqual(s.daily);
  });
});

describe('login calendar', () => {
  it('gives one gift per local day, the next in the cycle each time', () => {
    const s = fresh();
    expect(viewCalendar(s, testContent, T0, UTC)).toMatchObject({ taken: 0, canClaim: true });
    const first = claimCalendarGift(s, testContent, T0, UTC);
    if (!first.ok) throw new Error('claim failed');
    expect(first.events).toEqual([{ type: 'calendarGiftClaimed', day: 1, coins: 5, gems: 0 }]);
    expect(claimCalendarGift(first.state, testContent, T0 + HOUR, UTC)).toEqual({
      ok: false,
      reason: 'already_claimed',
    });
    expect(viewCalendar(first.state, testContent, T0 + HOUR, UTC)).toMatchObject({ taken: 1, canClaim: false });

    const second = claimCalendarGift(first.state, testContent, T0 + DAY, UTC);
    if (!second.ok) throw new Error('claim failed');
    expect(second.events[0]).toMatchObject({ day: 2, coins: 6 });
  });

  it('does not reset when days are missed', () => {
    let s = ok(claimCalendarGift(fresh(), testContent, T0, UTC));
    s = ok(claimCalendarGift(s, testContent, T0 + DAY, UTC));
    // Nine days away.
    const back = claimCalendarGift(s, testContent, T0 + 10 * DAY, UTC);
    if (!back.ok) throw new Error('claim failed');
    expect(back.events[0]).toMatchObject({ day: 3, coins: 0, gems: 1 });
  });

  it('scales coins with the level, and starts again after day 7', () => {
    let s: GameState = { ...fresh(), level: 3 };
    const wallet = s.wallet;
    for (let d = 0; d < 7; d++) s = ok(claimCalendarGift(s, testContent, T0 + d * DAY, UTC));
    expect(s.wallet.coins - wallet.coins).toBe((5 + 6 + 8 + 9 + 20) * 3);
    expect(s.wallet.gems - wallet.gems).toBe(1 + 2 + 5);
    // The full week stays on show for the rest of the day, then a new one begins.
    expect(viewCalendar(s, testContent, T0 + 6 * DAY + HOUR, UTC)).toMatchObject({ taken: 7, canClaim: false });
    expect(viewCalendar(s, testContent, T0 + 7 * DAY, UTC)).toMatchObject({ taken: 0, canClaim: true });
    const again = claimCalendarGift(s, testContent, T0 + 7 * DAY, UTC);
    if (!again.ok) throw new Error('claim failed');
    expect(again.events[0]).toMatchObject({ day: 1, coins: 15 });
  });

  it('counts what is waiting, for the badge', () => {
    const s = fresh();
    expect(dailyWaiting(s, T0, UTC)).toBe(1);
    const done = allDone(s);
    expect(dailyWaiting(done, T0, UTC)).toBe(4);
    const claimed = ok(claimCalendarGift(ok(claimDailyGoal(done, testContent, 0, T0)), testContent, T0, UTC));
    expect(dailyWaiting(claimed, T0, UTC)).toBe(2);
  });
});
