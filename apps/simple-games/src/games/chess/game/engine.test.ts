/**
 * The special rules one by one (docs/CHESS_RULES.md §2, §12): every castling
 * condition, en passant and its pins, promotion, pins and check. Perft
 * (perft.test.ts) proves the counts; these name the cases.
 */
import { describe, expect, it } from 'vitest';
import { generateLegalMoves, hasLegalEnPassant, inCheck, makeMove, unmakeMove } from './engine';
import { toFen } from './fen';
import { fen, legalMove, legalUci, playOn } from './test-helpers';
import { moveToUci } from './serialize';
import {
  BLACK,
  CASTLE_ALL,
  CASTLE_BLACK_KING,
  CASTLE_BLACK_QUEEN,
  CASTLE_WHITE_QUEEN,
  KING,
  WHITE,
  kindOf,
  moveFrom,
  parseSquare,
} from './types';

const at = (position: ReturnType<typeof fen>, name: string) => position.board[parseSquare(name)];

describe('castling (§2.7)', () => {
  const OPEN = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';

  it('is offered on both wings when every condition holds, as the king’s two-square move', () => {
    const moves = legalUci(fen(OPEN));
    expect(moves).toContain('e1g1');
    expect(moves).toContain('e1c1');
    const black = legalUci(fen(OPEN.replace(' w ', ' b ')));
    expect(black).toContain('e8g8');
    expect(black).toContain('e8c8');
  });

  it('moves the rook over the king, and unmaking puts both back', () => {
    for (const [uci, after] of [
      ['e1g1', 'r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1'],
      ['e1c1', 'r3k2r/8/8/8/8/8/8/2KR3R b kq - 1 1'],
    ] as const) {
      const position = fen(OPEN);
      const move = legalMove(position, uci);
      const undo = makeMove(position, move);
      expect(toFen(position)).toBe(after);
      expect(position.kings[WHITE]).toBe(parseSquare(uci.slice(2)));
      unmakeMove(position, move, undo);
      expect(toFen(position)).toBe(OPEN);
    }
  });

  it('is lost on both wings for good once the king has moved, even back home', () => {
    const position = playOn(fen(OPEN), 'e1e2', 'e8e7', 'e2e1', 'e7e8');
    expect(position.castling).toBe(0);
    expect(legalUci(position)).not.toContain('e1g1');
    expect(legalUci(position)).not.toContain('e1c1');
  });

  it('is lost on one wing once that rook has moved, even back home', () => {
    const position = playOn(fen(OPEN), 'h1h2', 'a8a7', 'h2h1', 'a7a8');
    expect(position.castling).toBe(CASTLE_WHITE_QUEEN | CASTLE_BLACK_KING);
    expect(legalUci(position)).not.toContain('e1g1');
    expect(legalUci(position)).toContain('e1c1');
  });

  it('is lost on one wing when that rook is captured on its corner', () => {
    const position = playOn(fen('4k3/8/8/8/8/8/6b1/R3K2R b KQ - 0 1'), 'g2h1');
    expect(position.castling).toBe(CASTLE_WHITE_QUEEN);
    expect(legalUci(position)).toContain('e1c1');
    // Capturing the rook on h8 costs the capturer's own right too (its rook moved).
    const both = playOn(fen(OPEN), 'h1h8');
    expect(both.castling).toBe(CASTLE_WHITE_QUEEN | CASTLE_BLACK_QUEEN);
  });

  it('needs every square between king and rook empty — b1 included', () => {
    expect(legalUci(fen('4k3/8/8/8/8/8/8/R3K1NR w KQ - 0 1'))).not.toContain('e1g1');
    expect(legalUci(fen('4k3/8/8/8/8/8/8/RN2K2R w KQ - 0 1'))).not.toContain('e1c1');
    expect(legalUci(fen('4k3/8/8/8/8/8/8/R2QK2R w KQ - 0 1'))).not.toContain('e1c1');
    expect(legalUci(fen('4k3/8/8/8/8/8/8/R3KB1R w KQ - 0 1'))).not.toContain('e1g1');
  });

  it('is not allowed out of check', () => {
    const moves = legalUci(fen('4k3/8/8/8/4r3/8/8/R3K2R w KQ - 0 1'));
    expect(moves).not.toContain('e1g1');
    expect(moves).not.toContain('e1c1');
  });

  it('is not allowed through an attacked square (f1, d1)', () => {
    const kingSide = legalUci(fen('4k3/5r2/8/8/8/8/8/R3K2R w KQ - 0 1'));
    expect(kingSide).not.toContain('e1g1');
    expect(kingSide).toContain('e1c1');
    const queenSide = legalUci(fen('4k3/3r4/8/8/8/8/8/R3K2R w KQ - 0 1'));
    expect(queenSide).not.toContain('e1c1');
    expect(queenSide).toContain('e1g1');
  });

  it('is not allowed onto an attacked square (g1, c1)', () => {
    expect(legalUci(fen('4k3/6r1/8/8/8/8/8/R3K2R w KQ - 0 1'))).not.toContain('e1g1');
    expect(legalUci(fen('4k3/2r5/8/8/8/8/8/R3K2R w KQ - 0 1'))).not.toContain('e1c1');
  });

  it('is allowed while b1 is attacked — the king never crosses it', () => {
    expect(legalUci(fen('4k3/1r6/8/8/8/8/8/R3K2R w KQ - 0 1'))).toContain('e1c1');
    expect(legalUci(fen('r3k2r/8/8/8/8/8/1Q6/4K3 b kq - 0 1'))).toContain('e8c8');
  });

  it('holds all four rights in the starting position and none can be used there', () => {
    const start = fen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(start.castling).toBe(CASTLE_ALL);
    expect(legalUci(start).some((uci) => uci.startsWith('e1'))).toBe(false);
    // Knights out and back move neither king nor rook: all four rights survive.
    expect(playOn(start, 'g1f3', 'g8f6', 'f3g1', 'f6g8').castling).toBe(CASTLE_ALL);
  });
});

