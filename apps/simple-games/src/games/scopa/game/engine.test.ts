/**
 * The rules of one deal, one at a time (docs/SCOPA_RULES.md §1–§3; ① and ⑧ of
 * §15.2). The capture enumeration is checked against a brute force written
 * separately, over every table shape the rules allow — not a sample of them.
 */
import { describe, expect, it } from 'vitest';
import {
  CARD_COUNT,
  cardOf,
  faceOf,
  FULL_DECK,
  primieraValueOf,
  SEVEN_OF_DIAMONDS,
  sortedCards,
  SUITS,
  valueOf,
  type Card,
  type Suit,
} from './cards';
import {
  applyMove,
  applyRefill,
  captureOptions,
  captureSummary,
  dealDeal,
  dealerOf,
  dealKey,
  dealOrder,
  enumerateCaptures,
  firstDealerOf,
  isCompleteDeck,
  isScopaMove,
  legalMoves,
  movesFor,
  phaseOf,
  primieraOf,
  primieraWinner,
  seatToPlay,
  settleDeal,
  shuffleDeck,
  type DeckShuffler,
  type PrimieraTally,
} from './engine';
import { createRng } from './rng';
import { statusOf } from './session';
import {
  card,
  cards,
  cpuStrategy,
  dealWith,
  playMatch,
  randomCardThenOption,
  randomPairs,
  seats,
} from './test-helpers';
import {
  CPU,
  MAX_DEAL_POINTS,
  MAX_REDEALS,
  MAX_SCOPAS_PER_DEAL,
  PLAYS_PER_DEAL,
  ROUNDS_PER_DEAL,
  YOU,
  type DealState,
  type Play,
} from './types';

/** For the exhaustive and self-play tests: a few seconds alone, more under a parallel run. */
const HEAVY_TIMEOUT_MS = 30_000;

describe('the deck (§1)', () => {
  it('is forty cards, suit × 10 + (value − 1), with 7♦ at 26', () => {
    expect(FULL_DECK).toHaveLength(40);
    expect(SEVEN_OF_DIAMONDS).toBe(26);
    expect(card('7D')).toBe(26);
    expect(valueOf(card('JS'))).toBe(8);
    expect(valueOf(card('QH'))).toBe(9);
    expect(valueOf(card('KC'))).toBe(10);
    expect(valueOf(card('AD'))).toBe(1);
    expect(FULL_DECK.map(faceOf).slice(0, 10).join(' ')).toBe('A 2 3 4 5 6 7 J Q K');
  });

  it('keeps the primiera table in one place', () => {
    const byFace = Object.fromEntries(
      FULL_DECK.slice(0, 10).map((c) => [faceOf(c), primieraValueOf(c)]),
    );
    expect(byFace).toEqual({
      '7': 21,
      '6': 18,
      A: 16,
      '5': 15,
      '4': 14,
      '3': 13,
      '2': 12,
      J: 10,
      Q: 10,
      K: 10,
    });
  });
});

