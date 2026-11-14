import type { Content } from '../content/schema';
import { effectiveNow } from './clock';
import type { ActionResult, GameState } from './types';
import { spend } from './wallet';

/** How many goods the pantry holds, of every kind together. */
export function pantryCount(state: GameState): number {
  let n = 0;
  for (const qty of Object.values(state.pantry)) n += qty;
  return n;
}

export function pantryCapacity(state: GameState, content: Content): number {
  const levels = content.economy.pantry.levels;
  return levels[Math.min(Math.max(state.pantryLevel, 1), levels.length) - 1].capacity;
}

export function pantrySpace(state: GameState, content: Content): number {
  return Math.max(0, pantryCapacity(state, content) - pantryCount(state));
}

/** The coins the next pantry level costs, or null at the top level. */
export function pantryUpgradeCost(state: GameState, content: Content): number | null {
  return content.economy.pantry.levels[state.pantryLevel]?.cost ?? null;
}

export function upgradePantry(state: GameState, content: Content, now: number): ActionResult {
  const next = content.economy.pantry.levels[state.pantryLevel];
  if (!next) return { ok: false, reason: 'max_level' };
  const t = effectiveNow(state, now);
  const wallet = spend(state.wallet, 'coins', next.cost, 'upgrade_pantry', t);
  if (!wallet) return { ok: false, reason: 'not_enough_coins' };
  const level = state.pantryLevel + 1;
  return {
    ok: true,
    state: { ...state, clock: t, wallet, pantryLevel: level },
    events: [{ type: 'pantryUpgraded', level, capacity: next.capacity }],
  };
}
