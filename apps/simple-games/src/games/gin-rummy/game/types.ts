/**
 * Core Gin Rummy types: the two seats, one hand of the match, and what a hand
 * state has to look like to have come from play.
 *
 * The rules these shapes serve are docs/GIN_RUMMY_RULES.md §1–§3; that document
 * is the source of truth and this file follows it.
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
 * keeps the fifty-two-card count honest and changes nothing — the hand is over
 * (docs/GIN_RUMMY_RULES.md §2.3, and §12 for why the difference is deliberate).
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

/**
 * The abstract table a public log replays into: everything a rule looks at,
 * and nothing a face-down card could tell you. Which cards are *in* the two
 * hands is not knowable from the record — that is the point of the record —
 * so the hands are counts, plus the small set of cards a seat was seen to take
 * off the pile and has not put back down.
 */
interface Replay {
  phase: Phase;
  turn: Seat;
  ending: HandEnding;
  mustDrawStock: boolean;
  takenFromDiscard: Card | null;
  /** Face up, bottom first — the same order `hand.discard` is in. */
  pile: Card[];
  /** How many cards are left face down. Never which. */
  stock: number;
  held: [number, number];
  /** Taken off the pile in the open, and not yet thrown back. */
  known: [Set<Card>, Set<Card>];
  /** Which declaration ended the hand, when one did. */
  declared: 'knock' | 'gin' | null;
}

/**
 * One event, applied to the abstract table — or false, when the rules would
 * not have allowed it there. This is engine.ts's four transitions written
 * against what the record can see, and it has to stay in step with them: a
 * move the engine makes and this refuses would throw away a real save.
 */
function replayEvent(state: Replay, event: PublicEvent, at: number, dealer: Seat): boolean {
  // Every hand opens with the twenty-first card turned, and a card is turned
  // only at a deal, so this event is the first one or the record is not one.
  if ((event.kind === 'upcard') !== (at === 0)) return false;
  if (event.kind === 'upcard') {
    state.pile.push(event.card);
    return true;
  }
  // A settled hand takes no more moves, and the only seat that moves is the
  // one to move. Between them these two lines are most of the check: a
  // forgery has to put its extra events *somewhere*, and every place it could
  // put them belongs to somebody.
  if (state.phase === 'over' || event.seat !== state.turn) return false;

  switch (event.kind) {
    case 'pass': {
      if (state.phase !== 'upcard') return false;
      // The non-dealer's refusal passes the option across the table; the
      // dealer's ends the offer and forces the opening draw from the stock.
      if (state.turn !== dealer) {
        state.turn = dealer;
        return true;
      }
      state.turn = opponentOf(dealer);
      state.phase = 'draw';
      state.mustDrawStock = true;
      return true;
    }
    case 'draw-stock': {
      if (state.phase !== 'draw' || state.stock < 1) return false;
      state.stock -= 1;
      state.held[event.seat] += 1;
      state.phase = 'discard';
      state.takenFromDiscard = null;
      state.mustDrawStock = false;
      return true;
    }
    case 'draw-discard': {
      // Taking the offered upcard and taking the pile's top mid-hand are the
      // same act on the pile and the same event; the refused card, though, is
      // refused, so the one forced draw allows neither.
      if (state.phase !== 'upcard' && state.phase !== 'draw') return false;
      if (state.mustDrawStock) return false;
      // `pop` on an empty pile gives undefined, which is no card: a take with
      // nothing to take from fails here and not by accident.
      if (state.pile.pop() !== event.card) return false;
      state.held[event.seat] += 1;
      state.known[event.seat].add(event.card);
      state.phase = 'discard';
      state.takenFromDiscard = event.card;
      return true;
    }
    case 'discard':
    case 'knock':
    case 'gin': {
      if (state.phase !== 'discard') return false;
      // The card just taken off the pile may not go straight back down.
      if (event.card === state.takenFromDiscard) return false;
      // And a card nobody could be holding cannot be put down: one lying face
      // up on the pile, or one the *opponent* was seen to take and has not
      // thrown back. This is the only grip the record has on whose cards are
      // whose, and it is the grip that matters — `knowledgeOf` (cpu.ts) reads
      // every take off the pile as "they are holding that".
      if (state.pile.includes(event.card)) return false;
      if (state.known[opponentOf(event.seat)].has(event.card)) return false;

      state.pile.push(event.card);
      state.held[event.seat] -= 1;
      state.known[event.seat].delete(event.card);
      state.takenFromDiscard = null;
      state.mustDrawStock = false;
      if (event.kind !== 'discard') {
        // The declaration settles the hand and `turn` stays on the knocker.
        state.phase = 'over';
        state.ending = 'knock';
        state.declared = event.kind;
        return true;
      }
      // A hand whose stock is down to two has no turn left to begin (§3.1).
      if (state.stock <= DEAD_HAND_STOCK) {
        state.phase = 'over';
        state.ending = 'dead';
        return true;
      }
      state.turn = opponentOf(event.seat);
      state.phase = 'draw';
      return true;
    }
    default:
      return false;
  }
}

