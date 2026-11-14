import * as Haptics from 'expo-haptics';

import { settingsStore } from '../store';

/** Every haptic in the game goes through here, so the haptics setting turns them all off. */
const on = () => settingsStore.getState().haptics;

export const haptics = {
  /** A tap on something. */
  light: () => void (on() && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Moving between things, or a tap that only opens something. */
  select: () => void (on() && Haptics.selectionAsync()),
  success: () => void (on() && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** An action that did not happen. */
  warning: () => void (on() && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
