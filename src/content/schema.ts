import { z } from 'zod';

/**
 * Schema for the game's content config. Every balance number lives in the
 * JSON files under ./data, never in code. `loadContent` validates them and
 * also checks cross-references (a recipe pointing at a good that does not
 * exist, two shops on the same lot, and so on).
 *
 * This first version covers goods, recipes, shops and the street. Orders,
 * levels and landmarks are added with the features that use them.
 */

const id = z
  .string()
  .regex(/^[a-z][a-z0-9_]*$/, 'ids are lower_snake_case, starting with a letter');

/** The longest timer allowed anywhere in v1 (PRD pacing rules): 4 hours. */
export const MAX_DURATION_SEC = 4 * 60 * 60;

export const goodSchema = z.strictObject({
  id,
  name: z.string().min(1),
});

export const recipeInputSchema = z.strictObject({
  good: id,
  qty: z.number().int().positive(),
});

export const recipeSchema = z.strictObject({
  id,
  shop: id,
  output: id,
  inputs: z.array(recipeInputSchema),
  durationSec: z.number().int().positive().max(MAX_DURATION_SEC),
});

export const shopLevelSchema = z.strictObject({
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
  levels: z.array(shopLevelSchema).min(1).max(3),
});

export const goodsFileSchema = z.strictObject({ goods: z.array(goodSchema).min(1) });
export const recipesFileSchema = z.strictObject({ recipes: z.array(recipeSchema).min(1) });
export const shopsFileSchema = z.strictObject({ shops: z.array(shopSchema).min(1) });
export const streetFileSchema = z.strictObject({ lotCount: z.number().int().min(1) });

export type Good = z.infer<typeof goodSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
export type ShopLevel = z.infer<typeof shopLevelSchema>;
export type Shop = z.infer<typeof shopSchema>;

export type Content = {
  goods: Record<string, Good>;
  recipes: Record<string, Recipe>;
  shops: Record<string, Shop>;
  street: { lotCount: number };
};
