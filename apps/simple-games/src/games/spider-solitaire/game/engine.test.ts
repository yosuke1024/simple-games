import { describe, expect, it } from 'vitest';
import { dealBoard } from './deal';
import {
  canDeal,
  canPlaceOnColumn,
  columnTop,
  dealRow,
  dealsLeft,
  isWon,
  movableRunStart,
  moveRun,
} from './engine';
import { hasAnyMove } from './hint';
import {
  CARD_COUNT,
  COLUMNS,
  isValidBoard,
  RANKS,
  rankOf,
  suitOf,
  type Card,
  type Pile,
  type SpiderBoard,
  type SuitCount,
} from './types';

/** The card of `copy` (0..7) at `rank`. Suits are read off the difficulty. */
const card = (copy: number, rank: number): Card => copy * RANKS + (rank - 1);

function board(partial: Partial<SpiderBoard> = {}): SpiderBoard {
  return {
    suitCount: 4,
    stock: [],
    tableau: Array.from({ length: COLUMNS }, (): Pile => ({ down: [], up: [] })),
    completed: [],
    ...partial,
  };
}

const piles = (...up: Card[][]): Pile[] =>
  Array.from({ length: COLUMNS }, (_, i) => ({ down: [], up: up[i] ?? [] }));

/**
 * A real deal — 104 cards, each exactly once, every column occupied — whose
 * stock has been given a length no deal could produce. Cards are shifted
 * between the stock and the face-down parts, so nothing is invented or lost:
 * the only thing wrong with the board is the one thing under test.
 */
function boardWithStockOf(count: number): SpiderBoard {
  const dealt = dealBoard('ss-free-stock-invariant', 4);
  const stock = [...dealt.stock];
  // Mutable copies on purpose: the shifting below is what makes the fixture.
  const tableau = dealt.tableau.map((pile) => ({ down: [...pile.down], up: [...pile.up] }));
  let column = 0;
  while (stock.length > count) tableau[0]!.down.push(stock.pop()!);
  while (stock.length < count) {
    while (tableau[column]!.down.length === 0) column++;
    stock.push(tableau[column]!.down.pop()!);
  }
  return { ...dealt, stock, tableau };
}

/** Every card on a board, to prove a fixture is still a whole pack. */
function allCards(board: SpiderBoard): Card[] {
  const out: Card[] = [...board.stock];
  for (const run of board.completed) out.push(...run);
  for (const pile of board.tableau) out.push(...pile.down, ...pile.up);
  return out;
}

describe('dealBoard', () => {
  it('lays 54 cards into ten columns of 6,6,6,6,5,5,5,5,5,5 with 50 in stock', () => {
    const dealt = dealBoard('ss-daily-2026-08-07', 1);
    expect(dealt.tableau.map((p) => p.down.length + p.up.length)).toEqual([
      6, 6, 6, 6, 5, 5, 5, 5, 5, 5,
    ]);
    expect(dealt.tableau.every((p) => p.up.length === 1)).toBe(true);
    expect(dealt.stock).toHaveLength(50);
    expect(dealsLeft(dealt)).toBe(5);
    expect(dealt.completed).toEqual([]);
    expect(isValidBoard(dealt)).toBe(true);
  });

  it('is determined entirely by the seed', () => {
    expect(dealBoard('ss-free-x', 4)).toEqual(dealBoard('ss-free-x', 4));
    expect(dealBoard('ss-free-x', 4)).not.toEqual(dealBoard('ss-free-y', 4));
  });

  /**
   * The point of the unique 0..103 encoding: difficulty changes what a card
   * reads as, never where it lies. One daily deal serves all three settings.
   */
  it('puts the same cards in the same places at every difficulty', () => {
    const [one, two, four] = ([1, 2, 4] as SuitCount[]).map((n) => dealBoard('ss-free-same', n));
    const places = (b: SpiderBoard) => ({
      stock: b.stock,
      tableau: b.tableau,
    });
    expect(places(one!)).toEqual(places(two!));
    expect(places(one!)).toEqual(places(four!));

    // ...and only the suits differ.
    expect(one!.tableau[0]!.up.map((c) => suitOf(c, 1))).toEqual([0]);
    const suitsAtFour = new Set(four!.stock.map((c) => suitOf(c, 4)));
    expect(suitsAtFour.size).toBe(4);
    const suitsAtTwo = new Set(two!.stock.map((c) => suitOf(c, 2)));
    expect(suitsAtTwo).toEqual(new Set([0, 1]));
    for (let c = 0; c < CARD_COUNT; c++) expect(suitOf(c, 1)).toBe(0);
  });
});

