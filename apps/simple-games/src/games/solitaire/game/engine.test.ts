/**
 * Move rules (docs/SOLITAIRE_RULES.md §3, §7): what may go where, the flip
 * that follows an emptied run, the unlimited redeal, and the endgame.
 */
import { describe, expect, it } from 'vitest';
import { dealBoard } from './deal';
import {
  autoFinish,
  canAutoFinish,
  canPlaceOnFoundation,
  canPlaceOnTableau,
  draw,
  isWon,
  moveFoundationToTableau,
  moveTableauRun,
  moveTableauToFoundation,
  moveWasteToFoundation,
  wasteTop,
} from './engine';
import { cardOf, isValidBoard, SUITS, type Pile, type SolitaireBoard } from './types';

/** A hand-built board; zones default to empty. */
function board(partial: Partial<SolitaireBoard>): SolitaireBoard {
  const emptyPile: Pile = { down: [], up: [] };
  return {
    stock: [],
    waste: [],
    foundations: SUITS.map(() => []),
    tableau: new Array(7).fill(emptyPile),
    ...partial,
  };
}

const S = (rank: number) => cardOf(0, rank); // spades (black)
const H = (rank: number) => cardOf(1, rank); // hearts (red)
const D = (rank: number) => cardOf(2, rank); // diamonds (red)
const C = (rank: number) => cardOf(3, rank); // clubs (black)

