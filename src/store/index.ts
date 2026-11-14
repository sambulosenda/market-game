import { createMMKV } from 'react-native-mmkv';
import { useStore } from 'zustand';

import { content } from '../content';
import type { GameEvent } from '../core';
import { createGameStore, type GameStore } from './gameStore';
import { createSettingsStore, type SettingsStore } from './settings';

type Listener = (events: GameEvent[]) => void;
const listeners = new Set<Listener>();

/** Subscribe to game events, for effects and haptics. Returns an unsubscribe function. */
export function onGameEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const storage = createMMKV({ id: 'market-street' });

export const gameStore = createGameStore({
  storage,
  content,
  onEvents: (events) => listeners.forEach((l) => l(events)),
  onSaveError: (error) => console.warn('[save]', error),
});

export const settingsStore = createSettingsStore(storage);

export function useSettings<T>(selector: (s: SettingsStore) => T): T {
  return useStore(settingsStore, selector);
}

/** Deletes the save and the settings, and starts a new game. */
export function deleteAllData() {
  gameStore.getState().deleteAllData();
  settingsStore.getState().reset();
}

export function useGame<T>(selector: (s: GameStore) => T): T {
  return useStore(gameStore, selector);
}
