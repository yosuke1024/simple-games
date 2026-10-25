/**
 * The rules of one Scopa deal, as pure functions over `DealState`
 * (docs/SCOPA_RULES.md §2–§3). Every function returns a new state, or null
 * when the rules refuse the move; nothing here mutates its input.
 *
 * **One enumeration, everywhere** (§2.2). `enumerateCaptures` walks the
 * table's subsets once, depth first, pruning any branch whose sum passes ten,
 * and answers "how can a card of value v take?" for every v at the same time.
 * The engine, the CPU, the screen and the saved-game replay all read that one
 * answer — `captureOptions` is only a lookup into it — so neither side can
 * ever be playing under a different rule from the other.
 */
import {
  CARD_COUNT,
  FULL_DECK,
  isDiamond,
  MAX_VALUE,
  primieraValueOf,
  SEVEN_OF_DIAMONDS,
  sortedCards,
  SUITS,
  suitOf,
  valueOf,
  type Card,
} from './cards';
import { createRng, shuffled } from './rng';
import {
  CPU,
  HAND_SIZE,
  MAX_REDEALS,
  opponentOf,
  PLAYS_PER_DEAL,
  REDEAL_KINGS,
  TABLE_START,
  YOU,
  type BySeat,
  type DealPhase,
  type DealState,
  type Play,
  type Seat,
} from './types';

// ---------------------------------------------------------------------------
// Dealing (§2.1)
// ---------------------------------------------------------------------------

/**
 * Turns a shuffle's seed string into the forty cards in dealt order. The real
 * one shuffles the ascending deck afresh with that seed; tests substitute
 * their own to reach the redeal cap, which no real seed reaches (§2.1, §15.2).
 */
export type DeckShuffler = (key: string) => readonly Card[];

export const shuffleDeck: DeckShuffler = (key) => shuffled(FULL_DECK, createRng(key));

/**
 * Who deals the first deal of a match: a coin toss from the seed, the same
 * shape as Gin Rummy's (§2.1). There is no screen for choosing it.
 */
export const firstDealerOf = (seed: string): Seat =>
  createRng(`${seed}:dealer`)() < 0.5 ? YOU : CPU;

/** The dealer alternates deal by deal: odd deals the first dealer, even deals the other. */
export const dealerOf = (seed: string, dealNumber: number): Seat => {
  const first = firstDealerOf(seed);
  return dealNumber % 2 === 1 ? first : opponentOf(first);
};

/** The shuffle's seed string for one attempt; attempt 0 has no suffix (§2.1). */
export const dealKey = (seed: string, dealNumber: number, attempt: number): string =>
  attempt === 0 ? `${seed}:deal:${dealNumber}` : `${seed}:deal:${dealNumber}:${attempt}`;

const kingsAmong = (cards: readonly Card[]): number =>
  cards.filter((card) => valueOf(card) === MAX_VALUE).length;

/** Positions 6..9 of the shuffled order are the opening table. */
const tableOf = (order: readonly Card[]): readonly Card[] =>
  order.slice(HAND_SIZE * 2, HAND_SIZE * 2 + TABLE_START);

/**
 * The order one deal is dealt in, with the number of reshuffles it took:
 * three kings or more among the first four on the table and the same dealer
 * shuffles the ascending deck again under the next attempt's key, up to
 * `MAX_REDEALS` times — the ninth shuffle is used as it falls.
 */
export function dealOrder(
  seed: string,
  dealNumber: number,
  shuffle: DeckShuffler = shuffleDeck,
): { readonly order: readonly Card[]; readonly redeals: number } {
  for (let attempt = 0; ; attempt++) {
    const order = shuffle(dealKey(seed, dealNumber, attempt));
    if (kingsAmong(tableOf(order)) < REDEAL_KINGS || attempt >= MAX_REDEALS) {
      return { order, redeals: attempt };
    }
  }
}

/** Two seats' worth of a value, built by seat. */
const bySeat = <T>(make: (seat: Seat) => T): BySeat<T> => [make(YOU), make(CPU)];

/**
 * Deals three cards each — one at a time, the non-dealer first — then four to
 * the table; the rest is the stock, top first.
 */
export function dealDeal(
  seed: string,
  dealNumber: number,
  dealer: Seat,
  shuffle: DeckShuffler = shuffleDeck,
): DealState {
  const { order, redeals } = dealOrder(seed, dealNumber, shuffle);
  const first = opponentOf(dealer);
  const dealt = order.slice(0, HAND_SIZE * 2);
  return {
    dealer,
    hands: bySeat((seat) =>
      sortedCards(dealt.filter((_, at) => (at % 2 === 0 ? first : dealer) === seat)),
    ),
    table: [...tableOf(order)],
    stock: order.slice(HAND_SIZE * 2 + TABLE_START),
    captured: [[], []],
    scopas: [0, 0],
    lastCapturer: null,
    rounds: 1,
    redeals,
    plays: [],
    sweep: null,
  };
}

