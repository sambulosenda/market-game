/**
 * Placeholder art drawn with Skia shapes. Each piece matches the size and
 * anchor the final painted image will use, so swapping in real art later
 * means replacing these components with <Image> layers.
 */
import { Circle, Group, LinearGradient, Path, Rect, RoundedRect, Skia, vec } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import { colors } from '../ui/theme';
import { GROUND_Y, LOT_WIDTH, SCENE_HEIGHT } from './layout';

export function SkyLayer({ width }: { width: number }) {
  return (
    <Group>
      <Rect x={0} y={0} width={width} height={GROUND_Y}>
        <LinearGradient start={vec(0, 0)} end={vec(0, GROUND_Y)} colors={[colors.sky, colors.skyLow]} />
      </Rect>
      <Circle cx={width * 0.3} cy={60} r={26} color="#FFF3D6" />
    </Group>
  );
}

/** A row of simple house silhouettes, regenerated deterministically for any width. */
export function RooftopsLayer({ width }: { width: number }) {
  const [light, dark] = useMemo(() => rooftopPaths(width), [width]);
  return (
    <Group>
      <Path path={light} color={colors.rooftops} />
      <Path path={dark} color={colors.rooftopsDark} />
    </Group>
  );
}

function rooftopPaths(width: number) {
  const light = Skia.PathBuilder.Make();
  const dark = Skia.PathBuilder.Make();
  let x = -20;
  let i = 0;
  while (x < width + 40) {
    const w = 60 + ((i * 37) % 40);
    const h = 70 + ((i * 53) % 60);
    const top = GROUND_Y - h;
    const target = i % 3 === 0 ? dark : light;
    target.moveTo(x, GROUND_Y);
    target.lineTo(x, top);
    target.lineTo(x + w / 2, top - 26);
    target.lineTo(x + w, top);
    target.lineTo(x + w, GROUND_Y);
    target.close();
    x += w - 6;
    i += 1;
  }
  return [light.detach(), dark.detach()] as const;
}

export function StreetLayer({ width }: { width: number }) {
  return (
    <Group>
      <Rect x={0} y={GROUND_Y - 16} width={width} height={22} color={colors.pavement} />
      <Rect x={0} y={GROUND_Y + 6} width={width} height={4} color={colors.kerb} />
      <Rect x={0} y={GROUND_Y + 10} width={width} height={SCENE_HEIGHT - GROUND_Y - 10} color={colors.street} />
    </Group>
  );
}

/** An empty plot with two marker stakes. Drawn with its bottom-left at (0, GROUND_Y). */
export function EmptyPlot() {
  return (
    <Group>
      <RoundedRect x={10} y={GROUND_Y - 34} width={LOT_WIDTH - 20} height={30} r={6} color={colors.plot} />
      <RoundedRect
        x={10}
        y={GROUND_Y - 34}
        width={LOT_WIDTH - 20}
        height={30}
        r={6}
        color={colors.plotEdge}
        style="stroke"
        strokeWidth={2}
      />
      <Rect x={22} y={GROUND_Y - 70} width={6} height={40} color={colors.wood} />
      <Rect x={LOT_WIDTH - 28} y={GROUND_Y - 70} width={6} height={40} color={colors.wood} />
    </Group>
  );
}

/** A small loaf, used on the stall counter and as the ready icon. Centred on (cx, cy). */
export function LoafIcon({ cx, cy, size = 1 }: { cx: number; cy: number; size?: number }) {
  const w = 30 * size;
  const h = 18 * size;
  return (
    <Group>
      <RoundedRect x={cx - w / 2} y={cy - h / 2} width={w} height={h} r={h / 2} color={colors.bread} />
      <Rect x={cx - w * 0.2} y={cy - h * 0.35} width={2 * size} height={h * 0.5} color={colors.breadDark} />
      <Rect x={cx} y={cy - h * 0.35} width={2 * size} height={h * 0.5} color={colors.breadDark} />
      <Rect x={cx + w * 0.2} y={cy - h * 0.35} width={2 * size} height={h * 0.5} color={colors.breadDark} />
    </Group>
  );
}

/** Level 1 bakery: a market stall with a striped awning. Bottom-left at (0, GROUND_Y). */
export function BakeryStall() {
  const counterTop = GROUND_Y - 70;
  const awningTop = GROUND_Y - 190;
  const stripes = 8;
  const stripeW = (LOT_WIDTH - 10) / stripes;
  return (
    <Group>
      {/* posts */}
      <Rect x={18} y={awningTop + 20} width={8} height={GROUND_Y - awningTop - 20} color={colors.woodDark} />
      <Rect x={LOT_WIDTH - 26} y={awningTop + 20} width={8} height={GROUND_Y - awningTop - 20} color={colors.woodDark} />
      {/* back board */}
      <Rect x={26} y={awningTop + 30} width={LOT_WIDTH - 52} height={counterTop - awningTop - 30} color="#E9C99A" />
      {/* awning */}
      {Array.from({ length: stripes }, (_, i) => (
        <Rect
          key={i}
          x={5 + i * stripeW}
          y={awningTop}
          width={stripeW}
          height={34}
          color={i % 2 === 0 ? colors.awningA : colors.awningB}
        />
      ))}
      {Array.from({ length: stripes }, (_, i) => (
        <Circle
          key={`s${i}`}
          cx={5 + i * stripeW + stripeW / 2}
          cy={awningTop + 34}
          r={stripeW / 2}
          color={i % 2 === 0 ? colors.awningA : colors.awningB}
        />
      ))}
      {/* counter */}
      <Rect x={10} y={counterTop} width={LOT_WIDTH - 20} height={70} color={colors.wood} />
      <Rect x={6} y={counterTop - 6} width={LOT_WIDTH - 12} height={10} color={colors.woodDark} />
      <LoafIcon cx={60} cy={counterTop - 14} />
      <LoafIcon cx={100} cy={counterTop - 14} />
      <LoafIcon cx={140} cy={counterTop - 14} />
      {/* blank hanging sign: lettering is a separate layer, never baked into art */}
      <RoundedRect x={LOT_WIDTH / 2 - 40} y={awningTop - 36} width={80} height={28} r={6} color={colors.awningB} />
      <RoundedRect
        x={LOT_WIDTH / 2 - 40}
        y={awningTop - 36}
        width={80}
        height={28}
        r={6}
        color={colors.woodDark}
        style="stroke"
        strokeWidth={3}
      />
    </Group>
  );
}
