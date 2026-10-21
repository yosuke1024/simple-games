// @vitest-environment node
/**
 * Traffic generation (docs/OVERTAKE_RULES.md §5) on all 100 shipped levels,
 * and its two forced fallbacks (§16 "限界の経路").
 */
import { describe, expect, it } from 'vitest';
import {
  CAR_LENGTH,
  CAR_WIDTH,
  EASY_SIGMA,
  FULL_SPEED,
  GEN_ROW_LIMIT,
  GOAL_CLEARANCE,
  STEER_PER_STEP,
  SUB,
  TRAFFIC_START,
} from './constants';
import { assembleCourse, gateTarget, generateCourse, leadFor, pickNormalShift } from './course';
import {
  carObstacle,
  laneWidth,
  uncoveredSpans,
  wallBand,
  wallCentres,
  wallGapSpan,
} from './geometry';
import { distance } from './intervals';
import { levelSpec } from './levels';
import { advanceCar, newReport, type MutableCar } from './physics';
import { createRng, type Rng } from './rng';
import { fullSpeedBlockedRows, sweepRow, verifyRoute, windowEnd } from './route';
import { LEVELS, collectNumbers, report } from './test-helpers';
import type { CarKind, Course } from './types';

const courses = new Map<number, Course>();
function course(level: number): Course {
  let c = courses.get(level);
  if (c === undefined) {
    c = generateCourse(level);
    courses.set(level, c);
  }
  return c;
}

describe('generation is deterministic (§5)', () => {
  it('generates the same course twice for every level', () => {
    const started = performance.now();
    for (const l of LEVELS) expect(generateCourse(l)).toEqual(course(l));
    report(
      'generation, ms per course (dev machine)',
      ((performance.now() - started) / 100).toFixed(2),
    );
  });

  it('a different seed gives a different course', () => {
    expect(generateCourse(12, { seed: 'other' }).rows).not.toEqual(course(12).rows);
  });
});

