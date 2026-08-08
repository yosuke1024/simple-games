/**
 * Melds, the best way to split a hand into them, and lay-offs — the whole of
 * Gin Rummy's arithmetic (docs/GIN_RUMMY_RULES.md §1, §3.2).
 *
 * Two shapes count: a **set** of three or four cards of one rank, and a **run**
 * of three or more cards in one suit at consecutive ranks. The ace is low only
 * — A-2-3 is a run, Q-K-A is not — which is why nothing here ever wraps rank 13
 * back round to rank 1.
 *
 * Everything is exhaustive rather than clever. A hand is ten or eleven cards,
 * so the whole space of splits fits in a search over 2^11 subsets, and being
 * able to say "this is the best split, not a good one" is what lets the screen
 * arrange the player's hand for them without ever arranging it wrong (§7: the
 * help this game offers is the rules' arithmetic). The same goes for lay-offs:
 * which of the knocker's melds each card goes onto is an assignment problem
 * (`layOff`), not a walk, and it is solved rather than approximated because the
 * points it decides are the undercut. Ties are broken by enumeration order and
 * pinned by tests, so the same hand always draws the same picture.
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
 * The split that leaves the least deadwood (docs/GIN_RUMMY_RULES.md §3.2, §7).
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
 * Every set of cards one meld could take out of `pool`, fullest first.
 *
 * A set offers exactly one place — its missing fourth — so it has two claims:
 * take it, or leave it. A run offers a ladder at each end, and a rung is only
 * reachable once the one under it is filled, so its claims are exactly the
 * pairs "the nearest `below` cards downwards and the nearest `above` upwards".
 * Fullest first, because ties are settled by enumeration order.
 */
function claimsFor(meld: Meld, pool: ReadonlySet<Card>): Card[][] {
  if (meld.kind === 'set') {
    const fourth = missingFourth(meld);
    return fourth !== null && pool.has(fourth) ? [[fourth], []] : [[]];
  }

  const suit = suitOf(meld.cards[0]!);
  // Downwards stops at the ace: it is the bottom of the ladder, not a rung
  // below the king.
  const down: Card[] = [];
  for (let rank = rankOf(meld.cards[0]!) - 1; rank >= 1; rank--) {
    const card = cardOf(suit, rank);
    if (!pool.has(card)) break;
    down.push(card);
  }
  const up: Card[] = [];
  for (let rank = rankOf(meld.cards[meld.cards.length - 1]!) + 1; rank <= RANKS; rank++) {
    const card = cardOf(suit, rank);
    if (!pool.has(card)) break;
    up.push(card);
  }

  const claims: Card[][] = [];
  for (let below = down.length; below >= 0; below--) {
    for (let above = up.length; above >= 0; above--) {
      claims.push([...down.slice(0, below), ...up.slice(0, above)]);
    }
  }
  return claims;
}

/** One meld's chosen claim, and what the rest of the melds did with the rest. */
interface Assignment {
  readonly value: number;
  /** Index into each meld's claim list, meld by meld. */
  readonly picks: readonly number[];
}

/**
 * Places as many of `loose` as will go onto the knocker's melds and returns
 * what is left (§3.2: runs extend at both ends, a set takes its fourth).
 *
 * **The placements have to be solved together, not walked meld by meld.**
 * Giving each meld whatever it can take, in turn, gets this wrong, because a
 * set's single opening can be the very card a run's ladder needs next — and
 * the ladder may have more behind it. Against a set of S5 H5 D5 and a run of
 * C2 C3 C4, a defender holding C5 C6 must lend the five to the **run**:
 * completing the set with it strands the six at six points, while C2-C3-C4-C5
 * opens the place the six was waiting for and the defender ends on nothing.
 * Same card, two places, different hands — so choosing between them *is* the
 * problem, and the number it decides is the undercut.
 *
 * So every meld's claims are enumerated (`claimsFor`) and the best combination
 * of disjoint ones is taken. The walk goes meld by meld over a bitmask of the
 * cards some meld could take, memoised on (meld, cards already used). A knocker
 * lays down at most three melds and a defender holds at most ten loose cards,
 * so that is at most 3 x 2^10 states with a few dozen claims each — small
 * enough that "the best assignment" can mean it literally. In practice the
 * mask covers only the handful of cards that can go anywhere at all.
 *
 * Ties go to the fullest claim at the earliest meld, so the same loose cards
 * always land in the same places and the screen draws the same picture.
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
  const claims = knockerMelds.map((meld) => claimsFor(meld, pool));

  // Only the cards some meld could actually take get a bit: the rest cannot
  // affect the choice, and leaving them out keeps the state space tiny.
  const position = new Map<Card, number>();
  for (const list of claims) {
    for (const cards of list) {
      for (const card of cards) if (!position.has(card)) position.set(card, position.size);
    }
  }
  const width = position.size;
  const masks = claims.map((list) =>
    list.map((cards) => cards.reduce((mask, card) => mask | (1 << position.get(card)!), 0)),
  );
  const values = claims.map((list) => list.map(deadwoodTotal));

  const memo = new Map<number, Assignment>();
  const solve = (at: number, used: number): Assignment => {
    if (at === claims.length) return { value: 0, picks: [] };
    const key = (at << width) | used;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    let best: Assignment | null = null;
    for (let choice = 0; choice < claims[at]!.length; choice++) {
      if (masks[at]![choice]! & used) continue;
      const rest = solve(at + 1, used | masks[at]![choice]!);
      const value = values[at]![choice]! + rest.value;
      if (best === null || value > best.value) best = { value, picks: [choice, ...rest.picks] };
    }
    // Every meld may always claim nothing, so there is always an answer.
    memo.set(key, best!);
    return best!;
  };

  const layoffs: Layoff[] = [];
  solve(0, 0).picks.forEach((choice, meldIndex) => {
    for (const card of claims[meldIndex]![choice]!) {
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
 * (§3.2: there are no lay-offs against gin), and the call then reduces to the
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
