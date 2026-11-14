import { describe, expect, it } from 'vitest';

import { HOUR, MIN, T0, testContent } from '../../core/__tests__/fixtures';
import { CORRUPT_SAVE_KEY_PREFIX, createGameStore, type KeyValueStorage, SAVE_KEY } from '../gameStore';
import { createSettingsStore, DEFAULT_SETTINGS, loadSettings, SETTINGS_KEY } from '../settings';

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getString: (k) => data.get(k), set: (k, v) => void data.set(k, v), clearAll: () => data.clear() };
}

function setup(storage = memoryStorage()) {
  let clock = T0;
  const store = createGameStore({ storage, content: testContent, now: () => clock });
  return {
    storage,
    store,
    advance: (ms: number) => {
      clock += ms;
    },
    /** Simulates force-quitting and relaunching: a new store over the same storage. */
    relaunch() {
      const again = createGameStore({ storage, content: testContent, now: () => clock });
      again.getState().resume();
      return again;
    },
  };
}

describe('game store', () => {
  it('bake, close the app, come back, collect', () => {
    const t = setup();
    expect(t.store.getState().startBatch('bakery', 'loaf')).toBeNull();
    t.store.getState().pause();
    t.advance(HOUR);
    const back = t.relaunch();
    expect(back.getState().welcomeBack?.finished).toEqual({ loaf: 1 });
    expect(back.getState().collect('bakery')).toBeNull();
    expect(back.getState().game.pantry).toEqual({ loaf: 1 });
  });

  it('saves after every change, so a force-quit loses nothing', () => {
    const t = setup();
    t.store.getState().startBatch('bakery', 'loaf');
    // No pause: the app is killed straight after the tap.
    t.advance(2 * MIN);
    const back = t.relaunch();
    expect(back.getState().game.shops.bakery.queue).toHaveLength(1);
    back.getState().collect('bakery');
    t.advance(1);
    expect(t.relaunch().getState().game.pantry).toEqual({ loaf: 1 });
  });

  it('returns the failure reason and changes nothing when an action is refused', () => {
    const t = setup();
    const before = t.storage.data.get(SAVE_KEY);
    expect(t.store.getState().collect('bakery')).toBe('nothing_ready');
    expect(t.storage.data.get(SAVE_KEY)).toBe(before);
  });

  it('keeps an unreadable save aside and starts a new game', () => {
    const storage = memoryStorage();
    storage.set(SAVE_KEY, '{broken');
    const t = setup(storage);
    expect(t.store.getState().game.pantry).toEqual({});
    expect(storage.data.get(`${CORRUPT_SAVE_KEY_PREFIX}${T0}`)).toBe('{broken');
  });

  it('never overwrites an earlier unreadable save kept at the same time', () => {
    const storage = memoryStorage();
    storage.set(`${CORRUPT_SAVE_KEY_PREFIX}${T0}`, '{older');
    storage.set(SAVE_KEY, '{newer');
    setup(storage);
    expect(storage.data.get(`${CORRUPT_SAVE_KEY_PREFIX}${T0}`)).toBe('{older');
    expect(storage.data.get(`${CORRUPT_SAVE_KEY_PREFIX}${T0}.1`)).toBe('{newer');
  });

  it('plays the loop: bake, fill orders, level up, buy the dairy', () => {
    const t = setup();
    const events: string[] = [];
    let elapsed = 0;
    const store = createGameStore({
      storage: memoryStorage(),
      content: testContent,
      now: () => T0 + elapsed,
      onEvents: (es) => events.push(...es.map((e) => e.type)),
    });
    const s = () => store.getState();
    // Bake and sell loaves until level 2, then buy the dairy with the takings.
    for (let i = 0; i < 40 && s().game.level < 2; i++) {
      s().startBatch('bakery', 'loaf');
      s().startBatch('bakery', 'loaf');
      elapsed += 2 * MIN;
      s().collect('bakery');
      for (const slot of s().game.orders.slots) if ('order' in slot) s().fillOrder(slot.order.id);
    }
    expect(s().game.level).toBe(2);
    expect(events).toContain('levelUp');
    expect(s().game.wallet.gems).toBe(8);
    expect(s().buyShop('dairy')).toBeNull();
    expect(s().startBatch('dairy', 'butter')).toBeNull();
    expect(s().game.wallet.log.map((x) => x.reason)).toContain('buy_shop');
    expect(t.store.getState().buyShop('dairy')).toBe('level_too_low');
  });

  it('refills a skipped order slot once the wait is over, and saves it', () => {
    const t = setup();
    const first = t.store.getState().game.orders.slots[0];
    if (!('order' in first)) throw new Error('expected an order');
    expect(t.store.getState().skipOrder(first.order.id)).toBeNull();
    t.advance(4 * MIN);
    t.store.getState().refreshOrders();
    expect('refillAt' in t.store.getState().game.orders.slots[0]).toBe(true);
    t.advance(MIN);
    t.store.getState().refreshOrders();
    expect('order' in t.store.getState().game.orders.slots[0]).toBe(true);
    expect(t.relaunch().getState().game.orders).toEqual(t.store.getState().game.orders);
  });

  it('fills the board when coming back after a skip', () => {
    const t = setup();
    const first = t.store.getState().game.orders.slots[0];
    if (!('order' in first)) throw new Error('expected an order');
    t.store.getState().skipOrder(first.order.id);
    t.advance(HOUR);
    expect(t.relaunch().getState().game.orders.slots.every((slot) => 'order' in slot)).toBe(true);
  });

  it('shows no welcome-back when nothing finished', () => {
    const t = setup();
    t.store.getState().pause();
    t.advance(HOUR);
    expect(t.relaunch().getState().welcomeBack).toBeNull();
  });
});

