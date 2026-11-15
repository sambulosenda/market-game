/**
 * Lets effects outside the canvas find things on the street. The street
 * registers a function that gives a shop's position in window coordinates.
 */
import { ui } from '../art';

export type Point = { x: number; y: number };

/**
 * How far a shop's indicator reaches above and below its anchor: half the ready bubble, and above it the
 * count badge that sits on the bubble's top corner. Something that points at the indicator stays outside this.
 */
export const INDICATOR_REACH = { up: ui.ui_ready_bubble.h / 2 + 5, down: ui.ui_ready_bubble.h / 2 };

type ShopAnchor = (shopId: string) => Promise<Point | null>;
let shopAnchor: ShopAnchor | null = null;

export function registerShopAnchor(fn: ShopAnchor | null) {
  shopAnchor = fn;
}

/** Where the centre of a shop's ready bubble is on screen right now, or null if the street is not mounted. */
export function getShopAnchor(shopId: string): Promise<Point | null> {
  return shopAnchor ? shopAnchor(shopId) : Promise.resolve(null);
}
