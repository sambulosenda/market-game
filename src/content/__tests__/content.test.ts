import { describe, expect, it } from 'vitest';

import goods from '../data/goods.json';
import recipes from '../data/recipes.json';
import shops from '../data/shops.json';
import street from '../data/street.json';
import { ContentError, loadContent, type RawContent } from '../load';

const raw: RawContent = { goods, recipes, shops, street };

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
    expect(Object.keys(content.shops)).toEqual(['bakery']);
    expect(Object.keys(content.recipes)).toHaveLength(4);
  });

  it('keeps every timer in the first 15 minutes at 2 minutes or less', () => {
    for (const r of recipes.recipes) expect(r.durationSec).toBeLessThanOrEqual(120);
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
    ]);
  });

  it('reports goods with no recipe, duplicates, and lots off the street', () => {
    expect(problemsFor({ goods: { goods: [...goods.goods, { id: 'cake', name: 'Cake' }] } })).toEqual([
      'goods.json: good "cake" has no recipe',
    ]);
    expect(problemsFor({ goods: { goods: [...goods.goods, goods.goods[0]] } })).toEqual([
      'goods.json: duplicate id "loaf"',
    ]);
    expect(problemsFor({ shops: { shops: [{ ...shops.shops[0], lot: 8 }] } })).toEqual([
      'shops.json: shop "bakery": lot 8 is outside the street (8 lots)',
    ]);
  });

  it('does not treat inherited object keys as existing ids', () => {
    const bad = {
      recipes: [...recipes.recipes, { id: 'toast', shop: 'constructor', output: 'loaf', inputs: [], durationSec: 10 }],
    };
    expect(problemsFor({ recipes: bad })).toContain('recipes.json: recipe "toast": unknown shop "constructor"');
    const okGoods = { goods: [...goods.goods, { id: 'constructor', name: 'Odd' }] };
    const okRecipes = {
      recipes: [...recipes.recipes, { id: 'constructor', shop: 'bakery', output: 'constructor', inputs: [], durationSec: 10 }],
    };
    expect(problemsFor({ goods: okGoods, recipes: okRecipes })).toEqual([]);
  });

  it('throws a readable message listing every problem', () => {
    expect(() => loadContent({ ...raw, street: { lotCount: 0 } })).toThrow(
      /Content config is invalid:\n {2}- street\.json: lotCount: /,
    );
  });
});
