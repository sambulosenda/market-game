import { z } from 'zod';
import { createStore } from 'zustand/vanilla';

import type { KeyValueStorage } from './gameStore';

/**
 * The player's settings, saved apart from the game so a new game keeps them
 * and a broken save cannot lose them. Every change is written straight away.
 */
const settingsSchema = z.object({
  music: z.boolean().default(true),
  sound: z.boolean().default(true),
  haptics: z.boolean().default(true),
  /** Off until the player turns it on: notifications are opt-in. */
  notifications: z.boolean().default(false),
  /** On turns motion down even when the system setting is off. */
  reduceMotion: z.boolean().default(false),
});

export type Settings = z.infer<typeof settingsSchema>;
export type SettingKey = keyof Settings;

export const SETTINGS_KEY = 'settings';
export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({});

export type SettingsStore = Settings & {
  set(key: SettingKey, value: boolean): void;
  /** Back to the defaults, in memory only. Used after all data is deleted. */
  reset(): void;
};

/** Reads saved settings. Anything missing or unreadable falls back to its default. */
export function loadSettings(storage: KeyValueStorage): Settings {
  try {
    const raw = storage.getString(SETTINGS_KEY);
    const parsed = settingsSchema.safeParse(raw === undefined ? {} : JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function createSettingsStore(storage: KeyValueStorage) {
  return createStore<SettingsStore>()((set, get) => ({
    ...loadSettings(storage),
    set: (key, value) => {
      set({ [key]: value });
      const { set: _set, reset: _reset, ...settings } = get();
      try {
        storage.set(SETTINGS_KEY, JSON.stringify(settings));
      } catch {
        // The setting still applies for this session.
      }
    },
    reset: () => set(DEFAULT_SETTINGS),
  }));
}