describe('every shipped course (§5)', () => {
  it('passes the route sweep at its check speed and never falls back', () => {
    for (const l of LEVELS) {
      const spec = levelSpec(l);
      const c = course(l);
      expect(c.fallbackCount, `Lv${l}`).toBe(0);
      expect(verifyRoute(c, spec.checkSpeed).ok, `Lv${l}`).toBe(true);
      if (l <= 10) expect(verifyRoute(c, FULL_SPEED).ok, `Lv${l}`).toBe(true);
    }
  });

  it('keeps every piece of traffic inside [600, U − 400] and within the row bound', () => {
    let most = 0;
    for (const l of LEVELS) {
      const c = course(l);
      most = Math.max(most, c.rows.length);
      expect(c.rows.length).toBeLessThanOrEqual(GEN_ROW_LIMIT);
      for (const o of c.obstacles) {
        expect(o.rear).toBeGreaterThanOrEqual(TRAFFIC_START);
        expect(o.front).toBeLessThanOrEqual(c.length - GOAL_CLEARANCE);
      }
      for (const row of c.rows)
        expect(row.u + row.length).toBeLessThanOrEqual(c.length - GOAL_CLEARANCE);
    }
    report('rows per course, most', most, `(bound ${GEN_ROW_LIMIT})`);
  });

  it('spaces rows by (L_{k−1} + 58) + D_k with D_k = ceil(420 m σ / 440 000)', () => {
    for (const l of LEVELS) {
      const c = course(l);
      const spec = levelSpec(l);
      for (let k = 1; k < c.rows.length; k++) {
        const prev = c.rows[k - 1]!;
        const row = c.rows[k]!;
        expect(row.u).toBe(prev.u + prev.length + CAR_LENGTH + row.lead);
        expect(row.lead).toBe(leadFor(row.move, row.sigma));
        if (row.kind === 'normal' || row.kind === 'gate1') {
          const lanes = Math.abs(row.gap - prev.gap);
          expect(row.move).toBe(Math.max(1, lanes) * laneWidth(spec.lanes));
          expect(row.sigma).toBe(spec.sigma);
        } else {
          expect(row.move).toBe(distance(wallBand(prev.gapSpan!), wallBand(row.gapSpan!)));
          expect(row.sigma).toBe(row.kind === 'easy2' ? EASY_SIGMA : spec.gateSigma);
        }
      }
    }
  });

  it('opens every level with the easy pair: two walls, passable at full speed by ≤ 10 %', () => {
    for (const l of LEVELS) {
      const c = course(l);
      const [a, b] = c.rows;
      expect(a!.kind).toBe('easy1');
      expect(b!.kind).toBe('easy2');
      const shift = Math.abs(b!.gap - a!.gap);
      if (c.lanes === 5) expect(shift).toBe(2);
      else expect([1, 2]).toContain(shift);
      const m = b!.move;
      // Full speed reaches D × 440 / 420 sideways: at least m, at most 1.1 m + 0.009 px.
      expect(STEER_PER_STEP * b!.lead).toBeGreaterThanOrEqual(FULL_SPEED * m);
      expect(STEER_PER_STEP * b!.lead * 1000).toBeLessThan(
        FULL_SPEED * EASY_SIGMA * m + STEER_PER_STEP * 1000,
      );
      const entry = sweepRow(wallBand(a!.gapSpan!), b!, FULL_SPEED, false).entry;
      expect(entry.length, `Lv${l}`).toBeGreaterThan(0);
    }
  });

  it('makes exactly the gate-2 rows impassable at full speed, at least n_gate of them from Lv11', () => {
    const counts: number[] = [];
    for (const l of LEVELS) {
      const c = course(l);
      const spec = levelSpec(l);
      const blocked = fullSpeedBlockedRows(c, spec.checkSpeed);
      const gate2 = c.rows.filter((r) => r.kind === 'gate2').map((r) => r.index);
      expect(blocked, `Lv${l}`).toEqual(gate2);
      expect(c.gatePairs).toBe(gate2.length);
      if (l >= 11) {
        expect(blocked.length, `Lv${l}`).toBeGreaterThanOrEqual(spec.gatePairs);
        counts.push(blocked.length);
      } else {
        expect(blocked).toEqual([]);
      }
    }
    report(
      'full-speed-impassable rows Lv11–100 (min..max)',
      Math.min(...counts),
      Math.max(...counts),
    );
  });

  it('shifts every wall pair by ±1 or ±2 lanes on 3 and 4 lanes, by exactly ±2 on 5', () => {
    let pairs = 0;
    for (const l of LEVELS) {
      const c = course(l);
      for (const row of c.rows) {
        if (row.kind !== 'easy2' && row.kind !== 'gate2') continue;
        pairs += 1;
        const shift = Math.abs(row.gap - c.rows[row.index - 1]!.gap);
        if (c.lanes === 5) expect(shift, `Lv${l} row ${row.index}`).toBe(2);
        else expect([1, 2], `Lv${l} row ${row.index}`).toContain(shift);
      }
    }
    report('wall pairs checked (easy + gate)', pairs);
  });

  it('blocks every gate-2 row in the physics too, step quantisation included', () => {
    // The sweep above is continuous. The step moves sideways before it
    // advances and meets traffic only at the step's end, so between the last
    // step end inside window k − 1 and the first inside window k a car at 420
    // gets N = floor(D_k / 420) + 2 steps of 440 units at worst (a step ending
    // exactly on the window's end): 2 × 440 more than D_k × 440 / 420 (§5).
    // The row stays blocked while m_k > N × 440. Checked by arithmetic on
    // every gate-2 row, and by `advanceCar` at full throttle, steering from
    // the first band's near edge to the second's, from the worst start phase
    // and seven others.
    let rows = 0;
    let runs = 0;
    let stepMargin = Infinity;
    let continuousMargin = Infinity;
    for (let l = 11; l <= 100; l++) {
      const c = course(l);
      for (const second of c.rows) {
        if (second.kind !== 'gate2') continue;
        rows += 1;
        const first = c.rows[second.index - 1]!;
        const worstSteps = Math.floor(second.lead / FULL_SPEED) + 2;
        stepMargin = Math.min(stepMargin, second.move - worstSteps * STEER_PER_STEP);
        continuousMargin = Math.min(
          continuousMargin,
          second.move - (second.lead * STEER_PER_STEP) / FULL_SPEED,
        );
        expect(second.move, `Lv${l} row ${second.index}`).toBeGreaterThan(
          worstSteps * STEER_PER_STEP,
        );
        const pair = assembleCourse(l, c.lanes, c.length, [first, second]);
        const b1 = wallBand(first.gapSpan!);
        const b2 = wallBand(second.gapSpan!);
        const right = b2[0]! > b1[1]!;
        const edge1 = right ? b1[1]! : b1[0]!;
        const edge2 = right ? b2[0]! : b2[1]!;
        const end1 = windowEnd(first);
        const end2 = windowEnd(second);
        for (const phase of [0, 1, 60, 120, 180, 240, 300, 419]) {
          runs += 1;
          // The last step end inside window k − 1; phase 0 lands the next exactly on its end.
          const car: MutableCar = {
            r: end1 - FULL_SPEED + phase,
            x: edge1,
            w: FULL_SPEED,
            target: edge1,
            hold: 0,
            lock: 0,
            blink: 0,
            bumps: 0,
          };
          let hitAt = -1;
          while (car.r < end2 && hitAt < 0) {
            const steerX = car.r + FULL_SPEED >= end1 ? edge2 : edge1;
            // w stays 420 until the first overlap: where the front was when it met traffic.
            const front = car.r + FULL_SPEED;
            if (advanceCar(pair, car, { steerX, brake: 0 }, newReport()).overlapped) hitAt = front;
          }
          expect(hitAt, `Lv${l} row ${second.index} phase ${phase}`).toBeGreaterThan(second.u);
        }
      }
    }
    report(
      'gate-2 rows at full throttle: rows',
      rows,
      'physics runs',
      runs,
      'all overlap; smallest margin px, continuous',
      (continuousMargin / SUB).toFixed(2),
      'with step quantisation',
      (stepMargin / SUB).toFixed(2),
    );
  }, 60_000);

  it('would not block a 5-lane pair shifted by one lane — why 5 lanes shift by 2 (§5)', () => {
    // Gap 2 → 3, sedans, σ_gate 750 ‰: the bands are 7.2 px apart. The
    // continuous sweep calls the second wall blocked; the step does not.
    const wall = (gap: number, u: number, lead: number, move: number) => ({
      kind: (lead === 0 ? 'gate1' : 'gate2') as 'gate1' | 'gate2',
      template: 'wall' as const,
      u,
      length: CAR_LENGTH,
      gap,
      lead,
      sigma: lead === 0 ? 0 : 750,
      move,
      obstacles: wallCentres(5, gap, 'sedan').map((x) => carObstacle('sedan', x, u)),
      gapSpan: wallGapSpan(5, gap, 'sedan'),
    });
    const a = wall(2, 1000 * SUB, 0, 0);
    const m = distance(wallBand(a.gapSpan), wallBand(wallGapSpan(5, 3, 'sedan')));
    expect(m).toBe(Math.round(7.2 * SUB));
    const lead = leadFor(m, 750);
    const b = wall(3, a.u + 2 * CAR_LENGTH + lead, lead, m);
    const pair = assembleCourse(51, 5, 30_000 * SUB, [a, b]);
    expect(sweepRow(wallBand(a.gapSpan), pair.rows[1]!, FULL_SPEED, false).entry).toEqual([]);
    const end1 = windowEnd(pair.rows[0]!);
    const edge1 = wallBand(a.gapSpan)[1]!;
    const edge2 = wallBand(b.gapSpan)[0]!;
    const car: MutableCar = {
      r: end1 - FULL_SPEED,
      x: edge1,
      w: FULL_SPEED,
      target: edge1,
      hold: 0,
      lock: 0,
      blink: 0,
      bumps: 0,
    };
    let overlaps = 0;
    while (car.r < windowEnd(pair.rows[1]!)) {
      const steerX = car.r + FULL_SPEED >= end1 ? edge2 : edge1;
      if (advanceCar(pair, car, { steerX, brake: 0 }, newReport()).overlapped) overlaps += 1;
    }
    expect(overlaps).toBe(0);
  });

  it('places pair j at the first row whose normal position reaches T_j (§5)', () => {
    for (let l = 11; l <= 100; l++) {
      const c = course(l);
      const spec = levelSpec(l);
      const firsts = c.rows.filter((r) => r.kind === 'gate1');
      expect(firsts.length, `Lv${l}`).toBe(spec.gatePairs);
      firsts.forEach((g, j) => {
        const target = gateTarget(spec, j);
        expect(g.index, `Lv${l} pair ${j}`).toBeGreaterThanOrEqual(2);
        expect(g.u, `Lv${l} pair ${j}`).toBeGreaterThanOrEqual(target);
        expect(g.sigma).toBe(spec.sigma);
        expect(c.rows[g.index + 1]!.kind).toBe('gate2');
        for (const r of c.rows.slice(0, g.index)) {
          if (r.kind === 'normal')
            expect(r.u, `Lv${l} pair ${j} row ${r.index}`).toBeLessThan(target);
        }
      });
    }
  }, 60_000);

  it('starts row 1 at u_1 = 600 + 0..120 px', () => {
    let lo = Infinity;
    let hi = 0;
    for (const l of LEVELS) {
      const u = course(l).rows[0]!.u;
      expect(u).toBeGreaterThanOrEqual(600 * SUB);
      expect(u).toBeLessThanOrEqual(720 * SUB);
      expect(u % SUB).toBe(0);
      lo = Math.min(lo, u / SUB);
      hi = Math.max(hi, u / SUB);
    }
    report('u_1 over 100 levels, px (min..max)', lo, hi);
  });

  it('introduces kinds and templates where §7 says', () => {
    const firstWith = (pred: (c: Course) => boolean) => LEVELS.find((l) => pred(course(l)));
    const has = (c: Course, kind: string) => c.obstacles.some((o) => o.kind === kind);
    expect(firstWith((c) => has(c, 'van'))).toBe(11);
    expect(firstWith((c) => has(c, 'truck'))).toBe(21);
    expect(firstWith((c) => has(c, 'works'))).toBe(31);
    expect(firstWith((c) => c.rows.some((r) => r.template === 'two'))).toBe(1);
    expect(firstWith((c) => c.rows.some((r) => r.template === 'truck'))).toBe(21);
    for (const l of LEVELS.filter((l) => l <= 10)) {
      expect(course(l).obstacles.every((o) => o.kind === 'sedan')).toBe(true);
    }
  });

  it('holds only integers (§1)', () => {
    for (const l of LEVELS) {
      for (const n of collectNumbers(course(l))) expect(Number.isInteger(n)).toBe(true);
    }
  });
});

