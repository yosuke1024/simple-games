/**
 * Core Gin Rummy types: the two seats, one hand of the match, and what a hand
 * state has to look like to have come from play.
 *
 * The rules these shapes serve are in
 * docs/plans/2026-08-08-hearts-and-gin-rummy.md ("Gin Rummy") until
 * docs/GIN_RUMMY_RULES.md exists; from then on that document is the source of
 * truth and this file follows it.
 *
 * Two things are deliberate here. The **public log** is a first-class part of
 * the state rather than a debugging aid: it is exactly what a player at the
 * table saw happen, and it is the only history the CPU is given (cpu.ts). And
 * `hands` holds both seats' cards, which is precisely why the CPU is never
 * handed a `HandState` — `buildCpuView` copies out the seat's own cards and
 * the public record, and the opponent's cards have no way through.
 */
import { CARD_COUNT, isCard, type Card } from './cards';
import { bestMeldPlan } from './melds';

/** The player's seat; the CPU takes the other. Two seats, and only two. */
export const YOU = 0;
export const CPU = 1;
export type Seat = typeof YOU | typeof CPU;
export const SEATS: readonly Seat[] = [YOU, CPU];

export const opponentOf = (seat: Seat): Seat => (seat === YOU ? CPU : YOU);
export const isSeat = (value: unknown): value is Seat => value === YOU || value === CPU;

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

export const isDifficulty = (value: unknown): value is Difficulty =>
  value === 'easy' || value === 'normal' || value === 'hard';

/** Ten cards each; the twenty-first is turned face up. */
export const HAND_SIZE = 10;
/** What is left face down after the deal: 52 − 20 − 1. */
export const INITIAL_STOCK = CARD_COUNT - HAND_SIZE * 2 - 1;
/** Deadwood at or under this may knock; eleven may not. */
export const KNOCK_LIMIT = 10;
export const GIN_BONUS = 25;
export const UNDERCUT_BONUS = 25;
/** First to this many points takes the match. No line bonus, no doubling. */
export const MATCH_TARGET = 100;
/**
 * Two cards left in the stock and nobody has knocked: the hand is dead. The
 * third-from-last card is the last one anybody may draw, so the next turn
 * could not begin.
 */
export const DEAD_HAND_STOCK = 2;

/**
 * Where a hand is:
 *
 * - `upcard` — the turned card is on offer, first to the non-dealer and then
 *   to the dealer. `turn` holds the option.
 * - `draw` — `turn` must take the stock or the discard pile's top.
 * - `discard` — `turn` holds eleven cards and must put one down, knocking or
 *   not.
 * - `over` — the hand is settled; `ending` says how.
 */
export type Phase = 'upcard' | 'draw' | 'discard' | 'over';

/** How a hand finished. `none` while it is still being played. */
export type HandEnding = 'none' | 'knock' | 'dead';

export type MatchStatus = 'playing' | 'won' | 'lost';

/**
 * What everyone at the table saw. Face-down cards are absent by construction:
 * a stock draw records that a card was taken and not which one, and every
 * other event names a card that was face up when it moved.
 *
 * `knock` and `gin` carry the card put down to declare with. It goes onto the
 * discard pile face down at a real table; here it simply lies on top, which
 * keeps the fifty-two-card count honest and changes nothing — the hand is over.
 */
export type PublicEvent =
  | { readonly kind: 'upcard'; readonly card: Card }
  | { readonly kind: 'pass'; readonly seat: Seat }
  | { readonly kind: 'draw-stock'; readonly seat: Seat }
  | { readonly kind: 'draw-discard'; readonly seat: Seat; readonly card: Card }
  | { readonly kind: 'discard'; readonly seat: Seat; readonly card: Card }
  | { readonly kind: 'knock'; readonly seat: Seat; readonly card: Card }
  | { readonly kind: 'gin'; readonly seat: Seat; readonly card: Card };

/** One deal, from the twenty-first card to the settlement. */
export interface HandState {
  /** Whose deal this is. The non-dealer gets the first look at the upcard. */
  readonly dealer: Seat;
  /** Cards held, ascending, indexed by seat. */
  readonly hands: readonly [readonly Card[], readonly Card[]];
  /** Face down. The end of the array is the top of the pile. */
  readonly stock: readonly Card[];
  /** Face up. The end of the array is the top, and the only card takeable. */
  readonly discard: readonly Card[];
  readonly turn: Seat;
  readonly phase: Phase;
  readonly ending: HandEnding;
  /**
   * The card just taken from the discard pile. It may not go straight back
   * down this turn, which is the rule that stops a pile card being used as a
   * free look.
   */
  readonly takenFromDiscard: Card | null;
  /**
   * Set for the one forced draw after both players refuse the upcard: the
   * non-dealer starts the hand from the stock, and the refused card stays
   * refused.
   */
  readonly mustDrawStock: boolean;
  /** Everything both players saw, oldest first. */
  readonly log: readonly PublicEvent[];
}

