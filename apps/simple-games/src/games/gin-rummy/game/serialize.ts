/**
 * Compact, corruption-tolerant serialization of one hand, for the single
 * suspended-match slot.
 *
 * A card is two base-36 digits (`00`..`1f`), a pile is those digits run
 * together, and the whole hand is eight `/`-separated fields: a format
 * version, the flags, the card taken off the pile, the four piles, and the
 * public log. The log is stored because it is the CPU's entire memory of the
 * hand — resume a match without it and the opponent forgets what it watched
 * you pick up, which is a different opponent from the one you suspended.
 *
 * Decoding **fails closed**. A record that could not have come from play — a
 * missing or duplicated card, hand sizes the phase does not allow, a flag in a
 * phase that has no such flag, a knock over the limit, a public log that does
 * not rebuild the discard pile it claims to have left — returns null, and the
 * caller drops the save and goes home rather than dealing the player into an
 * invented position. Nothing here repairs anything.
 *
 * The log is checked as strictly as the cards because it is *read* as strictly
 * as the cards: it is the CPU's whole memory of the hand, so an unchecked one
 * would be a way to hand the opponent knowledge from outside the game
 * (types.ts `isConsistentLog`).
 */
import { isCard, type Card } from './cards';
import {
  isConsistentLog,
  isSeat,
  isValidHand,
  type HandEnding,
  type HandState,
  type Phase,
  type PublicEvent,
  type Seat,
} from './types';

/** Bumped only if the shape below changes; see compatibility.test.ts. */
const FORMAT_VERSION = '1';

const PHASE_CODES: Readonly<Record<Phase, string>> = {
  upcard: 'u',
  draw: 'd',
  discard: 'c',
  over: 'o',
};

const ENDING_CODES: Readonly<Record<HandEnding, string>> = {
  none: 'n',
  knock: 'k',
  dead: 'x',
};

const EVENT_CODES: Readonly<Record<PublicEvent['kind'], string>> = {
  upcard: 'u',
  pass: 'p',
  'draw-stock': 's',
  'draw-discard': 'd',
  discard: 'x',
  knock: 'k',
  gin: 'g',
};

const NO_CARD = '--';
const CARD_WIDTH = 2;
const EVENT_WIDTH = 4;

const encodeCard = (card: Card): string => card.toString(36).padStart(CARD_WIDTH, '0');
const encodeCards = (cards: readonly Card[]): string => cards.map(encodeCard).join('');

/** Strict: only the two lowercase base-36 digits `encodeCard` produces. */
function decodeCard(text: string): Card | null {
  if (text.length !== CARD_WIDTH) return null;
  const card = Number.parseInt(text, 36);
  if (!isCard(card) || encodeCard(card) !== text) return null;
  return card;
}

function decodeCards(text: string): Card[] | null {
  if (text.length % CARD_WIDTH !== 0) return null;
  const cards: Card[] = [];
  for (let at = 0; at < text.length; at += CARD_WIDTH) {
    const card = decodeCard(text.slice(at, at + CARD_WIDTH));
    if (card === null) return null;
    cards.push(card);
  }
  return cards;
}

function encodeEvent(event: PublicEvent): string {
  const kind = EVENT_CODES[event.kind];
  const seat = event.kind === 'upcard' ? '-' : String(event.seat);
  const card =
    event.kind === 'pass' || event.kind === 'draw-stock' ? NO_CARD : encodeCard(event.card);
  return `${kind}${seat}${card}`;
}

