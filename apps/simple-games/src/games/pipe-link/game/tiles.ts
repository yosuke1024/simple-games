/**
 * Tile types, orientations and rotation (docs/PIPE_LINK_RULES.md §1, §2).
 *
 * A tile is the set of sides it runs a pipe to, held as a 4-bit mask:
 * bit 0 = up, bit 1 = right, bit 2 = down, bit 3 = left (clockwise order, so
 * a clockwise quarter turn is a one-bit rotate left). Four types — end (1
 * pipe), straight (2, opposite), elbow (2, adjacent), tee (3) — and no cross.
 *
 * Orientation k is orientation 0 turned clockwise k times. A straight turned
 * 180° is the same pipe set, so it has 2 orientations and the others have 4:
 * orientation and pipe set are one-to-one, which is why solutions, saves and
 * the uniqueness count can all speak in orientation numbers.
 */

export type TileType = 'end' | 'straight' | 'elbow' | 'tee';

export const TILE_TYPES: readonly TileType[] = ['end', 'straight', 'elbow', 'tee'];

/** Direction indices, clockwise from up. The bit of direction d is `1 << d`. */
export const UP = 0;
export const RIGHT = 1;
export const DOWN = 2;
export const LEFT = 3;
export const DIRECTIONS: readonly number[] = [UP, RIGHT, DOWN, LEFT];

export function opposite(dir: number): number {
  return (dir + 2) & 3;
}

/** The pipe set of orientation 0 (§1's table). */
const BASE_MASK: Readonly<Record<TileType, number>> = {
  end: 0b0001, // up
  straight: 0b0101, // up + down
  elbow: 0b0011, // up + right
  tee: 0b0111, // up + right + down
};

const PERIOD: Readonly<Record<TileType, 2 | 4>> = { end: 4, straight: 2, elbow: 4, tee: 4 };

/** The one-letter code each type is saved as (§7). */
export const TYPE_CODE: Readonly<Record<TileType, string>> = {
  end: 'e',
  straight: 's',
  elbow: 'l',
  tee: 't',
};

/** Rotates a pipe mask a quarter turn clockwise: up → right → down → left → up. */
export function rotateMaskCw(mask: number): number {
  return ((mask << 1) | (mask >> 3)) & 0b1111;
}

/** How many distinct orientations a type has: 2 for a straight, 4 otherwise. */
export function periodOf(type: TileType): 2 | 4 {
  return PERIOD[type];
}

const MASKS: Readonly<Record<TileType, readonly number[]>> = (() => {
  const out = {} as Record<TileType, number[]>;
  for (const type of TILE_TYPES) {
    const list: number[] = [];
    let mask = BASE_MASK[type];
    for (let k = 0; k < PERIOD[type]; k++) {
      list.push(mask);
      mask = rotateMaskCw(mask);
    }
    out[type] = list;
  }
  return out;
})();

/** Every orientation's pipe mask, indexed by orientation. */
export function orientationMasks(type: TileType): readonly number[] {
  return MASKS[type];
}

export function isValidOrientation(type: TileType, orientation: number): boolean {
  return Number.isInteger(orientation) && orientation >= 0 && orientation < PERIOD[type];
}

/** The pipe mask of a type in an orientation. Throws on an orientation outside the type's period. */
export function pipeMask(type: TileType, orientation: number): number {
  const mask = MASKS[type][orientation];
  if (mask === undefined || !Number.isInteger(orientation)) {
    throw new RangeError(`orientation ${orientation} is not one of ${type}'s ${PERIOD[type]}`);
  }
  return mask;
}

export function hasPipe(mask: number, dir: number): boolean {
  return (mask & (1 << dir)) !== 0;
}

/** A quarter turn clockwise (a tap — §3). */
export function rotateCw(type: TileType, orientation: number): number {
  return (orientation + 1) % PERIOD[type];
}

/** A quarter turn counter-clockwise (right click / Shift+Enter — §3): the inverse of `rotateCw`. */
export function rotateCcw(type: TileType, orientation: number): number {
  const period = PERIOD[type];
  return (orientation + period - 1) % period;
}

function popcount4(mask: number): number {
  let n = 0;
  for (let m = mask & 0b1111; m !== 0; m &= m - 1) n++;
  return n;
}

/**
 * The type and orientation whose pipe set is `mask`, or null for a mask that
 * is no tile (no pipe, or a cross). Used to read a spanning tree's degrees as
 * tiles (§4 step 1).
 */
export function tileOfMask(mask: number): { type: TileType; orientation: number } | null {
  if (!Number.isInteger(mask) || mask < 1 || mask > 0b1110) return null;
  const pipes = popcount4(mask);
  let type: TileType;
  if (pipes === 1) type = 'end';
  else if (pipes === 3) type = 'tee';
  else if (pipes === 2) type = mask === 0b0101 || mask === 0b1010 ? 'straight' : 'elbow';
  else return null;
  const orientation = MASKS[type].indexOf(mask);
  return orientation < 0 ? null : { type, orientation };
}
