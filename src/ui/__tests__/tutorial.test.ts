import { describe, expect, it } from 'vitest';

import { T0, testContent } from '../../core/__tests__/fixtures';
import { createInitialState, type GameState, startBatch } from '../../core';
import { targetIds, tutorialDone, tutorialTarget } from '../tutorial/steps';
import type { SheetState } from '../uiStore';

const MIN = 60_000;
const fresh = (over: Partial<GameState> = {}): GameState => ({ ...createInitialState(testContent, T0, 5), ...over });
const at = (game: GameState, sheet: SheetState = null, now = T0, popupOpen = false) =>
  tutorialTarget({ game, content: testContent, now, sheet, popupOpen });
const bakery: SheetState = { kind: 'shop', id: 'bakery' };
const dairy: SheetState = { kind: 'shop', id: 'dairy' };
const baking = (game: GameState, n = 1) => {
  let s = game;
  for (let i = 0; i < n; i++) {
    const r = startBatch(s, testContent, 'bakery', 'loaf', T0);
    if (!r.ok) throw new Error(r.reason);
    s = r.state;
  }
  return s;
};
const firstOrderId = (game: GameState) => {
  const slot = game.orders.slots[0];
  if (!('order' in slot)) throw new Error('expected an order');
  return slot.order.id;
};

describe('onboarding', () => {
  it('starts by pointing at the bakery, then at the recipe an order needs', () => {
    expect(at(fresh())).toEqual({ kind: 'lot', shop: 'bakery' });
    expect(at(fresh(), bakery)).toEqual({ kind: 'view', id: targetIds.recipe('loaf') });
  });

  it('keeps pointing at the recipe until the queue is full, then waits', () => {
    expect(at(baking(fresh()), bakery)).toEqual({ kind: 'view', id: targetIds.recipe('loaf') });
    expect(at(baking(fresh(), 2), bakery)).toBeNull();
    expect(at(baking(fresh(), 2))).toBeNull();
  });

  it('points at whatever collects: the button in the sheet, or the shop on the street', () => {
    const s = baking(fresh(), 2);
    expect(at(s, bakery, T0 + MIN)).toEqual({ kind: 'view', id: targetIds.collect });
    expect(at(s, null, T0 + MIN)).toEqual({ kind: 'lot', shop: 'bakery' });
  });

  it('sends the player out of the sheet to fill an order, and points at its Fill button', () => {
    const s = fresh({ pantry: { loaf: 5 } });
    expect(at(s, bakery)).toEqual({ kind: 'view', id: targetIds.closeSheet });
    expect(at(s)).toEqual({ kind: 'view', id: targetIds.fill(firstOrderId(s)) });
  });

  it('leads to the second shop once it can be bought, and through its sheet', () => {
    const ready = fresh({ level: 2, wallet: { coins: 50, gems: 0, log: [] } });
    expect(at(ready)).toEqual({ kind: 'lot', shop: 'dairy' });
    expect(at(ready, bakery)).toEqual({ kind: 'view', id: targetIds.closeSheet });
    expect(at(ready, dairy)).toEqual({ kind: 'view', id: targetIds.buyShop });
    // Opened early, before it can be afforded: back out.
    expect(at(fresh(), dairy)).toEqual({ kind: 'view', id: targetIds.closeSheet });
    expect(at(fresh({ level: 2 }))).toEqual({ kind: 'lot', shop: 'bakery' });
  });

  it('ends for good when the second shop opens', () => {
    const done = fresh({ level: 2, shops: { bakery: { level: 1, queue: [] }, dairy: { level: 1, queue: [] } } });
    expect(tutorialDone(done, testContent)).toBe(true);
    expect(at(done)).toBeNull();
    expect(at(done, bakery)).toBeNull();
    expect(tutorialDone(fresh(), testContent)).toBe(false);
  });

  it('stays out of the way of pop-ups and of sheets the player opened to explore', () => {
    expect(at(fresh(), null, T0, true)).toBeNull();
    expect(at(fresh(), { kind: 'pantry' })).toBeNull();
    expect(at(fresh(), { kind: 'settings' })).toBeNull();
  });

  it('does not point at collecting into a full pantry', () => {
    const s = baking(fresh({ pantry: { butter: 10 } }), 2);
    expect(at(s, null, T0 + MIN)).toBeNull();
  });
});
