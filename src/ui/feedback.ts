import type { FailReason } from '../core';
import { haptics } from './haptics';
import { failText } from './strings';
import { toast } from './uiStore';

/**
 * Gives the feedback for an action's result: a success haptic, or a warning
 * haptic and a toast saying why it did not happen. Returns true on success.
 */
export function report(failed: FailReason | null, onSuccess: 'success' | 'light' | 'none' = 'light'): boolean {
  if (failed) {
    haptics.warning();
    toast(failText(failed));
    return false;
  }
  if (onSuccess === 'success') haptics.success();
  else if (onSuccess === 'light') haptics.light();
  return true;
}
