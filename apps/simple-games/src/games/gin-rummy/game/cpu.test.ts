/**
 * What the opponent is, and — the part this title exists to make checkable —
 * what it can see.
 *
 * The first describe block is the contract: the view handed to the CPU is
 * re-derived from a hand whose every hidden card has been changed, and it has
 * to come out identical. If the CPU could see the player's cards or the order
 * of the stock, that test fails; there is no way to pass it by accident.
 *
 * The rest is the ordinary opponent's-behaviour set: legal at every strength,
 * the same answer for the same view and the same tie-break, and the obvious
 * plays actually made.
 */
import { describe, expect, it } from 'vitest';
import { cardOf, sortedCards, type Card, type Suit } from './cards';
import {
  buildCpuView,
  chooseCpuAction,
  completionsOf,
  knowledgeOf,
  riskOf,
  type CpuView,
} from './cpu';
import { applyAction, dealHand } from './engine';
import { createRng, shuffled } from './rng';
import {
  CPU,
  DIFFICULTIES,
  HAND_SIZE,
  isValidHand,
  opponentOf,
  YOU,
  type Difficulty,
  type HandState,
  type PublicEvent,
} from './types';

const SUIT_LETTERS = 'SHDC';
const RANK_LETTERS = 'A23456789TJQK';

function card(text: string): Card {
  const suit = SUIT_LETTERS.indexOf(text[0]!) as Suit;
  const rank = RANK_LETTERS.indexOf(text[1]!) + 1;
  if (suit < 0 || rank < 1) throw new Error(`not a card: ${text}`);
  return cardOf(suit, rank);
}
const hand = (text: string): Card[] => text.split(/\s+/).filter(Boolean).map(card);

function viewOf(options: Partial<CpuView> & { hand: readonly Card[] }): CpuView {
  return {
    seat: CPU,
    difficulty: 'normal',
    phase: 'discard',
    discardPile: [],
    stockCount: 20,
    opponentCardCount: HAND_SIZE,
    takenFromDiscard: null,
    mustDrawStock: false,
    log: [],
    selfScore: 0,
    opponentScore: 0,
    ...options,
    hand: sortedCards(options.hand),
  };
}

describe('what the CPU is allowed to see', () => {
  const dealt = dealHand('gin-view', 1, CPU);
  const view = buildCpuView(dealt, CPU, 'hard', [0, 0]);

  it('is exactly these fields — and none of them is the opponent’s hand', () => {
    // Written out so that adding a field to CpuView is a decision somebody
    // takes in this test, not a line that slips through in another one.
    expect(Object.keys(view).sort()).toEqual(
      [
        'difficulty',
        'discardPile',
        'hand',
        'log',
        'mustDrawStock',
        'opponentCardCount',
        'opponentScore',
        'phase',
        'seat',
        'selfScore',
        'stockCount',
        'takenFromDiscard',
      ].sort(),
    );
    // No seed reaches here either: the deal cannot be worked backwards.
    expect(Object.keys(view)).not.toContain('seed');
    expect(chooseCpuAction).toHaveLength(2);
  });

  /**
   * The same hand with every card the CPU cannot see replaced: the opponent
   * gets ten different cards, and the stock is reshuffled. Nothing the CPU is
   * entitled to has moved, so nothing about its view may move either.
   */
  const reDealt = (): HandState => {
    const swapped = dealt.stock.slice(0, HAND_SIZE);
    const rest = [...dealt.stock.slice(HAND_SIZE), ...dealt.hands[YOU]];
    return {
      ...dealt,
      hands: [sortedCards(swapped), dealt.hands[CPU]],
      stock: shuffled(rest, createRng('gin-view-reshuffle')),
    };
  };

  it('does not move when every hidden card is changed', () => {
    const other = reDealt();
    expect(isValidHand(other)).toBe(true);
    expect(other.hands[YOU]).not.toEqual(dealt.hands[YOU]);
    expect(other.stock).not.toEqual(dealt.stock);
    expect(buildCpuView(other, CPU, 'hard', [0, 0])).toEqual(view);
  });

  it('and neither does what the CPU plays', () => {
    const other = reDealt();
    for (const difficulty of DIFFICULTIES) {
      const before = buildCpuView(dealt, CPU, difficulty, [0, 0]);
      const after = buildCpuView(other, CPU, difficulty, [0, 0]);
      expect(chooseCpuAction(after, 0.5)).toEqual(chooseCpuAction(before, 0.5));
    }
  });

  it('copies rather than shares, so a view cannot be walked back to the hand', () => {
    expect(view.hand).not.toBe(dealt.hands[CPU]);
    expect(view.discardPile).not.toBe(dealt.discard);
    expect(view.log).not.toBe(dealt.log);
  });

  it('counts the hidden cards without naming them', () => {
    expect(view.stockCount).toBe(dealt.stock.length);
    expect(view.opponentCardCount).toBe(HAND_SIZE);
  });
});

