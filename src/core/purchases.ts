/**
 * What a purchase from the app store gives the player. The store itself is
 * the shell's job; this only turns a product that was paid for into gems and
 * coins, and remembers the products that can be bought once.
 */
import type { Content } from '../content/schema';
import { effectiveNow } from './clock';
import type { ActionResult, GameState } from './types';
import { earn } from './wallet';

export type Product = Content['economy']['products'][number];

export function findProduct(content: Content, productId: string): Product | undefined {
  return content.economy.products.find((p) => p.id === productId);
}

/** True when the product can still be bought: always for gems, once for a bundle. */
export function canBuyProduct(state: GameState, content: Content, productId: string): boolean {
  const product = findProduct(content, productId);
  return !!product && !(product.once && state.purchased.includes(productId));
}

/** Gives the player what a paid-for product holds. A once-only product is given once. */
export function grantPurchase(state: GameState, content: Content, productId: string, now: number): ActionResult {
  const product = findProduct(content, productId);
  if (!product) return { ok: false, reason: 'unknown_product' };
  if (product.once && state.purchased.includes(productId)) return { ok: false, reason: 'already_owned' };
  const t = effectiveNow(state, now);
  let wallet = earn(state.wallet, 'gems', product.gems, 'purchase', t);
  wallet = earn(wallet, 'coins', product.coins, 'purchase', t);
  return {
    ok: true,
    state: {
      ...state,
      clock: t,
      wallet,
      purchased: product.once ? [...state.purchased, productId] : state.purchased,
    },
    events: [{ type: 'purchaseGranted', product: productId, gems: product.gems, coins: product.coins }],
  };
}

/**
 * Restores once-only products the store says this player owns, such as after
 * reinstalling. Gems bought before are spent or saved already and are not
 * given again. Returns the products given back.
 */
export function restorePurchases(
  state: GameState,
  content: Content,
  ownedProductIds: string[],
  now: number,
): { state: GameState; restored: string[] } {
  let next = state;
  const restored: string[] = [];
  for (const id of new Set(ownedProductIds)) {
    if (!findProduct(content, id)?.once) continue;
    const result = grantPurchase(next, content, id, now);
    if (!result.ok) continue;
    next = result.state;
    restored.push(id);
  }
  return { state: next, restored };
}
