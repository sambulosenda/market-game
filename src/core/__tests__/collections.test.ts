import { describe, expect, it } from 'vitest';

import realEconomy from '../../content/data/economy.json';
import { CUSTOMER_LOOKS } from '../../scene/crowd';
import { claimCollectionSet, collectionsWaiting, CUSTOMER_SET, viewCollections } from '../collections';
import { deserializeSave, serializeSave } from '../save';
import { createInitialState } from '../state';
import { tipCustomer } from '../tips';
import type { ActionResult, GameState } from '../types';
import { T0, testContent } from './fixtures';

function ok(result: ActionResult) {
  if (!result.ok) throw new Error(`action failed: ${result.reason}`);
  return result;
}

const fresh = (over: Partial<GameState> = {}): GameState => ({ ...createInitialState(testContent, T0, 1), ...over });
const set = (state: GameState, id: string) => viewCollections(state, testContent).find((s) => s.id === id)!;

// The test content has a bakery (loaf, croissant), a dairy (butter) and 3 customers.
// A goods set pays 4 gems and the customer set 6.
describe('collections', () => {
  it('has a set of goods for each shop, in street order, and one of customers', () => {
    const sets = viewCollections(fresh(), testContent);
    expect(sets.map((s) => s.id)).toEqual(['goods:bakery', 'goods:dairy', CUSTOMER_SET]);
    expect(sets[0]).toMatchObject({
      kind: 'goods',
      shop: 'bakery',
      found: 0,
      complete: false,
      claimed: false,
      gems: 4,
    });
    expect(sets[0].items).toEqual([
      { id: 'loaf', found: false },
      { id: 'croissant', found: false },
    ]);
    expect(sets[2].items.map((i) => i.id)).toEqual(['1', '2', '3']);
  });

  it('finds a good once it has been made', () => {
    const s = fresh({ made: { loaf: 1 } });
    expect(set(s, 'goods:bakery')).toMatchObject({ found: 1, complete: false });
    expect(set(s, 'goods:bakery').items[0]).toEqual({ id: 'loaf', found: true });
    expect(collectionsWaiting(s, testContent)).toBe(0);
  });

  it('pays the gems for a finished set, once', () => {
    const s = fresh({ made: { loaf: 3, croissant: 1 } });
    expect(collectionsWaiting(s, testContent)).toBe(1);
    const claimed = ok(claimCollectionSet(s, testContent, 'goods:bakery', T0 + 5));
    expect(claimed.state.wallet.gems).toBe(s.wallet.gems + 4);
    expect(claimed.state.wallet.log.at(-1)).toMatchObject({ reason: 'collection_set', currency: 'gems', amount: 4 });
    expect(claimed.events).toEqual([{ type: 'collectionSetClaimed', set: 'goods:bakery', gems: 4 }]);
    expect(collectionsWaiting(claimed.state, testContent)).toBe(0);
    expect(claimCollectionSet(claimed.state, testContent, 'goods:bakery', T0 + 6)).toEqual({
      ok: false,
      reason: 'already_claimed',
    });
  });

  it('refuses a set that is not finished or does not exist', () => {
    const s = fresh({ made: { loaf: 3 } });
    expect(claimCollectionSet(s, testContent, 'goods:bakery', T0)).toEqual({ ok: false, reason: 'set_not_complete' });
    expect(claimCollectionSet(s, testContent, 'goods:nowhere', T0)).toEqual({ ok: false, reason: 'unknown_set' });
  });

  it('adds a customer to the album on their first tip only', () => {
    const first = ok(tipCustomer(fresh(), testContent, T0, 2));
    expect(first.state.album.customers).toEqual([2]);
    expect(first.events).toEqual([{ type: 'customerTipped', coins: 1, newLook: 2 }]);
    const again = ok(tipCustomer(first.state, testContent, T0 + 1, 2));
    expect(again.state.album.customers).toEqual([2]);
    expect(again.events).toEqual([{ type: 'customerTipped', coins: 1 }]);
    expect(again.state.wallet.coins).toBe(first.state.wallet.coins + 1);
  });

  it('ignores a customer the content does not have', () => {
    for (const look of [0, 4, 1.5]) {
      expect(ok(tipCustomer(fresh(), testContent, T0, look)).state.album.customers).toEqual([]);
    }
  });

  it('pays for meeting every customer', () => {
    let s = fresh();
    for (const look of [3, 1, 2]) s = ok(tipCustomer(s, testContent, T0, look)).state;
    expect(set(s, CUSTOMER_SET)).toMatchObject({ found: 3, complete: true, gems: 6 });
    const gems = s.wallet.gems;
    expect(ok(claimCollectionSet(s, testContent, CUSTOMER_SET, T0)).state.wallet.gems).toBe(gems + 6);
  });

  it('is saved, and a version 4 save comes forward with an empty album', () => {
    const s = fresh({ made: { loaf: 1 }, album: { customers: [2], claimed: ['goods:dairy'] } });
    expect(deserializeSave(serializeSave(s), testContent).album).toEqual(s.album);
    const { album: _album, ...v4 } = s;
    const old = deserializeSave(JSON.stringify({ ...v4, version: 4 }), testContent);
    expect(old.album).toEqual({ customers: [], claimed: [] });
    expect(old.made).toEqual({ loaf: 1 });
  });

  it('drops customers and sets the content no longer has', () => {
    const s = fresh({ album: { customers: [2, 9, 2], claimed: ['goods:gone', CUSTOMER_SET] } });
    expect(deserializeSave(serializeSave(s), testContent).album).toEqual({ customers: [2], claimed: [CUSTOMER_SET] });
  });

  it('has as many customers in the config as the street can show', () => {
    expect(realEconomy.collections.customerLooks).toBe(CUSTOMER_LOOKS);
  });
});
