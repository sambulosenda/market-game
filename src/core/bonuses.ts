import type { Content, LandmarkBonus } from '../content/schema';
import type { GameState } from './types';

/** The bonuses of every fully restored landmark. They apply for good. */
export function activeBonuses(state: GameState, content: Content): LandmarkBonus[] {
  return Object.values(content.landmarks)
    .filter((l) => (state.landmarks[l.id]?.stage ?? 0) >= l.stages.length)
    .map((l) => l.bonus);
}

/** Orders pay their coins times this. */
export function orderCoinMultiplier(state: GameState, content: Content): number {
  let percent = 0;
  for (const b of activeBonuses(state, content)) if (b.type === 'order_coins') percent += b.percent;
  return 1 + percent / 100;
}

/** New batches take their duration times this. */
export function batchSpeedMultiplier(state: GameState, content: Content): number {
  let multiplier = 1;
  for (const b of activeBonuses(state, content)) if (b.type === 'batch_speed') multiplier *= 1 - b.percent / 100;
  return multiplier;
}

export function extraOrderSlots(state: GameState, content: Content): number {
  let slots = 0;
  for (const b of activeBonuses(state, content)) if (b.type === 'order_slots') slots += b.slots;
  return slots;
}
