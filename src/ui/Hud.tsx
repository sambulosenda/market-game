import { useEffect, useRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useStore } from 'zustand';

import { ui } from '../art';
import { content } from '../content';
import { levelProgress, pantryCapacity, pantryCount, xpForNextLevel } from '../core';
import { useGame } from '../store';
import { Bouncy } from './Bouncy';
import { setPantryTarget } from './fx/CollectFx';
import { fxStore } from './fx/fxStore';
import { setCoinTarget } from './fx/RewardFx';
import { Amount, CurrencyIcon, ProgressBar, Txt } from './kit';
import { strings } from './strings';
import { colors, radius, space, TAP } from './theme';
import { openSheet } from './uiStore';

/** A value that pops briefly whenever `trigger` changes. */
function usePop(trigger: number) {
  const scale = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    scale.set(withSequence(withTiming(1.15, { duration: 80 }), withSpring(1, { damping: 9, stiffness: 320 })));
  }, [trigger, scale]);
  return useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
}

/** The bar across the top: level and XP, coins, gems, and the pantry. */
export function Hud() {
  const level = useGame((s) => s.game.level);
  const xp = useGame((s) => s.game.xp);
  const progress = useGame((s) => levelProgress(s.game, content));
  const nextXp = useGame((s) => xpForNextLevel(s.game, content));
  const coins = useGame((s) => s.game.wallet.coins);
  const gems = useGame((s) => s.game.wallet.gems);
  const count = useGame((s) => pantryCount(s.game));
  const capacity = useGame((s) => pantryCapacity(s.game, content));
  // Goods still flying to the pantry are not counted until they land.
  const flying = useStore(fxStore, (s) => Object.values(s.inFlight).reduce((a, b) => a + b, 0));
  const landed = useStore(fxStore, (s) => Object.values(s.landed).reduce((a, b) => a + b, 0));
  const shown = Math.max(0, count - flying);

  const basket = useRef<React.ComponentRef<typeof View>>(null);
  const coin = useRef<React.ComponentRef<typeof View>>(null);
  useEffect(() => {
    setPantryTarget(basket.current);
    setCoinTarget(coin.current);
    return () => {
      setPantryTarget(null);
      setCoinTarget(null);
    };
  }, []);

  const coinPop = usePop(coins);
  const pantryPop = usePop(landed);
  const full = shown >= capacity;

  return (
    <View style={styles.bar}>
      <View style={styles.level} accessible accessibilityLabel={strings.a11y.levelProgress(level, xp, nextXp)}>
        <View style={styles.star}>
          <CurrencyIcon kind="xp" size={40} />
          <Txt variant="label" style={styles.starText}>
            {level}
          </Txt>
        </View>
        <View style={styles.xp}>
          <ProgressBar progress={progress} color={colors.accent} height={10} />
        </View>
      </View>

      <Animated.View style={[styles.pill, coinPop]}>
        <View ref={coin} collapsable={false}>
          <Amount kind="coins" value={coins} />
        </View>
      </Animated.View>
      <View style={styles.pill}>
        <Amount kind="gems" value={gems} />
      </View>

      <Bouncy
        accessibilityRole="button"
        accessibilityLabel={strings.a11y.pantryButton(shown, capacity)}
        onPress={() => openSheet({ kind: 'pantry' })}
        style={[styles.pill, styles.pantry]}
      >
        <Animated.View style={[styles.pantryInner, pantryPop]}>
          <View ref={basket} collapsable={false}>
            <Image source={ui.ui_pantry.source} style={styles.basket} resizeMode="contain" accessible={false} />
          </View>
          <Txt variant="label" style={[styles.count, full && styles.full]}>
            {strings.pantryCount(shown, capacity)}
          </Txt>
        </Animated.View>
      </Bouncy>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.panel,
    borderBottomWidth: 2,
    borderColor: colors.panelEdge,
  },
  level: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minWidth: 84,
  },
  star: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starText: { position: 'absolute', top: 11, color: colors.ink },
  xp: { flex: 1 },
  pill: {
    minHeight: TAP,
    justifyContent: 'center',
    paddingHorizontal: space.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.panelEdge,
  },
  pantry: { borderColor: colors.cardEdge },
  pantryInner: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  basket: { width: 26, height: 26 },
  count: { fontVariant: ['tabular-nums'] },
  full: { color: colors.bad },
});
