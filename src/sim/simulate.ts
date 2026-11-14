import type { Content, Recipe } from '../content/schema';
import {
  type ActionResult,
  buyShop,
  collect,
  createInitialState,
  fillOrder,
  type GameState,
  landmarkStage,
  pantryCapacity,
  pantryCount,
  recipeAvailable,
  refreshOrders,
  restoreLandmark,
  shopLevelConfig,
  startBatch,
  upgradePantry,
  upgradeShop,
} from '../core';

/**
 * The balance simulator: a bot that plays the real game core the way an
 * average player might, in short sessions spread over days, and records when
 * each shop opens, each landmark is restored and each level is reached.
 * Nothing here is used by the app. It exists to check the numbers in
 * src/content/data against the pacing targets.
 */

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export type Session = { atHour: number; minutes: number };

/** How much the simulated player plays on a given day (1-based). */
export type PlayPlan = (day: number) => Session[];

/**
 * The default player: 45 minutes on the first day, then five short check-ins
 * a day, half an hour in all.
 */
export const averagePlayer: PlayPlan = (day) =>
  day === 1
    ? [
        { atHour: 9, minutes: 20 },
        { atHour: 13, minutes: 15 },
        { atHour: 19, minutes: 10 },
      ]
    : [8, 11, 14, 18, 21].map((atHour) => ({ atHour, minutes: 6 }));

export type Milestone = {
  kind: 'shop' | 'landmark' | 'level';
  id: string;
  /** The day it happened, counting the first day as 1. */
  day: number;
  /** Minutes of play before it happened, across all sessions. */
  playMinutes: number;
  /** Coins in the wallet just after it happened. */
  coins: number;
};

/** The player's progress at the end of one session. */
export type Sample = { day: number; atHour: number; level: number; xp: number; coins: number };

export type SimResult = { milestones: Milestone[]; samples: Sample[]; state: GameState; days: number };

export type SimOptions = {
  days: number;
  seed?: number;
  plan?: PlayPlan;
  /** Seconds between the bot's turns while it is playing. */
  tickSec?: number;
  /** Stop as soon as the top level is reached. */
  stopAtTopLevel?: boolean;
};

export function simulate(content: Content, options: SimOptions): SimResult {
  const { days, seed = 1, plan = averagePlayer, tickSec = 5, stopAtTopLevel = true } = options;
  let state = createInitialState(content, 0, seed);
  let played = 0;
  const milestones: Milestone[] = [];
  // `coins` is the balance right after the purchase or the level up, not at the end of the bot's turn.
  const mark = (kind: Milestone['kind'], id: string, day: number, coins: number) =>
    milestones.push({ kind, id, day, playMinutes: Math.round((played / MIN) * 10) / 10, coins });
  const samples: Sample[] = [];
  const act = (result: ActionResult): boolean => {
    if (result.ok) state = result.state;
    return result.ok;
  };

  for (let day = 1; day <= days; day++) {
    for (const session of plan(day)) {
      const start = (day - 1) * DAY + session.atHour * HOUR;
      for (let t = start; t < start + session.minutes * MIN; t += tickSec * SEC) {
        state = refreshOrders(state, content, t);

        for (const shopId of Object.keys(state.shops)) act(collect(state, content, shopId, t));
        // Spend before filling orders, so goods saved for a landmark go to the landmark.
        for (const bought of spend(state, content, t, act)) mark(bought.kind, bought.id, day, bought.coins);
        for (const slot of [...state.orders.slots]) {
          if (!('order' in slot)) continue;
          const levelBefore = state.level;
          act(fillOrder(state, content, slot.order.id, t));
          for (let level = levelBefore + 1; level <= state.level; level++)
            mark('level', String(level), day, state.wallet.coins);
        }
        startBatches(state, content, t, act);

        played += tickSec * SEC;
        if (stopAtTopLevel && state.level >= content.levels.length) return { milestones, samples, state, days: day };
      }
      samples.push({ day, atHour: session.atHour, level: state.level, xp: state.xp, coins: state.wallet.coins });
    }
  }
  return { milestones, samples, state, days };
}

type Act = (result: ActionResult) => boolean;
type Bought = { kind: 'shop' | 'landmark'; id: string; coins: number };