describe('reading the public record', () => {
  const took: PublicEvent[] = [
    { kind: 'upcard', card: card('D2') },
    { kind: 'draw-discard', seat: YOU, card: card('S7') },
    { kind: 'discard', seat: YOU, card: card('HK') },
  ];

  it('remembers what the opponent took off the pile', () => {
    const knowledge = knowledgeOf(
      viewOf({ hand: hand('SA S2 S3 H5 H6 H7 D9 DT DJ C8'), log: took, discardPile: hand('HK') }),
    );
    expect([...knowledge.holds]).toEqual([card('S7')]);
    expect(knowledge.takes).toBe(1);
    expect(knowledge.gone.has(card('HK'))).toBe(true);
  });

  it('forgets it once the card comes back down', () => {
    const knowledge = knowledgeOf(
      viewOf({
        hand: hand('SA S2 S3 H5 H6 H7 D9 DT DJ C8'),
        log: [...took, { kind: 'discard', seat: YOU, card: card('S7') }],
        discardPile: hand('HK S7'),
      }),
    );
    expect([...knowledge.holds]).toEqual([]);
  });

  it('prices a card by how much the opponent looks to want it', () => {
    const knowledge = knowledgeOf(
      viewOf({ hand: hand('SA S2 S3 H5 H6 H7 D9 DT DJ C8'), log: took, discardPile: hand('HK') }),
    );
    expect(riskOf(card('S8'), knowledge)).toBe(2); // neighbour in suit
    expect(riskOf(card('H7'), knowledge)).toBe(3); // same rank
    expect(riskOf(card('CK'), knowledge)).toBe(0); // nothing to do with it
  });

  it('knows what would finish a fragment, and that the ace has nothing below it', () => {
    expect(completionsOf(card('S5'), card('S6'))).toEqual([card('S4'), card('S7')]);
    expect(completionsOf(card('SA'), card('S2'))).toEqual([card('S3')]);
    expect(completionsOf(card('SQ'), card('SK'))).toEqual([card('SJ')]);
    expect(completionsOf(card('S5'), card('S7'))).toEqual([card('S6')]);
    expect(sortedCards(completionsOf(card('S5'), card('H5')))).toEqual(hand('D5 C5'));
    expect(completionsOf(card('S5'), card('H9'))).toEqual([]);
  });
});

