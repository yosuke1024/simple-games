import { describe, expect, it } from 'vitest';
import { dealBoard } from './deal';
import { findHint } from './hint';
import { COLUMNS, RANKS, type Card, type Pile, type SpiderBoard } from './types';

const card = (copy: number, rank: number): Card => copy * RANKS + (rank - 1);

function board(tableau: Pile[], partial: Partial<SpiderBoard> = {}): SpiderBoard {
  return {
    suitCount: 4,
    stock: [],
    tableau: Array.from({ length: COLUMNS }, (_, i) => tableau[i] ?? { down: [], up: [] }),
    completed: [],
    ...partial,
  };
}

describe('findHint (§8)', () => {
  it('prefers the move that turns a card over', () => {
    // Column 0's 8 can go on either 9. Only column 1's move uncovers anything.
    const b = board([
      { down: [card(3, 4)], up: [card(0, 8)] },
      { down: [], up: [card(0, 9)] },
      { down: [], up: [card(1, 9)] },
    ]);
    const hint = findHint(b);
    expect(hint).toEqual({ kind: 'move', from: 0, index: 0, to: 1 });
  });

  it('breaks a tie between two uncovering moves by suit', () => {
    const b = board([
      { down: [card(3, 4)], up: [card(0, 8)] },
      { down: [], up: [card(1, 9)] }, // a heart: no suit join
      { down: [], up: [card(0, 9)] }, // a spade: joins the run
    ]);
    expect(findHint(b)).toEqual({ kind: 'move', from: 0, index: 0, to: 2 });
  });

  it('offers a suit-joining move when nothing can be uncovered', () => {
    const b = board([
      { down: [], up: [card(2, 5), card(0, 8)] },
      { down: [], up: [card(0, 9)] },
      { down: [], up: [card(1, 9)] },
    ]);
    expect(findHint(b)).toEqual({ kind: 'move', from: 0, index: 1, to: 1 });
  });

  it('never offers a sideways shuffle that uncovers nothing and grows nothing', () => {
    // The 8♥ can move onto either black 9, but neither joins its suit, neither
    // uncovers anything, and neither empties a column. There is nothing worth
    // suggesting, and no stock — so there is no hint at all.
    const b = board([
      { down: [], up: [card(2, 3), card(1, 8)] },
      { down: [], up: [card(0, 9)] },
      { down: [], up: [card(4, 9)] },
    ]);
    expect(findHint(b)).toBeNull();
  });

  it('never suggests splitting a tidy run', () => {
    // 9♠8♠7♠ is one suit. The 7 alone would fit the 8♥ at column 1, but taking
    // it out of a finished run is not a move to recommend.
    const b = board([
      { down: [], up: [card(0, 9), card(0, 8), card(0, 7)] },
      { down: [], up: [card(1, 8)] },
    ]);
    expect(findHint(b)).toBeNull();
  });

  it('falls back to the deal when no move is worth making', () => {
    const b = board(
      [
        { down: [], up: [card(2, 3), card(1, 8)] },
        { down: [], up: [card(0, 9)] },
      ],
      { stock: Array.from({ length: COLUMNS }, (_, i) => card(5, i + 1)) },
    );
    // Every column must be occupied for the deal to be legal (§3).
    const occupied = board(
      Array.from({ length: COLUMNS }, (_, i) =>
        i === 0
          ? { down: [], up: [card(2, 3), card(1, 8)] }
          : i === 1
            ? { down: [], up: [card(0, 9)] }
            : { down: [], up: [card(6, 12)] },
      ),
      { stock: b.stock },
    );
    expect(findHint(occupied)).toEqual({ kind: 'deal' });
  });

  it('always finds something on a fresh deal', () => {
    for (const n of [1, 2, 4] as const) {
      for (let i = 0; i < 10; i++) {
        expect(findHint(dealBoard(`ss-free-hint-${n}-${i}`, n))).not.toBeNull();
      }
    }
  });
});
