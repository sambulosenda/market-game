import type { Content, ShopLevel } from '../content/schema';
import { effectiveNow } from './clock';
import type { ActionResult, Batch, GameEvent, GameState, ShopState } from './types';

export function batchEndsAt(batch: Batch): number {
  return batch.startAt + batch.durationMs;
}

export function isBatchReady(batch: Batch, now: number): boolean {
  return batchEndsAt(batch) <= now;
}

export function shopLevelConfig(content: Content, shopId: string, shop: ShopState): ShopLevel {
  const levels = content.shops[shopId].levels;
  return levels[Math.min(Math.max(shop.level, 1), levels.length) - 1];
}

export function recipeDurationMs(content: Content, recipeId: string, level: ShopLevel): number {
  return Math.round(content.recipes[recipeId].durationSec * 1000 * level.durationMultiplier);
}

/** True when the pantry holds every input the recipe needs. */
export function hasInputs(state: GameState, content: Content, recipeId: string): boolean {
  return content.recipes[recipeId].inputs.every((i) => (state.pantry[i.good] ?? 0) >= i.qty);
}

/**
 * Starts a batch: takes the inputs from the pantry now, and queues the batch
 * behind any batch already in the shop.
 */
export function startBatch(
  state: GameState,
  content: Content,
  shopId: string,
  recipeId: string,
  now: number,
): ActionResult {
  if (!content.shops[shopId]) return { ok: false, reason: 'unknown_shop' };
  const shop = state.shops[shopId];
  if (!shop) return { ok: false, reason: 'shop_not_owned' };
  const recipe = content.recipes[recipeId];
  if (!recipe) return { ok: false, reason: 'unknown_recipe' };
  if (recipe.shop !== shopId) return { ok: false, reason: 'wrong_shop' };
  const level = shopLevelConfig(content, shopId, shop);
  if (shop.queue.length >= level.queueSize) return { ok: false, reason: 'queue_full' };
  if (!hasInputs(state, content, recipeId)) return { ok: false, reason: 'missing_inputs' };

  const t = effectiveNow(state, now);
  const pantry = { ...state.pantry };
  for (const input of recipe.inputs) {
    pantry[input.good] -= input.qty;
    if (pantry[input.good] === 0) delete pantry[input.good];
  }
  const last = shop.queue[shop.queue.length - 1];
  const batch: Batch = {
    id: state.nextBatchId,
    recipe: recipeId,
    startAt: last ? Math.max(t, batchEndsAt(last)) : t,
    durationMs: recipeDurationMs(content, recipeId, level),
  };
  const next: GameState = {
    ...state,
    clock: t,
    nextBatchId: state.nextBatchId + 1,
    pantry,
    shops: { ...state.shops, [shopId]: { ...shop, queue: [...shop.queue, batch] } },
  };
  return {
    ok: true,
    state: next,
    events: [
      { type: 'batchStarted', shop: shopId, recipe: recipeId, batchId: batch.id, endsAt: batchEndsAt(batch) },
    ],
  };
}

/** Moves every finished batch in the shop into the pantry. */
export function collect(
  state: GameState,
  content: Content,
  shopId: string,
  now: number,
): ActionResult {
  if (!content.shops[shopId]) return { ok: false, reason: 'unknown_shop' };
  const shop = state.shops[shopId];
  if (!shop) return { ok: false, reason: 'shop_not_owned' };
  const t = effectiveNow(state, now);
  const ready = shop.queue.filter((b) => isBatchReady(b, t));
  if (!ready.length) return { ok: false, reason: 'nothing_ready' };

  const pantry = { ...state.pantry };
  const collected: Record<string, number> = {};
  for (const batch of ready) {
    const good = content.recipes[batch.recipe].output;
    pantry[good] = (pantry[good] ?? 0) + 1;
    collected[good] = (collected[good] ?? 0) + 1;
  }
  const events: GameEvent[] = Object.entries(collected).map(([good, qty]) => ({
    type: 'batchCollected',
    shop: shopId,
    good,
    qty,
  }));
  const queue = shop.queue.filter((b) => !isBatchReady(b, t));
  return {
    ok: true,
    state: { ...state, clock: t, pantry, shops: { ...state.shops, [shopId]: { ...shop, queue } } },
    events,
  };
}

export type BatchStatus = 'ready' | 'baking' | 'waiting';

export type BatchView = {
  batch: Batch;
  status: BatchStatus;
  /** 0 to 1 while baking; 1 when ready; 0 while waiting. */
  progress: number;
  endsAt: number;
};

export type ShopView = {
  queueSize: number;
  batches: BatchView[];
  readyCount: number;
  /** The batch currently baking, if any. */
  active?: BatchView;
};

/** A read-only summary of a shop's queue at a moment, for the scene and UI. */
export function viewShop(state: GameState, content: Content, shopId: string, now: number): ShopView {
  const shop = state.shops[shopId];
  const t = effectiveNow(state, now);
  const queueSize = shopLevelConfig(content, shopId, shop).queueSize;
  const batches = shop.queue.map((batch): BatchView => {
    const endsAt = batchEndsAt(batch);
    if (endsAt <= t) return { batch, status: 'ready', progress: 1, endsAt };
    if (batch.startAt <= t)
      return { batch, status: 'baking', progress: (t - batch.startAt) / batch.durationMs, endsAt };
    return { batch, status: 'waiting', progress: 0, endsAt };
  });
  return {
    queueSize,
    batches,
    readyCount: batches.filter((b) => b.status === 'ready').length,
    active: batches.find((b) => b.status === 'baking'),
  };
}
