/**
 * Walking customers. They are decoration with one small reward: a customer
 * walks in from an edge of the street, queues at an open shop, leaves with a
 * bag, and gives a coin tip if tapped on the way.
 *
 * Each customer's whole visit is planned when they appear, so where they are
 * is a pure function of the time. Nothing here is saved: the street simply
 * fills up again when the game is opened.
 */
import { LOT_WIDTH, lotX, SHOP_BASE_Y } from './layout';

export const MAX_CUSTOMERS = 6;
/** How many can stand in line at one shop. */
export const QUEUE_SLOTS = 3;
export const CUSTOMER_LOOKS = 8;
/** Where a customer's feet are: on the pavement, in front of the shops. */
export const CUSTOMER_BASE_Y = SHOP_BASE_Y + 40;

const WALK_SPEED = 42; // points a second
const STEP_MS = 260;
const EDGE = 40;
const QUEUE_GAP = 30;
const SPAWN_MS: [number, number] = [5000, 11000];
const WAIT_MS: [number, number] = [2500, 5000];
const SHUFFLE_MS = 450;
const TIP_FLOAT_MS = 700;
const HIT_HALF_WIDTH = 22;
const HIT_HEIGHT = 66;

export type Customer = {
  id: number;
  /** Which of the painted characters, 1 to 8. */
  look: number;
  lot: number;
  /** Place in the shop's line when they join it, 0 at the front. */
  slot: number;
  fromX: number;
  /** Where that place is. */
  standX: number;
  toX: number;
  /** When each customer ahead is served, in order. The customer moves up one place each time. */
  advanceAt: number[];
  /** Appears and starts walking. */
  startAt: number;
  /** Reaches the line. */
  arriveAt: number;
  /** Has been served and walks away with a bag. */
  leaveAt: number;
  /** Is off the street and can be forgotten. */
  goneAt: number;
  /** When the player tapped them for a tip, if they did. */
  tippedAt: number | null;
};

export type Crowd = { customers: Customer[]; nextId: number; nextSpawnAt: number; rng: number };

export function emptyCrowd(now: number, seed: number): Crowd {
  return { customers: [], nextId: 1, nextSpawnAt: now + 1500, rng: seed >>> 0 };
}

// The same generator as the game core (mulberry32), kept separate so the scene does not touch the save's seed.
function roll(seed: number): { value: number; seed: number } {
  const next = (seed + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: next };
}

/** The x of a place in a shop's line. The line forms to the right of the middle of the lot. */
export function queueX(lot: number, slot: number): number {
  return lotX(lot) + LOT_WIDTH / 2 - QUEUE_GAP + slot * QUEUE_GAP;
}

/**
 * Moves the crowd on to `now`: forgets customers who have left, and lets a
 * new one appear when it is time, there is room, and a shop has a free place
 * in its line. Returns the same object when nothing changed.
 */
export function stepCrowd(crowd: Crowd, now: number, openLots: number[], streetWidth: number): Crowd {
  const staying = crowd.customers.filter((c) => c.goneAt > now);
  let next = staying.length === crowd.customers.length ? crowd : { ...crowd, customers: staying };
  if (now < next.nextSpawnAt) return next;

  let rng = next.rng;
  const random = () => {
    const r = roll(rng);
    rng = r.seed;
    return r.value;
  };
  const between = ([low, high]: [number, number]) => low + random() * (high - low);
  const nextSpawnAt = now + between(SPAWN_MS);

  // A new customer joins the back of a line that still has room.
  const inLine = (lot: number) => next.customers.filter((c) => c.lot === lot && c.leaveAt > now);
  const lots = openLots.filter((lot) => inLine(lot).length < QUEUE_SLOTS);
  if (next.customers.length >= MAX_CUSTOMERS || lots.length === 0) return { ...next, nextSpawnAt, rng };

  const lot = lots[Math.floor(random() * lots.length)];
  const ahead = inLine(lot);
  const slot = ahead.length;
  const standX = queueX(lot, slot);
  const fromLeft = random() < 0.5;
  const fromX = fromLeft ? -EDGE : streetWidth + EDGE;
  const toX = random() < 0.5 ? -EDGE : streetWidth + EDGE;
  const arriveAt = now + (Math.abs(standX - fromX) / WALK_SPEED) * 1000;
  // Whoever is ahead in the line is served first.
  const advanceAt = ahead.map((c) => c.leaveAt).sort((x, y) => x - y);
  const leaveAt = Math.max(arriveAt, ...advanceAt) + between(WAIT_MS);
  const frontX = queueX(lot, 0);
  const customer: Customer = {
    id: next.nextId,
    look: 1 + Math.floor(random() * CUSTOMER_LOOKS),
    lot,
    slot,
    fromX,
    standX,
    toX,
    advanceAt,
    startAt: now,
    arriveAt,
    leaveAt,
    goneAt: leaveAt + (Math.abs(toX - frontX) / WALK_SPEED) * 1000,
    tippedAt: null,
  };
  next = { customers: [...next.customers, customer], nextId: next.nextId + 1, nextSpawnAt, rng };
  return next;
}

