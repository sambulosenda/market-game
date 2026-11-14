import { beforeEach, describe, expect, it } from 'vitest';

import { testContent } from '../../core/__tests__/fixtures';
import { levelUpLines } from '../levelUp';
import { failText, strings } from '../strings';
import { closeSheet, dismissLevelUp, openSheet, queueLevelUp, toast, uiStore } from '../uiStore';

const none = { shops: [], recipes: [], landmarks: [] };

describe('level-up lines', () => {
  it('lists exactly what the level unlocked', () => {
    const lines = levelUpLines({ level: 2, gems: 3, unlocks: testContent.levels[1].unlocks }, testContent);
    expect(lines).toEqual([
      { key: 'gems', text: '3 gems' },
      { key: 'shop:dairy', text: 'New shop: Dairy' },
      { key: 'recipe:butter', text: 'New recipe: Butter' },
      { key: 'landmark:fountain', text: 'New landmark: Fountain' },
    ]);
  });

  it('mentions a new order slot, and leaves out a shop the player already has', () => {
    const lines = levelUpLines({ level: 3, gems: 0, unlocks: { ...none, shops: ['bakery'] } }, testContent);
    expect(lines).toEqual([{ key: 'slot', text: 'One more order slot' }]);
  });

  it('is empty when a level brings nothing', () => {
    expect(levelUpLines({ level: 2, gems: 0, unlocks: none }, testContent)).toEqual([]);
  });
});

describe('strings', () => {
  it('formats durations and countdowns', () => {
    expect(strings.duration(30)).toBe('30s');
    expect(strings.duration(27)).toBe('27s');
    expect(strings.duration(120)).toBe('2m');
    expect(strings.duration(150)).toBe('2m 30s');
    expect(strings.duration(3600)).toBe('1h');
    expect(strings.duration(4 * 3600 - 600)).toBe('3h 50m');
    expect(strings.remaining(61_000)).toBe('1:01');
    expect(strings.remaining(-5)).toBe('0:00');
    expect(strings.remaining(3_725_000)).toBe('1:02:05');
  });

  it('groups thousands and explains refusals', () => {
    expect(strings.number(950)).toBe('950');
    expect(strings.number(12500)).toBe('12,500');
    expect(failText('pantry_full')).toMatch(/pantry is full/);
    expect(failText('unknown_shop')).toBe(strings.failOther);
  });
});

describe('ui store', () => {
  beforeEach(() => uiStore.setState({ sheet: null, levelUps: [], toasts: [] }));

  it('opens one sheet at a time', () => {
    openSheet({ kind: 'shop', id: 'bakery' });
    openSheet({ kind: 'pantry' });
    expect(uiStore.getState().sheet).toEqual({ kind: 'pantry' });
    closeSheet();
    expect(uiStore.getState().sheet).toBeNull();
  });

  it('shows level-ups one at a time, oldest first', () => {
    queueLevelUp({ level: 2, gems: 3, unlocks: none });
    queueLevelUp({ level: 3, gems: 5, unlocks: none });
    expect(uiStore.getState().levelUps[0].level).toBe(2);
    dismissLevelUp();
    expect(uiStore.getState().levelUps.map((l) => l.level)).toEqual([3]);
  });

  it('shows a toast, removes it later, and does not repeat one already showing', () => {
    const timers: (() => void)[] = [];
    const schedule = (fn: () => void) => void timers.push(fn);
    toast('Full', schedule);
    toast('Full', schedule);
    toast('No coins', schedule);
    expect(uiStore.getState().toasts.map((t) => t.text)).toEqual(['Full', 'No coins']);
    toast('Third', schedule);
    expect(uiStore.getState().toasts.map((t) => t.text)).toEqual(['No coins', 'Third']);
    timers.forEach((fn) => fn());
    expect(uiStore.getState().toasts).toEqual([]);
  });
});
