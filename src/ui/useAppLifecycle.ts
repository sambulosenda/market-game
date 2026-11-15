import { useEffect } from 'react';
import { AppState } from 'react-native';

import { analytics } from '../analytics';
import { notifier } from '../notify';
import { gameStore } from '../store';

/**
 * Resumes the game at launch and each time the app returns to the
 * foreground, and records the time and saves when it leaves. Notifications
 * are scheduled on the way out and cleared on the way back in, so none
 * arrives while the player is in the game.
 */
export function useAppLifecycle() {
  useEffect(() => {
    analytics.start();
    gameStore.getState().resume();
    void notifier.clear();
    let previous = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && previous !== 'active') {
        gameStore.getState().resume();
        void notifier.clear();
      }
      if (next === 'background') {
        gameStore.getState().pause();
        void notifier.scheduleForAbsence(gameStore.getState().game, Date.now());
      }
      previous = next;
    });
    return () => sub.remove();
  }, []);
}
