import type { Content } from '../content/schema';
import { effectiveNow } from './clock';
import { meetCustomer } from './collections';
import type { ActionResult, GameState } from './types';
import { earn } from './wallet';

/** What a customer on the street tips when tapped: small, and a little more at higher levels. */
export function tipCoins(state: GameState, content: Content): number {
  const { base, perLevel } = content.economy.tips;
  return Math.floor(base + perLevel * state.level);
}

/**
 * Takes a tip from a customer. The street decides who can be tipped and how
 * often. `look` is which customer it was; the first tip from each look adds
 * them to the album.
 */
export function tipCustomer(state: GameState, content: Content, now: number, look?: number): ActionResult {
  const t = effectiveNow(state, now);
  const coins = tipCoins(state, content);
  const met = look === undefined ? state : meetCustomer(state, content, look);
  return {
    ok: true,
    state: { ...met, clock: t, wallet: earn(state.wallet, 'coins', coins, 'tip', t) },
    events: [{ type: 'customerTipped', coins, ...(met !== state ? { newLook: look } : {}) }],
  };
}
