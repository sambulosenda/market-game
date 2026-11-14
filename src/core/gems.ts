/**
 * What gems buy: finishing the batch that is baking, and extra queue slots.
 * Nothing here is needed to play; gems only save time.
 */
import type { Content } from '../content/schema';
import { effectiveNow } from './clock';
import { batchEndsAt } from './production';
import type { ActionResult, Batch, GameState } from './types';
import { spend } from './wallet';

function bakingBatch(queue: Batch[], t: number): Batch | undefined {
  return queue.find((b) => b.startAt <= t && batchEndsAt(b) > t);
}

/** The gems it costs to finish the shop's baking batch now, or null when nothing is baking. */
export function skipTimerCost(state: GameState, content: Content, shopId: string, now: number): number | null {
  const shop = state.shops[shopId];
  if (!shop) return null;
  const t = effectiveNow(state, now);
  const batch = bakingBatch(shop.queue, t);
  if (!batch) return null;
  const minutesLeft = (batchEndsAt(batch) - t) / 60_000;
  return Math.max(1, Math.ceil(minutesLeft / content.economy.gems.skipMinutesPerGem));
}

/** Finishes the batch that is baking. Everything queued behind it moves up by the time saved. */
export function skipTimer(state: GameState, content: Content, shopId: string, now: number): ActionResult {
  if (!content.shops[shopId]) return { ok: false, reason: 'unknown_shop' };
  const shop = state.shops[shopId];
  if (!shop) return { ok: false, reason: 'shop_not_owned' };
  const t = effectiveNow(state, now);
  const batch = bakingBatch(shop.queue, t);
  const gems = skipTimerCost(state, content, shopId, now);
  if (!batch || gems === null) return { ok: false, reason: 'nothing_baking' };
  const wallet = spend(state.wallet, 'gems', gems, 'skip_timer', t);
  if (!wallet) return { ok: false, reason: 'not_enough_gems' };
  const saved = batchEndsAt(batch) - t;
  const queue = shop.queue.map((b) => (b.startAt >= batch.startAt ? { ...b, startAt: b.startAt - saved } : b));
  return {
    ok: true,
    state: { ...state, clock: t, wallet, shops: { ...state.shops, [shopId]: { ...shop, queue } } },
    events: [{ type: 'timerSkipped', shop: shopId, batchId: batch.id, gems }],
  };
}

/** The gems the shop's next extra queue slot costs, or null when it has them all. */
export function queueSlotCost(state: GameState, content: Content, shopId: string): number | null {
  const shop = state.shops[shopId];
  if (!shop) return null;
  return content.economy.gems.extraQueueSlotCosts[shop.extraSlots ?? 0] ?? null;
}

/** Adds one queue slot to a shop for good. It stays when the shop is upgraded. */
export function buyQueueSlot(state: GameState, content: Content, shopId: string, now: number): ActionResult {
  if (!content.shops[shopId]) return { ok: false, reason: 'unknown_shop' };
  const shop = state.shops[shopId];
  if (!shop) return { ok: false, reason: 'shop_not_owned' };
  const gems = queueSlotCost(state, content, shopId);
  if (gems === null) return { ok: false, reason: 'max_level' };
  const t = effectiveNow(state, now);
  const wallet = spend(state.wallet, 'gems', gems, 'queue_slot', t);
  if (!wallet) return { ok: false, reason: 'not_enough_gems' };
  const extraSlots = (shop.extraSlots ?? 0) + 1;
  return {
    ok: true,
    state: { ...state, clock: t, wallet, shops: { ...state.shops, [shopId]: { ...shop, extraSlots } } },
    events: [{ type: 'queueSlotBought', shop: shopId, extraSlots, gems }],
  };
}
