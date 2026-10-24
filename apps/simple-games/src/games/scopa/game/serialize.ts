/**
 * The suspended match, written as its public history and read back by
 * replaying it (docs/SCOPA_RULES.md §9.1, §9.2).
 *
 * A deal is `1/<rounds>/<plays>`: the format version, the rounds dealt (1..6),
 * and the cards played, `.`-separated. Each play is the card put down followed
 * by the table cards it took — ascending, nothing for a placement — every card
 * two lowercase base-36 digits (`00`..`13`). The opening deal, the reshuffles
 * and the stock are rebuilt from the seed and the deal number, so they are not
 * stored; the hands, the table, the takings, the scopas and whose turn it is
 * are what the replay leaves behind.
 *
 * Decoding **fails closed**. Every play goes back through `applyMove`, the
 * same one rule the game is played under, so a capture the rules could not
 * have produced — a sum taken while the same value lay on the table, a sum
 * that does not add up, a card that could take and was placed, a card that
 * was never on the table, a card played twice or out of turn — returns null,
 * and so does a record whose own fields disagree with what the replay gives:
 * the dealer, the exact move count, a score no sequence of deals could reach
 * (too few points for the deals played, or more than they could give out),
 * a match that has already been decided. The caller drops the save and goes
 * home; nothing here repairs anything, and nothing starts a new match.
 *
 * `decodeSavedMatch` is the one function both the storage schema's `validate`
 * and the loader call (§9.2「検証の置き場所」): pure, no throw, null or a session.
 */
import { isCard, type Card } from './cards';
import {
  applyMove,
  applyRefill,
  dealDeal,
  dealerOf,
  isCompleteDeck,
  phaseOf,
  settleDeal,
  shuffleDeck,
  type DeckShuffler,
} from './engine';
import { restoreSession, statusOf, type ScopaSession } from './session';
import {
  isSeat,
  MAX_DEAL_POINTS,
  PLAYS_PER_DEAL,
  PLAYS_PER_ROUND,
  ROUNDS_PER_DEAL,
  type BySeat,
  type DealState,
  type Seat,
} from './types';

/** Bumped only if the shape below changes; see compatibility.test.ts. */
const FORMAT_VERSION = '1';
const CARD_WIDTH = 2;

const encodeCard = (card: Card): string => card.toString(36).padStart(CARD_WIDTH, '0');

/** Strict: only the two lowercase base-36 digits `encodeCard` produces. */
function decodeCard(text: string): Card | null {
  if (text.length !== CARD_WIDTH) return null;
  const card = Number.parseInt(text, 36);
  if (!isCard(card) || encodeCard(card) !== text) return null;
  return card;
}

export function encodeDeal(deal: DealState): string {
  const plays = deal.plays.map((play) => [play.card, ...play.captured].map(encodeCard).join(''));
  return [FORMAT_VERSION, String(deal.rounds), plays.join('.')].join('/');
}

interface ParsedPlay {
  readonly card: Card;
  readonly captured: readonly Card[];
}

function parsePlay(text: string): ParsedPlay | null {
  if (text.length === 0 || text.length % CARD_WIDTH !== 0) return null;
  const cards: Card[] = [];
  for (let at = 0; at < text.length; at += CARD_WIDTH) {
    const card = decodeCard(text.slice(at, at + CARD_WIDTH));
    if (card === null) return null;
    cards.push(card);
  }
  const [card, ...captured] = cards;
  // The encoder writes taken cards ascending; anything else (a repeat
  // included) did not come from it.
  for (let at = 1; at < captured.length; at++) {
    if (captured[at]! <= captured[at - 1]!) return null;
  }
  return { card: card!, captured };
}

/**
 * Rebuilds a deal from its history: the seed's opening, then each play
 * through the engine, with the refills dealt wherever the history needs them.
 * Null at the first thing that does not add up.
 */
export function decodeDeal(
  seed: string,
  dealNumber: number,
  text: unknown,
  shuffle: DeckShuffler = shuffleDeck,
): DealState | null {
  if (typeof text !== 'string') return null;
  const fields = text.split('/');
  if (fields.length !== 3 || fields[0] !== FORMAT_VERSION) return null;
  const roundsText = fields[1]!;
  if (!/^[1-9]$/.test(roundsText)) return null;
  const rounds = Number(roundsText);
  if (rounds > ROUNDS_PER_DEAL) return null;

  const playTexts = fields[2]! === '' ? [] : fields[2]!.split('.');
  if (playTexts.length > PLAYS_PER_DEAL) return null;
  const p = playTexts.length;
  if (p < PLAYS_PER_ROUND * (rounds - 1) || p > PLAYS_PER_ROUND * rounds) return null;

  let deal: DealState | null = dealDeal(seed, dealNumber, dealerOf(seed, dealNumber), shuffle);
  for (const playText of playTexts) {
    const play = parsePlay(playText);
    if (play === null) return null;
    if (phaseOf(deal) === 'refill') deal = applyRefill(deal);
    if (deal === null) return null;
    deal = applyMove(deal, play);
    if (deal === null) return null;
  }
  // A full round played and the record says the next one was dealt: deal it.
  if (deal.rounds === rounds - 1 && phaseOf(deal) === 'refill') deal = applyRefill(deal);
  if (deal === null || deal.rounds !== rounds) return null;
  return isCompleteDeck(deal) ? deal : null;
}

