/**
 * The balance report: plays the game with the simulated average player and
 * prints when each unlock is reached, next to the pacing targets from the
 * PRD. Run with `npm run simulate`. Pass a number to change how many runs
 * the typical result is taken from: `npm run simulate -- 21`.
 */
import { content } from '../src/content';
import { checkPacing, medianMilestones, PACING_TARGETS } from '../src/sim/pacing';
import { simulate } from '../src/sim/simulate';

const runs = Math.max(1, Number(process.argv[2] ?? 9));
const results = Array.from({ length: runs }, (_, i) => simulate(content, { days: 45, seed: i + 1 }));
const typical = medianMilestones(results);

console.log(`Typical run out of ${runs} (median of each milestone)\n`);
console.log('  day  play min    coins  what');
for (const m of typical) {
  const what =
    m.kind === 'level'
      ? `Level ${m.id}`
      : m.kind === 'shop'
        ? `${content.shops[m.id].name} opens`
        : `${content.landmarks[m.id].name} restored`;
  console.log(
    `  ${String(m.day).padStart(3)}  ${m.playMinutes.toFixed(1).padStart(8)}  ${String(m.coins).padStart(7)}  ${what}`,
  );
}

console.log('\nPacing targets');
const rows = checkPacing(typical, PACING_TARGETS);
for (const row of rows)
  console.log(`  ${row.ok ? 'ok  ' : 'MISS'}  ${row.label}: ${row.actual} (target ${row.target})`);
process.exitCode = rows.every((row) => row.ok) ? 0 : 1;
