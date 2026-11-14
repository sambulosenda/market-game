import { createStore } from 'zustand/vanilla';

import type { Level } from '../content/schema';

/**
 * What the interface is showing: the open sheet, level-ups waiting to be
 * shown, and toasts. None of it is saved or affects the game.
 */
export type SheetState = { kind: 'shop'; id: string } | { kind: 'landmark'; id: string } | { kind: 'pantry' } | null;

export type LevelUp = {
  level: number;
  gems: number;
  unlocks: Level['unlocks'];
};

export type Toast = { id: number; text: string };

export type UiState = {
  sheet: SheetState;
  /** Shown one at a time, oldest first. */
  levelUps: LevelUp[];
  toasts: Toast[];
};

export const TOAST_MS = 2200;
const MAX_TOASTS = 2;

export const uiStore = createStore<UiState>()(() => ({
  sheet: null,
  levelUps: [],
  toasts: [],
}));

export function openSheet(sheet: Exclude<SheetState, null>) {
  uiStore.setState({ sheet });
}

export function closeSheet() {
  uiStore.setState({ sheet: null });
}

export function queueLevelUp(levelUp: LevelUp) {
  uiStore.setState({ levelUps: [...uiStore.getState().levelUps, levelUp] });
}

export function dismissLevelUp() {
  uiStore.setState({ levelUps: uiStore.getState().levelUps.slice(1) });
}

let nextToastId = 1;

/** Shows a short message. The same message twice in a row is shown once. */
export function toast(text: string, schedule: (fn: () => void, ms: number) => unknown = setTimeout) {
  const { toasts } = uiStore.getState();
  if (toasts.at(-1)?.text === text) return;
  const id = nextToastId++;
  uiStore.setState({ toasts: [...toasts, { id, text }].slice(-MAX_TOASTS) });
  schedule(
    () =>
      uiStore.setState({
        toasts: uiStore.getState().toasts.filter((t) => t.id !== id),
      }),
    TOAST_MS,
  );
}
