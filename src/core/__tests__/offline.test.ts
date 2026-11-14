import { describe, expect, it } from 'vitest';

import { pause, resume } from '../offline';
import { collect, startBatch, viewShop } from '../production';
import { createInitialState } from '../state';
import type { ActionResult, GameState } from '../types';
import { HOUR, MIN, SEC, T0, testContent } from './fixtures';

function state(result: ActionResult): GameState {
  if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
  return result.state;
}

/** A bakery with a 1-minute loaf, then a 1-minute loaf queued behind it, started at T0. */
function twoLoaves(): GameState {
  let s = createInitialState(testContent, T0);
  s = state(startBatch(s, testContent, 'bakery', 'loaf', T0));
  return state(startBatch(s, testContent, 'bakery', 'loaf', T0));
}

describe('resume', () => {
  it('reports exactly the batches that finished while the app was closed for an hour', () => {
    let s = createInitialState(testContent, T0);
    s = { ...s, shops: { bakery: { level: 2, queue: [] } } }; // 3-batch queue, 30s loaves
    for (let i = 0; i < 3; i++) s = state(startBatch(s, testContent, 'bakery', 'loaf', T0));
    // Ends at T0+30s, T0+60s and T0+90s.
    s = pause(s, T0 + 45 * SEC);
    const { state: back, summary } = resume(s, testContent, T0 + 45 * SEC + HOUR);
    expect(summary.finished).toEqual({ loaf: 2 }); // the first one finished before we left
    expect(summary.awayMs).toBe(HOUR);
    expect(summary.clockMovedBack).toBe(false);
    expect(back.clock).toBe(T0 + 45 * SEC + HOUR);
    expect(viewShop(back, testContent, 'bakery', back.clock).readyCount).toBe(3);
  });

  it('does not report batches that are still baking', () => {
    const s = pause(twoLoaves(), T0);
    const { summary } = resume(s, testContent, T0 + 90 * SEC);
    expect(summary.finished).toEqual({ loaf: 1 });
  });

  it('reports nothing when nothing finished', () => {
    const s = pause(twoLoaves(), T0);
    const { summary } = resume(s, testContent, T0 + 10 * SEC);
    expect(summary.finished).toEqual({});
  });

  it('does not report the same batches twice', () => {
    const s = pause(twoLoaves(), T0);
    const first = resume(s, testContent, T0 + HOUR);
    expect(first.summary.finished).toEqual({ loaf: 2 });
    const second = resume(first.state, testContent, T0 + 2 * HOUR);
    expect(second.summary.finished).toEqual({});
  });

  it('closing and reopening the app loses nothing: finished batches wait to be collected', () => {
    const s = pause(twoLoaves(), T0);
    const back = resume(s, testContent, T0 + 3 * HOUR).state;
    expect(state(collect(back, testContent, 'bakery', T0 + 3 * HOUR)).pantry).toEqual({ loaf: 2 });
  });
});

describe('clock moving backwards', () => {
  it('grants no progress', () => {
    let s = state(startBatch(createInitialState(testContent, T0), testContent, 'bakery', 'loaf', T0));
    s = pause(s, T0 + 30 * SEC);
    // Device clock is set back two hours.
    const { state: back, summary } = resume(s, testContent, T0 + 30 * SEC - 2 * HOUR);
    expect(summary.clockMovedBack).toBe(true);
    expect(summary.finished).toEqual({});
    expect(summary.awayMs).toBe(0);
    expect(back.clock).toBe(T0 + 30 * SEC);
    // Even though wall time is now well before the batch started, it is held
    // at the last time seen, not rewound...
    expect(viewShop(back, testContent, 'bakery', T0 - HOUR).active?.progress).toBeCloseTo(0.5);
    // ...and it cannot be collected until real time passes its end.
    expect(collect(back, testContent, 'bakery', T0 - HOUR)).toEqual({ ok: false, reason: 'nothing_ready' });
    expect(collect(back, testContent, 'bakery', T0 + MIN).ok).toBe(true);
  });

  it('a batch started while the clock is behind still takes its full duration', () => {
    let s = pause(createInitialState(testContent, T0), T0 + HOUR);
    // Clock set back an hour; start a loaf at "T0".
    s = state(startBatch(s, testContent, 'bakery', 'loaf', T0));
    expect(s.shops.bakery.queue[0].startAt).toBe(T0 + HOUR);
    expect(collect(s, testContent, 'bakery', T0 + HOUR + 59 * SEC).ok).toBe(false);
    expect(collect(s, testContent, 'bakery', T0 + HOUR + MIN).ok).toBe(true);
  });
});
