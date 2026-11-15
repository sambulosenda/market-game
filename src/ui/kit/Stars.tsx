import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import { colors } from '../theme';

/** A five-pointed star inside a `size` square, starting at `x`. */
function starPath(x: number, size: number) {
  const path = Skia.PathBuilder.Make();
  const c = size / 2;
  const outer = size * 0.48;
  const inner = outer * 0.45;
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = x + c + r * Math.cos(angle);
    const py = c + size * 0.03 + r * Math.sin(angle);
    if (i === 0) path.moveTo(px, py);
    else path.lineTo(px, py);
  }
  return path.close().detach();
}

/** A row of drawn stars: `earned` filled, the rest up to `max` as outlines. Decorative; label it on the parent. */
export function Stars({ earned, max, size = 14 }: { earned: number; max: number; size?: number }) {
  const gap = size * 0.15;
  const paths = useMemo(
    () => Array.from({ length: max }, (_, i) => starPath(i * (size + gap), size)),
    [max, size, gap],
  );
  return (
    <Canvas style={{ width: max * size + (max - 1) * gap, height: size }} accessible={false}>
      {paths.map((path, i) =>
        i < earned ? (
          <Path key={i} path={path} color={colors.accent} />
        ) : (
          <Path key={i} path={path} color={colors.disabledEdge} style="stroke" strokeWidth={1.2} strokeJoin="round" />
        ),
      )}
    </Canvas>
  );
}
