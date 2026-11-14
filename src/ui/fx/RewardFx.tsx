import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { Point } from '../../scene/anchors';
import { onGameEvents } from '../../store';
import { Amount, CurrencyIcon } from '../kit';
import { colors, radius } from '../theme';
import { centreOf, type Measurable, originOf } from './measure';

const COINS = 6;
const COIN = 26;
const FLIGHT_MS = 450;
const STAGGER_MS = 45;
const FLOAT_MS = 1000;

let coinTarget: Measurable | null = null;
let rewardOrigin: Point | null = null;

/** The coin counter registers itself as where reward coins fly to. */
export function setCoinTarget(node: Measurable | null) {
  coinTarget = node;
}

/** Where the next reward bursts from, in window coordinates: the order that was just filled. */
export function setRewardOrigin(point: Point | null) {
  rewardOrigin = point;
}

type Burst = { id: number; from: Point; to: Point; xp: number };

/**
 * The reward for filling an order: coins burst from the order and fly to the
 * coin counter, and the XP floats up and fades. Drawn above everything, never
 * takes touches, and is skipped with reduce motion on.
 */
export function RewardFx() {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const layer = useRef<React.ComponentRef<typeof View>>(null);
  const nextId = useRef(1);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    return onGameEvents((events) => {
      for (const event of events) {
        if (event.type !== 'orderFilled') continue;
        const from = rewardOrigin;
        const { xp } = event;
        if (!from) continue;
        Promise.all([centreOf(coinTarget), originOf(layer.current)]).then(([to, origin]) => {
          if (!to || !origin) return;
          const id = nextId.current++;
          setBursts((current) => [
            ...current,
            {
              id,
              xp,
              from: { x: from.x - origin.x, y: from.y - origin.y },
              to: { x: to.x - origin.x, y: to.y - origin.y },
            },
          ]);
        });
      }
    });
  }, [reduceMotion]);

  const finish = (id: number) => setBursts((current) => current.filter((b) => b.id !== id));

  return (
    <View ref={layer} style={StyleSheet.absoluteFill} pointerEvents="none" collapsable={false}>
      {bursts.map((burst) => (
        <View key={burst.id} style={StyleSheet.absoluteFill}>
          {Array.from({ length: COINS }, (_, i) => (
            <FlyingCoin key={i} burst={burst} index={i} />
          ))}
          <FloatingXp burst={burst} onDone={finish} />
        </View>
      ))}
    </View>
  );
}

function FlyingCoin({ burst, index }: { burst: Burst; index: number }) {
  const t = useSharedValue(0);
  const { from, to } = burst;
  // Each coin first hops out in its own direction, then heads for the counter.
  const angle = (index / COINS) * Math.PI * 2;
  const outX = Math.cos(angle) * 34;
  const outY = Math.sin(angle) * 22;

  useEffect(() => {
    t.set(
      withDelay(
        index * STAGGER_MS,
        withTiming(1, {
          duration: FLIGHT_MS,
          easing: Easing.inOut(Easing.quad),
        }),
      ),
    );
  }, [t, index]);

  const style = useAnimatedStyle(() => {
    const p = t.get();
    const spread = Math.sin(p * Math.PI);
    return {
      opacity: p === 0 || p === 1 ? 0 : 1,
      transform: [
        {
          translateX: interpolate(p, [0, 1], [from.x, to.x]) + outX * spread - COIN / 2,
        },
        {
          translateY: interpolate(p, [0, 1], [from.y, to.y]) + outY * spread - COIN / 2,
        },
        { scale: interpolate(p, [0, 0.2, 1], [0.5, 1, 0.7]) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.item, style]}>
      <CurrencyIcon kind="coins" size={COIN} />
    </Animated.View>
  );
}

function FloatingXp({ burst, onDone }: { burst: Burst; onDone: (id: number) => void }) {
  const t = useSharedValue(0);
  const { from, id } = burst;

  useEffect(() => {
    t.set(
      withTiming(1, { duration: FLOAT_MS, easing: Easing.out(Easing.quad) }, () => {
        scheduleOnRN(onDone, id);
      }),
    );
    // Start once: the burst is fixed when it is created.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => {
    const p = t.get();
    return {
      opacity: interpolate(p, [0, 0.1, 0.7, 1], [0, 1, 1, 0]),
      transform: [{ translateX: from.x - 40 }, { translateY: from.y - 16 - p * 56 }],
    };
  });

  return (
    <Animated.View style={[styles.item, styles.xp, style]}>
      <Amount kind="xp" value={burst.xp} prefix="+" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  item: { position: 'absolute', left: 0, top: 0 },
  xp: {
    width: 80,
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.cardEdge,
    paddingVertical: 3,
  },
});
