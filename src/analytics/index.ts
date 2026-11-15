import Constants from 'expo-constants';
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
 * What is sent: the game events in `events.ts`, app opens, and JavaScript
 * errors the game did not handle, with their stack traces, so crashes can be
 * found and fixed. No touches, no screen recordings and no advertising id.
 * Every event is tagged with the app and whether it is a development build,
 * so it can share a PostHog project with other apps. The player is an anonymous id made
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
        errorTracking: { autocapture: { uncaughtExceptions: true, unhandledRejections: true } },
        enableSessionReplay: false,
        preloadFeatureFlags: false,
      });
      void client.register({
        app: 'market_street',
        environment: __DEV__ ? 'development' : 'production',
        app_version: Constants.expoConfig?.version ?? 'unknown',
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

  /** Reports an error the game caught and recovered from, such as a save that would not load. */
  error(error: unknown, where: string) {
    client?.captureException(error, { where });
  },

  /** A new anonymous id, with nothing linking it to the old one. Called when the player deletes their data. */
  reset() {
    client?.reset();
  },
};
