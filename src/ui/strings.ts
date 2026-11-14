import type { FailReason } from '../core';

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * Every player-facing string lives here, ready for translation later.
 * Good, shop and landmark names come from the content config.
 */
export const strings = {
  number: (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','),
  close: 'Close',
  ok: 'Lovely',
  level: (n: number) => `Level ${n}`,

  // Timers
  duration: (sec: number) => {
    const s = Math.max(1, Math.round(sec));
    if (s < 60) return `${s}s`;
    if (s < 3600) return s % 60 === 0 ? `${s / 60}m` : `${Math.floor(s / 60)}m ${s % 60}s`;
    const m = Math.round((s % 3600) / 60);
    return m === 0 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 3600)}h ${m}m`;
  },
  remaining: (ms: number) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    if (s >= 3600)
      return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  },

  // Shop sheet
  shopLevel: (level: number, max: number) => `Level ${level} of ${max}`,
  queue: (used: number, size: number) => `Queue ${used}/${size}`,
  collect: (n: number) => (n === 1 ? 'Collect 1' : `Collect ${n}`),
  queueFull: 'The queue is full. Collect something to make room.',
  ready: 'Ready',
  waiting: 'Up next',
  emptySlot: 'Empty',
  recipes: 'Make',
  needs: 'Needs',
  have: (owned: number, needed: number) => `${owned}/${needed}`,
  recipeAtLevel: (level: number) => `Unlocks at level ${level}`,
  recipeAtShopLevel: (level: number) => `Needs shop level ${level}`,
  upgrade: 'Upgrade',
  upgradeShopGain: (queue: number, fasterPercent: number, recipes: string[]) =>
    [
      `Queue of ${queue}`,
      fasterPercent > 0 ? `${fasterPercent}% faster` : '',
      recipes.length ? `New: ${recipes.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join(' · '),
  shopMaxLevel: 'This shop is at its top level.',
  buyShop: 'Open shop',
  shopForSale: 'This plot is ready for a new shop.',
  shopLocked: (level: number) => `Opens at level ${level}`,
  shopMakes: 'Makes',

  // Order board
  orders: 'Orders',
  fill: 'Fill',
  skip: 'Skip',
  nextOrderIn: (time: string) => `New order in ${time}`,
  ordersHint: 'Make what customers ask for, then fill their orders for coins.',

  // Pantry
  pantry: 'Pantry',
  pantryEmpty: 'Nothing yet. Make something!',
  pantryCount: (n: number, capacity: number) => `${n}/${capacity}`,
  pantryFull: 'Your pantry is full. Fill an order to make room.',
  pantryUpgradeGain: (capacity: number) => `Room for ${capacity}`,
  pantryMaxLevel: 'Your pantry is as big as it gets.',

  // Landmarks
  landmarkStage: (done: number, total: number) => `Stage ${Math.min(done + 1, total)} of ${total}`,
  landmarkStagesDone: (done: number, total: number) => `${done} of ${total} stages restored`,
  landmarkRestore: 'Restore',
  landmarkRestored: 'Fully restored',
  landmarkCost: 'This stage needs',
  landmarkGives: 'When restored',
  landmarkLocked: (name: string, level: number) => `The ${name.toLowerCase()} can be restored from level ${level}.`,
  bonus: {
    order_coins: (percent: number) => `Orders pay ${percent}% more coins`,
    batch_speed: (percent: number) => `Everything is made ${percent}% faster`,
    order_slots: (slots: number) => `${slots} more order ${plural(slots, 'slot', 'slots')}`,
  },

  // Level-up
  levelUpTitle: (level: number) => `Level ${level}!`,
  levelUpBody: 'Your street is growing.',
  levelUpNothing: 'Keep going. More is on the way.',
  unlockedShop: (name: string) => `New shop: ${name}`,
  unlockedRecipe: (name: string) => `New recipe: ${name}`,
  unlockedLandmark: (name: string) => `New landmark: ${name}`,
  unlockedSlot: 'One more order slot',
  levelUpGems: (n: number) => `${n} ${plural(n, 'gem', 'gems')}`,

  // Welcome back
  welcomeBackTitle: 'Welcome back!',
  welcomeBackBody: 'While you were away, your street made:',
  goodTimes: (name: string, n: number) => `${name} × ${n}`,

  // Settings
  settings: {
    title: 'Settings',
    music: 'Music',
    sound: 'Sound effects',
    haptics: 'Vibration',
    notifications: 'Notifications',
    reduceMotion: 'Reduce motion',
    hints: {
      notifications: 'A nudge when your goods are ready. Never at night.',
      reduceMotion: 'Fewer moving effects. Buttons still respond to taps.',
    } as Partial<Record<string, string>>,
    deleteData: 'Delete my data',
    deleteHint: 'Your game is saved on this device only.',
    deleteTitle: 'Delete everything?',
    deleteBody: 'Your street, coins, gems and settings will be gone for good. This cannot be undone.',
    deleteKeep: 'Keep my street',
    deleteConfirm: 'Delete everything',
  },

  // Why an action did not happen
  fail: {
    queue_full: 'The queue is full.',
    missing_inputs: 'You need more ingredients for that.',
    pantry_full: 'Your pantry is full. Fill an order to make room.',
    not_enough_coins: 'You need more coins for that.',
    missing_goods: 'You do not have all the goods yet.',
    level_too_low: 'You need a higher level for that.',
    recipe_locked: 'That recipe is still locked.',
  } as Partial<Record<FailReason, string>>,
  failOther: 'That did not work. Try again.',

  a11y: {
    street: 'The street. Swipe sideways to look around.',
    settingsButton: 'Settings',
    places: 'Places on the street',
    shopForSale: (name: string, coins: number) => `${name}, not open yet. Costs ${coins} coins.`,
    shopLocked: (name: string, level: number) => `${name}, opens at level ${level}`,
    landmark: (name: string, done: number, total: number) => `${name}, ${done} of ${total} stages restored`,
    landmarkLocked: (name: string, level: number) => `${name}, from level ${level}`,
    shopLot: (name: string, ready: number) => (ready > 0 ? `${name}, ${ready} ready to collect` : name),
    amount: {
      coins: (n: number) => `${n} ${plural(n, 'coin', 'coins')}`,
      gems: (n: number) => `${n} ${plural(n, 'gem', 'gems')}`,
      xp: (n: number) => `${n} XP`,
    },
    levelProgress: (level: number, xp: number, next: number | null) =>
      next === null ? `Level ${level}, top level` : `Level ${level}, ${xp} of ${next} XP`,
    pantryButton: (n: number, capacity: number) => `Pantry, ${n} of ${capacity} goods. Opens the pantry.`,
    pantryItem: (name: string, n: number) => `${name}, ${n}`,
    makeRecipe: (name: string, duration: string) => `Make ${name}, takes ${duration}`,
    lockedRecipe: (name: string, why: string) => `${name}, locked. ${why}`,
    need: (name: string, owned: number, needed: number) => `${name}, have ${owned}, need ${needed}`,
    orderItem: (name: string, qty: number, owned: number) => `${qty} ${name}, you have ${owned}`,
    fillOrder: (coins: number, xp: number) => `Fill order for ${coins} coins and ${xp} XP`,
    skipOrder: 'Skip this order',
    cost: (coins: number) => `costs ${coins} ${plural(coins, 'coin', 'coins')}`,
  },
};

export function failText(reason: FailReason): string {
  return strings.fail[reason] ?? strings.failOther;
}
