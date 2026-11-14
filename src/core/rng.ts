/**
 * A small seeded random number generator (mulberry32). Its state is one
 * 32-bit number kept in the save, so the same save always makes the same
 * orders, which keeps the core pure and lets tests and the simulator replay.
 */
export function nextRandom(seed: number): { value: number; seed: number } {
  const next = (seed + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: next };
}

/** Picks an index with odds in proportion to `weights`, given `roll` in [0, 1). */
export function pickWeighted(weights: number[], roll: number): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let left = roll * total;
  for (let i = 0; i < weights.length; i++) {
    if (weights[i] <= 0) continue;
    left -= weights[i];
    if (left < 0) return i;
  }
  // Rounding can leave a sliver; fall back to the last weighted entry.
  for (let i = weights.length - 1; i >= 0; i--) if (weights[i] > 0) return i;
  return 0;
}
