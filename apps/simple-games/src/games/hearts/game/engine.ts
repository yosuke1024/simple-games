/**
 * One hand of Hearts, resolved: the deal, the pass, the thirteen tricks and
 * the score.
 *
 * Pure and immutable, like the board games' engines — every function returns a
 * new `HandState`, or null when the rules do not allow the move. Nothing here
 * knows about seats being human or CPU, about time, or about the match score;
 * a hand is a hand.
 *
 * The rules are docs/HEARTS_RULES.md §1–§3. The ones that are easy to get
 * subtly wrong are stated where they are enforced: the exchange resolves for
 * all four seats at once and not one at a time, the queen of spades does not
 * break hearts, and a finished trick sits on the table for a beat before
 * anybody takes it in.
 *
 * `isValidHand` lives here rather than in types.ts (where Gin Rummy keeps its
 * twin) because the only honest way to know a Hearts position could have come
 * from play is to **play it again**: what each seat held when the tricks began
 * is recoverable from what it holds now plus what it has played, so the
 * validator replays every card through `playCard` and refuses anything the
 * rules would not have allowed the first time.
 */
import {
  CARD_COUNT,
  isAscending,
  isCard,
  isHeart,
  sortedCards,
  TWO_OF_CLUBS,
  type Card,
} from './cards';
import { createRng, shuffled } from './rng';
import {
  bySeat,
  HAND_PENALTY_TOTAL,
  HAND_SIZE,
  isPassOffset,
  isSeat,
  legalPlaysIn,
  PASS_SIZE,
  passOffsetOf,
  passReceiverOf,
  penaltiesTakenIn,
  playContextOf,
  seatAt,
  SEAT_COUNT,
  SEATS,
  seatToPlay,
  trickPointsOf,
  trickWinnerOf,
  TRICKS_PER_HAND,
  YOU,
  type BySeat,
  type HandState,
  type PassOffset,
  type Seat,
  type Trick,
} from './types';

function replaceAt<T>(values: BySeat<T>, seat: Seat, value: T): BySeat<T> {
  const out: [T, T, T, T] = [values[0], values[1], values[2], values[3]];
  out[seat] = value;
  return out;
}

/** Who opens the hand: whoever was dealt — or passed — the two of clubs. */
function holderOfTwoOfClubs(hands: BySeat<readonly Card[]>): Seat {
  for (const seat of SEATS) {
    if (hands[seat].includes(TWO_OF_CLUBS)) return seat;
  }
  // Unreachable for fifty-two cards dealt four ways; the fallback keeps the
  // function total rather than throwing out of a pure module.
  return YOU;
}

/**
 * The deal (§1: fifty-two cards, thirteen each). Cards go one at a time round
 * the table from the player's seat, and everything comes from the seed and the
 * hand number, so a match replays exactly: the same seed deals the same fifth
 * hand as it did the first time.
 *
 * A hand whose pass offset is zero skips the pass entirely — there is nothing
 * to sit through when nothing moves (§2.1).
 */
export function dealHand(seed: string, handNumber: number): HandState {
  const rng = createRng(`${seed}:deal:${handNumber}`);
  const deck: Card[] = [];
  for (let card = 0; card < CARD_COUNT; card++) deck.push(card);
  const shuffledDeck = shuffled(deck, rng);

  const dealt = bySeat<Card[]>(() => []);
  for (let index = 0; index < CARD_COUNT; index++) {
    dealt[(index % SEAT_COUNT) as Seat].push(shuffledDeck[index]!);
  }
  const hands = bySeat<readonly Card[]>((seat) => sortedCards(dealt[seat]));
  const passOffset = passOffsetOf(handNumber);

  return {
    passOffset,
    hands,
    selected: bySeat<readonly Card[]>(() => []),
    confirmed: [false, false, false, false],
    phase: passOffset === 0 ? 'playing' : 'passing',
    leader: passOffset === 0 ? holderOfTwoOfClubs(hands) : YOU,
    played: [],
    tricks: [],
    heartsBroken: false,
  };
}

// ---------------------------------------------------------------------------
// The pass
// ---------------------------------------------------------------------------

/** Whether the seat may still change its mind about the three it is passing. */
const isChoosing = (hand: HandState, seat: Seat): boolean =>
  hand.phase === 'passing' && !hand.confirmed[seat];

