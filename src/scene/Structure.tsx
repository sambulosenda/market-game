/**
 * What stands on a lot, and how it moves: the ambient loop (a swaying stall,
 * a swinging sign, chimney smoke) and the build animation that plays when a
 * shop opens or is upgraded, or a landmark stage is restored.
 */
import { Circle, Group } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { Art } from '../art';
import { colors } from '../ui/theme';
import { LOT_WIDTH, lotX, SHOP_BASE_Y } from './layout';
import { AMBIENT_LOOP_MS, BUILD_MS, buildPose, lotVisible, signAngle, smokePuff, swayAngle } from './motion';
import { Sprite } from './sprites';

const CX = LOT_WIDTH / 2;
const SMOKE_PUFFS = 3;
const DUST_PUFFS = [-1, -0.6, -0.2, 0.2, 0.6, 1];

/**
 * The phase of a lot's ambient loop: 0 to 1, repeating. It only runs while
 * the lot is on screen and motion is allowed. A stopped loop schedules no
 * frames at all, so shops off screen cost nothing.
 */
export function useAmbientPhase(
  lot: number,
  scrollX: SharedValue<number>,
  viewWidth: number,
  still: boolean,
): SharedValue<number> {
  const phase = useSharedValue(0);
  const x = lotX(lot);
  useAnimatedReaction(
    () => !still && lotVisible(x, scrollX.value, viewWidth),
    (running, wasRunning) => {
      if (running === wasRunning) return;
      cancelAnimation(phase);
      phase.value = 0;
      if (running) {
        phase.value = withRepeat(withTiming(1, { duration: AMBIENT_LOOP_MS, easing: Easing.linear }), -1, false);
      }
    },
  );
  return phase;
}

type Shown = { art: Art; stage: number; from: Art | null; run: number };

/**
 * The building, plot or landmark on a lot, standing on the pavement.
 * `stage` is the shop's level or the landmark's restored stage. When it goes
 * up, the old art gives way to the new in a short build animation that plays
 * once. Children (the sign, the smoke) are drawn with the new art and move
 * with it.
 */
export function Structure({
  art,
  stage,
  phase,
  offset,
  sway,
  still,
  children,
}: {
  art: Art;
  stage: number;
  phase: SharedValue<number>;
  /** Keeps this lot's loop out of step with its neighbours. */
  offset: number;
  /** Market stalls sway gently; buildings stand still. */
  sway: boolean;
  still: boolean;
  children?: React.ReactNode;
}) {
  const [shown, setShown] = useState<Shown>({ art, stage, from: null, run: 0 });
  if (art !== shown.art || stage !== shown.stage) {
    // Only growth is animated: loading a save or wiping the game just swaps the art.
    const grew = stage > shown.stage && !still;
    setShown({ art, stage, from: grew ? shown.art : null, run: grew ? shown.run + 1 : shown.run });
  }

  const build = useSharedValue(1);
  const run = shown.run;
  useEffect(() => {
    if (run === 0) return;
    const finish = (finishedRun: number) =>
      setShown((s) => (s.run === finishedRun && s.from ? { ...s, from: null } : s));
    build.value = 0;
    build.value = withTiming(1, { duration: BUILD_MS, easing: Easing.linear }, (finished) => {
      'worklet';
      if (finished) scheduleOnRN(finish, run);
    });
    return () => {
      // Whatever interrupts it, the building ends up whole.
      cancelAnimation(build);
      build.value = 1;
    };
  }, [run, build]);

  const oldOpacity = useDerivedValue(() => buildPose(build.value).oldOpacity);
  const oldTransform = useDerivedValue(() => [
    { translateY: SHOP_BASE_Y },
    { scaleY: buildPose(build.value).oldScaleY },
    { translateY: -SHOP_BASE_Y },
  ]);
  const newOpacity = useDerivedValue(() => buildPose(build.value).newOpacity);
  const newTransform = useDerivedValue(() => {
    const pose = buildPose(build.value);
    return [
      { translateX: CX },
      { translateY: SHOP_BASE_Y },
      { rotate: sway && !still ? swayAngle(phase.value, offset) : 0 },
      { scaleX: pose.newScaleX },
      { scaleY: pose.newScaleY },
      { translateX: -CX },
      { translateY: -SHOP_BASE_Y },
    ];
  });

  return (
    <>
      {shown.from && (
        <Group opacity={oldOpacity} transform={oldTransform}>
          <Sprite art={shown.from} cx={CX} baseY={SHOP_BASE_Y} />
        </Group>
      )}
      <Group opacity={newOpacity} transform={newTransform}>
        <Sprite art={art} cx={CX} baseY={SHOP_BASE_Y} />
        {children}
      </Group>
      {shown.from && DUST_PUFFS.map((side) => <Dust key={side} side={side} build={build} width={art.w} />)}
    </>
  );
}

/** One puff of the dust kicked up along the base during a build. */
function Dust({ side, build, width }: { side: number; build: SharedValue<number>; width: number }) {
  const reach = width / 2 + 14;
  const transform = useDerivedValue(() => {
    const { dustSpread } = buildPose(build.value);
    return [
      { translateX: CX + side * reach * (0.45 + 0.55 * dustSpread) },
      { translateY: SHOP_BASE_Y - 6 - 16 * dustSpread * (1 - Math.abs(side) * 0.5) },
      { scale: 0.6 + dustSpread },
    ];
  });
  const opacity = useDerivedValue(() => buildPose(build.value).dustOpacity);
  return (
    <Group transform={transform} opacity={opacity}>
      <Circle cx={0} cy={0} r={11} color={colors.panelEdge} />
    </Group>
  );
}

/** A sprite hanging from the middle of its top edge at (x, y), swinging like a shop sign. */
export function Swinging({
  art,
  x,
  y,
  phase,
  offset,
  still,
}: {
  art: Art;
  x: number;
  y: number;
  phase: SharedValue<number>;
  offset: number;
  still: boolean;
}) {
  const transform = useDerivedValue(() => [
    { translateX: x },
    { translateY: y },
    { rotate: still ? 0 : signAngle(phase.value, offset) },
    { translateX: -x },
    { translateY: -y },
  ]);
  return (
    <Group transform={transform}>
      <Sprite art={art} cx={x} baseY={y + art.h} />
    </Group>
  );
}

/** Chimney smoke rising from (x, y). Drawn only while motion is allowed: frozen smoke looks wrong. */
export function Smoke({
  x,
  y,
  phase,
  offset,
  still,
}: {
  x: number;
  y: number;
  phase: SharedValue<number>;
  offset: number;
  still: boolean;
}) {
  if (still) return null;
  return (
    <>
      {Array.from({ length: SMOKE_PUFFS }, (_, index) => (
        <SmokePuff key={index} index={index} x={x} y={y} phase={phase} offset={offset} />
      ))}
    </>
  );
}

function SmokePuff({
  index,
  x,
  y,
  phase,
  offset,
}: {
  index: number;
  x: number;
  y: number;
  phase: SharedValue<number>;
  offset: number;
}) {
  const transform = useDerivedValue(() => {
    const puff = smokePuff(phase.value, index, SMOKE_PUFFS, offset);
    return [{ translateX: x + puff.dx }, { translateY: y + puff.dy }, { scale: puff.r / 10 }];
  });
  const opacity = useDerivedValue(() => smokePuff(phase.value, index, SMOKE_PUFFS, offset).opacity);
  return (
    <Group transform={transform} opacity={opacity}>
      <Circle cx={0} cy={0} r={10} color={colors.panel} />
    </Group>
  );
}
