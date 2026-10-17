/**
 * Converts between the in-memory UnblockSession and its persisted form
 * (docs/UNBLOCK_PUZZLE_RULES.md §11, §12).
 *
 * Loading is fail-closed, and `restoreSession` is where that happens: a
 * record only becomes a session if it is one play could have produced — a
 * board this game deals at that difficulty, its fewest moves the recorded
 * number (a bundled board, proved by catalogue.test.ts, or a fresh search);
 * a move list that replays through the rules; a daily that is exactly that
 * date's board; and a game not already won. Anything else is not resumed. The player lands on the game's home, the
 * slot reads as empty, and the next board started in it overwrites the record
 * — nothing new is started on their behalf.
 *
 * Two independent slots: one Free Play board and one daily. Suspending a hard
 * board to play today's daily never costs you either one (§9, §11).
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import {
  decodeBoard,
  encodeBoard,
  encodeMoves,
  localDateString,
  restoreSession,
  type GameMode,
  type UnblockSession,
} from '../game';
import { dailyGameSchema, gameSchema, type PersistedGame } from './schemas';

export interface SavedGames {
  free: UnblockSession | null;
  daily: UnblockSession | null;
}

const schemaFor = (mode: GameMode) => (mode === 'daily' ? dailyGameSchema : gameSchema);

export function toPersisted(session: UnblockSession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    mode: session.mode,
    seed: session.seed,
    difficulty: session.difficulty,
    dailyDate: session.dailyDate,
    board: encodeBoard(session.start),
    minMoves: session.minMoves,
    moves: encodeMoves(session.moves),
    hintCount: session.hintCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

/**
 * The session a record holds, or null when there is none worth resuming.
 * Never throws: `decodeBoard` and `restoreSession` both answer null for
 * anything they cannot vouch for.
 */
export function toSession(persisted: PersistedGame | null): UnblockSession | null {
  if (persisted === null) return null;
  const start = decodeBoard(persisted.board);
  if (start === null) return null;
  return restoreSession({
    mode: persisted.mode,
    seed: persisted.seed,
    difficulty: persisted.difficulty,
    dailyDate: persisted.dailyDate,
    start,
    minMoves: persisted.minMoves,
    moves: persisted.moves,
    elapsedSeconds: persisted.elapsedSeconds,
    hintCount: persisted.hintCount,
  });
}

/**
 * The one suspended game a home-screen shortcut may open straight onto, or
 * null when there is no single answer (issue #113, §11).
 *
 * A shortcut is a way back into the game somebody was playing. With two
 * independent slots, "the game they were playing" is only a fact when exactly
 * one of them is suspended. Two would make it a guess, and guessing wrong
 * drops somebody onto the other board mid-game. None and two both mean the
 * home screen, which is where every other door leads anyway. Nothing is
 * cleared either way.
 */
export function soleSuspendedMode(saved: SavedGames): GameMode | null {
  const suspended = (['free', 'daily'] as const).filter(
    (mode) => saved[mode]?.status === 'playing',
  );
  return suspended.length === 1 ? suspended[0]! : null;
}

/**
 * Both slots, read and checked. The daily slot holds today's board or nothing
 * (docs/PRODUCT_PRINCIPLES.md「デイリーは今日の 1 問」, §9): a record left over
 * from another day is dropped here, record and all, so no door — the home
 * button, a shortcut — can reopen it. The date is read before the board is
 * checked, so a stale daily is never checked at all. Checking costs no deal:
 * a daily is compared with its date's bundled board, and a Free Play board
 * that is its seed's bundled board is believed at once; only a board an
 * Easy or Medium deal changed costs one bounded forward search (§12).
 * `today` is a seam for the tests; production reads the device clock.
 */
export async function loadSavedGames(
  kv: KVStore = preferencesKV,
  today: string = localDateString(new Date()),
): Promise<SavedGames> {
  const [free, daily] = await Promise.all([
    loadRecord(gameSchema, kv),
    loadRecord(dailyGameSchema, kv),
  ]);
  if (daily !== null && daily.dailyDate !== today) {
    await removeRecord(dailyGameSchema.key, kv);
    return { free: toSession(free), daily: null };
  }
  return { free: toSession(free), daily: toSession(daily) };
}

export async function saveGame(
  session: UnblockSession,
  kv: KVStore = preferencesKV,
): Promise<void> {
  await saveRecord(schemaFor(session.mode), toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(mode: GameMode, kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(schemaFor(mode).key, kv);
}
