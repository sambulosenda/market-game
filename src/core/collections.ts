/**
 * Collections: an album of every good, grouped by the shop that makes it, and
 * an album of the customers who walk the street. A good is found the first
 * time it is collected and a customer the first time they tip. Finishing a
 * set pays gems, once.
 */
import type { Content } from '../content/schema';
import { effectiveNow } from './clock';
import type { ActionResult, GameState } from './types';
import { earn } from './wallet';

export const CUSTOMER_SET = 'customers';
const goodsSetId = (shopId: string) => `goods:${shopId}`;

export type Album = {
  /** The looks of the customers who have tipped, each once, in the order they were met. */
  customers: number[];
  /** The ids of the sets whose reward has been paid. */
  claimed: string[];
};

export const NO_ALBUM: Album = { customers: [], claimed: [] };

export type CollectionSetView = {
  id: string;
  kind: 'goods' | 'customers';
  /** The shop whose goods these are, for a goods set. */
  shop?: string;
  /** A good id, or a customer's look as a string. */
  items: { id: string; found: boolean }[];
  found: number;
  complete: boolean;
  claimed: boolean;
  /** Gems paid for finishing the set. */
  gems: number;
};

/** Every set with what has been found, in street order, with the customers last. */
export function viewCollections(state: GameState, content: Content): CollectionSetView[] {
  const rules = content.economy.collections;
  const claimed = new Set(state.album.claimed);
  const met = new Set(state.album.customers);
  const build = (
    id: string,
    kind: CollectionSetView['kind'],
    items: CollectionSetView['items'],
    gems: number,
    shop?: string,
  ): CollectionSetView => {
    const found = items.filter((i) => i.found).length;
    return { id, kind, shop, items, found, complete: found === items.length, claimed: claimed.has(id), gems };
  };
  const sets = Object.values(content.shops)
    .sort((a, b) => a.lot - b.lot)
    .map((shop) => {
      const goods = Object.values(content.recipes)
        .filter((r) => r.shop === shop.id)
        .map((r) => ({ id: r.output, found: (state.made[r.output] ?? 0) > 0 }));
      return build(goodsSetId(shop.id), 'goods', goods, rules.goodsSetGems, shop.id);
    });
  const customers = Array.from({ length: rules.customerLooks }, (_, i) => ({
    id: String(i + 1),
    found: met.has(i + 1),
  }));
  return [...sets, build(CUSTOMER_SET, 'customers', customers, rules.customerSetGems)];
}

/** How many finished sets have a reward waiting. */
export function collectionsWaiting(state: GameState, content: Content): number {
  return viewCollections(state, content).filter((s) => s.complete && !s.claimed).length;
}

/** Adds a customer to the album the first time they are met. Returns the same state otherwise. */
export function meetCustomer(state: GameState, content: Content, look: number): GameState {
  const known = Number.isInteger(look) && look >= 1 && look <= content.economy.collections.customerLooks;
  if (!known || state.album.customers.includes(look)) return state;
  return { ...state, album: { ...state.album, customers: [...state.album.customers, look] } };
}

/** Pays the gems for a finished set, once. */
export function claimCollectionSet(state: GameState, content: Content, setId: string, now: number): ActionResult {
  const set = viewCollections(state, content).find((s) => s.id === setId);
  if (!set) return { ok: false, reason: 'unknown_set' };
  if (set.claimed) return { ok: false, reason: 'already_claimed' };
  if (!set.complete) return { ok: false, reason: 'set_not_complete' };
  const t = effectiveNow(state, now);
  return {
    ok: true,
    state: {
      ...state,
      clock: t,
      wallet: earn(state.wallet, 'gems', set.gems, 'collection_set', t),
      album: { ...state.album, claimed: [...state.album.claimed, setId] },
    },
    events: [{ type: 'collectionSetClaimed', set: setId, gems: set.gems }],
  };
}

/** Holds a loaded album inside the current content: unknown customers and sets are dropped. */
export function reconcileAlbum(state: GameState, content: Content): Album {
  const looks = content.economy.collections.customerLooks;
  const sets = new Set([CUSTOMER_SET, ...Object.keys(content.shops).map(goodsSetId)]);
  return {
    customers: [...new Set(state.album.customers)].filter((look) => look >= 1 && look <= looks),
    claimed: [...new Set(state.album.claimed)].filter((id) => sets.has(id)),
  };
}
