/**
 * What the opponent is, and — the part this title exists to make checkable —
 * what it can see (docs/SCOPA_RULES.md §4, §5).
 *
 * The first block is the contract: the view handed to the CPU is rebuilt from
 * deals whose hidden cards (your hand and the stock) have been dealt again,
 * and it has to come out identical, and so does the CPU's move. If the CPU
 * could see your cards or the stock's order, that test fails; there is no way
 * to pass it by accident.
 */
import { describe, expect, it } from 'vitest';
import { cardOf, sortedCards, SUITS, type Card, type Suit } from './cards';
import {
  buildCpuView,
  cardGain,
  chooseCpuMove,
  gainOf,
  priceMoves,
  riskOf,
  type CpuView,
  type WorkMeter,
} from './cpu';
import { enumerateCaptures, legalMoves, seatToPlay } from './engine';
import { createRng, shuffled } from './rng';
import { card, cards, cpuStrategy, playMatch, randomPairs, seats } from './test-helpers';
import { CPU, YOU, type DealState } from './types';

function viewOf(fields: Partial<CpuView> & { hand: readonly Card[] }): CpuView {
  return {
    seat: CPU,
    table: [],
    captured: [[], []],
    opponentCardCount: 3,
    stockCount: 12,
    dealer: YOU,
    scopas: [0, 0],
    lastCapturer: null,
    scores: [0, 0],
    ...fields,
    hand: sortedCards(fields.hand),
  };
}

/** Seeds tried at most for `cpuTurns` — a bound, so a regression fails instead of hanging. */
const MAX_TURN_SEEDS = 200;

/** Positions from self-play where the CPU is to play. */
function cpuTurns(count: number): { deal: DealState; scores: readonly [number, number] }[] {
  const out: { deal: DealState; scores: readonly [number, number] }[] = [];
  for (let i = 0; i < MAX_TURN_SEEDS && out.length < count; i++) {
    const match = playMatch(`scopa-cpu-view-${i}`, seats(randomPairs, cpuStrategy), {
      keepStates: true,
    });
    for (const state of match.states) {
      if (seatToPlay(state.deal) === CPU) out.push({ deal: state.deal, scores: state.scores });
    }
  }
  if (out.length < count)
    throw new Error(`only ${out.length} CPU turns in ${MAX_TURN_SEEDS} seeds`);
  return out.slice(0, count);
}

/** For the exhaustive and self-play tests: a few seconds alone, more under a parallel run. */
const HEAVY_TIMEOUT_MS = 30_000;

describe('what the CPU is allowed to see (§5)', () => {
  const turns = cpuTurns(600);

  it('is exactly these fields — none of them your hand or the stock', () => {
    const view = buildCpuView(turns[0]!.deal, CPU, turns[0]!.scores);
    expect(Object.keys(view).sort()).toEqual(
      [
        'captured',
        'dealer',
        'hand',
        'lastCapturer',
        'opponentCardCount',
        'scopas',
        'scores',
        'seat',
        'stockCount',
        'table',
      ].sort(),
    );
  });

  it('does not change, nor does its move, when your hand and the stock are dealt again', () => {
    const rng = createRng('scopa-hidden');
    let checked = 0;
    for (const { deal, scores } of turns) {
      const hidden = [...deal.hands[YOU], ...deal.stock];
      for (let again = 0; again < 3; again++) {
        const mixed = shuffled(hidden, rng);
        const other: DealState = {
          ...deal,
          hands: [sortedCards(mixed.slice(0, deal.hands[YOU].length)), deal.hands[CPU]],
          stock: mixed.slice(deal.hands[YOU].length),
        };
        const a = buildCpuView(deal, CPU, scores);
        const b = buildCpuView(other, CPU, scores);
        expect(b).toEqual(a);
        for (const tie of [0, 0.5, 0.999]) {
          expect(chooseCpuMove(b, tie)).toEqual(chooseCpuMove(a, tie));
        }
        checked += 1;
      }
    }
    expect(checked).toBe(1800);
  });

  it('does not read the order of the table', () => {
    const rng = createRng('scopa-table-order');
    for (const { deal, scores } of turns.slice(0, 200)) {
      const reordered: DealState = { ...deal, table: shuffled(deal.table, rng) };
      expect(chooseCpuMove(buildCpuView(reordered, CPU, scores), 0.3)).toEqual(
        chooseCpuMove(buildCpuView(deal, CPU, scores), 0.3),
      );
    }
  });

  it('is a copy: writing to it leaves the deal alone', () => {
    const { deal, scores } = turns[5]!;
    const before = JSON.stringify(deal);
    const view = buildCpuView(deal, CPU, scores);
    (view.hand as Card[]).push(39);
    (view.table as Card[]).length = 0;
    (view.captured[0] as Card[]).push(0);
    (view.scopas as unknown as number[])[0] = 9;
    expect(JSON.stringify(deal)).toBe(before);
  });
});

