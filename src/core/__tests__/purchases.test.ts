import { describe, expect, it } from 'vitest';

import { canBuyProduct, grantPurchase, restorePurchases } from '../purchases';
import { deserializeSave, serializeSave } from '../save';
import { createInitialState } from '../state';
import type { GameState } from '../types';
import { T0, testContent } from './fixtures';

const fresh = (): GameState => createInitialState(testContent, T0, 1);

function grant(state: GameState, id: string) {
  const result = grantPurchase(state, testContent, id, T0 + 5);
  if (!result.ok) throw new Error(result.reason);
  return result;
}

// The test content sells a once-only bundle (20 gems, 100 coins) and a pack of 10 gems.
describe('purchases', () => {
  it('gives the gems of a pack every time it is bought, and logs them', () => {
    const s = fresh();
    const once = grant(s, 'test.gems');
    const twice = grant(once.state, 'test.gems');
    expect(twice.state.wallet.gems).toBe(s.wallet.gems + 20);
    expect(twice.state.wallet.log.at(-1)).toMatchObject({ reason: 'purchase', currency: 'gems', amount: 10 });
    expect(twice.state.purchased).toEqual([]);
    expect(once.events).toEqual([{ type: 'purchaseGranted', product: 'test.gems', gems: 10, coins: 0 }]);
  });

  it('gives a bundle once', () => {
    const s = fresh();
    const bought = grant(s, 'test.bundle').state;
    expect(bought.wallet.gems).toBe(s.wallet.gems + 20);
    expect(bought.wallet.coins).toBe(s.wallet.coins + 100);
    expect(bought.purchased).toEqual(['test.bundle']);
    expect(canBuyProduct(s, testContent, 'test.bundle')).toBe(true);
    expect(canBuyProduct(bought, testContent, 'test.bundle')).toBe(false);
    expect(grantPurchase(bought, testContent, 'test.bundle', T0)).toEqual({ ok: false, reason: 'already_owned' });
  });

  it('refuses a product it does not know', () => {
    expect(grantPurchase(fresh(), testContent, 'test.nothing', T0)).toEqual({ ok: false, reason: 'unknown_product' });
    expect(canBuyProduct(fresh(), testContent, 'test.nothing')).toBe(false);
  });

  it('restores a bundle the store says is owned, but never gems', () => {
    const s = fresh();
    const { state, restored } = restorePurchases(s, testContent, ['test.gems', 'test.bundle', 'test.bundle', 'x'], T0);
    expect(restored).toEqual(['test.bundle']);
    expect(state.wallet.gems).toBe(s.wallet.gems + 20);
    const again = restorePurchases(state, testContent, ['test.bundle'], T0);
    expect(again.restored).toEqual([]);
    expect(again.state).toBe(state);
  });

  it('is saved, and a version 5 save comes forward with nothing bought', () => {
    const s = grant(fresh(), 'test.bundle').state;
    expect(deserializeSave(serializeSave(s), testContent).purchased).toEqual(['test.bundle']);
    const { purchased: _purchased, ...v5 } = s;
    expect(deserializeSave(JSON.stringify({ ...v5, version: 5 }), testContent).purchased).toEqual([]);
  });
});
