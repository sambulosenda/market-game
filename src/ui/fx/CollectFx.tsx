import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { getShopAnchor, type Point } from '../../scene/anchors';
import { onGameEvents } from '../../store';
import { GoodIcon } from '../GoodIcon';
import { land, landAll, splitFlights, takeOff } from './fxStore';
import { useReduceMotion } from '../useReduceMotion';
import { centreOf, type Measurable, originOf } from './measure';

const FLIGHT_MS = 400;
const STAGGER_MS = 70;
const ICON = 36;

let pantryTarget: Measurable | null = null;

/** The pantry registers the icon that collected goods fly to. */
export function setPantryTarget(node: Measurable | null) {
  pantryTarget = node;
}

type Flight = {
  id: number;
  good: string;
  qty: number;
  from: Point;
  to: Point;
  delay: number;
};

/**
 * Draws collected goods flying from their shop to the pantry icon, above
 * everything else. It never takes touches, and runs on the UI thread. With
 * reduce motion on, goods go straight to the pantry.
 */
export function CollectFx() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const layer = useRef<React.ComponentRef<typeof View>>(null);
  const nextId = useRef(1);
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion) return;
    const stop = onGameEvents((events) => {
      for (const event of events) {
        if (event.type !== 'batchCollected') continue;
        const { shop, good, qty } = event;
        // Hold the counter back now, in the same tick as the collect, so it never flashes the new total.
        takeOff(good, qty);
        Promise.all([getShopAnchor(shop), centreOf(pantryTarget), originOf(layer.current)]).then(
          ([from, to, origin]) => {
            if (!from || !to || !origin) return land(good, qty);
            const parts = splitFlights(qty);
            setFlights((current) => [
              ...current,
              ...parts.map((part, i) => ({
                id: nextId.current++,
                good,
                qty: part,
                from: { x: from.x - origin.x, y: from.y - origin.y },
                to: { x: to.x - origin.x, y: to.y - origin.y },
                delay: i * STAGGER_MS,
              })),
            ]);
          },
        );
      }
    });
    return () => {
      stop();
      landAll();
    };
  }, [reduceMotion]);

  const finish = (flight: Flight) => {
    land(flight.good, flight.qty);
    setFlights((current) => current.filter((f) => f.id !== flight.id));
  };

  return (
    <View ref={layer} style={StyleSheet.absoluteFill} pointerEvents="none" collapsable={false}>
      {flights.map((flight) => (
        <FlyingGood key={flight.id} flight={flight} onLanded={finish} />
      ))}
    </View>
  );
}

function FlyingGood({ flight, onLanded }: { flight: Flight; onLanded: (flight: Flight) => void }) {
  const t = useSharedValue(0);
  const { from, to } = flight;

  useEffect(() => {
    t.value = withDelay(
      flight.delay,
      withTiming(1, { duration: FLIGHT_MS, easing: Easing.in(Easing.quad) }, () => {
        scheduleOnRN(onLanded, flight);
      }),
    );
    // Start once: the flight's path is fixed when it is created.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => {
    const p = t.value;
    // A small hop up first, then down into the pantry.
    const hop = Math.sin(p * Math.PI) * 28;
    return {
      opacity: p === 0 ? 0 : 1,
      transform: [
        { translateX: interpolate(p, [0, 1], [from.x, to.x]) - ICON / 2 },
        { translateY: interpolate(p, [0, 1], [from.y, to.y]) - ICON / 2 - hop },
        { scale: interpolate(p, [0, 0.15, 1], [0.6, 1.1, 0.55]) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.flying, style]}>
      <GoodIcon good={flight.good} size={ICON} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flying: { position: 'absolute', left: 0, top: 0, width: ICON, height: ICON },
});
