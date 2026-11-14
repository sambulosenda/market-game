/**
 * The whole game state is one plain, JSON-serialisable object. Everything in
 * src/core is pure TypeScript with no React or native imports: functions take
 * the current state plus a timestamp (milliseconds since the epoch) and return
 * a new state, so they can be unit tested and simulated.
 */

export const SAVE_VERSION = 1;

/** One batch in a shop's queue. Timers are timestamps, never tickers. */
export type Batch = {
  id: number;
  recipe: string;
  /** When this batch starts baking: the later of "queued" and "the batch ahead ends". */
  startAt: number;
  durationMs: number;
};

export type ShopState = {
  /** 1-based level, indexing the shop's `levels` in content. */
  level: number;
  /**
   * Batches in order. They run one after another, and a finished batch keeps
   * its slot until it is collected.
   */
  queue: Batch[];
};

export type GameState = {
  version: typeof SAVE_VERSION;
  createdAt: number;
  /**
   * The latest time the game has seen. Used as "now" whenever the device
   * clock reads earlier, so moving the clock backwards grants no progress.
   * It is also when the player was last in the game, for the welcome-back
   * summary.
   */
  clock: number;
  nextBatchId: number;
  /** Goods the player owns, by good id. */
  pantry: Record<string, number>;
  /** Shops the player owns, by shop id. */
  shops: Record<string, ShopState>;
};

export type GameEvent =
  | { type: 'batchStarted'; shop: string; recipe: string; batchId: number; endsAt: number }
  | { type: 'batchCollected'; shop: string; good: string; qty: number };

export type FailReason =
  | 'unknown_shop'
  | 'shop_not_owned'
  | 'unknown_recipe'
  | 'wrong_shop'
  | 'queue_full'
  | 'missing_inputs'
  | 'nothing_ready';

export type ActionResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; reason: FailReason };