describe('en passant (§2.5)', () => {
  it('is available for exactly one move after the double step', () => {
    const position = playOn(
      fen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
      'e2e4',
      'a7a6',
      'e4e5',
      'd7d5',
    );
    expect(legalUci(position)).toContain('e5d6');
    expect(hasLegalEnPassant(position)).toBe(true);
    playOn(position, 'h2h3', 'h7h6');
    expect(legalUci(position)).not.toContain('e5d6');
    expect(hasLegalEnPassant(position)).toBe(false);
  });

  it('removes the passed pawn, not a piece on the landing square, and unmakes cleanly', () => {
    const before = '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1';
    const position = fen(before);
    const move = legalMove(position, 'e5d6');
    const undo = makeMove(position, move);
    expect(at(position, 'd5')).toBe(0);
    expect(at(position, 'e5')).toBe(0);
    expect(toFen(position)).toBe('4k3/8/3P4/8/8/8/8/4K3 b - - 0 1');
    unmakeMove(position, move, undo);
    expect(toFen(position)).toBe(before);
  });

  it('is illegal when taking both pawns off the rank exposes the king (the horizontal pin)', () => {
    const pinned = fen('8/8/8/KPp4r/8/8/8/7k w - c6 0 1');
    expect(legalUci(pinned)).not.toContain('b5c6');
    expect(hasLegalEnPassant(pinned)).toBe(false);
    // Without the rook the same capture is fine.
    expect(legalUci(fen('8/8/8/KPp5/8/8/8/7k w - c6 0 1'))).toContain('b5c6');
  });

  it('is illegal for a capturing pawn pinned on a diagonal', () => {
    expect(legalUci(fen('7b/8/8/3pP3/8/8/1K6/7k w - d6 0 1'))).not.toContain('e5d6');
  });

  it('may capture the pawn that just gave check', () => {
    const position = fen('8/8/8/3pP3/4K3/8/8/k7 w - d6 0 1');
    expect(inCheck(position)).toBe(true);
    expect(legalUci(position)).toContain('e5d6');
  });

  it('is not offered from a pawn that did not stand beside the passed pawn', () => {
    expect(
      legalUci(fen('4k3/8/8/3p3P/8/8/8/4K3 w - d6 0 1')).some((uci) => uci.endsWith('d6')),
    ).toBe(false);
  });
});