describe('dealBoard', () => {
  it('lays a valid Klondike board (§1)', () => {
    const dealt = dealBoard('deal-test');
    expect(isValidBoard(dealt)).toBe(true);
    expect(dealt.stock.length).toBe(24);
    expect(dealt.tableau.map((pile) => pile.down.length)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(dealt.tableau.every((pile) => pile.up.length === 1)).toBe(true);
  });

  it('is deterministic per seed', () => {
    expect(dealBoard('same')).toEqual(dealBoard('same'));
    expect(dealBoard('a')).not.toEqual(dealBoard('b'));
  });
});

describe('placement rules (§3)', () => {
  it('stacks descending and color-alternating on the tableau', () => {
    const b = board({
      tableau: [{ down: [], up: [H(7)] }, ...new Array<Pile>(6).fill({ down: [], up: [] })],
    });
    expect(canPlaceOnTableau(b, S(6), 0)).toBe(true);
    expect(canPlaceOnTableau(b, D(6), 0)).toBe(false); // red on red
    expect(canPlaceOnTableau(b, S(5), 0)).toBe(false); // wrong rank
  });

  it('accepts only kings on empty piles', () => {
    const b = board({});
    expect(canPlaceOnTableau(b, S(13), 0)).toBe(true);
    expect(canPlaceOnTableau(b, S(12), 0)).toBe(false);
  });

  it('builds foundations by suit from the ace', () => {
    const b = board({ foundations: [[S(1)], [], [], []] });
    expect(canPlaceOnFoundation(b, S(2))).toBe(true);
    expect(canPlaceOnFoundation(b, H(2))).toBe(false);
    expect(canPlaceOnFoundation(b, H(1))).toBe(true);
    expect(canPlaceOnFoundation(b, S(3))).toBe(false);
  });
});

describe('draw and redeal (§3)', () => {
  it('draws one or three, top of the stock first', () => {
    const b = board({ stock: [S(1), S(2), S(3), S(4)] });
    const one = draw(b, 1)!;
    expect(one.waste).toEqual([S(4)]);
    expect(one.stock).toEqual([S(1), S(2), S(3)]);

    const three = draw(b, 3)!;
    expect(three.waste).toEqual([S(4), S(3), S(2)]);
    expect(wasteTop(three)).toBe(S(2));
  });

  it('turns the waste back over on an empty stock — unlimited (§13)', () => {
    const b = board({ stock: [], waste: [S(1), S(2), S(3)] });
    const recycled = draw(b, 1)!;
    expect(recycled.waste).toEqual([]);
    expect(recycled.stock).toEqual([S(3), S(2), S(1)]);
    // Drawing again returns the same order as before the redeal.
    expect(draw(recycled, 1)!.waste).toEqual([S(1)]);
  });

  it('returns null when there is nothing to draw at all', () => {
    expect(draw(board({}), 1)).toBeNull();
  });
});

describe('moveTableauRun (§3)', () => {
  it('moves a whole run and flips the exposed card', () => {
    const b = board({
      tableau: [
        { down: [D(13)], up: [S(8), H(7), S(6)] },
        { down: [], up: [D(9)] },
        ...new Array<Pile>(5).fill({ down: [], up: [] }),
      ],
    });
    const moved = moveTableauRun(b, 0, 0, 1)!;
    expect(moved.tableau[1]!.up).toEqual([D(9), S(8), H(7), S(6)]);
    // The hidden king turned over as part of the move (§3).
    expect(moved.tableau[0]!.down).toEqual([]);
    expect(moved.tableau[0]!.up).toEqual([D(13)]);
  });

  it('moves a partial run from inside a pile', () => {
    const b = board({
      tableau: [
        { down: [], up: [S(8), H(7), S(6)] },
        { down: [], up: [H(9), C(8)] },
        ...new Array<Pile>(5).fill({ down: [], up: [] }),
      ],
    });
    const moved = moveTableauRun(b, 0, 1, 1)!;
    expect(moved.tableau[0]!.up).toEqual([S(8)]);
    expect(moved.tableau[1]!.up).toEqual([H(9), C(8), H(7), S(6)]);
  });

  it('rejects an illegal destination without changing anything', () => {
    const coherent = board({
      tableau: [
        { down: [], up: [S(8)] },
        { down: [], up: [H(10)] },
        ...new Array<Pile>(5).fill({ down: [], up: [] }),
      ],
    });
    expect(moveTableauRun(coherent, 0, 0, 1)).toBeNull();
    expect(moveTableauRun(coherent, 0, 0, 0)).toBeNull();
  });
});

describe('foundation moves (§3)', () => {
  it('sends tops up and can take them back', () => {
    const b = board({
      foundations: [[S(1)], [], [], []],
      tableau: [
        { down: [H(9)], up: [S(2)] },
        { down: [], up: [D(3)] },
        ...new Array<Pile>(5).fill({ down: [], up: [] }),
      ],
    });
    const up = moveTableauToFoundation(b, 0)!;
    expect(up.foundations[0]).toEqual([S(1), S(2)]);
    // The flip happened (§3).
    expect(up.tableau[0]!.up).toEqual([H(9)]);

    const back = moveFoundationToTableau(up, 0, 1)!;
    expect(back.foundations[0]).toEqual([S(1)]);
    expect(back.tableau[1]!.up).toEqual([D(3), S(2)]);
  });

  it('plays the waste top to its foundation', () => {
    const b = board({ waste: [H(5), H(1)] });
    const next = moveWasteToFoundation(b)!;
    expect(next.foundations[1]).toEqual([H(1)]);
    expect(next.waste).toEqual([H(5)]);
    expect(moveWasteToFoundation(next)).toBeNull();
  });
});

describe('auto finish (§7)', () => {
  it('finishes an all-open endgame and counts every card', () => {
    // Every suit is built to 10; the twelve remaining cards sit face up in
    // legal runs (§3), which is exactly the §7 position.
    const b = board({
      foundations: SUITS.map((suit) => Array.from({ length: 10 }, (_, i) => cardOf(suit, i + 1))),
      tableau: [
        { down: [], up: [S(13), D(12), S(11)] },
        { down: [], up: [H(13), S(12), H(11)] },
        { down: [], up: [D(13)] },
        { down: [], up: [cardOf(3, 13), H(12), cardOf(3, 11)] },
        { down: [], up: [D(11)] },
        { down: [], up: [cardOf(3, 12)] },
        { down: [], up: [] },
      ],
    });
    expect(canAutoFinish(b)).toBe(true);
    const result = autoFinish(b)!;
    expect(isWon(result.board)).toBe(true);
    expect(result.moved).toBe(12);
  });

  it('is not offered while cards are hidden or in hand', () => {
    expect(canAutoFinish(board({ stock: [S(1)] }))).toBe(false);
    expect(
      canAutoFinish(
        board({
          tableau: [{ down: [S(1)], up: [S(2)] }, ...new Array<Pile>(6).fill({ down: [], up: [] })],
        }),
      ),
    ).toBe(false);
  });
});
