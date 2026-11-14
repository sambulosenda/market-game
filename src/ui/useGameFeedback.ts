import { useEffect } from 'react';

import { onGameEvents } from '../store';
import { haptics } from './haptics';
import { closeSheet, queueLevelUp } from './uiStore';

/** Turns game events into interface news: level-ups queue their pop-up, a bought shop closes its sheet. */
export function useGameFeedback() {
  useEffect(
    () =>
      onGameEvents((events) => {
        for (const event of events) {
          if (event.type === 'levelUp') {
            queueLevelUp({
              level: event.level,
              gems: event.gems,
              unlocks: event.unlocks,
            });
            haptics.success();
          }
          // The new shop appears on the street; show it.
          if (event.type === 'shopBought') closeSheet();
        }
      }),
    [],
  );
}
