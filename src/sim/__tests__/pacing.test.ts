import { describe, expect, it } from 'vitest';

import { content } from '../../content';
import { testContent } from '../../core/__tests__/fixtures';
import { checkPacing, medianMilestones, PACING_TARGETS } from '../pacing';
import { type Milestone, simulate, type SimResult } from '../simulate';

const at = (kind: Milestone['kind'], id: string, day: number, playMinutes: number): Milestone => ({
  kind,
  id,
  day,
  playMinutes,
  coins: 0,
});
const run = (...milestones: Milestone[]) => ({ milestones }) as SimResult;

describe('simulator', () => {
  it('is repeatable for a seed', () => {
    const a = simulate(testContent, { days: 2, seed: 4 });
    const b = simulate(testContent, { days: 2, seed: 4 });
    expect(a.milestones).toEqual(b.milestones);
    expect(a.state).toEqual(b.state);
  });

  it('plays the small test game to the end: every shop bought, every landmark restored', () => {
    const { milestones, state } = simulate(testContent, { days: 3, seed: 1, stopAtTopLevel: false });
    expect(state.level).toBe(3);
    expect(Object.keys(state.shops).sort()).toEqual(['bakery', 'dairy']);
    expect(
      milestones
        .filter((m) => m.kind === 'landmark')
        .map((m) => m.id)
        .sort(),
    ).toEqual(['bandstand', 'clocktower', 'fountain']);
    expect(milestones.map((m) => m.playMinutes)).toEqual(
      [...milestones.map((m) => m.playMinutes)].sort((x, y) => x - y),
    );
  });

  it('only plays during sessions', () => {
    const { samples } = simulate(testContent, {
      days: 2,
      plan: () => [{ atHour: 10, minutes: 1 }],
      stopAtTopLevel: false,
    });
    expect(samples.map((s) => [s.day, s.atHour])).toEqual([
      [1, 10],
      [2, 10],
    ]);
  });
});

describe('pacing check', () => {
  it('takes the median run and counts a milestone never reached as late', () => {
    const typical = medianMilestones([
      run(at('shop', 'dairy', 1, 8), at('shop', 'cafe', 6, 200)),
      run(at('shop', 'dairy', 1, 12)),
      run(at('shop', 'dairy', 2, 50)),
    ]);
    expect(typical).toEqual([at('shop', 'dairy', 1, 12)]);
  });

  it('allows 20% on play time and a range on days', () => {
    const rows = checkPacing(
      [at('shop', 'dairy', 1, 12), at('shop', 'flowers', 1, 35), at('shop', 'cafe', 8, 300)],
      PACING_TARGETS,
    );
    expect(rows.map((r) => [r.label, r.ok])).toEqual([
      ['Dairy opens', true],
      ['Flower stall opens', false],
      ['Fountain restored', false],
      ['Preserves shop opens', false],
      ['Café opens', false],
      ['Level 25', false],
    ]);
  });
});

describe('the bundled content', () => {
  it('meets every pacing target for the typical player', () => {
    const results = Array.from({ length: 9 }, (_, i) => simulate(content, { days: 40, seed: i + 1 }));
    const rows = checkPacing(medianMilestones(results), PACING_TARGETS);
    expect(rows.filter((r) => !r.ok)).toEqual([]);
  });

  it('can be played from level 1 to 25 with every shop opened and every landmark restored', () => {
    const { state, milestones } = simulate(content, { days: 60, seed: 3, stopAtTopLevel: false });
    expect(state.level).toBe(25);
    expect(Object.keys(state.shops).sort()).toEqual(Object.keys(content.shops).sort());
    expect(milestones.filter((m) => m.kind === 'landmark')).toHaveLength(3);
  });
});
