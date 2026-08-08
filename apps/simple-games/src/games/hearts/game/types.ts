/**
 * Core Hearts types: the four seats, one hand of the match, and the small
 * derivations every other module reads a hand through.
 *
 * The rules these shapes serve are docs/HEARTS_RULES.md §1–§3; that document is
 * the source of truth and this file follows it.
 *
 * Two things are deliberate. First, **the completed tricks are the public
 * record**: there is no separate log, because in Hearts everything that ever
 * happens in the open is a card going onto a trick. That array is exactly what
 * a player at the table watched, and it is the only history the CPU is given
 * (cpu.ts). Second, `hands` holds all four seats' cards, which is precisely why
 * the CPU is never handed a `HandState` — `buildCpuView` copies out one seat's
 * cards and the public record, and the other three hands have no way through.
 */
import {
  countSuit,
  isHeart,
  penaltyPointsOf,
  CLUBS,
  DIAMONDS,
  HEARTS,
  QUEEN_PENALTY,
  SPADES,
  suitOf,
  TWO_OF_CLUBS,
  type Card,
} from './cards';

/**
 * Four seats round a table, clockwise from the player: 0 is you at the bottom,
 * 1 on your left, 2 across, 3 on your right. Play goes 0 → 1 → 2 → 3, so the
 * seat after any other is the one to its left — which is what makes the pass
 * directions below plain arithmetic.
 */
export const YOU = 0;
export type Seat = 0 | 1 | 2 | 3;
export const SEAT_COUNT = 4;
export const SEATS: readonly Seat[] = [0, 1, 2, 3];

export const isSeat = (value: unknown): value is Seat =>
  value === 0 || value === 1 || value === 2 || value === 3;

/** The three seats the CPU takes. All of them play at the chosen strength. */
export const isCpuSeat = (seat: Seat): boolean => seat !== YOU;

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

export const isDifficulty = (value: unknown): value is Difficulty =>
  value === 'easy' || value === 'normal' || value === 'hard';

/** Thirteen cards each, thirteen tricks, fifty-two cards. */
export const HAND_SIZE = 13;
export const TRICKS_PER_HAND = HAND_SIZE;
/** Three cards change hands before every hand but the fourth. */
export const PASS_SIZE = 3;
/** Thirteen hearts and the queen. Every hand is worth exactly this. */
export const HAND_PENALTY_TOTAL = HAND_SIZE + QUEEN_PENALTY;
/** A hand ending with somebody at or over this ends the match. */
export const MATCH_TARGET = 100;

/**
 * How far round the table the pass goes, as seats clockwise: 1 is to the left,
 * 3 is to the right (three seats clockwise is one seat back), 2 is across, and
 * 0 is the hand nobody passes on.
 */
export type PassOffset = 0 | 1 | 2 | 3;

/**
 * Left, right, across, none — in that order, repeating every four hands
 * (docs/HEARTS_RULES.md §2.1). Hand numbers start at 1.
 */
export const PASS_CYCLE: readonly PassOffset[] = [1, 3, 2, 0];

export const passOffsetOf = (handNumber: number): PassOffset =>
  PASS_CYCLE[(handNumber - 1) % PASS_CYCLE.length]!;

export const isPassOffset = (value: unknown): value is PassOffset =>
  value === 0 || value === 1 || value === 2 || value === 3;

/** Who a seat's three cards go to. Itself, when nobody passes. */
export const passReceiverOf = (seat: Seat, offset: PassOffset): Seat =>
  ((seat + offset) % SEAT_COUNT) as Seat;

/** The name of the direction, for the screen. `none` is the fourth hand. */
export type PassDirection = 'left' | 'across' | 'right' | 'none';

const PASS_DIRECTIONS: Readonly<Record<PassOffset, PassDirection>> = {
  0: 'none',
  1: 'left',
  2: 'across',
  3: 'right',
};

export const passDirectionOf = (offset: PassOffset): PassDirection => PASS_DIRECTIONS[offset];

/**
 * Where a hand is:
 *
 * - `passing` — all four seats are choosing three cards. Nobody has a turn;
 *   the exchange resolves when the fourth seat confirms.
 * - `playing` — tricks. When `played` holds four cards the trick is finished
 *   and sitting on the table, waiting to be collected.
 * - `over` — thirteen tricks are in, the cards are all gone, and the hand is
 *   ready to be scored.
 */
export type Phase = 'passing' | 'playing' | 'over';

/** Won, lost, drawn — from the player's side of the table. */
export type MatchStatus = 'playing' | 'won' | 'lost' | 'draw';

/** Four of anything, indexed by seat. */
export type BySeat<T> = readonly [T, T, T, T];
/** Four of anything, indexed by suit. Same shape, different meaning. */
export type BySuit<T> = readonly [T, T, T, T];

/** A finished trick: who led it, and the four cards in the order they landed. */
export interface Trick {
  readonly leader: Seat;
  readonly cards: BySeat<Card>;
}

/**
 * One deal, from the pass to the last trick.
 *
 * `heartsBroken` is stored rather than derived so the rule it gates can be
 * read straight off the state — but it is a fact about the cards already
 * played, so `isValidHand` recomputes it and refuses a state that disagrees
 * with its own history.
 */
