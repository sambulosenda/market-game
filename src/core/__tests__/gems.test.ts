import { describe, expect, it } from 'vitest';

import { buyQueueSlot, queueSlotCost, skipTimer, skipTimerCost } from '../gems';
import { collect, shopQueueSize, startBatch, viewShop } from '../production';
import { deserializeSave, serializeSave } from '../save';
import { createInitialState } from '../state';
import type { ActionResult, GameState } from '../types';
import { MIN, SEC, T0, testContent } from './fixtures';

function ok(result: ActionResult): GameState {
  if (!result.ok) throw new Error(`action failed: ${result.reason}`);
  return result.state;
}

const withGems = (state: GameState, gems: number): GameState => ({ ...state, wallet: { ...state.wallet, gems } });

/** A bakery with a croissant (5 minutes) baking and a loaf (1 minute) waiting behind it. */
function baking(): GameState {
  let s: GameState = { ...createInitialState(testContent, T0, 1), pantry: { butter: 2 } };
  s = ok(startBatch(s, testContent, 'bakery', 'croissant', T0));
  return ok(startBatch(s, testContent, 'bakery', 'loaf', T0));
}

describe('skipping a timer', () => {
  it('costs one gem for each 2 minutes left, rounded up, and at least one', () => {
    const s = baking();
    expect(skipTimerCost(s, testContent, 'bakery', T0)).toBe(3);
    expect(skipTimerCost(s, testContent, 'bakery', T0 + MIN)).toBe(2);
    expect(skipTimerCost(s, testContent, 'bakery', T0 + 4 * MIN + 59 * SEC)).toBe(1);
    // The croissant is done; now the loaf is baking.
    expect(skipTimerCost(s, testContent, 'bakery', T0 + 5 * MIN)).toBe(1);
    expect(skipTimerCost(s, testContent, 'bakery', T0 + 6 * MIN)).toBeNull();
    expect(skipTimerCost(s, testContent, 'dairy', T0)).toBeNull();
  });

  it('finishes the baking batch now and moves the rest of the queue up', () => {
    const s = baking();
    const result = skipTimer(s, testContent, 'bakery', T0 + MIN);
    if (!result.ok) throw new Error('skip failed');
    expect(result.events).toEqual([{ type: 'timerSkipped', shop: 'bakery', batchId: 1, gems: 2 }]);
    expect(result.state.wallet.gems).toBe(s.wallet.gems - 2);
    expect(result.state.wallet.log.at(-1)).toMatchObject({ currency: 'gems', amount: -2, reason: 'skip_timer' });

    const view = viewShop(result.state, testContent, 'bakery', T0 + MIN);
    expect(view.batches.map((b) => b.status)).toEqual(['ready', 'baking']);
    // The loaf starts the moment the croissant is done, and still takes its full minute.
    expect(view.batches[1].endsAt).toBe(T0 + 2 * MIN);
    expect(ok(collect(result.state, testContent, 'bakery', T0 + MIN)).pantry.croissant).toBe(1);
  });

  it('leaves batches that are already done alone', () => {
    const s = baking();
    const after = ok(skipTimer(s, testContent, 'bakery', T0 + 5 * MIN + 10 * SEC));
    const [croissant, loaf] = after.shops.bakery.queue;
    expect(croissant).toEqual(s.shops.bakery.queue[0]);
    expect(loaf.startAt + loaf.durationMs).toBe(T0 + 5 * MIN + 10 * SEC);
  });

  it('does nothing without enough gems or with nothing baking', () => {
    expect(skipTimer(withGems(baking(), 2), testContent, 'bakery', T0)).toEqual({
      ok: false,
      reason: 'not_enough_gems',
    });
    const idle = createInitialState(testContent, T0, 1);
    expect(skipTimer(idle, testContent, 'bakery', T0)).toEqual({ ok: false, reason: 'nothing_baking' });
    expect(skipTimer(idle, testContent, 'dairy', T0)).toEqual({ ok: false, reason: 'shop_not_owned' });
    expect(skipTimer(idle, testContent, 'nowhere', T0)).toEqual({ ok: false, reason: 'unknown_shop' });
  });
});

describe('buying a queue slot', () => {
  it('adds a slot for gems, at a rising price, up to the limit', () => {
    let s = withGems(createInitialState(testContent, T0, 1), 20);
    expect(shopQueueSize(testContent, 'bakery', s.shops.bakery)).toBe(2);
    expect(queueSlotCost(s, testContent, 'bakery')).toBe(3);

    const first = buyQueueSlot(s, testContent, 'bakery', T0);
    if (!first.ok) throw new Error('buy failed');
    expect(first.events).toEqual([{ type: 'queueSlotBought', shop: 'bakery', extraSlots: 1, gems: 3 }]);
    s = first.state;
    expect(s.wallet.gems).toBe(17);
    expect(s.wallet.log.at(-1)).toMatchObject({ currency: 'gems', amount: -3, reason: 'queue_slot' });
    expect(shopQueueSize(testContent, 'bakery', s.shops.bakery)).toBe(3);
    expect(queueSlotCost(s, testContent, 'bakery')).toBe(6);

    s = ok(buyQueueSlot(s, testContent, 'bakery', T0));
    expect(s.wallet.gems).toBe(11);
    expect(queueSlotCost(s, testContent, 'bakery')).toBeNull();
    expect(buyQueueSlot(s, testContent, 'bakery', T0)).toEqual({ ok: false, reason: 'max_level' });
  });

  it('lets the shop hold one more batch', () => {
    let s = withGems(createInitialState(testContent, T0, 1), 20);
    s = ok(startBatch(s, testContent, 'bakery', 'loaf', T0));
    s = ok(startBatch(s, testContent, 'bakery', 'loaf', T0));
    expect(startBatch(s, testContent, 'bakery', 'loaf', T0)).toEqual({ ok: false, reason: 'queue_full' });
    s = ok(buyQueueSlot(s, testContent, 'bakery', T0));
    s = ok(startBatch(s, testContent, 'bakery', 'loaf', T0));
    expect(viewShop(s, testContent, 'bakery', T0).queueSize).toBe(3);
  });

  it('needs the gems and the shop', () => {
    const s = withGems(createInitialState(testContent, T0, 1), 2);
    expect(buyQueueSlot(s, testContent, 'bakery', T0)).toEqual({ ok: false, reason: 'not_enough_gems' });
    expect(buyQueueSlot(s, testContent, 'dairy', T0)).toEqual({ ok: false, reason: 'shop_not_owned' });
  });

  it('is kept by a save, and held to the limit if the config shrinks', () => {
    const s = ok(buyQueueSlot(withGems(createInitialState(testContent, T0, 1), 20), testContent, 'bakery', T0));
    expect(deserializeSave(serializeSave(s), testContent).shops.bakery.extraSlots).toBe(1);
    const tooMany = { ...s, shops: { bakery: { ...s.shops.bakery, extraSlots: 9 } } };
    expect(deserializeSave(serializeSave(tooMany), testContent).shops.bakery.extraSlots).toBe(2);
    // A save from before this feature has no extra slots.
    expect(deserializeSave(serializeSave(createInitialState(testContent, T0, 1)), testContent).shops.bakery).toEqual({
      level: 1,
      queue: [],
    });
  });
});
