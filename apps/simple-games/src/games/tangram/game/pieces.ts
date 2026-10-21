/**
 * The seven pieces, their local shapes, and how a pose places them
 * (docs/TANGRAM_RULES.md §5「駒」「姿」).
 *
 * Unit: half the small triangle's leg, so the small triangle's leg is 2.
 * With that unit every vertex of every piece lands on a point of Z[√2] in
 * all eight 45° turns (a leg of 1 would put √2/2 into a turned vertex).
 *
 * A pose is (r, f, at): world vertex i = at + Rʳ(Fᶠ(local vertex i)), where
 * F mirrors x → −x (the parallelogram only) and R turns 45° clockwise on
 * screen (y points down): R(x, y) = ((x − y)/√2, (x + y)/√2).
 */
import { ptAdd, ptKey, ptSub, type Pt } from './z2';

export type PieceId = 'L1' | 'L2' | 'M' | 'P' | 'SQ' | 'S1' | 'S2';

/**
 * The one order of the pieces: the tray's two rows (L1 L2 M P / SQ S1 S2),
 * the tie-break order of snap targets (§5「選び方」), and the order a record
 * lists the pieces in.
 */
export const PIECE_IDS: readonly PieceId[] = ['L1', 'L2', 'M', 'P', 'SQ', 'S1', 'S2'];

export const isPieceId = (value: unknown): value is PieceId =>
  typeof value === 'string' && (PIECE_IDS as readonly string[]).includes(value);

/** Only the parallelogram's mirror image is not one of its turns (§1, §5). */
export const canFlip = (id: PieceId): boolean => id === 'P';

/** The number of distinct 45° turns. */
export const TURNS = 8;

/**
 * Local shapes, vertex 0 at the origin, clockwise on screen (§5 の表).
 * A triangle's vertex 0 is its right angle; the parallelogram's is a 45° corner.
 */
export const LOCAL_SHAPES: Readonly<Record<PieceId, readonly Pt[]>> = {
  L1: [
    [0, 0, 0, 0],
    [4, 0, 0, 0],
    [0, 0, 4, 0],
  ],
  L2: [
    [0, 0, 0, 0],
    [4, 0, 0, 0],
    [0, 0, 4, 0],
  ],
  M: [
    [0, 0, 0, 0],
    [0, 2, 0, 0],
    [0, 0, 0, 2],
  ],
  P: [
    [0, 0, 0, 0],
    [2, 0, 0, 0],
    [4, 0, 2, 0],
    [2, 0, 2, 0],
  ],
  SQ: [
    [0, 0, 0, 0],
    [2, 0, 0, 0],
    [2, 0, 2, 0],
    [0, 0, 2, 0],
  ],
  S1: [
    [0, 0, 0, 0],
    [2, 0, 0, 0],
    [0, 0, 2, 0],
  ],
  S2: [
    [0, 0, 0, 0],
    [2, 0, 0, 0],
    [0, 0, 2, 0],
  ],
};

/** Each piece's area in square units (§5 の表); they sum to 32. */
export const PIECE_AREA: Readonly<Record<PieceId, number>> = {
  L1: 8,
  L2: 8,
  M: 4,
  P: 4,
  SQ: 4,
  S1: 2,
  S2: 2,
};

/** A turn and a side: what a piece in the tray keeps (§3). */
export interface Orientation {
  /** 0..7: 45° × r, clockwise on screen. */
  readonly r: number;
  /** 1 mirrors the piece; only the parallelogram is ever 1. */
  readonly f: 0 | 1;
}

/** Where a piece on the board is (§5「姿」). */
export interface Pose extends Orientation {
  /** Where local vertex 0 lands. */
  readonly at: Pt;
}

export const DEFAULT_ORIENTATION: Orientation = { r: 0, f: 0 };

/** One 45° turn, or null when the point is off the lattice the turn keeps exact. */
function turnOnce(p: Pt): Pt | null {
  const [x0, x1, y0, y1] = p;
  if ((x0 - y0) % 2 !== 0) return null;
  return [x1 - y1, (x0 - y0) / 2, x1 + y1, (x0 + y0) / 2];
}

/**
 * R²: a quarter turn clockwise on screen, (x, y) → (−y, x). Always exact.
 * Negation is written `0 - v` so that no part is ever −0 (records and
 * deep-equal comparisons then never see one).
 */
const quarter = (p: Pt): Pt => [0 - p[2], 0 - p[3], p[0], p[1]];

/**
 * Rᵏ(p) for any whole k (taken mod 8), or null when an odd k meets a point
 * whose rational parts differ in parity (the turn would leave Z[√2]).
 */
export function turnChecked(p: Pt, k: number): Pt | null {
  const steps = ((k % TURNS) + TURNS) % TURNS;
  let q = p;
  for (let i = 0; i < steps >> 1; i++) q = quarter(q);
  return steps % 2 === 1 ? turnOnce(q) : q;
}

/** Rᵏ(p) for a point known to be on the lattice (a local vertex or tick). */
export function turn(p: Pt, k: number): Pt {
  const q = turnChecked(p, k);
  if (!q) throw new Error(`turn: ${ptKey(p)} is off the turn lattice`);
  return q;
}

/** F: x → −x. */
export const mirror = (p: Pt): Pt => [0 - p[0], 0 - p[1], p[2], p[3]];

/** Rʳ(Fᶠ(p)): a local point in a pose's frame, before the shift by `at`. */
export const orient = (p: Pt, o: Orientation): Pt => turn(o.f ? mirror(p) : p, o.r);

/** The inverse of `orient`, or null off the lattice: Fᶠ(R⁻ʳ(p)). */
export function unorientChecked(p: Pt, o: Orientation): Pt | null {
  const q = turnChecked(p, TURNS - o.r);
  if (!q) return null;
  return o.f ? mirror(q) : q;
}

/** A piece's world vertices in a pose, in local order (clockwise on screen). */
export function poseVertices(id: PieceId, pose: Pose): Pt[] {
  return LOCAL_SHAPES[id].map((v) => ptAdd(pose.at, orient(v, pose)));
}

/** The oriented local vertices — the shape a pose shifts by `at`. */
export const orientedShape = (id: PieceId, o: Orientation): Pt[] =>
  LOCAL_SHAPES[id].map((v) => orient(v, o));

/** `at` that puts oriented local point `local` on world point `target`. */
export const atFor = (target: Pt, local: Pt, o: Orientation): Pt => ptSub(target, orient(local, o));

/** Whether an orientation is one a piece may take: r a whole 0..7, f 1 only for P. */
export function isOrientation(id: PieceId, r: unknown, f: unknown): boolean {
  return (
    typeof r === 'number' &&
    Number.isInteger(r) &&
    r >= 0 &&
    r < TURNS &&
    (f === 0 || (f === 1 && canFlip(id)))
  );
}
