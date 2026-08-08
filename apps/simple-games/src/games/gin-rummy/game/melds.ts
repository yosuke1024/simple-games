/**
 * Melds, the best way to split a hand into them, and lay-offs — the whole of
 * Gin Rummy's arithmetic (docs/plans/2026-08-08-hearts-and-gin-rummy.md,
 * "Gin Rummy").
 *
 * Two shapes count: a **set** of three or four cards of one rank, and a **run**
 * of three or more cards in one suit at consecutive ranks. The ace is low only
 * — A-2-3 is a run, Q-K-A is not — which is why nothing here ever wraps rank 13
 * back round to rank 1.
 *
 * Everything is exhaustive rather than clever. A hand is ten or eleven cards,
 * so the whole space of splits fits in a search over 2^11 subsets, and being
 * able to say "this is the best split, not a good one" is what lets the screen
 * arrange the player's hand for them without ever arranging it wrong (the
 * plan's 助けの形: メルドの自動整理とデッドウッドの常時表示). Ties are broken
 * by enumeration order and pinned by tests, so the same hand always draws the
 * same picture.
 */
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
} from './cards';

export type MeldKind = 'set' | 'run';

export interface Meld {
  readonly kind: MeldKind;
  /** Ascending by card number. Three or four for a set, three or more for a run. */
  readonly cards: readonly Card[];
}

export interface MeldPlan {
  readonly melds: readonly Meld[];
  /** The cards no meld took, ascending. */
  readonly deadwood: readonly Card[];
  /** What that deadwood costs, in points. */
  readonly deadwoodValue: number;
}

/** One deadwood card placed onto a meld the knocker laid down. */
export interface Layoff {
  readonly card: Card;
  /** Index into the knocker's melds, as they were laid down. */
  readonly meldIndex: number;
}

export interface DefenceResult {
  readonly melds: readonly Meld[];
  readonly layoffs: readonly Layoff[];
  readonly deadwood: readonly Card[];
  readonly deadwoodValue: number;
}

/**
 * Every meld that could be built from `cards`, in one fixed order: sets by
 * rank, then runs by suit and starting rank. The order is the tie-break —
 * when two splits leave the same deadwood, the one using the earlier
 * candidate wins — so it is part of the contract, not an implementation
 * detail.
 *
 * A four-card set yields its own four-card meld *and* each of its four
 * three-card subsets. That is not redundancy: the fourth card of a rank is
 * sometimes worth more inside a run, and dropping the subsets would hide the
 * split that uses it there.
 */
export function candidateMelds(cards: readonly Card[]): Meld[] {
  const sorted = sortedCards(cards);
  const out: Meld[] = [];

  for (let rank = 1; rank <= RANKS; rank++) {
    const group = sorted.filter((card) => rankOf(card) === rank);
    if (group.length === 4) {
      out.push({ kind: 'set', cards: group });
      for (let drop = 0; drop < 4; drop++) {
        out.push({ kind: 'set', cards: group.filter((_, index) => index !== drop) });
      }
    } else if (group.length === 3) {
      out.push({ kind: 'set', cards: group });
    }
  }

  for (const suit of SUITS) {
    const inSuit = sorted.filter((card) => suitOf(card) === suit);
    for (let start = 0; start < inSuit.length; start++) {
      for (let end = start + 2; end < inSuit.length; end++) {
        // Consecutive ranks with no gap: the run must be unbroken, and the
        // ace being low means rank 1 is a floor rather than a wrap point.
        if (rankOf(inSuit[end]!) !== rankOf(inSuit[start]!) + (end - start)) break;
        out.push({ kind: 'run', cards: inSuit.slice(start, end + 1) });
      }
    }
  }

  return out;
}

interface Solved {
  readonly value: number;
  readonly melds: readonly Meld[];
}

/** Bitmask of a meld's cards over the hand's sorted positions. */
function maskOf(meld: Meld, position: ReadonlyMap<Card, number>): number {
  let mask = 0;
  for (const card of meld.cards) mask |= 1 << position.get(card)!;
  return mask;
}

/**
 * The split that leaves the least deadwood (§ the plan's "最適分割").
 *
 * The search walks the lowest card the split has not placed yet and tries
 * every meld containing it before trying it as deadwood, memoising on the set
 * of placed cards. Eleven cards means at most 2048 of those sets, so this is
 * exhaustive — the answer is *the* minimum, not a good one — while still
 * cheap enough for the CPU to call it once per candidate discard.
 *
 * Melds come before deadwood at every step and candidates come in
 * `candidateMelds` order, so ties resolve the same way every time.
 */
export function bestMeldPlan(cards: readonly Card[]): MeldPlan {
  const sorted = sortedCards(cards);
  const position = new Map<Card, number>();
  sorted.forEach((card, index) => position.set(card, index));

  const candidates = candidateMelds(sorted);
  const masks = candidates.map((meld) => maskOf(meld, position));
  const byCard: number[][] = sorted.map(() => []);
  masks.forEach((mask, candidate) => {
    for (let index = 0; index < sorted.length; index++) {
      if (mask & (1 << index)) byCard[index]!.push(candidate);
    }
  });

  const complete = (1 << sorted.length) - 1;
  const memo = new Map<number, Solved>();

  const solve = (placed: number): Solved => {
    if (placed === complete) return { value: 0, melds: [] };
    const cached = memo.get(placed);
    if (cached) return cached;

    let lowest = 0;
    while (placed & (1 << lowest)) lowest++;

    let best: Solved | null = null;
    for (const candidate of byCard[lowest]!) {
      if (masks[candidate]! & placed) continue;
      const rest = solve(placed | masks[candidate]!);
      if (best === null || rest.value < best.value) {
        best = { value: rest.value, melds: [candidates[candidate]!, ...rest.melds] };
      }
    }
    const asDeadwood = solve(placed | (1 << lowest));
    const loose = deadwoodValueOf(sorted[lowest]!) + asDeadwood.value;
    if (best === null || loose < best.value) best = { value: loose, melds: asDeadwood.melds };

    memo.set(placed, best!);
    return best!;
  };

  const solved = solve(0);
  const melded = new Set<Card>();
  for (const meld of solved.melds) for (const card of meld.cards) melded.add(card);
  const deadwood = sorted.filter((card) => !melded.has(card));
  return { melds: solved.melds, deadwood, deadwoodValue: solved.value };
}

