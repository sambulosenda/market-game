import type { Content } from '../content/schema';
import { type GameState, SAVE_VERSION, type ShopState } from './types';

export function createInitialState(content: Content, now: number): GameState {
  const shops: Record<string, ShopState> = {};
  for (const shop of Object.values(content.shops)) {
    if (shop.startsOwned) shops[shop.id] = { level: 1, queue: [] };
  }
  return {
    version: SAVE_VERSION,
    createdAt: now,
    clock: now,
    nextBatchId: 1,
    pantry: {},
    shops,
  };
}

/**
 * Brings a loaded save in line with the current content, so a config change
 * shipped in an update never leaves a save pointing at things that no longer
 * exist: shops that now start owned are added, and batches for removed
 * recipes or shops are dropped.
 */
export function reconcile(state: GameState, content: Content): GameState {
  const shops: Record<string, ShopState> = {};
  for (const [id, shop] of Object.entries(state.shops)) {
    if (!content.shops[id]) continue;
    shops[id] = { ...shop, queue: shop.queue.filter((b) => content.recipes[b.recipe]?.shop === id) };
  }
  for (const shop of Object.values(content.shops)) {
    if (shop.startsOwned && !shops[shop.id]) shops[shop.id] = { level: 1, queue: [] };
  }
  const pantry: Record<string, number> = {};
  for (const [good, qty] of Object.entries(state.pantry)) {
    if (content.goods[good] && qty > 0) pantry[good] = qty;
  }
  return { ...state, shops, pantry };
}