describe('dealing (§2.1)', () => {
  it('deals three each, alternately and non-dealer first, then four to the table', () => {
    const order = shuffleDeck(dealKey('scopa-deal', 1, 0));
    const deal = dealDeal('scopa-deal', 1, CPU);
    // The CPU deals, so the player is dealt positions 0, 2, 4.
    expect(deal.hands[YOU]).toEqual(sortedCards([order[0]!, order[2]!, order[4]!]));
    expect(deal.hands[CPU]).toEqual(sortedCards([order[1]!, order[3]!, order[5]!]));
    expect(deal.table).toEqual(order.slice(6, 10));
    expect(deal.stock).toEqual(order.slice(10));
    expect(deal.stock).toHaveLength(30);
    expect(isCompleteDeck(deal)).toBe(true);
    expect(seatToPlay(deal)).toBe(YOU);
    expect(seatToPlay(dealDeal('scopa-deal', 1, YOU))).toBe(CPU);
  });

  it('shuffles the ascending deck under the deal’s own key', () => {
    expect(dealKey('s', 3, 0)).toBe('s:deal:3');
    expect(dealKey('s', 3, 2)).toBe('s:deal:3:2');
    const keys: string[] = [];
    dealOrder('s', 3, (key) => {
      keys.push(key);
      return shuffleDeck(key);
    });
    expect(keys[0]).toBe('s:deal:3');
  });

  it('alternates the dealer deal by deal, from a coin toss on the seed', () => {
    let you = 0;
    for (let i = 0; i < 400; i++) {
      const seed = `scopa-dealer-${i}`;
      const first = firstDealerOf(seed);
      if (first === YOU) you += 1;
      expect(dealerOf(seed, 1)).toBe(first);
      expect(dealerOf(seed, 2)).toBe(first === YOU ? CPU : YOU);
      expect(dealerOf(seed, 3)).toBe(first);
      expect(createRng(`${seed}:dealer`)() < 0.5).toBe(first === YOU);
    }
    // A coin, not a constant.
    expect(you).toBeGreaterThan(150);
    expect(you).toBeLessThan(250);
  });

  it('reshuffles a table with three kings or more, under the next attempt’s key', () => {
    let found: string | null = null;
    for (let i = 0; i < 20_000 && found === null; i++) {
      const seed = `scopa-redeal-${i}`;
      if (dealOrder(seed, 1).redeals > 0) found = seed;
    }
    expect(found).not.toBeNull();
    const seed = found!;
    const first = shuffleDeck(dealKey(seed, 1, 0));
    expect(first.slice(6, 10).filter((c) => valueOf(c) === 10).length).toBeGreaterThanOrEqual(3);
    const { order, redeals } = dealOrder(seed, 1);
    expect(redeals).toBe(1);
    expect(order).toEqual(shuffleDeck(dealKey(seed, 1, 1)));
    const deal = dealDeal(seed, 1, CPU);
    expect(deal.redeals).toBe(1);
    expect(deal.table.filter((c) => valueOf(c) === 10).length).toBeLessThan(3);
    expect(deal.plays).toHaveLength(0);
  });

  /** An order with all four kings on the table, or an ordinary one. */
  const kingsOnTable: readonly Card[] = (() => {
    const kings = SUITS.map((suit) => cardOf(suit, 10));
    const rest = FULL_DECK.filter((c) => !kings.includes(c));
    return [...rest.slice(0, 6), ...kings, ...rest.slice(6)];
  })();

  it('stops at the cap and uses the ninth shuffle as it falls', () => {
    const keys: string[] = [];
    const always: DeckShuffler = (key) => {
      keys.push(key);
      return kingsOnTable;
    };
    const { order, redeals } = dealOrder('cap', 1, always);
    expect(redeals).toBe(MAX_REDEALS);
    expect(keys).toHaveLength(MAX_REDEALS + 1);
    expect(keys).toEqual(Array.from({ length: 9 }, (_, attempt) => dealKey('cap', 1, attempt)));
    expect(order).toBe(kingsOnTable);
    const deal = dealDeal('cap', 1, YOU, always);
    expect(deal.table.filter((c) => valueOf(c) === 10)).toHaveLength(4);
    expect(isCompleteDeck(deal)).toBe(true);
  });

  it('stops at exactly the k-th shuffle that falls short of three kings', () => {
    for (let k = 1; k <= MAX_REDEALS + 1; k++) {
      let calls = 0;
      const shuffle: DeckShuffler = () => {
        calls += 1;
        return calls < k ? kingsOnTable : FULL_DECK;
      };
      expect(dealOrder('k', 1, shuffle).redeals).toBe(k - 1);
      expect(calls).toBe(k);
    }
  });
});

