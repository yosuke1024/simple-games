/**
 * The arithmetic the whole game rests on: the best way to split a hand, and
 * what the defender can give away onto the knocker's melds.
 *
 * The centrepiece is the cross-check against a reference implementation that
 * shares no code with the one being tested. The reference finds melds by
 * asking of *every* subset of the hand "is this three or more of a rank, or
 * three or more of a suit in a row?", then tries every combination of
 * pairwise-disjoint answers. It is far too slow to ship and far too dull to be
 * wrong, which is exactly what a reference is for: `bestMeldPlan` prunes and
 * memoises, and pruning is where an optimiser stops being optimal.
 */
import { describe, expect, it } from 'vitest';
import {
  cardOf,
  deadwoodTotal,
  deadwoodValueOf,
  RANKS,
  rankOf,
  sortedCards,
  suitOf,
  SUITS,
  type Card,
  type Suit,
} from './cards';
import { bestDefence, bestMeldPlan, candidateMelds, layOff, type Meld } from './melds';
import { createRng, shuffled } from './rng';

const SUIT_LETTERS = 'SHDC';
const RANK_LETTERS = 'A23456789TJQK';

/** 'SA' ace of spades, 'HT' ten of hearts, 'DK' king of diamonds. */
function card(text: string): Card {
  const suit = SUIT_LETTERS.indexOf(text[0]!) as Suit;
  const rank = RANK_LETTERS.indexOf(text[1]!) + 1;
  if (suit < 0 || rank < 1) throw new Error(`not a card: ${text}`);
  return cardOf(suit, rank);
}
const hand = (text: string): Card[] => text.split(/\s+/).filter(Boolean).map(card);

// ---------- the reference ----------

const isSetGroup = (cards: readonly Card[]): boolean =>
  cards.length >= 3 && cards.every((c) => rankOf(c) === rankOf(cards[0]!));

function isRunGroup(cards: readonly Card[]): boolean {
  if (cards.length < 3) return false;
  if (!cards.every((c) => suitOf(c) === suitOf(cards[0]!))) return false;
  const ranks = cards.map(rankOf).sort((a, b) => a - b);
  // Consecutive, and never wrapping past the king back to the ace.
  return ranks.every((rank, index) => index === 0 || rank === ranks[index - 1]! + 1);
}

/** Every legal meld, found by inspecting every subset of the hand. */
function referenceMelds(cards: readonly Card[]): Card[][] {
  const out: Card[][] = [];
  for (let mask = 1; mask < 1 << cards.length; mask++) {
    const subset = cards.filter((_, index) => mask & (1 << index));
    if (subset.length < 3) continue;
    if (isSetGroup(subset) || isRunGroup(subset)) out.push(subset);
  }
  return out;
}

/** The least deadwood any combination of disjoint melds can leave. */
function referenceDeadwood(cards: readonly Card[]): number {
  const sorted = sortedCards(cards);
  const melds = referenceMelds(sorted);
  const masks = melds.map((meld) => meld.reduce((mask, c) => mask | (1 << sorted.indexOf(c)), 0));
  const total = deadwoodTotal(sorted);

  let bestSaved = 0;
  const walk = (start: number, used: number, saved: number): void => {
    if (saved > bestSaved) bestSaved = saved;
    for (let index = start; index < melds.length; index++) {
      if (masks[index]! & used) continue;
      walk(index + 1, used | masks[index]!, saved + deadwoodTotal(melds[index]!));
    }
  };
  walk(0, 0, 0);
  return total - bestSaved;
}

/**
 * The meld with `card` added, or null when the rules do not let it go there.
 * Built by asking the same two questions the reference asks of any group, so
 * it knows nothing about how `layOff` decides anything.
 */
function placedOn(meld: Meld, card: Card): Meld | null {
  const cards = sortedCards([...meld.cards, card]);
  if (cards.length <= 4 && isSetGroup(cards)) return { kind: 'set', cards };
  if (isRunGroup(cards)) return { kind: 'run', cards };
  return null;
}

/**
 * The least deadwood any sequence of legal lay-offs could leave, found by
 * trying every sequence: at each step, put any loose card onto any meld that
 * will take it, and see where it ends up. Memoised on the pool and the melds as
 * they now stand, which is the only reason it finishes.
 *
 * This is deliberately a different shape from the implementation — a walk over
 * placements rather than a choice of what each meld claims — so agreeing with
 * it means agreeing about the answer rather than about the method.
 */
