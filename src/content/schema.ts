import { z } from 'zod';

/**
 * Schema for the game's content config. Every balance number lives in the
 * JSON files under ./data, never in code. `loadContent` validates them and
 * also checks cross-references (a recipe pointing at a good that does not
 * exist, two things on the same lot, and so on).
 */

const id = z.string().regex(/^[a-z][a-z0-9_]*$/, 'ids are lower_snake_case, starting with a letter');

/** The longest timer allowed anywhere in v1 (PRD pacing rules): 4 hours. */
export const MAX_DURATION_SEC = 4 * 60 * 60;
/** Shops have 3 levels and landmarks are restored in 3 stages. */
export const MAX_SHOP_LEVEL = 3;
export const LANDMARK_STAGES = 3;
/** An order asks for 1 to 3 kinds of goods. */
export const MAX_ORDER_KINDS = 3;

const goodQty = z.strictObject({
  good: id,
  qty: z.number().int().positive(),
});

export const goodSchema = z.strictObject({
  id,
  name: z.string().min(1),
  /** Base coins an order pays for one of this good, before multipliers. */
  value: z.number().int().positive(),
  /** XP an order pays for one of this good. */
  xp: z.number().int().nonnegative(),
  /** How often orders ask for this good, relative to others. */
  orderWeight: z.number().positive().default(1),
  /** The most of this good one order asks for, for goods that take long to make. Without it, only the level's limit applies. */
  maxOrderQty: z.number().int().positive().optional(),
});

export const recipeSchema = z.strictObject({
  id,
  shop: id,
  output: id,
  inputs: z.array(goodQty),
  durationSec: z.number().int().positive().max(MAX_DURATION_SEC),
  /** The shop level that adds this recipe. */
  shopLevel: z.number().int().min(1).max(MAX_SHOP_LEVEL).default(1),
});

export const shopLevelSchema = z.strictObject({
  /** Coins to reach this level. For level 1 this is the price of the shop. */
  cost: z.number().int().nonnegative(),
  /** How many batches can be queued or waiting to be collected. */
  queueSize: z.number().int().min(1).max(5),
  /** Multiplies every recipe's duration at this level, so 0.9 is 10% faster. */
  durationMultiplier: z.number().positive().max(1),
});

export const shopSchema = z.strictObject({
  id,
  name: z.string().min(1),
  /** Which of the street's lots (0-based, left to right) the shop stands on. */
  lot: z.number().int().min(0),
  startsOwned: z.boolean(),
  levels: z.array(shopLevelSchema).min(1).max(MAX_SHOP_LEVEL),
});

export const landmarkBonusSchema = z.discriminatedUnion('type', [
  /** Orders pay this many percent more coins. */
  z.strictObject({ type: z.literal('order_coins'), percent: z.number().positive().max(100) }),
  /** All batches finish this many percent faster. */
  z.strictObject({ type: z.literal('batch_speed'), percent: z.number().positive().max(90) }),
  /** Extra order slots on the board. */
  z.strictObject({ type: z.literal('order_slots'), slots: z.number().int().positive() }),
]);

export const landmarkSchema = z.strictObject({
  id,
  name: z.string().min(1),
  lot: z.number().int().min(0),
  /** What each restoration stage costs, in order. */
  stages: z
    .array(z.strictObject({ coins: z.number().int().nonnegative(), goods: z.array(goodQty) }))
    .length(LANDMARK_STAGES),
  /** Applies for good once the last stage is restored. */
  bonus: landmarkBonusSchema,
});

export const levelSchema = z.strictObject({
  /** Total XP needed to reach this level. Level 1 is 0. */
  xp: z.number().int().nonnegative(),
  /** Open order slots at this level, before landmark bonuses. */
  orderSlots: z.number().int().min(1).max(6),
  /** Gems given on reaching this level. */
  gems: z.number().int().nonnegative(),
  /** Everything that becomes available at this level. */
  unlocks: z.strictObject({ shops: z.array(id), recipes: z.array(id), landmarks: z.array(id) }),
});

const byLevel = <T extends z.ZodRawShape>(shape: T) =>
  z.array(z.strictObject({ minLevel: z.number().int().min(1), ...shape })).min(1);

