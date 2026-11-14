import { describe, expect, it } from 'vitest';

import { deserializeSave, type Migration, runMigrations, SaveError, serializeSave } from '../save';
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
    expect(SAVE_VERSION).toBe(1);
    const state = deserializeSave(JSON.stringify(v0), testContent, migrations);
    expect(state.version).toBe(1);
    expect(state.pantry).toEqual({ loaf: 2 });
    expect(state.nextBatchId).toBe(2);
    expect(state.shops.bakery.queue[0].id).toBe(1);
  });

  it('runs migrations in order across several versions', () => {
    const migrations: Migration[] = [
      { from: 1, migrate: (s) => ({ ...s, trail: [...(s.trail as string[]), 'a'] }) },
      { from: 2, migrate: (s) => ({ ...s, trail: [...(s.trail as string[]), 'b'] }) },
    ];
    expect(runMigrations({ version: 1, trail: [] }, migrations, 3)).toEqual({ version: 3, trail: ['a', 'b'] });
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
});
