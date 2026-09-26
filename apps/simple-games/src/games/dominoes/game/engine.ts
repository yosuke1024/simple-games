/**
 * The set, the deal and the line (docs/DOMINOES_RULES.md §1–§3). Pure
 * functions over plain arrays — no identity, no time; the only randomness is
 * the seeded shuffle of the deal.
 */
import { createRng, shuffled } from './rng';
import {
  CPU,
  HAND_SIZE,
  MAX_PIP,
  PLAYER,
  type End,
  type Line,
  type Opening,
  type Placed,
  type Tile,
} from './types';

/** The tile with these two pips, smaller first (§1). */
export const makeTile = (a: number, b: number): Tile => (a <= b ? [a, b] : [b, a]);

/**
 * The whole double-six set in one fixed order — [0,0], [0,1] … [0,6], [1,1] …
 * [6,6]. The deal shuffles this list, so its order is part of every board
 * ever dealt: it is pinned by game/compatibility.test.ts.
 */
export const ALL_TILES: readonly Tile[] = (() => {
  const tiles: Tile[] = [];
  for (let a = 0; a <= MAX_PIP; a++) {
    for (let b = a; b <= MAX_PIP; b++) tiles.push([a, b]);
  }
  return tiles;
})();

/** A number per tile, for sets: [a, b] → a × 7 + b. */
export const tileId = (tile: Tile): number => tile[0] * (MAX_PIP + 1) + tile[1];

export const sameTile = (a: Tile, b: Tile): boolean => a[0] === b[0] && a[1] === b[1];

export const isDouble = (tile: Tile): boolean => tile[0] === tile[1];

/** The pips on one tile. */
export const pipsOf = (tile: Tile): number => tile[0] + tile[1];

/** The pips on a whole hand — what a hand is worth at the end (§4). */
export const pipTotal = (tiles: readonly Tile[]): number =>
  tiles.reduce((sum, tile) => sum + pipsOf(tile), 0);

const isPip = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_PIP;

/** A real tile of the set, written smaller-first. */
export function isTile(value: unknown): value is Tile {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    isPip(value[0]) &&
    isPip(value[1]) &&
    value[0] <= value[1]
  );
}

/** Orders a hand for reading: by the smaller pip, then the larger. */
export const sortTiles = (tiles: readonly Tile[]): Tile[] =>
  [...tiles].sort((a, b) => tileId(a) - tileId(b));

export interface Deal {
  readonly playerHand: readonly Tile[];
  readonly cpuHand: readonly Tile[];
  /** Drawn from the front (§3). */
  readonly boneyard: readonly Tile[];
}

/**
 * The deal for a seed (§1): the set shuffled once, seven to the player, seven
 * to the CPU, fourteen face down in the order they will be drawn. The hands
 * are sorted for reading; the boneyard keeps its shuffled order.
 */
export function dealFromSeed(seed: string): Deal {
  const deck = shuffled(ALL_TILES, createRng(seed));
  return {
    playerHand: sortTiles(deck.slice(0, HAND_SIZE)),
    cpuHand: sortTiles(deck.slice(HAND_SIZE, 2 * HAND_SIZE)),
    boneyard: deck.slice(2 * HAND_SIZE),
  };
}

/**
 * Which of two tiles opens ahead of the other (§2): any double beats any
 * non-double, a higher double beats a lower one, and between non-doubles the
 * heavier tile wins, the larger pip breaking a tie. Two distinct tiles never
 * compare equal — the same sum and the same larger pip is the same tile.
 */
function opensBefore(a: Tile, b: Tile): boolean {
  if (isDouble(a) !== isDouble(b)) return isDouble(a);
  if (pipsOf(a) !== pipsOf(b)) return pipsOf(a) > pipsOf(b);
  return a[1] > b[1];
}

/**
 * Who opens and with what (§2): the highest double in either hand; with no
 * double dealt, the heaviest tile.
 */
export function findOpening(playerHand: readonly Tile[], cpuHand: readonly Tile[]): Opening {
  let best: Opening | null = null;
  for (const [by, hand] of [
    [PLAYER, playerHand],
    [CPU, cpuHand],
  ] as const) {
    for (const tile of hand) {
      if (best === null || opensBefore(tile, best.tile)) best = { by, tile };
    }
  }
  if (best === null) throw new Error('findOpening needs at least one tile');
  return best;
}

export interface LineEnds {
  readonly left: number;
  readonly right: number;
}

/** The two open pip values: the left of the first tile, the right of the last. */
export function lineEnds(line: Line): LineEnds | null {
  const first = line[0];
  const last = line[line.length - 1];
  if (!first || !last) return null;
  return { left: first.left, right: last.right };
}

/**
 * The ends `tile` can go on (§3). On an empty line a tile can only start it,
 * which the rules only ever do at the opening, so the answer is the right.
 */
export function legalEnds(line: Line, tile: Tile): End[] {
  const ends = lineEnds(line);
  if (ends === null) return ['right'];
  const out: End[] = [];
  if (tile[0] === ends.left || tile[1] === ends.left) out.push('left');
  if (tile[0] === ends.right || tile[1] === ends.right) out.push('right');
  return out;
}

/**
 * The ends worth choosing between (§3). When both ends show the same pips the
 * two placements leave the same line ends, so there is nothing to choose and
 * the tile goes on the right — the rule the screen follows without asking.
 */
export function distinctEnds(line: Line, tile: Tile): End[] {
  const ends = legalEnds(line, tile);
  const values = lineEnds(line);
  if (ends.length === 2 && values !== null && values.left === values.right) return ['right'];
  return ends;
}

/** Whether placing `tile` needs the player to say which end (§3, §11). */
export const needsEndChoice = (line: Line, tile: Tile): boolean =>
  distinctEnds(line, tile).length === 2;

/** Whether any tile in `hand` fits either end (§3). */
export const hasLegalPlay = (line: Line, hand: readonly Tile[]): boolean =>
  hand.some((tile) => legalEnds(line, tile).length > 0);

/**
 * `tile` placed on `end`, turned so its matching pip touches the line. Null
 * when it does not fit there. The first tile of a line lies as it is written.
 */
export function placeTile(line: Line, tile: Tile, end: End): Line | null {
  const ends = lineEnds(line);
  if (ends === null) return [{ tile, left: tile[0], right: tile[1] }];
  let placed: Placed;
  if (end === 'right') {
    const match = ends.right;
    if (tile[0] === match) placed = { tile, left: tile[0], right: tile[1] };
    else if (tile[1] === match) placed = { tile, left: tile[1], right: tile[0] };
    else return null;
    return [...line, placed];
  }
  const match = ends.left;
  if (tile[1] === match) placed = { tile, left: tile[0], right: tile[1] };
  else if (tile[0] === match) placed = { tile, left: tile[1], right: tile[0] };
  else return null;
  return [placed, ...line];
}

/** Every tile of the line joins its neighbour on matching pips. */
export function isConnected(line: Line): boolean {
  for (let i = 0; i + 1 < line.length; i++) {
    if (line[i]!.right !== line[i + 1]!.left) return false;
  }
  return true;
}

/** Removes one tile from a hand. Null when the hand does not hold it. */
export function withoutTile(hand: readonly Tile[], tile: Tile): Tile[] | null {
  const index = hand.findIndex((held) => sameTile(held, tile));
  if (index < 0) return null;
  return [...hand.slice(0, index), ...hand.slice(index + 1)];
}
