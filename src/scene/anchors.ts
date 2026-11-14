/**
 * Lets effects outside the canvas find things on the street. The street
 * registers a function that gives a shop's position in window coordinates.
 */
export type Point = { x: number; y: number };

type ShopAnchor = (shopId: string) => Promise<Point | null>;
let shopAnchor: ShopAnchor | null = null;

export function registerShopAnchor(fn: ShopAnchor | null) {
  shopAnchor = fn;
}

/** Where a shop's ready bubble is on screen right now, or null if the street is not mounted. */
export function getShopAnchor(shopId: string): Promise<Point | null> {
  return shopAnchor ? shopAnchor(shopId) : Promise.resolve(null);
}
