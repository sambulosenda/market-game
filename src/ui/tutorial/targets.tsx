import { type ReactNode, useCallback } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';

import type { Measurable } from '../fx/measure';

/** Controls the onboarding can point at, by id. A control registers while it is on screen. */
const targets = new Map<string, Measurable>();

export type Rect = { x: number; y: number; width: number; height: number };

/** A ref callback that registers a view under `id` while it is mounted. */
export function useTargetRef(id: string) {
  return useCallback(
    (node: Measurable | null) => {
      if (node) targets.set(id, node);
      else targets.delete(id);
    },
    [id],
  );
}

/** Wraps a control so the onboarding can find it. It adds no styling of its own. */
export function Target({ id, style, children }: { id: string; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const ref = useTargetRef(id);
  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
}

/** Where a registered control is in the window right now, or null if it is not on screen. */
export function measureTarget(id: string): Promise<Rect | null> {
  return new Promise((resolve) => {
    const node = targets.get(id);
    if (!node) return resolve(null);
    node.measureInWindow((x, y, width, height) => resolve(width > 0 && height > 0 ? { x, y, width, height } : null));
  });
}
