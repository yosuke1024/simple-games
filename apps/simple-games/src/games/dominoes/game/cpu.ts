/**
 * The opponent — and, before that, **what the opponent can see**
 * (docs/DOMINOES_RULES.md §5, §6).
 *
 * The player's hand and the boneyard are hidden, and a CPU that peeked at
 * either could never be caught at it by playing against it. So the question
 * is settled in the type system, the way Gin Rummy settles it
 * (docs/GIN_RUMMY_RULES.md §5): everything this file reads arrives as a
 * `CpuView`, and a `CpuView` has nowhere to put the player's tiles or the
 * boneyard's order. `buildCpuView` is the only bridge from a session, it
 * copies rather than shares, and its test swaps every hidden tile to prove
 * neither the view nor the choice moves.
 *
 * The seed never reaches this file either. Ties need a coin, so the caller
 * hands in one random stream of its own (`${seed}:cpu:${moveCount}`,
 * game/session.ts) — a coin, not a key to the deal.
 *
 * One strength (§5): of the tiles that fit, the heaviest, with a double worth
 * three pips more — doubles are the hardest tiles to get rid of later. There
 * is no search and no difficulty tier; a random-move CPU is not an easier
 * opponent, only a duller one.
 */
import { distinctEnds, isDouble, pipsOf } from './engine';
import { shuffled } from './rng';
import type { End, Line, Tile } from './types';

/**
 * Everything the CPU is allowed to know. There is deliberately no field for
 * the player's tiles or for the boneyard's order: add one and the peeking is
 * visible in the diff, which is the whole point of the type existing.
 */
export interface CpuView {
  /** The CPU's own tiles. */
  readonly hand: readonly Tile[];
  /** The line of play, face up for both sides. */
  readonly line: Line;
  /** How many tiles are face down in the boneyard — not which, not in what order. */
  readonly boneyardCount: number;
  /** How many tiles the player holds. Never which ones. */
  readonly opponentTileCount: number;
}

/**
 * The one bridge from a full position to the view. Copies rather than
 * references, so a view can never be walked back to the session it came from.
 */
export function buildCpuView(
  hand: readonly Tile[],
  line: Line,
  boneyardCount: number,
  opponentTileCount: number,
): CpuView {
  return {
    hand: hand.map((tile) => [tile[0], tile[1]] as const),
    line: line.map((placed) => ({ ...placed })),
    boneyardCount,
    opponentTileCount,
  };
}

/** One action of a turn (§3): a tile on an end, one tile drawn, or a pass. */
export type CpuAction =
  | { readonly kind: 'play'; readonly tile: Tile; readonly end: End }
  | { readonly kind: 'draw' }
  | { readonly kind: 'pass' };

/** A double is worth three more pips to the CPU than its face (§5). */
export const DOUBLE_BONUS = 3;

/** How much the CPU wants to be rid of a tile (§5). */
export const tileWeight = (tile: Tile): number =>
  pipsOf(tile) + (isDouble(tile) ? DOUBLE_BONUS : 0);

/**
 * The CPU's next action (§5). A tile that fits is always played — the rules
 * forbid drawing with a legal play in hand (§3) — and among them the heaviest
 * wins, equal weights settled by a seeded shuffle. With nothing that fits it
 * draws one tile while the boneyard has any, and passes when it has none.
 */
export function chooseCpuMove(view: CpuView, rng: () => number): CpuAction {
  const candidates: { tile: Tile; end: End; weight: number }[] = [];
  for (const tile of view.hand) {
    for (const end of distinctEnds(view.line, tile)) {
      candidates.push({ tile, end, weight: tileWeight(tile) });
    }
  }
  if (candidates.length > 0) {
    // Shuffle first, then sort by weight: the sort is stable, so equal
    // weights keep their shuffled order and ties vary per seed and move.
    const best = shuffled(candidates, rng).sort((a, b) => b.weight - a.weight)[0]!;
    return { kind: 'play', tile: best.tile, end: best.end };
  }
  return view.boneyardCount > 0 ? { kind: 'draw' } : { kind: 'pass' };
}
