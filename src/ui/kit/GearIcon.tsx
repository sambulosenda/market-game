import { Canvas, Circle, Group, RoundedRect } from '@shopify/react-native-skia';

import { colors } from '../theme';

const TEETH = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);

/** A drawn gear. The text glyph for a gear is thin and faint on iOS, so this is painted instead. */
export function GearIcon({ size = 26, color = colors.ink }: { size?: number; color?: string }) {
  const c = size / 2;
  const tooth = size * 0.2;
  return (
    <Canvas style={{ width: size, height: size }}>
      {TEETH.map((angle) => (
        <Group key={angle} origin={{ x: c, y: c }} transform={[{ rotate: angle }]}>
          <RoundedRect
            x={c - tooth / 2}
            y={size * 0.04}
            width={tooth}
            height={size * 0.24}
            r={tooth * 0.3}
            color={color}
          />
        </Group>
      ))}
      <Circle cx={c} cy={c} r={size * 0.25} color={color} style="stroke" strokeWidth={size * 0.2} />
    </Canvas>
  );
}
