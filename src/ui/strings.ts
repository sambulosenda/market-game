/**
 * Every player-facing string lives here, ready for translation later.
 * Good and shop names come from the content config.
 */
export const strings = {
  pantry: 'Pantry',
  pantryEmpty: 'Nothing yet. Bake something!',
  queue: (used: number, size: number) => `Queue ${used}/${size}`,
  bake: 'Bake',
  collect: (n: number) => (n === 1 ? 'Collect 1' : `Collect ${n}`),
  queueFull: 'Queue full',
  ready: 'Ready',
  waiting: 'Up next',
  emptySlot: 'Empty',
  duration: (sec: number) => (sec < 60 ? `${sec}s` : sec % 60 === 0 ? `${sec / 60}m` : `${Math.floor(sec / 60)}m ${sec % 60}s`),
  remaining: (ms: number) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  },
  welcomeBackTitle: 'Welcome back!',
  welcomeBackBody: 'While you were away, your street made:',
  ok: 'Lovely',
  a11y: {
    street: 'The street. Swipe sideways to look around.',
    shopLot: (name: string, ready: number) => (ready > 0 ? `${name}, ${ready} ready to collect` : name),
    emptyLot: 'Empty plot',
    bakeRecipe: (name: string, duration: string) => `Bake ${name}, takes ${duration}`,
  },
};
