import { type Art, backgrounds, goods, landmarks, shops, signs, ui } from './manifest';

export type { Art };
export { backgrounds, ui };

const goodsByName: Record<string, Art | undefined> = goods;
const shopsByName: Record<string, Art | undefined> = shops;
const landmarksByName: Record<string, Art | undefined> = landmarks;
const signsByName: Record<string, Art | undefined> = signs;

/** The icon for a good, by content id. */
export function goodArt(goodId: string): Art | undefined {
  return goodsByName[`good_${goodId}`];
}

/** The building for a shop at a level (1 to 3). Falls back to the nearest lower level drawn. */
export function shopArt(shopId: string, level: number): Art | undefined {
  for (let l = Math.min(Math.max(level, 1), 3); l >= 1; l--) {
    const art = shopsByName[`shop_${shopId}_l${l}`];
    if (art) return art;
  }
  return undefined;
}

/** A landmark with this many stages restored (0 to 3). */
export function landmarkArt(landmarkId: string, stage: number): Art | undefined {
  return landmarksByName[`landmark_${landmarkId}_${Math.min(Math.max(stage, 0), 3)}`];
}

export function signArt(shopId: string): Art | undefined {
  return signsByName[`sign_${shopId}`];
}

export const emptyPlotArt: Art = shops.plot_empty;
