import { describe, expect, it } from 'vitest';

import {
  baseOrderCoins,
  canFillOrder,
  fillOrder,
  orderableGoods,
  orderCoins,
  refreshOrders,
  skipOrder,
} from '../orders';
import { nextRandom, pickWeighted } from '../rng';
import { createInitialState } from '../state';
import type { ActionResult, GameState, Order } from '../types';
import { MIN, SEC, T0, testContent } from './fixtures';

function ok(r: ActionResult) {
  if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
  return r;
}
/** A new game with `over` applied before the board is filled, so its orders suit that state. */
const fresh = (seed = 1, over: Partial<GameState> = {}): GameState =>
  refreshOrders(
    { ...createInitialState(testContent, T0, seed), orders: { slots: [], nextId: 1 }, ...over },
    testContent,
    T0,
  );
const orders = (s: GameState): Order[] => s.orders.slots.flatMap((slot) => ('order' in slot ? [slot.order] : []));
const withDairy = (over: Partial<GameState> = {}): Partial<GameState> => ({
  level: 2,
  shops: { bakery: { level: 1, queue: [] }, dairy: { level: 1, queue: [] } },
  ...over,
});

describe('rng', () => {
  it('gives the same numbers for the same seed, all in [0, 1)', () => {
    let a = 42;
    let b = 42;
    for (let i = 0; i < 200; i++) {
      const x = nextRandom(a);
      const y = nextRandom(b);
      expect(x).toEqual(y);
      expect(x.value).toBeGreaterThanOrEqual(0);
      expect(x.value).toBeLessThan(1);
      a = x.seed;
      b = y.seed;
    }
  });

  it('picks by weight and never picks a zero weight', () => {
    expect(pickWeighted([1, 0, 0], 0.999)).toBe(0);
    expect(pickWeighted([0, 2, 2], 0)).toBe(1);
    expect(pickWeighted([0, 2, 2], 0.5)).toBe(2);
    expect(pickWeighted([3, 1], 0.74)).toBe(0);
    expect(pickWeighted([3, 1], 0.76)).toBe(1);
  });
});

describe('order generator', () => {
  it('fills the board for a new game', () => {
    const s = createInitialState(testContent, T0, 7);
    expect(orders(s)).toHaveLength(2);
    expect(orders(s).map((o) => o.id)).toEqual([1, 2]);
    expect(s.orders.nextId).toBe(3);
  });

  it('is repeatable: the same seed makes the same orders', () => {
    expect(fresh(99).orders).toEqual(fresh(99).orders);
    const boards = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => JSON.stringify(orders(fresh(seed)).map((o) => o.items))),
    );
    expect(boards.size).toBeGreaterThan(1);
  });

  it('only asks for goods the player can make, inputs included', () => {
    // Level 1: the croissant is unlocked, but it needs butter and there is no dairy.
    expect(orderableGoods(fresh(), testContent)).toEqual(['loaf']);
    expect(orderableGoods(fresh(1, { level: 2 }), testContent)).toEqual(['loaf']);
    expect(orderableGoods(fresh(1, withDairy()), testContent)).toEqual(['loaf', 'butter', 'croissant']);
    for (let seed = 1; seed <= 50; seed++)
      for (const o of orders(fresh(seed))) expect(o.items.map((i) => i.good)).toEqual(['loaf']);
  });

  it('follows the level tables for how many kinds and how many of each', () => {
    const kinds = new Set<number>();
    for (let seed = 1; seed <= 200; seed++) {
      for (const o of orders(fresh(seed))) {
        expect(o.items).toHaveLength(1);
        expect(o.items[0].qty).toBeGreaterThanOrEqual(1);
        expect(o.items[0].qty).toBeLessThanOrEqual(2);
      }
      for (const o of orders(fresh(seed, withDairy()))) {
        kinds.add(o.items.length);
        expect(new Set(o.items.map((i) => i.good)).size).toBe(o.items.length);
        for (const i of o.items) expect(i.qty).toBeLessThanOrEqual(3);
      }
    }
    expect([...kinds].sort()).toEqual([1, 2]);
  });

  it('prices an order: value times the multiplier, plus a bonus for each extra kind', () => {
    expect(baseOrderCoins(testContent, [{ good: 'loaf', qty: 2 }])).toBe(18);
    // (2 × 6 + 1 × 20) × 1.5 × 1.2
    expect(
      baseOrderCoins(testContent, [
        { good: 'loaf', qty: 2 },
        { good: 'butter', qty: 1 },
      ]),
    ).toBe(58);
    for (const o of orders(fresh(3, withDairy()))) {
      expect(o.coins).toBe(baseOrderCoins(testContent, o.items));
      expect(o.xp).toBe(o.items.reduce((n, i) => n + i.qty * testContent.goods[i.good].xp, 0));
    }
  });

  it('never asks for more of a good than its own limit', () => {
    const capped = {
      ...testContent,
      goods: { ...testContent.goods, loaf: { ...testContent.goods.loaf, maxOrderQty: 1 } },
    };
    for (let seed = 1; seed <= 60; seed++) {
      const s = createInitialState(capped, T0, seed);
      for (const o of orders(s)) expect(o.items[0]).toEqual({ good: 'loaf', qty: 1 });
    }
  });

  it('respects order weights', () => {
    const tilted = {
      ...testContent,
      goods: { ...testContent.goods, butter: { ...testContent.goods.butter, orderWeight: 0.0001 } },
    };
    let butter = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const s = refreshOrders(
        { ...createInitialState(tilted, T0, seed), ...withDairy(), orders: { slots: [], nextId: 1 } },
        tilted,
        T0,
      );
      butter += orders(s).filter((o) => o.items[0].good === 'butter').length;
    }
    expect(butter).toBeLessThan(3);
  });
});

