/**
 * How a game ends (docs/CHESS_RULES.md §3, §12): checkmate, stalemate, the
 * four insufficient-material shapes, threefold repetition with its three-part
 * definition, and the fifty-move rule with a mate on the hundredth ply.
 */
import { describe, expect, it } from 'vitest';
import { hasLegalMove, makeMove } from './engine';
import { undoMove } from './record';
import { countRepetitions, isInsufficientMaterial, outcomeAfterMove } from './rules';
import { fen, gameOf, legalMove } from './test-helpers';
import { BLACK, WHITE } from './types';

/** The outcome after playing `uci` on the FEN position (engine level, repetitions counted as 1). */
function outcomeOf(text: string, uci: string) {
  const position = fen(text);
  makeMove(position, legalMove(position, uci));
  return { outcome: outcomeAfterMove(position, hasLegalMove(position), 1), position };
}

describe('checkmate and stalemate (§3.1, §3.2)', () => {
  it('ends the shortest mate as a win for the mating side', () => {
    const game = gameOf('f2f3', 'e7e5', 'g2g4', 'd8h4');
    expect(game.outcome).toEqual({ winner: BLACK, reason: 'checkmate' });
    expect(game.legal).toEqual([]);
  });

  it('ends a game with no legal move and no check as a stalemate — a draw', () => {
    // A ten-move stalemate from the starting position, played through the record.
    const game = gameOf(
      ...'e2e3 a7a5 d1h5 a8a6 h5a5 h7h5 h2h4 a6h6 a5c7 f7f6 c7d7 e8f7 d7b7 d8d3 b7b8 d3h7 b8c8 f7g6 c8e6'.split(
        ' ',
      ),
    );
    expect(game.outcome).toEqual({ winner: null, reason: 'stalemate' });
  });

  it('tells the two apart on the same material', () => {
    expect(outcomeOf('7k/8/5QK1/8/8/8/8/8 w - - 0 1', 'f6f7').outcome).toEqual({
      winner: null,
      reason: 'stalemate',
    });
    expect(outcomeOf('7k/8/5QK1/8/8/8/8/8 w - - 0 1', 'f6g7').outcome).toEqual({
      winner: WHITE,
      reason: 'checkmate',
    });
  });

  it('can be undone: a mated game is playable again after taking the mate back', () => {
    const game = gameOf('f2f3', 'e7e5', 'g2g4', 'd8h4');
    expect(undoMove(game)).toBe(true);
    expect(game.outcome).toBeNull();
    expect(game.legal.length).toBeGreaterThan(0);
  });
});

describe('insufficient material — the four shapes only (§3.3)', () => {
  it.each([
    ['K v K', '8/8/8/4k3/8/8/8/4K3 w - - 0 1'],
    ['K+B v K', '8/8/8/4k3/8/8/8/2B1K3 w - - 0 1'],
    ['K v K+B', '8/8/8/4k3/8/8/2b5/4K3 w - - 0 1'],
    ['K+N v K', '8/8/8/4k3/8/8/8/1N2K3 w - - 0 1'],
    ['K v K+N', '8/8/8/4k3/2n5/8/8/4K3 w - - 0 1'],
    ['K+B v K+B on one colour', '8/8/8/4k3/8/8/1b6/2B1K3 w - - 0 1'],
    ['three bishops on light squares', '8/8/8/2b1k3/8/8/1b6/B3K3 b - - 0 1'],
  ])('%s is a draw', (_name, text) => {
    expect(isInsufficientMaterial(fen(text))).toBe(true);
  });

  it.each([
    ['K+B v K+B on opposite colours', '8/8/8/4k3/8/8/2b5/2B1K3 w - - 0 1'],
    ['K+N v K+N', '8/8/8/4k3/2n5/8/8/1N2K3 w - - 0 1'],
    ['K+N+N v K', '8/8/8/4k3/8/8/8/1N2K1N1 w - - 0 1'],
    ['K+B v K+N', '8/8/8/4k3/2n5/8/8/2B1K3 w - - 0 1'],
    ['K+P v K', '8/8/8/4k3/8/8/4P3/4K3 w - - 0 1'],
    ['K+R v K', '8/8/8/4k3/8/8/8/R3K3 w - - 0 1'],
    ['K+Q v K', '8/8/8/4k3/8/8/8/3QK3 w - - 0 1'],
  ])('%s plays on', (_name, text) => {
    expect(isInsufficientMaterial(fen(text))).toBe(false);
  });

  it('ends the game on the capture that leaves it', () => {
    const { outcome } = outcomeOf('8/8/8/4k3/8/8/4r3/2B1K3 w - - 0 1', 'e1e2');
    expect(outcome).toEqual({ winner: null, reason: 'insufficient' });
  });

  it('calls a stalemate that is also insufficient material a stalemate (the order of §3)', () => {
    // The bishop takes the last pawn: K+B v K, and the cornered king has no move and no check.
    const { outcome } = outcomeOf('k7/8/1K6/4p3/8/6B1/8/8 w - - 0 1', 'g3e5');
    expect(outcome).toEqual({ winner: null, reason: 'stalemate' });
  });
});