describe('wall geometry (§5 "壁の幾何")', () => {
  const kinds: CarKind[] = ['sedan', 'van', 'truck'];

  it('leaves exactly one car-wide stretch, the gap span, for every lane count, kind and gap', () => {
    for (const lanes of [3, 4, 5]) {
      for (const kind of kinds) {
        for (let gap = 0; gap < lanes; gap++) {
          const cars = wallCentres(lanes, gap, kind).map((x) => carObstacle(kind, x, 0));
          const wide = uncoveredSpans(cars).filter(([lo, hi]) => hi - lo >= CAR_WIDTH);
          expect(wide, `${lanes} lanes, ${kind}, gap ${gap}`).toEqual([
            wallGapSpan(lanes, gap, kind),
          ]);
        }
      }
    }
  });

  it('holds on every wall row of the shipped courses', () => {
    let walls = 0;
    for (const l of LEVELS) {
      for (const row of course(l).rows) {
        if (row.gapSpan === null) continue;
        walls += 1;
        const wide = uncoveredSpans(row.obstacles).filter(([lo, hi]) => hi - lo >= CAR_WIDTH);
        expect(wide).toEqual([row.gapSpan]);
      }
    }
    report('wall rows checked', walls);
  });

  it('reproduces the band widths of §5 (px)', () => {
    const width = (lanes: number, gap: number, kind: CarKind) => {
      const band = wallBand(wallGapSpan(lanes, gap, kind));
      return (band[1]! - band[0]!) / SUB;
    };
    expect(width(3, 1, 'sedan')).toBeCloseTo(67.33, 2);
    expect(width(4, 1, 'sedan')).toBe(42);
    expect(width(5, 2, 'sedan')).toBeCloseTo(53.6, 5);
    expect(width(5, 2, 'truck')).toBeCloseTo(45.6, 5);
    expect(width(5, 0, 'sedan')).toBeCloseTo(40.2, 5);
    expect(width(5, 0, 'truck')).toBeCloseTo(36.2, 5);
  });
});