/** Picks a card out to pass. Refused past three, and refused after confirming. */
export function selectPassCard(hand: HandState, seat: Seat, card: Card): HandState | null {
  if (!isChoosing(hand, seat)) return null;
  if (!hand.hands[seat].includes(card)) return null;
  const chosen = hand.selected[seat];
  if (chosen.includes(card) || chosen.length >= PASS_SIZE) return null;
  return { ...hand, selected: replaceAt(hand.selected, seat, sortedCards([...chosen, card])) };
}

/** Puts a chosen card back. Refused once the three are confirmed. */
export function unselectPassCard(hand: HandState, seat: Seat, card: Card): HandState | null {
  if (!isChoosing(hand, seat)) return null;
  const chosen = hand.selected[seat];
  if (!chosen.includes(card)) return null;
  return {
    ...hand,
    selected: replaceAt(
      hand.selected,
      seat,
      chosen.filter((held) => held !== card),
    ),
  };
}

/** What the exchange moved. Every seat's, because it happened as one act. */
export interface ExchangeOutcome {
  readonly offset: PassOffset;
  /** What each seat gave away, ascending, indexed by seat. */
  readonly passed: BySeat<readonly Card[]>;
  /** What each seat took in, ascending, indexed by seat. */
  readonly received: BySeat<readonly Card[]>;
}

export interface PassResult {
  readonly hand: HandState;
  /** Set when this confirmation was the fourth and the exchange resolved. */
  readonly exchange: ExchangeOutcome | null;
}

/**
 * Commits a seat's three cards. Exactly three — two is not a pass, and the
 * rules have no way to make up the difference.
 *
 * The fourth confirmation resolves the whole exchange at once (§2.1). Doing it
 * a seat at a time would be a different game:
 * a seat that had already given its cards away would be choosing out of a hand
 * the others had changed.
 */
export function confirmPass(hand: HandState, seat: Seat): PassResult | null {
  if (!isChoosing(hand, seat)) return null;
  if (hand.selected[seat].length !== PASS_SIZE) return null;

  const confirmed = replaceAt(hand.confirmed, seat, true);
  const marked: HandState = { ...hand, confirmed };
  if (!confirmed.every(Boolean)) return { hand: marked, exchange: null };

  const passed = marked.selected;
  const incoming = bySeat<Card[]>(() => []);
  for (const from of SEATS) {
    incoming[passReceiverOf(from, marked.passOffset)].push(...passed[from]);
  }
  const hands = bySeat<readonly Card[]>((to) =>
    sortedCards([
      ...marked.hands[to].filter((card) => !passed[to].includes(card)),
      ...incoming[to],
    ]),
  );

  return {
    hand: {
      ...marked,
      hands,
      selected: bySeat<readonly Card[]>(() => []),
      confirmed: [false, false, false, false],
      phase: 'playing',
      leader: holderOfTwoOfClubs(hands),
    },
    exchange: {
      offset: marked.passOffset,
      passed,
      received: bySeat<readonly Card[]>((to) => sortedCards(incoming[to])),
    },
  };
}

// ---------------------------------------------------------------------------
// The tricks
// ---------------------------------------------------------------------------

/** What the seat to play may put down, ascending. Empty when nobody is to play. */
export function legalPlays(hand: HandState): Card[] {
  const context = playContextOf(hand);
  return context === null ? [] : legalPlaysIn(context);
}

export const canPlay = (hand: HandState, card: Card): boolean => legalPlays(hand).includes(card);

/**
 * Plays one card onto the trick. The card leaves the hand and lands on the
 * table; the fourth one is **not** collected here (that is `collectTrick`), so
 * the screen has a state in which all four cards are visible before any of
 * them moves.
 *
 * Hearts break here and nowhere else, and only on a heart: the queen of spades
 * is worth thirteen points and breaks nothing (§2.2, and §12 for why the
 * variant that says otherwise is not taken).
 */
export function playCard(hand: HandState, card: Card): HandState | null {
  const seat = seatToPlay(hand);
  if (seat === null) return null;
  if (!canPlay(hand, card)) return null;
  return {
    ...hand,
    hands: replaceAt(
      hand.hands,
      seat,
      hand.hands[seat].filter((held) => held !== card),
    ),
    played: [...hand.played, card],
    heartsBroken: hand.heartsBroken || isHeart(card),
  };
}

/** A finished trick and what it cost, for the screen's fold-away. */
export interface TrickOutcome extends Trick {
  readonly winner: Seat;
  readonly points: number;
}

