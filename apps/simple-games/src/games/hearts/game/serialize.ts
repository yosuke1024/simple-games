/**
 * Compact, corruption-tolerant serialization of one hand, for the single
 * suspended-match slot.
 *
 * A card is two base-36 digits (`00`..`1f`), a run of cards is those digits
 * run together, and the whole hand is twelve `/`-separated fields: a format
 * version, the flags, the four hands, the four pass selections, the trick on
 * the table, and the finished tricks. Each finished trick is its leader
 * followed by its four cards, in the order they landed — which is all the
 * public record of a Hearts hand there is, and therefore all the memory the
 * CPU has of it (cpu.ts). Resume a match without it and the opponent has
 * forgotten which suits you were void in, which is a different opponent from
 * the one you suspended.
 *
 * Decoding **fails closed**. A record that could not have come from play — a
 * missing or duplicated card, a hand out of order, a pass that does not fit
 * its phase, a trick somebody could not legally have played — returns null,
 * and the caller drops the save and goes home rather than dealing the player
 * into an invented position. Nothing here repairs anything.
 */
import { isCard, type Card } from './cards';
import { isValidHand } from './engine';
import {
  bySeat,
  isSeat,
  SEAT_COUNT,
  SEATS,
  type BySeat,
  type HandState,
  type Phase,
  type Trick,
} from './types';

/** Bumped only if the shape below changes; see compatibility.test.ts. */
const FORMAT_VERSION = '1';

const PHASE_CODES: Readonly<Record<Phase, string>> = {
  passing: 'p',
  playing: 'l',
  over: 'o',
};

const CARD_WIDTH = 2;
/** A leader digit plus its four cards. */
const TRICK_WIDTH = 1 + SEAT_COUNT * CARD_WIDTH;
const FLAG_WIDTH = 4 + SEAT_COUNT;
const FIELD_COUNT = 12;

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

const encodeTrick = (trick: Trick): string => `${trick.leader}${encodeCards(trick.cards)}`;

function decodeTricks(text: string): Trick[] | null {
  if (text.length % TRICK_WIDTH !== 0) return null;
  const tricks: Trick[] = [];
  for (let at = 0; at < text.length; at += TRICK_WIDTH) {
    const leader = Number.parseInt(text[at]!, 10);
    if (!isSeat(leader)) return null;
    const cards = decodeCards(text.slice(at + 1, at + TRICK_WIDTH));
    if (cards === null || cards.length !== SEAT_COUNT) return null;
    tricks.push({ leader, cards: [cards[0]!, cards[1]!, cards[2]!, cards[3]!] });
  }
  return tricks;
}

export function encodeHand(hand: HandState): string {
  const flags = [
    String(hand.passOffset),
    PHASE_CODES[hand.phase],
    String(hand.leader),
    hand.heartsBroken ? '1' : '0',
    ...SEATS.map((seat) => (hand.confirmed[seat] ? '1' : '0')),
  ].join('');
  return [
    FORMAT_VERSION,
    flags,
    ...SEATS.map((seat) => encodeCards(hand.hands[seat])),
    ...SEATS.map((seat) => encodeCards(hand.selected[seat])),
    encodeCards(hand.played),
    hand.tricks.map(encodeTrick).join(''),
  ].join('/');
}

/** Reads four card lists out of consecutive fields, or null if any is malformed. */
function decodeBySeat(fields: readonly string[], from: number): BySeat<readonly Card[]> | null {
  const lists = SEATS.map((seat) => decodeCards(fields[from + seat]!));
  if (lists.some((list) => list === null)) return null;
  return bySeat<readonly Card[]>((seat) => lists[seat]!);
}

/** Decodes a persisted hand. Returns null when anything does not add up. */
export function decodeHand(text: string): HandState | null {
  if (typeof text !== 'string') return null;
  const fields = text.split('/');
  if (fields.length !== FIELD_COUNT || fields[0] !== FORMAT_VERSION) return null;

  const flags = fields[1]!;
  if (flags.length !== FLAG_WIDTH) return null;
  const passOffset = Number.parseInt(flags[0]!, 10);
  const leader = Number.parseInt(flags[2]!, 10);
  if (!isSeat(passOffset) || !isSeat(leader)) return null;

  const phase = (Object.keys(PHASE_CODES) as Phase[]).find((key) => PHASE_CODES[key] === flags[1]);
  if (phase === undefined) return null;
  if (flags[3] !== '0' && flags[3] !== '1') return null;
  const confirmedFlags = SEATS.map((seat) => flags[4 + seat]!);
  if (confirmedFlags.some((flag) => flag !== '0' && flag !== '1')) return null;

  const hands = decodeBySeat(fields, 2);
  const selected = decodeBySeat(fields, 2 + SEAT_COUNT);
  const played = decodeCards(fields[2 + SEAT_COUNT * 2]!);
  const tricks = decodeTricks(fields[3 + SEAT_COUNT * 2]!);
  if (hands === null || selected === null || played === null || tricks === null) return null;

  const hand: HandState = {
    // A pass offset and a seat are the same four numbers — an offset *is* a
    // number of seats round the table — so one guard does for both.
    passOffset,
    hands,
    selected,
    confirmed: bySeat<boolean>((seat) => confirmedFlags[seat] === '1'),
    phase,
    leader,
    played,
    tricks,
    heartsBroken: flags[3] === '1',
  };
  return isValidHand(hand) ? hand : null;
}
