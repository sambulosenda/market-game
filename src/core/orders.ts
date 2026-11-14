import type { Content, Recipe } from '../content/schema';
import { extraOrderSlots, orderCoinMultiplier } from './bonuses';
import { effectiveNow } from './clock';
import { recordDaily } from './daily';
import { addXp } from './levels';
import { nextRandom, pickWeighted } from './rng';
import type { ActionResult, GameEvent, GameState, Order, OrderSlot } from './types';
import { earn } from './wallet';

/** The row of a by-level table that applies at `level`: the last one whose minLevel is not above it. */
function rowFor<T extends { minLevel: number }>(rows: T[], level: number): T {
  let row = rows[0];
  for (const r of rows) if (r.minLevel <= level) row = r;
  return row;
}

/** True when the player can start this recipe today: shop owned and high enough, recipe unlocked. */
export function recipeAvailable(state: GameState, content: Content, recipeId: string): boolean {
  const recipe = content.recipes[recipeId];
  const shop = recipe && state.shops[recipe.shop];
  if (!shop) return false;
  return state.level >= content.unlockLevel.recipes[recipeId] && shop.level >= recipe.shopLevel;
}

/**
 * Goods an order may ask for: only those the player can make right now,
 * including everything their recipes need, so every order can be filled.
 */
export function orderableGoods(state: GameState, content: Content): string[] {
  const recipeFor: Record<string, Recipe> = Object.create(null);
  for (const r of Object.values(content.recipes)) recipeFor[r.output] = r;
  const known: Record<string, boolean> = Object.create(null);
  const canMake = (good: string, path: string[]): boolean => {
    if (good in known) return known[good];
    if (path.includes(good)) return false;
    const recipe = recipeFor[good];
    const ok =
      !!recipe &&
      recipeAvailable(state, content, recipe.id) &&
      recipe.inputs.every((i) => canMake(i.good, [...path, good]));
    known[good] = ok;
    return ok;
  };
  return Object.keys(content.goods).filter((g) => canMake(g, []));
}

/** Coins an order pays before landmark bonuses. */
export function baseOrderCoins(content: Content, items: Order['items']): number {
  const { coinMultiplier, extraKindBonus } = content.economy.orders;
  let value = 0;
  for (const item of items) value += item.qty * content.goods[item.good].value;
  return Math.round(value * coinMultiplier * (1 + extraKindBonus * (items.length - 1)));
}

/** Coins the order pays if filled now, with landmark bonuses. */
export function orderCoins(state: GameState, content: Content, order: Order): number {
  return Math.round(order.coins * orderCoinMultiplier(state, content));
}

export function canFillOrder(state: GameState, order: Order): boolean {
  return order.items.every((i) => (state.pantry[i.good] ?? 0) >= i.qty);
}

/** How many slots the board has: the level's, plus any from landmarks. */
export function orderSlotCount(state: GameState, content: Content): number {
  return content.levels[state.level - 1].orderSlots + extraOrderSlots(state, content);
}

/** Makes one order for the player's level, or null if nothing can be ordered yet. */
function generateOrder(state: GameState, content: Content): { order: Order; rng: number; nextId: number } | null {
  const pool = orderableGoods(state, content);
  if (!pool.length) return null;
  let seed = state.rng;
  const roll = () => {
    const r = nextRandom(seed);
    seed = r.seed;
    return r.value;
  };
  const { kinds, maxQty } = content.economy.orders;
  const kindCount = Math.min(pickWeighted(rowFor(kinds, state.level).weights, roll()) + 1, pool.length);
  const max = rowFor(maxQty, state.level).max;
  const items: Order['items'] = [];
  for (let k = 0; k < kindCount; k++) {
    const i = pickWeighted(
      pool.map((g) => content.goods[g].orderWeight),
      roll(),
    );
    const [good] = pool.splice(i, 1);
    const most = Math.min(max, content.goods[good].maxOrderQty ?? max);
    items.push({ good, qty: 1 + Math.floor(roll() * most) });
  }
  let xp = 0;
  for (const item of items) xp += item.qty * content.goods[item.good].xp;
  const order: Order = { id: state.orders.nextId, items, coins: baseOrderCoins(content, items), xp };
  return { order, rng: seed, nextId: state.orders.nextId + 1 };
}

/**
 * Fills every slot whose wait is over and adds slots the player has earned.
 * Returns the same state object when nothing changed, so it is cheap to call
 * often.
 */
export function refreshOrders(state: GameState, content: Content, now: number): GameState {
  const t = effectiveNow(state, now);
  const count = orderSlotCount(state, content);
  let current = state;
  const slots: OrderSlot[] = [...state.orders.slots];
  let changed = false;
  for (let i = 0; i < Math.max(count, slots.length); i++) {
    const slot = slots[i];
    if (slot && ('order' in slot || slot.refillAt > t)) continue;
    const made = generateOrder(current, content);
    if (!made) {
      if (!slot) {
        slots[i] = { refillAt: t };
        changed = true;
      }
      continue;
    }
    slots[i] = { order: made.order };
    current = { ...current, rng: made.rng, orders: { slots, nextId: made.nextId } };
    changed = true;
  }
  if (!changed) return state;
  return { ...current, clock: t, orders: { slots, nextId: current.orders.nextId } };
}

function slotIndex(state: GameState, orderId: number): number {
  return state.orders.slots.findIndex((s) => 'order' in s && s.order.id === orderId);
}

/** Hands over the order's goods for coins and XP. A new order takes the slot straight away. */
export function fillOrder(state: GameState, content: Content, orderId: number, now: number): ActionResult {
  const i = slotIndex(state, orderId);
  if (i < 0) return { ok: false, reason: 'unknown_order' };
  const { order } = state.orders.slots[i] as { order: Order };
  if (!canFillOrder(state, order)) return { ok: false, reason: 'missing_goods' };

  const t = effectiveNow(state, now);
  const pantry = { ...state.pantry };
  for (const item of order.items) {
    pantry[item.good] -= item.qty;
    if (pantry[item.good] === 0) delete pantry[item.good];
  }
  const coins = orderCoins(state, content, order);
  const slots = [...state.orders.slots];
  slots[i] = { refillAt: t };
  const paid: GameState = {
    ...state,
    clock: t,
    pantry,
    wallet: earn(state.wallet, 'coins', coins, 'order', t),
    orders: { ...state.orders, slots },
  };
  const counted = recordDaily(recordDaily(paid, 'fill_orders', 1), 'earn_coins', coins);
  const levelled = addXp(counted, content, order.xp, t);
  const events: GameEvent[] = [{ type: 'orderFilled', orderId, coins, xp: order.xp }, ...levelled.events];
  // After the XP, so the new order (and any new slot) reflects a level-up.
  return { ok: true, state: refreshOrders(levelled.state, content, t), events };
}

/** Throws the order away. Its slot stays empty for the skip cooldown. */
export function skipOrder(state: GameState, content: Content, orderId: number, now: number): ActionResult {
  const i = slotIndex(state, orderId);
  if (i < 0) return { ok: false, reason: 'unknown_order' };
  const t = effectiveNow(state, now);
  const refillAt = t + content.economy.orders.skipCooldownSec * 1000;
  const slots = [...state.orders.slots];
  slots[i] = { refillAt };
  return {
    ok: true,
    state: refreshOrders({ ...state, clock: t, orders: { ...state.orders, slots } }, content, t),
    events: [{ type: 'orderSkipped', orderId, refillAt }],
  };
}