describe('placement (§3)', () => {
  it('takes any suit one rank lower, and anything into an empty column', () => {
    const b = board({ tableau: piles([card(0, 9)], [], [card(1, 5)]) });
    expect(canPlaceOnColumn(b, card(2, 8), 0)).toBe(true); // rank 8 onto 9, other suit
    expect(canPlaceOnColumn(b, card(0, 8), 0)).toBe(true); // same suit is fine too
    expect(canPlaceOnColumn(b, card(0, 7), 0)).toBe(false); // wrong rank
    expect(canPlaceOnColumn(b, card(0, 13), 1)).toBe(true); // empty column
    expect(canPlaceOnColumn(b, card(3, 2), 1)).toBe(true);
    expect(canPlaceOnColumn(b, card(0, 4), 2)).toBe(true);
  });
});

describe('movable runs (§3)', () => {
  it('only carries a tail that is one suit descending', () => {
    // copies 0 and 4 are both spades at four suits (0 % 4 === 4 % 4).
    const spades = board({
      suitCount: 4,
      tableau: piles([card(1, 10), card(0, 9), card(4, 8), card(0, 7)]),
    });
    expect(movableRunStart(spades, 0)).toBe(1); // 9,8,7 all spades; the 10 is a heart

    const mixed = board({
      suitCount: 4,
      tableau: piles([card(0, 9), card(1, 8)]),
    });
    expect(movableRunStart(mixed, 0)).toBe(1); // different suits: only the top card

    // At one suit every card is a spade, so the whole descending tail travels.
    const one = board({
      suitCount: 1,
      tableau: piles([card(1, 10), card(0, 9), card(4, 8), card(0, 7)]),
    });
    expect(movableRunStart(one, 0)).toBe(0);
  });

  it('refuses to carry a run that is not one suit', () => {
    const b = board({
      suitCount: 4,
      tableau: piles([card(0, 9), card(1, 8)], [card(2, 10)]),
    });
    expect(moveRun(b, 0, 0, 1)).toBeNull(); // 9♠8♥ is not a run
    expect(moveRun(b, 0, 1, 1)).toBeNull(); // the 8 alone does not fit a 10
  });

  it('moves a whole run with no capacity limit, unlike FreeCell', () => {
    const b = board({
      suitCount: 4,
      tableau: piles([card(0, 8), card(0, 7), card(0, 6), card(0, 5), card(0, 4)], [card(1, 9)]),
    });
    const moved = moveRun(b, 0, 0, 1)!;
    expect(moved.tableau[0]!.up).toEqual([]);
    expect(moved.tableau[1]!.up).toHaveLength(6);
  });

  it('turns over the card a departing run uncovers, as part of the same move', () => {
    const b = board({
      suitCount: 4,
      tableau: Array.from({ length: COLUMNS }, (_, i): Pile => {
        if (i === 0) return { down: [card(3, 2)], up: [card(0, 5)] };
        if (i === 1) return { down: [], up: [card(1, 6)] };
        return { down: [], up: [] };
      }),
    });
    const moved = moveRun(b, 0, 0, 1)!;
    expect(moved.tableau[0]!.down).toEqual([]);
    expect(moved.tableau[0]!.up).toEqual([card(3, 2)]);
  });
});

describe('completing a run (§2)', () => {
  /** King down to ace, all one suit, sitting on one hidden card. */
  const kingToTwo = Array.from({ length: 12 }, (_, i) => card(0, RANKS - i));

  it('takes a finished king-to-ace run off the table and flips underneath', () => {
    const b = board({
      suitCount: 4,
      tableau: Array.from({ length: COLUMNS }, (_, i): Pile => {
        if (i === 0) return { down: [card(3, 7)], up: kingToTwo };
        if (i === 1) return { down: [], up: [card(0, 1)] };
        return { down: [], up: [] };
      }),
    });
    // Moving the ace onto the two completes the run.
    const done = moveRun(b, 1, 0, 0)!;
    expect(done.completed).toHaveLength(1);
    expect(done.completed[0]).toHaveLength(RANKS);
    expect(rankOf(done.completed[0]![0]!)).toBe(RANKS);
    expect(done.tableau[0]!.up).toEqual([card(3, 7)]);
    expect(done.tableau[0]!.down).toEqual([]);
  });

  it('does not harvest a thirteen-card tail of mixed suits', () => {
    const mixed = [...kingToTwo.slice(0, 11), card(1, 2), card(0, 1)];
    const b = board({
      suitCount: 4,
      tableau: Array.from({ length: COLUMNS }, (_, i): Pile =>
        i === 0 ? { down: [], up: mixed } : { down: [], up: [] },
      ),
    });
    // Nothing to move; the tail is simply not a complete run.
    expect(b.completed).toHaveLength(0);
    expect(moveRun(b, 0, 12, 1)!.completed).toHaveLength(0);
  });

  it('is won at eight runs', () => {
    const run = Array.from({ length: RANKS }, (_, i) => card(0, RANKS - i));
    expect(isWon(board({ completed: Array.from({ length: 8 }, () => run) }))).toBe(true);
    expect(isWon(board({ completed: Array.from({ length: 7 }, () => run) }))).toBe(false);
  });
});

