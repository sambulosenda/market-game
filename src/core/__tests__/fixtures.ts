import { loadContent } from '../../content/load';

/** A small content set with inputs, a faster second level and a 2-batch queue. */
export const testContent = loadContent({
  goods: {
    goods: [
      { id: 'loaf', name: 'Loaf' },
      { id: 'butter', name: 'Butter' },
      { id: 'croissant', name: 'Croissant' },
    ],
  },
  recipes: {
    recipes: [
      { id: 'loaf', shop: 'bakery', output: 'loaf', inputs: [], durationSec: 60 },
      { id: 'butter', shop: 'dairy', output: 'butter', inputs: [], durationSec: 120 },
      {
        id: 'croissant',
        shop: 'bakery',
        output: 'croissant',
        inputs: [{ good: 'butter', qty: 2 }],
        durationSec: 300,
      },
    ],
  },
  shops: {
    shops: [
      {
        id: 'bakery',
        name: 'Bakery',
        lot: 0,
        startsOwned: true,
        levels: [
          { queueSize: 2, durationMultiplier: 1 },
          { queueSize: 3, durationMultiplier: 0.5 },
        ],
      },
      { id: 'dairy', name: 'Dairy', lot: 1, startsOwned: false, levels: [{ queueSize: 2, durationMultiplier: 1 }] },
    ],
  },
  street: { lotCount: 8 },
});

export const T0 = Date.UTC(2026, 10, 14, 9, 0, 0);
export const SEC = 1000;
export const MIN = 60 * SEC;
export const HOUR = 60 * MIN;