/** What a daily goal can count. */
export const DAILY_GOAL_KINDS = ['fill_orders', 'collect_goods', 'earn_coins', 'start_batches'] as const;

export const economySchema = z.strictObject({
  startingCoins: z.number().int().nonnegative(),
  startingGems: z.number().int().nonnegative(),
  pantry: z.strictObject({
    /** Capacity at each pantry level, and the coins to reach it. Level 1 is free. */
    levels: z
      .array(z.strictObject({ capacity: z.number().int().positive(), cost: z.number().int().nonnegative() }))
      .min(1),
  }),
  orders: z.strictObject({
    /** How long a skipped order's slot stays empty. */
    skipCooldownSec: z.number().int().nonnegative(),
    /** Coins paid = the goods' total value times this. */
    coinMultiplier: z.number().positive(),
    /** Extra share of coins for each kind of good beyond the first, so 0.15 is +15%. */
    extraKindBonus: z.number().nonnegative(),
    /** Relative odds of an order asking for 1, 2 or 3 kinds of goods, from a player level up. */
    kinds: byLevel({ weights: z.array(z.number().nonnegative()).length(MAX_ORDER_KINDS) }),
    /** The most of one good an order asks for, from a player level up. */
    maxQty: byLevel({ max: z.number().int().positive() }),
  }),
  gems: z.strictObject({
    /** Finishing a baking batch costs one gem for each of these minutes left, rounded up. */
    skipMinutesPerGem: z.number().positive(),
    /** The gems each extra queue slot costs, in order. Its length is how many a shop can have. */
    extraQueueSlotCosts: z.array(z.number().int().positive()).max(3),
  }),
  /** A walking customer's tip = `base` + `perLevel` times the player's level, rounded down. */
  tips: z.strictObject({ base: z.number().nonnegative(), perLevel: z.number().nonnegative() }),
  daily: z.strictObject({
    /** The goals a day's three are drawn from, each with its target from a player level up. */
    goals: z
      .array(
        z.strictObject({
          kind: z.enum(DAILY_GOAL_KINDS),
          targets: byLevel({ target: z.number().int().positive() }),
        }),
      )
      .min(3),
    /** Coins for claiming one goal = this times the player's level. */
    goalCoinsPerLevel: z.number().int().nonnegative(),
    /** Gems for claiming all of a day's goals. */
    allGoalsGems: z.number().int().nonnegative(),
    /** The login calendar's gifts, in order. Coins = `coinsPerLevel` times the player's level. */
    calendar: z
      .array(z.strictObject({ coinsPerLevel: z.number().int().nonnegative(), gems: z.number().int().nonnegative() }))
      .length(7),
  }),
});

export const goodsFileSchema = z.strictObject({ goods: z.array(goodSchema).min(1) });
export const recipesFileSchema = z.strictObject({ recipes: z.array(recipeSchema).min(1) });
export const shopsFileSchema = z.strictObject({ shops: z.array(shopSchema).min(1) });
export const landmarksFileSchema = z.strictObject({ landmarks: z.array(landmarkSchema) });
export const levelsFileSchema = z.strictObject({ levels: z.array(levelSchema).min(1) });
export const streetFileSchema = z.strictObject({ lotCount: z.number().int().min(1) });

export type GoodQty = z.infer<typeof goodQty>;
export type Good = z.infer<typeof goodSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
export type ShopLevel = z.infer<typeof shopLevelSchema>;
export type Shop = z.infer<typeof shopSchema>;
export type Landmark = z.infer<typeof landmarkSchema>;
export type LandmarkBonus = z.infer<typeof landmarkBonusSchema>;
export type Level = z.infer<typeof levelSchema>;
export type Economy = z.infer<typeof economySchema>;

export type Content = {
  goods: Record<string, Good>;
  recipes: Record<string, Recipe>;
  shops: Record<string, Shop>;
  landmarks: Record<string, Landmark>;
  /** Index 0 is level 1. */
  levels: Level[];
  economy: Economy;
  street: { lotCount: number };
  /** The player level that unlocks each shop, recipe and landmark, worked out from `levels`. */
  unlockLevel: { shops: Record<string, number>; recipes: Record<string, number>; landmarks: Record<string, number> };
};