describe('the stock (§3)', () => {
  it('deals one card to every column and counts down the deals', () => {
    const dealt = dealBoard('ss-free-stock', 1);
    const after = dealRow(dealt)!;
    expect(after.stock).toHaveLength(40);
    expect(dealsLeft(after)).toBe(4);
    for (let i = 0; i < COLUMNS; i++) {
      expect(after.tableau[i]!.up.length).toBe(dealt.tableau[i]!.up.length + 1);
    }
    expect(isValidBoard(after)).toBe(true);
  });

  it('refuses to deal while any column is empty', () => {
    const withEmpty = board({
      stock: Array.from({ length: COLUMNS }, (_, i) => card(0, i + 1)),
      tableau: Array.from({ length: COLUMNS }, (_, i): Pile =>
        i === 3 ? { down: [], up: [] } : { down: [], up: [card(1, 5)] },
      ),
    });
    expect(canDeal(withEmpty)).toBe(false);
    expect(dealRow(withEmpty)).toBeNull();
  });

  it('refuses to deal an empty stock', () => {
    const spent = board({
      stock: [],
      tableau: Array.from({ length: COLUMNS }, (): Pile => ({ down: [], up: [card(1, 5)] })),
    });
    expect(canDeal(spent)).toBe(false);
    expect(dealRow(spent)).toBeNull();
  });

  it('refuses a stock that is not whole undealt rows', () => {
    // 50, 40, 30, 20, 10, 0 are the only lengths a stock can reach (§3).
    for (const count of [5, 15, 60]) {
      const b = boardWithStockOf(count);
      // The fixture is a whole pack: only the stock's length is impossible.
      expect(allCards(b)).toHaveLength(CARD_COUNT);
      expect(new Set(allCards(b)).size).toBe(CARD_COUNT);
      expect(b.stock).toHaveLength(count);
      expect(isValidBoard(b)).toBe(false);
    }
    expect(isValidBoard(boardWithStockOf(40))).toBe(true);
  });

  it('will not deal a short row, even from a stock long enough to fill one', () => {
    // Five would hand `undefined` to the last five columns. Fifteen is the
    // one that hides: it can fill all ten and would leave a stock of five
    // behind for the next press.
    for (const count of [5, 15]) {
      const b = boardWithStockOf(count);
      // Not the empty-column rule doing the refusing — every column is occupied.
      expect(b.tableau.every((pile) => pile.up.length > 0)).toBe(true);
      expect(canDeal(b)).toBe(false);
      expect(dealRow(b)).toBeNull();
    }
  });

  it('runs the deal out in exactly five rows', () => {
    let current = dealBoard('ss-free-five', 1);
    for (let i = 5; i > 0; i--) {
      expect(dealsLeft(current)).toBe(i);
      current = dealRow(current)!;
    }
    expect(dealsLeft(current)).toBe(0);
    expect(canDeal(current)).toBe(false);
    expect(isValidBoard(current)).toBe(true);
  });
});

describe('hasAnyMove (§2)', () => {
  it('is true on a fresh deal, at every difficulty', () => {
    for (const n of [1, 2, 4] as SuitCount[]) {
      expect(hasAnyMove(dealBoard(`ss-free-alive-${n}`, n))).toBe(true);
    }
  });

  it('is false with the stock spent and no card fitting anywhere', () => {
    // Ten columns, each a lone king: nothing is one rank higher than a king,
    // no column is empty, and the stock is gone.
    const dead = board({
      suitCount: 4,
      stock: [],
      tableau: Array.from({ length: COLUMNS }, (_, i): Pile => ({
        down: [],
        up: [card(i % 8, RANKS)],
      })),
    });
    expect(hasAnyMove(dead)).toBe(false);
  });

  it('does not count shuffling a whole column into an empty one as a move', () => {
    const b = board({
      suitCount: 4,
      stock: [],
      tableau: Array.from({ length: COLUMNS }, (_, i): Pile => {
        if (i === 0) return { down: [], up: [card(0, RANKS)] };
        if (i === 1) return { down: [], up: [] };
        return { down: [], up: [card(i % 8, RANKS)] };
      }),
    });
    // Column 1 is empty, so the stock cannot be dealt either — and sliding the
    // lone king from column 0 into it leaves the board exactly as it was.
    expect(canDeal(b)).toBe(false);
    expect(hasAnyMove(b)).toBe(false);
  });
});

describe('columnTop', () => {
  it('reads the face-up end of a column, or null when it is empty', () => {
    const b = board({ tableau: piles([card(0, 5), card(1, 9)], []) });
    expect(columnTop(b, 0)).toBe(card(1, 9));
    expect(columnTop(b, 1)).toBeNull();
    expect(columnTop(b, 99)).toBeNull();
  });
});
