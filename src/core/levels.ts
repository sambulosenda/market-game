import type { Content } from '../content/schema';
import type { GameEvent, GameState } from './types';
import { earn } from './wallet';

/** Total XP the next level needs, or null at the top level. */
export function xpForNextLevel(state: GameState, content: Content): number | null {
  return content.levels[state.level]?.xp ?? null;
}

/** Progress through the current level, 0 to 1. Stays at 1 at the top level. */
export function levelProgress(state: GameState, content: Content): number {
  const next = xpForNextLevel(state, content);
  if (next === null) return 1;
  const from = content.levels[state.level - 1].xp;
  return Math.min(1, Math.max(0, (state.xp - from) / (next - from)));
}

/**
 * Adds XP and applies every level-up it causes: each new level pays its gems
 * and reports what it unlocks. XP keeps counting at the top level.
 */
export function addXp(
  state: GameState,
  content: Content,
  amount: number,
  at: number,
): { state: GameState; events: GameEvent[] } {
  const xp = state.xp + Math.max(0, amount);
  let level = state.level;
  let wallet = state.wallet;
  const events: GameEvent[] = [];
  while (level < content.levels.length && xp >= content.levels[level].xp) {
    const reached = content.levels[level];
    level += 1;
    wallet = earn(wallet, 'gems', reached.gems, 'level_up', at);
    events.push({ type: 'levelUp', level, gems: reached.gems, unlocks: reached.unlocks });
  }
  return { state: { ...state, xp, level, wallet }, events };
}
