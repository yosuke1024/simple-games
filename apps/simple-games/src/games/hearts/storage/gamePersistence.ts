/**
 * Converts between the in-memory HeartsSession and its persisted form. The
 * match is turn-based and comes back exactly as it was left, which is why this
 * title saves at all — a match runs to a hundred points across many hands, and
 * a hand is the natural place to put it down.
 *
 * There is no undo history to leave out: this game has none, and the reason is
 * the game's own (game/session.ts). What *is* left out is the match status and
 * the last hand's result — both are functions of the scores and the hand, so
 * `restoreSession` recomputes them rather than trusting a record that could
 * disagree with itself.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import {
  decodeHand,
  encodeHand,
  passOffsetOf,
  restoreSession,
  SEAT_COUNT,
  SEATS,
  TRICKS_PER_HAND,
  type HandState,
  type HeartsSession,
} from '../game';
import { gameSchema, type PersistedGame } from './schemas';

export function toPersisted(session: HeartsSession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    seed: session.seed,
    difficulty: session.difficulty,
    hand: encodeHand(session.hand),
    handNumber: session.handNumber,
    scores: [session.scores[0], session.scores[1], session.scores[2], session.scores[3]],
    moveCount: session.moveCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

/**
 * Beats spent on this hand's pass: none at all on the hand nobody passes, the
 * confirmations so far while the seats are still choosing, and four once the
 * fourth confirmation has resolved the exchange and cleared the flags.
 *
 * Picking cards up and putting them down is *not* a beat (game/session.ts):
 * staging changes what is on offer and nothing else, so a hand saved with two
 * cards picked out has taken exactly as many beats as one saved with none.
 */
function passBeatsIn(hand: HandState): number {
  if (hand.passOffset === 0) return 0;
  if (hand.phase !== 'passing') return SEAT_COUNT;
  return SEATS.filter((seat) => hand.confirmed[seat]).length;
}

/** Every trick costs four cards played and one collect. */
const BEATS_PER_TRICK = SEAT_COUNT + 1;

/** Beats a hand has taken: its pass, the cards on the table, the tricks taken in. */
const beatsIn = (hand: HandState): number =>
  passBeatsIn(hand) + hand.played.length + hand.tricks.length * BEATS_PER_TRICK;

/**
 * What `moveCount` must be for a match `handNumber` hands in with `hand` on the
 * table — not a floor but the number itself, because in Hearts every beat is
 * visible in the position. A hand records the cards played and the tricks taken
 * in; the hands before it were each played out in full, and the pass direction
 * of each is fixed by its number (`passOffsetOf`), so there is nothing left to
 * guess at.
 *
 * The count matters because it is half the CPU's tie-break draw
 * (`${seed}:cpu:${moveCount}` in game/session.ts). A save whose count disagrees
 * with its own history would resume a match that answers differently from the
 * one that was put down, so it is refused rather than played on with.
 */
function expectedMoveCount(handNumber: number, hand: HandState): number {
  // One beat per deal after the first, then every finished hand: its four
  // confirmations (on three hands in four) and its thirteen tricks.
  let total = handNumber - 1;
  for (let earlier = 1; earlier < handNumber; earlier++) {
    total += passOffsetOf(earlier) === 0 ? 0 : SEAT_COUNT;
    total += TRICKS_PER_HAND * BEATS_PER_TRICK;
  }
  return total + beatsIn(hand);
}

function toSession(persisted: PersistedGame | null): HeartsSession | null {
  if (persisted === null) return null;
  // The decoder is the fifty-two-card gate (game/serialize.ts). The schema ran
  // it once to accept the record; running it again is what produces the hand,
  // and it fails closed here for exactly the same reasons.
  const hand = decodeHand(persisted.hand);
  if (hand === null) return null;

  // The pass turns with the hand number and nothing else, so a hand claiming a
  // direction its number does not deal is a hand that was never dealt.
  if (hand.passOffset !== passOffsetOf(persisted.handNumber)) return null;
  if (persisted.moveCount !== expectedMoveCount(persisted.handNumber, hand)) return null;

  const session = restoreSession({
    seed: persisted.seed,
    difficulty: persisted.difficulty,
    hand,
    handNumber: persisted.handNumber,
    scores: persisted.scores,
    moveCount: persisted.moveCount,
    elapsedSeconds: persisted.elapsedSeconds,
  });
  // A finished match is not something to come back to: the next one is free
  // and starts fresh. The schema refuses a winning score outright; this is the
  // same rule stated where the session is, so neither layer relies on the other.
  return session.status === 'playing' ? session : null;
}

export async function loadSavedGame(kv: KVStore = preferencesKV): Promise<HeartsSession | null> {
  return toSession(await loadRecord(gameSchema, kv));
}

export async function saveGame(session: HeartsSession, kv: KVStore = preferencesKV): Promise<void> {
  await saveRecord(gameSchema, toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(gameSchema.key, kv);
}
