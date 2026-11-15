import { describe, expect, it } from 'vitest';

import { collect, startBatch, viewShop } from '../production';
import { createInitialState } from '../state';
import type { ActionResult, GameState } from '../types';
import { HOUR, MIN, SEC, T0, testContent } from './fixtures';

function ok(result: ActionResult): Extract<ActionResult, { ok: true }> {
  if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
  return result;
}

const fresh = () => createInitialState(testContent, T0);

describe('startBatch', () => {
  it('queues a batch that ends after the recipe duration', () => {
    const { state, events } = ok(startBatch(fresh(), testContent, 'bakery', 'loaf', T0));
    expect(state.shops.bakery.queue).toEqual([{ id: 1, recipe: 'loaf', startAt: T0, durationMs: 60 * SEC }]);
    expect(state.nextBatchId).toBe(2);
    expect(events).toEqual([{ type: 'batchStarted', shop: 'bakery', recipe: 'loaf', batchId: 1, endsAt: T0 + MIN }]);
  });

  it('runs queued batches one after another', () => {
    let s = ok(startBatch(fresh(), testContent, 'bakery', 'loaf', T0)).state;
    s = ok(startBatch(s, testContent, 'bakery', 'loaf', T0 + 10 * SEC)).state;
    expect(s.shops.bakery.queue[1].startAt).toBe(T0 + MIN);
    const view = viewShop(s, testContent, 'bakery', T0 + 30 * SEC);
    expect(view.batches.map((b) => b.status)).toEqual(['baking', 'waiting']);
    expect(view.active?.progress).toBeCloseTo(0.5);
  });

  it('starts a batch straight away when the batch ahead finished long ago', () => {
    let s = ok(startBatch(fresh(), testContent, 'bakery', 'loaf', T0)).state;
    s = ok(startBatch(s, testContent, 'bakery', 'loaf', T0 + HOUR)).state;
    expect(s.shops.bakery.queue[1].startAt).toBe(T0 + HOUR);
  });

  it('refuses when the queue is full, counting finished but uncollected batches', () => {
    let s = ok(startBatch(fresh(), testContent, 'bakery', 'loaf', T0)).state;
    s = ok(startBatch(s, testContent, 'bakery', 'loaf', T0)).state;
    expect(startBatch(s, testContent, 'bakery', 'loaf', T0 + HOUR)).toEqual({ ok: false, reason: 'queue_full' });
    s = ok(collect(s, testContent, 'bakery', T0 + HOUR)).state;
    expect(startBatch(s, testContent, 'bakery', 'loaf', T0 + HOUR).ok).toBe(true);
  });

  it('refuses when inputs are missing and leaves the pantry untouched', () => {
    const s: GameState = { ...fresh(), pantry: { butter: 1 } };
    expect(startBatch(s, testContent, 'bakery', 'croissant', T0)).toEqual({ ok: false, reason: 'missing_inputs' });
    expect(s.pantry).toEqual({ butter: 1 });
  });

  it('consumes inputs when the batch starts', () => {
    const s: GameState = { ...fresh(), pantry: { butter: 3, loaf: 1 } };
    const next = ok(startBatch(s, testContent, 'bakery', 'croissant', T0)).state;
    expect(next.pantry).toEqual({ butter: 1, loaf: 1 });
    const again = ok(startBatch({ ...next, pantry: { butter: 2 } }, testContent, 'bakery', 'croissant', T0)).state;
    expect(again.pantry).toEqual({});
    expect(s.pantry).toEqual({ butter: 3, loaf: 1 });
  });

  it('applies the shop level duration multiplier and queue size', () => {
    let s: GameState = { ...fresh(), shops: { bakery: { level: 2, queue: [] } } };
    s = ok(startBatch(s, testContent, 'bakery', 'loaf', T0)).state;
    expect(s.shops.bakery.queue[0].durationMs).toBe(30 * SEC);
    s = ok(startBatch(s, testContent, 'bakery', 'loaf', T0)).state;
    expect(startBatch(s, testContent, 'bakery', 'loaf', T0).ok).toBe(true);
  });

  it('rejects unknown, unowned and mismatched shops and recipes', () => {
    const s = fresh();
    expect(startBatch(s, testContent, 'forge', 'loaf', T0)).toEqual({ ok: false, reason: 'unknown_shop' });
    expect(startBatch(s, testContent, 'dairy', 'butter', T0)).toEqual({ ok: false, reason: 'shop_not_owned' });
    expect(startBatch(s, testContent, 'bakery', 'cake', T0)).toEqual({ ok: false, reason: 'unknown_recipe' });
    expect(startBatch(s, testContent, 'bakery', 'butter', T0)).toEqual({ ok: false, reason: 'wrong_shop' });
  });
});

describe('collect', () => {
  it('refuses when nothing is ready', () => {
    const s = ok(startBatch(fresh(), testContent, 'bakery', 'loaf', T0)).state;
    expect(collect(s, testContent, 'bakery', T0 + 59 * SEC)).toEqual({ ok: false, reason: 'nothing_ready' });
  });

  it('moves finished batches to the pantry and keeps unfinished ones queued', () => {
    let s = ok(startBatch(fresh(), testContent, 'bakery', 'loaf', T0)).state;
    s = ok(startBatch(s, testContent, 'bakery', 'loaf', T0)).state;
    const { state, events } = ok(collect(s, testContent, 'bakery', T0 + 90 * SEC));
    expect(state.pantry).toEqual({ loaf: 1 });
    expect(state.shops.bakery.queue.map((b) => b.id)).toEqual([2]);
    expect(events).toEqual([{ type: 'batchCollected', shop: 'bakery', good: 'loaf', qty: 1 }]);
  });

  it('collects a batch at exactly the moment it ends', () => {
    const s = ok(startBatch(fresh(), testContent, 'bakery', 'loaf', T0)).state;
    expect(collect(s, testContent, 'bakery', T0 + MIN).ok).toBe(true);
  });

  it('groups several finished batches of the same good into one event', () => {
    let s = ok(startBatch(fresh(), testContent, 'bakery', 'loaf', T0)).state;
    s = ok(startBatch(s, testContent, 'bakery', 'loaf', T0)).state;
    const { state, events } = ok(collect(s, testContent, 'bakery', T0 + HOUR));
    expect(state.pantry).toEqual({ loaf: 2 });
    expect(state.shops.bakery.queue).toEqual([]);
    expect(events).toEqual([{ type: 'batchCollected', shop: 'bakery', good: 'loaf', qty: 2 }]);
  });
});

describe('the first batch of a new game', () => {
  const quick = { ...testContent, economy: { ...testContent.economy, firstBatchSec: 5 } };

  it('is ready almost at once, and the batches after it take their usual time', () => {
    let s = ok(startBatch(createInitialState(quick, T0), quick, 'bakery', 'loaf', T0)).state;
    expect(s.shops.bakery.queue[0].durationMs).toBe(5 * SEC);
    s = ok(startBatch(s, quick, 'bakery', 'loaf', T0)).state;
    expect(s.shops.bakery.queue[1]).toMatchObject({ startAt: T0 + 5 * SEC, durationMs: 60 * SEC });
  });
});