describe('forced fallbacks (§16 "限界の経路")', () => {
  it('(a) a small row bound stops there and ships "route only"', () => {
    const c = generateCourse(37, { rowLimit: 12 });
    expect(c.rows.length).toBe(12);
    expect(c.fallbackCount).toBe(1);
    expect(c.fallbackReason).toBe('row-limit');
    expect(c.rows.filter((r) => r.kind === 'normal').every((r) => r.obstacles.length === 0)).toBe(
      true,
    );
    expect(verifyRoute(c, levelSpec(37).checkSpeed).ok).toBe(true);
  });

  it('(b) a blocked normal row fails the sweep and falls back, walls kept', () => {
    const plain = course(44);
    const victim = plain.rows.find((r) => r.kind === 'normal' && r.index > 5)!;
    const c = generateCourse(44, { breakRow: victim.index });
    expect(c.fallbackCount).toBe(1);
    expect(c.fallbackReason).toBe('verify');
    const walls = (x: Course) => x.rows.filter((r) => r.kind !== 'normal');
    expect(walls(c)).toEqual(walls(plain));
    expect(verifyRoute(c, levelSpec(44).checkSpeed).ok).toBe(true);
    // Without the fallback the broken row really is impassable, and the
    // fallback empties exactly that kind of row.
    const broken = assembleCourse(
      44,
      plain.lanes,
      plain.length,
      plain.rows.map((r) =>
        r.index === victim.index
          ? {
              ...r,
              obstacles: [
                {
                  kind: 'works' as const,
                  left: 16 * SUB,
                  right: 344 * SUB,
                  rear: r.u,
                  front: r.u + r.length,
                },
              ],
            }
          : r,
      ),
    );
    expect(verifyRoute(broken, levelSpec(44).checkSpeed).failedRow).toBe(victim.index);
    expect(c.rows[victim.index]!.obstacles).toEqual([]);
  });
});