function referenceRemaining(loose: readonly Card[], melds: readonly Meld[]): number {
  const seen = new Map<string, number>();
  const walk = (pool: readonly Card[], state: readonly Meld[]): number => {
    const key = `${pool.join(',')}|${state.map((meld) => meld.cards.join('.')).join('|')}`;
    const cached = seen.get(key);
    if (cached !== undefined) return cached;

    let best = deadwoodTotal(pool);
    for (let index = 0; index < pool.length; index++) {
      for (let meld = 0; meld < state.length; meld++) {
        const grown = placedOn(state[meld]!, pool[index]!);
        if (grown === null) continue;
        const rest = walk(
          pool.filter((_, other) => other !== index),
          state.map((current, other) => (other === meld ? grown : current)),
        );
        if (rest < best) best = rest;
      }
    }
    seen.set(key, best);
    return best;
  };
  return walk(sortedCards(loose), melds);
}

/** Ranks A-6 only: twenty-four cards, where melds and loose cards collide often. */
const SMALL_RANKS = 6;

/** The whole small deck, ascending. */
function smallDeck(): Card[] {
  const out: Card[] = [];
  for (const suit of SUITS)
    for (let rank = 1; rank <= SMALL_RANKS; rank++) out.push(cardOf(suit, rank));
  return out;
}

/**
 * A knocker's lay-down: up to three melds cut out of the small deck.
 *
 * Half of the sets are built to *fight* a run already down — three cards of the
 * rank just past its top end, leaving out the run's own suit, so the set's one
 * opening is the run's next rung. That is the shape the greedy lay-off got
 * wrong, and left to chance it turns up too rarely to be tested by accident.
 */
function randomMelds(rng: () => number): Meld[] {
  const free = new Set<Card>(smallDeck());
  const melds: Meld[] = [];
  const runs: Meld[] = [];
  const take = (cards: readonly Card[], kind: 'set' | 'run'): void => {
    for (const c of cards) free.delete(c);
    const meld: Meld = { kind, cards: sortedCards(cards) };
    melds.push(meld);
    if (kind === 'run') runs.push(meld);
  };

  for (let attempt = 0; attempt < 12 && melds.length < 3; attempt++) {
    const rival = runs.length > 0 && rng() < 0.6 ? runs[Math.floor(rng() * runs.length)]! : null;
    if (rival !== null) {
      const suit = suitOf(rival.cards[0]!);
      const contested = rankOf(rival.cards[rival.cards.length - 1]!) + 1;
      const cards = SUITS.filter((other) => other !== suit).map((other) =>
        cardOf(other, contested),
      );
      if (contested <= SMALL_RANKS && cards.every((c) => free.has(c))) {
        take(cards, 'set');
        continue;
      }
    }
    const rank = 1 + Math.floor(rng() * SMALL_RANKS);
    if (rng() < 0.5) {
      const suits = SUITS.map((suit) => cardOf(suit, rank)).filter((c) => free.has(c));
      const wanted = rng() < 0.75 ? 3 : 4;
      if (suits.length >= wanted) take(shuffled(suits, rng).slice(0, wanted), 'set');
      continue;
    }
    const suit = SUITS[Math.floor(rng() * SUITS.length)]!;
    const length = 3 + Math.floor(rng() * 2);
    const low = 1 + Math.floor(rng() * (SMALL_RANKS - length + 1));
    const cards: Card[] = [];
    for (let step = 0; step < length; step++) cards.push(cardOf(suit, low + step));
    if (cards.every((c) => free.has(c))) take(cards, 'run');
  }
  // Shuffled, because a walk over the melds in order gets a contested card
  // right or wrong depending on which meld it reaches first, and both orders
  // have to be answered the same way.
  return shuffled(melds, rng);
}

/**
 * Every card a meld is waiting for: the fourth a set is missing, and the two
 * rungs past either end of a run. The second rung matters as much as the first
 * — it is the card left stranded when the first goes somewhere else.
 */
