import { describe, expect, it } from 'vitest';

import economy from '../data/economy.json';
import goods from '../data/goods.json';
import landmarks from '../data/landmarks.json';
import levels from '../data/levels.json';
import recipes from '../data/recipes.json';
import shops from '../data/shops.json';
import street from '../data/street.json';
import { ContentError, loadContent, type RawContent } from '../load';

const raw: RawContent = { goods, recipes, shops, landmarks, levels, economy, street };

function problemsFor(override: Partial<RawContent>): string[] {
  try {
    loadContent({ ...raw, ...override });
  } catch (e) {
    if (e instanceof ContentError) return e.problems;
    throw e;
  }
  return [];
}

describe('bundled content', () => {
  it('is valid', () => {
    const content = loadContent(raw);
    expect(Object.keys(content.shops)).toEqual(['bakery', 'dairy']);
    expect(content.levels).toHaveLength(25);
    expect(content.unlockLevel.shops).toEqual({ bakery: 1, dairy: 3 });
  });

  it('keeps every timer in the first 15 minutes at 2 minutes or less', () => {
    const content = loadContent(raw);
    // The first 15 minutes of play reach about level 4.
    for (const r of Object.values(content.recipes)) {
      if (content.unlockLevel.recipes[r.id] <= 4 && r.inputs.length === 0)
        expect(r.durationSec, r.id).toBeLessThanOrEqual(120);
    }
  });

  it('lets a new player make something to sell from the first second', () => {
    const content = loadContent(raw);
    const first = Object.values(content.recipes).filter(
      (r) => content.unlockLevel.recipes[r.id] === 1 && content.shops[r.shop].startsOwned && r.inputs.length === 0,
    );
    expect(first.length).toBeGreaterThan(0);
  });
});

