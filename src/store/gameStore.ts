import { createStore } from 'zustand/vanilla';

import type { Content } from '../content/schema';
import {
  type ActionResult,
  buyShop,
  collect,
  createInitialState,
  deserializeSave,
  type FailReason,
  fillOrder,
  type GameEvent,
  type GameState,
  pause,
  refreshOrders,
  restoreLandmark,
  resume,
  serializeSave,
  skipOrder,
  startBatch,
  upgradePantry,
  upgradeShop,
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
  fillOrder(orderId: number): FailReason | null;
  skipOrder(orderId: number): FailReason | null;
  buyShop(shopId: string): FailReason | null;
  upgradeShop(shopId: string): FailReason | null;
  upgradePantry(): FailReason | null;
  /** Restores the landmark's next stage. */
  restoreLandmark(landmarkId: string): FailReason | null;
  /** Refills order slots whose wait is over. Cheap, so screens call it as time passes. */
  refreshOrders(): void;
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

    const start = now();
    const game = refreshOrders(loadGame(storage, content, start, onSaveError), content, start);
    save(game);

    return {
      game,
      welcomeBack: null,
      startBatch: (shopId, recipeId) => apply(startBatch(get().game, content, shopId, recipeId, now())),
      collect: (shopId) => apply(collect(get().game, content, shopId, now())),
      fillOrder: (orderId) => apply(fillOrder(get().game, content, orderId, now())),
      skipOrder: (orderId) => apply(skipOrder(get().game, content, orderId, now())),
      buyShop: (shopId) => apply(buyShop(get().game, content, shopId, now())),
      upgradeShop: (shopId) => apply(upgradeShop(get().game, content, shopId, now())),
      upgradePantry: () => apply(upgradePantry(get().game, content, now())),
      restoreLandmark: (landmarkId) => apply(restoreLandmark(get().game, content, landmarkId, now())),
      refreshOrders: () => {
        const state = refreshOrders(get().game, content, now());
        if (state === get().game) return;
        save(state);
        set({ game: state });
      },
      resume: () => {
        const t = now();
        const resumed = resume(get().game, content, t);
        const summary = resumed.summary;
        const state = refreshOrders(resumed.state, content, t);
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
