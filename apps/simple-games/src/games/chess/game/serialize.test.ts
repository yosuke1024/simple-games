/**
 * The save is the move list, replayed fail-closed (docs/CHESS_RULES.md §7.1,
 * §12): round trips, the one canonical spelling, and every way a list is
 * refused — shape, legality, play after the end, length.
 */
import { describe, expect, it } from 'vitest';
import { toFen } from './fen';
import { createGame } from './record';
import {
  MAX_MOVE_LIST_LENGTH,
  decodeMoveList,
  encodeMoveList,
  moveToUci,
  parseUci,
} from './serialize';
import { gameOf, randomGame } from './test-helpers';
import { MAX_PLIES } from './types';

const FOOLS_MATE = 'f2f3 e7e5 g2g4 d8h4';

describe('round trip', () => {
  it('encodes the starting position as the empty list and decodes it back', () => {
    expect(encodeMoveList(createGame().moves)).toBe('');
    const game = decodeMoveList('')!;
    expect(game).not.toBeNull();
    expect(toFen(game.position)).toBe(toFen(createGame().position));
    expect(game.outcome).toBeNull();
  });

  it.each(Array.from({ length: 10 }, (_, index) => ({ seed: `chess-save-${index}` })))(
    'replays a random game ($seed) to the same position, history and ending',
    ({ seed }) => {
      const played = randomGame(seed);
      const text = encodeMoveList(played.moves);
      const replayed = decodeMoveList(text)!;
      expect(replayed).not.toBeNull();
      expect(replayed.moves).toEqual(played.moves);
      expect(toFen(replayed.position)).toBe(toFen(played.position));
      expect(replayed.history).toEqual(played.history);
      expect(replayed.outcome).toEqual(played.outcome);
      expect(encodeMoveList(replayed.moves)).toBe(text);
    },
  );

  it('writes promotions with a lower-case piece letter and castling as the king’s move', () => {
    const text = 'e2e4 d7d5 e4d5 c7c6 d5c6 g8f6 c6b7 e7e6 b7a8q f8e7 g1f3 e8g8';
    const game = gameOf(...text.split(' '));
    expect(encodeMoveList(game.moves)).toBe(text);
    expect(decodeMoveList(text)!.moves).toEqual(game.moves);
    expect(parseUci('b7a8q')).toEqual({ from: 49, to: 56, promotion: 5 });
  });

  it('returns a game that ended on its last move as ended — resuming it is the caller’s rule', () => {
    expect(decodeMoveList(FOOLS_MATE)!.outcome).toEqual({ winner: 1, reason: 'checkmate' });
  });
});

describe('refuses anything that is not a game the rules allow', () => {
  it.each([
    ['not a string', 42],
    ['null', null],
    ['an array', ['e2e4']],
    ['a leading space', ' e2e4'],
    ['a trailing space', 'e2e4 '],
    ['a doubled space', 'e2e4  e7e5'],
    ['a tab', 'e2e4\te7e5'],
    ['a comma', 'e2e4,e7e5'],
    ['capitals', 'E2E4'],
    ['a capital promotion letter', 'e2e4 d7d5 e4d5 c7c6 d5c6 g8f6 c6b7 e7e6 b7a8Q'],
    ['castling written as O-O', 'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 O-O'],
    ['a square off the board', 'e2e9'],
    ['a token too long', 'e2e4e5'],
    ['run-together moves', 'e2e4e7e5'],
  ])('%s', (_name, text) => {
    expect(decodeMoveList(text)).toBeNull();
  });

  it.each([
    ['an illegal move', 'e2e5'],
    ['the wrong side moving', 'e7e5'],
    ['a move from an empty square', 'e3e4'],
    ['a pinned piece moving off the pin', 'd2d4 e7e5 b1c3 f8b4 c3d5'],
    ['a move that ignores a check', 'e2e4 e7e5 d2d4 f8b4 a2a3'],
    ['a promotion without its letter', 'e2e4 d7d5 e4d5 c7c6 d5c6 g8f6 c6b7 e7e6 b7a8'],
    ['a promotion letter on a move that is not one', 'e2e4q'],
    ['a promotion to a king', 'e2e4 d7d5 e4d5 c7c6 d5c6 g8f6 c6b7 e7e6 b7a8k'],
    ['castling through check', 'e2e4 e7e5 g1f3 d8g5 f1c4 g5g2 e1g1'],
    ['a move after checkmate', `${FOOLS_MATE} a2a3`],
  ])('%s', (_name, text) => {
    expect(decodeMoveList(text)).toBeNull();
    // Everything before the last move is a valid game: the refusal is about that move.
    const prefix = text.split(' ').slice(0, -1).join(' ');
    expect(decodeMoveList(prefix)).not.toBeNull();
  });

  it(`refuses more than MAX_PLIES (${MAX_PLIES}) moves before replaying any`, () => {
    const tokens = Array.from({ length: MAX_PLIES + 1 }, (_, index) =>
      index % 4 === 0 ? 'g1f3' : index % 4 === 1 ? 'g8f6' : index % 4 === 2 ? 'f3g1' : 'f6g8',
    );
    const text = tokens.join(' ');
    expect(text.length).toBeLessThanOrEqual(MAX_MOVE_LIST_LENGTH);
    expect(decodeMoveList(text)).toBeNull();
    // The same shuffle at a legal length is refused for the right reason: it is drawn by
    // repetition at ply 8, so its ninth move is play after the end.
    expect(decodeMoveList(tokens.slice(0, 8).join(' '))!.outcome?.reason).toBe('repetition');
    expect(decodeMoveList(tokens.slice(0, 9).join(' '))).toBeNull();
  });

  it('refuses text longer than the longest valid list, by length alone', () => {
    expect(MAX_MOVE_LIST_LENGTH).toBe(MAX_PLIES * 6 - 1);
    expect(decodeMoveList('e'.repeat(MAX_MOVE_LIST_LENGTH + 1))).toBeNull();
  });

  // A legal game of MAX_PLIES moves cannot be built here, so the two bounds
  // are proved with smaller ones, each with the other bound out of the way.
  const SHUFFLE = 'g1f3 g8f6 f3g1 f6g8 g1f3 g8f6';

  it('refuses a list of more moves than the bound, though every move is legal', () => {
    const bounds = { maxPlies: 5, maxLength: MAX_MOVE_LIST_LENGTH };
    expect(decodeMoveList(SHUFFLE)).not.toBeNull();
    expect(decodeMoveList(SHUFFLE, bounds)).toBeNull();
    expect(decodeMoveList(SHUFFLE.slice(0, -5), bounds)!.moves).toHaveLength(5);
  });

  it('refuses text longer than the bound, though every move is legal', () => {
    const bounds = { maxPlies: MAX_PLIES, maxLength: SHUFFLE.length - 1 };
    expect(decodeMoveList(SHUFFLE, bounds)).toBeNull();
    expect(decodeMoveList(SHUFFLE, { ...bounds, maxLength: SHUFFLE.length })).not.toBeNull();
  });

  it('accepts exactly the canonical spelling that encoding produces', () => {
    const game = randomGame('chess-save-canonical');
    const text = encodeMoveList(game.moves);
    expect(text).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?( [a-h][1-8][a-h][1-8][qrbn]?)*$/);
    expect(game.moves.map(moveToUci).join(' ')).toBe(text);
  });
});
