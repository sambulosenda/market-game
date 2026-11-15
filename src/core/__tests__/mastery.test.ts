import { describe, expect, it } from 'vitest';

import { goodStars, masterySpeedMultiplier, starsFor, totalStars, viewMastery } from '../mastery';
import { collect, startBatch } from '../production';
import { deserializeSave, serializeSave } from '../save';
import { createInitialState } from '../state';
import type { ActionResult, GameEvent, GameState } from '../types';
import { HOUR, MIN, T0, testContent } from './fixtures';

function ok(result: ActionResult) {
  if (!result.ok) throw new Error(`action failed: ${result.reason}`);
  return result;
}

/** Makes and collects `count` loaves, one after another. Returns the state, the events and the time. */
function bake(count: number, from: GameState = createInitialState(testContent, T0, 1), start = T0) {
  let state = from;
  let now = start;
  const events: GameEvent[] = [];
  for (let i = 0; i < count; i++) {
    state = ok(startBatch(state, testContent, 'bakery', 'loaf', now)).state;
    now += HOUR;
    const collected = ok(collect(state, testContent, 'bakery', now));
    state = collected.state;
    events.push(...collected.events);
  }
  return { state, events, now };
}

// The test content gives stars at 3, 6 and 10 made, each making the good 10% quicker.
describe('shop mastery', () => {
  it('starts with nothing made and no stars', () => {
    const s = createInitialState(testContent, T0, 1);
    expect(s.made).toEqual({});
    expect(viewMastery(s, testContent, 'loaf')).toEqual({
      made: 0,
      stars: 0,
      maxStars: 3,
      nextAt: 3,
      progress: 0,
      speedPercent: 0,
    });
    expect(totalStars(s, testContent)).toBe(0);
  });

  it('counts every good collected, and only when it is collected', () => {
    const started = ok(startBatch(createInitialState(testContent, T0, 1), testContent, 'bakery', 'loaf', T0)).state;
    expect(started.made).toEqual({});
    expect(bake(2).state.made).toEqual({ loaf: 2 });
  });

  it('gives a star at each threshold, with one event each', () => {
    const { state, events } = bake(6);
    expect(goodStars(state, testContent, 'loaf')).toBe(2);
    expect(events.filter((e) => e.type === 'masteryStarEarned')).toEqual([
      { type: 'masteryStarEarned', good: 'loaf', stars: 1 },
      { type: 'masteryStarEarned', good: 'loaf', stars: 2 },
    ]);
    expect(viewMastery(state, testContent, 'loaf')).toMatchObject({ nextAt: 10, progress: 0, speedPercent: 20 });
    expect(goodStars(state, testContent, 'butter')).toBe(0);
  });

  it('gives one event when a single collection passes a threshold', () => {
    const two = bake(2);
    let s = ok(startBatch(two.state, testContent, 'bakery', 'loaf', two.now)).state;
    s = ok(startBatch(s, testContent, 'bakery', 'loaf', two.now)).state;
    const { state, events } = ok(collect(s, testContent, 'bakery', two.now + HOUR));
    expect(state.made).toEqual({ loaf: 4 });
    expect(events).toEqual([
      { type: 'batchCollected', shop: 'bakery', good: 'loaf', qty: 2 },
      { type: 'masteryStarEarned', good: 'loaf', stars: 1 },
    ]);
  });

  it('makes new batches of a starred good quicker, and leaves other goods alone', () => {
    const { state, now } = bake(3);
    expect(masterySpeedMultiplier(state, testContent, 'loaf')).toBeCloseTo(0.9);
    const loaf = ok(startBatch(state, testContent, 'bakery', 'loaf', now)).state;
    expect(loaf.shops.bakery.queue[0].durationMs).toBe(0.9 * MIN);
    const croissant = ok(startBatch({ ...state, pantry: { butter: 2 } }, testContent, 'bakery', 'croissant', now));
    expect(croissant.state.shops.bakery.queue[0].durationMs).toBe(5 * MIN);
  });

  it('stops at the last star', () => {
    const s = { ...createInitialState(testContent, T0, 1), made: { loaf: 5000 } };
    expect(viewMastery(s, testContent, 'loaf')).toMatchObject({
      stars: 3,
      nextAt: null,
      progress: 1,
      speedPercent: 30,
    });
    expect(starsFor(9, testContent.economy.mastery)).toBe(2);
    expect(totalStars({ ...s, made: { loaf: 5000, butter: 3 } }, testContent)).toBe(4);
  });

  it('is saved, and a version 3 save comes forward with nothing made', () => {
    const { state } = bake(4);
    expect(deserializeSave(serializeSave(state), testContent).made).toEqual({ loaf: 4 });
    const { made: _made, ...v3 } = state;
    const old = deserializeSave(JSON.stringify({ ...v3, version: 3 }), testContent);
    expect(old.made).toEqual({});
    expect(old.pantry).toEqual(state.pantry);
  });

  it('drops counts for goods that no longer exist', () => {
    const s = { ...createInitialState(testContent, T0, 1), made: { loaf: 4, gone: 9 } };
    expect(deserializeSave(serializeSave(s), testContent).made).toEqual({ loaf: 4 });
  });
});