/** The trick sitting finished on the table, or null when there is not one. */
export function pendingTrick(hand: HandState): TrickOutcome | null {
  if (hand.phase !== 'playing' || hand.played.length !== SEAT_COUNT) return null;
  const trick: Trick = {
    leader: hand.leader,
    cards: [hand.played[0]!, hand.played[1]!, hand.played[2]!, hand.played[3]!],
  };
  return { ...trick, winner: trickWinnerOf(trick), points: trickPointsOf(trick) };
}

export interface CollectResult {
  readonly hand: HandState;
  readonly trick: TrickOutcome;
}

/**
 * Takes the finished trick in. Whoever took it leads the next one, and the
 * thirteenth ends the hand — at which point every hand is empty and all
 * fifty-two cards are lying in the thirteen tricks.
 */
export function collectTrick(hand: HandState): CollectResult | null {
  const trick = pendingTrick(hand);
  if (trick === null) return null;
  const tricks: Trick[] = [...hand.tricks, { leader: trick.leader, cards: trick.cards }];
  return {
    hand: {
      ...hand,
      phase: tricks.length === TRICKS_PER_HAND ? 'over' : 'playing',
      leader: trick.winner,
      played: [],
      tricks,
    },
    trick,
  };
}

// ---------------------------------------------------------------------------
// The score
// ---------------------------------------------------------------------------

/** What a finished hand does to the match score. */
export interface HandOutcome {
  /** Penalty points taken in tricks, indexed by seat. Always sums to 26. */
  readonly taken: BySeat<number>;
  /** What goes onto the match score, indexed by seat. */
  readonly delta: BySeat<number>;
  /** The seat that took all twenty-six, or null — which is nearly always. */
  readonly moonShooter: Seat | null;
}

/**
 * Scores a finished hand (§3.2: a heart is a point, the queen is thirteen, and
 * a moon puts twenty-six on the other three seats).
 *
 * Shooting the moon — taking every point there is — is the one place the
 * arithmetic is not simply "what you took". The shooter scores nothing and the
 * other three take twenty-six apiece. The variant where the shooter may
 * instead subtract twenty-six from their own score is **not** offered: it is a
 * choice with no decision in it (you take whichever is better) and a second
 * scoring path for the screen to explain (docs/HEARTS_RULES.md §12).
 *
 * A seat that took only the queen has thirteen — half the pot, and nowhere
 * near a moon.
 */
export function scoreHand(hand: HandState): HandOutcome | null {
  if (hand.phase !== 'over') return null;
  const taken = penaltiesTakenIn(hand);
  const moonShooter = SEATS.find((seat) => taken[seat] === HAND_PENALTY_TOTAL) ?? null;
  if (moonShooter === null) return { taken, delta: taken, moonShooter: null };
  return {
    taken,
    delta: bySeat<number>((seat) => (seat === moonShooter ? 0 : HAND_PENALTY_TOTAL)),
    moonShooter,
  };
}

// ---------------------------------------------------------------------------
// What a hand may look like
// ---------------------------------------------------------------------------

/** Every card in the hand, wherever it is. The conservation check's input. */
export function allCards(hand: HandState): Card[] {
  const cards: Card[] = [];
  for (const seat of SEATS) cards.push(...hand.hands[seat]);
  for (const trick of hand.tricks) cards.push(...trick.cards);
  cards.push(...hand.played);
  return cards;
}

/** Fifty-two cards, each exactly once, and every one of them a card. */
function isWholeDeck(cards: readonly Card[]): boolean {
  if (cards.length !== CARD_COUNT) return false;
  const seen = new Array<boolean>(CARD_COUNT).fill(false);
  for (const card of cards) {
    if (!isCard(card) || seen[card]) return false;
    seen[card] = true;
  }
  return true;
}

const isFourOf = (values: unknown): boolean =>
  Array.isArray(values) && values.length === SEAT_COUNT;

