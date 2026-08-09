/**
 * Core Mahjong Solitaire types. See docs/MAHJONG_SOLITAIRE_RULES.md — the
 * single source of truth for the rules these shapes serve.
 *
 * A tile position lives on a half-tile grid: x and y are half-units (a tile
 * spans 2×2 of them, so neighbouring tiles may overlap by half a tile), z is
 * the layer. Matching works on *match units*, not raw faces: every ordinary
 * face matches only itself, but any flower matches any flower and any season
 * matches any season (§2) — which is why the parity invariant of §1 is stated
 * per unit, never per face.
 */

/** The 42 faces of the standard set (§1). */
export type TileFace =
  // characters (萬子) — kanji numeral over 萬
  | 'c1'
  | 'c2'
  | 'c3'
  | 'c4'
  | 'c5'
  | 'c6'
  | 'c7'
  | 'c8'
  | 'c9'
  // dots (筒子) — circles
  | 'o1'
  | 'o2'
  | 'o3'
  | 'o4'
  | 'o5'
  | 'o6'
  | 'o7'
  | 'o8'
  | 'o9'
  // bamboo (索子) — rods
  | 'b1'
  | 'b2'
  | 'b3'
  | 'b4'
  | 'b5'
  | 'b6'
  | 'b7'
  | 'b8'
  | 'b9'
  // winds — 東南西北
  | 'we'
  | 'ws'
  | 'ww'
  | 'wn'
  // dragons — red 中, green 發, white (frame)
  | 'dr'
  | 'dg'
  | 'dw'
  // flowers and seasons — bonus groups, four distinct faces each
  | 'f1'
  | 'f2'
  | 'f3'
  | 'f4'
  | 's1'
  | 's2'
  | 's3'
  | 's4';

/** The 34 ordinary faces — the ones a standard set holds four copies of. */
export const ORDINARY_FACES: readonly TileFace[] = [
  'c1',
  'c2',
  'c3',
  'c4',
  'c5',
  'c6',
  'c7',
  'c8',
  'c9',
  'o1',
  'o2',
  'o3',
  'o4',
  'o5',
  'o6',
  'o7',
  'o8',
  'o9',
  'b1',
  'b2',
  'b3',
  'b4',
  'b5',
  'b6',
  'b7',
  'b8',
  'b9',
  'we',
  'ws',
  'ww',
  'wn',
  'dr',
  'dg',
  'dw',
];

export const FLOWER_FACES: readonly TileFace[] = ['f1', 'f2', 'f3', 'f4'];
export const SEASON_FACES: readonly TileFace[] = ['s1', 's2', 's3', 's4'];

/**
 * What a face matches as (§2). Ordinary faces are their own unit; the four
 * flowers are one unit, the four seasons another. Stating parity per unit is
 * what lets the standard set be valid at all — per-face parity would damn the
 * eight bonus tiles, which exist once each (§1).
 */
export type MatchUnit = TileFace | 'flower' | 'season';

export function matchUnit(face: TileFace): MatchUnit {
  if (face[0] === 'f') return 'flower';
  if (face[0] === 's') return 'season';
  return face;
}

/** Two tiles may be removed together when their units agree (§2). */
export function facesMatch(a: TileFace, b: TileFace): boolean {
  return matchUnit(a) === matchUnit(b);
}

export type GameMode = 'level' | 'daily';

/** Winning is removing everything; stuck is a derived fact, not a status (§7). */
export type GameStatus = 'playing' | 'won';

/**
 * A level's tile stock: how many copies of each face this board may contain.
 * Small levels deal a subset of the standard set (§1); the stock is what
 * `isValidBoard` measures a board against.
 */
export type FaceStock = ReadonlyMap<TileFace, number>;

/**
 * The two-stage board invariant (§1, §5 — and the reason fail-closed saving
 * can be honest):
 *
 *   1. No face appears more often than the stock holds. Parity alone would
 *      accept two of the same flower, or six of one ordinary face — boards no
 *      deal of this level could ever produce.
 *   2. Per match unit, the number of REMAINING tiles is even. The stock per
 *      unit is even by construction, so a legal history (pairs removed two at
 *      a time within one unit) always leaves even remainders.
 *
 * Geometry (which removals were possible) is deliberately not checked here —
 * the persisted form cannot express a mis-placed face at all, and impossible
 * removal orders are caught by replay (serialize.ts).
 */
export function isValidBoard(
  faces: readonly TileFace[],
  remaining: readonly boolean[],
  stock: FaceStock,
): boolean {
  if (faces.length !== remaining.length) return false;
  const total = new Map<TileFace, number>();
  const remainingPerUnit = new Map<MatchUnit, number>();
  for (let i = 0; i < faces.length; i++) {
    const face = faces[i]!;
    total.set(face, (total.get(face) ?? 0) + 1);
    if (remaining[i]) {
      const unit = matchUnit(face);
      remainingPerUnit.set(unit, (remainingPerUnit.get(unit) ?? 0) + 1);
    }
  }
  for (const [face, count] of total) {
    if (count > (stock.get(face) ?? 0)) return false;
  }
  for (const count of remainingPerUnit.values()) {
    if (count % 2 !== 0) return false;
  }
  return true;
}
