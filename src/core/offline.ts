import type { Content } from '../content/schema';
import { clockMovedBack, effectiveNow } from './clock';
import { batchEndsAt } from './production';
import type { GameState } from './types';

export type WelcomeBack = {
  /** How long the player was away, by the game's clock. */
  awayMs: number;
  /** Goods that finished while away, by good id. Empty if nothing finished. */
  finished: Record<string, number>;
  /** True when the device clock reads earlier than the last time the game saw. */
  clockMovedBack: boolean;
};

/**
 * Works out what happened while the game was closed. Because every batch
 * stores its start time and duration, nothing needs simulating: a batch is
 * finished if it ended before now. This only reports those batches and moves
 * the clock forward; they wait in the queue until the player collects them.
 */
export function resume(
  state: GameState,
  content: Content,
  now: number,
): { state: GameState; summary: WelcomeBack } {
  const t = effectiveNow(state, now);
  const since = state.clock;
  const finished: Record<string, number> = {};
  for (const shop of Object.values(state.shops)) {
    for (const batch of shop.queue) {
      const end = batchEndsAt(batch);
      if (end > since && end <= t) {
        const good = content.recipes[batch.recipe].output;
        finished[good] = (finished[good] ?? 0) + 1;
      }
    }
  }
  return {
    state: t === state.clock ? state : { ...state, clock: t },
    summary: { awayMs: t - since, finished, clockMovedBack: clockMovedBack(state, now) },
  };
}

/** Records that the player has left (the app went to the background). */
export function pause(state: GameState, now: number): GameState {
  const t = effectiveNow(state, now);
  return t === state.clock ? state : { ...state, clock: t };
}
