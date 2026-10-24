/**
 * Snapping a carried piece to an exact pose (docs/TANGRAM_RULES.md §5「吸着」),
 * and turning a placed piece about its pivot (§5「盤の上の回転と裏返し」).
 *
 * The finger (or the keyboard's provisional position) gives a float wish:
 * the orientation is settled, only the position is a float. `snapPose` turns
 * that wish into an exact pose and pivot, or into nothing. Floats rank the
 * candidates; every candidate itself is exact, and only an exact check
 * decides whether it may be placed.
 *
 * - Vertex snap first: a corner of the carried piece onto a corner of the
 *   silhouette or of another placed piece.
 * - Edge snap only when no vertex candidate can be placed: (a) a corner of
 *   the carried piece onto a tick of a target edge, (b) a target corner onto
 *   a tick of the carried piece's edge. Ticks keep every position exact.
 * - Candidates within the tolerance (distance ≤ tolerance, the bound
 *   included) are taken nearest first, distances compared squared, with
 *   squared distances within SNAP_EPS counted equal and broken by a fixed
 *   order. The first that can be placed wins.
 * - The work is bounded: at most SNAP_CHECK_LIMIT exact checks per query,
 *   one budget across both phases. At the bound the answer is an honest
 *   "nothing", never a guess.
 */
import { convexInside, convexOverlap, edgeTicks, isTickOf } from './geometry';
import {
  atFor,
  LOCAL_SHAPES,
  orientedShape,
  PIECE_IDS,
  poseVertices,
  turnChecked,
  mirror,
  unorientChecked,
  type Orientation,
  type PieceId,
  type Pose,
} from './pieces';
import { isBoundedPoint, ptEq, ptKey, ptSub, ptToFloat, type Pt } from './z2';

/** Exact checks one snap query may spend (§5「仕事量の上限」). */
export const SNAP_CHECK_LIMIT = 32;
/** Squared distances (units²) this close are equal (§4 の表, §5「選び方」). */
export const SNAP_EPS = 1e-9;
/** The largest coordinate part a pose, a pivot or a snap candidate may have (§5「範囲」). */
export const COORD_LIMIT = 256;

/** A piece on the board: its pose and the pivot it turns about (§5「支点」). */
export interface Placement extends Pose {
  readonly pv: Pt;
}

/** The pieces on the board, keyed by id (fixed pieces included). */
export type BoardPieces = Readonly<Partial<Record<PieceId, Placement>>>;

/** What a snap attached to — the readout names it (§10). */
export type SnapTarget = 'outline-vertex' | 'outline-edge' | 'piece-vertex' | 'piece-edge';

export interface SnapQuery {
  readonly id: PieceId;
  readonly orientation: Orientation;
  /** Where the wish puts local vertex 0, in units (floats). */
  readonly at: readonly [x: number, y: number];
  /** Units; the bound itself is inside. */
  readonly tolerance: number;
}

export interface SnapOutcome {
  readonly placement: Placement | null;
  readonly target: SnapTarget | null;
  /** Which phase found it: the vertex snap, or the edge snap after it. */
  readonly via: 'vertex' | 'edge' | null;
  /** Candidates found within the tolerance (both phases, when the edge phase ran). */
  readonly candidates: number;
  /** Exact checks spent. */
  readonly checks: number;
  /** True when the budget ran out before an answer: the "nothing" is the bound's. */
  readonly exhausted: boolean;
}

export const samePose = (a: Pose, b: Pose): boolean =>
  a.r === b.r && a.f === b.f && ptEq(a.at, b.at);

const poseKey = (o: Orientation, at: Pt): string => `${o.r}/${o.f}/${ptKey(at)}`;

/**
 * Whether `id` may stand at `pose` (§5「置ける姿」): every coordinate within
 * COORD_LIMIT, inside the silhouette, and overlapping no other piece on the
 * board (the piece's own current placement, if any, is ignored).
 */
export function isPlaceable(
  outline: readonly Pt[],
  board: BoardPieces,
  id: PieceId,
  pose: Pose,
): boolean {
  if (!isBoundedPoint(pose.at, COORD_LIMIT)) return false;
  const vertices = poseVertices(id, pose);
  if (!vertices.every((v) => isBoundedPoint(v, COORD_LIMIT))) return false;
  if (!convexInside(vertices, outline)) return false;
  for (const other of PIECE_IDS) {
    if (other === id) continue;
    const placed = board[other];
    if (placed && convexOverlap(vertices, poseVertices(other, placed))) return false;
  }
  return true;
}

