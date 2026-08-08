/**
 * Converts between the in-memory GinRummySession and its persisted form. The
 * match is turn-based and comes back exactly as it was left, which is why this
 * title saves at all — a match runs to a hundred points across many hands, and
 * a hand is the natural place to put it down.
 *
 * There is no undo history to leave out: this game has none, and the reason is
 * the game's own (game/session.ts). What *is* left out is the match status and
 * the last hand's result — both are functions of the score and the hand, so
 * `restoreSession` recomputes them rather than trusting a record that could
 * disagree with itself.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import { decodeHand, encodeHand, restoreSession, type GinRummySession } from '../game';
import { gameSchema, type PersistedGame } from './schemas';

export function toPersisted(session: GinRummySession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    seed: session.seed,
    difficulty: session.difficulty,
    hand: encodeHand(session.hand),
    handNumber: session.handNumber,
    scores: [session.scores[0], session.scores[1]],
    moveCount: session.moveCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

function toSession(persisted: PersistedGame | null): GinRummySession | null {
  if (persisted === null) return null;
  // The decoder is the fifty-two-card gate (game/serialize.ts). The schema ran
  // it once to accept the record; running it again is what produces the hand,
  // and it fails closed here for exactly the same reasons.
  const hand = decodeHand(persisted.hand);
  if (hand === null) return null;

  // The move count is half the CPU's tie-break draw (`${seed}:cpu:${moveCount}`
  // in game/session.ts), so a save whose count disagrees with its own history
  // would resume a match that answers differently from the one that was put
  // down. Earlier hands' action counts are not stored, but the floor is: every
  // event in this hand after the deal's upcard was one action, and every deal
  // after the first was one more. Anything under that could not have come from
  // play. Fail closed, like the hand itself.
  const minimumMoves = persisted.handNumber - 1 + Math.max(0, hand.log.length - 1);
  if (persisted.moveCount < minimumMoves) return null;

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

export async function loadSavedGame(kv: KVStore = preferencesKV): Promise<GinRummySession | null> {
  return toSession(await loadRecord(gameSchema, kv));
}

export async function saveGame(
  session: GinRummySession,
  kv: KVStore = preferencesKV,
): Promise<void> {
  await saveRecord(gameSchema, toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(gameSchema.key, kv);
}