describe('captures (§2.2)', () => {
  it('takes the same value before any sum', () => {
    // Quick Rules picture 1: 5♣ onto 5♥ 2♠ 3♦ — the sum 2 + 3 is not on offer.
    const table = cards('5H 2S 3D');
    expect(captureOptions(table, card('5C'))).toEqual([[card('5H')]]);
    const deal = dealWith({ dealer: CPU, hands: [cards('5C'), cards('AS')], table });
    expect(applyMove(deal, { card: card('5C'), captured: cards('2S 3D') })).toBeNull();
    const took = applyMove(deal, { card: card('5C'), captured: cards('5H') })!;
    expect(took.table).toEqual(cards('2S 3D'));
    expect(took.captured[YOU]).toEqual(sortedCards(cards('5C 5H')));
  });

  it('lets the player choose between two cards of the same value', () => {
    const table = cards('4S 4D 2C');
    expect(captureOptions(table, card('4H'))).toEqual([[card('4S')], [card('4D')]]);
    const deal = dealWith({ dealer: CPU, hands: [cards('4H'), cards('AS')], table });
    expect(applyMove(deal, { card: card('4H'), captured: cards('4D') })!.table).toEqual(
      cards('4S 2C'),
    );
  });

  it('lists every sum of two or more cards when no card matches', () => {
    const table = cards('AS 2H 3D 4C 5S');
    // 6 = A+5, 2+4, A+2+3.
    expect(captureOptions(table, card('6H'))).toEqual([
      cards('AS 5S'),
      cards('AS 2H 3D'),
      cards('2H 4C'),
    ]);
    // K (10) = A+4+5, A+2+3+4, 2+3+5 — each set ascending by card number, the
    // sets in lexicographic order (A♠ 0, 5♠ 4, 2♥ 11, 3♦ 22, 4♣ 33).
    expect(captureOptions(table, card('KS'))).toEqual([
      sortedCards(cards('AS 5S 4C')),
      sortedCards(cards('AS 2H 3D 4C')),
      sortedCards(cards('5S 2H 3D')),
    ]);
    expect(captureOptions(cards('KS KH'), card('5D'))).toEqual([]);
  });

  it('places a card that cannot take, and never one that can', () => {
    const deal = dealWith({
      dealer: CPU,
      hands: [cards('6S 2D'), cards('AS')],
      table: cards('3H 4C'),
    });
    expect(legalMoves(deal)).toEqual([
      { card: card('6S'), captured: [] },
      { card: card('2D'), captured: [] },
    ]);
    const placed = applyMove(deal, { card: card('6S'), captured: [] })!;
    expect(placed.table).toEqual(cards('3H 4C 6S'));
    expect(placed.lastCapturer).toBeNull();
    // 7 takes 3 + 4: it may not be placed instead.
    const seven = dealWith({
      dealer: CPU,
      hands: [cards('7S'), cards('AS')],
      table: cards('3H 4C'),
    });
    expect(applyMove(seven, { card: card('7S'), captured: [] })).toBeNull();
    expect(applyMove(seven, { card: card('7S'), captured: cards('4C 3H') })).not.toBeNull();
  });

  it('refuses a card out of turn, a card not in hand, and a set that does not add up', () => {
    const deal = dealWith({
      dealer: CPU,
      hands: [cards('7S'), cards('7H')],
      table: cards('3H 4C 2D'),
    });
    expect(seatToPlay(deal)).toBe(YOU);
    expect(applyMove(deal, { card: card('7H'), captured: cards('3H 4C') })).toBeNull();
    expect(applyMove(deal, { card: card('7C'), captured: cards('3H 4C') })).toBeNull();
    expect(applyMove(deal, { card: card('7S'), captured: cards('3H 2D') })).toBeNull();
    expect(applyMove(deal, { card: card('7S'), captured: cards('3H 4C 2D') })).toBeNull();
    expect(applyMove(deal, { card: card('7S'), captured: cards('3H 4S') })).toBeNull();
  });

  it('counts a scopa for emptying the table, by a match or by a sum', () => {
    // Quick Rules picture 2: 7♥ takes 2♣ + 5♠ and empties the table.
    const deal = dealWith({
      dealer: CPU,
      hands: [cards('7H'), cards('AS')],
      table: cards('2C 5S'),
    });
    const move = { card: card('7H'), captured: cards('2C 5S') };
    expect(isScopaMove(deal, move)).toBe(true);
    const took = applyMove(deal, move)!;
    expect(took.table).toEqual([]);
    expect(took.scopas).toEqual([1, 0]);
    expect(took.lastCapturer).toBe(YOU);
    const single = dealWith({ dealer: YOU, hands: [cards('AS'), cards('3H')], table: cards('3C') });
    expect(applyMove(single, { card: card('3H'), captured: cards('3C') })!.scopas).toEqual([0, 1]);
  });

  it('does not count a placement on an empty table as anything', () => {
    const deal = dealWith({ dealer: CPU, hands: [cards('5S'), cards('AS')], table: [] });
    expect(legalMoves(deal)).toEqual([{ card: card('5S'), captured: [] }]);
    const placed = applyMove(deal, { card: card('5S'), captured: [] })!;
    expect(placed.scopas).toEqual([0, 0]);
    expect(placed.table).toEqual(cards('5S'));
  });

  /** A deal on its thirty-sixth card: thirty-five plays behind it, the dealer to play. */
  const lastCard = (fields: Partial<DealState>): DealState =>
    dealWith({
      dealer: YOU,
      rounds: ROUNDS_PER_DEAL,
      plays: Array.from({ length: PLAYS_PER_DEAL - 1 }, (_, at): Play => ({
        seat: at % 2 === 0 ? CPU : YOU,
        card: 0,
        captured: [],
      })),
      ...fields,
    });

  it('does not count a scopa on the deal’s last card, though the take stands', () => {
    const deal = lastCard({ hands: [cards('7H'), []], table: cards('2C 5S'), lastCapturer: CPU });
    expect(seatToPlay(deal)).toBe(YOU);
    const move = { card: card('7H'), captured: cards('2C 5S') };
    expect(isScopaMove(deal, move)).toBe(false);
    const done = applyMove(deal, move)!;
    expect(done.scopas).toEqual([0, 0]);
    expect(done.captured[YOU]).toEqual(sortedCards(cards('7H 2C 5S')));
    expect(phaseOf(done)).toBe('over');
    expect(done.sweep).toEqual({ seat: YOU, cards: [] });
  });

  it('gives the table left at the end to the last side to take — not as a scopa', () => {
    const deal = lastCard({
      hands: [cards('6H'), []],
      table: cards('AS 2C'),
      captured: [[], cards('3S')],
      lastCapturer: CPU,
    });
    const done = applyMove(deal, { card: card('6H'), captured: [] })!;
    expect(done.table).toEqual([]);
    expect(done.sweep).toEqual({ seat: CPU, cards: cards('AS 2C 6H') });
    expect(done.captured[CPU]).toEqual(sortedCards(cards('3S AS 2C 6H')));
    expect(done.scopas).toEqual([0, 0]);
    expect(done.lastCapturer).toBe(CPU);
  });

  it('refuses a thirty-sixth card when nobody has taken, rather than give the table to nobody', () => {
    // §2.2 proves this state is never reached; the engine does not invent a settlement for it.
    const deal = lastCard({ hands: [cards('6H'), []], table: cards('AS 2C'), lastCapturer: null });
    expect(seatToPlay(deal)).toBe(YOU);
    expect(applyMove(deal, { card: card('6H'), captured: [] })).toBeNull();
    // The same card with somebody having taken is played as usual.
    expect(
      applyMove({ ...deal, lastCapturer: YOU }, { card: card('6H'), captured: [] }),
    ).not.toBeNull();
  });
});

