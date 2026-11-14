import PostHog from 'posthog-react-native';
import { createMMKV } from 'react-native-mmkv';

import { content } from '../content';
import { gameStore, onGameEvents } from '../store';
import { type AnalyticsEvent, toAnalytics } from './events';

/**
 * Analytics go to PostHog when a project key is set, and nowhere otherwise.
 * The key comes from the build's environment (see .env.example), so the
 * development and production builds report to separate projects.
 *
 * What is sent: the game events in `events.ts` and app opens. No touches, no
 * screen recordings and no advertising id. The player is an anonymous id made
 * on the device, which "Delete my data" replaces.
 */
const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST;

let client: PostHog | null = null;
let started = false;

function send(events: AnalyticsEvent[]) {
  for (const e of events) client?.capture(e.name, e.props);
}

export const analytics = {
  /** True when a key is set, so events are being sent. */
  get enabled() {
    return Boolean(KEY);
  },

  /** Call once at launch. Safe to call again. */
  start() {
    if (started) return;
    started = true;
    if (!KEY) return;
    try {
      // Its own store, so deleting the game's data does not half-delete the queue of unsent events.
      const storage = createMMKV({ id: 'analytics' });
      client = new PostHog(KEY, {
        ...(HOST ? { host: HOST } : {}),
        customStorage: {
          getItem: (key) => storage.getString(key) ?? null,
          setItem: (key, value) => storage.set(key, value),
        },
        captureAppLifecycleEvents: true,
        enableSessionReplay: false,
        preloadFeatureFlags: false,
      });
      onGameEvents((events) => send(toAnalytics(events, gameStore.getState().game, content)));
    } catch (error) {
      // Analytics must never stop the game from starting.
      client = null;
      console.warn('[analytics]', error);
    }
  },

  /** One event from outside the game core, such as a purchase. */
  capture(name: string, props: AnalyticsEvent['props'] = {}) {
    client?.capture(name, { ...props, player_level: gameStore.getState().game.level });
  },

  /** A new anonymous id, with nothing linking it to the old one. Called when the player deletes their data. */
  reset() {
    client?.reset();
  },
};