describe('every strength plays by the rules', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`${difficulty} answers the same view the same way`, () => {
      const view = viewOf({
        difficulty,
        hand: hand('SA S2 S3 H5 H6 H7 D9 DT DJ C8 CK'),
        takenFromDiscard: card('CK'),
      });
      expect(chooseCpuAction(view, 0.25)).toEqual(chooseCpuAction(view, 0.25));
      expect(chooseCpuAction(view, 0.9)).toEqual(chooseCpuAction(view, 0.9));
    });

    it(`${difficulty} never puts back the card it just took`, () => {
      const view = viewOf({
        difficulty,
        hand: hand('SA S2 S3 H5 H6 H7 D9 DT DJ C8 CK'),
        takenFromDiscard: card('CK'),
      });
      for (const tieBreak of [0, 0.33, 0.67, 0.99]) {
        const action = chooseCpuAction(view, tieBreak)!;
        expect(action.kind === 'discard' || action.kind === 'knock').toBe(true);
        expect('card' in action ? action.card : null).not.toBe(card('CK'));
      }
    });

    it(`${difficulty} plays a whole hand out without an illegal move`, () => {
      let state = dealHand(`gin-cpu-${difficulty}`, 1, CPU);
      let guard = 0;
      while (state.phase !== 'over' && guard < 200) {
        const view = buildCpuView(state, state.turn, difficulty, [0, 0]);
        const action = chooseCpuAction(view, createRng(`tie-${guard}`)())!;
        expect(action).not.toBeNull();
        const next = applyAction(state, action);
        expect(next).not.toBeNull();
        state = next!;
        expect(isValidHand(state)).toBe(true);
        guard += 1;
      }
      expect(state.phase).toBe('over');
      expect(guard).toBeLessThan(200);
    });
  }
});

describe('the obvious plays', () => {
  const takers = (view: CpuView) =>
    DIFFICULTIES.map((difficulty) => chooseCpuAction({ ...view, difficulty }, 0.5)!.kind);

  it('takes the upcard when it finishes a meld', () => {
    // The three of spades closes A-2-3.
    const view = viewOf({
      phase: 'draw',
      hand: hand('SA S2 H5 H6 H7 D9 DT DJ C4 CK'),
      discardPile: hand('S3'),
    });
    expect(takers(view)).toEqual(['draw-discard', 'draw-discard', 'draw-discard']);
    expect(takers({ ...view, phase: 'upcard' })).toEqual([
      'take-upcard',
      'take-upcard',
      'take-upcard',
    ]);
  });

  it('takes the upcard when it turns a hand that cannot knock into one that can', () => {
    // Fifteen points of deadwood. Taking the four of diamonds and throwing the
    // king leaves nine — under the limit — even though the four melds nothing.
    const holding = hand('SA S2 S3 S4 H5 H6 H7 CK C2 D3');
    const view = viewOf({ phase: 'draw', hand: holding, discardPile: hand('D4') });
    expect(takers(view)).toEqual(['draw-discard', 'draw-discard', 'draw-discard']);
  });

  it('walks past an upcard that does nothing', () => {
    const view = viewOf({
      phase: 'draw',
      hand: hand('SA S2 S3 H5 H6 H7 D9 DT DJ C8'),
      discardPile: hand('CQ'),
    });
    expect(takers(view)).toEqual(['draw-stock', 'draw-stock', 'draw-stock']);
  });

  it('knocks for gin whenever gin is there', () => {
    // Ten of the eleven cards meld; the king is the declaration.
    const view = viewOf({ hand: hand('SA S2 S3 S4 H5 H6 H7 D9 DT DJ CK') });
    for (const difficulty of DIFFICULTIES) {
      expect(chooseCpuAction({ ...view, difficulty }, 0.5)).toEqual({
        kind: 'knock',
        card: card('CK'),
      });
    }
  });
});

