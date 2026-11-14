import { useEffect, useRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useStore } from 'zustand';

import { ui } from '../art';
import { content } from '../content';
import { pantryCapacity, pantryCount } from '../core';
import { useGame } from '../store';
import { setPantryTarget } from './fx/CollectFx';
import { fxStore, shownCount } from './fx/fxStore';
import { GoodIcon } from './GoodIcon';
import { strings } from './strings';
import { colors } from './theme';

/** Goods the player owns, with how full the pantry is. The full pantry screen comes with T4.4. */
export function PantryBar() {
  const pantry = useGame((s) => s.game.pantry);
  const count = useGame((s) => pantryCount(s.game));
  const capacity = useGame((s) => pantryCapacity(s.game, content));
  const inFlight = useStore(fxStore, (s) => s.inFlight);
  const basket = useRef<React.ComponentRef<typeof View>>(null);
  useEffect(() => {
    setPantryTarget(basket.current);
    return () => setPantryTarget(null);
  }, []);

  // A good stays hidden until its first one lands, then counts up as the rest arrive.
  const items = Object.entries(pantry)
    .map(([good, owned]) => [good, shownCount(owned, inFlight[good])] as const)
    .filter(([, n]) => n > 0);

  return (
    <View style={styles.bar} accessibilityRole="summary">
      <View ref={basket} collapsable={false}>
        <Image source={ui.ui_pantry.source} style={styles.basket} accessible={false} />
      </View>
      <View style={styles.body}>
        <Text style={styles.label} accessibilityLabel={strings.a11y.pantryCount(count, capacity)}>
          {strings.pantry} {strings.pantryCount(count, capacity)}
        </Text>
        {items.length === 0 ? (
          <Text style={styles.empty}>{strings.pantryEmpty}</Text>
        ) : (
          <View style={styles.items}>
            {items.map(([good, n]) => (
              <PantryChip key={good} good={good} count={n} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function PantryChip({ good, count }: { good: string; count: number }) {
  const landed = useStore(fxStore, (s) => s.landed[good] ?? 0);
  const scale = useSharedValue(1);
  useEffect(() => {
    if (landed === 0) return;
    scale.value = withSequence(withTiming(1.15, { duration: 80 }), withSpring(1, { damping: 9, stiffness: 320 }));
  }, [landed, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const name = content.goods[good]?.name ?? good;
  return (
    <Animated.View style={[styles.chip, style]} accessible accessibilityLabel={strings.a11y.pantryItem(name, count)}>
      <GoodIcon good={good} size={26} />
      <Text style={styles.chipText}>{count}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.panel,
    borderBottomWidth: 2,
    borderColor: colors.panelEdge,
  },
  basket: { width: ui.ui_pantry.w, height: ui.ui_pantry.h },
  body: { flex: 1, gap: 4 },
  label: { fontSize: 13, fontWeight: '700', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 1 },
  empty: { fontSize: 15, color: colors.inkSoft },
  items: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingLeft: 6,
    paddingRight: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.panelEdge,
  },
  chipText: { fontSize: 16, color: colors.ink, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
