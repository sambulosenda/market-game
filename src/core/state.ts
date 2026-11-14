import type { Content } from '../content/schema';
import { refreshOrders } from './orders';
import { type GameState, type OrderSlot, SAVE_VERSION, type ShopState } from './types';

/**
 * A new game. `seed` starts the random number generator; it defaults to the
 * start time, and tests pass a fixed one.
 */
export function createInitialState(content: Content, now: number, seed: number = now): GameState {
  const shops: Record<string, ShopState> = {};
  for (const shop of Object.values(content.shops)) {
    if (shop.startsOwned) shops[shop.id] = { level: 1, queue: [] };
  }
  const state: GameState = {
    version: SAVE_VERSION,
    createdAt: now,
    clock: now,
    nextBatchId: 1,
    pantry: {},
    pantryLevel: 1,
    shops,
    wallet: { coins: content.economy.startingCoins, gems: content.economy.startingGems, log: [] },
    xp: 0,
    level: 1,
    orders: { slots: [], nextId: 1 },
    landmarks: {},
    rng: seed >>> 0,
  };
  return refreshOrders(state, content, now);
}

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

/**
 * Brings a loaded save in line with the current content, so a config change
 * shipped in an update never leaves a save pointing at things that no longer
 * exist: shops that now start owned are added, batches and orders for removed
 * recipes or goods are dropped, and levels are held inside the new tables.
 */
export function reconcile(state: GameState, content: Content): GameState {
  const shops: Record<string, ShopState> = {};
  for (const [id, shop] of Object.entries(state.shops)) {
    const config = content.shops[id];
    if (!config) continue;
    shops[id] = {
      level: clamp(shop.level, 1, config.levels.length),
      queue: shop.queue.filter((b) => content.recipes[b.recipe]?.shop === id),
    };
  }
  for (const shop of Object.values(content.shops)) {
    if (shop.startsOwned && !shops[shop.id]) shops[shop.id] = { level: 1, queue: [] };
  }
  const pantry: Record<string, number> = {};
  for (const [good, qty] of Object.entries(state.pantry)) {
    if (content.goods[good] && qty > 0) pantry[good] = qty;
  }
  const landmarks: GameState['landmarks'] = {};
  for (const [id, landmark] of Object.entries(state.landmarks)) {
    const config = content.landmarks[id];
    if (config) landmarks[id] = { stage: clamp(landmark.stage, 0, config.stages.length) };
  }
  // An order for a good that no longer exists becomes an empty slot, refilled at once.
  const slots = state.orders.slots.map((slot): OrderSlot =>
    'order' in slot && !slot.order.items.every((i) => content.goods[i.good]) ? { refillAt: state.clock } : slot,
  );
  // The level follows from XP, so a changed XP table moves it.
  let level = 1;
  while (level < content.levels.length && state.xp >= content.levels[level].xp) level += 1;
  return {
    ...state,
    shops,
    pantry,
    pantryLevel: clamp(state.pantryLevel, 1, content.economy.pantry.levels.length),
    landmarks,
    level,
    orders: { ...state.orders, slots },
  };
}
