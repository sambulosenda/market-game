import { describe, expect, it } from 'vitest';

import { deserializeSave, type Migration, MIGRATIONS, runMigrations, SaveError, serializeSave } from '../save';
import { refreshOrders } from '../orders';
import { createInitialState } from '../state';
import { SAVE_VERSION } from '../types';
import { T0, testContent } from './fixtures';

describe('save', () => {
  it('round-trips a state', () => {
    const s = {
      ...createInitialState(testContent, T0),
      pantry: { loaf: 3 },
      nextBatchId: 3,
      shops: { bakery: { level: 1, queue: [{ id: 2, recipe: 'loaf', startAt: T0, durationMs: 60000 }] } },
    };
    expect(deserializeSave(serializeSave(s), testContent)).toEqual(s);
  });

  it('migrates an old save to the current version', () => {
    // A hypothetical version-0 save, which stored "goods" instead of "pantry"
    // and had no batch ids.
    const v0 = {
      version: 0,
      createdAt: T0,
      clock: T0,
      goods: { loaf: 2 },
      shops: { bakery: { level: 1, queue: [{ recipe: 'loaf', startAt: T0, durationMs: 60000 }] } },
    };
    const migrations: Migration[] = [
      {
        from: 0,
        migrate: ({ goods, shops, ...rest }) => {
          let id = 1;
          const s = shops as Record<string, { level: number; queue: object[] }>;
          const withIds = Object.fromEntries(
            Object.entries(s).map(([k, shop]) => [k, { ...shop, queue: shop.queue.map((b) => ({ ...b, id: id++ })) }]),
          );
          return { ...rest, pantry: goods, shops: withIds, nextBatchId: id };
        },
      },
    ];
    const state = deserializeSave(JSON.stringify(v0), testContent, [...migrations, ...MIGRATIONS]);
    expect(state.version).toBe(SAVE_VERSION);
    expect(state.pantry).toEqual({ loaf: 2 });
    expect(state.nextBatchId).toBe(2);
    expect(state.shops.bakery.queue[0].id).toBe(1);
  });

  it('runs migrations in order across several versions', () => {
    const migrations: Migration[] = [
      { from: 1, migrate: (s) => ({ ...s, trail: [...(s.trail as string[]), 'a'] }) },
      { from: 2, migrate: (s) => ({ ...s, trail: [...(s.trail as string[]), 'b'] }) },
    ];
    expect(runMigrations({ version: 1, trail: [] }, migrations, 3, testContent)).toEqual({
      version: 3,
      trail: ['a', 'b'],
    });
  });

  it('brings a version 2 save (milestone 2) forward with no daily goals yet', () => {
    const { daily, ...rest } = createInitialState(testContent, T0);
    expect(daily.day).toBe(-1);
    const state = deserializeSave(
      JSON.stringify({ ...rest, version: 2, wallet: { coins: 345, gems: 9, log: [] } }),
      testContent,
    );
    expect(state.version).toBe(SAVE_VERSION);
    expect(state.wallet.coins).toBe(345);
    expect(state.daily).toEqual({ day: -1, goals: [], bonusClaimed: false, calendar: { claimed: 0, lastDay: null } });
  });

  it('brings a version 1 save (the core loop build) forward without losing it', () => {
    const v1 = {
      version: 1,
      createdAt: T0,
      clock: T0 + 5000,
      nextBatchId: 2,
      pantry: { loaf: 3 },
      shops: { bakery: { level: 1, queue: [{ id: 1, recipe: 'loaf', startAt: T0, durationMs: 60000 }] } },
    };
    const state = deserializeSave(JSON.stringify(v1), testContent);
    expect(state.version).toBe(SAVE_VERSION);
    expect(state.pantry).toEqual({ loaf: 3 });
    expect(state.shops.bakery.queue).toHaveLength(1);
    expect(state.wallet).toEqual({ coins: 20, gems: 5, log: [] });
    expect([state.level, state.xp, state.pantryLevel]).toEqual([1, 0, 1]);
    expect(state.landmarks).toEqual({});
    // The board starts empty; the first refresh fills it.
    const filled = refreshOrders(state, testContent, state.clock);
    expect(filled.orders.slots).toHaveLength(2);
  });

  it('refuses saves it cannot read', () => {
    expect(() => deserializeSave('not json', testContent)).toThrow(SaveError);
    expect(() => deserializeSave('[]', testContent)).toThrow(SaveError);
    expect(() => deserializeSave('{"version": 99}', testContent)).toThrow(/newer than this build/);
    expect(() => deserializeSave('{"version": 0}', testContent)).toThrow(/No migration from save version 0/);
    expect(() => deserializeSave('{"version": 1}', testContent)).toThrow(SaveError);
  });

  it('reconciles a save with content that changed', () => {
    const raw = JSON.stringify({
      version: 1,
      createdAt: T0,
      clock: T0,
      nextBatchId: 3,
      pantry: { loaf: 1, gone: 4 },
      shops: {
        bakery: {
          level: 1,
          queue: [
            { id: 1, recipe: 'loaf', startAt: T0, durationMs: 1 },
            { id: 2, recipe: 'removed_recipe', startAt: T0, durationMs: 1 },
          ],
        },
        closed_shop: { level: 1, queue: [] },
      },
    });
    const state = deserializeSave(raw, testContent);
    expect(state.pantry).toEqual({ loaf: 1 });
    expect(Object.keys(state.shops)).toEqual(['bakery']);
    expect(state.shops.bakery.queue.map((b) => b.id)).toEqual([1]);
  });

  it('reconciles levels, landmarks and orders with content that changed', () => {
    const s = createInitialState(testContent, T0, 1);
    const raw = serializeSave({
      ...s,
      xp: 12,
      level: 9,
      pantryLevel: 7,
      shops: { bakery: { level: 5, queue: [] } },
      landmarks: { fountain: { stage: 8 }, gone: { stage: 1 } },
      orders: {
        nextId: 9,
        slots: [{ order: { id: 8, items: [{ good: 'gone', qty: 1 }], coins: 5, xp: 1 } }, s.orders.slots[1]],
      },
    });
    const state = deserializeSave(raw, testContent);
    expect(state.level).toBe(2);
    expect(state.pantryLevel).toBe(2);
    expect(state.shops.bakery.level).toBe(2);
    expect(state.landmarks).toEqual({ fountain: { stage: 3 } });
    expect(state.orders.slots[0]).toEqual({ refillAt: T0 });
    expect(state.orders.slots[1]).toEqual(s.orders.slots[1]);
  });
});