// ---------------------------------------------------------------------------
// Where the deal is
// ---------------------------------------------------------------------------

export function phaseOf(deal: DealState): DealPhase {
  if (deal.plays.length >= PLAYS_PER_DEAL) return 'over';
  if (deal.hands[YOU].length === 0 && deal.hands[CPU].length === 0) {
    return deal.stock.length > 0 ? 'refill' : 'over';
  }
  return 'play';
}

/**
 * Whose card is next. Every round is six plays and starts with the
 * non-dealer, so the parity of the plays so far is the whole answer — and the
 * thirty-sixth card is always the dealer's (§2.1).
 */
export function seatToPlay(deal: DealState): Seat | null {
  if (phaseOf(deal) !== 'play') return null;
  return deal.plays.length % 2 === 0 ? opponentOf(deal.dealer) : deal.dealer;
}

/** Whether the next card played is the deal's last one (§2.4's exception). */
export const isLastPlay = (deal: DealState): boolean => deal.plays.length === PLAYS_PER_DEAL - 1;

// ---------------------------------------------------------------------------
// Captures (§2.2)
// ---------------------------------------------------------------------------

/** A set of table cards one value can take, ascending. */
export type CaptureSet = readonly Card[];

export interface CaptureEnumeration {
  /**
   * Indexed by value 1..10 (index 0 is unused and empty). For each value, the
   * ways a card of that value takes: the single cards of that value if the
   * table has any (rule 1 — they come before any sum), otherwise every set of
   * two or more cards summing to it (rule 2). Each list is in canonical order:
   * ascending sets, compared lexicographically.
   */
  readonly byValue: readonly (readonly CaptureSet[])[];
  /**
   * Subsets the walk visited: every subset summing to ten or less, the empty
   * set included, and none of the pruned children. The work bound of §2.2.
   */
  readonly nodes: number;
}

/**
 * The one enumeration (§2.2): a single depth-first walk of the table's
 * subsets in ascending card order, never descending into a sum over ten.
 * Visiting in pre-order is what makes each list come out in canonical order.
 */
export function enumerateCaptures(table: readonly Card[]): CaptureEnumeration {
  const cards = sortedCards(table);
  const singles: Card[][][] = Array.from({ length: MAX_VALUE + 1 }, () => []);
  const sums: Card[][][] = Array.from({ length: MAX_VALUE + 1 }, () => []);
  const chosen: Card[] = [];
  let nodes = 0;

  const visit = (from: number, sum: number): void => {
    nodes += 1;
    if (chosen.length === 1) singles[sum]!.push([chosen[0]!]);
    else if (chosen.length >= 2) sums[sum]!.push([...chosen]);
    for (let at = from; at < cards.length; at++) {
      const next = sum + valueOf(cards[at]!);
      if (next > MAX_VALUE) continue;
      chosen.push(cards[at]!);
      visit(at + 1, next);
      chosen.pop();
    }
  };
  visit(0, 0);

  const byValue = singles.map((same, value) => (same.length > 0 ? same : sums[value]!));
  return { byValue, nodes };
}

/** Every value's capture options for this table (§2.2). */
export const capturesByValue = (table: readonly Card[]): readonly (readonly CaptureSet[])[] =>
  enumerateCaptures(table).byValue;

/** The ways `card` can take from `table` — a lookup into the one enumeration. */
export const captureOptions = (table: readonly Card[], card: Card): readonly CaptureSet[] =>
  capturesByValue(table)[valueOf(card)]!;

/** One card put down, and what it takes — empty when it is placed instead. */
export interface Move {
  readonly card: Card;
  readonly captured: CaptureSet;
}

/**
 * Every legal move for a hand on a table, in canonical order: by the card
 * played, then by the captured set. A card that can take must take (rule 4),
 * so a card has either its capture options or the one placement — never both.
 */
export function movesFor(hand: readonly Card[], table: readonly Card[]): Move[] {
  const byValue = capturesByValue(table);
  const moves: Move[] = [];
  for (const card of sortedCards(hand)) {
    const options = byValue[valueOf(card)]!;
    if (options.length === 0) moves.push({ card, captured: [] });
    else for (const captured of options) moves.push({ card, captured });
  }
  return moves;
}

