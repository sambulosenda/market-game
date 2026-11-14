import type { Content } from '../content/schema';
import { type GameState, type NotificationKind, planNotifications } from '../core';

/** The part of the system's notifications this game uses. The app wires in expo-notifications; tests use a fake. */
export type NotificationSystem = {
  /** True if the player has already allowed notifications. */
  allowed(): Promise<boolean>;
  /** Asks the player to allow notifications, and resolves to their answer. */
  ask(): Promise<boolean>;
  schedule(text: { title: string; body: string }, at: number): Promise<unknown>;
  cancelAll(): Promise<unknown>;
};

export type NotifierOptions = {
  system: NotificationSystem;
  content: Content;
  /** Whether the player has the setting switched on. */
  enabled: () => boolean;
  text: Record<NotificationKind, { title: string; body: string }>;
  timezoneOffsetMin?: (at: number) => number;
};

/**
 * Schedules the planned notifications as the player leaves and clears them
 * when the player is back. Nothing here can break the game: every failure
 * from the system is swallowed.
 */
export function createNotifier({
  system,
  content,
  enabled,
  text,
  timezoneOffsetMin = (at) => new Date(at).getTimezoneOffset(),
}: NotifierOptions) {
  // One call at a time, in order, so a quick leave-and-return cannot end with stale notifications.
  let chain: Promise<unknown> = Promise.resolve();
  const inOrder = <T>(work: () => Promise<T>, fallback: T): Promise<T> => {
    const next = chain.then(work).catch(() => fallback);
    chain = next;
    return next;
  };

  return {
    /** Replaces whatever is scheduled with the plan for leaving at `now`. */
    scheduleForAbsence: (game: GameState, now: number) =>
      inOrder(async () => {
        await system.cancelAll();
        if (!enabled() || !(await system.allowed())) return 0;
        const planned = planNotifications(game, content, now, timezoneOffsetMin(now));
        for (const n of planned) await system.schedule(text[n.kind], n.at);
        return planned.length;
      }, 0),

    /** The player is in the game, so nothing should arrive. */
    clear: () => inOrder(async () => void (await system.cancelAll()), undefined),

    /** Called when the player switches the setting on. Resolves to whether notifications are allowed. */
    requestPermission: () => inOrder(async () => (await system.allowed()) || (await system.ask()), false),
  };
}

export type Notifier = ReturnType<typeof createNotifier>;
