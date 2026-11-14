/**
 * The maths behind the street's animations, kept apart from the drawing so it
 * can be tested. Every function here is a worklet: it runs on the UI thread
 * each frame, so it uses plain numbers only.
 *
 * Ambient loops are driven by a phase that runs from 0 to 1 and repeats, so
 * each function gives the same result at phase 0 and phase 1.
 */
import { LOT_WIDTH } from './layout';

/** How long one ambient loop lasts. The PRD asks for 3 seconds or less. */
export const AMBIENT_LOOP_MS = 3000;
/** How long a build, an upgrade or a restoration plays. The PRD asks for 1 to 2 seconds. */
export const BUILD_MS = 1400;

/** Smoke rises a little past the top of the lot, so a lot counts as on screen until that has gone too. */
const VISIBLE_MARGIN = 24;
const SIGN_SWING = 0.07;
const STALL_SWAY = 0.012;
const SMOKE_RISE = 46;

const TURN = Math.PI * 2;

function fract(value: number): number {
  'worklet';
  return value - Math.floor(value);
}

function clamp01(value: number): number {
  'worklet';
  return Math.min(1, Math.max(0, value));
}

/** Whether any part of the lot starting at `x` is inside the visible part of the street. */
export function lotVisible(x: number, scrollX: number, viewWidth: number): boolean {
  'worklet';
  return x + LOT_WIDTH + VISIBLE_MARGIN > scrollX && x - VISIBLE_MARGIN < scrollX + viewWidth;
}

/** The angle of a hanging sign, in radians. `offset` keeps neighbouring shops out of step. */
export function signAngle(phase: number, offset: number): number {
  'worklet';
  return SIGN_SWING * Math.sin(TURN * (phase + offset));
}

/** The lean of a market stall swaying about its base, in radians. */
export function swayAngle(phase: number, offset: number): number {
  'worklet';
  return STALL_SWAY * Math.sin(TURN * (phase + offset));
}

export type Puff = { dx: number; dy: number; r: number; opacity: number };

/**
 * One puff of chimney smoke out of `count`, relative to the chimney top. Each
 * puff is born clear, thickens, drifts up and to the side, and fades out
 * before it starts again, so the loop has no visible seam.
 */
export function smokePuff(phase: number, index: number, count: number, offset: number): Puff {
  'worklet';
  const life = fract(phase + offset + index / count);
  return {
    dx: 10 * life + 3 * Math.sin(TURN * life),
    dy: -SMOKE_RISE * life,
    r: 4 + 8 * life,
    opacity: 0.6 * Math.sin(Math.PI * life),
  };
}

function easeOutBack(t: number): number {
  'worklet';
  const c = 1.9;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}

export type BuildPose = {
  /** The art being replaced: it sinks a little and fades. */
  oldOpacity: number;
  oldScaleY: number;
  /** The new art: it grows from the ground and settles with a small overshoot. */
  newOpacity: number;
  newScaleX: number;
  newScaleY: number;
  /** The dust kicked up at the base: how far it has spread (0 to 1) and how thick it is. */
  dustSpread: number;
  dustOpacity: number;
};

/** Where everything is at `progress` (0 to 1) through a build. At 1 the new art stands alone, exactly in place. */
export function buildPose(progress: number): BuildPose {
  'worklet';
  const p = clamp01(progress);
  const fall = clamp01(p / 0.3);
  const rise = clamp01((p - 0.2) / 0.6);
  const grown = easeOutBack(rise);
  const dust = clamp01(p / 0.9);
  return {
    oldOpacity: 1 - fall,
    oldScaleY: 1 - 0.12 * fall,
    newOpacity: clamp01((p - 0.2) / 0.12),
    newScaleX: 1 + 0.08 * (1 - rise),
    newScaleY: rise >= 1 ? 1 : grown,
    dustSpread: 1 - (1 - dust) * (1 - dust),
    dustOpacity: dust >= 1 ? 0 : 0.7 * Math.sin(Math.PI * dust),
  };
}
