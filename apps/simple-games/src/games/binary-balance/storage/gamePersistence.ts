/**
 * Converts between the in-memory BinaryBalanceSession and its persisted form
 * (docs/BINARY_BALANCE_RULES.md §11).
 *
 * Loading is fail-closed, and `decodeBoards` is where that happens: a record
 * only becomes a session if it is one play could have produced — links that
 * name real edges (at least one), an answer that keeps all three rules under
 * them, givens that agree with the answer, marks that never sit on a given.
 * Anything else is dropped for a fresh board, because the alternative is
 * handing the player a puzzle whose answer is wrong.
 *
 * Two independent slots: one difficulty game and one daily. Suspending a hard
 * board to play today's daily never costs you either one (§10).
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import {
  decodeBoards,
  encodeBoard,
  encodeLinks,
  isSize,
  localDateString,
  restoreSession,
  type BinaryBalanceSession,
  type GameMode,
} from '../game';
import { dailyGameSchema, gameSchema, type PersistedGame } from './schemas';

export interface SavedGames {
  difficulty: BinaryBalanceSession | null;
  daily: BinaryBalanceSession | null;
}

const schemaFor = (mode: GameMode) => (mode === 'daily' ? dailyGameSchema : gameSchema);

export function toPersisted(session: BinaryBalanceSession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    mode: session.mode,
    seed: session.seed,
    difficulty: session.difficulty,
    dailyDate: session.dailyDate,
    size: session.size,
    solution: encodeBoard(session.solution),
    givens: encodeBoard(session.givens),
    marks: encodeBoard(session.marks),
    links: encodeLinks(session.links),
    hintCount: session.hintCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

export function toSession(persisted: PersistedGame | null): BinaryBalanceSession | null {
  if (persisted === null || !isSize(persisted.size)) return null;
  const boards = decodeBoards(persisted, persisted.size);
  if (boards === null) return null;

  const session = restoreSession({
    mode: persisted.mode,
    seed: persisted.seed,
    difficulty: persisted.difficulty,
    dailyDate: persisted.dailyDate,
    size: persisted.size,
    solution: boards.solution,
    givens: boards.givens,
    links: boards.links,
    marks: boards.marks,
    elapsedSeconds: persisted.elapsedSeconds,
    hintCount: persisted.hintCount,
  });
  // Only resume a game that is still in progress. A finished one is history.
  return session.status === 'playing' ? session : null;
}

/**
 * The one suspended game a home-screen shortcut may open straight onto, or
 * null when there is no single answer (issue #113).
 *
 * A shortcut is a way back into the game somebody was playing. With two
 * independent slots — one difficulty board, one daily (§10, §11) — "the game
 * they were playing" is only a fact when exactly one of them is suspended.
 * Two would make it a guess, and guessing wrong drops somebody onto the other
 * board mid-game. None and two both mean the home screen. Nothing is cleared
 * either way.
 *
 * Reads the game's own saves and nothing else: the shell hands over which door
 * was used and never learns what this decided
 * (docs/ARCHITECTURE.md「ゲームレジストリの契約」).
 */
export function soleSuspendedMode(saved: SavedGames): GameMode | null {
  const suspended = (['difficulty', 'daily'] as const).filter(
    (mode) => saved[mode]?.status === 'playing',
  );
  return suspended.length === 1 ? suspended[0]! : null;
}

async function loadSlots(kv: KVStore): Promise<SavedGames> {
  const [difficulty, daily] = await Promise.all([
    loadRecord(gameSchema, kv),
    loadRecord(dailyGameSchema, kv),
  ]);
  return { difficulty: toSession(difficulty), daily: toSession(daily) };
}

/**
 * The daily slot holds today's board or nothing (docs/PRODUCT_PRINCIPLES.md
 * 「デイリーは今日の 1 問」). A board left over from another day is dropped here,
 * record and all, so no door — the home button, a shortcut — can reopen it.
 * `today` is a seam for the tests; production reads the device clock.
 */
export async function loadSavedGames(
  kv: KVStore = preferencesKV,
  today: string = localDateString(new Date()),
): Promise<SavedGames> {
  const saved = await loadSlots(kv);
  if (saved.daily !== null && saved.daily.dailyDate !== today) {
    await removeRecord(dailyGameSchema.key, kv);
    return { ...saved, daily: null };
  }
  return saved;
}

export async function saveGame(
  session: BinaryBalanceSession,
  kv: KVStore = preferencesKV,
): Promise<void> {
  await saveRecord(schemaFor(session.mode), toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(mode: GameMode, kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(schemaFor(mode).key, kv);
}