describe('promotion (§2.6)', () => {
  it('offers four moves, queen first, then rook, bishop, knight', () => {
    const fromA7 = generateLegalMoves(fen('8/P7/8/8/8/8/8/k1K5 w - - 0 1'))
      .filter((move) => moveFrom(move) === parseSquare('a7'))
      .map(moveToUci);
    expect(fromA7).toEqual(['a7a8q', 'a7a8r', 'a7a8b', 'a7a8n']);
  });

  it('also on a capture, and for Black towards the first rank', () => {
    const capture = legalUci(fen('1r6/P7/8/8/8/8/8/k1K5 w - - 0 1')).filter((uci) =>
      uci.startsWith('a7'),
    );
    expect(capture).toEqual(
      ['a7a8b', 'a7a8n', 'a7a8q', 'a7a8r', 'a7b8b', 'a7b8n', 'a7b8q', 'a7b8r'].sort(),
    );
    const black = legalUci(fen('7K/8/8/8/8/8/p7/2k5 b - - 0 1')).filter((uci) =>
      uci.startsWith('a2'),
    );
    expect(black).toEqual(['a2a1b', 'a2a1n', 'a2a1q', 'a2a1r']);
  });

  it('places the chosen piece, and unmaking gives back the pawn and the captured piece', () => {
    const before = '1r6/P7/8/8/8/8/8/k1K5 w - - 0 1';
    const position = fen(before);
    const move = legalMove(position, 'a7b8n');
    const undo = makeMove(position, move);
    expect(toFen(position)).toBe('1N6/8/8/8/8/8/8/k1K5 b - - 0 1');
    unmakeMove(position, move, undo);
    expect(toFen(position)).toBe(before);
  });

  it('never offers a promotion without a piece letter, nor to a king or pawn', () => {
    const moves = legalUci(fen('8/P7/8/8/8/8/8/k1K5 w - - 0 1'));
    expect(moves).not.toContain('a7a8');
    expect(moves.filter((uci) => uci.startsWith('a7')).every((uci) => /[qrbn]$/.test(uci))).toBe(
      true,
    );
  });
});

describe('pins and check (§2.8)', () => {
  it('lets a pinned rook move only along the pin', () => {
    const rook = legalUci(fen('4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1')).filter((uci) =>
      uci.startsWith('e2'),
    );
    expect(rook).toEqual(['e2e3', 'e2e4', 'e2e5', 'e2e6', 'e2e7', 'e2e8']);
  });

  it('freezes a pinned knight', () => {
    expect(
      legalUci(fen('4r1k1/8/8/8/8/8/4N3/4K3 w - - 0 1')).some((uci) => uci.startsWith('e2')),
    ).toBe(false);
  });

  it('allows only king moves in double check', () => {
    const position = fen('4r1k1/8/8/8/1b6/8/8/R3K3 w - - 0 1');
    expect(inCheck(position)).toBe(true);
    const moves = generateLegalMoves(position);
    expect(moves.length).toBeGreaterThan(0);
    for (const move of moves) expect(kindOf(position.board[moveFrom(move)]!)).toBe(KING);
  });

  it('does not let the king step back along the checking line or into an attack', () => {
    const moves = legalUci(fen('4r1k1/8/8/8/4K3/8/8/8 w - - 0 1'));
    expect(moves).not.toContain('e4e3');
    expect(moves).not.toContain('e4e5');
    expect(moves).toContain('e4d4');
    // A defended piece cannot be captured by the king.
    expect(legalUci(fen('4r1k1/8/8/8/8/8/4r3/4K3 w - - 0 1'))).not.toContain('e1e2');
  });

  it('answers a check by blocking or capturing, never with an unrelated move', () => {
    const moves = legalUci(fen('4r1k1/8/8/8/8/8/1R6/4K3 w - - 0 1'));
    expect(moves).toContain('b2e2'); // block
    expect(moves).not.toContain('b2b3');
    expect(inCheck(fen('4r1k1/8/8/8/8/8/1R6/4K3 w - - 0 1'), WHITE)).toBe(true);
    expect(inCheck(fen('4r1k1/8/8/8/8/8/1R6/4K3 w - - 0 1'), BLACK)).toBe(false);
  });
});