/** The legal moves of the seat to play, or none when nobody is to play. */
export function legalMoves(deal: DealState): Move[] {
  const seat = seatToPlay(deal);
  return seat === null ? [] : movesFor(deal.hands[seat], deal.table);
}

const sameCards = (a: readonly Card[], b: readonly Card[]): boolean =>
  a.length === b.length && a.every((card, at) => card === b[at]);

const without = (cards: readonly Card[], gone: readonly Card[]): Card[] =>
  cards.filter((card) => !gone.includes(card));

const withSeat = <T>(values: BySeat<T>, seat: Seat, value: T): BySeat<T> =>
  seat === YOU ? [value, values[CPU]] : [values[YOU], value];

/**
 * Plays one card for the seat to play. `captured` must be exactly one of the
 * card's capture options (in any order), or empty when the card has none.
 * Anything else — not this seat's turn, a card not in hand, a sum when the
 * same value is on the table, a placement when the card could take, a
 * thirty-sixth card in a deal where nobody has taken (§2.2 proves that cannot
 * be reached) — is null.
 *
 * Emptying the table scores a scopa, except on the thirty-sixth card (§2.4).
 * The thirty-sixth card also ends the deal: whatever is left on the table goes
 * to the side that took last, which is not a scopa (§3.1).
 */
export function applyMove(deal: DealState, move: Move): DealState | null {
  const seat = seatToPlay(deal);
  if (seat === null) return null;
  const hand = deal.hands[seat];
  if (!hand.includes(move.card)) return null;

  const options = captureOptions(deal.table, move.card);
  const captured = sortedCards(move.captured);
  if (options.length === 0 ? captured.length !== 0 : !options.some((o) => sameCards(o, captured))) {
    return null;
  }

  const last = isLastPlay(deal);
  const hands = withSeat(deal.hands, seat, without(hand, [move.card]));
  const play: Play = { seat, card: move.card, captured };
  const plays = [...deal.plays, play];

  let next: DealState;
  if (captured.length === 0) {
    next = { ...deal, hands, table: [...deal.table, move.card], plays };
  } else {
    const table = without(deal.table, captured);
    const scopa = table.length === 0 && !last;
    next = {
      ...deal,
      hands,
      table,
      captured: withSeat(
        deal.captured,
        seat,
        sortedCards([...deal.captured[seat], ...captured, move.card]),
      ),
      scopas: scopa ? withSeat(deal.scopas, seat, deal.scopas[seat] + 1) : deal.scopas,
      lastCapturer: seat,
      plays,
    };
  }

  if (plays.length < PLAYS_PER_DEAL) return next;
  // The deal is over. §2.2 proves somebody has taken by now (ten placements
  // fill every value, and the eleventh card must take), so `lastCapturer` is
  // set; the engine tests hold every self-played deal to that. A state where
  // nobody has taken was not reached by these rules: refuse it rather than
  // settle a deal whose table went to nobody.
  const taker = next.lastCapturer;
  if (taker === null) return null;
  return {
    ...next,
    table: [],
    captured: withSeat(next.captured, taker, sortedCards([...next.captured[taker], ...next.table])),
    sweep: { seat: taker, cards: [...next.table] },
  };
}

/** Whether this move empties the table for a scopa (§2.4) — for the screen. */
export const isScopaMove = (deal: DealState, move: Move): boolean =>
  move.captured.length > 0 && move.captured.length === deal.table.length && !isLastPlay(deal);

/**
 * Deals the next round: three cards each from the top of the stock, one at a
 * time, the non-dealer first. Nothing goes to the table (§2.1). Null unless a
 * refill is owed.
 */
export function applyRefill(deal: DealState): DealState | null {
  if (phaseOf(deal) !== 'refill') return null;
  const first = opponentOf(deal.dealer);
  const dealt = deal.stock.slice(0, HAND_SIZE * 2);
  return {
    ...deal,
    hands: bySeat((seat) =>
      sortedCards(dealt.filter((_, at) => (at % 2 === 0 ? first : deal.dealer) === seat)),
    ),
    stock: deal.stock.slice(HAND_SIZE * 2),
    rounds: deal.rounds + 1,
  };
}

/**
 * The forty-card check (§9.2): every card exactly once across the hands, the
 * table, the stock and both seats' taken cards. Replaying a history cannot
 * break it, which is why the decoder asks it anyway, at its exit.
 */