export interface HandState {
  /** Which way this hand's three cards go. Zero for the hand nobody passes. */
  readonly passOffset: PassOffset;
  /** Cards held, ascending, indexed by seat. */
  readonly hands: BySeat<readonly Card[]>;
  /**
   * The cards each seat has picked out to pass, ascending. Up to three, and
   * empty everywhere once the exchange has happened.
   */
  readonly selected: BySeat<readonly Card[]>;
  /** Which seats have committed their three. All four is not a resting state. */
  readonly confirmed: BySeat<boolean>;
  readonly phase: Phase;
  /**
   * Who led the trick on the table. During the pass there is no trick and no
   * leader; the field is pinned to `YOU` there so a saved hand cannot smuggle
   * anything through it.
   */
  readonly leader: Seat;
  /** The trick on the table, in the order played, starting from the leader. */
  readonly played: readonly Card[];
  /** Completed tricks, oldest first. The whole public record of the hand. */
  readonly tricks: readonly Trick[];
  /** Whether a heart has been played. The queen of spades does not count. */
  readonly heartsBroken: boolean;
}

/** Builds one value per seat, in seat order. Four fresh values, never shared. */
export const bySeat = <T>(make: (seat: Seat) => T): BySeat<T> => [
  make(0),
  make(1),
  make(2),
  make(3),
];

/** The seat that played the `index`-th card of a trick led by `leader`. */
export const seatAt = (leader: Seat, index: number): Seat =>
  ((leader + index) % SEAT_COUNT) as Seat;

/**
 * Who takes the trick: the highest card of the suit that was led. Nothing
 * trumps, so a card of any other suit cannot win however big it is — which is
 * the whole reason a void is worth having.
 */
export function trickWinnerOf(trick: Trick): Seat {
  const lead = suitOf(trick.cards[0]);
  let best = 0;
  for (let index = 1; index < trick.cards.length; index++) {
    const card = trick.cards[index]!;
    if (suitOf(card) === lead && card > trick.cards[best]!) best = index;
  }
  return seatAt(trick.leader, best);
}

/** What the trick costs whoever takes it. */
export const trickPointsOf = (trick: Trick): number =>
  trick.cards.reduce((total, card) => total + penaltyPointsOf(card), 0);

/** Penalty points taken so far this hand, indexed by seat. */
export function penaltiesTakenIn(hand: HandState): BySeat<number> {
  const taken: [number, number, number, number] = [0, 0, 0, 0];
  for (const trick of hand.tricks) taken[trickWinnerOf(trick)] += trickPointsOf(trick);
  return taken;
}

/**
 * The seat that must play now, or null when nobody must: during the pass, on a
 * finished trick waiting to be collected, and once the hand is over.
 */
export function seatToPlay(hand: HandState): Seat | null {
  if (hand.phase !== 'playing' || hand.played.length >= SEAT_COUNT) return null;
  return seatAt(hand.leader, hand.played.length);
}

/** Whether a completed trick is sitting on the table waiting to be taken in. */
export const isTrickComplete = (hand: HandState): boolean =>
  hand.phase === 'playing' && hand.played.length === SEAT_COUNT;

/**
 * What a seat may legally play, given only the facts a seat has about itself.
 * Both the engine (from a `HandState`) and the CPU (from a `CpuView`) build
 * this, which is how one copy of the rule serves both without the opponent
 * ever seeing a hand it should not.
 */
export interface PlayContext {
  /** The cards the seat is holding. */
  readonly cards: readonly Card[];
  /** The card that opened the trick, or null when this seat is leading. */
  readonly leadCard: Card | null;
  /** Whether this is the hand's opening trick, where the restrictions bite. */
  readonly firstTrick: boolean;
  readonly heartsBroken: boolean;
}

/**
 * The legal plays, ascending (docs/HEARTS_RULES.md §2.2).
 *
 * Four rules, in the order they apply:
 *
 *   1. The opening lead of a hand is the two of clubs and nothing else.
 *   2. Follow the suit led if you can. This one has no exception — every other
 *      rule below only ever comes up for a seat that is void.
 *   3. On the first trick, a seat that is void may not throw a point. The
 *      exception is a seat holding nothing else at all: it is a hand the deal
 *      can produce, so the rule bends rather than deadlocking.
 *   4. Hearts may not be *led* until one has been played, unless the leader
 *      holds nothing but hearts. The queen of spades is not a heart and may be
 *      led whenever her holder likes.
 *
 * Returns an empty list only for a context no seat is in — a leader with no
 * two of clubs on the opening trick, or an empty hand.
 */
export function legalPlaysIn(context: PlayContext): Card[] {
  const { cards, leadCard, firstTrick, heartsBroken } = context;

  if (leadCard === null) {
    if (firstTrick) return cards.filter((card) => card === TWO_OF_CLUBS);
    if (heartsBroken) return [...cards];
    const offSuit = cards.filter((card) => !isHeart(card));
    return offSuit.length > 0 ? offSuit : [...cards];
  }

  const lead = suitOf(leadCard);
  const following = cards.filter((card) => suitOf(card) === lead);
  if (following.length > 0) return following;

  if (firstTrick) {
    const free = cards.filter((card) => penaltyPointsOf(card) === 0);
    return free.length > 0 ? free : [...cards];
  }
  return [...cards];
}

/** The context the seat to play is in, or null when nobody is to play. */
export function playContextOf(hand: HandState): PlayContext | null {
  const seat = seatToPlay(hand);
  if (seat === null) return null;
  return {
    cards: hand.hands[seat],
    leadCard: hand.played.length === 0 ? null : hand.played[0]!,
    firstTrick: hand.tricks.length === 0,
    heartsBroken: hand.heartsBroken,
  };
}

/** How long a suit the seat is holding — the shape a discard is chosen from. */
export const suitLengthsOf = (cards: readonly Card[]): BySuit<number> => [
  countSuit(cards, SPADES),
  countSuit(cards, HEARTS),
  countSuit(cards, DIAMONDS),
  countSuit(cards, CLUBS),
];
