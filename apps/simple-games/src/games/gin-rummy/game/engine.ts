/**
 * One hand of Gin Rummy, resolved: the deal, the four things a player may do,
 * and the settlement.
 *
 * Pure and immutable, like the board games' engines — every function returns a
 * new `HandState`, or null when the rules do not allow the move. Nothing here
 * knows about seats being human or CPU, about time, or about the match score;
 * a hand is a hand.
 *
 * The rules are the plan's (docs/plans/2026-08-08-hearts-and-gin-rummy.md,
 * "Gin Rummy"), and the two that are easy to get subtly wrong are stated where
 * they are enforced: the card just taken from the discard pile may not go
 * straight back down, and a hand dies when the stock reaches two — not zero.
 */
import { sortedCards, CARD_COUNT, type Card } from './cards';
import { bestDefence, bestMeldPlan, type Layoff, type Meld } from './melds';
import { createRng, shuffled } from './rng';
import {
  DEAD_HAND_STOCK,
  GIN_BONUS,
  HAND_SIZE,
  KNOCK_LIMIT,
  opponentOf,
  topDiscard,
  UNDERCUT_BONUS,
  YOU,
  type HandAction,
  type HandState,
  type PublicEvent,
  type Seat,
} from './types';

/** Cards ascending, with `card` added. Hands are always kept sorted. */
const withCard = (cards: readonly Card[], card: Card): Card[] => sortedCards([...cards, card]);

/** Cards ascending, with the first copy of `card` removed. */
const withoutCard = (cards: readonly Card[], card: Card): Card[] =>
  cards.filter((held) => held !== card);

function replaceHand(
  hands: readonly [readonly Card[], readonly Card[]],
  seat: Seat,
  cards: readonly Card[],
): readonly [readonly Card[], readonly Card[]] {
  return seat === YOU ? [cards, hands[1]] : [hands[0], cards];
}

const logged = (hand: HandState, event: PublicEvent): readonly PublicEvent[] => [
  ...hand.log,
  event,
];

/**
 * The deal (the plan: 10 枚配り・21 枚目が台札). Cards go one at a time
 * starting with the non-dealer, the twenty-first turns face up, and the rest
 * become the stock with its top at the end of the array — the patience
 * shelf's convention, so "draw" is always a pop.
 *
 * Everything comes from the seed and the hand number, so a match replays
 * exactly: the same seed deals the same fifth hand as it did the first time.
 */
export function dealHand(seed: string, handNumber: number, dealer: Seat): HandState {
  const rng = createRng(`${seed}:deal:${handNumber}`);
  const deck: Card[] = [];
  for (let card = 0; card < CARD_COUNT; card++) deck.push(card);
  const shuffledDeck = shuffled(deck, rng);

  const nonDealer = opponentOf(dealer);
  const dealt: [Card[], Card[]] = [[], []];
  for (let index = 0; index < HAND_SIZE * 2; index++) {
    dealt[index % 2 === 0 ? nonDealer : dealer].push(shuffledDeck[index]!);
  }
  const upcard = shuffledDeck[HAND_SIZE * 2]!;
  const stock = shuffledDeck.slice(HAND_SIZE * 2 + 1);
  stock.reverse();

  return {
    dealer,
    hands: [sortedCards(dealt[0]), sortedCards(dealt[1])],
    stock,
    discard: [upcard],
    turn: nonDealer,
    phase: 'upcard',
    ending: 'none',
    takenFromDiscard: null,
    mustDrawStock: false,
    log: [{ kind: 'upcard', card: upcard }],
  };
}

/** Picks the upcard up and goes straight to the discard (the plan's 取得権). */
export function takeUpcard(hand: HandState): HandState | null {
  if (hand.phase !== 'upcard') return null;
  const card = topDiscard(hand);
  if (card === null) return null;
  return {
    ...hand,
    hands: replaceHand(hand.hands, hand.turn, withCard(hand.hands[hand.turn], card)),
    discard: hand.discard.slice(0, -1),
    phase: 'discard',
    takenFromDiscard: card,
    log: logged(hand, { kind: 'draw-discard', seat: hand.turn, card }),
  };
}

/**
 * Refuses the upcard. The non-dealer's refusal passes the option to the
 * dealer; the dealer's ends the offer, and the non-dealer opens the hand from
 * the stock with the refused card still lying there untouchable this turn.
 */