export function isCompleteDeck(deal: DealState): boolean {
  const all = [
    ...deal.hands[YOU],
    ...deal.hands[CPU],
    ...deal.table,
    ...deal.stock,
    ...deal.captured[YOU],
    ...deal.captured[CPU],
  ];
  if (all.length !== CARD_COUNT) return false;
  const seen = new Set<number>();
  for (const card of all) {
    if (!Number.isInteger(card) || card < 0 || card >= CARD_COUNT || seen.has(card)) return false;
    seen.add(card);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Scoring (§3.2, §3.3)
// ---------------------------------------------------------------------------

export interface PrimieraTally {
  /** The best card of each suit by the primiera table, or null for a missing suit. */
  readonly best: readonly (Card | null)[];
  /** The sum of the best cards' primiera values. */
  readonly total: number;
  /** How many suits are present, 0..4. */
  readonly suits: number;
}

/**
 * Each suit's best card by the primiera table — the lower card number on a
 * tie, which only decides what is shown, since the value is the same (§3.3).
 */
export function primieraOf(cards: readonly Card[]): PrimieraTally {
  const best: (Card | null)[] = SUITS.map(() => null);
  for (const card of sortedCards(cards)) {
    const suit = suitOf(card);
    const held = best[suit]!;
    if (held === null || primieraValueOf(card) > primieraValueOf(held)) best[suit] = card;
  }
  let total = 0;
  let suits = 0;
  for (const card of best) {
    if (card === null) continue;
    total += primieraValueOf(card);
    suits += 1;
  }
  return { best, total, suits };
}

const higher = (a: number, b: number): Seat | null => (a > b ? YOU : b > a ? CPU : null);

/**
 * Who takes the primiera point (§3.3): a side with all four suits beats a side
 * without; two full sides compare totals; two short sides compare the number
 * of suits and then the totals. Level all the way down, nobody takes it.
 */
export function primieraWinner(you: PrimieraTally, cpu: PrimieraTally): Seat | null {
  const youFull = you.suits === SUITS.length;
  const cpuFull = cpu.suits === SUITS.length;
  if (youFull && cpuFull) return higher(you.total, cpu.total);
  if (youFull) return YOU;
  if (cpuFull) return CPU;
  return higher(you.suits, cpu.suits) ?? higher(you.total, cpu.total);
}

/** The four public counts of one seat's takings, for the band at the top (§7, §11.2). */
export interface CaptureSummary {
  readonly cards: number;
  readonly diamonds: number;
  readonly settebello: boolean;
  readonly scopas: number;
}

export function captureSummary(
  deal: Pick<DealState, 'captured' | 'scopas'>,
  seat: Seat,
): CaptureSummary {
  const taken = deal.captured[seat];
  return {
    cards: taken.length,
    diamonds: taken.filter(isDiamond).length,
    settebello: taken.includes(SEVEN_OF_DIAMONDS),
    scopas: deal.scopas[seat],
  };
}

export interface DealOutcome {
  readonly cards: BySeat<number>;
  readonly diamonds: BySeat<number>;
  readonly primiera: BySeat<PrimieraTally>;
  readonly scopas: BySeat<number>;
  /** Who took each one-point category; null when level (7♦ is never level). */
  readonly awards: {
    readonly cards: Seat | null;
    readonly diamonds: Seat | null;
    readonly settebello: Seat | null;
    readonly primiera: Seat | null;
  };
  /** The deal's points: the four categories plus each side's scopas. */
  readonly points: BySeat<number>;
  /** Where the table went at the end. */
  readonly sweep: DealState['sweep'];
}

/** Scores a finished deal (§3.2). Null while it is still being played. */
export function settleDeal(deal: DealState): DealOutcome | null {
  if (phaseOf(deal) !== 'over') return null;
  const you = captureSummary(deal, YOU);
  const cpu = captureSummary(deal, CPU);
  const primiera = bySeat((seat) => primieraOf(deal.captured[seat]));
  const awards: DealOutcome['awards'] = {
    cards: higher(you.cards, cpu.cards),
    diamonds: higher(you.diamonds, cpu.diamonds),
    settebello: you.settebello ? YOU : cpu.settebello ? CPU : null,
    primiera: primieraWinner(primiera[YOU], primiera[CPU]),
  };
  const won = (seat: Seat): number =>
    [awards.cards, awards.diamonds, awards.settebello, awards.primiera].filter((w) => w === seat)
      .length;
  return {
    cards: [you.cards, cpu.cards],
    diamonds: [you.diamonds, cpu.diamonds],
    primiera,
    scopas: [you.scopas, cpu.scopas],
    awards,
    points: bySeat((seat) => won(seat) + deal.scopas[seat]),
    sweep: deal.sweep,
  };
}
