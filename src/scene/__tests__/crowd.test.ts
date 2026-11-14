import { describe, expect, it } from 'vitest';

import {
  type Crowd,
  CUSTOMER_BASE_Y,
  customerAt,
  customerPose,
  emptyCrowd,
  markTipped,
  MAX_CUSTOMERS,
  QUEUE_SLOTS,
  queueX,
  stepCrowd,
} from '../crowd';
import { streetWidth } from '../layout';

const WIDTH = streetWidth(8);
const T0 = 1_000_000;

/** Runs the crowd for `ms`, a quarter of a second at a time. */
function run(crowd: Crowd, from: number, ms: number, openLots: number[], each?: (c: Crowd, t: number) => void): Crowd {
  let c = crowd;
  for (let t = from; t <= from + ms; t += 250) {
    c = stepCrowd(c, t, openLots, WIDTH);
    each?.(c, t);
  }
  return c;
}

describe('walking customers', () => {
  it('do not appear while no shop is open', () => {
    expect(run(emptyCrowd(T0, 1), T0, 60_000, []).customers).toEqual([]);
  });

  it('appear one at a time and never more than 6 at once', () => {
    let most = 0;
    const end = run(emptyCrowd(T0, 3), T0, 10 * 60_000, [0, 1, 3, 4, 6], (c) => {
      most = Math.max(most, c.customers.length);
    });
    expect(most).toBeGreaterThan(2);
    expect(most).toBeLessThanOrEqual(MAX_CUSTOMERS);
    expect(end.nextId).toBeGreaterThan(20);
  });

  it('queue at one shop, a place apart, are served front first, and move up as the line shortens', () => {
    let longest = 0;
    run(emptyCrowd(T0, 5), T0, 5 * 60_000, [2], (c, t) => {
      const inLine = c.customers.filter((x) => x.leaveAt > t);
      longest = Math.max(longest, inLine.length);
      expect(inLine.length).toBeLessThanOrEqual(QUEUE_SLOTS);
      // Joined later means served later.
      for (let i = 1; i < inLine.length; i++) expect(inLine[i].leaveAt).toBeGreaterThan(inLine[i - 1].leaveAt);
      // Those standing in the line never overlap.
      const standing = inLine.filter((x) => x.arriveAt <= t).map((x) => customerPose(x, t).x);
      for (let i = 1; i < standing.length; i++) expect(standing[i] - standing[i - 1]).toBeGreaterThan(29);
      // Everyone is at the front of the line by the time they are served.
      for (const x of inLine) expect(customerPose(x, x.leaveAt - 1).x).toBeCloseTo(queueX(2, 0), 5);
    });
    expect(longest).toBeGreaterThan(1);
  });

  it('walk in from an edge, stand in line, then walk off with a bag', () => {
    const crowd = run(emptyCrowd(T0, 9), T0, 3000, [1]);
    const c = crowd.customers[0];
    expect(c).toBeDefined();
    expect([-40, WIDTH + 40]).toContain(c.fromX);
    expect(c.standX).toBe(queueX(1, c.slot));
    expect(c.startAt).toBeLessThan(c.arriveAt);
    expect(c.arriveAt).toBeLessThan(c.leaveAt);
    expect(c.leaveAt).toBeLessThan(c.goneAt);

    expect(customerPose(c, c.startAt - 1).visible).toBe(false);
    const start = customerPose(c, c.startAt);
    expect(start).toMatchObject({ x: c.fromX, bag: false, visible: true });
    expect(start.facing).toBe(c.standX > c.fromX ? 1 : -1);
    expect(c.slot).toBe(0);
    const halfway = customerPose(c, (c.startAt + c.arriveAt) / 2);
    expect(halfway.x).toBeCloseTo((c.fromX + c.standX) / 2, 5);
    expect(customerPose(c, c.arriveAt)).toMatchObject({ x: c.standX, lift: 0, stepping: false, bag: false });
    const leaving = customerPose(c, (c.leaveAt + c.goneAt) / 2);
    expect(leaving).toMatchObject({ bag: true, visible: true });
    expect(leaving.x).toBeCloseTo((c.standX + c.toX) / 2, 5);
    expect(customerPose(c, c.goneAt).visible).toBe(false);
  });

  it('alternate between the two drawings while walking', () => {
    const c = run(emptyCrowd(T0, 9), T0, 3000, [1]).customers[0];
    const frames = new Set<boolean>();
    for (let t = c.startAt; t < c.startAt + 1200; t += 50) frames.add(customerPose(c, t).stepping);
    expect(frames.size).toBe(2);
  });

  it('are forgotten once they have walked off', () => {
    const crowd = run(emptyCrowd(T0, 9), T0, 3000, [1]);
    const c = crowd.customers[0];
    const later = stepCrowd({ ...crowd, nextSpawnAt: Infinity }, c.goneAt + 1, [1], WIDTH);
    expect(later.customers.find((x) => x.id === c.id)).toBeUndefined();
  });

  it('can be tapped for a tip once each', () => {
    const crowd = { ...run(emptyCrowd(T0, 9), T0, 3000, [1]), nextSpawnAt: Infinity };
    const c = crowd.customers[0];
    const now = c.arriveAt + 100;
    expect(customerAt(crowd, c.standX + 10, CUSTOMER_BASE_Y - 30, now)?.id).toBe(c.id);
    expect(customerAt(crowd, c.standX + 60, CUSTOMER_BASE_Y - 30, now)).toBeNull();
    expect(customerAt(crowd, c.standX, CUSTOMER_BASE_Y - 120, now)).toBeNull();
    expect(customerAt(crowd, c.fromX, CUSTOMER_BASE_Y - 30, c.startAt - 500)).toBeNull();

    const tipped = markTipped(crowd, c.id, now);
    expect(customerAt(tipped, c.standX, CUSTOMER_BASE_Y - 30, now + 10)).toBeNull();
    expect(markTipped(tipped, c.id, now + 10)).toBe(tipped);
    const pose = customerPose(tipped.customers[0], now + 350);
    expect(pose.tip).toBeCloseTo(0.5, 5);
    expect(customerPose(tipped.customers[0], now + 5000).tip).toBe(-1);
  });

  it('plan the same street from the same seed', () => {
    const a = run(emptyCrowd(T0, 42), T0, 120_000, [0, 1]);
    const b = run(emptyCrowd(T0, 42), T0, 120_000, [0, 1]);
    expect(a).toEqual(b);
  });
});
