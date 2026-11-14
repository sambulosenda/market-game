import { Canvas, Circle, Group, matchFont, Path, RoundedRect, Skia, Text } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, useCompetingGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  type SharedValue,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withDecay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { backgrounds, emptyPlotArt, goodArt, landmarkArt, shopArt, signArt, ui } from '../art';
import { content } from '../content';
import { type ShopView, viewShop } from '../core';
import { gameStore, useGame } from '../store';
import { tapLot } from '../ui/lotActions';
import { strings } from '../ui/strings';
import { colors } from '../ui/theme';
import { useNow } from '../ui/useNow';
import { useReduceMotion } from '../ui/useReduceMotion';
import { registerShopAnchor } from './anchors';
import { GROUND_Y, LOT_WIDTH, lotAt, lotX, PARALLAX, SCENE_HEIGHT, SHOP_BASE_Y, streetWidth } from './layout';
import { Sprite, TiledBand } from './sprites';
import { Smoke, Structure, Swinging, useAmbientPhase } from './Structure';

const RING_RADIUS = 24;
const BUBBLE = ui.ui_ready_bubble;
/** Where the rooftops and street strips sit, from the top of the scene. */
const ROOFTOPS_Y = GROUND_Y - 2 - backgrounds.bg_rooftops.h;
const STREET_Y = SCENE_HEIGHT - backgrounds.bg_street.h;

/** From level 2 a shop is a building with a chimney, this far across its art. Level 1 is a market stall. */
const CHIMNEY_X = 0.805;
const hasChimney = (level: number) => level >= 2;

const font = matchFont({
  fontFamily: Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' }),
  fontSize: 14,
  fontWeight: 'bold',
});

const ringPath = Skia.PathBuilder.Make().addCircle(0, 0, RING_RADIUS).detach();