function decodeEvent(text: string): PublicEvent | null {
  if (text.length !== EVENT_WIDTH) return null;
  const kind = text[0]!;
  const seatText = text[1]!;
  const cardText = text.slice(2);
  const card = cardText === NO_CARD ? null : decodeCard(cardText);
  if (cardText !== NO_CARD && card === null) return null;

  const seatNumber = Number.parseInt(seatText, 10);
  const seat: Seat | null = isSeat(seatNumber) ? seatNumber : null;

  if (kind === 'u') return seatText === '-' && card !== null ? { kind: 'upcard', card } : null;
  if (seat === null) return null;
  if (kind === 'p') return card === null ? { kind: 'pass', seat } : null;
  if (kind === 's') return card === null ? { kind: 'draw-stock', seat } : null;
  if (card === null) return null;
  if (kind === 'd') return { kind: 'draw-discard', seat, card };
  if (kind === 'x') return { kind: 'discard', seat, card };
  if (kind === 'k') return { kind: 'knock', seat, card };
  if (kind === 'g') return { kind: 'gin', seat, card };
  return null;
}

function decodeLog(text: string): PublicEvent[] | null {
  if (text.length % EVENT_WIDTH !== 0) return null;
  const events: PublicEvent[] = [];
  for (let at = 0; at < text.length; at += EVENT_WIDTH) {
    const event = decodeEvent(text.slice(at, at + EVENT_WIDTH));
    if (event === null) return null;
    events.push(event);
  }
  return events;
}

export function encodeHand(hand: HandState): string {
  const flags = [
    String(hand.dealer),
    String(hand.turn),
    PHASE_CODES[hand.phase],
    ENDING_CODES[hand.ending],
    hand.mustDrawStock ? '1' : '0',
  ].join('');
  return [
    FORMAT_VERSION,
    flags,
    hand.takenFromDiscard === null ? NO_CARD : encodeCard(hand.takenFromDiscard),
    encodeCards(hand.hands[0]),
    encodeCards(hand.hands[1]),
    encodeCards(hand.stock),
    encodeCards(hand.discard),
    hand.log.map(encodeEvent).join(''),
  ].join('/');
}

const FIELD_COUNT = 8;

/** Decodes a persisted hand. Returns null when anything does not add up. */
export function decodeHand(text: string): HandState | null {
  if (typeof text !== 'string') return null;
  const fields = text.split('/');
  if (fields.length !== FIELD_COUNT || fields[0] !== FORMAT_VERSION) return null;

  const flags = fields[1]!;
  if (flags.length !== 5) return null;
  const dealer = Number.parseInt(flags[0]!, 10);
  const turn = Number.parseInt(flags[1]!, 10);
  if (!isSeat(dealer) || !isSeat(turn)) return null;

  const phase = (Object.keys(PHASE_CODES) as Phase[]).find((key) => PHASE_CODES[key] === flags[2]);
  const ending = (Object.keys(ENDING_CODES) as HandEnding[]).find(
    (key) => ENDING_CODES[key] === flags[3],
  );
  if (phase === undefined || ending === undefined) return null;
  if (flags[4] !== '0' && flags[4] !== '1') return null;

  const takenText = fields[2]!;
  const takenFromDiscard = takenText === NO_CARD ? null : decodeCard(takenText);
  if (takenText !== NO_CARD && takenFromDiscard === null) return null;

  const you = decodeCards(fields[3]!);
  const cpu = decodeCards(fields[4]!);
  const stock = decodeCards(fields[5]!);
  const discard = decodeCards(fields[6]!);
  const log = decodeLog(fields[7]!);
  if (you === null || cpu === null || stock === null || discard === null || log === null) {
    return null;
  }

  const hand: HandState = {
    dealer,
    hands: [you, cpu],
    stock,
    discard,
    turn,
    phase,
    ending,
    takenFromDiscard,
    mustDrawStock: flags[4] === '1',
    log,
  };
  // Two questions, asked in two places on purpose. `isValidHand` asks whether
  // the cards on the table form a position the rules allow — the engine's own
  // tests build positions card by card to assert about them, so it has to stay
  // answerable about a table with no history attached. `isConsistentLog` asks
  // whether the public record could have produced that table, and the only
  // place a record arrives from outside the program is right here.
  return isValidHand(hand) && isConsistentLog(hand) ? hand : null;
}
