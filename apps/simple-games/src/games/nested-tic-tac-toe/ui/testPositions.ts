/**
 * Test-only positions for the screen tests (NestedTicTacToeRoot*.test.tsx):
 * saved records to launch onto, found the way game/engine.test.ts finds its
 * rare shapes — the first match among seeded random games — so they are
 * deterministic, and a test fails loudly if the search ever stops finding one.
 * Not imported by any shipped module.
 */
import {
  CIRCLE,
  createRng,
  CROSS,
  DRAWN,
  isOver,
  legalMoves,
  makeMove,
  newPosition,
  playerMarkOf,
  positionFromMoves,
  restoreSession,
  toMove,
  toSavedGame,
  unmakeMove,
  type Difficulty,
  type Mark,
  type Position,
  type Result,
} from '../game';

export const UI_SEED = 'nested-tic-tac-toe-uitest';

/** A saved record of `moves`, as `nt.saveGame` holds it. */
export function savedRecord(
  moves: readonly number[],
  { playerGoesFirst = true, difficulty = 'easy' as Difficulty, elapsedSeconds = 0 } = {},
): string {
  const session = restoreSession({
    seed: UI_SEED,
    difficulty,
    playerGoesFirst,
    moves,
    elapsedSeconds,
  });
  if (session === null) throw new Error(`not a resumable list: ${moves.join(',')}`);
  return JSON.stringify(toSavedGame(session, 1));
}

/** The first move the side to move could play that ends the match with `result`, or null. */
function finishingMove(position: Position, result: Result): number | null {
  for (const cell of legalMoves(position)) {
    makeMove(position, cell);
    const hit = position.result === result;
    unmakeMove(position);
    if (hit) return cell;
  }
  return null;
}

export interface FoundPosition {
  /** The moves that lead there — the match is still going. */
  readonly moves: readonly number[];
  /** The cell that finishes it the way asked for. */
  readonly cell: number;
}

/**
 * The first position, over seeded random games, where `mover` is to move and
 * has a move that ends the match with `result`.
 */
export function findFinishing(mover: Mark, result: Result): FoundPosition {
  for (let seed = 1; seed <= 5000; seed++) {
    const rng = createRng(`nt-ui-${seed}`);
    const position = newPosition();
    while (!isOver(position)) {
      if (toMove(position) === mover) {
        const cell = finishingMove(position, result);
        if (cell !== null) return { moves: [...position.moves], cell };
      }
      const legal = legalMoves(position);
      makeMove(position, legal[Math.floor(rng() * legal.length)]!);
    }
  }
  throw new Error('no such position in 5000 seeded games');
}

/**
 * The first position where cross (the player, moving first) can take a small
 * board without ending the match — the `select` + `match` move of §10.
 */
export function playerTakesWith(): FoundPosition {
  for (let seed = 1; seed <= 5000; seed++) {
    const rng = createRng(`nt-ui-take-${seed}`);
    const position = newPosition();
    while (!isOver(position)) {
      if (toMove(position) === CROSS) {
        for (const cell of legalMoves(position)) {
          const board = Math.floor(cell / 9);
          makeMove(position, cell);
          const took = position.smalls[board] === CROSS && !isOver(position);
          unmakeMove(position);
          if (took) return { moves: [...position.moves], cell };
        }
      }
      const legal = legalMoves(position);
      makeMove(position, legal[Math.floor(rng() * legal.length)]!);
    }
  }
  throw new Error('no such position in 5000 seeded games');
}

/** The player (cross, moving first) wins with `cell`. */
export const playerWinsWith = (): FoundPosition => findFinishing(CROSS, CROSS);
/** The CPU (circle, the player moving first) is to move and can win at once. */
export const cpuCanWin = (): FoundPosition => findFinishing(CIRCLE, CIRCLE);
/** The player (cross) ends the match drawn with `cell`. */
export const playerDrawsWith = (): FoundPosition => findFinishing(CROSS, DRAWN);

/**
 * Cross takes small board 0 with its own move into place 0 (1, 9, 2, 18, 0 —
 * the example of game/engine.test.ts), sending circle to the board it just
 * closed: circle — the player, moving second — has a free move.
 */
export const FREE_MOVE_FOR_SECOND = [1, 9, 2, 18, 0] as const;

/** Sanity: the side to move after `moves` is the player's, for the given side choice. */
export function playerToMove(moves: readonly number[], playerGoesFirst: boolean): boolean {
  const position = positionFromMoves(moves);
  return position !== null && toMove(position) === playerMarkOf(playerGoesFirst);
}