describe('deleting all data', () => {
  it('wipes the save and everything kept aside, and starts a new game', () => {
    const storage = memoryStorage();
    storage.set(`${CORRUPT_SAVE_KEY_PREFIX}1`, '{old');
    const t = setup(storage);
    t.store.getState().startBatch('bakery', 'loaf');
    t.advance(HOUR);
    t.store.getState().collect('bakery');
    expect(t.store.getState().game.pantry).toEqual({ loaf: 1 });

    t.store.getState().deleteAllData();
    expect(t.store.getState().game.pantry).toEqual({});
    expect(t.store.getState().game.createdAt).toBe(T0 + HOUR);
    expect([...storage.data.keys()]).toEqual([SAVE_KEY]);
    expect(t.relaunch().getState().game.pantry).toEqual({});
  });
});

describe('settings', () => {
  it('start at the defaults, with notifications off', () => {
    const store = createSettingsStore(memoryStorage());
    expect(store.getState()).toMatchObject(DEFAULT_SETTINGS);
    expect(store.getState().notifications).toBe(false);
    expect(store.getState().haptics).toBe(true);
  });

  it('apply at once and persist', () => {
    const storage = memoryStorage();
    const store = createSettingsStore(storage);
    store.getState().set('haptics', false);
    store.getState().set('reduceMotion', true);
    expect(store.getState().haptics).toBe(false);
    expect(createSettingsStore(storage).getState()).toMatchObject({ haptics: false, reduceMotion: true, sound: true });
    expect(JSON.parse(storage.data.get(SETTINGS_KEY)!)).toEqual({ ...DEFAULT_SETTINGS, haptics: false, reduceMotion: true });
  });

  it('fall back to defaults when unreadable, and fill in settings added later', () => {
    const storage = memoryStorage();
    storage.set(SETTINGS_KEY, '{broken');
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
    storage.set(SETTINGS_KEY, '{"sound":false}');
    expect(loadSettings(storage)).toEqual({ ...DEFAULT_SETTINGS, sound: false });
  });

  it('reset in memory after all data is deleted', () => {
    const storage = memoryStorage();
    const store = createSettingsStore(storage);
    store.getState().set('music', false);
    storage.clearAll();
    store.getState().reset();
    expect(store.getState().music).toBe(true);
  });
});