/** The y of the centre of a shop's indicator: just above the building, kept on screen. */
function indicatorY(shopHeight: number): number {
  return Math.max(BUBBLE.h / 2 + 4, SHOP_BASE_Y - shopHeight - BUBBLE.h / 2 - 2);
}

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
  const still = useReduceMotion();

  const shopsByLot = useMemo(() => {
    const map = new Map<number, string>();
    for (const shop of Object.values(content.shops)) map.set(shop.lot, shop.id);
    return map;
  }, []);

  const landmarksByLot = useMemo(() => {
    const map = new Map<number, string>();
    for (const landmark of Object.values(content.landmarks)) map.set(landmark.lot, landmark.id);
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
      scrollX.value = withDecay({
        velocity: -e.velocityX,
        clamp: [0, maxScroll],
      });
    },
  });

  // --- tapping -----------------------------------------------------------
  // Every lot gives tap feedback: a short squash and spring back, plus a haptic.
  const pressedLot = useSharedValue(-1);
  const bounce = useSharedValue(1);
  const tap = useTapGesture({
    runOnJS: true,
    onActivate: (e) => {
      const lot = lotAt(e.x + scrollX.value, e.y, lotCount);
      if (lot === null) return;
      pressedLot.value = lot;
      bounce.value = withSequence(withTiming(0.93, { duration: 70 }), withSpring(1, { damping: 8, stiffness: 300 }));
      tapLot(lot);
    },
  });
  const gesture = useCompetingGestures(pan, tap);

  // --- where shops are on screen, for effects drawn above the canvas -------
  const container = useRef<React.ComponentRef<typeof View>>(null);
  useEffect(() => {
    registerShopAnchor(
      (shopId) =>
        new Promise((resolve) => {
          const shop = content.shops[shopId];
          const node = container.current;
          if (!shop || !node) return resolve(null);
          node.measureInWindow((x, y) => {
            const cx = lotX(shop.lot) + LOT_WIDTH / 2 - scrollX.value;
            const owned = gameStore.getState().game.shops[shopId];
            const height = owned ? (shopArt(shopId, owned.level)?.h ?? 0) : emptyPlotArt.h;
            resolve({
              x: x + Math.min(width, Math.max(0, cx)),
              y: y + indicatorY(height),
            });
          });
        }),
    );
    return () => registerShopAnchor(null);
  }, [scrollX, width]);

  // --- layer transforms ----------------------------------------------------
  const skyTransform = useDerivedValue(() => [{ translateX: -scrollX.value * PARALLAX.sky }]);
  const roofTransform = useDerivedValue(() => [{ translateX: -scrollX.value * PARALLAX.rooftops }]);
  const streetTransform = useDerivedValue(() => [{ translateX: -scrollX.value * PARALLAX.street }]);

  const readySummary = Object.entries(views)
    .map(([id, v]) => strings.a11y.shopLot(content.shops[id].name, v.readyCount))
    .join('. ');

  return (
    <View
      ref={container}
      style={styles.container}
      accessible
      accessibilityLabel={`${strings.a11y.street} ${readySummary}`}
    >
      <GestureDetector gesture={gesture}>
        <Canvas style={{ width, height: SCENE_HEIGHT }}>
          <Group transform={skyTransform}>
            <TiledBand art={backgrounds.bg_sky} y={0} width={width + maxScroll * PARALLAX.sky} />
          </Group>
          <Group transform={roofTransform}>
            <TiledBand art={backgrounds.bg_rooftops} y={ROOFTOPS_Y} width={width + maxScroll * PARALLAX.rooftops} />
          </Group>
          <Group transform={streetTransform}>
            <TiledBand art={backgrounds.bg_street} y={STREET_Y} width={fullWidth} />
            {Array.from({ length: lotCount }, (_, lot) => {
              const shopId = shopsByLot.get(lot);
              const owned = shopId ? game.shops[shopId] : undefined;
              const building = shopId && owned ? shopArt(shopId, owned.level) : undefined;
              const view = shopId ? views[shopId] : undefined;
              // A landmark shows, in ruins, from the level that unlocks it.
              const landmarkId = landmarksByLot.get(lot);
              const landmark =
                landmarkId && game.level >= content.unlockLevel.landmarks[landmarkId]
                  ? landmarkArt(landmarkId, game.landmarks[landmarkId]?.stage ?? 0)
                  : undefined;
              const art = building ?? landmark ?? emptyPlotArt;
              const stage = owned?.level ?? (landmarkId ? (game.landmarks[landmarkId]?.stage ?? 0) : 0);
              // Neighbouring shops loop out of step with each other.
              const offset = (lot * 0.37) % 1;
              return (
                <Lot
                  key={lot}
                  lot={lot}
                  pressedLot={pressedLot}
                  bounce={bounce}
                  scrollX={scrollX}
                  viewWidth={width}
                  still={still}
                >
                  {(phase) => (
                    <>
                      <Structure
                        art={art}
                        stage={stage}
                        phase={phase}
                        offset={offset}
                        sway={!!building && !hasChimney(owned?.level ?? 0)}
                        still={still}
                      >
                        {shopId && building && (
                          <>
                            {hasChimney(owned?.level ?? 0) && (
                              <Smoke
                                x={(LOT_WIDTH - building.w) / 2 + building.w * CHIMNEY_X}
                                y={SHOP_BASE_Y - building.h + 4}
                                phase={phase}
                                offset={offset}
                                still={still}
                              />
                            )}
                            <ShopSign
                              shopId={shopId}
                              shopWidth={building.w}
                              shopHeight={building.h}
                              phase={phase}
                              offset={offset}
                              still={still}
                            />
                          </>
                        )}
                      </Structure>
                      {shopId && building && view && (
                        <Group transform={[{ translateX: LOT_WIDTH / 2 }, { translateY: indicatorY(building.h) }]}>
                          <ShopIndicator view={view} clock={game.clock} />
                        </Group>
                      )}
                      {!building && !landmark && shopId && <PlotTag shopId={shopId} level={game.level} />}
                      {!building && !landmark && landmarkId && <LockTag />}
                    </>
                  )}
                </Lot>
              );
            })}
          </Group>
        </Canvas>
      </GestureDetector>
    </View>
  );
}

/** One lot. Scales about the middle of its base while it is the lot being pressed. */
function Lot({
  lot,
  pressedLot,
  bounce,
  scrollX,
  viewWidth,
  still,
  children,
}: {
  lot: number;
  pressedLot: SharedValue<number>;
  bounce: SharedValue<number>;
  scrollX: SharedValue<number>;
  viewWidth: number;
  still: boolean;
  /** Draws the lot, given the phase of its ambient loop. */
  children: (phase: SharedValue<number>) => React.ReactNode;
}) {
  const phase = useAmbientPhase(lot, scrollX, viewWidth, still);
  // Plain numbers only inside worklets: they run on the UI thread and cannot call ordinary JS functions.
  const x = lotX(lot);
  const transform = useDerivedValue(() => {
    const scale = pressedLot.value === lot ? bounce.value : 1;
    return [
      { translateX: x + LOT_WIDTH / 2 },
      { translateY: SHOP_BASE_Y },
      { scale },
      { translateX: -LOT_WIDTH / 2 },
      { translateY: -SHOP_BASE_Y },
    ];
  });
  return <Group transform={transform}>{children(phase)}</Group>;
}

