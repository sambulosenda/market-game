import { Canvas, Circle, Group, matchFont, Path, Skia, Text } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, useCompetingGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withDecay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { content } from '../content';
import { type ShopView, viewShop } from '../core';
import { gameStore, useGame } from '../store';
import { strings } from '../ui/strings';
import { colors } from '../ui/theme';
import { useNow } from '../ui/useNow';
import { GROUND_Y, LOT_WIDTH, lotAt, lotX, PARALLAX, SCENE_HEIGHT, streetWidth } from './layout';
import { BakeryStall, EmptyPlot, LoafIcon, RooftopsLayer, SkyLayer, StreetLayer } from './placeholders';

const RING_RADIUS = 22;
const INDICATOR_Y = 34;

const font = matchFont({
  fontFamily: Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' }),
  fontSize: 15,
  fontWeight: 'bold',
});

const ringPath = Skia.PathBuilder.Make().addCircle(0, 0, RING_RADIUS).detach();

/**
 * The street: one Skia canvas the width of the screen. A pan gesture moves a
 * scroll offset on the UI thread, and three layers follow it at different
 * speeds for parallax. Taps are mapped back to street coordinates to find
 * the lot underneath.
 */
export function Street() {
  const { width } = useWindowDimensions();
  const lotCount = content.street.lotCount;
  const fullWidth = streetWidth(lotCount);
  const maxScroll = Math.max(0, fullWidth - width);

  const game = useGame((s) => s.game);
  const now = useNow(1000);

  const shopsByLot = useMemo(() => {
    const map = new Map<number, string>();
    for (const shop of Object.values(content.shops)) map.set(shop.lot, shop.id);
    return map;
  }, []);

  const views = useMemo(() => {
    const out: Record<string, ShopView> = {};
    for (const id of Object.keys(game.shops)) out[id] = viewShop(game, content, id, now);
    return out;
  }, [game, now]);

  // --- scrolling ---------------------------------------------------------
  const scrollX = useSharedValue(0);
  const panStart = useSharedValue(0);
  const pan = usePanGesture({
    activeOffsetX: [-8, 8],
    onActivate: () => {
      'worklet';
      cancelAnimation(scrollX);
      panStart.value = scrollX.value;
    },
    onUpdate: (e) => {
      'worklet';
      scrollX.value = Math.min(maxScroll, Math.max(0, panStart.value - e.translationX));
    },
    onDeactivate: (e) => {
      'worklet';
      scrollX.value = withDecay({ velocity: -e.velocityX, clamp: [0, maxScroll] });
    },
  });

  // --- tapping -----------------------------------------------------------
  const bounce = useSharedValue(1);
  const tap = useTapGesture({
    runOnJS: true,
    onActivate: (e) => {
      const lot = lotAt(e.x + scrollX.value, e.y, lotCount);
      if (lot === null) return;
      const shopId = shopsByLot.get(lot);
      if (!shopId || !gameStore.getState().game.shops[shopId]) {
        Haptics.selectionAsync();
        return;
      }
      bounce.value = withSequence(withTiming(0.94, { duration: 70 }), withSpring(1, { damping: 8, stiffness: 300 }));
      if (gameStore.getState().collect(shopId) === null) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
  });
  const gesture = useCompetingGestures(pan, tap);

  // --- layer transforms ----------------------------------------------------
  const skyTransform = useDerivedValue(() => [{ translateX: -scrollX.value * PARALLAX.sky }]);
  const roofTransform = useDerivedValue(() => [{ translateX: -scrollX.value * PARALLAX.rooftops }]);
  const streetTransform = useDerivedValue(() => [{ translateX: -scrollX.value * PARALLAX.street }]);

  const bakery = views.bakery;
  const bakeryLot = content.shops.bakery.lot;
  const bakeryTransform = useDerivedValue(() => [
    { translateX: lotX(bakeryLot) + LOT_WIDTH / 2 },
    { translateY: GROUND_Y },
    { scale: bounce.value },
    { translateX: -LOT_WIDTH / 2 },
    { translateY: -GROUND_Y },
  ]);

  return (
    <View
      style={styles.container}
      accessible
      accessibilityLabel={`${strings.a11y.street} ${strings.a11y.shopLot(content.shops.bakery.name, bakery?.readyCount ?? 0)}`}
    >
      <GestureDetector gesture={gesture}>
        <Canvas style={{ width, height: SCENE_HEIGHT }}>
          <Group transform={skyTransform}>
            <SkyLayer width={width + maxScroll * PARALLAX.sky} />
          </Group>
          <Group transform={roofTransform}>
            <RooftopsLayer width={width + maxScroll * PARALLAX.rooftops} />
          </Group>
          <Group transform={streetTransform}>
            <StreetLayer width={fullWidth} />
            {Array.from({ length: lotCount }, (_, lot) => {
              if (lot === bakeryLot) return null;
              return (
                <Group key={lot} transform={[{ translateX: lotX(lot) }]}>
                  <EmptyPlot />
                </Group>
              );
            })}
            {bakery && (
              <Group transform={bakeryTransform}>
                <BakeryStall />
                <Group transform={[{ translateX: LOT_WIDTH / 2 }, { translateY: INDICATOR_Y }]}>
                  <ShopIndicator view={bakery} clock={game.clock} />
                </Group>
              </Group>
            )}
          </Group>
        </Canvas>
      </GestureDetector>
    </View>
  );
}

/** A progress ring while baking, or a ready bubble with a count once something is done. */
function ShopIndicator({ view, clock }: { view: ShopView; clock: number }) {
  const start = useSharedValue(0);
  const floor = useSharedValue(clock);
  const duration = useSharedValue(1);
  const wallClock = useSharedValue(clock);

  const active = view.active;
  useEffect(() => {
    start.value = active?.batch.startAt ?? 0;
    duration.value = active?.batch.durationMs ?? 1;
    floor.value = clock;
  }, [active?.batch.startAt, active?.batch.durationMs, clock, start, duration, floor]);

  // Runs on the UI thread each frame, so the ring fills smoothly at 60 fps
  // without re-rendering React. Paused when nothing is baking.
  const frame = useFrameCallback(() => {
    wallClock.value = Date.now();
  }, false);
  useEffect(() => {
    frame.setActive(!!active);
  }, [active, frame]);

  const progress = useDerivedValue(() =>
    // Never earlier than the last time the game saw: a clock set backwards grants no progress.
    Math.min(1, Math.max(0, (Math.max(wallClock.value, floor.value) - start.value) / duration.value)),
  );

  if (view.readyCount > 0) {
    const label = `${view.readyCount}`;
    const labelWidth = font.measureText(label).width;
    return (
      <Group>
        <Circle cx={0} cy={0} r={28} color={colors.bubble} />
        <Circle cx={0} cy={0} r={28} color={colors.panelEdge} style="stroke" strokeWidth={2} />
        <LoafIcon cx={0} cy={0} size={1.1} />
        <Circle cx={22} cy={-20} r={12} color={colors.accent} />
        <Text x={22 - labelWidth / 2} y={-15} text={label} font={font} color={colors.buttonText} />
      </Group>
    );
  }

  if (!active) return null;
  return (
    <Group>
      <Circle cx={0} cy={0} r={RING_RADIUS + 6} color="rgba(0,0,0,0.15)" />
      <Path path={ringPath} color={colors.ringTrack} style="stroke" strokeWidth={7} />
      <Group transform={[{ rotate: -Math.PI / 2 }]}>
        <Path path={ringPath} color={colors.ring} style="stroke" strokeWidth={7} strokeCap="round" end={progress} />
      </Group>
    </Group>
  );
}

const styles = StyleSheet.create({
  container: { height: SCENE_HEIGHT, backgroundColor: colors.sky },
});
