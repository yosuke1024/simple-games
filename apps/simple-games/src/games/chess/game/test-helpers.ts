/**
 * Test-only helpers for the rule tests (docs/CHESS_RULES.md §12). Nothing in
 * the game imports this file.
 */
import { generateLegalMoves, makeMove, type Position } from './engine';
import { parseFen } from './fen';
import { createGame, findMove, playMove, type Game } from './record';
import { createRng } from './rng';
import { moveToUci, parseUci } from './serialize';
import type { Move } from './types';

export function fen(text: string): Position {
  const position = parseFen(text);
  if (position === null) throw new Error(`bad FEN: ${text}`);
  return position;
}

/** The legal moves in UCI, sorted. */
export const legalUci = (position: Position): string[] =>
  generateLegalMoves(position).map(moveToUci).sort();

/** The legal move written `uci`; throws when there is none. */
export function legalMove(position: Position, uci: string): Move {
  const move = generateLegalMoves(position).find((candidate) => moveToUci(candidate) === uci);
  if (move === undefined) throw new Error(`not legal here: ${uci}`);
  return move;
}

/** Plays UCI moves on a position in place (engine level, no game record). */
export function playOn(position: Position, ...ucis: string[]): Position {
  for (const uci of ucis) makeMove(position, legalMove(position, uci));
  return position;
}

/** A game from the start with these UCI moves played; throws on an illegal one. */
export function gameOf(...ucis: string[]): Game {
  const game = createGame();
  for (const uci of ucis) {
    const parsed = parseUci(uci);
    const move = parsed && findMove(game, parsed.from, parsed.to, parsed.promotion);
    if (!move || !playMove(game, move))
      throw new Error(`not playable at ply ${game.moves.length}: ${uci}`);
  }
  return game;
}

/**
 * A game played to its end by picking uniformly among the legal moves with a
 * seeded generator. `onPly` sees the game after every move.
 */
export function randomGame(seed: string, onPly?: (game: Game) => void): Game {
  const rng = createRng(seed);
  const game = createGame();
  while (game.outcome === null) {
    const move = game.legal[Math.floor(rng() * game.legal.length)]!;
    playMove(game, move);
    onPly?.(game);
  }
  return game;
}
