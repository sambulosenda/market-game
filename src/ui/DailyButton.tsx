import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { dailyWaiting, localDay } from '../core';
import { gameStore, useGame } from '../store';
import { Bouncy } from './Bouncy';
import { Txt } from './kit';
import { strings } from './strings';
import { colors, radius, space, TAP } from './theme';
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
    <Bouncy
      accessibilityRole="button"
      accessibilityLabel={strings.a11y.dailyButton(waiting)}
      onPress={() => openSheet({ kind: 'daily' })}
      style={styles.button}
      hitSlop={6}
    >
      <Txt variant="label">{strings.daily.button}</Txt>
      {waiting > 0 && (
        <View style={styles.badge}>
          <Txt variant="small" style={styles.badgeText}>
            {waiting}
          </Txt>
        </View>
      )}
    </Bouncy>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: TAP,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.well,
  },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.inkOnDark, fontVariant: ['tabular-nums'] },
});
