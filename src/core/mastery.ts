/**
 * Shop mastery: every good the player collects counts towards stars for that
 * good, and each star makes it a little quicker to make, for good. It never
 * runs out of things to earn early on, and it keeps going after the last level.
 */
import type { Content } from '../content/schema';
import type { GameState } from './types';

type Rules = Content['economy']['mastery'];

/** The stars a good has earned after being collected `made` times. */
export function starsFor(made: number, rules: Rules): number {
  let stars = 0;
  while (stars < rules.starsAt.length && made >= rules.starsAt[stars]) stars += 1;
  return stars;
}

export function goodStars(state: GameState, content: Content, good: string): number {
  return starsFor(state.made[good] ?? 0, content.economy.mastery);
}

/** New batches of this good take their duration times this. */
export function masterySpeedMultiplier(state: GameState, content: Content, good: string): number {
  return 1 - (goodStars(state, content, good) * content.economy.mastery.speedPercentPerStar) / 100;
}

export type MasteryView = {
  made: number;
  stars: number;
  maxStars: number;
  /** How many must have been made in all for the next star, or null with every star earned. */
  nextAt: number | null;
  /** 0 to 1 from the last star to the next; 1 with every star earned. */
  progress: number;
  /** How much quicker this good is made now, in percent. */
  speedPercent: number;
};

/** A read-only summary of a good's mastery, for the UI. */
export function viewMastery(state: GameState, content: Content, good: string): MasteryView {
  const rules = content.economy.mastery;
  const made = state.made[good] ?? 0;
  const stars = starsFor(made, rules);
  const nextAt = rules.starsAt[stars] ?? null;
  const from = stars > 0 ? rules.starsAt[stars - 1] : 0;
  return {
    made,
    stars,
    maxStars: rules.starsAt.length,
    nextAt,
    progress: nextAt === null ? 1 : (made - from) / (nextAt - from),
    speedPercent: stars * rules.speedPercentPerStar,
  };
}

/** Every star earned across all goods. */
export function totalStars(state: GameState, content: Content): number {
  let stars = 0;
  for (const good of Object.keys(state.made)) stars += goodStars(state, content, good);
  return stars;
}
