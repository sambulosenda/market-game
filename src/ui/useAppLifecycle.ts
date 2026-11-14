import { useEffect } from 'react';
import { AppState } from 'react-native';

import { gameStore } from '../store';

/**
 * Resumes the game at launch and each time the app returns to the
 * foreground, and records the time and saves when it leaves.
 */
export function useAppLifecycle() {
  useEffect(() => {
    gameStore.getState().resume();
    let previous = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && previous !== 'active') gameStore.getState().resume();
      if (next === 'background') gameStore.getState().pause();
      previous = next;
    });
    return () => sub.remove();
  }, []);
}