export function passUpcard(hand: HandState): HandState | null {
  if (hand.phase !== 'upcard') return null;
  const log = logged(hand, { kind: 'pass', seat: hand.turn });
  if (hand.turn !== hand.dealer) return { ...hand, turn: hand.dealer, log };
  return {
    ...hand,
    turn: opponentOf(hand.dealer),
    phase: 'draw',
    mustDrawStock: true,
    log,
  };
}

/** Draws the face-down top of the stock. What it was stays private. */
export function drawFromStock(hand: HandState): HandState | null {
  if (hand.phase !== 'draw') return null;
  const card = hand.stock[hand.stock.length - 1];
  if (card === undefined) return null;
  return {
    ...hand,
    hands: replaceHand(hand.hands, hand.turn, withCard(hand.hands[hand.turn], card)),
    stock: hand.stock.slice(0, -1),
    phase: 'discard',
    takenFromDiscard: null,
    mustDrawStock: false,
    log: logged(hand, { kind: 'draw-stock', seat: hand.turn }),
  };
}

/** Draws the discard pile's top. Refused while the forced stock draw stands. */
export function drawFromDiscard(hand: HandState): HandState | null {
  if (hand.phase !== 'draw' || hand.mustDrawStock) return null;
  const card = topDiscard(hand);
  if (card === null) return null;
  return {
    ...hand,
    hands: replaceHand(hand.hands, hand.turn, withCard(hand.hands[hand.turn], card)),
    discard: hand.discard.slice(0, -1),
    phase: 'discard',
    takenFromDiscard: card,
    log: logged(hand, { kind: 'draw-discard', seat: hand.turn, card }),
  };
}

/** Whether `card` may be put down this turn — the taken card may not. */
export function canDiscard(hand: HandState, card: Card): boolean {
  if (hand.phase !== 'discard') return false;
  if (card === hand.takenFromDiscard) return false;
  return hand.hands[hand.turn].includes(card);
}

/**
 * Puts a card down and hands the turn over — unless that draw took the stock
 * to two, at which point nobody could begin a turn and the hand dies with no
 * score (the plan: 山残り 2 枚でハンド無効).
 */
export function discardCard(hand: HandState, card: Card): HandState | null {
  if (!canDiscard(hand, card)) return null;
  const rest = withoutCard(hand.hands[hand.turn], card);
  const next: HandState = {
    ...hand,
    hands: replaceHand(hand.hands, hand.turn, rest),
    discard: [...hand.discard, card],
    takenFromDiscard: null,
    mustDrawStock: false,
    log: logged(hand, { kind: 'discard', seat: hand.turn, card }),
  };
  if (next.stock.length <= DEAD_HAND_STOCK) {
    return { ...next, phase: 'over', ending: 'dead' };
  }
  return { ...next, turn: opponentOf(hand.turn), phase: 'draw' };
}

/** Whether putting `card` down would leave a hand allowed to knock. */
export function canKnock(hand: HandState, card: Card): boolean {
  if (!canDiscard(hand, card)) return false;
  return bestMeldPlan(withoutCard(hand.hands[hand.turn], card)).deadwoodValue <= KNOCK_LIMIT;
}

/** Every card that could be put down as a knock, ascending. Empty when none can. */
export function knockableDiscards(hand: HandState): Card[] {
  if (hand.phase !== 'discard') return [];
  return hand.hands[hand.turn].filter((card) => canKnock(hand, card));
}

/**
 * Knocks: puts a card down and declares. Ten points of deadwood is allowed and
 * eleven is not, and gin — nothing left over at all — is the same act with a
 * bigger prize. `turn` stays on the knocker so the settlement knows who
 * called it.
 *
 * A knock ends the hand even when the draw that preceded it emptied the stock
 * to two: the declaration lands first, and a scored hand beats a dead one.
 */
export function knock(hand: HandState, card: Card): HandState | null {
  if (!canDiscard(hand, card)) return null;
  const rest = withoutCard(hand.hands[hand.turn], card);
  const plan = bestMeldPlan(rest);
  if (plan.deadwoodValue > KNOCK_LIMIT) return null;
  return {
    ...hand,
    hands: replaceHand(hand.hands, hand.turn, rest),
    discard: [...hand.discard, card],
    takenFromDiscard: null,
    mustDrawStock: false,
    phase: 'over',
    ending: 'knock',
    log: logged(hand, {
      kind: plan.deadwoodValue === 0 ? 'gin' : 'knock',
      seat: hand.turn,
      card,
    }),
  };
}

