import { useEffect } from 'react';

import { dailyWaiting, localDay } from '../core';
import { gameStore, useGame } from '../store';
import { PillButton } from './kit';
import { strings } from './strings';
import { openSheet } from './uiStore';
import { useNow } from './useNow';

/** Opens the daily goals. A badge counts the rewards waiting to be claimed. */
export function DailyButton() {
  const game = useGame((s) => s.game);
  const now = useNow(15_000);
  const offset = new Date(now).getTimezoneOffset();
  const waiting = dailyWaiting(game, now, offset);

  // New goals at local midnight, even if the game is left open across it.
  const newDay = localDay(now, offset) > game.daily.day;
  useEffect(() => {
    if (newDay) gameStore.getState().refreshOrders();
  }, [newDay]);

  return (
    <PillButton
      label={strings.daily.button}
      badge={waiting}
      accessibilityLabel={strings.a11y.dailyButton(waiting)}
      onPress={() => openSheet({ kind: 'daily' })}
    />
  );
}
