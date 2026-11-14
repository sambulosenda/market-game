import { beforeEach, describe, expect, it } from 'vitest';

import { fxStore, land, landAll, shownCount, splitFlights, takeOff } from '../fxStore';

beforeEach(() => fxStore.setState({ inFlight: {}, landed: {} }));

describe('collect effect bookkeeping', () => {
  it('holds back the counter until each good lands', () => {
    takeOff('loaf', 3);
    expect(shownCount(5, fxStore.getState().inFlight.loaf)).toBe(2);
    land('loaf', 1);
    expect(shownCount(5, fxStore.getState().inFlight.loaf)).toBe(3);
    land('loaf', 2);
    expect(fxStore.getState().inFlight).toEqual({});
    expect(shownCount(5, fxStore.getState().inFlight.loaf)).toBe(5);
    expect(fxStore.getState().landed.loaf).toBe(2);
  });

  it('never shows a negative count or lets in-flight go below zero', () => {
    expect(shownCount(1, 4)).toBe(0);
    land('loaf', 2);
    expect(fxStore.getState().inFlight).toEqual({});
  });

  it('lands everything when the effect layer goes away', () => {
    takeOff('loaf', 2);
    takeOff('scones', 1);
    landAll();
    expect(fxStore.getState().inFlight).toEqual({});
  });

  it('splits a quantity across a capped number of icons', () => {
    expect(splitFlights(1)).toEqual([1]);
    expect(splitFlights(3)).toEqual([1, 1, 1]);
    expect(splitFlights(12)).toEqual([3, 3, 2, 2, 2]);
    expect(splitFlights(0)).toEqual([]);
  });
});
