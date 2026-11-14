import { describe, expect, it } from 'vitest';

import { batchSpeedMultiplier, extraOrderSlots, orderCoinMultiplier } from '../bonuses';
import { restoreLandmark } from '../landmarks';
import { addXp, levelProgress, xpForNextLevel } from '../levels';
import { orderSlotCount } from '../orders';
import { pantryCapacity, pantryCount, upgradePantry } from '../pantry';
import { collect, startBatch } from '../production';
import { buyShop, upgradeShop } from '../shops';
import { createInitialState } from '../state';
import { tipCoins, tipCustomer } from '../tips';
import type { ActionResult, GameState } from '../types';
import { earn, spend, WALLET_LOG_SIZE } from '../wallet';
import { HOUR, MIN, T0, testContent } from './fixtures';

function ok(r: ActionResult) {
  if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
  return r;
}
const fresh = (over: Partial<GameState> = {}): GameState => ({ ...createInitialState(testContent, T0, 1), ...over });
const rich = (coins: number, over: Partial<GameState> = {}) => fresh({ ...over, wallet: { coins, gems: 0, log: [] } });

describe('wallet', () => {
  it('logs every change with its reason and the balance after it', () => {
    let w = fresh().wallet;
    w = earn(w, 'coins', 9, 'order', T0);
    w = spend(w, 'coins', 4, 'buy_shop', T0 + 1)!;
    expect(w.coins).toBe(25);
    expect(w.log).toEqual([
      { at: T0, currency: 'coins', amount: 9, reason: 'order', balance: 29 },
      { at: T0 + 1, currency: 'coins', amount: -4, reason: 'buy_shop', balance: 25 },
    ]);
  });

  it('refuses to spend more than it holds, and never goes below zero', () => {
    const w = fresh().wallet;
    expect(spend(w, 'coins', 21, 'buy_shop', T0)).toBeNull();
    expect(spend(w, 'gems', 6, 'buy_shop', T0)).toBeNull();
    expect(spend(w, 'coins', -5, 'buy_shop', T0)).toBeNull();
    expect(spend(w, 'coins', 20, 'buy_shop', T0)!.coins).toBe(0);
  });

  it('keeps only the latest transactions', () => {
    let w = fresh().wallet;
    for (let i = 0; i < WALLET_LOG_SIZE + 20; i++) w = earn(w, 'coins', 1, 'order', T0 + i);
    expect(w.log).toHaveLength(WALLET_LOG_SIZE);
    expect(w.log[0].at).toBe(T0 + 20);
    expect(w.coins).toBe(20 + WALLET_LOG_SIZE + 20);
  });
});

describe('pantry', () => {
  it('counts every good toward one capacity', () => {
    const s = fresh({ pantry: { loaf: 4, butter: 3 } });
    expect(pantryCount(s)).toBe(7);
    expect(pantryCapacity(s, testContent)).toBe(10);
  });

  it('collects only what fits, oldest first, and leaves the rest in the queue', () => {
    let s = fresh({ pantry: { butter: 9 } });
    s = ok(startBatch(s, testContent, 'bakery', 'loaf', T0)).state;
    s = ok(startBatch(s, testContent, 'bakery', 'loaf', T0)).state;
    const first = ok(collect(s, testContent, 'bakery', T0 + HOUR));
    expect(first.state.pantry).toEqual({ butter: 9, loaf: 1 });
    expect(first.state.shops.bakery.queue.map((b) => b.id)).toEqual([2]);
    expect(first.events).toEqual([{ type: 'batchCollected', shop: 'bakery', good: 'loaf', qty: 1 }]);
    expect(collect(first.state, testContent, 'bakery', T0 + HOUR)).toEqual({ ok: false, reason: 'pantry_full' });
  });

  it('upgrades for coins until the top level', () => {
    expect(upgradePantry(rich(29), testContent, T0)).toEqual({ ok: false, reason: 'not_enough_coins' });
    const up = ok(upgradePantry(rich(30), testContent, T0));
    expect(up.state.wallet.coins).toBe(0);
    expect(pantryCapacity(up.state, testContent)).toBe(20);
    expect(up.events).toEqual([{ type: 'pantryUpgraded', level: 2, capacity: 20 }]);
    expect(upgradePantry({ ...up.state, wallet: rich(999).wallet }, testContent, T0)).toEqual({
      ok: false,
      reason: 'max_level',
    });
  });
});

