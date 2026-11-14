/** Street geometry, in points. The street scrolls horizontally in portrait. */
export const LOT_WIDTH = 240;
export const LOT_GAP = 16;
export const STREET_MARGIN = 32;
export const SCENE_HEIGHT = 380;
/** Where the pavement starts, measured from the top of the scene. */
export const GROUND_Y = 290;
/** Where the bottom edge of a shop or plot image sits: just onto the pavement. */
export const SHOP_BASE_Y = GROUND_Y + 10;

/** How fast each background layer moves relative to the street. */
export const PARALLAX = { sky: 0.1, rooftops: 0.4, street: 1 } as const;

export function streetWidth(lotCount: number): number {
  return STREET_MARGIN * 2 + lotCount * LOT_WIDTH + (lotCount - 1) * LOT_GAP;
}

export function lotX(lot: number): number {
  return STREET_MARGIN + lot * (LOT_WIDTH + LOT_GAP);
}

/** The lot under a point on the street, if any. `x` is in street coordinates. */
export function lotAt(x: number, y: number, lotCount: number): number | null {
  if (y < 0 || y > SCENE_HEIGHT) return null;
  const lot = Math.floor((x - STREET_MARGIN + LOT_GAP / 2) / (LOT_WIDTH + LOT_GAP));
  return lot >= 0 && lot < lotCount ? lot : null;
}
