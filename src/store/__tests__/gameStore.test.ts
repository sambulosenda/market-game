import { describe, expect, it } from 'vitest';

import { HOUR, MIN, T0, testContent } from '../../core/__tests__/fixtures';
import { CORRUPT_SAVE_KEY_PREFIX, createGameStore, type KeyValueStorage, SAVE_KEY } from '../gameStore';

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getString: (k) => data.get(k), set: (k, v) => void data.set(k, v) };
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

  it('shows no welcome-back when nothing finished', () => {
    const t = setup();
    t.store.getState().pause();
    t.advance(HOUR);
    expect(t.relaunch().getState().welcomeBack).toBeNull();
  });
});
