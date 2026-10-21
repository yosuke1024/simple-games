/**
 * Traffic generation (docs/OVERTAKE_RULES.md §5): constructive, deterministic
 * per (seed, level), no search and no retries. The route is carved first —
 * every row's position, kind, gap and arrangement — and the rows are then
 * materialised; the result is checked with the same sweep the planner uses,
 * and a course that fails falls back to "route only" (walls kept, every
 * normal row emptied) rather than shipping an unfair board.
 *
 * The order the generator draws from the rng is part of the golden courses
 * (game/compatibility.test.ts): reordering a draw is a decision, not a
 * refactor, and it would also mean regenerating RIVAL_PACE (§6).
 */
import {
  CAR_LENGTH,
  EASY_SIGMA,
  FULL_SPEED,
  GATE_TAIL,
  GEN_ROW_LIMIT,
  GOAL_CLEARANCE,
  SHOULDER_LEFT,
  SHOULDER_RIGHT,
  STEER_PER_STEP,
  SUB,
  TRAFFIC_SEED,
  TRAFFIC_START,
} from './constants';
import {
  carObstacle,
  laneCenter,
  laneLeft,
  laneWidth,
  wallBand,
  wallCentres,
  wallGapSpan,
} from './geometry';
import { distance } from './intervals';
import { CAR_DIMENSIONS, WORKS_LENGTH, levelSpec, type LevelSpec } from './levels';
import { createRng, pickWeighted, randInt, type Rng } from './rng';
import { verifyRoute } from './route';
import type { CarKind, Course, Obstacle, Row, RowKind, RowTemplate } from './types';

export interface GenerateOptions {
  /** Work bound override (tests only): rows per course. */
  readonly rowLimit?: number;
  /** Tests only: replace this normal row's traffic with a full-width block. */
  readonly breakRow?: number;
  /** Tests only: a different traffic seed. */
  readonly seed?: string;
}

/** Shifts −2..+2 and their weights for an ordinary gap move (§7). */
const SHIFTS = [-2, -1, 0, 1, 2] as const;
const SHIFT_WEIGHTS = [1, 3, 2, 3, 1] as const;
/**
 * A wall pair always moves the gap (§5): ±1 or ±2 lanes (3 : 1) on 3 and 4
 * lanes, exactly ±2 on 5 lanes — one 5-lane lane apart the two bands are
 * only 7.2–15.2 px apart: a jog too small to read, one the 30 Hz decision
 * lag makes far more costly than the move itself, and — for the gate pair —
 * one the step quantisation of the physics could cross at full throttle
 * (up to 2 × 440 units of extra reach, more than (1 − σ_gate) × 7.2 px).
 */
const WALL_SHIFTS = [-2, -1, 1, 2] as const;
const WALL_SHIFT_WEIGHTS = [1, 3, 3, 1] as const;
const WALL_SHIFT_WEIGHTS_FIVE = [1, 0, 0, 1] as const;
/** An S-curve swings the gap back the other way, 1 in 4 rows after a move (§5, §7). */
const S_CURVE_ODDS = 4;

/** D = ceil(420 × m × σ‰ / (440 × 1000)), units (§5). */
export function leadFor(move: number, sigma: number): number {
  return Math.ceil((FULL_SPEED * move * sigma) / (STEER_PER_STEP * 1000));
}

interface Draft {
  kind: RowKind;
  template: RowTemplate;
  gap: number;
  u: number;
  length: number;
  lead: number;
  sigma: number;
  move: number;
  obstacles: Obstacle[];
  gapSpan: [number, number] | null;
}

function pickShift(rng: Rng, lanes: number, gap: number, wall: boolean): number {
  const shifts = wall ? WALL_SHIFTS : SHIFTS;
  const weights = wall
    ? lanes === 5
      ? WALL_SHIFT_WEIGHTS_FIVE
      : WALL_SHIFT_WEIGHTS
    : SHIFT_WEIGHTS;
  const allowed = weights.map((w, i) => {
    const to = gap + shifts[i]!;
    return to >= 0 && to < lanes ? w : 0;
  });
  return shifts[pickWeighted(rng, allowed)]!;
}

/**
 * A gap move for a normal (or gate-1) row, with the S-curve draw from Lv11:
 * after a move, 1 in 4 rows swings back 1 lane (weight 3) or 2 lanes
 * (weight 1) where the lanes allow it (§5, §7). Exported for the tests only.
 */
export function pickNormalShift(
  rng: Rng,
  spec: LevelSpec,
  gap: number,
  previousShift: number,
): number {
  if (spec.sCurves) {
    const swing = randInt(rng, S_CURVE_ODDS) === 0;
    if (swing && previousShift !== 0) {
      const direction = previousShift > 0 ? -1 : 1;
      const options = [1, 2].filter((m) => {
        const to = gap + direction * m;
        return to >= 0 && to < spec.lanes;
      });
      if (options.length > 0) {
        const weights = options.map((m) => (m === 1 ? 3 : 1));
        return direction * options[pickWeighted(rng, weights)]!;
      }
    }
  }
  return pickShift(rng, spec.lanes, gap, false);
}

