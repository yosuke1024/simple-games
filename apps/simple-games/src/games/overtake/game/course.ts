/**
 * Traffic generation (docs/OVERTAKE_RULES.md §5): constructive, deterministic
 * per (seed, level), no search and no retries. The route is carved first —
 * every row's position, kind, gap and arrangement — and the rows are then
 * materialised; the result is checked with the same sweep the planner uses,
 * and a course that fails falls back to "route only" (walls kept, every
 * normal row emptied) rather than shipping an unfair board.
 *
 * Sand and cones (2026-10-22) are two more normal-row templates whose rows
 * hold one zone piece and no traffic; their weights sit at the tail of the
 * template draw, so a level where both weigh 0 (Lv1–5) draws exactly as
 * before. From Lv6 a row without a draw keeps them coming (ZONE_GAP, §5).
 *
 * The order the generator draws from the rng is part of the golden courses
 * (game/compatibility.test.ts): reordering a draw is a decision, not a
 * refactor, and it would also mean regenerating RIVAL_PACE (§6).
 */
import {
  CAR_LENGTH,
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
import { carObstacle, laneCenter, laneLeft, laneWidth, wallCentres, wallGapSpan } from './geometry';
import { exactDiv } from './arith';
import {
  CAR_DIMENSIONS,
  CONE_CLEARANCE,
  CONE_LENGTH,
  CONE_PITCH,
  CONE_WIDTH,
  SAND_LENGTH_SPAN,
  SAND_MIN_LENGTH,
  WORKS_LENGTH,
  PAIR_SPEED,
  PAIR_REACTION_STEPS,
  PAIR_MARGIN_STEPS,
  PAIR_STEER_MARGIN,
  ZONE_GAP,
  levelSpec,
  type LevelSpec,
} from './levels';
import { createRng, pickWeighted, randInt, type Rng } from './rng';
import { verifyRoute } from './route';
import type { CarKind, Course, Obstacle, Row, RowKind, RowTemplate, Zone } from './types';

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
 * Wall pairs move ±1 or ±2 lanes (3 : 1) on 3 and 4 lanes, exactly ±2 on
 * 5 lanes so the sideways move stays visible. Pair spacing now includes
 * reaction room (§5), rather than forcing even a precise driver to brake.
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

/**
 * Pair clearance after the first car has fully cleared the first wall, units.
 * Allow 250 ms to react, then steer centre-to-centre at 440 px/s while advancing at 300 px/s, with ±8 px
 * steering tolerance at both ends and two physics steps of longitudinal margin.
 * Unlike the old edge-to-edge σ < 1 rule, this permits an immediate precise
 * driver to stay at full throttle; braking buys the delayed driver time.
 */
export function pairLeadFor(centreMove: number): number {
  return (
    PAIR_SPEED * (PAIR_REACTION_STEPS + PAIR_MARGIN_STEPS) +
    Math.ceil((PAIR_SPEED * (centreMove + PAIR_STEER_MARGIN)) / STEER_PER_STEP)
  );
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
  zones: Zone[];
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

/**
 * W(L) (§1): the lateral width a cone group covers, units —
 * min(floor(lane / 2), floor(lane − 38)) px: 50 / 38 / 22 on 3 / 4 / 5 lanes,
 * so the group always leaves at least 38 px of its lane open.
 */
export function coneGroupWidth(lanes: number): number {
  const lane = laneWidth(lanes);
  const px = Math.min(
    Math.floor(lane / (2 * SUB)),
    Math.floor((lane - CONE_CLEARANCE * SUB) / SUB),
  );
  return px * SUB;
}

/**
 * A group of n cones (§1): from the chosen edge of the lane (side 0 = left,
 * 1 = right) inward, cone i at i × p from that edge (p = (W − 12) / (n − 1))
 * with its rear at u + 16 i — the edge cone nearest, a diagonal running in.
 */
export function coneGroup(lanes: number, lane: number, side: number, n: number, u: number): Zone[] {
  const width = CONE_WIDTH * SUB;
  const pitch = exactDiv(coneGroupWidth(lanes) - width, n - 1);
  const edgeLeft = laneLeft(lanes, lane);
  const edgeRight = edgeLeft + laneWidth(lanes);
  const cones: Zone[] = [];
  for (let i = 0; i < n; i++) {
    const left = side === 0 ? edgeLeft + i * pitch : edgeRight - i * pitch - width;
    const rear = u + i * CONE_PITCH * SUB;
    cones.push({ kind: 'cone', left, right: left + width, rear, front: rear + CONE_LENGTH * SUB });
  }
  return cones;
}

/** Sand (§1): one lane wide, `lengthPx` long. */
export function sandZone(lanes: number, lane: number, lengthPx: number, u: number): Zone {
  const left = laneLeft(lanes, lane);
  return { kind: 'sand', left, right: left + laneWidth(lanes), rear: u, front: u + lengthPx * SUB };
}

interface Filled {
  obstacles: Obstacle[];
  zones: Zone[];
  template: RowTemplate;
}

/** The draws after a cones / sand row is chosen (§5): lane, then side and count, or length. */
function fillZone(rng: Rng, lanes: number, kind: 'cones' | 'sand', u: number): Filled {
  const lane = randInt(rng, lanes);
  if (kind === 'cones') {
    const side = randInt(rng, 2);
    const n = 2 + randInt(rng, 2);
    return { template: 'cones', obstacles: [], zones: coneGroup(lanes, lane, side, n, u) };
  }
  const length = SAND_MIN_LENGTH + randInt(rng, SAND_LENGTH_SPAN);
  return { template: 'sand', obstacles: [], zones: [sandZone(lanes, lane, length, u)] };
}

/** Fills a normal row from the templates (§5 "埋める"). */
function fillNormal(rng: Rng, spec: LevelSpec, gap: number, u: number): Filled {
  const lanes = spec.lanes;
  const open: number[] = [];
  for (let lane = 0; lane < lanes; lane++) if (lane !== gap) open.push(lane);
  const pairs: number[] = [];
  for (let lane = 0; lane + 1 < lanes; lane++) {
    if (lane !== gap && lane + 1 !== gap) pairs.push(lane);
  }
  const outer = [0, lanes - 1].filter((lane) => lane !== gap);
  const t = spec.templates;
  // Cones and sand go last: their zero weights below Lv6 / Lv16 change nothing (§5).
  const choice = pickWeighted(rng, [
    t.single,
    pairs.length > 0 ? t.two : 0,
    t.truck,
    outer.length > 0 ? t.works : 0,
    t.cones,
    t.sand,
  ]);
  if (choice === 4) return fillZone(rng, lanes, 'cones', u);
  if (choice === 5) return fillZone(rng, lanes, 'sand', u);
  if (choice === 1) {
    const lane = pairs[randInt(rng, pairs.length)]!;
    const a = pickKind(rng, spec.smallKinds);
    const b = pickKind(rng, spec.smallKinds);
    return {
      template: 'two',
      zones: [],
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
    return { template: 'truck', obstacles, zones: [] };
  }
  if (choice === 3) {
    const lane = outer[randInt(rng, outer.length)]!;
    const left = laneLeft(lanes, lane);
    return {
      template: 'works',
      zones: [],
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
    zones: [],
    obstacles: [carObstacle(pickKind(rng, spec.smallKinds), laneCenter(lanes, lane), u)],
  };
}

/** L_k (§5): the largest front of the row's pieces − u_k (u_k is their smallest rear). */
function rowLength(u: number, obstacles: readonly Obstacle[], zones: readonly Zone[]): number {
  let longest = 0;
  for (const o of obstacles) longest = Math.max(longest, o.front - u);
  for (const z of zones) longest = Math.max(longest, z.front - u);
  return longest;
}

/** T_j (§5), units. */
export function gateTarget(spec: LevelSpec, j: number): number {
  const n = spec.gatePairs;
  const px = 600 + Math.floor(((spec.length - 1000 - GATE_TAIL) * (2 * j + 1)) / (2 * n));
  return px * SUB;
}

/** A row as `assembleCourse` takes it: no index, and `zones` may be left out (= none). */
export type RowInput = Omit<Row, 'index' | 'zones'> & { readonly zones?: readonly Zone[] };

/**
 * A course from rows (re-indexed in order). The generator's own last step,
 * and how a test builds a synthetic stretch such as one gate pair (§16).
 */
export function assembleCourse(
  level: number,
  lanes: number,
  length: number,
  rows: readonly RowInput[],
  gatePairs = 0,
  fallbackReason: Course['fallbackReason'] = 'none',
): Course {
  const indexed: Row[] = rows.map((row, index) => ({ ...row, zones: row.zones ?? [], index }));
  const obstacles = indexed.flatMap((row) => row.obstacles);
  obstacles.sort((a, b) => a.rear - b.rear || a.left - b.left);
  const zones = indexed.flatMap((row) => row.zones);
  zones.sort((a, b) => a.rear - b.rear || a.left - b.left);
  return {
    level,
    lanes,
    length,
    rows: indexed,
    obstacles,
    zones,
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

/** "Route only" (§5): the walls stay, every normal row is emptied — sand and cones too. */
function routeOnly(drafts: Draft[]): Draft[] {
  return drafts.map((d) =>
    d.kind === 'normal' ? { ...d, template: 'empty' as const, obstacles: [], zones: [] } : d,
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
    zones: [],
    gapSpan: wallGapSpan(lanes, gap, wallKind),
  });

  /** The second wall leaves room for a delayed centre-to-centre move (§5). */
  const secondWall = (kind: RowKind, first: Draft): Draft => {
    const gap = first.gap + pickShift(rng, lanes, first.gap, true);
    const wallKind = pickKind(rng, spec.wallKinds);
    const move = Math.abs(gap - first.gap) * laneWidth(lanes);
    const lead = pairLeadFor(move);
    const u = first.u + first.length + CAR_LENGTH + lead;
    return wallDraft(kind, gap, wallKind, u, lead, 0, move);
  };

  // Rows 1 and 2: the easy pair (§5).
  const firstGap = randInt(rng, lanes);
  const firstKind = pickKind(rng, spec.wallKinds);
  const u1 = TRAFFIC_START + randInt(rng, 121) * SUB;
  const easy1 = wallDraft('easy1', firstGap, firstKind, u1, 0, 0, 0);
  drafts.push(easy1);
  const easy2 = secondWall('easy2', easy1);
  if (easy2.u + easy2.length <= lastFront) drafts.push(easy2);

  let gateIndex = 0;
  let gatesPlaced = 0;
  // ZONE_GAP (§5 "1 コースの最小の数"): template-drawn normal rows since the
  // last sand / cones row, and how many of each this course holds so far.
  const zonesOn = spec.templates.cones > 0;
  let sinceZone = 0;
  let conesPlaced = 0;
  let sandPlaced = 0;
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
      const gate2 = secondWall('gate2', gate1);
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
    let filled: Filled;
    if (zonesOn && sinceZone >= ZONE_GAP) {
      // No template draw: Lv6–15 cones; from Lv16 whichever this course has
      // fewer of, sand on a tie (the newer word first).
      const kind = spec.templates.sand > 0 && sandPlaced <= conesPlaced ? 'sand' : 'cones';
      filled = fillZone(rng, lanes, kind, u);
    } else {
      filled = fillNormal(rng, spec, gap, u);
    }
    const { obstacles, zones, template } = filled;
    const length = rowLength(u, obstacles, zones);
    if (u + length > lastFront) break;
    if (template === 'cones') conesPlaced += 1;
    if (template === 'sand') sandPlaced += 1;
    sinceZone = zones.length > 0 ? 0 : sinceZone + 1;
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
      zones,
      gapSpan: null,
    });
  }

  if (options.breakRow !== undefined) {
    const target = drafts[options.breakRow];
    if (target !== undefined && target.kind === 'normal') {
      drafts[options.breakRow] = {
        ...target,
        template: 'works',
        zones: [],
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
