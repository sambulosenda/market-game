import * as Haptics from 'expo-haptics';

import type { FailReason } from '../core';
import { failText } from './strings';
import { toast } from './uiStore';

/**
 * Gives the feedback for an action's result: a success haptic, or a warning
 * haptic and a toast saying why it did not happen. Returns true on success.
 */
export function report(failed: FailReason | null, onSuccess: 'success' | 'light' | 'none' = 'light'): boolean {
  if (failed) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    toast(failText(failed));
    return false;
  }
  if (onSuccess === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else if (onSuccess === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  return true;
}
