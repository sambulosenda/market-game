import { describe, expect, it } from 'vitest';

import { createInitialState, startBatch } from '../../core';
import { HOUR, T0, testContent } from '../../core/__tests__/fixtures';
import { createNotifier } from '../notifier';

const text = {
  goods_ready: { title: 'Ready', body: 'Your goods are ready.' },
  daily_goals: { title: 'Goals', body: 'New goals.' },
};

function setup({ enabled = true, allowed = true, answer = true } = {}) {
  const scheduled: { title: string; at: number }[] = [];
  const calls: string[] = [];
  const state = { enabled, allowed };
  const notifier = createNotifier({
    content: testContent,
    enabled: () => state.enabled,
    text,
    timezoneOffsetMin: () => 0,
    system: {
      allowed: async () => state.allowed,
      ask: async () => {
        calls.push('ask');
        state.allowed = answer;
        return answer;
      },
      schedule: async (t, at) => void scheduled.push({ title: t.title, at }),
      cancelAll: async () => {
        calls.push('cancel');
        scheduled.length = 0;
      },
    },
  });
  return { notifier, scheduled, calls, state };
}

function baking() {
  const started = startBatch(createInitialState(testContent, T0), testContent, 'bakery', 'loaf', T0);
  if (!started.ok) throw new Error(started.reason);
  return started.state;
}

describe('notifier', () => {
  it('schedules the plan when the player leaves, replacing what was there', async () => {
    const t = setup();
    expect(await t.notifier.scheduleForAbsence(baking(), T0)).toBe(2);
    expect(await t.notifier.scheduleForAbsence(baking(), T0)).toBe(2);
    expect(t.scheduled.map((n) => n.title)).toEqual(['Ready', 'Goals']);
    expect(t.scheduled.every((n) => n.at > T0)).toBe(true);
  });

  it('schedules nothing while the setting is off, and clears what was scheduled before', async () => {
    const t = setup();
    await t.notifier.scheduleForAbsence(baking(), T0);
    t.state.enabled = false;
    expect(await t.notifier.scheduleForAbsence(baking(), T0 + HOUR)).toBe(0);
    expect(t.scheduled).toEqual([]);
  });

  it('schedules nothing without permission, and never asks on its own', async () => {
    const t = setup({ allowed: false });
    expect(await t.notifier.scheduleForAbsence(baking(), T0)).toBe(0);
    expect(t.scheduled).toEqual([]);
    expect(t.calls).not.toContain('ask');
  });

  it('clears everything when the player comes back', async () => {
    const t = setup();
    void t.notifier.scheduleForAbsence(baking(), T0);
    await t.notifier.clear();
    expect(t.scheduled).toEqual([]);
  });

  it('asks for permission only when it is not already given', async () => {
    const granted = setup();
    expect(await granted.notifier.requestPermission()).toBe(true);
    expect(granted.calls).not.toContain('ask');
    const refused = setup({ allowed: false, answer: false });
    expect(await refused.notifier.requestPermission()).toBe(false);
    expect(refused.calls).toContain('ask');
  });

  it('survives a system that fails', async () => {
    const notifier = createNotifier({
      content: testContent,
      enabled: () => true,
      text,
      system: {
        allowed: async () => true,
        ask: async () => true,
        schedule: async () => Promise.reject(new Error('no')),
        cancelAll: async () => Promise.reject(new Error('no')),
      },
    });
    expect(await notifier.scheduleForAbsence(baking(), T0)).toBe(0);
    await expect(notifier.clear()).resolves.toBeUndefined();
  });
});
