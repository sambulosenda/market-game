import { createStore } from 'zustand/vanilla';

import type { Content } from '../content/schema';
import {
  type ActionResult,
  collect,
  createInitialState,
  deserializeSave,
  type FailReason,
  type GameEvent,
  type GameState,
  pause,
  resume,
  serializeSave,
  startBatch,
  type WelcomeBack,
} from '../core';

/** The tiny slice of a key-value store the game needs. MMKV in the app, a Map in tests. */
export type KeyValueStorage = {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
};

export const SAVE_KEY = 'save';
export const CORRUPT_SAVE_KEY_PREFIX = 'save.unreadable.';

export type GameStore = {
  game: GameState;
  /** Set when the player returns and something finished while they were away. */
  welcomeBack: WelcomeBack | null;
  startBatch(shopId: string, recipeId: string): FailReason | null;
  collect(shopId: string): FailReason | null;
  /** Call when the app comes to the foreground (and once at launch). */
  resume(): void;
  /** Call when the app goes to the background. */
  pause(): void;
  dismissWelcomeBack(): void;
};

export type GameStoreOptions = {
  storage: KeyValueStorage;
  content: Content;
  now?: () => number;
  onEvents?: (events: GameEvent[]) => void;
  onSaveError?: (error: unknown) => void;
};

/**
 * Loads the save, or starts a new game. A save that cannot be read is kept
 * under a separate key rather than overwritten, so it can be recovered.
 */
export function loadGame(storage: KeyValueStorage, content: Content, now: number, onError?: (e: unknown) => void): GameState {
  const raw = storage.getString(SAVE_KEY);
  if (raw === undefined) return createInitialState(content, now);
  try {
    return deserializeSave(raw, content);
  } catch (error) {
    let key = `${CORRUPT_SAVE_KEY_PREFIX}${now}`;
    for (let n = 1; storage.getString(key) !== undefined; n++) key = `${CORRUPT_SAVE_KEY_PREFIX}${now}.${n}`;
    storage.set(key, raw);
    onError?.(error);
    return createInitialState(content, now);
  }
}

/**
 * The game store: a thin shell around the pure core. Every change is saved
 * straight away, so force-quitting at any point loses nothing.
 */
export function createGameStore({ storage, content, now = Date.now, onEvents, onSaveError }: GameStoreOptions) {
  const save = (game: GameState) => {
    try {
      storage.set(SAVE_KEY, serializeSave(game));
    } catch (error) {
      onSaveError?.(error);
    }
  };

  return createStore<GameStore>()((set, get) => {
    const apply = (result: ActionResult): FailReason | null => {
      if (!result.ok) return result.reason;
      save(result.state);
      set({ game: result.state });
      onEvents?.(result.events);
      return null;
    };

    const game = loadGame(storage, content, now(), onSaveError);
    save(game);

    return {
      game,
      welcomeBack: null,
      startBatch: (shopId, recipeId) => apply(startBatch(get().game, content, shopId, recipeId, now())),
      collect: (shopId) => apply(collect(get().game, content, shopId, now())),
      resume: () => {
        const { state, summary } = resume(get().game, content, now());
        save(state);
        const hasNews = Object.keys(summary.finished).length > 0;
        set({ game: state, welcomeBack: hasNews ? summary : get().welcomeBack });
      },
      pause: () => {
        const state = pause(get().game, now());
        save(state);
        set({ game: state });
      },
      dismissWelcomeBack: () => set({ welcomeBack: null }),
    };
  });
}