describe('the strengths differ where they say they do', () => {
  /**
   * Eleven cards: three runs and two loose eights. Throwing either leaves the
   * same eight points, so nothing but the read of the table can separate them
   * — and the opponent has visibly been collecting spades around the seven.
   */
  const twoEights = hand('SA S2 S3 H5 H6 H7 D9 DT DJ S8 C8');
  const watched: PublicEvent[] = [
    { kind: 'upcard', card: card('D2') },
    { kind: 'draw-discard', seat: YOU, card: card('S7') },
    { kind: 'discard', seat: YOU, card: card('HK') },
  ];
  const base = { hand: twoEights, log: watched, discardPile: hand('HK'), stockCount: 20 } as const;

  it('normal throws the card it happens to reach first; hard throws the safe one', () => {
    expect(chooseCpuAction(viewOf({ ...base, difficulty: 'normal' }), 0)).toEqual({
      kind: 'discard',
      card: card('S8'),
    });
    expect(chooseCpuAction(viewOf({ ...base, difficulty: 'hard' }), 0)).toEqual({
      kind: 'discard',
      card: card('C8'),
    });
  });

  it('easy knocks the moment it may; the others wait for a tidier hand', () => {
    // Ten points of deadwood is legal to knock on and usually a gift: the
    // defender lays off and takes twenty-five the other way.
    const view = viewOf({ hand: hand('SA S2 S3 H5 H6 H7 D9 DT DJ CT CK'), stockCount: 20 });
    expect(chooseCpuAction({ ...view, difficulty: 'easy' }, 0.5)!.kind).toBe('knock');
    expect(chooseCpuAction({ ...view, difficulty: 'normal' }, 0.5)!.kind).toBe('discard');
    expect(chooseCpuAction({ ...view, difficulty: 'hard' }, 0.5)!.kind).toBe('discard');
  });

  it('hard stops waiting once the opponent has been feeding off the pile', () => {
    const pressed: PublicEvent[] = [
      { kind: 'upcard', card: card('D2') },
      { kind: 'draw-discard', seat: YOU, card: card('S7') },
      { kind: 'discard', seat: YOU, card: card('HK') },
      { kind: 'draw-discard', seat: YOU, card: card('H2') },
      { kind: 'discard', seat: YOU, card: card('HQ') },
    ];
    const view = viewOf({
      difficulty: 'hard',
      hand: hand('SA S2 S3 H5 H6 H7 D9 DT DJ C8 CK'),
      discardPile: hand('HK HQ'),
      stockCount: 20,
    });
    expect(chooseCpuAction(view, 0.5)!.kind).toBe('discard');
    expect(chooseCpuAction({ ...view, log: pressed }, 0.5)!.kind).toBe('knock');
  });

  it('everybody knocks when the stock is nearly gone', () => {
    const view = viewOf({ hand: hand('SA S2 S3 H5 H6 H7 D9 DT DJ CT CK'), stockCount: 6 });
    for (const difficulty of DIFFICULTIES) {
      expect(chooseCpuAction({ ...view, difficulty }, 0.5)!.kind).toBe('knock');
    }
  });
});

describe('turns it has nothing to do with', () => {
  it('returns nothing once the hand is over', () => {
    const view = viewOf({ phase: 'over', hand: hand('SA S2 S3 H5 H6 H7 D9 DT DJ CT') });
    expect(chooseCpuAction(view, 0.5)).toBeNull();
  });

  it('draws from the stock when the pile is locked or empty', () => {
    const holding = hand('SA S2 H5 H6 H7 D9 DT DJ C4 CK');
    const locked = viewOf({
      phase: 'draw',
      hand: holding,
      discardPile: hand('S3'),
      mustDrawStock: true,
    });
    expect(chooseCpuAction(locked, 0.5)).toEqual({ kind: 'draw-stock' });
    const empty = viewOf({ phase: 'draw', hand: holding, discardPile: [] });
    expect(chooseCpuAction(empty, 0.5)).toEqual({ kind: 'draw-stock' });
  });

  it('the seat it plays for is the seat the view was built for', () => {
    const dealt = dealHand('gin-seats', 4, YOU);
    const other: Difficulty = 'normal';
    expect(buildCpuView(dealt, YOU, other, [0, 0]).hand).toEqual(dealt.hands[YOU]);
    expect(buildCpuView(dealt, CPU, other, [0, 0]).hand).toEqual(dealt.hands[CPU]);
    expect(buildCpuView(dealt, CPU, other, [3, 7])).toMatchObject({
      selfScore: 7,
      opponentScore: 3,
    });
    expect(buildCpuView(dealt, opponentOf(CPU), other, [3, 7])).toMatchObject({
      selfScore: 3,
      opponentScore: 7,
    });
  });
});
