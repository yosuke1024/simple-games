/**
 * What reading a save costs (docs/CHESS_RULES.md §7.1, §13). A save is
 * replayed move by move, so its cost grows with the game's length; this file
 * builds games far longer than real play and times their replay.
 *
 * The gate is the replay's correctness and its length, never the clock:
 * wall-clock time is printed and not asserted (docs/ARCHITECTURE.md
 * 「CI / リリース」).
 *
 * The long games come from a deliberately stubborn player: while the
 * fifty-move count allows, it plays a quiet piece move that neither ends the
 * game nor repeats a position; when the count runs out it plays a pawn move,
 * then a capture, whichever does not end the game. It is not trying to reach
 * the 12,700-ply bound (§7.1) — that bound is arithmetic and no game comes
 * near it — only to give the replay thousands of plies to read.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { toFen } from './fen';
import { createGame, playMove, undoMove, type Game } from './record';
import { createRng, shuffled } from './rng';
import { countRepetitions } from './rules';
import { decodeMoveList, encodeMoveList } from './serialize';
import { FIFTY_MOVE_PLIES, KING, PAWN, isCapture, kindOf, moveFrom, type Move } from './types';

/** Plays the first of `moves` that keeps the game going (and, when `fresh`, does not repeat). */
function playFirstThatContinues(game: Game, moves: readonly Move[], fresh: boolean): boolean {
  for (const move of moves) {
    playMove(game, move);
    const repeats = countRepetitions(game.history, game.position.halfmoveClock) > 1;
    if (game.outcome === null && !(fresh && repeats)) return true;
    undoMove(game);
  }
  return false;
}

function longGame(seed: string, cap: number): Game {
  const rng = createRng(seed);
  const game = createGame();
  while (game.outcome === null && game.moves.length < cap) {
    const board = game.position.board;
    const moves = shuffled(game.legal, rng);
    const quiet = moves.filter(
      (move) => !isCapture(move) && kindOf(board[moveFrom(move)]!) !== PAWN,
    );
    const pawn = moves.filter(
      (move) => !isCapture(move) && kindOf(board[moveFrom(move)]!) === PAWN,
    );
    const captures = moves.filter(
      (move) => isCapture(move) && kindOf(board[moveFrom(move)]!) !== KING,
    );
    if (
      game.position.halfmoveClock < FIFTY_MOVE_PLIES - 2 &&
      playFirstThatContinues(game, quiet, true)
    ) {
      continue;
    }
    if (playFirstThatContinues(game, pawn, false)) continue;
    if (playFirstThatContinues(game, captures, false)) continue;
    if (playFirstThatContinues(game, moves, false)) continue;
    playMove(game, moves[0]!); // every move ends the game: play one and stop
  }
  return game;
}

interface Measured {
  readonly seed: string;
  readonly plies: number;
  readonly chars: number;
  readonly buildMs: number;
  readonly replayMs: number;
  readonly matches: boolean;
}

const SEEDS = ['chess-long-0', 'chess-long-1', 'chess-long-2'];
/** A guard on the generator, far above what it reaches — not a target. */
const CAP = 12_000;
const measured: Measured[] = [];

beforeAll(() => {
  for (const seed of SEEDS) {
    const built = performance.now();
    const game = longGame(seed, CAP);
    const buildMs = performance.now() - built;
    const text = encodeMoveList(game.moves);
    const started = performance.now();
    const replayed = decodeMoveList(text);
    const replayMs = performance.now() - started;
    measured.push({
      seed,
      plies: game.moves.length,
      chars: text.length,
      buildMs,
      replayMs,
      matches:
        replayed !== null &&
        toFen(replayed.position) === toFen(game.position) &&
        JSON.stringify(replayed.outcome) === JSON.stringify(game.outcome),
    });
  }
}, 120_000);

describe('replaying long saves', () => {
  it('replays each long game to the same position and ending', () => {
    for (const result of measured) expect(result.matches).toBe(true);
  });

  it('builds games much longer than real play — thousands of plies', () => {
    for (const result of measured) expect(result.plies).toBeGreaterThan(2_000);
  });

  it('builds the lengths §13 states — the generator is seeded, so they are the same everywhere', () => {
    expect(measured.map((result) => result.plies)).toEqual(LONG_GAME_PLIES);
    expect(measured.map((result) => result.chars)).toEqual(LONG_GAME_CHARS);
  });

  it('reports what the replay took in wall-clock, without judging it', () => {
    for (const result of measured) {
      console.log(
        `chess replay ${result.seed}: ${result.plies} plies (${result.chars} chars) replayed in ` +
          `${result.replayMs.toFixed(1)}ms (${((result.replayMs * 1000) / result.plies).toFixed(1)}µs a ply; ` +
          `built in ${result.buildMs.toFixed(0)}ms) — reported, not asserted`,
      );
    }
    expect(measured).toHaveLength(SEEDS.length);
  });
});

/* The measured lengths (§13). Deterministic: the same on every machine. */
const LONG_GAME_PLIES: number[] = [6_139, 8_523, 5_927];
const LONG_GAME_CHARS: number[] = [30_701, 42_623, 29_638];
