/**
 * Draws the walking customers and keeps the crowd moving. React only hears
 * about a customer appearing, leaving or being tipped; where each one is in
 * between is worked out on the UI thread from a shared clock.
 */
import { Group, RoundedRect } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { type SharedValue, useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';

import { customerArt, ui } from '../art';
import { colors } from '../ui/theme';
import {
  type Crowd,
  type Customer,
  CUSTOMER_BASE_Y,
  customerAt,
  customerPose,
  emptyCrowd,
  markTipped,
  stepCrowd,
} from './crowd';
import { Sprite } from './sprites';

const TICK_MS = 400;
const COIN = 20;

function newCrowd(): Crowd {
  const now = Date.now();
  return emptyCrowd(now, now);
}

/**
 * The crowd on the street. `openLots` are the lots with an open shop; with
 * none, or with motion reduced, the street stays empty. `tipAt` takes a tap
 * in street coordinates and says whether it landed on a customer.
 */
export function useCrowd(openLots: number[], streetWidth: number, still: boolean) {
  const [crowd, setCrowd] = useState(newCrowd);
  const lotsKey = openLots.join(',');

  useEffect(() => {
    if (still) return;
    const lots = lotsKey === '' ? [] : lotsKey.split(',').map(Number);
    const id = setInterval(() => setCrowd((c) => stepCrowd(c, Date.now(), lots, streetWidth)), TICK_MS);
    return () => clearInterval(id);
  }, [still, lotsKey, streetWidth]);

  const customers = still ? [] : crowd.customers;

  // One clock for every customer, ticking only while someone is on the street.
  const clock = useSharedValue(0);
  const frame = useFrameCallback(() => {
    clock.value = Date.now();
  }, false);
  const busy = customers.length > 0;
  useEffect(() => {
    frame.setActive(busy);
  }, [busy, frame]);

  /** Returns the customer tapped, after marking them as tipped, or null. */
  const tipAt = (x: number, y: number): Customer | null => {
    if (still) return null;
    const now = Date.now();
    const hit = customerAt(crowd, x, y, now);
    if (hit) setCrowd((c) => markTipped(c, hit.id, now));
    return hit;
  };

  return { customers, clock, tipAt };
}

/** Every customer, drawn in street coordinates in front of the shops. */
export function Customers({ customers, clock }: { customers: Customer[]; clock: SharedValue<number> }) {
  return (
    <>
      {customers.map((customer) => (
        <CustomerSprite key={customer.id} customer={customer} clock={clock} />
      ))}
    </>
  );
}

function CustomerSprite({ customer, clock }: { customer: Customer; clock: SharedValue<number> }) {
  const stand = customerArt(customer.look, 'stand');
  const step = customerArt(customer.look, 'step');

  const transform = useDerivedValue(() => {
    const pose = customerPose(customer, clock.value);
    return [{ translateX: pose.x }, { translateY: CUSTOMER_BASE_Y - pose.lift }, { scaleX: pose.facing }];
  });
  const standOpacity = useDerivedValue(() => {
    const pose = customerPose(customer, clock.value);
    return pose.visible && !pose.stepping ? 1 : 0;
  });
  const stepOpacity = useDerivedValue(() => {
    const pose = customerPose(customer, clock.value);
    return pose.visible && pose.stepping ? 1 : 0;
  });
  const bagOpacity = useDerivedValue(() => {
    const pose = customerPose(customer, clock.value);
    return pose.visible && pose.bag ? 1 : 0;
  });
  // The tip floats straight up from the customer and fades. It is not mirrored with them.
  const tipTransform = useDerivedValue(() => {
    const pose = customerPose(customer, clock.value);
    return [{ translateX: pose.x }, { translateY: CUSTOMER_BASE_Y - 66 - 26 * Math.max(0, pose.tip) }];
  });
  const tipOpacity = useDerivedValue(() => {
    const { tip } = customerPose(customer, clock.value);
    return tip < 0 ? 0 : 1 - tip * tip;
  });

  if (!stand || !step) return null;
  return (
    <>
      <Group transform={transform}>
        <Group opacity={standOpacity}>
          <Sprite art={stand} cx={0} baseY={0} />
        </Group>
        <Group opacity={stepOpacity}>
          <Sprite art={step} cx={0} baseY={0} />
        </Group>
        {/* The shopping they leave with: a small paper bag carried in front. */}
        <Group opacity={bagOpacity}>
          <RoundedRect x={8} y={-27} width={13} height={15} r={2.5} color={colors.secondary} />
          <RoundedRect
            x={8}
            y={-27}
            width={13}
            height={15}
            r={2.5}
            color={colors.secondaryEdge}
            style="stroke"
            strokeWidth={1.5}
          />
          <RoundedRect
            x={11.5}
            y={-32}
            width={6}
            height={7}
            r={3}
            color={colors.secondaryEdge}
            style="stroke"
            strokeWidth={1.5}
          />
        </Group>
      </Group>
      {customer.tippedAt !== null && (
        <Group transform={tipTransform} opacity={tipOpacity}>
          <Sprite art={ui.ui_coin} cx={0} baseY={0} scale={COIN / ui.ui_coin.h} />
        </Group>
      )}
    </>
  );
}