describe('what the CPU plays (§4.1)', () => {
  it('always plays a legal move', () => {
    for (const { deal, scores } of cpuTurns(800)) {
      const move = chooseCpuMove(buildCpuView(deal, CPU, scores), 0.42)!;
      expect(legalMoves(deal)).toContainEqual(move);
    }
  });

  it('plays the only legal move when there is one', () => {
    expect(chooseCpuMove(viewOf({ hand: cards('5S'), table: cards('KH') }), 0.9)).toEqual({
      card: card('5S'),
      captured: [],
    });
    expect(chooseCpuMove(viewOf({ hand: cards('5S'), table: cards('5H KH') }), 0.9)).toEqual({
      card: card('5S'),
      captured: cards('5H'),
    });
  });

  it('breaks a tie by the float it is given, over the tied moves in canonical order', () => {
    // Two kings onto an empty table: the same price either way.
    const view = viewOf({ hand: cards('KS KH'), table: [] });
    const priced = priceMoves(view);
    expect(priced.map((p) => p.price)).toEqual([priced[0]!.price, priced[0]!.price]);
    expect(chooseCpuMove(view, 0)).toEqual({ card: card('KS'), captured: [] });
    expect(chooseCpuMove(view, 0.49)).toEqual({ card: card('KS'), captured: [] });
    expect(chooseCpuMove(view, 0.5)).toEqual({ card: card('KH'), captured: [] });
    expect(chooseCpuMove(view, 0.999)).toEqual({ card: card('KH'), captured: [] });
    // And the same view with the same float is the same move, every time.
    expect(chooseCpuMove(view, 0.7)).toEqual(chooseCpuMove(view, 0.7));
  });

  it('prices the rules’ worked examples: a gain of 20 and a risk of 20', () => {
    // 7♣ takes 7♦: 7♣ = 1 + 3, 7♦ = 1 + 2 + 3 + 10.
    expect(cardGain(card('7C'))).toBe(4);
    expect(cardGain(card('7D'))).toBe(16);
    expect(gainOf(cards('7C 7D'), false)).toBe(20);
    // T′ = {2♠, 5♥}: value 2 → 2, value 5 → 2, value 7 → 6 + scopa 10. No suit for the
    // supposed card, so the 7 earns no ♦ and no 7♦.
    expect(riskOf(cards('2S 5H'), false)).toBe(20);
    const priced = priceMoves(viewOf({ hand: cards('7C'), table: cards('7D 2S 5H') }));
    expect(priced).toEqual([
      { move: { card: card('7C'), captured: cards('7D') }, gain: 20, risk: 20, price: 180 },
    ]);
  });

  it('counts a real 7♦ left on the table in full against itself', () => {
    // 7♦ alone on the table: value 7 takes it — 16 for the card, 1 + 3 for the
    // supposed 7, and the scopa's 10.
    expect(riskOf(cards('7D'), false)).toBe(16 + 4 + 10);
  });

  it('takes 7♦ when it can', () => {
    const view = viewOf({ hand: cards('7C 3S'), table: cards('7D 2H AS') });
    expect(chooseCpuMove(view, 0.5)).toEqual({ card: card('7C'), captured: cards('7D') });
  });

  it('does not place the card that leaves a scopa on the table', () => {
    // Neither 2♠ nor K♣ can take 5♥. Placing 2♠ leaves 5 + 2 — a scopa for any 7;
    // placing K♣ leaves nothing that a single card can sweep.
    const view = viewOf({ hand: cards('2S KC'), table: cards('5H') });
    expect(riskOf(cards('5H 2S'), false)).toBe(20);
    expect(riskOf(cards('5H KC'), false)).toBe(4);
    expect(chooseCpuMove(view, 0)).toEqual({ card: card('KC'), captured: [] });
  });

  it('adds no scopa for the deal’s last card — its own or the other side’s', () => {
    // The other side deals and holds its last card; the stock is empty.
    expect(riskOf(cards('2S 5H'), true)).toBe(10);
    const theirs = viewOf({
      hand: cards('2S'),
      table: cards('5H'),
      opponentCardCount: 1,
      stockCount: 0,
      dealer: YOU,
    });
    expect(priceMoves(theirs)[0]!.risk).toBe(riskOf(cards('5H 2S'), true));
    // The CPU deals and this is the thirty-sixth card: the sweep is no scopa,
    // and nothing comes after it.
    const own = viewOf({
      hand: cards('7S'),
      table: cards('2S 5H'),
      opponentCardCount: 0,
      stockCount: 0,
      dealer: CPU,
    });
    expect(priceMoves(own)).toEqual([
      {
        move: { card: card('7S'), captured: sortedCards(cards('2S 5H')) },
        gain: gainOf(cards('7S 2S 5H'), false),
        risk: 0,
        price: 10 * gainOf(cards('7S 2S 5H'), false),
      },
    ]);
  });

  it('prices no risk when the other side has no card left to play this deal', () => {
    const view = viewOf({
      hand: cards('2S 4S'),
      table: cards('5H'),
      opponentCardCount: 0,
      stockCount: 0,
      dealer: CPU,
    });
    expect(priceMoves(view).every((p) => p.risk === 0)).toBe(true);
  });
});

