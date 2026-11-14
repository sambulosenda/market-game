import { useEffect } from 'react';

import { content } from '../content';
import { onGameEvents } from '../store';
import { haptics } from './haptics';
import { strings } from './strings';
import { closeSheet, queueLevelUp, toast } from './uiStore';

/** Turns game events into interface news: level-ups queue their pop-up, a new mastery star is announced, a bought shop closes its sheet. */
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
          if (event.type === 'masteryStarEarned') {
            const percent = event.stars * content.economy.mastery.speedPercentPerStar;
            toast(strings.mastery.earned(content.goods[event.good].name, event.stars, percent));
            haptics.success();
          }
          // The new shop appears on the street; show it.
          if (event.type === 'shopBought') closeSheet();
        }
      }),
    [],
  );
}