export type CustomerPose = {
  x: number;
  /** A small hop while walking, in points up from the pavement. */
  lift: number;
  /** 1 facing right, -1 facing left. The art faces right. */
  facing: number;
  /** Which of the two drawings to show. */
  stepping: boolean;
  /** Carrying a bag: true once served. */
  bag: boolean;
  /** The tip floating up after a tap: 0 to 1, or -1 when there is none to show. */
  tip: number;
  visible: boolean;
};

/** Where the customer's place in the line is at `now`: one place forward for each customer served ahead of them. */
function placeX(c: Customer, now: number): number {
  'worklet';
  let moved = 0;
  for (let i = 0; i < c.advanceAt.length; i++) moved += Math.min(1, Math.max(0, (now - c.advanceAt[i]) / SHUFFLE_MS));
  return c.standX - QUEUE_GAP * moved;
}

/** Where a customer is and what they are doing at `now`. Runs on the UI thread every frame. */
export function customerPose(c: Customer, now: number): CustomerPose {
  'worklet';
  const tip =
    c.tippedAt !== null && now - c.tippedAt < TIP_FLOAT_MS ? Math.max(0, (now - c.tippedAt) / TIP_FLOAT_MS) : -1;
  if (now < c.startAt || now >= c.goneAt)
    return { x: c.fromX, lift: 0, facing: 1, stepping: false, bag: false, tip: -1, visible: false };
  const walking = now < c.arriveAt || now >= c.leaveAt;
  const stride = Math.floor((now - c.startAt) / STEP_MS) % 2 === 1;
  if (now < c.arriveAt) {
    const p = (now - c.startAt) / (c.arriveAt - c.startAt);
    return {
      x: c.fromX + (placeX(c, c.arriveAt) - c.fromX) * p,
      lift: stride ? 2 : 0,
      facing: c.standX >= c.fromX ? 1 : -1,
      stepping: stride,
      bag: false,
      tip,
      visible: true,
    };
  }
  if (!walking) {
    // In line, facing the front of it, which is to the left.
    return { x: placeX(c, now), lift: 0, facing: -1, stepping: false, bag: false, tip, visible: true };
  }
  const p = (now - c.leaveAt) / (c.goneAt - c.leaveAt);
  const front = placeX(c, c.leaveAt);
  return {
    x: front + (c.toX - front) * p,
    lift: stride ? 2 : 0,
    facing: c.toX >= front ? 1 : -1,
    stepping: stride,
    bag: true,
    tip,
    visible: true,
  };
}

/**
 * The customer under a tap at (x, y) in street coordinates who can still be
 * tipped, if any. The one in front (drawn last) wins.
 */
export function customerAt(crowd: Crowd, x: number, y: number, now: number): Customer | null {
  if (y > CUSTOMER_BASE_Y || y < CUSTOMER_BASE_Y - HIT_HEIGHT) return null;
  for (let i = crowd.customers.length - 1; i >= 0; i--) {
    const c = crowd.customers[i];
    if (c.tippedAt !== null) continue;
    const pose = customerPose(c, now);
    if (pose.visible && Math.abs(pose.x - x) <= HIT_HALF_WIDTH) return c;
  }
  return null;
}

/** Marks a customer as tipped. Each customer tips once. */
export function markTipped(crowd: Crowd, id: number, now: number): Crowd {
  if (!crowd.customers.some((c) => c.id === id && c.tippedAt === null)) return crowd;
  return { ...crowd, customers: crowd.customers.map((c) => (c.id === id ? { ...c, tippedAt: now } : c)) };
}