/** The hanging sign, a separate layer from the building, swinging from its top-left corner. */
function ShopSign({
  shopId,
  shopWidth,
  shopHeight,
  phase,
  offset,
  still,
}: {
  shopId: string;
  shopWidth: number;
  shopHeight: number;
  phase: SharedValue<number>;
  offset: number;
  still: boolean;
}) {
  const art = signArt(shopId);
  if (!art) return null;
  const left = (LOT_WIDTH - shopWidth) / 2;
  return (
    <Swinging
      art={art}
      x={left + 4}
      y={SHOP_BASE_Y - shopHeight - art.h * 0.45}
      phase={phase}
      offset={offset}
      still={still}
    />
  );
}

const TAG_Y = SHOP_BASE_Y - emptyPlotArt.h / 2;

function LockTag() {
  return <Sprite art={ui.ui_lock} cx={LOT_WIDTH / 2} baseY={TAG_Y + ui.ui_lock.h * 0.4} scale={0.8} />;
}

/** What stands on a shop's plot before it is bought: a lock, or its price once the level is reached. */
function PlotTag({ shopId, level }: { shopId: string; level: number }) {
  if (level < content.unlockLevel.shops[shopId]) return <LockTag />;
  const label = strings.number(content.shops[shopId].levels[0].cost);
  const textWidth = font.measureText(label).width;
  const coin = 22;
  const width = coin + 6 + textWidth + 24;
  const x = (LOT_WIDTH - width) / 2;
  return (
    <Group>
      <RoundedRect x={x} y={TAG_Y - 18} width={width} height={36} r={18} color={colors.panel} />
      <RoundedRect
        x={x}
        y={TAG_Y - 18}
        width={width}
        height={36}
        r={18}
        color={colors.cardEdge}
        style="stroke"
        strokeWidth={2}
      />
      <Sprite art={ui.ui_coin} cx={x + 12 + coin / 2} baseY={TAG_Y + coin / 2} scale={coin / ui.ui_coin.h} />
      <Text x={x + 12 + coin + 6} y={TAG_Y + 5} text={label} font={font} color={colors.ink} />
    </Group>
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
    // Never step backwards, even if the device clock does mid-bake.
    wallClock.value = Math.max(wallClock.value, Date.now());
  }, false);
  useEffect(() => {
    frame.setActive(!!active);
  }, [active, frame]);

  const progress = useDerivedValue(() =>
    // Never earlier than the last time the game saw: a clock set backwards grants no progress.
    Math.min(1, Math.max(0, (Math.max(wallClock.value, floor.value) - start.value) / duration.value)),
  );

  if (view.readyCount > 0) {
    const first = view.batches.find((b) => b.status === 'ready');
    const icon = first ? goodArt(content.recipes[first.batch.recipe].output) : undefined;
    const label = `${view.readyCount}`;
    const labelWidth = font.measureText(label).width;
    // The bubble's tail takes roughly the bottom fifth, so the icon sits a little above centre.
    return (
      <Group>
        <Sprite art={BUBBLE} cx={0} baseY={BUBBLE.h / 2} />
        {icon && <Sprite art={icon} cx={0} baseY={BUBBLE.h * 0.5 - 16} scale={30 / Math.max(icon.w, icon.h)} />}
        <Circle cx={BUBBLE.w / 2 - 6} cy={-BUBBLE.h / 2 + 6} r={11} color={colors.accent} />
        <Text
          x={BUBBLE.w / 2 - 6 - labelWidth / 2}
          y={-BUBBLE.h / 2 + 11}
          text={label}
          font={font}
          color={colors.inkOnDark}
        />
      </Group>
    );
  }

  if (!active) return null;
  const icon = goodArt(content.recipes[active.batch.recipe].output);
  return (
    <Group>
      <Circle cx={0} cy={0} r={RING_RADIUS + 5} color={colors.panel} />
      {icon && <Sprite art={icon} cx={0} baseY={14} scale={28 / Math.max(icon.w, icon.h)} />}
      <Path path={ringPath} color={colors.panelEdge} style="stroke" strokeWidth={6} />
      <Group transform={[{ rotate: -Math.PI / 2 }]}>
        <Path path={ringPath} color={colors.ring} style="stroke" strokeWidth={6} strokeCap="round" end={progress} />
      </Group>
    </Group>
  );
}

const styles = StyleSheet.create({
  container: { height: SCENE_HEIGHT, backgroundColor: colors.sky },
});
