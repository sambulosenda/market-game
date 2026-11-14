import { loadContent } from '../../content/load';

const stage = (coins: number, good: string, qty: number) => ({ coins, goods: [{ good, qty }] });

/**
 * A small content set: a bakery that starts owned, a dairy to buy at level 2,
 * a recipe with inputs, and one landmark for each kind of bonus.
 */
export const testContent = loadContent({
  goods: {
    goods: [
      { id: 'loaf', name: 'Loaf', value: 6, xp: 2 },
      { id: 'butter', name: 'Butter', value: 20, xp: 5 },
      { id: 'croissant', name: 'Croissant', value: 50, xp: 12 },
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
          { cost: 0, queueSize: 2, durationMultiplier: 1 },
          { cost: 100, queueSize: 3, durationMultiplier: 0.5 },
        ],
      },
      {
        id: 'dairy',
        name: 'Dairy',
        lot: 1,
        startsOwned: false,
        levels: [{ cost: 50, queueSize: 2, durationMultiplier: 1 }],
      },
    ],
  },
  landmarks: {
    landmarks: [
      {
        id: 'fountain',
        name: 'Fountain',
        lot: 2,
        stages: [stage(10, 'loaf', 1), stage(20, 'loaf', 2), stage(30, 'butter', 1)],
        bonus: { type: 'order_coins', percent: 10 },
      },
      {
        id: 'clocktower',
        name: 'Clock tower',
        lot: 3,
        stages: [stage(1, 'loaf', 1), stage(1, 'loaf', 1), stage(1, 'loaf', 1)],
        bonus: { type: 'batch_speed', percent: 50 },
      },
      {
        id: 'bandstand',
        name: 'Bandstand',
        lot: 4,
        stages: [stage(1, 'loaf', 1), stage(1, 'loaf', 1), stage(1, 'loaf', 1)],
        bonus: { type: 'order_slots', slots: 1 },
      },
    ],
  },
  levels: {
    levels: [
      { xp: 0, orderSlots: 2, gems: 0, unlocks: { shops: ['bakery'], recipes: ['loaf', 'croissant'], landmarks: [] } },
      { xp: 10, orderSlots: 2, gems: 3, unlocks: { shops: ['dairy'], recipes: ['butter'], landmarks: ['fountain'] } },
      { xp: 30, orderSlots: 3, gems: 5, unlocks: { shops: [], recipes: [], landmarks: ['clocktower', 'bandstand'] } },
    ],
  },
  economy: {
    startingCoins: 20,
    startingGems: 5,
    pantry: {
      levels: [
        { capacity: 10, cost: 0 },
        { capacity: 20, cost: 30 },
      ],
    },
    orders: {
      skipCooldownSec: 300,
      coinMultiplier: 1.5,
      extraKindBonus: 0.2,
      kinds: [
        { minLevel: 1, weights: [1, 0, 0] },
        { minLevel: 2, weights: [1, 1, 0] },
      ],
      maxQty: [
        { minLevel: 1, max: 2 },
        { minLevel: 2, max: 3 },
      ],
    },
    notifications: { quietStartHour: 21, quietEndHour: 9, maxPerDay: 2, minGapMinutes: 60 },
    gems: { skipMinutesPerGem: 2, extraQueueSlotCosts: [3, 6] },
    tips: { base: 1, perLevel: 0.5 },
    collections: { goodsSetGems: 4, customerLooks: 3, customerSetGems: 6 },
    products: [
      { id: 'test.bundle', gems: 20, coins: 100, once: true },
      { id: 'test.gems', gems: 10, coins: 0, once: false },
    ],
    mastery: { starsAt: [3, 6, 10], speedPercentPerStar: 10 },
    daily: {
      goals: [
        {
          kind: 'fill_orders',
          targets: [
            { minLevel: 1, target: 2 },
            { minLevel: 2, target: 4 },
          ],
        },
        { kind: 'collect_goods', targets: [{ minLevel: 1, target: 3 }] },
        { kind: 'earn_coins', targets: [{ minLevel: 1, target: 20 }] },
        { kind: 'start_batches', targets: [{ minLevel: 1, target: 2 }] },
      ],
      goalCoinsPerLevel: 10,
      allGoalsGems: 2,
      calendar: [
        { coinsPerLevel: 5, gems: 0 },
        { coinsPerLevel: 6, gems: 0 },
        { coinsPerLevel: 0, gems: 1 },
        { coinsPerLevel: 8, gems: 0 },
        { coinsPerLevel: 9, gems: 0 },
        { coinsPerLevel: 0, gems: 2 },
        { coinsPerLevel: 20, gems: 5 },
      ],
    },
  },
  street: { lotCount: 8 },
});

export const T0 = Date.UTC(2026, 10, 14, 9, 0, 0);
export const SEC = 1000;
export const MIN = 60 * SEC;
export const HOUR = 60 * MIN;