/** Shorthand for the number the whole game turns on. */
export const deadwoodValueOfHand = (cards: readonly Card[]): number =>
  bestMeldPlan(cards).deadwoodValue;

/**
 * Every combination of melds that can stand together in one hand, deepest
 * first: a combination is always visited before the shorter ones it was built
 * from, and the empty combination comes last. The defence search takes the
 * first combination that reaches its minimum, so this order is what makes it
 * prefer melding a card over leaving it loose when both come to the same
 * number of points.
 */
function forEachCombination(cards: readonly Card[], visit: (melds: readonly Meld[]) => void): void {
  const sorted = sortedCards(cards);
  const position = new Map<Card, number>();
  sorted.forEach((card, index) => position.set(card, index));
  const candidates = candidateMelds(sorted);
  const masks = candidates.map((meld) => maskOf(meld, position));

  const chosen: Meld[] = [];
  const walk = (start: number, placed: number): void => {
    for (let index = start; index < candidates.length; index++) {
      if (masks[index]! & placed) continue;
      chosen.push(candidates[index]!);
      walk(index + 1, placed | masks[index]!);
      chosen.pop();
    }
    visit(chosen);
  };
  walk(0, 0);
}

/** The one card that would complete a three-card set, or null. */
function missingFourth(meld: Meld): Card | null {
  if (meld.kind !== 'set' || meld.cards.length !== 3) return null;
  const present = new Set(meld.cards.map(suitOf));
  const suit = SUITS.find((candidate) => !present.has(candidate));
  return suit === undefined ? null : cardOf(suit, rankOf(meld.cards[0]!));
}

/**
 * Places as many of `loose` as will go onto the knocker's melds and returns
 * what is left (the plan: ランの両端延長・セットの 4 枚目).
 *
 * Extending a run opens the next rank along, so each run is walked outwards
 * until it stops — 4-5-6♠ takes a 7♠ and then an 8♠. Greedy is safe here
 * because a lay-off only ever removes a card from the deadwood and never
 * closes a place another card could have gone: a set has exactly one opening
 * (its missing fourth), and two runs of one suit that could both take the same
 * card can each be extended the other way instead, for the same total.
 *
 * A card melded in the defender's own hand is not in `loose` and so is never
 * laid off — which split to keep and which cards to give away is the caller's
 * decision, made jointly in `bestDefence`.
 */
export function layOff(
  loose: readonly Card[],
  knockerMelds: readonly Meld[],
): { layoffs: Layoff[]; remaining: Card[] } {
  const pool = new Set(loose);
  const layoffs: Layoff[] = [];

  knockerMelds.forEach((meld, meldIndex) => {
    if (meld.kind === 'set') {
      const fourth = missingFourth(meld);
      if (fourth !== null && pool.has(fourth)) {
        pool.delete(fourth);
        layoffs.push({ card: fourth, meldIndex });
      }
      return;
    }
    const suit = suitOf(meld.cards[0]!);
    let low = rankOf(meld.cards[0]!);
    let high = rankOf(meld.cards[meld.cards.length - 1]!);
    // Downwards stops at the ace: it is the bottom of the ladder, not a rung
    // below the king.
    while (low > 1 && pool.has(cardOf(suit, low - 1))) {
      low -= 1;
      const card = cardOf(suit, low);
      pool.delete(card);
      layoffs.push({ card, meldIndex });
    }
    while (high < RANKS && pool.has(cardOf(suit, high + 1))) {
      high += 1;
      const card = cardOf(suit, high);
      pool.delete(card);
      layoffs.push({ card, meldIndex });
    }
  });

  return { layoffs, remaining: sortedCards([...pool]) };
}

/**
 * The defender's best answer to a knock: the split of their own hand and the
 * lay-offs onto the knocker's melds that together leave the fewest points.
 *
 * The two decisions cannot be made one after the other — keeping a card in a
 * meld of your own and giving it away onto the knocker's are alternatives for
 * the same card — so every combination of the defender's melds is tried and
 * scored with its lay-offs. Eleven cards at the very most makes that honest to
 * do exhaustively.
 *
 * Pass an empty `knockerMelds` for gin: there is nothing to lay off against
 * (the plan: ジンへのレイオフはない), and the call then reduces to the
 * defender's own best split.
 */
export function bestDefence(cards: readonly Card[], knockerMelds: readonly Meld[]): DefenceResult {
  const sorted = sortedCards(cards);
  let best: DefenceResult | null = null;

  forEachCombination(sorted, (melds) => {
    const used = new Set<Card>();
    for (const meld of melds) for (const card of meld.cards) used.add(card);
    const loose = sorted.filter((card) => !used.has(card));
    const { layoffs, remaining } = layOff(loose, knockerMelds);
    const deadwoodValue = deadwoodTotal(remaining);
    if (best === null || deadwoodValue < best.deadwoodValue) {
      best = { melds: [...melds], layoffs, deadwood: remaining, deadwoodValue };
    }
  });

  // `forEachCombination` always visits at least the empty combination.
  return best!;
}