function openingsOf(melds: readonly Meld[]): Card[] {
  const out = new Set<Card>();
  for (const meld of melds) {
    if (meld.kind === 'set') {
      const rank = rankOf(meld.cards[0]!);
      for (const suit of SUITS) out.add(cardOf(suit, rank));
      continue;
    }
    const suit = suitOf(meld.cards[0]!);
    const low = rankOf(meld.cards[0]!);
    const high = rankOf(meld.cards[meld.cards.length - 1]!);
    for (const rank of [low - 2, low - 1, high + 1, high + 2]) {
      if (rank >= 1 && rank <= SMALL_RANKS) out.add(cardOf(suit, rank));
    }
  }
  return [...out];
}

/**
 * The defender's loose cards: two to seven of them, drawn hard towards what the
 * melds are waiting for. A random handful almost never wants the same card in
 * two places, and a case where nothing is contested tests nothing.
 */
function randomLoose(melds: readonly Meld[], rng: () => number): Card[] {
  const laid = new Set<Card>();
  for (const meld of melds) for (const c of meld.cards) laid.add(c);
  const size = 2 + Math.floor(rng() * 6);

  const chosen = new Set<Card>();
  for (const card of shuffled(openingsOf(melds), rng)) {
    if (chosen.size >= size) break;
    if (!laid.has(card) && rng() < 0.7) chosen.add(card);
  }
  for (const card of shuffled(smallDeck(), rng)) {
    if (chosen.size >= size) break;
    if (!laid.has(card)) chosen.add(card);
  }
  return sortedCards([...chosen]);
}

/** A plan that describes the hand it was given, whatever its score says. */
function expectConsistent(cards: readonly Card[], plan: ReturnType<typeof bestMeldPlan>): void {
  const seen = new Set<Card>();
  for (const meld of plan.melds) {
    expect(isSetGroup(meld.cards) || isRunGroup(meld.cards)).toBe(true);
    expect(meld.kind).toBe(isSetGroup(meld.cards) ? 'set' : 'run');
    for (const c of meld.cards) {
      expect(cards).toContain(c);
      expect(seen.has(c)).toBe(false);
      seen.add(c);
    }
  }
  expect(plan.deadwood).toEqual(sortedCards(cards).filter((c) => !seen.has(c)));
  expect(plan.deadwoodValue).toBe(deadwoodTotal(plan.deadwood));
}

// ---------- the tests ----------

describe('the best split is the best one', () => {
  it('agrees with the brute-force reference on 240 dealt hands', () => {
    const deck: Card[] = [];
    for (let c = 0; c < 52; c++) deck.push(c);

    for (let round = 0; round < 120; round++) {
      const rng = createRng(`gin-melds-${round}`);
      const shuffledDeck = shuffled(deck, rng);
      // Ten cards is a dealt hand and eleven is one mid-turn; both have to be
      // right, and eleven is where the search space is largest.
      for (const size of [10, 11]) {
        const cards = sortedCards(shuffledDeck.slice(0, size));
        const plan = bestMeldPlan(cards);
        expectConsistent(cards, plan);
        expect(plan.deadwoodValue).toBe(referenceDeadwood(cards));
      }
    }
  });

  it('agrees with the reference on hands built to be awkward', () => {
    const awkward = [
      // The seven of spades is worth more in the run than in the set.
      'S5 S6 S7 H7 D7 C7 SK HK DK CQ',
      // One long suit: every sub-run is a candidate and only some fit together.
      'S2 S3 S4 S5 S6 S7 S8 S9 ST SJ SQ',
      // Two overlapping runs sharing a card.
      'H3 H4 H5 H6 H7 D3 D4 D5 C9 CT CJ',
      // Nothing melds at all.
      'SA H4 D8 CJ S6 H9 DQ C2 S3 HK',
      // Four of a rank plus a run through it, twice over.
      'SA HA DA CA S2 S3 H2 H3 D2 D3 C2',
    ];
    for (const text of awkward) {
      const cards = hand(text);
      const plan = bestMeldPlan(cards);
      expectConsistent(cards, plan);
      expect(plan.deadwoodValue).toBe(referenceDeadwood(cards));
    }
  });

  it('returns the same split for the same hand, whatever order it arrives in', () => {
    const cards = hand('S5 S6 S7 H7 D7 C7 SK HK DK CQ');
    const rng = createRng('gin-melds-order');
    const first = bestMeldPlan(cards);
    for (let round = 0; round < 20; round++) {
      expect(bestMeldPlan(shuffled(cards, rng))).toEqual(first);
    }
  });
});