describe('filling and skipping orders', () => {
  it('trades the goods for coins and XP, and a new order takes the slot', () => {
    const s = fresh(5, { pantry: { loaf: 5 } });
    const [first, second] = orders(s);
    const { state, events } = ok(fillOrder(s, testContent, first.id, T0 + SEC));
    expect(state.pantry.loaf).toBe(5 - first.items[0].qty);
    expect(state.wallet.coins).toBe(20 + first.coins);
    expect(state.wallet.log.at(-1)).toEqual({
      at: T0 + SEC,
      currency: 'coins',
      amount: first.coins,
      reason: 'order',
      balance: 20 + first.coins,
    });
    expect(state.xp).toBe(first.xp);
    expect(events[0]).toEqual({ type: 'orderFilled', orderId: first.id, coins: first.coins, xp: first.xp });
    expect(orders(state).map((o) => o.id)).toEqual([3, second.id]);
  });

  it('refuses an order the pantry cannot cover, or one that is not on the board', () => {
    const s = fresh(5);
    expect(canFillOrder(s, orders(s)[0])).toBe(false);
    expect(fillOrder(s, testContent, orders(s)[0].id, T0)).toEqual({ ok: false, reason: 'missing_goods' });
    expect(fillOrder(s, testContent, 99, T0)).toEqual({ ok: false, reason: 'unknown_order' });
    expect(skipOrder(s, testContent, 99, T0)).toEqual({ ok: false, reason: 'unknown_order' });
  });

  it('levels up from order XP, and the board grows with the level', () => {
    const s = fresh(5, { pantry: { loaf: 9 }, xp: 29, level: 2 });
    const { state, events } = ok(fillOrder(s, testContent, orders(s)[0].id, T0));
    expect(state.level).toBe(3);
    expect(events.map((e) => e.type)).toEqual(['orderFilled', 'levelUp']);
    expect(state.orders.slots).toHaveLength(3);
  });

  it('pays more once a coin landmark is restored', () => {
    const s = fresh(5, { pantry: { loaf: 5 }, landmarks: { fountain: { stage: 3 } } });
    const order = orders(s)[0];
    expect(orderCoins(s, testContent, order)).toBe(Math.round(order.coins * 1.1));
    const { state } = ok(fillOrder(s, testContent, order.id, T0));
    expect(state.wallet.coins).toBe(20 + Math.round(order.coins * 1.1));
  });

  it('leaves a skipped slot empty for the cooldown, then refills it', () => {
    const s = fresh(5);
    const [first, second] = orders(s);
    const { state, events } = ok(skipOrder(s, testContent, first.id, T0));
    expect(events).toEqual([{ type: 'orderSkipped', orderId: first.id, refillAt: T0 + 5 * MIN }]);
    expect(state.orders.slots).toEqual([{ refillAt: T0 + 5 * MIN }, { order: second }]);
    expect(state.wallet).toEqual(s.wallet);

    const waiting = refreshOrders(state, testContent, T0 + 5 * MIN - 1);
    expect(waiting).toBe(state);
    const refilled = refreshOrders(state, testContent, T0 + 5 * MIN);
    expect(orders(refilled).map((o) => o.id)).toEqual([3, second.id]);
  });

  it('does not refill early when the clock is moved back', () => {
    const s = fresh(5);
    const skipped = ok(skipOrder(s, testContent, orders(s)[0].id, T0 + MIN)).state;
    expect(refreshOrders(skipped, testContent, T0 - 60 * MIN)).toBe(skipped);
  });

  it('returns the same state when there is nothing to refresh', () => {
    const s = fresh(5);
    expect(refreshOrders(s, testContent, T0 + 60 * MIN)).toBe(s);
  });
});

describe('a new game', () => {
  const withOpening = (opening: { good: string; qty: number }[][]) => ({
    ...testContent,
    economy: { ...testContent.economy, orders: { ...testContent.economy.orders, opening } },
  });

  it('opens with the fixed orders from the content, priced like any other order', () => {
    const content = withOpening([[{ good: 'loaf', qty: 2 }]]);
    const s = createInitialState(content, T0, 1);
    expect(s.orders.slots).toHaveLength(2);
    expect(s.orders.slots[0]).toEqual({
      order: {
        id: 1,
        items: [{ good: 'loaf', qty: 2 }],
        coins: baseOrderCoins(content, [{ good: 'loaf', qty: 2 }]),
        xp: 2 * content.goods.loaf.xp,
      },
    });
    // The slot after the opening orders is filled at random as before.
    expect(s.orders.slots[1]).toMatchObject({ order: { id: 2 } });
  });

  it('leaves out an opening order the player cannot make yet, and any beyond the slots they have', () => {
    const loaf = [{ good: 'loaf', qty: 1 }];
    const s = createInitialState(withOpening([[{ good: 'butter', qty: 1 }], loaf, loaf, loaf]), T0, 1);
    expect(s.orders.slots.map((slot) => ('order' in slot ? slot.order.items : null))).toEqual([loaf, loaf]);
  });
});