describe('levels', () => {
  it('levels up when XP reaches the next threshold, paying gems and listing unlocks', () => {
    const s = fresh();
    expect(xpForNextLevel(s, testContent)).toBe(10);
    const a = addXp(s, testContent, 9, T0);
    expect([a.state.level, a.events.length]).toEqual([1, 0]);
    expect(levelProgress(a.state, testContent)).toBeCloseTo(0.9);
    const b = addXp(a.state, testContent, 1, T0);
    expect(b.state.level).toBe(2);
    expect(b.state.wallet.gems).toBe(8);
    expect(b.events).toEqual([
      {
        type: 'levelUp',
        level: 2,
        gems: 3,
        unlocks: { shops: ['dairy'], recipes: ['butter'], landmarks: ['fountain'] },
      },
    ]);
  });

  it('can pass several levels at once and keeps counting XP at the top', () => {
    const a = addXp(fresh(), testContent, 500, T0);
    expect(a.state.level).toBe(3);
    expect(a.events.map((e) => e.type)).toEqual(['levelUp', 'levelUp']);
    expect(a.state.wallet.gems).toBe(5 + 3 + 5);
    expect(xpForNextLevel(a.state, testContent)).toBeNull();
    expect(levelProgress(a.state, testContent)).toBe(1);
    expect(addXp(a.state, testContent, 10, T0).state.xp).toBe(510);
  });
});

describe('shops', () => {
  it('buys a shop once its level is reached and the coins are there', () => {
    expect(buyShop(rich(500), testContent, 'dairy', T0)).toEqual({ ok: false, reason: 'level_too_low' });
    expect(buyShop(rich(49, { level: 2 }), testContent, 'dairy', T0)).toEqual({
      ok: false,
      reason: 'not_enough_coins',
    });
    const bought = ok(buyShop(rich(60, { level: 2 }), testContent, 'dairy', T0));
    expect(bought.state.shops.dairy).toEqual({ level: 1, queue: [] });
    expect(bought.state.wallet.coins).toBe(10);
    expect(bought.state.wallet.log.at(-1)).toMatchObject({ amount: -50, reason: 'buy_shop' });
    expect(buyShop(bought.state, testContent, 'dairy', T0)).toEqual({ ok: false, reason: 'already_owned' });
    expect(buyShop(bought.state, testContent, 'forge', T0)).toEqual({ ok: false, reason: 'unknown_shop' });
  });

  it('upgrades a shop: more queue slots and faster new batches, old batches unchanged', () => {
    let s = ok(startBatch(rich(100), testContent, 'bakery', 'loaf', T0)).state;
    s = ok(upgradeShop(s, testContent, 'bakery', T0)).state;
    expect(s.shops.bakery.level).toBe(2);
    expect(s.wallet.coins).toBe(0);
    s = ok(startBatch(s, testContent, 'bakery', 'loaf', T0)).state;
    s = ok(startBatch(s, testContent, 'bakery', 'loaf', T0)).state;
    expect(s.shops.bakery.queue.map((b) => b.durationMs)).toEqual([MIN, MIN / 2, MIN / 2]);
    expect(upgradeShop({ ...s, wallet: rich(999).wallet }, testContent, 'bakery', T0)).toEqual({
      ok: false,
      reason: 'max_level',
    });
    expect(upgradeShop(rich(99), testContent, 'bakery', T0)).toEqual({ ok: false, reason: 'not_enough_coins' });
    expect(upgradeShop(rich(999), testContent, 'dairy', T0)).toEqual({ ok: false, reason: 'shop_not_owned' });
  });

  it('refuses recipes the player has not unlocked', () => {
    const owned = fresh({ shops: { ...fresh().shops, dairy: { level: 1, queue: [] } } });
    expect(startBatch(owned, testContent, 'dairy', 'butter', T0)).toEqual({ ok: false, reason: 'recipe_locked' });
    expect(startBatch({ ...owned, level: 2 }, testContent, 'dairy', 'butter', T0).ok).toBe(true);
  });
});

