// @vitest-environment node
/**
 * RIVAL_PACE is frozen (docs/OVERTAKE_RULES.md §6): its shape, order and hash
 * are pinned here, and the calibration that made it is reproducible.
 *
 * `OT_REGEN_PACE=1 pnpm exec vitest run src/games/overtake/game/rivalPace.test.ts`
 * regenerates the whole table (about a minute and a half), prints it, and fails unless it
 * equals the source; it also checks the bracketed search against the
 * exhaustive one on Lv1, 50 and 100. That run is not part of `pnpm test` (§6):
 * do it whenever the generator, the planner, the physics, the bots or the
 * calibration constants change, and commit the new table with the change.
 */
import { describe, expect, it } from 'vitest';
import {
  calibrateLevel,
  calibrationTargets,
  formatPaceTable,
  referenceSteps,
  searchMeanBracketed,
  searchMeanExhaustive,
} from './calibrate';
import { generateCourse } from './course';
import { RIVAL_PACE } from './rivalPace';
import { LEVELS, fnv1a, report } from './test-helpers';

const REGENERATE = process.env.OT_REGEN_PACE === '1';

describe('RIVAL_PACE (§6)', () => {
  it('is 100 rows of three integers in 60..420, fastest first', () => {
    expect(RIVAL_PACE).toHaveLength(100);
    for (const row of RIVAL_PACE) {
      expect(row).toHaveLength(3);
      for (const c of row) {
        expect(Number.isInteger(c)).toBe(true);
        expect(c).toBeGreaterThanOrEqual(60);
        expect(c).toBeLessThanOrEqual(420);
      }
      expect(row[0]).toBeGreaterThanOrEqual(row[1]);
      expect(row[1]).toBeGreaterThanOrEqual(row[2]);
    }
    const column = (i: number) => RIVAL_PACE.map((row) => row[i]!);
    report(
      'RIVAL_PACE px/s (min..max): c_1',
      Math.min(...column(0)),
      Math.max(...column(0)),
      'c_2',
      Math.min(...column(1)),
      Math.max(...column(1)),
      'c_3',
      Math.min(...column(2)),
      Math.max(...column(2)),
    );
  });

  it('is the frozen table (hash pinned)', () => {
    expect(fnv1a(JSON.stringify(RIVAL_PACE))).toBe('cabcdabf');
  });

  it('keeps the Lv1–5 rows of the table frozen before sand and cones (§6)', () => {
    // Lv1–5 have neither (cones from Lv6, sand from Lv16), so their courses
    // and every planLane decision are unchanged and calibration lands on the
    // same means (the 2026-10-22 regeneration; table hash a0e26438 before).
    const before = [
      [335, 321, 306],
      [337, 322, 307],
      [338, 323, 308],
      [338, 324, 309],
      [339, 325, 310],
    ];
    expect(RIVAL_PACE.slice(0, 5)).toEqual(before);
    report('RIVAL_PACE Lv1–5 rows unchanged by sand and cones', 'yes');
  });

  it('the bracketed search agrees with the exhaustive one on Lv1, rival 1', () => {
    const course = generateCourse(1);
    const sB = referenceSteps(course)!;
    const target = calibrationTargets(1, sB)[0];
    const fast = searchMeanBracketed(course, 1, 0, target);
    const full = searchMeanExhaustive(course, 1, 0, target);
    expect(fast.mean).toBe(full.mean);
    expect(fast.mean).toBe(RIVAL_PACE[0]![0]);
    report(
      'Lv1 rival 1: S_B',
      sB,
      'T1',
      target,
      'mean',
      fast.mean,
      'runs bracketed/exhaustive',
      fast.runs,
      full.runs,
    );
  }, 30_000);
});

describe.skipIf(!REGENERATE)('regenerating RIVAL_PACE (OT_REGEN_PACE=1 only)', () => {
  it('reproduces the frozen table', () => {
    const started = performance.now();
    const levels = LEVELS.map((l) => calibrateLevel(l));
    const rows = levels.map((c) => c.pace);
    process.stdout.write(`\nRIVAL_PACE-BEGIN\n${formatPaceTable(rows)}\nRIVAL_PACE-END\n`);
    report(
      'regeneration, ms',
      (performance.now() - started).toFixed(0),
      'solo runs (B_ref + rivals)',
      levels.reduce((n, c) => n + c.runs, 0),
    );
    expect(rows).toEqual(RIVAL_PACE);
  }, 600_000);

  it('bracketed equals exhaustive on Lv1, 50 and 100 (all three rivals)', () => {
    for (const l of [1, 50, 100]) {
      expect(calibrateLevel(l, 'exhaustive').pace, `Lv${l}`).toEqual(calibrateLevel(l).pace);
    }
  }, 600_000);
});
