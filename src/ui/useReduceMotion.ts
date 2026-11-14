import { useReducedMotion } from 'react-native-reanimated';

import { useSettings } from '../store';

/**
 * True when motion should be kept down: the system setting is on, or the
 * player turned it on in the game's settings. Everything except tap feedback
 * respects this.
 */
export function useReduceMotion(): boolean {
  const system = useReducedMotion();
  const chosen = useSettings((s) => s.reduceMotion);
  return system || chosen;
}