/** Applies a turn expressed as a value. The single door into every transition. */
export function applyAction(hand: HandState, action: HandAction): HandState | null {
  switch (action.kind) {
    case 'take-upcard':
      return takeUpcard(hand);
    case 'pass-upcard':
      return passUpcard(hand);
    case 'draw-stock':
      return drawFromStock(hand);
    case 'draw-discard':
      return drawFromDiscard(hand);
    case 'discard':
      return discardCard(hand, action.card);
    case 'knock':
      return knock(hand, action.card);
    default:
      return null;
  }
}

/** How a settled hand was settled, and what it was worth. */
export interface HandOutcome {
  /** `dead` scores nothing and is redealt by the same dealer. */
  readonly kind: 'gin' | 'knock' | 'undercut' | 'dead';
  readonly knocker: Seat | null;
  /** Who takes the points, and therefore who deals next. Null for a dead hand. */
  readonly winner: Seat | null;
  readonly points: number;
  readonly knockerDeadwood: number;
  /** After lay-offs, where lay-offs were allowed. */
  readonly defenderDeadwood: number;
  readonly knockerMelds: readonly Meld[];
  readonly defenderMelds: readonly Meld[];
  readonly layoffs: readonly Layoff[];
}

const DEAD_HAND: HandOutcome = {
  kind: 'dead',
  knocker: null,
  winner: null,
  points: 0,
  knockerDeadwood: 0,
  defenderDeadwood: 0,
  knockerMelds: [],
  defenderMelds: [],
  layoffs: [],
};

/**
 * Scores a finished hand (the plan: ジン +25 / レイオフ / アンダーカット).
 *
 * Both sides' splits are computed rather than declared, and the defender's
 * split and lay-offs are chosen together — keeping a card in a meld of your
 * own and giving it away onto the knocker's are alternatives for the same
 * card, so picking the split first can cost points that were there to save.
 * Against gin there is nothing to lay off against, so the defender is left
 * with their own best split.
 *
 * The comparison is not symmetric, and that asymmetry *is* the game: the
 * knocker must be strictly ahead to collect. Level pegging goes to the
 * defender, with twenty-five on top.
 */
export function settleHand(hand: HandState): HandOutcome {
  if (hand.phase !== 'over' || hand.ending !== 'knock') return DEAD_HAND;

  const knocker = hand.turn;
  const defender = opponentOf(knocker);
  const knockerPlan = bestMeldPlan(hand.hands[knocker]);
  const knockerDeadwood = knockerPlan.deadwoodValue;

  if (knockerDeadwood === 0) {
    const defence = bestDefence(hand.hands[defender], []);
    return {
      kind: 'gin',
      knocker,
      winner: knocker,
      points: defence.deadwoodValue + GIN_BONUS,
      knockerDeadwood,
      defenderDeadwood: defence.deadwoodValue,
      knockerMelds: knockerPlan.melds,
      defenderMelds: defence.melds,
      layoffs: [],
    };
  }

  const defence = bestDefence(hand.hands[defender], knockerPlan.melds);
  const shared = {
    knocker,
    knockerDeadwood,
    defenderDeadwood: defence.deadwoodValue,
    knockerMelds: knockerPlan.melds,
    defenderMelds: defence.melds,
    layoffs: defence.layoffs,
  } as const;

  if (knockerDeadwood < defence.deadwoodValue) {
    return {
      ...shared,
      kind: 'knock',
      winner: knocker,
      points: defence.deadwoodValue - knockerDeadwood,
    };
  }
  return {
    ...shared,
    kind: 'undercut',
    winner: defender,
    points: knockerDeadwood - defence.deadwoodValue + UNDERCUT_BONUS,
  };
}

/**
 * The deadwood the seat is holding right now, for the screen's always-on
 * count. Any number of cards: eleven mid-turn reads as eleven.
 */
export const deadwoodOf = (hand: HandState, seat: Seat): number =>
  bestMeldPlan(hand.hands[seat]).deadwoodValue;

/** Every card in the hand, for the fifty-two-card conservation check. */
export function allCards(hand: HandState): Card[] {
  return [...hand.hands[0], ...hand.hands[1], ...hand.stock, ...hand.discard];
}
