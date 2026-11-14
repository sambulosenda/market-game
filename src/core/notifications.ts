/**
 * Decides which local notifications to schedule when the player leaves. It is
 * pure: the app's shell hands the result to the system. The rules come from
 * the PRD: at most two a day, and never at night.
 */
import type { Content } from '../content/schema';
import { effectiveNow } from './clock';
import { batchEndsAt } from './production';
import type { GameState } from './types';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type NotificationKind = 'goods_ready' | 'daily_goals';

export type PlannedNotification = { kind: NotificationKind; at: number };

type Rules = Content['economy']['notifications'];

/** Local time as milliseconds, so days and hours can be read off it with plain arithmetic. */
const toLocal = (at: number, timezoneOffsetMin: number) => at - timezoneOffsetMin * 60_000;

function isQuiet(localHour: number, rules: Rules): boolean {
  const { quietStartHour: start, quietEndHour: end } = rules;
  return start > end ? localHour >= start || localHour < end : localHour >= start && localHour < end;
}

/** The time itself if it is outside quiet hours, or else the moment quiet hours next end. */
export function outsideQuietHours(at: number, timezoneOffsetMin: number, rules: Rules): number {
  const local = toLocal(at, timezoneOffsetMin);
  const dayStart = Math.floor(local / DAY_MS) * DAY_MS;
  const hour = (local - dayStart) / HOUR_MS;
  if (!isQuiet(Math.floor(hour), rules)) return at;
  const endToday = dayStart + rules.quietEndHour * HOUR_MS;
  const end = hour < rules.quietEndHour ? endToday : endToday + DAY_MS;
  return end + timezoneOffsetMin * 60_000;
}

/**
 * The notifications to schedule as the player leaves at `now`, soonest first:
 * one for when everything being made is ready, and one for the next day's
 * goals and gift. Each is moved out of quiet hours, kept apart from the
 * others, and counted against the daily cap.
 */
export function planNotifications(
  state: GameState,
  content: Content,
  now: number,
  timezoneOffsetMin: number,
): PlannedNotification[] {
  const rules = content.economy.notifications;
  const t = effectiveNow(state, now);
  const wanted: PlannedNotification[] = [];

  // When the last thing being made is done, so one visit collects everything.
  const ends = Object.values(state.shops).flatMap((shop) => shop.queue.map(batchEndsAt));
  const lastReady = Math.max(0, ...ends);
  if (lastReady > t) wanted.push({ kind: 'goods_ready', at: lastReady });

  // Tomorrow's goals and gift, as the next morning begins.
  const nextMidnight = (Math.floor(toLocal(t, timezoneOffsetMin) / DAY_MS) + 1) * DAY_MS + timezoneOffsetMin * 60_000;
  wanted.push({ kind: 'daily_goals', at: nextMidnight });

  const moved = wanted
    .map((n) => ({ ...n, at: outsideQuietHours(n.at, timezoneOffsetMin, rules) }))
    .sort((a, b) => a.at - b.at);

  const planned: PlannedNotification[] = [];
  const perDay = new Map<number, number>();
  for (const n of moved) {
    const last = planned[planned.length - 1];
    if (last && n.at - last.at < rules.minGapMinutes * 60_000) continue;
    const day = Math.floor(toLocal(n.at, timezoneOffsetMin) / DAY_MS);
    const count = perDay.get(day) ?? 0;
    if (count >= rules.maxPerDay) continue;
    perDay.set(day, count + 1);
    planned.push(n);
  }
  return planned;
}