describe('the work one decision does (§4)', () => {
  it(
    'stays inside the arithmetic bound on the worst tables built on purpose',
    { timeout: HEAVY_TIMEOUT_MS },
    () => {
      // Four aces and one each of 2..Q: no king on the table, so a king in hand
      // has the 56 ways of making ten. Every three-card hand by values 2..K.
      const tables = [
        cards('AS AH AD AC 2S 3S 4S 5S 6S 7S JS QS'),
        cards('AS AH AD AC 2S 3S 4S 5S 6S 7S JS QS KS'),
      ];
      let worst = 0;
      let worstAt = '';
      let candidates = 0;
      const hands: number[] = [];
      for (const table of tables) {
        let tried = 0;
        const free = ([1, 2, 3] as Suit[]).flatMap((suit) =>
          Array.from({ length: 9 }, (_, v) => cardOf(suit, v + 2)),
        );
        const pool = [...new Set([...free, ...SUITS.map((s) => cardOf(s, 10))])].filter(
          (c) => !table.includes(c),
        );
        for (let a = 0; a < pool.length; a++) {
          for (let b = a + 1; b < pool.length; b++) {
            for (let c = b + 1; c < pool.length; c++) {
              const hand = [pool[a]!, pool[b]!, pool[c]!];
              const meter: WorkMeter = { nodes: 0 };
              const priced = priceMoves(viewOf({ hand, table }), meter);
              tried += 1;
              candidates = Math.max(candidates, priced.length);
              if (meter.nodes > worst) {
                worst = meter.nodes;
                worstAt = `${table.length}-card table, hand ${hand.join(',')}`;
              }
            }
          }
        }
        hands.push(tried);
      }
      console.log(
        `[scopa] CPU work on the built worst tables: hands tried ${hands.join(' + ')}; ` +
          `max ${worst} subsets in one decision (${worstAt}), ` +
          `max ${candidates} candidates; the arithmetic bound is 168 × 236 + 236 = ${168 * 236 + 236}`,
      );
      expect(enumerateCaptures(tables[0]!).byValue[10]).toHaveLength(56);
      // C(28, 3) from the 28 cards left by the 12-card table, C(27, 3) from the 27 left by the 13.
      expect(hands).toEqual([3_276, 2_925]);
      expect(candidates).toBe(168);
      expect(worst).toBeLessThanOrEqual(168 * 236 + 236);
      expect(worst).toBe(WORST_BUILT_DECISION);
      // K♥ K♦ K♣ on the twelve-card table (§4).
      expect(worstAt).toBe('12-card table, hand 19,29,39');
    },
  );
});

/** Measured by the test above (§15.2): pinned so a change to the work is a change somebody sees. */
const WORST_BUILT_DECISION = 10_252;
