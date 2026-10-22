/**
 * Helpers shared by the game/ tests (not imported by the app). Measured
 * numbers are printed with `report` so a run shows what the rules document
 * quotes (docs/OVERTAKE_RULES.md §16, §17).
 */
import type { Course, Row } from './types';

/** FNV-1a, 32-bit, over a string — integer ops only. */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * One row as text: kind, template, gap, then u, length, lead and obstacle
 * edges in units; then, only when the row has zones (so a row without them
 * reads as before, §16), `z` and each zone's kind, left-right and rear-front.
 */
export function rowToString(row: Row): string {
  const obstacles = row.obstacles.map((o) => `${o.kind[0]}${o.left}-${o.right}`).join(',');
  const zones =
    row.zones.length === 0
      ? ''
      : `z${row.zones.map((z) => `${z.kind[0]}${z.left}-${z.right}/${z.rear}-${z.front}`).join(',')}`;
  return `${row.kind}/${row.template}/g${row.gap}/u${row.u}/L${row.length}/D${row.lead}:${obstacles}${zones}`;
}

export function courseDigest(course: Course): string {
  return fnv1a(course.rows.map(rowToString).join('|'));
}

/** Every number reachable in a value (objects, arrays), for the integer-only checks (§1). */
export function collectNumbers(value: unknown, out: number[] = []): number[] {
  if (typeof value === 'number') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectNumbers(v, out);
  } else if (typeof value === 'object' && value !== null) {
    for (const v of Object.values(value)) collectNumbers(v, out);
  }
  return out;
}

/** Prints a measured line into the test output. */
export function report(label: string, ...values: unknown[]): void {
  process.stdout.write(`[overtake] ${label}: ${values.join(' ')}\n`);
}

export const LEVELS = Array.from({ length: 100 }, (_, i) => i + 1);

/**
 * The skill ladder of §6 for some blocks: each tier (B family) on every level
 * of the block with 20 noise seeds, against the rivals-only goals. Returns
 * the wins per tier per block (out of 200).
 */
export async function ladderWins(
  blocks: readonly number[],
): Promise<Record<'advanced' | 'intermediate' | 'novice', number[]>> {
  const { botWins, skill } = await import('./bots');
  const { generateCourse } = await import('./course');
  const { simulateRivals } = await import('./rivals');
  const tiers = ['advanced', 'intermediate', 'novice'] as const;
  const wins = { advanced: [] as number[], intermediate: [] as number[], novice: [] as number[] };
  for (const block of blocks) {
    for (const t of tiers) wins[t].push(0);
    for (let l = (block - 1) * 10 + 1; l <= block * 10; l++) {
      const course = generateCourse(l);
      const finish = simulateRivals(course, l).finish;
      for (const t of tiers) {
        for (let s = 0; s < LADDER_SEEDS; s++) {
          if (botWins(course, 'B', finish, skill(t, `overtake-ladder-${s}`)).won) {
            wins[t][wins[t].length - 1]! += 1;
          }
        }
      }
    }
  }
  return wins;
}

export const LADDER_SEEDS = 20;