describe('landmarks', () => {
  const ready = (over: Partial<GameState> = {}) => rich(100, { level: 3, pantry: { loaf: 9, butter: 1 }, ...over });

  it('restores one stage at a time for coins and goods', () => {
    expect(restoreLandmark(ready({ level: 1 }), testContent, 'fountain', T0)).toEqual({
      ok: false,
      reason: 'level_too_low',
    });
    expect(restoreLandmark(ready({ pantry: {} }), testContent, 'fountain', T0)).toEqual({
      ok: false,
      reason: 'missing_goods',
    });
    expect(restoreLandmark(rich(9, { level: 2, pantry: { loaf: 1 } }), testContent, 'fountain', T0)).toEqual({
      ok: false,
      reason: 'not_enough_coins',
    });
    expect(restoreLandmark(ready(), testContent, 'statue', T0)).toEqual({ ok: false, reason: 'unknown_landmark' });

    const one = ok(restoreLandmark(ready(), testContent, 'fountain', T0));
    expect(one.state.landmarks).toEqual({ fountain: { stage: 1 } });
    expect(one.state.wallet.coins).toBe(90);
    expect(one.state.pantry).toEqual({ loaf: 8, butter: 1 });
    expect(one.events).toEqual([{ type: 'landmarkStageRestored', landmark: 'fountain', stage: 1, complete: false }]);
    expect(orderCoinMultiplier(one.state, testContent)).toBe(1);
  });

  it('turns the bonus on for good after the last stage', () => {
    let s = ready();
    for (let i = 0; i < 2; i++) s = ok(restoreLandmark(s, testContent, 'fountain', T0)).state;
    const last = ok(restoreLandmark(s, testContent, 'fountain', T0));
    expect(last.events[0]).toMatchObject({ stage: 3, complete: true });
    expect(orderCoinMultiplier(last.state, testContent)).toBeCloseTo(1.1);
    expect(last.state.wallet.coins).toBe(40);
    expect(last.state.pantry).toEqual({ loaf: 6 });
    expect(restoreLandmark(last.state, testContent, 'fountain', T0)).toEqual({ ok: false, reason: 'already_restored' });
  });

  it('a speed landmark shortens new batches, and a slots landmark adds an order slot', () => {
    let s = ready();
    for (let i = 0; i < 3; i++) s = ok(restoreLandmark(s, testContent, 'clocktower', T0)).state;
    expect(batchSpeedMultiplier(s, testContent)).toBe(0.5);
    expect(ok(startBatch(s, testContent, 'bakery', 'loaf', T0)).state.shops.bakery.queue[0].durationMs).toBe(MIN / 2);

    expect(s.orders.slots).toHaveLength(3);
    for (let i = 0; i < 3; i++) s = ok(restoreLandmark(s, testContent, 'bandstand', T0)).state;
    expect(extraOrderSlots(s, testContent)).toBe(1);
    expect(orderSlotCount(s, testContent)).toBe(4);
    expect(s.orders.slots).toHaveLength(4);
  });
});

describe('tips', () => {
  it('pay a few coins, a little more at higher levels, and are logged', () => {
    const s = createInitialState(testContent, T0, 1);
    expect(tipCoins(s, testContent)).toBe(1);
    expect(tipCoins({ ...s, level: 3 }, testContent)).toBe(2);
    const result = tipCustomer({ ...s, level: 3 }, testContent, T0 + 5);
    if (!result.ok) throw new Error('tip failed');
    expect(result.events).toEqual([{ type: 'customerTipped', coins: 2 }]);
    expect(result.state.wallet.coins).toBe(s.wallet.coins + 2);
    expect(result.state.wallet.log.at(-1)).toMatchObject({ reason: 'tip', amount: 2 });
  });
});
