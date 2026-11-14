import type { Content } from '../content/schema';
import { effectiveNow } from './clock';
import type { ActionResult, GameState } from './types';
import { spend } from './wallet';

/** The coins the shop's next level costs, or null at its top level. */
export function shopUpgradeCost(state: GameState, content: Content, shopId: string): number | null {
  const shop = state.shops[shopId];
  if (!shop) return null;
  return content.shops[shopId]?.levels[shop.level]?.cost ?? null;
}

export function buyShop(state: GameState, content: Content, shopId: string, now: number): ActionResult {
  const config = content.shops[shopId];
  if (!config) return { ok: false, reason: 'unknown_shop' };
  if (state.shops[shopId]) return { ok: false, reason: 'already_owned' };
  if (state.level < content.unlockLevel.shops[shopId]) return { ok: false, reason: 'level_too_low' };
  const t = effectiveNow(state, now);
  const wallet = spend(state.wallet, 'coins', config.levels[0].cost, 'buy_shop', t);
  if (!wallet) return { ok: false, reason: 'not_enough_coins' };
  return {
    ok: true,
    state: { ...state, clock: t, wallet, shops: { ...state.shops, [shopId]: { level: 1, queue: [] } } },
    events: [{ type: 'shopBought', shop: shopId }],
  };
}

/**
 * Moves a shop up one level. Batches already in the queue keep the duration
 * they were started with; new ones use the new level.
 */
export function upgradeShop(state: GameState, content: Content, shopId: string, now: number): ActionResult {
  const config = content.shops[shopId];
  if (!config) return { ok: false, reason: 'unknown_shop' };
  const shop = state.shops[shopId];
  if (!shop) return { ok: false, reason: 'shop_not_owned' };
  const next = config.levels[shop.level];
  if (!next) return { ok: false, reason: 'max_level' };
  const t = effectiveNow(state, now);
  const wallet = spend(state.wallet, 'coins', next.cost, 'upgrade_shop', t);
  if (!wallet) return { ok: false, reason: 'not_enough_coins' };
  const level = shop.level + 1;
  return {
    ok: true,
    state: { ...state, clock: t, wallet, shops: { ...state.shops, [shopId]: { ...shop, level } } },
    events: [{ type: 'shopUpgraded', shop: shopId, level }],
  };
}