describe('threefold repetition (§3.4)', () => {
  it('draws the third time the same position occurs, counting the start', () => {
    const shuffle = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];
    const game = gameOf(...shuffle, ...shuffle.slice(0, 3));
    expect(game.outcome).toBeNull();
    const done = gameOf(...shuffle, ...shuffle);
    expect(done.moves).toHaveLength(8);
    expect(done.outcome).toEqual({ winner: null, reason: 'repetition' });
  });

  it('does not count positions whose castling rights differ', () => {
    // The rooks step out and back: the board is the start's, the king-side rights are gone.
    const out = ['g1f3', 'g8f6', 'h1g1', 'h8g8', 'g1h1', 'g8h8', 'f3g1', 'f6g8'];
    const cycle = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];
    // Ply 12 shows the start's board for the third time (plies 0, 8, 12), but ply 0 held
    // all four rights, so it is only the second time for this position: play goes on.
    expect(gameOf(...out, ...cycle).outcome).toBeNull();
    // The draw comes at ply 14: rooks home, knights out, king-side rights gone — the
    // position of plies 6, 10 and 14.
    const game = gameOf(...out, ...cycle, 'g1f3', 'g8f6');
    expect(game.moves).toHaveLength(14);
    expect(game.outcome).toEqual({ winner: null, reason: 'repetition' });
  });

  it('does not count a position with a legal en passant capture as one without', () => {
    // After 2…d5 (ply 4) White may take en passant; the same board at plies 8 and 12
    // cannot. Were the en passant right ignored, ply 12 would be the third occurrence.
    const opening = ['e2e4', 'g8f6', 'e4e5', 'd7d5'];
    const cycle = ['g1f3', 'f6g8', 'f3g1', 'g8f6'];
    expect(gameOf(...opening, ...cycle, ...cycle).outcome).toBeNull();
    // The draw comes one ply later, at the position of plies 5, 9 and 13.
    const game = gameOf(...opening, ...cycle, ...cycle, 'g1f3');
    expect(game.outcome).toEqual({ winner: null, reason: 'repetition' });
  });

  it('counts a double step nobody can take en passant as the same position as a single step', () => {
    // 1.e4 leaves an en passant square that no black pawn can use, so the position after
    // it (ply 1) is the one of plies 5 and 9. Were the bare square counted, ply 9 would
    // be only the second occurrence and the draw would come at ply 10.
    const cycle = ['g8f6', 'g1f3', 'f6g8', 'f3g1'];
    expect(gameOf('e2e4', ...cycle).outcome).toBeNull(); // twice
    expect(gameOf('e2e4', ...cycle, ...cycle).outcome).toEqual({
      winner: null,
      reason: 'repetition',
    });
  });

  it('does not count a key collision: equal keys with different positions are compared by the position', () => {
    const entries = [
      { hashHi: 1, hashLo: 2, signature: 'a' },
      { hashHi: 1, hashLo: 2, signature: 'b' },
      { hashHi: 1, hashLo: 2, signature: 'c' },
    ];
    expect(countRepetitions(entries, 10)).toBe(1);
    const same = entries.map((entry) => ({ ...entry, signature: 'a' }));
    expect(countRepetitions(same, 10)).toBe(3);
    // Only positions since the last pawn move or capture are compared.
    expect(countRepetitions(same, 1)).toBe(2);
  });
});

describe('the fifty-move rule — 100 plies (§3.5)', () => {
  it('plays on at the 99th quiet ply and draws at the 100th', () => {
    expect(outcomeOf('k7/8/8/8/8/8/8/K6R w - - 98 80', 'h1h2').outcome).toBeNull();
    const { outcome, position } = outcomeOf('k7/8/8/8/8/8/8/K6R w - - 99 80', 'h1h2');
    expect(position.halfmoveClock).toBe(100);
    expect(outcome).toEqual({ winner: null, reason: 'fifty' });
  });

  it('lets a mate on the 100th ply stand as a mate', () => {
    expect(outcomeOf('k7/8/1K6/8/8/8/8/7R w - - 99 80', 'h1h8').outcome).toEqual({
      winner: WHITE,
      reason: 'checkmate',
    });
  });

  it('is reset by a pawn move and by a capture', () => {
    expect(outcomeOf('k7/8/8/8/8/8/P7/K6R w - - 99 80', 'a2a3').position.halfmoveClock).toBe(0);
    expect(outcomeOf('k7/8/8/8/8/8/8/K5rR w - - 99 80', 'h1g1').position.halfmoveClock).toBe(0);
    expect(outcomeOf('k7/8/8/8/8/8/8/K5rR w - - 99 80', 'h1g1').outcome).toBeNull();
  });
});