describe('S-curves (§5, §7)', () => {
  /** An rng that hands out these words in order. */
  const scripted = (words: number[]): Rng => {
    let i = 0;
    return () => words[i++]!;
  };
  const LAST = 0xffffffff;

  it('swing back on a 0 draw of 4 after a move: 1 lane on weight 3, 2 lanes on weight 1', () => {
    const five = levelSpec(51);
    // Draws: the 1-in-4 swing (0 = swing), then the weighted 1 / 2 lanes.
    expect(pickNormalShift(scripted([0, 0]), five, 2, 1)).toBe(-1);
    expect(pickNormalShift(scripted([0, LAST]), five, 2, 1)).toBe(-2);
    expect(pickNormalShift(scripted([0, LAST]), five, 2, -2)).toBe(2);
    // Only the lanes that exist: from lane 1 a swing to the left is 1 lane.
    expect(pickNormalShift(scripted([0, LAST]), five, 1, 1)).toBe(-1);
    // No swing after a row that did not move; no swing when the draw is not 0.
    expect(pickNormalShift(scripted([0, 0]), five, 2, 0)).toBe(-2);
    expect(pickNormalShift(scripted([LAST, LAST]), five, 2, 1)).toBe(2);
  });

  it('draws the swing only from Lv11, and swings 1 in 4 rows after a move', () => {
    const count = (spec: ReturnType<typeof levelSpec>, previous: number) => {
      const rng = createRng('overtake-s-curve');
      const seen = new Map<number, number>();
      const n = 40_000;
      for (let i = 0; i < n; i++) {
        const s = pickNormalShift(rng, spec, 2, previous);
        seen.set(s, (seen.get(s) ?? 0) + 1);
      }
      return (shift: number) => (seen.get(shift) ?? 0) / n;
    };
    // Lv51, gap 2 of 5, after +1: ordinary weights 1/3/2/3/1 (of 10) plus the
    // swing (1/4: −1 at 3/4, −2 at 1/4) → −2 0.1375, −1 0.4125, 0 0.15, +1 0.225, +2 0.075.
    const after = count(levelSpec(51), 1);
    const expected = [0.1375, 0.4125, 0.15, 0.225, 0.075];
    [-2, -1, 0, 1, 2].forEach((s, i) => expect(after(s)).toBeCloseTo(expected[i]!, 2));
    // Below Lv11 (3 lanes, gap 2 is the right edge): only the ordinary weights, 1/3/2 of 6.
    const low = count(levelSpec(5), 1);
    [-2, -1, 0].forEach((s, i) => expect(low(s)).toBeCloseTo([1 / 6, 3 / 6, 2 / 6][i]!, 2));
  }, 60_000);
});