function pickKind(rng: Rng, kinds: readonly CarKind[]): CarKind {
  return kinds[randInt(rng, kinds.length)]!;
}

function buildWall(lanes: number, gap: number, kind: CarKind, u: number): Draft['obstacles'] {
  return wallCentres(lanes, gap, kind).map((x) => carObstacle(kind, x, u));
}

/** Fills a normal row from the templates (§5 "埋める"). Returns the obstacles and the template. */
function fillNormal(
  rng: Rng,
  spec: LevelSpec,
  gap: number,
  u: number,
): { obstacles: Obstacle[]; template: RowTemplate } {
  const lanes = spec.lanes;
  const open: number[] = [];
  for (let lane = 0; lane < lanes; lane++) if (lane !== gap) open.push(lane);
  const pairs: number[] = [];
  for (let lane = 0; lane + 1 < lanes; lane++) {
    if (lane !== gap && lane + 1 !== gap) pairs.push(lane);
  }
  const outer = [0, lanes - 1].filter((lane) => lane !== gap);
  const t = spec.templates;
  const choice = pickWeighted(rng, [
    t.single,
    pairs.length > 0 ? t.two : 0,
    t.truck,
    outer.length > 0 ? t.works : 0,
  ]);
  if (choice === 1) {
    const lane = pairs[randInt(rng, pairs.length)]!;
    const a = pickKind(rng, spec.smallKinds);
    const b = pickKind(rng, spec.smallKinds);
    return {
      template: 'two',
      obstacles: [
        carObstacle(a, laneCenter(lanes, lane), u),
        carObstacle(b, laneCenter(lanes, lane + 1), u),
      ],
    };
  }
  if (choice === 2) {
    const lane = open[randInt(rng, open.length)]!;
    const obstacles = [carObstacle('truck', laneCenter(lanes, lane), u)];
    const rest = open.filter((l) => l !== lane);
    if (rest.length > 0 && randInt(rng, 2) === 0) {
      const other = rest[randInt(rng, rest.length)]!;
      obstacles.push(carObstacle(pickKind(rng, spec.smallKinds), laneCenter(lanes, other), u));
    }
    return { template: 'truck', obstacles };
  }
  if (choice === 3) {
    const lane = outer[randInt(rng, outer.length)]!;
    const left = laneLeft(lanes, lane);
    return {
      template: 'works',
      obstacles: [
        {
          kind: 'works',
          left,
          right: left + laneWidth(lanes),
          rear: u,
          front: u + WORKS_LENGTH * SUB,
        },
      ],
    };
  }
  const lane = open[randInt(rng, open.length)]!;
  return {
    template: 'single',
    obstacles: [carObstacle(pickKind(rng, spec.smallKinds), laneCenter(lanes, lane), u)],
  };
}

function rowLength(obstacles: readonly Obstacle[]): number {
  let longest = 0;
  for (const o of obstacles) longest = Math.max(longest, o.front - o.rear);
  return longest;
}

/** T_j (§5), units. */
export function gateTarget(spec: LevelSpec, j: number): number {
  const n = spec.gatePairs;
  const px = 600 + Math.floor(((spec.length - 1000 - GATE_TAIL) * (2 * j + 1)) / (2 * n));
  return px * SUB;
}

/**
 * A course from rows (re-indexed in order). The generator's own last step,
 * and how a test builds a synthetic stretch such as one gate pair (§16).
 */
export function assembleCourse(
  level: number,
  lanes: number,
  length: number,
  rows: readonly Omit<Row, 'index'>[],
  gatePairs = 0,
  fallbackReason: Course['fallbackReason'] = 'none',
): Course {
  const indexed: Row[] = rows.map((row, index) => ({ ...row, index }));
  const obstacles = indexed.flatMap((row) => row.obstacles);
  obstacles.sort((a, b) => a.rear - b.rear || a.left - b.left);
  return {
    level,
    lanes,
    length,
    rows: indexed,
    obstacles,
    gatePairs,
    fallbackCount: fallbackReason === 'none' ? 0 : 1,
    fallbackReason,
  };
}

function finish(
  spec: LevelSpec,
  drafts: Draft[],
  gatePairs: number,
  fallback: Course['fallbackReason'],
): Course {
  return assembleCourse(spec.level, spec.lanes, spec.length * SUB, drafts, gatePairs, fallback);
}

/** "Route only" (§5): the walls stay, every normal row is emptied. */
function routeOnly(drafts: Draft[]): Draft[] {
  return drafts.map((d) =>
    d.kind === 'normal' ? { ...d, template: 'empty' as const, obstacles: [] } : d,
  );
}

