/**
 * Core Dominoes types. See docs/DOMINOES_RULES.md — the single source of
 * truth for the rules these shapes serve.
 *
 * A tile is two pip values, normalised so the smaller comes first (§1): the
 * set has one [3, 5] and no [5, 3], which is what lets "every tile exactly
 * once" be checked by identity. A tile only gets an orientation when it goes
 * down on the line, and the line keeps that orientation beside the tile
 * (`Placed`), so the pips read left to right exactly as they are drawn.
 */

/** Double-six: pip values 0 to 6 (§1). */
export const MAX_PIP = 6;
/** 28 tiles in a double-six set (§1). */
export const TILE_COUNT = 28;
/** Seven each to the two hands (§1). */
export const HAND_SIZE = 7;
/** What is left after the deal: the boneyard (§1). */
export const BONEYARD_SIZE = TILE_COUNT - 2 * HAND_SIZE;

export const PLAYER = 1;
export const CPU = 2;
export type Side = typeof PLAYER | typeof CPU;

export const opponentOf = (side: Side): Side => (side === PLAYER ? CPU : PLAYER);

/** Two pip values, smaller first (§1). */
export type Tile = readonly [number, number];

/** The two open ends of the line (§3). */
export type End = 'left' | 'right';

/**
 * A tile as it lies on the line: `left` and `right` are the pip values in the
 * order they are drawn, so the tile's neighbours touch it on matching pips.
 */
export interface Placed {
  readonly tile: Tile;
  readonly left: number;
  readonly right: number;
}

/** The line of play, from its left end to its right end. */
export type Line = readonly Placed[];

/** From the player's side of the table: 'won' means the player did (§4). */
export type GameStatus = 'playing' | 'won' | 'lost' | 'draw';

/**
 * How a finished game ended (§4): a side played its last tile, or both sides
 * passed in a row with the boneyard empty.
 */
export type Ending = 'out' | 'blocked';

/** Who put the first tile down, and which tile it was (§2). */
export interface Opening {
  readonly by: Side;
  readonly tile: Tile;
}
