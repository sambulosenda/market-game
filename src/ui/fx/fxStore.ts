import { createStore } from 'zustand/vanilla';

/**
 * Display-only state for effects. Nothing here is saved or affects the game:
 * the pantry already holds collected goods, and this only delays when the
 * counter shows them, so it ticks up as each one lands.
 */
export type FxState = {
  /** Goods still flying to the pantry, by good id. */
  inFlight: Record<string, number>;
  /** Bumped each time a good lands, by good id, so its counter can pulse. */
  landed: Record<string, number>;
};

export const fxStore = createStore<FxState>()(() => ({ inFlight: {}, landed: {} }));

export function takeOff(good: string, qty: number) {
  const { inFlight } = fxStore.getState();
  fxStore.setState({ inFlight: { ...inFlight, [good]: (inFlight[good] ?? 0) + qty } });
}

export function land(good: string, qty: number) {
  const { inFlight, landed } = fxStore.getState();
  const left = Math.max(0, (inFlight[good] ?? 0) - qty);
  const next = { ...inFlight };
  if (left > 0) next[good] = left;
  else delete next[good];
  fxStore.setState({ inFlight: next, landed: { ...landed, [good]: (landed[good] ?? 0) + 1 } });
}

/** Lands everything at once, for when the effect layer goes away mid-flight. */
export function landAll() {
  fxStore.setState({ inFlight: {} });
}

/** What the pantry counter should show: what is owned, minus what has not landed yet. */
export function shownCount(owned: number, inFlight: number | undefined): number {
  return Math.max(0, owned - (inFlight ?? 0));
}

/**
 * Splits a collected quantity across at most `max` flying icons, so
 * collecting 12 loaves sends 5 icons, not 12. The parts add up to `qty`.
 */
export function splitFlights(qty: number, max = 5): number[] {
  const n = Math.min(Math.max(qty, 0), max);
  if (n === 0) return [];
  const base = Math.floor(qty / n);
  const extra = qty - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}