describe('what counts as a meld', () => {
  it('runs the ace low and never high', () => {
    expect(bestMeldPlan(hand('SA S2 S3 H5 H8 DT')).melds).toEqual([
      { kind: 'run', cards: hand('SA S2 S3') },
    ]);
    // Queen-king-ace is not a run, so all three are deadwood: 10 + 10 + 1.
    const wrapped = bestMeldPlan(hand('SQ SK SA H5 H8 DT'));
    expect(wrapped.melds).toEqual([]);
    expect(wrapped.deadwoodValue).toBe(10 + 10 + 1 + 5 + 8 + 10);
  });

  it('keeps a fourth card in the set rather than as deadwood', () => {
    const plan = bestMeldPlan(hand('S7 H7 D7 C7 SK'));
    expect(plan.melds).toEqual([{ kind: 'set', cards: hand('S7 H7 D7 C7') }]);
    expect(plan.deadwoodValue).toBe(10);
  });

  it('breaks a four-card set up when a run wants one of them more', () => {
    // Keeping all four sevens leaves S5 S6 loose (11). Lending the seven of
    // spades to the run leaves nothing loose at all.
    const plan = bestMeldPlan(hand('S5 S6 S7 H7 D7 C7'));
    expect(plan.deadwoodValue).toBe(0);
    expect(plan.melds).toHaveLength(2);
  });

  it('extends a run as far as it goes', () => {
    const plan = bestMeldPlan(hand('S4 S5 S6 S7 S8 HK'));
    expect(plan.melds).toEqual([{ kind: 'run', cards: hand('S4 S5 S6 S7 S8') }]);
    expect(plan.deadwoodValue).toBe(10);
  });

  it('offers a four-card set and each of its three-card halves as candidates', () => {
    const kinds = candidateMelds(hand('S7 H7 D7 C7')).map((meld) => meld.cards.length);
    expect(kinds).toEqual([4, 3, 3, 3, 3]);
  });
});

describe('lay-offs', () => {
  const knockerRun: Meld = { kind: 'run', cards: hand('H5 H6 H7') };
  const knockerSet: Meld = { kind: 'set', cards: hand('S9 H9 D9') };

  it('extends a run at either end, and keeps going', () => {
    const { layoffs, remaining } = layOff(hand('H4 H8 H9 CK'), [knockerRun]);
    // H8 opens the way for H9; H4 goes on the bottom; the king has nowhere.
    expect(sortedCards(layoffs.map((l) => l.card))).toEqual(hand('H4 H8 H9'));
    expect(remaining).toEqual(hand('CK'));
  });

  it('stops at the ace rather than wrapping to the king', () => {
    const aceRun: Meld = { kind: 'run', cards: hand('DA D2 D3') };
    const { remaining } = layOff(hand('DK DQ D4'), [aceRun]);
    // Only the four goes on: below the ace there is nothing.
    expect(remaining).toEqual(sortedCards(hand('DQ DK')));
  });

  it('takes the fourth card of a set and nothing else', () => {
    const { layoffs, remaining } = layOff(hand('C9 C8'), [knockerSet]);
    expect(layoffs).toEqual([{ card: card('C9'), meldIndex: 0 }]);
    expect(remaining).toEqual(hand('C8'));
  });

  it('has nothing to give away when there are no melds down (gin)', () => {
    const loose = hand('H4 H8 C9');
    expect(layOff(loose, [])).toEqual({ layoffs: [], remaining: sortedCards(loose) });
  });

  it('lends a contested card to the run rather than the set behind it', () => {
    // The five of clubs is the only card the three fives are missing *and* the
    // next rung of the club run's ladder. Filling the set with it strands the
    // six of clubs at six points; lending it to the run takes the six with it.
    const fives: Meld = { kind: 'set', cards: hand('S5 H5 D5') };
    const clubs: Meld = { kind: 'run', cards: hand('C2 C3 C4') };
    const { layoffs, remaining } = layOff(hand('C5 C6'), [fives, clubs]);
    expect(remaining).toEqual([]);
    expect(layoffs).toEqual([
      { card: card('C5'), meldIndex: 1 },
      { card: card('C6'), meldIndex: 1 },
    ]);
  });

  it('still fills the set when the run has nothing behind the shared card', () => {
    // The same collision without the six: nothing is waiting on the ladder, so
    // the five may as well complete the set, and the count is the same either way.
    const fives: Meld = { kind: 'set', cards: hand('S5 H5 D5') };
    const clubs: Meld = { kind: 'run', cards: hand('C2 C3 C4') };
    const { layoffs, remaining } = layOff(hand('C5'), [fives, clubs]);
    expect(remaining).toEqual([]);
    expect(layoffs).toEqual([{ card: card('C5'), meldIndex: 0 }]);
  });

  it('leaves as little as any assignment of the same cards could', () => {
    for (let round = 0; round < 300; round++) {
      const rng = createRng(`gin-layoff-${round}`);
      const melds = randomMelds(rng);
      const loose = randomLoose(melds, rng);
      const { layoffs, remaining } = layOff(loose, melds);

      // Every card is accounted for, exactly once...
      expect(sortedCards([...layoffs.map((l) => l.card), ...remaining])).toEqual(
        sortedCards(loose),
      );
      // ...each lay-off is legal on the meld it names, in the order given...
      let state = melds;
      for (const { card: laid, meldIndex } of layoffs) {
        const grown = placedOn(state[meldIndex]!, laid);
        expect(grown).not.toBeNull();
        state = state.map((meld, index) => (index === meldIndex ? grown! : meld));
      }
      // ...and nothing was left behind that any other assignment could place.
      expect(deadwoodTotal(remaining)).toBe(referenceRemaining(loose, melds));
    }
  });
});

