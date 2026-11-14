import type { Milestone, SimResult } from './simulate';

/**
 * The pacing targets from the PRD, for an average player. A target in play
 * minutes passes within 20% either way; a target in days passes inside its
 * range of days.
 */
export type PacingTarget = {
  label: string;
  kind: Milestone['kind'];
  id: string;
} & ({ maxPlayMinutes: number } | { playMinutes: number } | { days: [number, number] });

export const PACING_TARGETS: PacingTarget[] = [
  { label: 'Dairy opens', kind: 'shop', id: 'dairy', maxPlayMinutes: 10 },
  { label: 'Flower stall opens', kind: 'shop', id: 'flowers', playMinutes: 45 },
  { label: 'Fountain restored', kind: 'landmark', id: 'fountain', days: [2, 2] },
  { label: 'Preserves shop opens', kind: 'shop', id: 'preserves', days: [3, 3] },
  { label: 'Café opens', kind: 'shop', id: 'cafe', days: [6, 7] },
  { label: 'Level 25', kind: 'level', id: '25', days: [21, 30] },
];

const TOLERANCE = 0.2;

export type PacingRow = { label: string; target: string; actual: string; ok: boolean };

/**
 * The typical run out of several: for each milestone, the median day and
 * median play time across the runs. Orders are random, so one run alone can
 * be lucky or unlucky. A milestone some run never reached counts as late.
 */
export function medianMilestones(results: SimResult[]): Milestone[] {
  const keys = new Map<string, Milestone[]>();
  for (const result of results) {
    for (const m of result.milestones) {
      const key = `${m.kind}:${m.id}`;
      keys.set(key, [...(keys.get(key) ?? []), m]);
    }
  }
  const middle = (values: number[]) => {
    const sorted = [...values, ...Array(results.length - values.length).fill(Infinity)].sort((a, b) => a - b);
    const upper = Math.floor(sorted.length / 2);
    // With an even number of runs, the mean of the two central values. One of them missing keeps it Infinity.
    return sorted.length % 2 ? sorted[upper] : (sorted[upper - 1] + sorted[upper]) / 2;
  };
  const out: Milestone[] = [];
  for (const hits of keys.values()) {
    const day = Math.ceil(middle(hits.map((m) => m.day)));
    if (!Number.isFinite(day)) continue;
    out.push({
      kind: hits[0].kind,
      id: hits[0].id,
      day,
      playMinutes: Math.round(middle(hits.map((m) => m.playMinutes)) * 10) / 10,
      coins: Math.round(middle(hits.map((m) => m.coins))),
    });
  }
  return out.sort((a, b) => a.playMinutes - b.playMinutes);
}

export function checkPacing(milestones: Milestone[], targets: PacingTarget[]): PacingRow[] {
  return targets.map((target) => {
    const hit = milestones.find((m) => m.kind === target.kind && m.id === target.id);
    if ('days' in target) {
      const [from, to] = target.days;
      return {
        label: target.label,
        target: from === to ? `day ${from}` : `day ${from} to ${to}`,
        actual: hit ? `day ${hit.day}` : 'never',
        ok: !!hit && hit.day >= from && hit.day <= to,
      };
    }
    const actual = hit ? `${hit.playMinutes} min of play` : 'never';
    if ('maxPlayMinutes' in target) {
      return {
        label: target.label,
        target: `within ${target.maxPlayMinutes} min of play`,
        actual,
        ok: !!hit && hit.playMinutes <= target.maxPlayMinutes * (1 + TOLERANCE),
      };
    }
    const low = target.playMinutes * (1 - TOLERANCE);
    const high = target.playMinutes * (1 + TOLERANCE);
    return {
      label: target.label,
      target: `about ${target.playMinutes} min of play`,
      actual,
      ok: !!hit && hit.playMinutes >= low && hit.playMinutes <= high,
    };
  });
}
