import type { Point } from '../../scene/anchors';

export type Measurable = {
  measureInWindow(cb: (x: number, y: number, w: number, h: number) => void): void;
};

/** The centre of a view in window coordinates, or null if there is no view. */
export function centreOf(node: Measurable | null): Promise<Point | null> {
  return new Promise((resolve) => {
    if (!node) return resolve(null);
    node.measureInWindow((x, y, w, h) => resolve({ x: x + w / 2, y: y + h / 2 }));
  });
}

/** The top-left corner of a view in window coordinates. */
export function originOf(node: Measurable | null): Promise<Point | null> {
  return new Promise((resolve) => {
    if (!node) return resolve(null);
    node.measureInWindow((x, y) => resolve({ x, y }));
  });
}