describe('content validation', () => {
  it('reports schema errors with the file and path', () => {
    const bad = { recipes: [{ ...recipes.recipes[0], durationSec: -5 }] };
    expect(problemsFor({ recipes: bad })).toEqual([
      expect.stringMatching(/^recipes\.json: recipes\.0\.durationSec: /),
    ]);
  });

  it('rejects timers longer than 4 hours', () => {
    const bad = { recipes: [{ ...recipes.recipes[0], durationSec: 4 * 3600 + 1 }, ...recipes.recipes.slice(1)] };
    expect(problemsFor({ recipes: bad })[0]).toMatch(/durationSec/);
  });

  it('rejects unknown fields so typos do not pass silently', () => {
    const bad = { goods: [{ id: 'loaf', name: 'Loaf', nmae: 'x' }] };
    expect(problemsFor({ goods: bad })[0]).toMatch(/goods\.json: goods\.0/);
  });

  it('reports broken references between files', () => {
    const bad = {
      recipes: [
        ...recipes.recipes,
        { id: 'toast', shop: 'toastery', output: 'toast', inputs: [{ good: 'jam', qty: 1 }], durationSec: 10 },
      ],
    };
    expect(problemsFor({ recipes: bad })).toEqual([
      'recipes.json: recipe "toast": unknown shop "toastery"',
      'recipes.json: recipe "toast": unknown output good "toast"',
      'recipes.json: recipe "toast": unknown input good "jam"',
      'levels.json: recipe "toast" is never unlocked',
    ]);
  });

  it('reports goods with no recipe, duplicates, and lots off the street', () => {
    expect(problemsFor({ goods: { goods: [...goods.goods, { id: 'cake', name: 'Cake', value: 1, xp: 0 }] } })).toEqual([
      'goods.json: good "cake" has no recipe',
    ]);
    expect(problemsFor({ goods: { goods: [...goods.goods, goods.goods[0]] } })).toEqual([
      'goods.json: duplicate id "loaf"',
    ]);
    expect(problemsFor({ shops: { shops: [{ ...shops.shops[0], lot: 8 }, ...shops.shops.slice(1)] } })).toEqual([
      'shops.json: shop "bakery": lot 8 is outside the street (8 lots)',
    ]);
  });

  it('does not treat inherited object keys as existing ids', () => {
    const bad = {
      recipes: [...recipes.recipes, { id: 'toast', shop: 'constructor', output: 'loaf', inputs: [], durationSec: 10 }],
    };
    expect(problemsFor({ recipes: bad })).toContain('recipes.json: recipe "toast": unknown shop "constructor"');
    const okGoods = { goods: [...goods.goods, { id: 'constructor', name: 'Odd', value: 1, xp: 0 }] };
    const okRecipes = {
      recipes: [...recipes.recipes, { id: 'constructor', shop: 'bakery', output: 'constructor', inputs: [], durationSec: 10 }],
    };
    const okLevels = {
      levels: levels.levels.map((l, i) =>
        i === 0 ? { ...l, unlocks: { ...l.unlocks, recipes: [...l.unlocks.recipes, 'constructor'] } } : l,
      ),
    };
    expect(problemsFor({ goods: okGoods, recipes: okRecipes, levels: okLevels })).toEqual([]);
  });

  it('checks levels: XP rises, and everything unlocks exactly once and in order', () => {
    const edit = (i: number, change: (l: (typeof levels.levels)[number]) => object) => ({
      levels: levels.levels.map((l, j) => (j === i ? { ...l, ...change(l) } : l)),
    });
    expect(problemsFor({ levels: edit(2, () => ({ xp: 1 })) })).toEqual([
      "levels.json: level 3: xp must be more than level 2's",
    ]);
    expect(problemsFor({ levels: edit(1, (l) => ({ unlocks: { ...l.unlocks, recipes: ['scones', 'loaf'] } })) })).toEqual([
      'levels.json: level 2: recipe "loaf" is already unlocked at level 1',
    ]);
    expect(problemsFor({ levels: edit(1, (l) => ({ unlocks: { ...l.unlocks, recipes: [] } })) })).toEqual([
      'levels.json: recipe "scones" is never unlocked',
    ]);
    // Milk moved to level 2, but its shop, the dairy, arrives at level 3.
    const early = {
      levels: levels.levels.map((l, j) => {
        if (j === 1) return { ...l, unlocks: { ...l.unlocks, recipes: [...l.unlocks.recipes, 'milk'] } };
        if (j === 2) return { ...l, unlocks: { ...l.unlocks, recipes: l.unlocks.recipes.filter((r) => r !== 'milk') } };
        return l;
      }),
    };
    expect(problemsFor({ levels: early })).toEqual([
      'levels.json: recipe "milk" unlocks at level 2, before its shop "dairy" (level 3)',
    ]);
  });

  it('checks shops, landmarks and the economy tables', () => {
    const [bakery, dairy] = shops.shops;
    expect(problemsFor({ shops: { shops: [bakery, { ...dairy, lot: 2 }] } })).toEqual([
      'landmarks.json: landmark "fountain": lot 2 is already taken by "dairy"',
    ]);
    const paid = { ...bakery, levels: [{ ...bakery.levels[0], cost: 5 }, ...bakery.levels.slice(1)] };
    expect(problemsFor({ shops: { shops: [paid, dairy] } })).toEqual([
      'shops.json: shop "bakery": starts owned, so its level 1 cost must be 0',
    ]);
    expect(problemsFor({ shops: { shops: [{ ...bakery, levels: bakery.levels.slice(0, 1) }, dairy] } })).toEqual([
      'recipes.json: recipe "croissant": needs shop level 2, but "bakery" has 1',
      'recipes.json: recipe "cheese_twist": needs shop level 2, but "bakery" has 1',
    ]);
    const fountain = landmarks.landmarks[0];
    const odd = { ...fountain, stages: [{ coins: 1, goods: [{ good: 'jam', qty: 1 }] }, ...fountain.stages.slice(1)] };
    expect(problemsFor({ landmarks: { landmarks: [odd] } })).toEqual([
      'landmarks.json: landmark "fountain": stage 1: unknown good "jam"',
    ]);
    const orders = { ...economy.orders, kinds: [{ minLevel: 2, weights: [0, 0, 0] }] };
    expect(problemsFor({ economy: { ...economy, orders } })).toEqual([
      'economy.json: orders.kinds: the first row must have minLevel 1',
      'economy.json: orders.kinds: the row for level 2 has no weight above 0',
    ]);
  });

  it('throws a readable message listing every problem', () => {
    expect(() => loadContent({ ...raw, street: { lotCount: 0 } })).toThrow(
      /Content config is invalid:\n {2}- street\.json: lotCount: /,
    );
  });
});
