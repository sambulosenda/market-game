import { describe, expect, it } from 'vitest';

import {
  buyShop,
  collect,
  createInitialState,
  fillOrder,
  type GameEvent,
  type GameState,
  startBatch,
} from '../../core';
import { HOUR, T0, testContent } from '../../core/__tests__/fixtures';
import { toAnalytics } from '../events';

const fresh = (over: Partial<GameState> = {}): GameState => ({ ...createInitialState(testContent, T0, 1), ...over });
const names = (events: GameEvent[], after: GameState) => toAnalytics(events, after, testContent).map((e) => e.name);
const steps = (events: GameEvent[], after: GameState) =>
  toAnalytics(events, after, testContent)
    .filter((e) => e.name === 'tutorial_step')
    .map((e) => e.props.step);

describe('analytics events', () => {
  it('names every event the PRD lists', () => {
    const s = fresh({ level: 2 });
    const events: GameEvent[] = [
      { type: 'batchStarted', shop: 'bakery', recipe: 'loaf', batchId: 7, endsAt: T0 },
      { type: 'batchCollected', shop: 'bakery', good: 'loaf', qty: 2 },
      { type: 'orderFilled', orderId: 3, coins: 12, xp: 4 },
      { type: 'orderSkipped', orderId: 4, refillAt: T0 },
      { type: 'shopBought', shop: 'dairy' },
      { type: 'shopUpgraded', shop: 'bakery', level: 2 },
      { type: 'landmarkStageRestored', landmark: 'fountain', stage: 1, complete: false },
      { type: 'levelUp', level: 2, gems: 3, unlocks: { shops: [], recipes: [], landmarks: [] } },
      { type: 'timerSkipped', shop: 'bakery', batchId: 7, gems: 2 },
      { type: 'queueSlotBought', shop: 'bakery', extraSlots: 1, gems: 3 },
    ];
    expect(names(events, { ...s, xp: 40, made: { loaf: 9 } })).toEqual([
      'batch_started',
      'batch_collected',
      'order_completed',
      'order_skipped',
      'shop_opened',
      'shop_upgraded',
      'landmark_stage_restored',
      'level_up',
      'gems_spent',
      'gems_spent',
    ]);
  });

  it('adds the player level to every event and keeps to plain values', () => {
    const out = toAnalytics(
      [{ type: 'timerSkipped', shop: 'bakery', batchId: 7, gems: 2 }],
      fresh({ level: 2 }),
      testContent,
    );
    expect(out).toEqual([
      { name: 'gems_spent', props: { reason: 'skip_timer', gems: 2, shop: 'bakery', player_level: 2 } },
    ]);
  });

  it('sends each onboarding step once, the first time it happens', () => {
    // Played through the real core, so the steps follow real states.
    const seen: unknown[] = [];
    let s = fresh();
    const play = (result: ReturnType<typeof startBatch>) => {
      if (!result.ok) throw new Error(result.reason);
      s = result.state;
      seen.push(...steps(result.events, s));
    };
    for (let i = 0; i < 2; i++) {
      play(startBatch(s, testContent, 'bakery', 'loaf', T0 + i * HOUR));
      play(collect(s, testContent, 'bakery', T0 + (i + 1) * HOUR));
    }
    expect(seen).toEqual(['first_batch', 'first_collect']);

    s = { ...s, pantry: { loaf: 50, butter: 50, croissant: 50 } };
    for (let i = 0; i < 2; i++) {
      const slot = s.orders.slots.find((x) => 'order' in x);
      if (!slot || !('order' in slot)) throw new Error('expected an order');
      play(fillOrder(s, testContent, slot.order.id, T0 + 3 * HOUR));
    }
    expect(seen.filter((x) => x === 'first_order')).toHaveLength(1);

    s = { ...s, level: 2, wallet: { ...s.wallet, coins: 100000 } };
    play(buyShop(s, testContent, 'dairy', T0 + 4 * HOUR));
    expect(seen.at(-1)).toBe('second_shop');
  });

  it('says nothing about ordinary tips, and notes a new customer', () => {
    expect(names([{ type: 'customerTipped', coins: 1 }], fresh())).toEqual([]);
    expect(names([{ type: 'customerTipped', coins: 1, newLook: 3 }], fresh())).toEqual(['customer_met']);
  });
});