interface Candidate {
  readonly d2: number;
  readonly seq: number;
  readonly at: Pt;
  readonly pv: Pt;
  readonly target: SnapTarget;
}

/**
 * Nearest first; squared distances within SNAP_EPS of the first of a run are
 * one tie, ordered by the fixed enumeration order (`seq`). Grouping from the
 * run's first element keeps the order total and the same on every engine.
 */
export function rankCandidates<T extends { readonly d2: number; readonly seq: number }>(
  candidates: readonly T[],
): T[] {
  const sorted = [...candidates].sort((a, b) => a.d2 - b.d2 || a.seq - b.seq);
  const ranked: T[] = [];
  let i = 0;
  while (i < sorted.length) {
    const anchor = sorted[i]!.d2;
    let j = i + 1;
    while (j < sorted.length && sorted[j]!.d2 - anchor <= SNAP_EPS) j++;
    ranked.push(...sorted.slice(i, j).sort((a, b) => a.seq - b.seq));
    i = j;
  }
  return ranked;
}

interface TargetVertex {
  readonly p: Pt;
  readonly f: readonly [number, number];
  readonly kind: 'outline-vertex' | 'piece-vertex';
}

interface TargetEdge {
  readonly a: Pt;
  readonly b: Pt;
  readonly kind: 'outline-edge' | 'piece-edge';
}

const outlineTickCache = new WeakMap<readonly Pt[], { a: Pt; b: Pt; ticks: Pt[] }[]>();

function ticksOfEdge(edge: TargetEdge, outline: readonly Pt[], index: number): Pt[] {
  if (edge.kind === 'outline-edge') {
    let cached = outlineTickCache.get(outline);
    if (!cached) {
      cached = outline.map((a, i) => {
        const b = outline[(i + 1) % outline.length]!;
        return { a, b, ticks: edgeTicks(a, b).map((t) => t.point) };
      });
      outlineTickCache.set(outline, cached);
    }
    return cached[index]!.ticks;
  }
  return edgeTicks(edge.a, edge.b).map((t) => t.point);
}

const d2Of = (x: number, y: number, f: readonly [number, number]): number =>
  (x - f[0]) * (x - f[0]) + (y - f[1]) * (y - f[1]);

/**
 * Snaps a wish to an exact placement, or to nothing (§5「吸着」). Never
 * throws; the carried piece's own board placement, if any, is not a target.
 */