/**
 * The public log, replayed as a hand of Gin Rummy and checked against the
 * table it says it left behind (docs/GIN_RUMMY_RULES.md §9).
 *
 * The log is not decoration. It is the only memory the CPU has of the hand
 * (cpu.ts), and `knowledgeOf` reads every `draw-discard` as "the opponent is
 * holding that card". So a log nothing checks is a way to *tell* the opponent
 * things: rewrite a face-down stock draw as a card taken off the pile, name a
 * card out of your own hand, and hard's `riskOf` plays around a card that was
 * never there. That is precisely the side channel the public-log boundary
 * exists to close, so the record has to be checked as closely as the cards.
 *
 * Adding up what the record moved is not enough, because a forgery can be
 * made to add up: a discard and a take of the same card, pushed and popped in
 * the same breath, leave the pile, the stock and both hand sizes exactly as
 * they were — and leave `knowledgeOf` believing the opponent picked up a card
 * out of the forger's own hand. So the record is **replayed as a game**
 * instead. Every event has to have been legal where it stands — the right
 * phase, the seat whose turn it was, a pile with the named card on top, not
 * the card just taken, not a card the opponent is holding — and the position
 * the replay ends on has to be the position that was saved, down to the flags.
 * The self-cancelling pair above dies on the first of those: the discard hands
 * the turn to the other seat, and the take that follows is not the taker's to
 * make.
 *
 * What is compared at the end — the pile in order, the depth of the stock,
 * both hand sizes, the phase, the seat to move, both flags, and every card a
 * seat was seen to take and never throw back — is more than a proof needs;
 * with fifty-two cards conserved, most of it implies the rest. All of it is
 * compared anyway, because each is a sentence about the hand rather than a
 * step in a proof, and a validator that only says part of what it knows is a
 * validator somebody will widen.
 */
export function isConsistentLog(hand: HandState): boolean {
  if (!Array.isArray(hand.log) || hand.log.length === 0) return false;
  if (!isSeat(hand.dealer)) return false;

  const state: Replay = {
    // The deal, before the turned card: ten each, the rest face down, and the
    // non-dealer with the first look at what comes next.
    phase: 'upcard',
    turn: opponentOf(hand.dealer),
    ending: 'none',
    mustDrawStock: false,
    takenFromDiscard: null,
    pile: [],
    stock: INITIAL_STOCK,
    held: [HAND_SIZE, HAND_SIZE],
    known: [new Set<Card>(), new Set<Card>()],
    declared: null,
  };

  for (let at = 0; at < hand.log.length; at++) {
    if (!replayEvent(state, hand.log[at]!, at, hand.dealer)) return false;
  }

  if (state.phase !== hand.phase) return false;
  if (state.turn !== hand.turn) return false;
  if (state.ending !== hand.ending) return false;
  if (state.mustDrawStock !== hand.mustDrawStock) return false;
  if (state.takenFromDiscard !== hand.takenFromDiscard) return false;
  if (state.stock !== hand.stock.length) return false;
  // Which word was used is not the declarer's to choose: engine.ts calls it
  // gin when the hand it puts down is worth nothing and a knock otherwise, so
  // the two are the same fact said twice. A record that disagrees with the
  // cards it left behind — a seven-point knock relabelled gin, or a gin
  // written down as a knock — is a record play could not have written.
  if (state.declared !== null) {
    const empty = bestMeldPlan(hand.hands[hand.turn]).deadwoodValue === 0;
    if (empty !== (state.declared === 'gin')) return false;
  }
  for (const seat of SEATS) {
    if (state.held[seat] !== hand.hands[seat].length) return false;
    // A card taken off the pile in the open leaves the hand only by being put
    // back down, which is an event of its own — so it is still there.
    for (const card of state.known[seat]) {
      if (!hand.hands[seat].includes(card)) return false;
    }
  }
  return (
    state.pile.length === hand.discard.length &&
    state.pile.every((card, at) => card === hand.discard[at])
  );
}
