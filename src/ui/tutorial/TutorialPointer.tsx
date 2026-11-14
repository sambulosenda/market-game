import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useStore } from 'zustand';

import { content } from '../../content';
import { getShopAnchor, type Point } from '../../scene/anchors';
import { useGame } from '../../store';
import { originOf } from '../fx/measure';
import { colors } from '../theme';
import { uiStore } from '../uiStore';
import { useNow } from '../useNow';
import { useReduceMotion } from '../useReduceMotion';
import { tutorialTarget, type TutorialTarget } from './steps';
import { measureTarget } from './targets';

const W = 44;
const H = 52;
const GAP = 6;

// A chunky arrow pointing down, its tip at the bottom centre.
const arrow = Skia.PathBuilder.Make()
  .moveTo(W / 2, H - 2)
  .lineTo(4, H - 24)
  .lineTo(15, H - 24)
  .lineTo(15, 3)
  .lineTo(W - 15, 3)
  .lineTo(W - 15, H - 24)
  .lineTo(W - 4, H - 24)
  .close()
  .detach();

/** Where the arrow goes, and which target that position was measured for. */
type Spot = { key: string; x: number; y: number; flip: boolean };

async function locate(target: TutorialTarget): Promise<{ point: Point; below: Point } | null> {
  if (target.kind === 'lot') {
    const point = await getShopAnchor(target.shop);
    return point ? { point, below: point } : null;
  }
  const rect = await measureTarget(target.id);
  if (!rect) return null;
  const x = rect.x + rect.width / 2;
  return { point: { x, y: rect.y }, below: { x, y: rect.y + rect.height } };
}

/**
 * The onboarding's only voice: an arrow that bobs above the next thing to
 * tap. It follows its target as the street scrolls and sheets open, never
 * takes touches, and is gone for good once the second shop is open.
 */
export function TutorialPointer() {
  const game = useGame((s) => s.game);
  const popupOpen = useGame((s) => s.welcomeBack !== null);
  const sheet = useStore(uiStore, (s) => s.sheet);
  const levelUp = useStore(uiStore, (s) => s.levelUps.length > 0);
  const now = useNow(300);
  const still = useReduceMotion();
  const layer = useRef<React.ComponentRef<typeof View>>(null);
  const [spot, setSpot] = useState<Spot | null>(null);

  const target = tutorialTarget({ game, content, now, sheet, popupOpen: popupOpen || levelUp });
  const key = target ? (target.kind === 'lot' ? `lot:${target.shop}` : target.id) : null;

  // Find the target again a few times a second: the street scrolls and sheets slide.
  useEffect(() => {
    let current = true;
    if (!target || !key) return;
    Promise.all([locate(target), originOf(layer.current)]).then(([found, origin]) => {
      if (!current) return;
      if (!found || !origin) return setSpot(null);
      // Above the target, or below it when there is no room above.
      const flip = found.point.y - origin.y < H + GAP + 8;
      const at = flip ? found.below : found.point;
      setSpot({ key, x: at.x - origin.x, y: at.y - origin.y, flip });
    });
    return () => {
      current = false;
    };
    // `key` stands for the target; `now` re-runs the search on a timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, now]);

  const bob = useSharedValue(0);
  useEffect(() => {
    if (still || !key) {
      cancelAnimation(bob);
      bob.set(0);
      return;
    }
    bob.set(withRepeat(withTiming(1, { duration: 450, easing: Easing.inOut(Easing.quad) }), -1, true));
    return () => cancelAnimation(bob);
  }, [still, key, bob]);

  // A position measured for an earlier target is not shown for the next one.
  const shown = spot && spot.key === key ? spot : null;
  const flip = shown?.flip ?? false;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: (flip ? 1 : -1) * bob.get() * 10 }, { rotate: flip ? '180deg' : '0deg' }],
  }));

  return (
    <View ref={layer} style={StyleSheet.absoluteFill} pointerEvents="none" collapsable={false}>
      {shown && (
        <Animated.View
          style={[
            styles.pointer,
            { left: shown.x - W / 2, top: shown.flip ? shown.y + GAP : shown.y - H - GAP },
            style,
          ]}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          <Canvas style={styles.canvas}>
            <Path path={arrow} color={colors.primary} />
            <Path path={arrow} color={colors.inkOnDark} style="stroke" strokeWidth={3} strokeJoin="round" />
          </Canvas>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pointer: { position: 'absolute', width: W, height: H },
  canvas: { width: W, height: H },
});