export function generateCourse(level: number, options: GenerateOptions = {}): Course {
  const spec = levelSpec(level);
  const lanes = spec.lanes;
  const rowLimit = options.rowLimit ?? GEN_ROW_LIMIT;
  const rng = createRng(`${options.seed ?? TRAFFIC_SEED}:${spec.level}`);
  const lastFront = spec.length * SUB - GOAL_CLEARANCE;
  const drafts: Draft[] = [];
  let hitLimit = false;

  const wallDraft = (
    kind: RowKind,
    gap: number,
    wallKind: CarKind,
    u: number,
    lead: number,
    sigma: number,
    move: number,
  ): Draft => ({
    kind,
    template: 'wall',
    gap,
    u,
    length: CAR_DIMENSIONS[wallKind].length * SUB,
    lead,
    sigma,
    move,
    obstacles: buildWall(lanes, gap, wallKind, u),
    gapSpan: wallGapSpan(lanes, gap, wallKind),
  });

  /** The second wall of a pair, placed `sigma` behind `first` (§5 間隔 "壁の組の 2 枚目"). */
  const secondWall = (kind: RowKind, first: Draft, sigma: number): Draft => {
    const gap = first.gap + pickShift(rng, lanes, first.gap, true);
    const wallKind = pickKind(rng, spec.wallKinds);
    const span = wallGapSpan(lanes, gap, wallKind);
    const move = distance(wallBand(first.gapSpan!), wallBand(span));
    const lead = leadFor(move, sigma);
    const u = first.u + first.length + CAR_LENGTH + lead;
    return wallDraft(kind, gap, wallKind, u, lead, sigma, move);
  };

  // Rows 1 and 2: the easy pair (§5).
  const firstGap = randInt(rng, lanes);
  const firstKind = pickKind(rng, spec.wallKinds);
  const u1 = TRAFFIC_START + randInt(rng, 121) * SUB;
  const easy1 = wallDraft('easy1', firstGap, firstKind, u1, 0, 0, 0);
  drafts.push(easy1);
  const easy2 = secondWall('easy2', easy1, EASY_SIGMA);
  if (easy2.u + easy2.length <= lastFront) drafts.push(easy2);

  let gateIndex = 0;
  let gatesPlaced = 0;
  while (drafts.length >= 2) {
    if (drafts.length >= rowLimit) {
      hitLimit = true;
      break;
    }
    const prev = drafts[drafts.length - 1]!;
    const beforePrev = drafts[drafts.length - 2]!;
    const shift = pickNormalShift(rng, spec, prev.gap, prev.gap - beforePrev.gap);
    const gap = prev.gap + shift;
    const move = shift === 0 ? laneWidth(lanes) : Math.abs(shift) * laneWidth(lanes);
    const lead = leadFor(move, spec.sigma);
    const u = prev.u + prev.length + CAR_LENGTH + lead;
    if (gateIndex < spec.gatePairs && u >= gateTarget(spec, gateIndex)) {
      const wallKind = pickKind(rng, spec.wallKinds);
      const gate1 = wallDraft('gate1', gap, wallKind, u, lead, spec.sigma, move);
      const gate2 = secondWall('gate2', gate1, spec.gateSigma);
      if (gate2.u + gate2.length <= lastFront && drafts.length + 2 <= rowLimit) {
        drafts.push(gate1, gate2);
        gateIndex += 1;
        gatesPlaced += 1;
        continue;
      }
      if (drafts.length + 2 > rowLimit && gate2.u + gate2.length <= lastFront) {
        hitLimit = true;
        break;
      }
      // The pair does not fit before the goal: no more pairs, and no more rows.
      break;
    }
    const { obstacles, template } = fillNormal(rng, spec, gap, u);
    const length = rowLength(obstacles);
    if (u + length > lastFront) break;
    drafts.push({
      kind: 'normal',
      template,
      gap,
      u,
      length,
      lead,
      sigma: spec.sigma,
      move,
      obstacles,
      gapSpan: null,
    });
  }

  if (options.breakRow !== undefined) {
    const target = drafts[options.breakRow];
    if (target !== undefined && target.kind === 'normal') {
      drafts[options.breakRow] = {
        ...target,
        template: 'works',
        obstacles: [
          {
            kind: 'works',
            left: SHOULDER_LEFT,
            right: SHOULDER_RIGHT,
            rear: target.u,
            front: target.u + target.length,
          },
        ],
      };
    }
  }

  if (hitLimit) return finish(spec, routeOnly(drafts), gatesPlaced, 'row-limit');
  const course = finish(spec, drafts, gatesPlaced, 'none');
  if (verifyRoute(course, spec.checkSpeed).ok) return course;
  return finish(spec, routeOnly(drafts), gatesPlaced, 'verify');
}
