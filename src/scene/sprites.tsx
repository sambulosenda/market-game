/**
 * Small Skia helpers for drawing the painted art. Images load asynchronously,
 * so each helper draws nothing until its image is ready.
 */
import { Image, ImageShader, Rect, useImage } from '@shopify/react-native-skia';

import type { Art } from '../art';

/** An image drawn at its natural size in points, with its bottom centre at (cx, baseY). */
export function Sprite({ art, cx, baseY, scale = 1 }: { art: Art; cx: number; baseY: number; scale?: number }) {
  const image = useImage(art.source);
  const w = art.w * scale;
  const h = art.h * scale;
  return <Image image={image} x={cx - w / 2} y={baseY - h} width={w} height={h} fit="fill" />;
}

/**
 * A strip repeated across `width`, with its top at `y`. Every other copy is
 * mirrored, so the joins are seamless whatever the art.
 */
export function TiledBand({ art, y, width }: { art: Art; y: number; width: number }) {
  const image = useImage(art.source);
  if (!image) return null;
  return (
    <Rect x={0} y={y} width={width} height={art.h}>
      <ImageShader image={image} tx="mirror" ty="clamp" fit="fill" rect={{ x: 0, y, width: art.w, height: art.h }} />
    </Rect>
  );
}
