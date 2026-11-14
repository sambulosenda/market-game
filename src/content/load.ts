import { z } from 'zod';

import {
  type Content,
  economySchema,
  goodsFileSchema,
  landmarksFileSchema,
  levelsFileSchema,
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
  landmarks: unknown;
  levels: unknown;
  economy: unknown;
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
  // No prototype, so ids like "constructor" are never mistaken for existing entries.
  const out: Record<string, T> = Object.create(null);
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
  const landmarksFile = parseFile('landmarks.json', landmarksFileSchema, raw.landmarks, problems);
  const levelsFile = parseFile('levels.json', levelsFileSchema, raw.levels, problems);
  const economy = parseFile('economy.json', economySchema, raw.economy, problems);
  const street = parseFile('street.json', streetFileSchema, raw.street, problems);
  if (!goodsFile || !recipesFile || !shopsFile || !landmarksFile || !levelsFile || !economy || !street)
    throw new ContentError(problems);

  const goods = indexById('goods.json', goodsFile.goods, problems);
  const recipes = indexById('recipes.json', recipesFile.recipes, problems);
  const shops = indexById('shops.json', shopsFile.shops, problems);
  const landmarks = indexById('landmarks.json', landmarksFile.landmarks, problems);
  const levels = levelsFile.levels;

  const madeBy: Record<string, string> = Object.create(null);
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

  for (const recipe of Object.values(recipes)) {
    const shop = shops[recipe.shop];
    if (shop && recipe.shopLevel > shop.levels.length)
      problems.push(
        `recipes.json: recipe "${recipe.id}": needs shop level ${recipe.shopLevel}, but "${shop.id}" has ${shop.levels.length}`,
      );
  }

  // Shops and landmarks share the street's lots.
  const lots = new Map<number, string>();
  const places = [
    ...Object.values(shops).map((s) => ({ file: 'shops.json', kind: 'shop', ...s })),
    ...Object.values(landmarks).map((l) => ({ file: 'landmarks.json', kind: 'landmark', ...l })),
  ];
  for (const place of places) {
    const where = `${place.file}: ${place.kind} "${place.id}"`;
    if (place.lot >= street.lotCount)
      problems.push(`${where}: lot ${place.lot} is outside the street (${street.lotCount} lots)`);
    const other = lots.get(place.lot);
    if (other) problems.push(`${where}: lot ${place.lot} is already taken by "${other}"`);
    lots.set(place.lot, place.id);
  }
  for (const shop of Object.values(shops)) {
    if (shop.startsOwned && shop.levels[0].cost !== 0)
      problems.push(`shops.json: shop "${shop.id}": starts owned, so its level 1 cost must be 0`);
  }
  for (const landmark of Object.values(landmarks)) {
    landmark.stages.forEach((stage, i) => {
      for (const item of stage.goods) {
        if (!goods[item.good])
          problems.push(`landmarks.json: landmark "${landmark.id}": stage ${i + 1}: unknown good "${item.good}"`);
      }
    });
  }

  // Levels: XP rises, and every shop, recipe and landmark is unlocked exactly once.
  const unlockLevel = {
    shops: Object.create(null) as Record<string, number>,
    recipes: Object.create(null) as Record<string, number>,
    landmarks: Object.create(null) as Record<string, number>,
  };
  const known = { shops, recipes, landmarks };
  levels.forEach((level, i) => {
    const n = i + 1;
    const where = `levels.json: level ${n}`;
    if (i === 0 && level.xp !== 0) problems.push(`${where}: level 1 must need 0 XP`);
    if (i > 0 && level.xp <= levels[i - 1].xp) problems.push(`${where}: xp must be more than level ${n - 1}'s`);
    if (i > 0 && level.orderSlots < levels[i - 1].orderSlots)
      problems.push(`${where}: orderSlots must not go down`);
    for (const kind of ['shops', 'recipes', 'landmarks'] as const) {
      for (const thing of level.unlocks[kind]) {
        if (!known[kind][thing]) problems.push(`${where}: unlocks unknown ${kind.slice(0, -1)} "${thing}"`);
        else if (unlockLevel[kind][thing])
          problems.push(`${where}: ${kind.slice(0, -1)} "${thing}" is already unlocked at level ${unlockLevel[kind][thing]}`);
        else unlockLevel[kind][thing] = n;
      }
    }
  });
  for (const kind of ['shops', 'recipes', 'landmarks'] as const) {
    for (const thing of Object.keys(known[kind])) {
      if (!unlockLevel[kind][thing]) problems.push(`levels.json: ${kind.slice(0, -1)} "${thing}" is never unlocked`);
    }
  }
  for (const shop of Object.values(shops)) {
    if (shop.startsOwned && unlockLevel.shops[shop.id] > 1)
      problems.push(`levels.json: shop "${shop.id}" starts owned, so it must unlock at level 1`);
  }
  for (const recipe of Object.values(recipes)) {
    const own = unlockLevel.recipes[recipe.id];
    const shop = unlockLevel.shops[recipe.shop];
    if (own && shop && own < shop)
      problems.push(`levels.json: recipe "${recipe.id}" unlocks at level ${own}, before its shop "${recipe.shop}" (level ${shop})`);
  }

  // Economy tables.
  economy.pantry.levels.forEach((level, i) => {
    if (i === 0 && level.cost !== 0) problems.push('economy.json: pantry level 1 must cost 0');
    if (i > 0 && level.capacity <= economy.pantry.levels[i - 1].capacity)
      problems.push(`economy.json: pantry level ${i + 1}: capacity must be more than level ${i}'s`);
  });
  for (const table of ['kinds', 'maxQty'] as const) {
    const rows = economy.orders[table];
    if (rows[0].minLevel !== 1) problems.push(`economy.json: orders.${table}: the first row must have minLevel 1`);
    rows.forEach((row, i) => {
      if (i > 0 && row.minLevel <= rows[i - 1].minLevel)
        problems.push(`economy.json: orders.${table}: minLevel must rise from row to row`);
    });
  }
  for (const row of economy.orders.kinds) {
    if (row.weights.every((w) => w === 0))
      problems.push(`economy.json: orders.kinds: the row for level ${row.minLevel} has no weight above 0`);
  }

  if (problems.length) throw new ContentError(problems);
  return { goods, recipes, shops, landmarks, levels, economy, street, unlockLevel };
}