describe('the defence chooses its split and its lay-offs together', () => {
  /**
   * Five cards that make the trade visible: four sixes and the five of clubs.
   * The best split on its own is the four-card set, leaving the five loose.
   * But the six of clubs is also the bridge the five needs to reach a club
   * run, so lending it away turns a five-point hand into a nothing — and only
   * a search that decides the split and the lay-offs together can see that.
   */
  const traded = hand('C5 C6 S6 H6 D6');

  it('breaks up its own set when lending a card away clears more', () => {
    const clubRun: Meld[] = [{ kind: 'run', cards: hand('C7 C8 C9') }];
    expect(bestMeldPlan(traded).deadwoodValue).toBe(5);

    const defence = bestDefence(traded, clubRun);
    expect(defence.deadwoodValue).toBe(0);
    expect(defence.melds).toEqual([{ kind: 'set', cards: hand('S6 H6 D6') }]);
    // The six goes on first and opens the way for the five.
    expect(defence.layoffs).toEqual([
      { card: card('C6'), meldIndex: 0 },
      { card: card('C5'), meldIndex: 0 },
    ]);
  });

  it('keeps the set together when there is nothing to lend it to', () => {
    const noClubs: Meld[] = [{ kind: 'set', cards: hand('S9 H9 D9') }];
    const defence = bestDefence(traded, noClubs);
    expect(defence.melds).toEqual([{ kind: 'set', cards: hand('S6 H6 D6 C6') }]);
    expect(defence.layoffs).toEqual([]);
    expect(defence.deadwood).toEqual(hand('C5'));
    expect(defence.deadwoodValue).toBe(5);
  });

  it('never scores worse than its own best split alone', () => {
    const deck: Card[] = [];
    for (let c = 0; c < 52; c++) deck.push(c);
    for (let round = 0; round < 40; round++) {
      const shuffledDeck = shuffled(deck, createRng(`gin-defence-${round}`));
      const knocker = shuffledDeck.slice(0, 10);
      const defender = shuffledDeck.slice(10, 20);
      const knockerMelds = bestMeldPlan(knocker).melds;
      const defence = bestDefence(defender, knockerMelds);
      expect(defence.deadwoodValue).toBeLessThanOrEqual(bestMeldPlan(defender).deadwoodValue);
      // And what it claims to have done adds up.
      const placed = new Set<Card>(defence.layoffs.map((l) => l.card));
      for (const meld of defence.melds) for (const c of meld.cards) placed.add(c);
      expect(defence.deadwood).toEqual(sortedCards(defender).filter((c) => !placed.has(c)));
      expect(defence.deadwoodValue).toBe(deadwoodTotal(defence.deadwood));
    }
  });
});

describe('what a card costs', () => {
  it('prices the ace at one, the pips at their face, the court at ten', () => {
    expect(deadwoodValueOf(card('SA'))).toBe(1);
    for (let rank = 2; rank <= 10; rank++) expect(deadwoodValueOf(cardOf(0, rank))).toBe(rank);
    for (let rank = 11; rank <= RANKS; rank++) expect(deadwoodValueOf(cardOf(0, rank))).toBe(10);
  });
});