/** Spends coins in the order a sensible player would: new shops, then landmarks, then upgrades. */
function spend(state: GameState, content: Content, t: number, act: Act): Bought[] {
  const done: Bought[] = [];
  let current = state;
  const run = (result: ActionResult) => {
    const ok = act(result);
    if (result.ok) current = result.state;
    return ok;
  };

  // Coins the player is saving for something more important than an upgrade.
  let saving = 0;
  for (const shop of Object.values(content.shops)) {
    if (current.shops[shop.id] || current.level < content.unlockLevel.shops[shop.id]) continue;
    if (run(buyShop(current, content, shop.id, t)))
      done.push({ kind: 'shop', id: shop.id, coins: current.wallet.coins });
    else saving += shop.levels[0].cost;
  }
  for (const landmark of Object.values(content.landmarks)) {
    if (current.level < content.unlockLevel.landmarks[landmark.id]) continue;
    const stage = landmark.stages[landmarkStage(current, landmark.id)];
    if (!stage) continue;
    if (run(restoreLandmark(current, content, landmark.id, t))) {
      if (landmarkStage(current, landmark.id) >= landmark.stages.length)
        done.push({ kind: 'landmark', id: landmark.id, coins: current.wallet.coins });
    } else saving += stage.coins;
  }

  const canSpare = (cost: number | undefined) => cost !== undefined && current.wallet.coins - cost >= saving;
  if (pantryCount(current) >= pantryCapacity(current, content) * 0.8) {
    if (canSpare(content.economy.pantry.levels[current.pantryLevel]?.cost)) run(upgradePantry(current, content, t));
  }
  for (const [shopId, shop] of Object.entries(current.shops)) {
    if (canSpare(content.shops[shopId].levels[shop.level]?.cost)) run(upgradeShop(current, content, shopId, t));
  }
  return done;
}

/** Fills free queue slots with what the orders and landmarks need, then with a little stock. */
function startBatches(state: GameState, content: Content, t: number, act: Act) {
  let current = state;
  const recipeFor: Record<string, Recipe> = Object.create(null);
  for (const r of Object.values(content.recipes)) recipeFor[r.output] = r;

  for (let guard = 0; guard < 40; guard++) {
    const recipeId = nextRecipe(current, content, recipeFor);
    if (!recipeId) return;
    const result = startBatch(current, content, content.recipes[recipeId].shop, recipeId, t);
    if (!act(result) || !result.ok) return;
    current = result.state;
  }
}

function nextRecipe(state: GameState, content: Content, recipeFor: Record<string, Recipe>): string | null {
  // What the player has or will have: the pantry plus everything queued.
  const supply: Record<string, number> = { ...state.pantry };
  for (const shop of Object.values(state.shops)) {
    for (const batch of shop.queue) {
      const good = content.recipes[batch.recipe].output;
      supply[good] = (supply[good] ?? 0) + 1;
      // Its inputs were already taken from the pantry when it started.
    }
  }
  const free = (shopId: string) => {
    const shop = state.shops[shopId];
    return !!shop && shop.queue.length < shopLevelConfig(content, shopId, shop).queueSize;
  };

  // What is wanted: order items, and the goods for the next landmark stage.
  // A stage the player can already pay for comes first; otherwise orders do.
  const forOrders: { good: string; qty: number }[] = [];
  for (const slot of state.orders.slots) if ('order' in slot) forOrders.push(...slot.order.items);
  const wanted = [...forOrders];
  for (const landmark of Object.values(content.landmarks)) {
    if (state.level < content.unlockLevel.landmarks[landmark.id]) continue;
    const stage = landmark.stages[landmarkStage(state, landmark.id)];
    if (!stage) continue;
    if (state.wallet.coins >= stage.coins) wanted.unshift(...stage.goods);
    else wanted.push(...stage.goods);
  }

  // Walk each want down to something that can be started now.
  const claimed: Record<string, number> = {};
  const find = (good: string, qty: number, depth: number): string | null => {
    const have = (supply[good] ?? 0) - (claimed[good] ?? 0);
    const short = qty - Math.max(0, have);
    claimed[good] = (claimed[good] ?? 0) + Math.min(qty, Math.max(0, have));
    if (short <= 0 || depth > 6) return null;
    const recipe = recipeFor[good];
    if (!recipe || !recipeAvailable(state, content, recipe.id)) return null;
    for (const input of recipe.inputs) {
      const deeper = find(input.good, input.qty * short, depth + 1);
      if (deeper) return deeper;
    }
    const ready = recipe.inputs.every((i) => (state.pantry[i.good] ?? 0) >= i.qty);
    return ready && free(recipe.shop) ? recipe.id : null;
  };
  for (const want of wanted) {
    const recipeId = find(want.good, want.qty, 0);
    if (recipeId) return recipeId;
  }

  // Nothing is wanted: keep a little stock of the simplest goods, unless the pantry is filling up.
  if (pantryCount(state) >= pantryCapacity(state, content) * 0.6) return null;
  let best: { id: string; have: number } | null = null;
  for (const recipe of Object.values(content.recipes)) {
    if (recipe.inputs.length || !free(recipe.shop) || !recipeAvailable(state, content, recipe.id)) continue;
    const have = supply[recipe.output] ?? 0;
    if (have < 3 && (!best || have < best.have)) best = { id: recipe.id, have };
  }
  return best?.id ?? null;
}
