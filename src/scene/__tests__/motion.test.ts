import { describe, expect, it } from 'vitest';

import { LOT_WIDTH, lotX } from '../layout';
import { AMBIENT_LOOP_MS, BUILD_MS, buildPose, lotVisible, signAngle, smokePuff, swayAngle } from '../motion';

describe('ambient loops', () => {
  it('last 3 seconds or less', () => {
    expect(AMBIENT_LOOP_MS).toBeLessThanOrEqual(3000);
  });

  it('end where they began, so the loop has no jump', () => {
    for (const offset of [0, 0.37, 0.74]) {
      expect(signAngle(1, offset)).toBeCloseTo(signAngle(0, offset), 10);
      expect(swayAngle(1, offset)).toBeCloseTo(swayAngle(0, offset), 10);
      for (let i = 0; i < 3; i++) {
        const [a, b] = [smokePuff(0, i, 3, offset), smokePuff(1, i, 3, offset)];
        expect(b.dy).toBeCloseTo(a.dy, 10);
        expect(b.opacity).toBeCloseTo(a.opacity, 10);
      }
    }
  });

  it('keep the motion gentle', () => {
    for (let phase = 0; phase <= 1; phase += 0.05) {
      expect(Math.abs(signAngle(phase, 0))).toBeLessThan(0.1);
      expect(Math.abs(swayAngle(phase, 0))).toBeLessThan(0.02);
    }
  });

  it('fade each puff of smoke in and out as it rises', () => {
    const born = smokePuff(0, 0, 3, 0);
    const middle = smokePuff(0.5, 0, 3, 0);
    const old = smokePuff(0.999, 0, 3, 0);
    expect(born.opacity).toBe(0);
    expect(middle.opacity).toBeGreaterThan(0.5);
    expect(old.opacity).toBeLessThan(0.01);
    expect(old.dy).toBeLessThan(middle.dy);
    expect(middle.dy).toBeLessThan(born.dy);
  });

  it('only run for lots on screen', () => {
    const width = 400;
    expect(lotVisible(lotX(0), 0, width)).toBe(true);
    expect(lotVisible(lotX(1), 0, width)).toBe(true);
    expect(lotVisible(lotX(3), 0, width)).toBe(false);
    // Scrolled until lot 0 has just left on the left.
    expect(lotVisible(lotX(0), lotX(0) + LOT_WIDTH + 30, width)).toBe(false);
    expect(lotVisible(lotX(3), lotX(3) - width + 1, width)).toBe(true);
  });
});

describe('build animation', () => {
  it('lasts 1 to 2 seconds', () => {
    expect(BUILD_MS).toBeGreaterThanOrEqual(1000);
    expect(BUILD_MS).toBeLessThanOrEqual(2000);
  });

  it('starts with only the old art', () => {
    expect(buildPose(0)).toMatchObject({ oldOpacity: 1, oldScaleY: 1, newOpacity: 0, dustOpacity: 0 });
  });

  it('ends with the new art alone and exactly in place', () => {
    expect(buildPose(1)).toEqual({
      oldOpacity: 0,
      oldScaleY: 0.88,
      newOpacity: 1,
      newScaleX: 1,
      newScaleY: 1,
      dustSpread: 1,
      dustOpacity: 0,
    });
    expect(buildPose(7)).toEqual(buildPose(1));
  });

  it('grows the new art with a small overshoot, and never shows both at full strength', () => {
    let peak = 0;
    for (let p = 0; p <= 1; p += 0.01) {
      const pose = buildPose(p);
      peak = Math.max(peak, pose.newScaleY);
      expect(pose.oldOpacity + pose.newOpacity).toBeLessThanOrEqual(1.35);
    }
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThan(1.15);
  });
});
