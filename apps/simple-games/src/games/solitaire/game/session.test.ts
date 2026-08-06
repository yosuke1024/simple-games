/**
 * Session rules (docs/SOLITAIRE_RULES.md §4, §5, §8): every action is one
 * counted move, undo restores board and count together — flips included —
 * and a retried deal is the same deal.
 */
import { describe, expect, it } from 'vitest';
import { findHint } from './hint';
import {
  canUndo,
  createDailySession,
  createFreeSession,
  doDraw,
  doMoveTableauRun,
  recordHint,
  restartSession,
  restoreSession,
  undo,
  type SolitaireSession,
} from './session';
import { canPlaceOnTableau } from './engine';
import { isValidBoard } from './types';

const SEED = 'sol-free-test';

/** Some legal run move on this board, or null. */
function legalRunMove(
  session: SolitaireSession,
): { from: number; index: number; to: number } | null {
  for (let from = 0; from < session.board.tableau.length; from++) {
    const up = session.board.tableau[from]!.up;
    for (let index = 0; index < up.length; index++) {
      for (let to = 0; to < session.board.tableau.length; to++) {
        if (to !== from && canPlaceOnTableau(session.board, up[index]!, to)) {
          return { from, index, to };
        }
      }
    }
  }
  return null;
}

describe('createFreeSession / createDailySession', () => {
  it('deals a valid board and pins it to the seed (§5)', () => {
    const a = createFreeSession(false, SEED);
    const b = createFreeSession(false, SEED);
    expect(isValidBoard(a.board)).toBe(true);
    expect(a.board).toEqual(b.board);
    expect(a.status).toBe('playing');
  });

  it('gives two fresh free games different seeds', () => {
    expect(createFreeSession(false).seed).not.toBe(createFreeSession(false).seed);
  });

  it('derives the daily from its date and keeps the draw setting (§6)', () => {
    const session = createDailySession('2026-08-01', true);
    expect(session.dailyDate).toBe('2026-08-01');
    expect(session.drawThree).toBe(true);
    expect(session.board).toEqual(createDailySession('2026-08-01', false).board);
  });
});

describe('doDraw (§3, §4)', () => {
  it('draws one card in draw-1 and counts one move', () => {
    const session = createFreeSession(false, SEED);
    const next = doDraw(session)!;
    expect(next.board.waste.length).toBe(1);
    expect(next.moveCount).toBe(1);
  });

  it('draws three cards in draw-3 for the same one move (§4)', () => {
    const session = createFreeSession(true, SEED);
    const next = doDraw(session)!;
    expect(next.board.waste.length).toBe(3);
    expect(next.moveCount).toBe(1);
  });
});

describe('undo (§8)', () => {
  it('restores the board and the move count together, flips included', () => {
    let session = createFreeSession(false, SEED);
    // Draw until some run move exists, then play it (a flip may follow).
    let move = legalRunMove(session);
    while (move === null) {
      session = doDraw(session)!;
      move = legalRunMove(session);
    }
    const before = session;
    const playedMove = doMoveTableauRun(session, move.from, move.index, move.to)!;
    const back = undo(playedMove)!;
    expect(back.board).toEqual(before.board);
    expect(back.moveCount).toBe(before.moveCount);
  });

  it('returns null with nothing to undo', () => {
    expect(undo(createFreeSession(false, SEED))).toBeNull();
    expect(canUndo(createFreeSession(false, SEED))).toBe(false);
  });
});

describe('restart and restore', () => {
  it('restart rebuilds the same deal with progress cleared (§5)', () => {
    const session = createFreeSession(true, SEED);
    const played = recordHint(doDraw(session)!);
    const retried = restartSession(played);
    expect(retried.board).toEqual(session.board);
    expect(retried.drawThree).toBe(true);
    expect(retried.moveCount).toBe(0);
    expect(retried.hintCount).toBe(0);
  });

  it('restore keeps the position and drops history (§10)', () => {
    const played = doDraw(createFreeSession(false, SEED))!;
    const restored = restoreSession({
      mode: played.mode,
      seed: played.seed,
      drawThree: played.drawThree,
      dailyDate: played.dailyDate,
      board: played.board,
      moveCount: played.moveCount,
      hintCount: played.hintCount,
      elapsedSeconds: 12,
    });
    expect(restored.board).toEqual(played.board);
    expect(restored.history).toHaveLength(0);
    expect(restored.status).toBe('playing');
  });
});

describe('findHint (§8)', () => {
  it('always offers something while cards remain in hand', () => {
    let session = createFreeSession(false, SEED);
    for (let i = 0; i < 30; i++) {
      const hint = findHint(session.board);
      expect(hint).not.toBeNull();
      session = doDraw(session) ?? session;
    }
  });

  it('prefers a move that frees a hidden card over a plain draw', () => {
    let session = createFreeSession(false, SEED);
    let move = legalRunMove(session);
    while (move === null) {
      session = doDraw(session)!;
      move = legalRunMove(session);
    }
    // A run move at index 0 with hidden cards behind it must outrank 'draw'.
    const heads = session.board.tableau.some(
      (pile, from) =>
        pile.up.length > 0 &&
        pile.down.length > 0 &&
        session.board.tableau.some(
          (_, to) => to !== from && canPlaceOnTableau(session.board, pile.up[0]!, to),
        ),
    );
    const hint = findHint(session.board)!;
    if (heads) expect(hint.kind).not.toBe('draw');
  });
});