/** The `sc.saveGame` record, v1 (§9.1). */
export interface SavedMatch {
  readonly schemaVersion: 1;
  readonly seed: string;
  readonly dealNumber: number;
  readonly dealer: Seat;
  readonly scores: BySeat<number>;
  readonly moveCount: number;
  readonly elapsedSeconds: number;
  readonly deal: string;
  readonly savedAt: number;
}

/** Format bounds — not rules, only the range a sane record falls inside (§9.2). */
export const SAVE_LIMITS = {
  seedLength: 64,
  dealNumber: 999,
  score: 999,
  elapsedSeconds: 1e7,
  savedAt: 1e15,
} as const;

export function toSavedMatch(session: ScopaSession, savedAt: number): SavedMatch {
  return {
    schemaVersion: 1,
    seed: session.seed,
    dealNumber: session.dealNumber,
    dealer: session.deal.dealer,
    scores: [session.scores[0], session.scores[1]],
    moveCount: session.moveCount,
    elapsedSeconds: Math.floor(session.elapsedSeconds),
    deal: encodeDeal(session.deal),
    savedAt: Math.floor(savedAt),
  };
}

const intIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Both under eleven, or level at eleven or more: a match that has not ended (§3.4). */
export const isUndecided = (scores: BySeat<number>): boolean => statusOf(scores) === 'playing';

/**
 * Whether the scores before a deal could have been reached (§9.2「点の整合」).
 * No deal ends with no points (7♦ always scores) and none gives out more than
 * `MAX_DEAL_POINTS` (four categories and eighteen scopas, by arithmetic), so
 * after `dealNumber − 1` deals the sum lies between those two multiples —
 * which, before the first deal, is exactly nothing.
 */
const reachableBefore = (scores: BySeat<number>, dealNumber: number): boolean => {
  const done = dealNumber - 1;
  const sum = scores[0] + scores[1];
  return scores[0] >= 0 && scores[1] >= 0 && sum >= done && sum <= MAX_DEAL_POINTS * done;
};

/**
 * Reads a saved match back, or null (§9.2). Pure and total: whatever `raw` is,
 * this returns rather than throws.
 */
export function decodeSavedMatch(
  raw: unknown,
  shuffle: DeckShuffler = shuffleDeck,
): ScopaSession | null {
  if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
  const { seed, dealNumber, dealer, scores, moveCount, elapsedSeconds, savedAt } = raw;
  if (typeof seed !== 'string' || seed.length < 1 || seed.length > SAVE_LIMITS.seedLength) {
    return null;
  }
  if (!intIn(dealNumber, 1, SAVE_LIMITS.dealNumber)) return null;
  if (!isSeat(dealer) || dealer !== dealerOf(seed, dealNumber)) return null;
  if (
    !Array.isArray(scores) ||
    scores.length !== 2 ||
    !intIn(scores[0], 0, SAVE_LIMITS.score) ||
    !intIn(scores[1], 0, SAVE_LIMITS.score)
  ) {
    return null;
  }
  if (!intIn(elapsedSeconds, 0, SAVE_LIMITS.elapsedSeconds)) return null;
  if (!intIn(savedAt, 0, SAVE_LIMITS.savedAt)) return null;

  const deal = decodeDeal(seed, dealNumber, raw.deal, shuffle);
  if (deal === null) return null;
  const p = deal.plays.length;
  if (moveCount !== PLAYS_PER_DEAL * (dealNumber - 1) + p) return null;

  const score: BySeat<number> = [scores[0] as number, scores[1] as number];
  if (!isUndecided(score)) return null;
  const settled = settleDeal(deal);
  const before: BySeat<number> =
    settled === null ? score : [score[0] - settled.points[0], score[1] - settled.points[1]];
  if (!reachableBefore(before, dealNumber) || !isUndecided(before)) return null;

  return restoreSession({
    seed,
    dealNumber,
    deal,
    scores: score,
    moveCount,
    elapsedSeconds,
  });
}
