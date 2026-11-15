import { createStore } from 'zustand/vanilla';

import type { Content } from '../content/schema';
import {
  type ActionResult,
  buyQueueSlot,
  buyShop,
  claimCalendarGift,
  claimCollectionSet,
  claimDailyGoal,
  collect,
  createInitialState,
  deserializeSave,
  type FailReason,
  fillOrder,
  type GameEvent,
  type GameState,
  grantPurchase,
  pause,
  refreshDaily,
  refreshOrders,
  restoreLandmark,
  restorePurchases,
  resume,
  serializeSave,
  skipOrder,
  skipTimer,
  startBatch,
  tipCustomer,
  upgradePantry,
  upgradeShop,
  type WelcomeBack,
} from '../core';

/** The tiny slice of a key-value store the game needs. MMKV in the app, a Map in tests. */
export type KeyValueStorage = {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  /** Removes everything in the store. */
  clearAll(): void;
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
  /** Takes the coins for one of today's goals, by its position in the list. */
  claimDailyGoal(index: number): FailReason | null;
  /** Takes today's gift from the login calendar. */
  claimCalendarGift(): FailReason | null;
  /** Spends gems to finish the shop's baking batch now. */
  skipTimer(shopId: string): FailReason | null;
  /** Spends gems on one more queue slot for the shop. */
  buyQueueSlot(shopId: string): FailReason | null;
  /** Takes a walking customer's tip. */
  tipCustomer(look?: number): void;
  /** Gives the player an app store product that was paid for. */
  grantPurchase(productId: string): FailReason | null;
  /** Gives back once-only products the store account owns. Returns the ones given. */
  restorePurchases(ownedProductIds: string[]): string[];
  /** Takes the gems for a finished collection set. */
  claimCollectionSet(setId: string): FailReason | null;
  /** Refills order slots whose wait is over and sets new goals after midnight. Cheap, so screens call it as time passes. */
  refreshOrders(): void;
  /** Call when the app comes to the foreground (and once at launch). */
  resume(): void;
  /** Call when the app goes to the background. */
  pause(): void;
  dismissWelcomeBack(): void;
  /** Deletes everything saved on the device and starts a new game. It cannot be undone. */
  deleteAllData(): void;
};

export type GameStoreOptions = {
  storage: KeyValueStorage;
  content: Content;
  now?: () => number;
  /** Minutes to add to local time to get UTC at a moment, as `Date.getTimezoneOffset()` gives. */
  timezoneOffsetMin?: (at: number) => number;
  onEvents?: (events: GameEvent[]) => void;
  onSaveError?: (error: unknown) => void;
};

/**
 * Loads the save, or starts a new game. A save that cannot be read is kept
 * under a separate key rather than overwritten, so it can be recovered.
 */
export function loadGame(
  storage: KeyValueStorage,
  content: Content,
  now: number,
  onError?: (e: unknown) => void,
): GameState {
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
export function createGameStore({
  storage,
  content,
  now = Date.now,
  timezoneOffsetMin = (at) => new Date(at).getTimezoneOffset(),
  onEvents,
  onSaveError,
}: GameStoreOptions) {
  /** Everything that happens just because time passed: new orders, and new goals after midnight. */
  const tick = (game: GameState, t: number) =>
    refreshDaily(refreshOrders(game, content, t), content, t, timezoneOffsetMin(t));

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
    const game = tick(loadGame(storage, content, start, onSaveError), start);
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
      claimDailyGoal: (index) => apply(claimDailyGoal(get().game, content, index, now())),
      claimCalendarGift: () => {
        const t = now();
        return apply(claimCalendarGift(get().game, content, t, timezoneOffsetMin(t)));
      },
      skipTimer: (shopId) => apply(skipTimer(get().game, content, shopId, now())),
      buyQueueSlot: (shopId) => apply(buyQueueSlot(get().game, content, shopId, now())),
      tipCustomer: (look) => void apply(tipCustomer(get().game, content, now(), look)),
      grantPurchase: (productId) => apply(grantPurchase(get().game, content, productId, now())),
      restorePurchases: (owned) => {
        const { state, restored } = restorePurchases(get().game, content, owned, now());
        if (restored.length > 0) {
          save(state);
          set({ game: state });
        }
        return restored;
      },
      claimCollectionSet: (setId) => apply(claimCollectionSet(get().game, content, setId, now())),
      refreshOrders: () => {
        const state = tick(get().game, now());
        if (state === get().game) return;
        save(state);
        set({ game: state });
      },
      resume: () => {
        const t = now();
        const resumed = resume(get().game, content, t);
        const summary = resumed.summary;
        const state = tick(resumed.state, t);
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
      deleteAllData: () => {
        storage.clearAll();
        const fresh = tick(createInitialState(content, now()), now());
        save(fresh);
        set({ game: fresh, welcomeBack: null });
      },
    };
  });
}
