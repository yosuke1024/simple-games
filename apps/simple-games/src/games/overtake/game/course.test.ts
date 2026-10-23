// @vitest-environment node
/**
 * Traffic generation (docs/OVERTAKE_RULES.md §5) on all 100 shipped levels,
 * and its two forced fallbacks (§16 "限界の経路").
 */
import { describe, expect, it } from 'vitest';
import {
  CAR_LENGTH,
  CAR_WIDTH,
  FULL_SPEED,
  GEN_ROW_LIMIT,
  GOAL_CLEARANCE,
  SUB,
  TRAFFIC_START,
} from './constants';
import {
  assembleCourse,
  coneGroup,
  coneGroupWidth,
  gateTarget,
  generateCourse,
  leadFor,
  pairLeadFor,
  pickNormalShift,
} from './course';
import {
  laneLeft,
  laneWidth,
  uncoveredSpans,
  wallBand,
  wallCentres,
  carObstacle,
  wallGapSpan,
} from './geometry';
import {
  CONE_CLEARANCE,
  CONE_LENGTH,
  CONE_PITCH,
  CONE_WIDTH,
  SAND_LENGTH_SPAN,
  SAND_MIN_LENGTH,
  ZONE_GAP,
  levelSpec,
} from './levels';
import { createRng, type Rng } from './rng';
import { verifyRoute } from './route';
import { LEVELS, collectNumbers, report } from './test-helpers';
import type { CarKind, Course, Row } from './types';

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
        if (row.kind === 'normal' || row.kind === 'gate1') {
          const lanes = Math.abs(row.gap - prev.gap);
          expect(row.move).toBe(Math.max(1, lanes) * laneWidth(spec.lanes));
          expect(row.sigma).toBe(spec.sigma);
          expect(row.lead).toBe(leadFor(row.move, row.sigma));
        } else {
          expect(row.move).toBe(Math.abs(row.gap - prev.gap) * laneWidth(c.lanes));
          expect(row.lead).toBe(pairLeadFor(row.move));
          expect(row.sigma).toBe(0);
        }
      }
    }
  });

  it('opens every level with two spaced walls, and places the configured pairs from Lv11', () => {
    for (const l of LEVELS) {
      const c = course(l);
      expect(c.rows.slice(0, 2).map((r) => r.kind)).toEqual(['easy1', 'easy2']);
      expect(c.rows.filter((r) => r.kind === 'gate2').length).toBe(levelSpec(l).gatePairs);
      expect(c.gatePairs).toBe(levelSpec(l).gatePairs);
    }
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
    // Works becomes eligible at Lv31; its weighted draw need not occur in that exact level.
    expect(firstWith((c) => has(c, 'works'))).toBeGreaterThanOrEqual(31);
    expect(firstWith((c) => has(c, 'works'))).toBeLessThanOrEqual(40);
    expect(firstWith((c) => c.rows.some((r) => r.template === 'two'))).toBe(1);
    expect(firstWith((c) => c.rows.some((r) => r.template === 'truck'))).toBe(21);
    expect(firstWith((c) => c.zones.some((z) => z.kind === 'cone'))).toBe(6);
    expect(firstWith((c) => c.zones.some((z) => z.kind === 'sand'))).toBe(16);
    expect(firstWith((c) => c.rows.some((r) => r.template === 'cones'))).toBe(6);
    expect(firstWith((c) => c.rows.some((r) => r.template === 'sand'))).toBe(16);
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
    // Sand and cones go with the rest of the normal rows (§5 "ルートのみ").
    expect(generateCourse(37).zones.length).toBeGreaterThan(0);
    expect(c.rows.every((r) => r.zones.length === 0)).toBe(true);
    expect(c.zones).toEqual([]);
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
    expect(plain.zones.length).toBeGreaterThan(0);
    expect(c.zones).toEqual([]);
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

/** A normal row's zones came without a template draw when the 4 normal rows before it had none (§5). */
function zoneRowsByCause(c: Course): { drawn: Row[]; forced: Row[] } {
  const drawn: Row[] = [];
  const forced: Row[] = [];
  let since = 0;
  for (const row of c.rows) {
    if (row.kind !== 'normal') continue;
    if (row.zones.length > 0) {
      (since >= ZONE_GAP && levelSpec(c.level).templates.cones > 0 ? forced : drawn).push(row);
      since = 0;
    } else {
      since += 1;
    }
  }
  return { drawn, forced };
}

describe('sand and cones (§1, §5, 2026-10-22)', () => {
  it('cover W(L) = 50 / 38 / 22 px and step (W − 12) / (n − 1) inward, 16 px forward', () => {
    expect([3, 4, 5].map((l) => coneGroupWidth(l) / SUB)).toEqual([50, 38, 22]);
    for (const lanes of [3, 4, 5]) {
      // At least 38 px of the lane stays open beside the group.
      expect(laneWidth(lanes) - coneGroupWidth(lanes)).toBeGreaterThanOrEqual(CONE_CLEARANCE * SUB);
    }
    const pitch = (lanes: number, n: number) => {
      const g = coneGroup(lanes, 0, 0, n, 0);
      return g[1]!.left - g[0]!.left;
    };
    expect([pitch(3, 2), pitch(3, 3), pitch(4, 2), pitch(4, 3), pitch(5, 2), pitch(5, 3)]).toEqual([
      4560, 2280, 3120, 1560, 1200, 600,
    ]);
    // Right side: mirrored from the lane's right edge; rears 16 px apart.
    const right = coneGroup(3, 1, 1, 3, 1000 * SUB);
    expect(right[0]!.right).toBe(laneLeft(3, 1) + laneWidth(3));
    expect(right[2]!.left).toBe(laneLeft(3, 1) + laneWidth(3) - coneGroupWidth(3));
    expect(right.map((z) => z.rear - 1000 * SUB)).toEqual([0, 16 * SUB, 32 * SUB]);
  });

  it('live only on normal rows templated sand / cones, with the §1 geometry, inside [600, U − 400]', () => {
    let sandOnGap = 0;
    let sandRows = 0;
    let coneRows = 0;
    for (const l of LEVELS) {
      const c = course(l);
      const lw = laneWidth(c.lanes);
      const flat: number[] = [];
      for (const row of c.rows) {
        // L_k = the largest front − u_k, u_k = the smallest rear (§5).
        const pieces = [...row.obstacles, ...row.zones];
        if (pieces.length > 0) {
          expect(row.u, `Lv${l} row ${row.index}`).toBe(Math.min(...pieces.map((p) => p.rear)));
          expect(row.length, `Lv${l} row ${row.index}`).toBe(
            Math.max(...pieces.map((p) => p.front)) - row.u,
          );
        }
        if (row.template !== 'sand' && row.template !== 'cones') {
          expect(row.zones, `Lv${l} row ${row.index}`).toEqual([]);
          continue;
        }
        expect(row.kind).toBe('normal');
        expect(row.obstacles).toEqual([]);
        for (const z of row.zones) {
          expect(z.rear).toBeGreaterThanOrEqual(TRAFFIC_START);
          expect(z.front).toBeLessThanOrEqual(c.length - GOAL_CLEARANCE);
          flat.push(z.rear);
        }
        if (row.template === 'sand') {
          sandRows += 1;
          expect(row.zones.length).toBe(1);
          const z = row.zones[0]!;
          expect(z.kind).toBe('sand');
          expect(z.right - z.left).toBe(lw);
          const lane = (z.left - laneLeft(c.lanes, 0)) / lw;
          expect(Number.isInteger(lane) && lane >= 0 && lane < c.lanes).toBe(true);
          if (lane === row.gap) sandOnGap += 1;
          expect(z.rear).toBe(row.u);
          const len = (z.front - z.rear) / SUB;
          expect(Number.isInteger(len)).toBe(true);
          expect(len).toBeGreaterThanOrEqual(SAND_MIN_LENGTH);
          expect(len).toBeLessThanOrEqual(SAND_MIN_LENGTH + SAND_LENGTH_SPAN - 1);
        } else {
          coneRows += 1;
          const n = row.zones.length;
          expect([2, 3]).toContain(n);
          row.zones.forEach((z, i) => {
            expect(z.kind).toBe('cone');
            expect([z.right - z.left, z.front - z.rear]).toEqual([
              CONE_WIDTH * SUB,
              CONE_LENGTH * SUB,
            ]);
            expect(z.rear).toBe(row.u + i * CONE_PITCH * SUB);
          });
          expect(row.length).toBe(((n - 1) * CONE_PITCH + CONE_LENGTH) * SUB);
          // The group sits at one edge of one lane and covers exactly W(L).
          const lo = Math.min(...row.zones.map((z) => z.left));
          const hi = Math.max(...row.zones.map((z) => z.right));
          expect(hi - lo).toBe(coneGroupWidth(c.lanes));
          const lane = Math.floor((lo - laneLeft(c.lanes, 0)) / lw);
          const edgeL = laneLeft(c.lanes, lane);
          expect(lo === edgeL || hi === edgeL + lw, `Lv${l} row ${row.index}`).toBe(true);
          expect(hi).toBeLessThanOrEqual(edgeL + lw);
          // The cone at the lane's edge is the nearest (§1 diagonal).
          const first = row.zones[0]!;
          expect(first.left === edgeL || first.right === edgeL + lw).toBe(true);
        }
      }
      // Course.zones holds every row's zones, sorted by rear.
      expect(c.zones.map((z) => z.rear)).toEqual([...flat].sort((a, b) => a - b));
    }
    report('sand rows', sandRows, 'on the gap lane', sandOnGap, 'cone rows', coneRows);
    expect(sandOnGap).toBeGreaterThan(0);
    expect(sandOnGap).toBeLessThan(sandRows);
  });

  it('never overlap traffic or works', () => {
    for (const l of LEVELS) {
      const c = course(l);
      for (const z of c.zones) {
        for (const o of c.obstacles) {
          const overlap =
            z.left < o.right && z.right > o.left && z.rear < o.front && z.front > o.rear;
          expect(overlap, `Lv${l}`).toBe(false);
        }
      }
    }
  });

  it('appear from Lv6 (cones) and Lv16 (sand), never as part of a wall pair', () => {
    for (const l of LEVELS) {
      const c = course(l);
      if (l < 6) expect(c.zones, `Lv${l}`).toEqual([]);
      if (l < 16)
        expect(
          c.zones.some((z) => z.kind === 'sand'),
          `Lv${l}`,
        ).toBe(false);
      for (const row of c.rows) if (row.kind !== 'normal') expect(row.zones).toEqual([]);
    }
  });

  it(`keep coming: from Lv6 no ${ZONE_GAP + 1} normal rows in a row without sand or cones; targets met`, () => {
    expect(ZONE_GAP).toBe(4);
    const lines: string[] = [];
    const span = {
      zoneRows: [Infinity, 0],
      cones: [Infinity, 0],
      sand: [Infinity, 0],
      forced: [Infinity, 0],
    };
    const track = (key: keyof typeof span, v: number) => {
      span[key][0] = Math.min(span[key][0]!, v);
      span[key][1] = Math.max(span[key][1]!, v);
    };
    for (let l = 6; l <= 100; l++) {
      const c = course(l);
      let run = 0;
      for (const row of c.rows) {
        if (row.kind !== 'normal') continue;
        run = row.zones.length > 0 ? 0 : run + 1;
        expect(run, `Lv${l} row ${row.index}`).toBeLessThanOrEqual(ZONE_GAP);
      }
      const normal = c.rows.filter((r) => r.kind === 'normal').length;
      const walls = c.rows.length - normal;
      const coneGroups = c.rows.filter((r) => r.template === 'cones').length;
      const sand = c.rows.filter((r) => r.template === 'sand');
      const sandOnGap = sand.filter(
        (r) => (r.zones[0]!.left - laneLeft(c.lanes, 0)) / laneWidth(c.lanes) === r.gap,
      ).length;
      const { forced } = zoneRowsByCause(c);
      const zoneRows = coneGroups + sand.length;
      expect(zoneRows, `Lv${l} zone rows`).toBeGreaterThanOrEqual(3);
      expect(coneGroups, `Lv${l} cone groups`).toBeGreaterThanOrEqual(1);
      if (l >= 16) expect(sand.length, `Lv${l} sand`).toBeGreaterThanOrEqual(1);
      track('zoneRows', zoneRows);
      track('cones', coneGroups);
      if (l >= 16) track('sand', sand.length);
      track('forced', forced.length);
      lines.push(
        `Lv${l} normal ${normal} walls ${walls} cones ${coneGroups} sand ${sand.length} sand-on-gap ${sandOnGap} forced ${forced.length}`,
      );
    }
    for (const line of lines) report('zones per level', line);
    report('zone rows per level Lv6–100 (min..max)', ...span.zoneRows);
    report('cone groups per level Lv6–100 (min..max)', ...span.cones);
    report('sand per level Lv16–100 (min..max)', ...span.sand);
    report('rows without a draw (ZONE_GAP) per level Lv6–100 (min..max)', ...span.forced);
  });

  it('a row without a draw is cones below Lv16, then whichever the course has fewer of (sand on a tie)', () => {
    let checked = 0;
    for (let l = 6; l <= 100; l++) {
      const c = course(l);
      const { forced } = zoneRowsByCause(c);
      for (const row of forced) {
        checked += 1;
        if (l < 16) {
          expect(row.template, `Lv${l} row ${row.index}`).toBe('cones');
          continue;
        }
        const before = c.rows.slice(0, row.index);
        const cones = before.filter((r) => r.template === 'cones').length;
        const sand = before.filter((r) => r.template === 'sand').length;
        expect(row.template, `Lv${l} row ${row.index}`).toBe(sand <= cones ? 'sand' : 'cones');
      }
    }
    report('rows without a draw checked', checked);
    expect(checked).toBeGreaterThan(0);
  });
});
