import type { GameState } from './types';

/**
 * The time the game treats as "now". If the device clock reads earlier than
 * anything the game has already seen, the clock moved backwards, and we hold
 * at the latest time seen so no progress is granted until it catches up.
 */
export function effectiveNow(state: GameState, now: number): number {
  return Math.max(now, state.clock);
}

export function clockMovedBack(state: GameState, now: number): boolean {
  return now < state.clock;
}
