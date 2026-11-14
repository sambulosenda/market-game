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
  migrate: (save: Record<string, unknown>) => Record<string, unknown>;
};

/** Version 1 is the first save format, so there is nothing to migrate yet. */
export const MIGRATIONS: Migration[] = [];

const batchSchema = z.object({
  id: z.number().int(),
  recipe: z.string(),
  startAt: z.number(),
  durationMs: z.number().nonnegative(),
});

const saveSchema = z.object({
  version: z.literal(SAVE_VERSION),
  createdAt: z.number(),
  clock: z.number(),
  nextBatchId: z.number().int().positive(),
  pantry: z.record(z.string(), z.number().int().nonnegative()),
  shops: z.record(z.string(), z.object({ level: z.number().int().min(1), queue: z.array(batchSchema) })),
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
    current = { ...step.migrate(current), version: version + 1 };
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
  const migrated = runMigrations(parsed as Record<string, unknown>, migrations, SAVE_VERSION);
  const result = saveSchema.safeParse(migrated);
  if (!result.success) throw new SaveError(`Save does not match version ${SAVE_VERSION}: ${result.error.message}`);
  return reconcile(result.data, content);
}
