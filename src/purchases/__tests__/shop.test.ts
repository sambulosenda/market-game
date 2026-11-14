import { describe, expect, it } from 'vitest';

import { createShop, type ShopBackend } from '../shop';

function setup(over: Partial<ShopBackend> = {}, refuse = false) {
  const granted: string[] = [];
  const bought: string[] = [];
  const errors: unknown[] = [];
  let calls = 0;
  const backend: ShopBackend = {
    products: async (ids) => {
      calls += 1;
      return [
        { id: 'gems', price: '£1.99' },
        { id: 'bundle', price: '£2.99' },
      ].filter((p) => ids.includes(p.id));
    },
    buy: async () => 'bought',
    owned: async () => ['bundle', 'gems'],
    ...over,
  };
  const shop = createShop({
    backend,
    productIds: () => ['bundle', 'gems', 'missing'],
    grant: (id) => {
      if (refuse) return false;
      granted.push(id);
      return true;
    },
    restore: (owned) => owned.filter((id) => id === 'bundle'),
    onPurchase: (l) => bought.push(`${l.id} ${l.price}`),
    onError: (e) => errors.push(e),
  });
  return { shop, granted, bought, errors, calls: () => calls };
}

describe('gem shop', () => {
  it('is closed with no store set up', async () => {
    const shop = createShop({ backend: null, productIds: () => ['gems'], grant: () => true, restore: () => [] });
    expect(shop.available).toBe(false);
    expect(await shop.load()).toBeNull();
    expect(await shop.buy('gems')).toBe('failed');
    expect(await shop.restore()).toBeNull();
  });

  it('lists what the store has, in the game order, and asks the store once', async () => {
    const t = setup();
    expect(await t.shop.load()).toEqual([
      { id: 'bundle', price: '£2.99' },
      { id: 'gems', price: '£1.99' },
    ]);
    await t.shop.load();
    expect(t.calls()).toBe(1);
  });

  it('gives the product after it is paid for, and reports the purchase', async () => {
    const t = setup();
    expect(await t.shop.buy('gems')).toBe('bought');
    expect(t.granted).toEqual(['gems']);
    expect(t.bought).toEqual(['gems £1.99']);
  });

  it('gives nothing when the player backs out or the store fails', async () => {
    const cancelled = setup({ buy: async () => 'cancelled' });
    expect(await cancelled.shop.buy('gems')).toBe('cancelled');
    const failed = setup({ buy: async () => Promise.reject(new Error('declined')) });
    expect(await failed.shop.buy('gems')).toBe('failed');
    expect([...cancelled.granted, ...failed.granted, ...failed.bought]).toEqual([]);
    expect(failed.errors).toHaveLength(1);
  });

  it('takes one purchase at a time', async () => {
    let finish: (v: 'bought') => void = () => {};
    const t = setup({ buy: () => new Promise((resolve) => (finish = resolve)) });
    const first = t.shop.buy('gems');
    expect(await t.shop.buy('gems')).toBe('failed');
    finish('bought');
    expect(await first).toBe('bought');
    expect(t.granted).toEqual(['gems']);
  });

  it('reports a failure when the game refuses a paid product', async () => {
    const t = setup({}, true);
    expect(await t.shop.buy('bundle')).toBe('failed');
    expect(t.bought).toEqual([]);
  });

  it('restores what the store account owns', async () => {
    expect(await setup().shop.restore()).toEqual(['bundle']);
    const down = setup({ owned: async () => Promise.reject(new Error('offline')) });
    expect(await down.shop.restore()).toBeNull();
  });

  it('says the store could not be reached, and tries again next time', async () => {
    let fail = true;
    const t = setup({
      products: async () => {
        if (fail) throw new Error('offline');
        return [{ id: 'gems', price: '£1.99' }];
      },
    });
    expect(await t.shop.load()).toBeNull();
    fail = false;
    expect(await t.shop.load()).toEqual([{ id: 'gems', price: '£1.99' }]);
  });
});
