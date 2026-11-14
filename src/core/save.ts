import { z } from 'zod';

import type { Content } from '../content/schema';
import { reconcile } from './state';
import { type GameState, SAVE_VERSION } from './types';

/**
 * One versioned save. Each change to the save format bumps SAVE_VERSION and
 * adds a migration from the previous version, so any old save can be brought
 * forward one step at a time.
 */
export type Migration = {
  /** The version this migration upgrades from. It produces `from + 1`. */
  from: number;
  migrate: (save: Record<string, unknown>, content: Content) => Record<string, unknown>;
};

export const MIGRATIONS: Migration[] = [
  {
    // Version 2 added the wallet, XP and levels, orders, landmarks and pantry levels.
    from: 1,
    migrate: (save, content) => ({
      ...save,
      pantryLevel: 1,
      wallet: { coins: content.economy.startingCoins, gems: content.economy.startingGems, log: [] },
      xp: 0,
      level: 1,
      orders: { slots: [], nextId: 1 },
      landmarks: {},
      rng: typeof save.createdAt === 'number' ? save.createdAt >>> 0 : 1,
    }),
  },
];

const batchSchema = z.object({
  id: z.number().int(),
  recipe: z.string(),
  startAt: z.number(),
  durationMs: z.number().nonnegative(),
});

const orderSchema = z.object({
  id: z.number().int(),
  items: z.array(z.object({ good: z.string(), qty: z.number().int().positive() })).min(1),
  coins: z.number().int().nonnegative(),
  xp: z.number().int().nonnegative(),
});

const saveSchema = z.object({
  version: z.literal(SAVE_VERSION),
  createdAt: z.number(),
  clock: z.number(),
  nextBatchId: z.number().int().positive(),
  pantry: z.record(z.string(), z.number().int().nonnegative()),
  pantryLevel: z.number().int().min(1),
  shops: z.record(z.string(), z.object({ level: z.number().int().min(1), queue: z.array(batchSchema) })),
  wallet: z.object({
    coins: z.number().int().nonnegative(),
    gems: z.number().int().nonnegative(),
    log: z.array(
      z.object({
        at: z.number(),
        currency: z.enum(['coins', 'gems']),
        amount: z.number().int(),
        reason: z.enum(['order', 'level_up', 'buy_shop', 'upgrade_shop', 'upgrade_pantry', 'restore_landmark']),
        balance: z.number().int(),
      }),
    ),
  }),
  xp: z.number().int().nonnegative(),
  level: z.number().int().min(1),
  orders: z.object({
    slots: z.array(z.union([z.object({ order: orderSchema }), z.object({ refillAt: z.number() })])),
    nextId: z.number().int().positive(),
  }),
  landmarks: z.record(z.string(), z.object({ stage: z.number().int().nonnegative() })),
  rng: z.number().int().nonnegative(),
});

export class SaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveError';
  }
}

export function runMigrations(
  save: Record<string, unknown>,
  migrations: Migration[],
  target: number,
  content: Content,
): Record<string, unknown> {
  let current = save;
  let version = current.version;
  if (typeof version !== 'number' || !Number.isInteger(version))
    throw new SaveError('Save has no version number');
  if (version > target)
    throw new SaveError(`Save is version ${version}, newer than this build (${target})`);
  while (version < target) {
    const step = migrations.find((m) => m.from === version);
    if (!step) throw new SaveError(`No migration from save version ${version}`);
    current = { ...step.migrate(current, content), version: version + 1 };
    version += 1;
  }
  return current;
}

export function serializeSave(state: GameState): string {
  return JSON.stringify(state);
}

/**
 * Parses, migrates and validates a save, then reconciles it with the current
 * content. Throws SaveError if the save cannot be used.
 */
export function deserializeSave(
  raw: string,
  content: Content,
  migrations: Migration[] = MIGRATIONS,
): GameState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new SaveError('Save is not valid JSON');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    throw new SaveError('Save is not an object');
  const migrated = runMigrations(parsed as Record<string, unknown>, migrations, SAVE_VERSION, content);
  const result = saveSchema.safeParse(migrated);
  if (!result.success) throw new SaveError(`Save does not match version ${SAVE_VERSION}: ${result.error.message}`);
  return reconcile(result.data, content);
}