/**
 * A turn, as a value. The CPU returns one of these and the engine applies it,
 * so there is exactly one list of the things anybody may do — and the CPU
 * cannot express a move the engine does not have.
 */
export type HandAction =
  | { readonly kind: 'take-upcard' }
  | { readonly kind: 'pass-upcard' }
  | { readonly kind: 'draw-stock' }
  | { readonly kind: 'draw-discard' }
  | { readonly kind: 'discard'; readonly card: Card }
  | { readonly kind: 'knock'; readonly card: Card };

/** The top of the discard pile, or null when it has been taken. */
export const topDiscard = (hand: HandState): Card | null =>
  hand.discard.length === 0 ? null : hand.discard[hand.discard.length - 1]!;

/** The top of the stock, or null when it is empty. */
export const topStock = (hand: HandState): Card | null =>
  hand.stock.length === 0 ? null : hand.stock[hand.stock.length - 1]!;

/** How many cards the seat to move should be holding in this phase. */
const expectedHandSize = (hand: HandState, seat: Seat): number =>
  hand.phase === 'discard' && hand.turn === seat ? HAND_SIZE + 1 : HAND_SIZE;

/**
 * A hand state that could have come from a deal and legal play. The storage
 * validator and `decodeHand` both rest on this, so it has to be strict about
 * everything a corrupt record could get wrong and forgiving about nothing.
 *
 * What is checked: fifty-two cards, each exactly once, across both hands, the
 * stock and the discard pile; the hand sizes the phase implies; the flags that
 * only exist in one phase; the stock depths each phase allows; and — for a
 * settled hand — that the knock was one the rules would have permitted and
 * that a dead hand really did run the stock down to two.
 */
export function isValidHand(hand: HandState): boolean {
  if (!isSeat(hand.dealer) || !isSeat(hand.turn)) return false;
  if (!Array.isArray(hand.hands) || hand.hands.length !== 2) return false;
  if (!Array.isArray(hand.stock) || !Array.isArray(hand.discard)) return false;

  const seen = new Array<boolean>(CARD_COUNT).fill(false);
  const see = (card: Card): boolean => {
    if (!isCard(card) || seen[card]) return false;
    seen[card] = true;
    return true;
  };
  for (const seat of SEATS) {
    const cards = hand.hands[seat];
    if (!Array.isArray(cards)) return false;
    for (const card of cards) if (!see(card)) return false;
  }
  for (const card of hand.stock) if (!see(card)) return false;
  for (const card of hand.discard) if (!see(card)) return false;
  if (!seen.every(Boolean)) return false;

  for (const seat of SEATS) {
    if (hand.hands[seat].length !== expectedHandSize(hand, seat)) return false;
  }

  if ((hand.phase === 'over') !== (hand.ending !== 'none')) return false;
  if (hand.takenFromDiscard !== null) {
    if (hand.phase !== 'discard') return false;
    if (!hand.hands[hand.turn].includes(hand.takenFromDiscard)) return false;
  }

  switch (hand.phase) {
    case 'upcard':
      // Nobody has drawn yet, so the deal is still exactly as it was dealt.
      if (hand.mustDrawStock) return false;
      return hand.stock.length === INITIAL_STOCK && hand.discard.length === 1;
    case 'draw':
      // A turn that could not begin is not a turn: at two cards the hand is
      // already over.
      if (hand.stock.length < DEAD_HAND_STOCK + 1) return false;
      if (hand.discard.length === 0) return false;
      // The forced stock draw exists at exactly one moment — both players have
      // refused the upcard and nothing else has happened.
      if (hand.mustDrawStock) {
        return (
          hand.turn !== hand.dealer &&
          hand.stock.length === INITIAL_STOCK &&
          hand.discard.length === 1
        );
      }
      return true;
    case 'discard':
      // The pile can be empty here, and only here: the non-dealer may have
      // taken the upcard with nothing under it.
      return !hand.mustDrawStock && hand.stock.length >= DEAD_HAND_STOCK;
    case 'over':
      if (hand.mustDrawStock || hand.discard.length === 0) return false;
      if (hand.ending === 'dead') return hand.stock.length === DEAD_HAND_STOCK;
      // `turn` is the knocker, and a knock over the limit never happened.
      return (
        hand.stock.length >= DEAD_HAND_STOCK &&
        bestMeldPlan(hand.hands[hand.turn]).deadwoodValue <= KNOCK_LIMIT
      );
    default:
      return false;
  }
}
