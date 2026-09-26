/**
 * The saved position, checked (docs/DOMINOES_RULES.md §9).
 *
 * A tile is stored as its two pips: `[a, b]` smaller first in the hands and
 * the boneyard, and `[left, right]` as it lies on the line. Decoding fails
 * closed — a position the rules could not have produced from its own seed is
 * discarded and the player goes back to the home screen rather than into an
 * invented game:
 *
 * - every one of the 28 tiles appears exactly once across the line, the two
 *   hands and the boneyard;
 * - the line joins on matching pips all the way along;
 * - the boneyard is what the seed's deal left after the draws so far — the
 *   same tiles in the same order, drawn from the front — and the line still
 *   holds the seed's opening tile, so the game resumed is the game dealt;
 * - the pass counter, the move count and — before the opening is answered —
 *   the side to move agree with the position (a pass needs an empty
 *   boneyard; every play, draw and pass is one move);
 * - neither hand is empty and the game is not blocked — a finished game is
 *   not something to come back to (the loader checks that last part through
 *   the restored status).
 */
import { dealFromSeed, findOpening, isConnected, isTile, sameTile, tileId } from './engine';
import { PASSES_TO_BLOCK, type RestoredFields } from './session';
import {
  BONEYARD_SIZE,
  CPU,
  MAX_PIP,
  PLAYER,
  TILE_COUNT,
  type Line,
  type Placed,
  type Side,
  type Tile,
} from './types';

/** Two pips, as stored. */
export type StoredTile = [number, number];

export const encodeTiles = (tiles: readonly Tile[]): StoredTile[] =>
  tiles.map((tile) => [tile[0], tile[1]]);

export const encodeLine = (line: Line): StoredTile[] =>
  line.map((placed) => [placed.left, placed.right]);

/** A hand or the boneyard: every entry a real tile, written smaller first. */
export function decodeTiles(raw: readonly StoredTile[]): Tile[] | null {
  const tiles: Tile[] = [];
  for (const entry of raw) {
    if (!isTile(entry)) return null;
    tiles.push([entry[0], entry[1]]);
  }
  return tiles;
}

const isPip = (value: number): boolean => Number.isInteger(value) && value >= 0 && value <= MAX_PIP;

/**
 * The line: every entry a real tile in either orientation, each touching the
 * next on matching pips.
 */
export function decodeLine(raw: readonly StoredTile[]): Line | null {
  const line: Placed[] = [];
  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length !== 2) return null;
    const [left, right] = entry;
    if (!isPip(left) || !isPip(right)) return null;
    const tile: Tile = left <= right ? [left, right] : [right, left];
    line.push({ tile, left, right });
  }
  return line.length > 0 && isConnected(line) ? line : null;
}

export interface StoredPosition {
  readonly seed: string;
  readonly line: readonly StoredTile[];
  readonly playerHand: readonly StoredTile[];
  readonly cpuHand: readonly StoredTile[];
  readonly boneyard: readonly StoredTile[];
  readonly toMove: Side;
  readonly passes: number;
  readonly moveCount: number;
  readonly elapsedSeconds: number;
}

/**
 * The position a save describes, or null when it could not have come from
 * play (§9). The returned fields are what `restoreSession` rebuilds from.
 */
export function decodePosition(stored: StoredPosition): RestoredFields | null {
  if (stored.toMove !== PLAYER && stored.toMove !== CPU) return null;
  const line = decodeLine(stored.line);
  const playerHand = decodeTiles(stored.playerHand);
  const cpuHand = decodeTiles(stored.cpuHand);
  const boneyard = decodeTiles(stored.boneyard);
  if (line === null || playerHand === null || cpuHand === null || boneyard === null) return null;

  // The whole set, each tile once: 28 entries and 28 distinct identities.
  const all = [...line.map((placed) => placed.tile), ...playerHand, ...cpuHand, ...boneyard];
  if (all.length !== TILE_COUNT) return null;
  if (new Set(all.map(tileId)).size !== TILE_COUNT) return null;

  // A game that has ended is not resumed (§4, §9).
  if (playerHand.length === 0 || cpuHand.length === 0) return null;
  if (!Number.isInteger(stored.passes) || stored.passes < 0 || stored.passes >= PASSES_TO_BLOCK) {
    return null;
  }
  // A pass is only ever made with nothing left to draw (§3).
  if (stored.passes > 0 && boneyard.length > 0) return null;

  // The seed deals this game: the boneyard is the deal's, less the tiles
  // drawn from its front, and the opening tile is still on the line (§1, §2).
  const deal = dealFromSeed(stored.seed);
  const drawn = BONEYARD_SIZE - boneyard.length;
  if (drawn < 0) return null;
  const expected = deal.boneyard.slice(drawn);
  if (!boneyard.every((tile, i) => sameTile(tile, expected[i]!))) return null;
  const opening = findOpening(deal.playerHand, deal.cpuHand);
  if (!line.some((placed) => sameTile(placed.tile, opening.tile))) return null;
  // Before the first answer to the opening, only the side facing it has
  // acted — drawing keeps the turn, and the one pass it can make hands the
  // turn back to the opener — so whose move it is follows from the passes.
  if (line.length === 1) {
    const facing = opening.by === PLAYER ? CPU : PLAYER;
    if (stored.toMove !== (stored.passes === 0 ? facing : opening.by)) return null;
  }

  // Every action is one move (session.ts): the opening and each later play
  // put one tile on the line, each draw takes one off the boneyard, and each
  // pass is a move of its own. Passes that were answered by a play are gone
  // from the counter, but every one of them was answered by a play, so there
  // can be no more of them than plays after the opening. A count outside that
  // range could not have come from play — and the move count is half of the
  // CPU's tie-break (§5), so a wrong one would resume a different game.
  const least = line.length + drawn + stored.passes;
  const most = least + (line.length - 1);
  if (!Number.isInteger(stored.moveCount) || stored.moveCount < least || stored.moveCount > most) {
    return null;
  }

  return {
    seed: stored.seed,
    line,
    playerHand,
    cpuHand,
    boneyard,
    toMove: stored.toMove,
    passes: stored.passes,
    moveCount: stored.moveCount,
    elapsedSeconds: stored.elapsedSeconds,
  };
}