export function snapPose(
  outline: readonly Pt[],
  board: BoardPieces,
  query: SnapQuery,
  limit: number = SNAP_CHECK_LIMIT,
): SnapOutcome {
  const { id, orientation: o } = query;
  const [wx, wy] = query.at;
  const reach = query.tolerance * query.tolerance + SNAP_EPS;
  const shape = orientedShape(id, o);
  const shapeF = shape.map(ptToFloat);

  const vertices: TargetVertex[] = outline.map((p) => ({
    p,
    f: ptToFloat(p),
    kind: 'outline-vertex',
  }));
  const edges: TargetEdge[] = outline.map((a, i) => ({
    a,
    b: outline[(i + 1) % outline.length]!,
    kind: 'outline-edge',
  }));
  for (const other of PIECE_IDS) {
    const placed = other === id ? undefined : board[other];
    if (!placed) continue;
    const vs = poseVertices(other, placed);
    vs.forEach((p, i) => {
      vertices.push({ p, f: ptToFloat(p), kind: 'piece-vertex' });
      edges.push({ a: p, b: vs[(i + 1) % vs.length]!, kind: 'piece-edge' });
    });
  }

  const checked = new Set<string>();
  let checks = 0;
  let candidates = 0;
  let found: SnapTarget | null = null;

  // Runs one phase; 'none' means the phase's candidates all failed.
  const run = (list: Candidate[]): Placement | 'none' | 'exhausted' => {
    candidates += list.length;
    for (const c of rankCandidates(list)) {
      const key = poseKey(o, c.at);
      if (checked.has(key)) continue;
      if (checks >= limit) return 'exhausted';
      checks++;
      checked.add(key);
      const pose: Placement = { r: o.r, f: o.f, at: c.at, pv: c.pv };
      if (isBoundedPoint(c.pv, COORD_LIMIT) && isPlaceable(outline, board, id, pose)) {
        found = c.target;
        return pose;
      }
    }
    return 'none';
  };
  const finish = (
    placement: Placement | null,
    exhausted: boolean,
    via: 'vertex' | 'edge' | null = null,
  ): SnapOutcome => ({
    placement,
    target: placement ? found : null,
    via: placement ? via : null,
    candidates,
    checks,
    exhausted,
  });

  // Vertex snap: carried corner i onto target corner t.
  const byVertex: Candidate[] = [];
  let seq = 0;
  shapeF.forEach((v, i) => {
    const x = wx + v[0];
    const y = wy + v[1];
    for (const t of vertices) {
      const d2 = d2Of(x, y, t.f);
      const s = seq++;
      if (d2 <= reach) {
        byVertex.push({ d2, seq: s, at: ptSub(t.p, shape[i]!), pv: t.p, target: t.kind });
      }
    }
  });
  const first = run(byVertex);
  if (first === 'exhausted') return finish(null, true);
  if (typeof first === 'object') return finish(first, false, 'vertex');

  // Edge snap (a): carried corner i onto a tick of target edge e.
  const byEdge: Candidate[] = [];
  shapeF.forEach((v, i) => {
    const x = wx + v[0];
    const y = wy + v[1];
    edges.forEach((edge, e) => {
      for (const tick of ticksOfEdge(edge, outline, e)) {
        const d2 = d2Of(x, y, ptToFloat(tick));
        const s = seq++;
        if (d2 <= reach) {
          byEdge.push({ d2, seq: s, at: ptSub(tick, shape[i]!), pv: tick, target: edge.kind });
        }
      }
    });
  });
  // Edge snap (b): a target corner onto a tick of carried edge j.
  shape.forEach((a, j) => {
    const ticks = edgeTicks(a, shape[(j + 1) % shape.length]!).map((t) => t.point);
    const ticksF = ticks.map(ptToFloat);
    for (const t of vertices) {
      ticks.forEach((tick, k) => {
        const tf = ticksF[k]!;
        const d2 = d2Of(wx + tf[0], wy + tf[1], t.f);
        const s = seq++;
        if (d2 <= reach) {
          byEdge.push({ d2, seq: s, at: ptSub(t.p, tick), pv: t.p, target: t.kind });
        }
      });
    }
  });
  const second = run(byEdge);
  if (second === 'exhausted') return finish(null, true);
  if (typeof second === 'object') return finish(second, false, 'edge');
  return finish(null, false);
}

// ---------------------------------------------------------------- pivots

/** The pivot in the piece's local frame, or null when it is off the turn lattice. */
export function localPivot(placement: Placement): Pt | null {
  return unorientChecked(ptSub(placement.pv, placement.at), placement);
}

/**
 * Whether a placement's pivot is one the rules allow (§5「支点」): a corner
 * of the piece, or a tick on one of its edges. Any other boundary point —
 * one unit along an axis edge, say — would take the next turn off Z[√2].
 */
export function isValidPivot(id: PieceId, placement: Placement): boolean {
  const local = localPivot(placement);
  if (!local) return false;
  const shape = LOCAL_SHAPES[id];
  return shape.some((v, i) => ptEq(v, local) || isTickOf(local, v, shape[(i + 1) % shape.length]!));
}

/**
 * The placement in orientation `o` that keeps the pivot where it is (§5),
 * or null when the pivot cannot be carried exactly. Not checked for room.
 */
export function turnAbout(placement: Placement, o: Orientation): Placement | null {
  const local = localPivot(placement);
  if (!local) return null;
  const oriented = turnChecked(o.f ? mirror(local) : local, o.r);
  if (!oriented) return null;
  return { r: o.r, f: o.f, at: ptSub(placement.pv, oriented), pv: placement.pv };
}

/** `at` that puts local vertex `index` of `id` on world point `target`. */
export const atForVertex = (id: PieceId, index: number, target: Pt, o: Orientation): Pt =>
  atFor(target, LOCAL_SHAPES[id][index]!, o);
