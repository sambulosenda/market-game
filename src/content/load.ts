import { z } from 'zod';

import {
  type Content,
  goodsFileSchema,
  recipesFileSchema,
  shopsFileSchema,
  streetFileSchema,
} from './schema';

export class ContentError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Content config is invalid:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ContentError';
  }
}

export type RawContent = {
  goods: unknown;
  recipes: unknown;
  shops: unknown;
  street: unknown;
};

function parseFile<T>(
  file: string,
  schema: z.ZodType<T>,
  raw: unknown,
  problems: string[],
): T | undefined {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  for (const issue of result.error.issues) {
    const path = issue.path.length ? issue.path.join('.') : '(root)';
    problems.push(`${file}: ${path}: ${issue.message}`);
  }
  return undefined;
}

function indexById<T extends { id: string }>(
  file: string,
  items: T[],
  problems: string[],
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const item of items) {
    if (out[item.id]) problems.push(`${file}: duplicate id "${item.id}"`);
    out[item.id] = item;
  }
  return out;
}

/**
 * Validates raw config objects and returns typed, indexed content. Throws a
 * ContentError listing every problem found, so one run shows them all.
 */
export function loadContent(raw: RawContent): Content {
  const problems: string[] = [];
  const goodsFile = parseFile('goods.json', goodsFileSchema, raw.goods, problems);
  const recipesFile = parseFile('recipes.json', recipesFileSchema, raw.recipes, problems);
  const shopsFile = parseFile('shops.json', shopsFileSchema, raw.shops, problems);
  const street = parseFile('street.json', streetFileSchema, raw.street, problems);
  if (!goodsFile || !recipesFile || !shopsFile || !street) throw new ContentError(problems);

  const goods = indexById('goods.json', goodsFile.goods, problems);
  const recipes = indexById('recipes.json', recipesFile.recipes, problems);
  const shops = indexById('shops.json', shopsFile.shops, problems);

  const madeBy: Record<string, string> = {};
  for (const recipe of Object.values(recipes)) {
    const where = `recipes.json: recipe "${recipe.id}"`;
    if (!shops[recipe.shop]) problems.push(`${where}: unknown shop "${recipe.shop}"`);
    if (!goods[recipe.output]) problems.push(`${where}: unknown output good "${recipe.output}"`);
    else if (madeBy[recipe.output])
      problems.push(`${where}: good "${recipe.output}" is already made by "${madeBy[recipe.output]}"`);
    else madeBy[recipe.output] = recipe.id;
    const seen = new Set<string>();
    for (const input of recipe.inputs) {
      if (!goods[input.good]) problems.push(`${where}: unknown input good "${input.good}"`);
      if (input.good === recipe.output) problems.push(`${where}: uses its own output as an input`);
      if (seen.has(input.good)) problems.push(`${where}: lists input "${input.good}" twice`);
      seen.add(input.good);
    }
  }
  for (const good of Object.values(goods)) {
    if (!madeBy[good.id]) problems.push(`goods.json: good "${good.id}" has no recipe`);
  }

  const lots = new Map<number, string>();
  for (const shop of Object.values(shops)) {
    const where = `shops.json: shop "${shop.id}"`;
    if (shop.lot >= street.lotCount)
      problems.push(`${where}: lot ${shop.lot} is outside the street (${street.lotCount} lots)`);
    const other = lots.get(shop.lot);
    if (other) problems.push(`${where}: lot ${shop.lot} is already taken by "${other}"`);
    lots.set(shop.lot, shop.id);
  }

  if (problems.length) throw new ContentError(problems);
  return { goods, recipes, shops, street };
}
