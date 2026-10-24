/**
 * Golden boards, v1: fixed seeds, exact strings.
 *
 * A seed is a promise. A daily is the same board for everyone who opens it,
 * and a suspended board has to come back as the board it was — so any change
 * to the rng, to the bundled bases, to the change rule, to the choice of the
 * starting board or to the canonical block order that moves a board fails
 * here. That is the point: changing these strings is a decision, not a side
 * effect.
 *
 * **Fix the implementation, not the test.** A saved game holds the board
 * string and the move list verbatim (docs/UNBLOCK_PUZZLE_RULES.md §12).
 * Unblock Puzzle is in the web-beta channel (docs/WEB_VERSION.md), so a
 * change here may still reset saves — behind the notice the home shows — but
 * say so in the commit message, along with what it costs players.
 */
import { describe, expect, it } from 'vitest';
import { dailyEntry, generatePuzzle } from './generator';
import { decodeBoard, encodeBoard, encodeMoves, replayMoves } from './serialize';
import { createDailySession, createFreeSession, doSlide, MOVE_LIMIT } from './session';

/** A board string, six cells per row. */
const rows = (...lines: string[]): string => lines.join('');

describe('golden boards (v1)', () => {
  // Pinned anew on 2026-10-17 with the catalogue that deals Hard as it is
  // (§8): every board here moved. Web beta — see the file header.
  it('the easy board for seed unblock-puzzle-easy-golden is unchanged', () => {
    const puzzle = generatePuzzle('unblock-puzzle-easy-golden', 'easy');
    expect(encodeBoard(puzzle.board)).toBe(
      rows('...bb.', '.cddee', '.c.aaf', '...g.f', 'hh.g.i', '.....i'),
    );
    // Bundled board 393, changed once.
    expect([puzzle.minMoves, puzzle.base, puzzle.changes]).toEqual([5, 393, 1]);
  });

  it('the medium board for seed unblock-puzzle-medium-golden is unchanged', () => {
    const puzzle = generatePuzzle('unblock-puzzle-medium-golden', 'medium');
    expect(encodeBoard(puzzle.board)).toBe(
      rows('bb....', 'ccddef', 'g.aaef', 'g.hhei', 'g.jk.i', 'lljkmm'),
    );
    expect([puzzle.minMoves, puzzle.base, puzzle.changes]).toEqual([12, 1174, 1]);
  });

  it('the hard board for seed unblock-puzzle-hard-golden is unchanged', () => {
    const puzzle = generatePuzzle('unblock-puzzle-hard-golden', 'hard');
    expect(encodeBoard(puzzle.board)).toBe(
      rows('b.c.dd', 'b.c.ef', 'baa.ef', 'ggghhf', '..iijj', 'kkll..'),
    );
    // Bundled board 3146 as it is: Hard is never changed on the tap.
    expect([puzzle.minMoves, puzzle.base, puzzle.changes]).toEqual([22, 3146, 0]);
  });

  it('the daily for 2026-10-17 is unchanged', () => {
    const session = createDailySession('2026-10-17');
    expect(session.difficulty).toBe('medium');
    expect(encodeBoard(session.start)).toBe(
      rows('bb..cc', 'ddee.f', '..aa.f', 'g.hiif', 'g.hjkk', 'g.hj..'),
    );
    expect(session.minMoves).toBe(12);
    // Medium bundled board 817: (day × 7,919) mod 2,200 for 2026-10-17.
    expect(dailyEntry('2026-10-17').index).toBe(817);
  });
});

/**
 * The save format of §12, v1: the dealt board as 36 characters and the moves
 * as two characters each. Nothing in a save is derived from anything else in
 * it except by replaying the moves through the rules.
 */
describe('the saved game format (v1)', () => {
  const played = () => {
    let session = createFreeSession('easy', 'unblock-puzzle-easy-golden');
    // b (the pair in the top row) left one cell and then one more — one
    // move, b 3→1 — then c (the pair in the second column) down one cell.
    session = doSlide(session, 1, 2)!;
    session = doSlide(session, 1, 1)!;
    return doSlide(session, 2, 2)!;
  };

  it('writes the moves a save holds, merged as play merges them', () => {
    const session = played();
    expect(encodeMoves(session.moves)).toBe('b1c2');
    expect(encodeBoard(session.board)).toBe(
      rows('.bb...', '..ddee', '.c.aaf', '.c.g.f', 'hh.g.i', '.....i'),
    );
    expect(MOVE_LIMIT).toBe(9_999);
  });

  it('reads back exactly what it wrote', () => {
    const session = played();
    const start = decodeBoard(encodeBoard(session.start))!;
    expect(start).toEqual(session.start);
    const replayed = replayMoves(encodeMoves(session.moves), start, MOVE_LIMIT)!;
    expect(replayed.moves).toEqual(session.moves);
    expect(replayed.board).toEqual(session.board);
  });
});