/** The pass, before anybody has played: four full hands and nothing on the table. */
function isValidPassing(hand: HandState): boolean {
  if (hand.passOffset === 0) return false;
  if (hand.leader !== YOU || hand.played.length !== 0 || hand.tricks.length !== 0) return false;
  if (hand.heartsBroken) return false;
  // A fourth confirmation resolves the exchange, so a hand still passing with
  // four of them is a hand that skipped its own transition.
  if (hand.confirmed.every(Boolean)) return false;
  for (const seat of SEATS) {
    if (hand.hands[seat].length !== HAND_SIZE) return false;
    const chosen = hand.selected[seat];
    if (chosen.length > PASS_SIZE || !isAscending(chosen)) return false;
    if (!chosen.every((card) => hand.hands[seat].includes(card))) return false;
    if (hand.confirmed[seat] && chosen.length !== PASS_SIZE) return false;
  }
  return true;
}

/**
 * The tricks, replayed. Everything after the pass is recoverable — a seat held
 * exactly what it holds now plus everything it has played — so the whole
 * sequence goes back through `playCard`, and a card that would not have been
 * legal the first time makes the record a record of something that never
 * happened.
 */
function isValidPlay(hand: HandState): boolean {
  for (const seat of SEATS) {
    if (hand.selected[seat].length !== 0 || hand.confirmed[seat]) return false;
  }
  if (hand.played.length > SEAT_COUNT) return false;
  if (hand.phase === 'over') {
    if (hand.tricks.length !== TRICKS_PER_HAND || hand.played.length !== 0) return false;
  } else if (hand.tricks.length >= TRICKS_PER_HAND) {
    // Thirteen tricks in and still playing: the hand should have ended.
    return false;
  }

  // Give every seat back the cards it has played. Order does not matter here —
  // the hands are sorted before the replay starts.
  const startingHands = bySeat<Card[]>((seat) => [...hand.hands[seat]]);
  for (const trick of hand.tricks) {
    trick.cards.forEach((card, index) => startingHands[seatAt(trick.leader, index)].push(card));
  }
  hand.played.forEach((card, index) => startingHands[seatAt(hand.leader, index)].push(card));
  for (const seat of SEATS) {
    if (startingHands[seat].length !== HAND_SIZE) return false;
  }

  let replayed: HandState = {
    ...hand,
    hands: bySeat<readonly Card[]>((seat) => sortedCards(startingHands[seat])),
    phase: 'playing',
    leader: holderOfTwoOfClubs(startingHands),
    played: [],
    tricks: [],
    heartsBroken: false,
  };
  for (const trick of hand.tricks) {
    for (const card of trick.cards) {
      const next = playCard(replayed, card);
      if (next === null) return false;
      replayed = next;
    }
    const collected = collectTrick(replayed);
    if (collected === null) return false;
    replayed = collected.hand;
  }
  for (const card of hand.played) {
    const next = playCard(replayed, card);
    if (next === null) return false;
    replayed = next;
  }

  return (
    replayed.phase === hand.phase &&
    replayed.leader === hand.leader &&
    replayed.heartsBroken === hand.heartsBroken &&
    replayed.tricks.every((trick, at) => trick.leader === hand.tricks[at]!.leader)
  );
}

/**
 * A hand state that could have come from a deal and legal play. The storage
 * validator and `decodeHand` both rest on this, so it has to be strict about
 * everything a corrupt record could get wrong and forgiving about nothing.
 *
 * What is checked: fifty-two cards, each exactly once, across the four hands,
 * the finished tricks and the trick on the table; hands and pass selections in
 * canonical order; the shape of the pass; and — for a hand under way — every
 * card played, re-run through the rules that allowed it.
 */
export function isValidHand(hand: HandState): boolean {
  if (!isPassOffset(hand.passOffset)) return false;
  if (!isFourOf(hand.hands) || !isFourOf(hand.selected) || !isFourOf(hand.confirmed)) return false;
  if (!Array.isArray(hand.played) || !Array.isArray(hand.tricks)) return false;
  if (typeof hand.heartsBroken !== 'boolean') return false;
  if (!isSeat(hand.leader)) return false;
  for (const seat of SEATS) {
    if (!Array.isArray(hand.hands[seat]) || !isAscending(hand.hands[seat])) return false;
    if (!Array.isArray(hand.selected[seat])) return false;
    if (typeof hand.confirmed[seat] !== 'boolean') return false;
  }
  for (const trick of hand.tricks) {
    if (!isFourOf(trick.cards) || !isSeat(trick.leader)) return false;
  }
  if (!isWholeDeck(allCards(hand))) return false;

  switch (hand.phase) {
    case 'passing':
      return isValidPassing(hand);
    case 'playing':
    case 'over':
      return isValidPlay(hand);
    default:
      return false;
  }
}