describe('a whole deal (§2.1, §3.1)', () => {
  it('refills three each from the stock top, non-dealer first, nothing to the table', () => {
    const stock = cards('AS 2S 3S 4S 5S 6S 7S');
    const deal = dealWith({ dealer: CPU, stock, table: cards('KH'), plays: [] });
    expect(phaseOf(deal)).toBe('refill');
    const refilled = applyRefill(deal)!;
    expect(refilled.hands[YOU]).toEqual(cards('AS 3S 5S'));
    expect(refilled.hands[CPU]).toEqual(cards('2S 4S 6S'));
    expect(refilled.stock).toEqual(cards('7S'));
    expect(refilled.table).toEqual(cards('KH'));
    expect(refilled.rounds).toBe(2);
    expect(applyRefill(refilled)).toBeNull();
  });

  it('runs six rounds and thirty-six cards, and every card ends with one side', () => {
    for (let i = 0; i < 30; i++) {
      const match = playMatch(`scopa-whole-${i}`, seats(randomPairs, cpuStrategy), {
        keepStates: true,
        maxDeals: 1,
      });
      const final = match.deals[0]!.final;
      expect(final.plays).toHaveLength(PLAYS_PER_DEAL);
      expect(final.rounds).toBe(ROUNDS_PER_DEAL);
      expect(final.stock).toHaveLength(0);
      expect(final.table).toHaveLength(0);
      expect(final.captured[YOU].length + final.captured[CPU].length).toBe(CARD_COUNT);
      expect(final.plays[PLAYS_PER_DEAL - 1]!.seat).toBe(final.dealer);
      // Six plays a round, the non-dealer always first.
      final.plays.forEach((play, at) =>
        expect(play.seat).toBe(at % 2 === 0 ? (final.dealer === YOU ? CPU : YOU) : final.dealer),
      );
      for (const state of match.states) expect(isCompleteDeck(state.deal)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// The enumeration, against a brute force, over every table the rules allow
// ---------------------------------------------------------------------------

/**
 * Every table shape the rules allow (§2.2): a multiset of values where the
 * values held two or more times account for four cards at most, every other
 * value at most once. The bound counts shapes, reachable or not.
 */
function tableShapes(): number[][] {
  const shapes: number[][] = [];
  const counts: number[] = [];
  const walk = (value: number, repeated: number): void => {
    if (value > 10) {
      shapes.push(counts.slice());
      return;
    }
    for (let count = 0; count <= 4; count++) {
      const extra = count >= 2 ? count : 0;
      if (repeated + extra > 4) break;
      counts.push(count);
      walk(value + 1, repeated + extra);
      counts.pop();
    }
  };
  walk(1, 0);
  return shapes;
}

const tableOfShape = (counts: readonly number[]): Card[] =>
  counts.flatMap((count, at) =>
    Array.from({ length: count }, (_, suit) => cardOf(suit as Suit, at + 1)),
  );

const lexicographic = (a: readonly Card[], b: readonly Card[]): number => {
  for (let at = 0; at < Math.min(a.length, b.length); at++) {
    if (a[at] !== b[at]) return a[at]! - b[at]!;
  }
  return a.length - b.length;
};

/** The rules of §2.2 read literally, over all 2ⁿ subsets — no pruning, no shared code. */
function bruteForce(table: readonly Card[]): Card[][][] {
  const sorted = [...table].sort((a, b) => a - b);
  const n = sorted.length;
  const sums = new Int32Array(1 << n);
  const out: Card[][][] = Array.from({ length: 11 }, () => []);
  for (let mask = 1; mask < 1 << n; mask++) {
    const low = mask & -mask;
    const bit = 31 - Math.clz32(low);
    sums[mask] = sums[mask ^ low]! + ((sorted[bit]! % 10) + 1);
  }
  for (let v = 1; v <= 10; v++) {
    const same = sorted.filter((c) => (c % 10) + 1 === v);
    if (same.length > 0) {
      out[v] = same.map((c) => [c]);
      continue;
    }
    const sets: Card[][] = [];
    for (let mask = 1; mask < 1 << n; mask++) {
      if (sums[mask] !== v || (mask & (mask - 1)) === 0) continue;
      sets.push(sorted.filter((_, at) => (mask >> at) & 1));
    }
    out[v] = sets.sort(lexicographic);
  }
  return out;
}

describe('the one enumeration (§2.2) — every table shape, exhaustively', () => {
  const shapes = tableShapes();

  it('covers the 27,904 shapes the rules allow', () => {
    expect(shapes).toHaveLength(27_904);
    expect(Math.max(...shapes.map((s) => s.reduce((a, b) => a + b, 0)))).toBe(13);
  });

  it(
    'agrees with a brute force on every shape and every value, and states its bounds',
    { timeout: HEAVY_TIMEOUT_MS },
    () => {
      let maxNodes = 0;
      let maxNodesShapes: string[] = [];
      let maxOptions = 0;
      let maxOptionsAt = '';
      let maxTaken = 0;
      let mismatches = 0;
      const started = performance.now();
      for (const shape of shapes) {
        const table = tableOfShape(shape);
        const { byValue, nodes } = enumerateCaptures(table);
        const expected = bruteForce(table);
        for (let v = 1; v <= 10; v++) {
          const got = byValue[v]!;
          if (JSON.stringify(got) !== JSON.stringify(expected[v])) mismatches += 1;
          if (got.length > maxOptions) {
            maxOptions = got.length;
            maxOptionsAt = `${shape.join('')} v=${v}`;
          }
          for (const set of got) maxTaken = Math.max(maxTaken, set.length);
        }
        if (nodes > maxNodes) {
          maxNodes = nodes;
          maxNodesShapes = [];
        }
        if (nodes === maxNodes) maxNodesShapes.push(shape.join(''));
      }
      const ms = performance.now() - started;
      console.log(
        `[scopa] enumeration over ${shapes.length} shapes: max nodes ${maxNodes} at ${maxNodesShapes.join(', ')}; ` +
          `max options for one value ${maxOptions} at ${maxOptionsAt}; max cards in one capture ${maxTaken} ` +
          `(+1 played); ${ms.toFixed(0)} ms with the brute force`,
      );
      expect(mismatches).toBe(0);
      expect(maxNodes).toBe(236);
      // Four aces and one each of 2..K: the shape's counts by value 1..10.
      expect(maxNodesShapes).toEqual(['4111111111']);
      expect(maxOptions).toBe(56);
      expect(maxOptionsAt).toBe('4111111110 v=10');
      expect(maxTaken).toBe(6);
    },
  );

  it('gives a real card the brute force’s answer for its value', () => {
    // captureOptions is a lookup into the one enumeration; this checks the
    // lookup (the card's value, not its number) against the separate brute force.
    const rng = createRng('scopa-lookup');
    let looked = 0;
    for (let i = 0; i < 300; i++) {
      const shape = shapes[Math.floor(rng() * shapes.length)]!;
      const table = tableOfShape(shape);
      const expected = bruteForce(table);
      for (const played of FULL_DECK) {
        if (table.includes(played)) continue;
        expect(captureOptions(table, played)).toEqual(expected[valueOf(played)]);
        looked += 1;
      }
    }
    expect(looked).toBeGreaterThan(300 * 26);
  });

  it('never lets a fourteenth card onto a table holding every value', () => {
    // §2.2: thirteen is the ceiling, because a table with all ten values makes
    // every card take. This is the thirteen-card table, built on purpose.
    const table = cards('AS AH AD AC 2S 3S 4S 5S 6S 7S JS QS KS');
    expect(table).toHaveLength(13);
    expect(enumerateCaptures(table).nodes).toBe(236);
    const rest = FULL_DECK.filter((c) => !table.includes(c));
    for (const played of rest) {
      expect(movesFor([played], table).every((move) => move.captured.length > 0)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Scoring (§3.2, §3.3)
// ---------------------------------------------------------------------------

/** A finished deal with the given takings (the plays are placeholders; only their count matters). */
const finished = (you: readonly Card[], cpu: readonly Card[], scopas: [number, number] = [0, 0]) =>
  dealWith({
    captured: [sortedCards(you), sortedCards(cpu)],
    scopas,
    rounds: ROUNDS_PER_DEAL,
    plays: Array.from({ length: PLAYS_PER_DEAL }, () => ({ seat: YOU, card: 0, captured: [] })),
  });

const suitCards = (suit: Suit): Card[] => Array.from({ length: 10 }, (_, v) => cardOf(suit, v + 1));

describe('settling a deal (§3.2)', () => {
  it('awards ♦ and 7♦ a point each and scopas each, and leaves level cards and primiera to nobody', () => {
    // You: all of ♠ and ♦ (20 cards, 10 ♦, 7♦); CPU: all of ♥ and ♣ plus two scopas.
    const outcome = settleDeal(
      finished([...suitCards(0), ...suitCards(2)], [...suitCards(1), ...suitCards(3)], [0, 2]),
    )!;
    expect(outcome.cards).toEqual([20, 20]);
    expect(outcome.awards.cards).toBeNull();
    expect(outcome.awards.diamonds).toBe(YOU);
    expect(outcome.awards.settebello).toBe(YOU);
    // Two suits each: level on suits, level on totals (21 + 21 each).
    expect(outcome.awards.primiera).toBeNull();
    expect(outcome.points).toEqual([2, 2]);
  });

  it('awards the cards point to the side with more than twenty, and primiera to its winner, in the points', () => {
    // CPU: 2–K♠, all of ♥, A♣ and 2♦ — 21 cards over four suits (7♠ 7♥ A♣ 2♦: 21 + 21 + 16 + 12 = 70).
    // You: A♠, ♦ but 2♦ (7♦ among them), 2–K♣ — 19 cards over three suits (16 + 21 + 21 = 58).
    const cpu = [...suitCards(0).slice(1), ...suitCards(1), ...cards('AC 2D')];
    const you = FULL_DECK.filter((c) => !cpu.includes(c));
    const outcome = settleDeal(finished(you, cpu, [1, 3]))!;
    expect(outcome.cards).toEqual([19, 21]);
    expect(outcome.diamonds).toEqual([9, 1]);
    expect([outcome.primiera[YOU].suits, outcome.primiera[YOU].total]).toEqual([3, 58]);
    expect([outcome.primiera[CPU].suits, outcome.primiera[CPU].total]).toEqual([4, 70]);
    expect(outcome.awards).toEqual({ cards: CPU, diamonds: YOU, settebello: YOU, primiera: CPU });
    // You: ♦ + 7♦ + one scopa = 3. CPU: cards + primiera + three scopas = 5.
    expect(outcome.points).toEqual([3, 5]);
  });

  it('leaves a level category to nobody', () => {
    const you = [...suitCards(0).slice(0, 5), ...suitCards(1), ...suitCards(2).slice(0, 5)];
    const cpu = FULL_DECK.filter((c) => !you.includes(c));
    const outcome = settleDeal(finished(you, cpu))!;
    expect(outcome.cards).toEqual([20, 20]);
    expect(outcome.diamonds).toEqual([5, 5]);
    expect(outcome.awards.cards).toBeNull();
    expect(outcome.awards.diamonds).toBeNull();
    // 7♦ went to the CPU; it is never level.
    expect(outcome.awards.settebello).toBe(CPU);
    expect(captureSummary(finished(you, cpu), CPU)).toEqual({
      cards: 20,
      diamonds: 5,
      settebello: true,
      scopas: 0,
    });
  });

  it('is nothing while the deal is still being played', () => {
    expect(settleDeal(dealDeal('scopa-settle', 1, YOU))).toBeNull();
  });
});

describe('primiera (§3.3)', () => {
  it('finds each suit’s best card and its total', () => {
    const tally = primieraOf(cards('7S 6H AD 5C 2S JH'));
    expect(tally.best).toEqual(cards('7S 6H AD 5C'));
    expect(tally.total).toBe(21 + 18 + 16 + 15);
    expect(tally.suits).toBe(4);
    // The Quick Rules picture: 7♠ 7♥ 7♦ 6♣ — 81.
    expect(primieraOf(cards('7S 7H 7D 6C')).total).toBe(81);
    const missing = primieraOf(cards('JS QS'));
    expect(missing.best).toEqual([card('JS'), null, null, null]);
    expect(missing.suits).toBe(1);
  });

  const tally = (suits: number, total: number): PrimieraTally => ({ best: [], suits, total });

  it('follows the four rows of its table', () => {
    expect(primieraWinner(tally(4, 70), tally(4, 60))).toBe(YOU);
    expect(primieraWinner(tally(4, 60), tally(4, 70))).toBe(CPU);
    expect(primieraWinner(tally(4, 60), tally(4, 60))).toBeNull();
    expect(primieraWinner(tally(4, 51), tally(3, 63))).toBe(YOU);
    expect(primieraWinner(tally(3, 63), tally(4, 51))).toBe(CPU);
    expect(primieraWinner(tally(3, 52), tally(2, 42))).toBe(YOU);
    expect(primieraWinner(tally(2, 42), tally(2, 40))).toBe(YOU);
    expect(primieraWinner(tally(2, 42), tally(2, 42))).toBeNull();
  });

  it('gives 51 against 63 to the side with all four suits (the rules’ example)', () => {
    // You: all ten ♠, and only J Q K of ♥ ♦ ♣. CPU: A–7 of ♥ ♦ ♣.
    const you = [
      ...suitCards(0),
      ...([1, 2, 3] as Suit[]).flatMap((s) => [8, 9, 10].map((v) => cardOf(s, v))),
    ];
    const cpu = FULL_DECK.filter((c) => !you.includes(c));
    const [a, b] = [primieraOf(you), primieraOf(cpu)];
    expect([a.suits, a.total, b.suits, b.total]).toEqual([4, 51, 3, 63]);
    expect(primieraWinner(a, b)).toBe(YOU);
    const outcome = settleDeal(finished(you, cpu))!;
    expect(outcome.awards.primiera).toBe(YOU);
    // The primiera point is yours; cards (19 to 21), ♦ (3 to 7) and 7♦ are the CPU's.
    expect(outcome.points).toEqual([1, 3]);
  });

  it('gives a level 63 against 63 to the four-suit side, where counting 0 would give it to nobody', () => {
    // You: all ten ♠ (7♠ 21), 6♥ (18), 2♦ and 2♣ (12 each) and the J Q K of ♥ ♦ ♣ — 63 over four.
    // CPU: the rest, which is A 3 4 5 7 of ♥ and A 3–7 of ♦ ♣ — 7 7 7, 63 over three.
    const you = [
      ...suitCards(0),
      ...cards('6H 2D 2C'),
      ...([1, 2, 3] as Suit[]).flatMap((s) => [8, 9, 10].map((v) => cardOf(s, v))),
    ];
    const cpu = FULL_DECK.filter((c) => !you.includes(c));
    const [a, b] = [primieraOf(you), primieraOf(cpu)];
    expect([a.suits, a.total, b.suits, b.total]).toEqual([4, 63, 3, 63]);
    expect(primieraWinner(a, b)).toBe(YOU);
  });

  it('differs from “a missing suit counts 0” only at four suits against three, the three not lower', () => {
    // Splits of the forty cards biased so that suits go missing often: each
    // suit goes wholly to one side, or is split card by card.
    const rng = createRng('scopa-primiera-splits');
    const zeroRule = (a: PrimieraTally, b: PrimieraTally) =>
      a.total > b.total ? YOU : b.total > a.total ? CPU : null;
    const differences: Record<string, number> = {};
    let shortBoth = 0;
    const splits = 20_000;
    for (let i = 0; i < splits; i++) {
      const you: Card[] = [];
      const cpu: Card[] = [];
      for (const suit of SUITS) {
        const mode = Math.floor(rng() * 3);
        for (const c of suitCards(suit)) {
          const toYou = mode === 0 ? true : mode === 1 ? false : rng() < 0.5;
          (toYou ? you : cpu).push(c);
        }
      }
      const [a, b] = [primieraOf(you), primieraOf(cpu)];
      // A suit cannot be missing from both sides.
      expect(a.suits + b.suits).toBeGreaterThanOrEqual(4);
      if (a.suits < 4 && b.suits < 4) shortBoth += 1;
      const ours = primieraWinner(a, b);
      const theirs = zeroRule(a, b);
      if (ours === theirs) continue;
      // The only disagreement: a full side against a three-suit side whose
      // total is larger (the zero rule gives it the point) or equal (the zero
      // rule gives it to nobody). The table gives it to the full side.
      const [full, short] = a.suits === 4 ? [a, b] : [b, a];
      expect(full.suits).toBe(4);
      expect(short.suits).toBe(3);
      expect(short.total).toBeGreaterThanOrEqual(full.total);
      expect(ours).toBe(a.suits === 4 ? YOU : CPU);
      const key = `4v3 ${short.total > full.total ? 'three higher' : 'level'}`;
      differences[key] = (differences[key] ?? 0) + 1;
    }
    console.log(
      `[scopa] primiera: ${splits} biased splits, ${shortBoth} with both sides short (rules agree on all), ` +
        `disagreements ${JSON.stringify(differences)}`,
    );
    // Pinned for §3.3's numbers — not thresholds.
    expect(shortBoth).toBe(12_325);
    expect(differences).toEqual({ '4v3 level': 3, '4v3 three higher': 6 });
  });
});

describe('the end of a match (§3.4)', () => {
  it('ends at eleven or more with the scores apart, and goes on when level', () => {
    expect(statusOf([10, 10])).toBe('playing');
    expect(statusOf([11, 4])).toBe('won');
    expect(statusOf([9, 11])).toBe('lost');
    expect(statusOf([12, 11])).toBe('won');
    expect(statusOf([11, 13])).toBe('lost');
    expect(statusOf([11, 11])).toBe('playing');
    expect(statusOf([14, 14])).toBe('playing');
  });
});

describe('invariants over self-play (§2.2, §3.2, §9.2)', () => {
  it(
    'never holds more than thirteen on the table, always has a last taker, and every deal scores within its bounds',
    { timeout: HEAVY_TIMEOUT_MS },
    () => {
      let deals = 0;
      let maxTable = 0;
      const strategies = [
        seats(cpuStrategy, cpuStrategy),
        seats(randomPairs, cpuStrategy),
        seats(randomCardThenOption, randomPairs),
      ];
      for (let i = 0; i < 150; i++) {
        const match = playMatch(`scopa-invariant-${i}`, strategies[i % 3]!, { keepStates: true });
        for (const state of match.states) {
          expect(state.deal.table.length).toBeLessThanOrEqual(13);
          maxTable = Math.max(maxTable, state.deal.table.length);
          expect(isCompleteDeck(state.deal)).toBe(true);
        }
        for (const deal of match.deals) {
          deals += 1;
          expect(deal.lastCapturer).not.toBeNull();
          expect(deal.outcome.points[0] + deal.outcome.points[1]).toBeGreaterThanOrEqual(1);
          // …and no more than the arithmetic bound §9.2 holds a save to.
          expect(deal.outcome.points[0] + deal.outcome.points[1]).toBeLessThanOrEqual(
            MAX_DEAL_POINTS,
          );
          expect(deal.outcome.scopas[0] + deal.outcome.scopas[1]).toBeLessThanOrEqual(
            MAX_SCOPAS_PER_DEAL,
          );
          expect(deal.outcome.awards.settebello).not.toBeNull();
        }
      }
      expect(deals).toBeGreaterThan(400);
      expect(maxTable).toBeLessThanOrEqual(13);
    },
  );
});
