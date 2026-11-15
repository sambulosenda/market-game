/**
 * The whole game state is one plain, JSON-serialisable object. Everything in
 * src/core is pure TypeScript with no React or native imports: functions take
 * the current state plus a timestamp (milliseconds since the epoch) and return
 * a new state, so they can be unit tested and simulated.
 */
import type { GoodQty, Level } from '../content/schema';

export const SAVE_VERSION = 6;

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
  /** Queue slots bought with gems, on top of the level's. Missing means none. */
  extraSlots?: number;
};

export type Currency = 'coins' | 'gems';

export type TransactionReason =
  | 'order'
  | 'level_up'
  | 'buy_shop'
  | 'upgrade_shop'
  | 'upgrade_pantry'
  | 'restore_landmark'
  | 'daily_goal'
  | 'daily_calendar'
  | 'tip'
  | 'skip_timer'
  | 'queue_slot'
  | 'collection_set'
  | 'purchase';

/** One change to the wallet. `amount` is negative for spending. */
export type Transaction = {
  at: number;
  currency: Currency;
  amount: number;
  reason: TransactionReason;
  /** The balance of that currency after the change. */
  balance: number;
};

export type Wallet = {
  coins: number;
  gems: number;
  /** The most recent transactions, oldest first. Capped, so the save stays small. */
  log: Transaction[];
};

export type Order = {
  id: number;
  items: GoodQty[];
  /** Coins paid before landmark bonuses, fixed when the order is made. */
  coins: number;
  xp: number;
};

/** A slot on the order board holds an order, or is empty until `refillAt`. */
export type OrderSlot = { order: Order } | { refillAt: number };

export type DailyGoalKind = 'fill_orders' | 'collect_goods' | 'earn_coins' | 'start_batches';

export type DailyGoal = {
  kind: DailyGoalKind;
  target: number;
  /** Never more than `target`. */
  progress: number;
  /** Coins paid when claimed, fixed when the goal is set. */
  coins: number;
  claimed: boolean;
};

export type Daily = {
  /** The local day the goals are for (see `localDay`), or -1 before the first day is set up. */
  day: number;
  goals: DailyGoal[];
  /** Whether the gem bonus for claiming every goal has been paid today. */
  bonusClaimed: boolean;
  /** The login calendar: gifts taken so far, and the local day of the last one. */
  calendar: { claimed: number; lastDay: number | null };
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
  /** 1-based, indexing `economy.pantry.levels`. */
  pantryLevel: number;
  /** Shops the player owns, by shop id. */
  shops: Record<string, ShopState>;
  wallet: Wallet;
  /** Total XP ever earned. */
  xp: number;
  /** 1-based player level, indexing `levels` in content. */
  level: number;
  orders: { slots: OrderSlot[]; nextId: number };
  /** Restoration stages finished, by landmark id. Missing means none. */
  landmarks: Record<string, { stage: number }>;
  daily: Daily;
  /** How many of each good the player has ever collected, by good id. Mastery stars come from this. */
  made: Record<string, number>;
  /** The once-only products from the app store that have been given to the player. */
  purchased: string[];
  /** The collections album: customers met and set rewards paid. Goods found come from `made`. */
  album: { customers: number[]; claimed: string[] };
  /** State of the random number generator, so order generation can be replayed. */
  rng: number;
};

export type GameEvent =
  | { type: 'batchStarted'; shop: string; recipe: string; batchId: number; endsAt: number }
  | { type: 'batchCollected'; shop: string; good: string; qty: number }
  | { type: 'masteryStarEarned'; good: string; stars: number }
  | { type: 'orderFilled'; orderId: number; coins: number; xp: number }
  | { type: 'orderSkipped'; orderId: number; refillAt: number }
  | { type: 'levelUp'; level: number; gems: number; unlocks: Level['unlocks'] }
  | { type: 'shopBought'; shop: string }
  | { type: 'shopUpgraded'; shop: string; level: number }
  | { type: 'pantryUpgraded'; level: number; capacity: number }
  | { type: 'landmarkStageRestored'; landmark: string; stage: number; complete: boolean }
  | { type: 'dailyGoalClaimed'; kind: DailyGoalKind; coins: number; gems: number }
  | { type: 'calendarGiftClaimed'; day: number; coins: number; gems: number }
  /** `newLook` is set the first time a customer with that look tips, when they join the album. */
  | { type: 'customerTipped'; coins: number; newLook?: number }
  | { type: 'collectionSetClaimed'; set: string; gems: number }
  | { type: 'purchaseGranted'; product: string; gems: number; coins: number }
  | { type: 'timerSkipped'; shop: string; batchId: number; gems: number }
  | { type: 'queueSlotBought'; shop: string; extraSlots: number; gems: number };

export type FailReason =
  | 'unknown_shop'
  | 'shop_not_owned'
  | 'unknown_recipe'
  | 'wrong_shop'
  | 'recipe_locked'
  | 'queue_full'
  | 'missing_inputs'
  | 'nothing_ready'
  | 'pantry_full'
  | 'already_owned'
  | 'level_too_low'
  | 'max_level'
  | 'not_enough_coins'
  | 'not_enough_gems'
  | 'nothing_baking'
  | 'unknown_order'
  | 'missing_goods'
  | 'unknown_landmark'
  | 'already_restored'
  | 'unknown_goal'
  | 'goal_not_done'
  | 'already_claimed'
  | 'unknown_set'
  | 'set_not_complete'
  | 'unknown_product';

export type ActionResult = { ok: true; state: GameState; events: GameEvent[] } | { ok: false; reason: FailReason };
