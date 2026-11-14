/**
 * Daily goals and the login calendar. Three goals are set each local day and
 * pay coins when claimed, with a gem bonus for claiming all three. The
 * calendar gives one gift per day the player comes back, in a cycle; it counts
 * gifts taken, not dates, so missing a day never resets it.
 */
import type { Content, Economy } from '../content/schema';
import { effectiveNow } from './clock';
import { nextRandom } from './rng';
import type { ActionResult, Daily, DailyGoal, DailyGoalKind, GameState } from './types';
import { earn } from './wallet';

const DAY_MS = 24 * 60 * 60 * 1000;
export const DAILY_GOAL_COUNT = 3;

/** The state before the first day has been set up. The first refresh fills it in. */
export const NO_DAILY: Daily = { day: -1, goals: [], bonusClaimed: false, calendar: { claimed: 0, lastDay: null } };

/**
 * The local calendar day as a whole number that goes up by one at each local
 * midnight. `timezoneOffsetMin` is what `Date.getTimezoneOffset()` gives:
 * minutes to add to local time to get UTC.
 */
export function localDay(now: number, timezoneOffsetMin: number): number {
  return Math.floor((now - timezoneOffsetMin * 60_000) / DAY_MS);
}

/** How long until the next local midnight, when the goals change. */
export function msUntilNextDay(now: number, timezoneOffsetMin: number): number {
  return (localDay(now, timezoneOffsetMin) + 1) * DAY_MS + timezoneOffsetMin * 60_000 - now;
}

function forLevel<T extends { minLevel: number }>(rows: T[], level: number): T {
  let match = rows[0];
  for (const row of rows) if (row.minLevel <= level) match = row;
  return match;
}

function today(state: GameState, now: number, timezoneOffsetMin: number): number {
  // Never earlier than the day already seen: a clock or time zone set back grants no new day.
  return Math.max(state.daily.day, localDay(effectiveNow(state, now), timezoneOffsetMin));
}

function makeGoals(state: GameState, daily: Economy['daily']): { goals: DailyGoal[]; rng: number } {
  const pool = [...daily.goals];
  const goals: DailyGoal[] = [];
  let rng = state.rng;
  while (goals.length < DAILY_GOAL_COUNT && pool.length > 0) {
    const roll = nextRandom(rng);
    rng = roll.seed;
    const [picked] = pool.splice(Math.floor(roll.value * pool.length), 1);
    goals.push({
      kind: picked.kind,
      target: forLevel(picked.targets, state.level).target,
      progress: 0,
      coins: daily.goalCoinsPerLevel * state.level,
      claimed: false,
    });
  }
  return { goals, rng };
}

/**
 * Sets new goals when a new local day has begun. Returns the same state
 * object otherwise, so it is cheap to call often. Unclaimed rewards from the
 * day before are lost; the calendar is left alone.
 */
export function refreshDaily(state: GameState, content: Content, now: number, timezoneOffsetMin: number): GameState {
  const day = today(state, now, timezoneOffsetMin);
  if (day <= state.daily.day) return state;
  const { goals, rng } = makeGoals(state, content.economy.daily);
  return { ...state, rng, daily: { ...state.daily, day, goals, bonusClaimed: false } };
}

/** Counts something the player did towards today's goals of that kind. */
export function recordDaily(state: GameState, kind: DailyGoalKind, amount: number): GameState {
  if (amount <= 0 || !state.daily.goals.some((g) => g.kind === kind && g.progress < g.target)) return state;
  const goals = state.daily.goals.map((g) =>
    g.kind === kind ? { ...g, progress: Math.min(g.target, g.progress + amount) } : g,
  );
  return { ...state, daily: { ...state.daily, goals } };
}

/**
 * Pays a finished goal's coins. Claiming the last of the day's goals also
 * pays the gem bonus.
 */
export function claimDailyGoal(state: GameState, content: Content, index: number, now: number): ActionResult {
  const goal = state.daily.goals[index];
  if (!goal) return { ok: false, reason: 'unknown_goal' };
  if (goal.claimed) return { ok: false, reason: 'already_claimed' };
  if (goal.progress < goal.target) return { ok: false, reason: 'goal_not_done' };

  const t = effectiveNow(state, now);
  const goals = state.daily.goals.map((g, i) => (i === index ? { ...g, claimed: true } : g));
  const allClaimed = goals.every((g) => g.claimed) && !state.daily.bonusClaimed;
  const gems = allClaimed ? content.economy.daily.allGoalsGems : 0;
  let wallet = earn(state.wallet, 'coins', goal.coins, 'daily_goal', t);
  wallet = earn(wallet, 'gems', gems, 'daily_goal', t);
  return {
    ok: true,
    state: {
      ...state,
      clock: t,
      wallet,
      daily: { ...state.daily, goals, bonusClaimed: state.daily.bonusClaimed || allClaimed },
    },
    events: [{ type: 'dailyGoalClaimed', kind: goal.kind, coins: goal.coins, gems }],
  };
}

export type CalendarGift = { coins: number; gems: number };

export type CalendarView = {
  /** One gift per day of the cycle, at the player's current level. */
  gifts: CalendarGift[];
  /** How many gifts of this cycle have been taken. */
  taken: number;
  /** Whether today's gift is still waiting. */
  canClaim: boolean;
};

function giftAt(content: Content, state: GameState, index: number): CalendarGift {
  const gift = content.economy.daily.calendar[index];
  return { coins: gift.coinsPerLevel * state.level, gems: gift.gems };
}

/** The login calendar as the player sees it now. */
export function viewCalendar(state: GameState, content: Content, now: number, timezoneOffsetMin: number): CalendarView {
  const length = content.economy.daily.calendar.length;
  const canClaim = state.daily.calendar.lastDay !== today(state, now, timezoneOffsetMin);
  const done = state.daily.calendar.claimed % length;
  return {
    gifts: content.economy.daily.calendar.map((_, i) => giftAt(content, state, i)),
    // A finished cycle stays on show, full, until the next gift starts a new one.
    taken: done === 0 && state.daily.calendar.claimed > 0 && !canClaim ? length : done,
    canClaim,
  };
}

/** Takes today's calendar gift: once per local day, the next in the cycle. */
export function claimCalendarGift(
  state: GameState,
  content: Content,
  now: number,
  timezoneOffsetMin: number,
): ActionResult {
  const day = today(state, now, timezoneOffsetMin);
  if (state.daily.calendar.lastDay === day) return { ok: false, reason: 'already_claimed' };
  const t = effectiveNow(state, now);
  const index = state.daily.calendar.claimed % content.economy.daily.calendar.length;
  const gift = giftAt(content, state, index);
  let wallet = earn(state.wallet, 'coins', gift.coins, 'daily_calendar', t);
  wallet = earn(wallet, 'gems', gift.gems, 'daily_calendar', t);
  return {
    ok: true,
    state: {
      ...state,
      clock: t,
      wallet,
      daily: { ...state.daily, calendar: { claimed: state.daily.calendar.claimed + 1, lastDay: day } },
    },
    events: [{ type: 'calendarGiftClaimed', day: index + 1, coins: gift.coins, gems: gift.gems }],
  };
}

/** How many rewards are waiting to be claimed: finished goals plus today's gift. For the badge. */
export function dailyWaiting(state: GameState, now: number, timezoneOffsetMin: number): number {
  const goals = state.daily.goals.filter((g) => !g.claimed && g.progress >= g.target).length;
  return goals + (state.daily.calendar.lastDay !== today(state, now, timezoneOffsetMin) ? 1 : 0);
}
