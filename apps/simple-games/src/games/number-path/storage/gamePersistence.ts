/**
 * Converts between the in-memory NumberPathSession and its persisted form
 * (docs/NUMBER_PATH_RULES.md §9).
 *
 * Two independent slots: one difficulty game and one daily. Suspending a hard
 * board to play today's daily never costs you either one (§7).
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import {
  decodeGame,
  encodeNumbers,
  restoreSession,
  type GameMode,
  type NumberPathSession,
} from '../game';
import { dailyGameSchema, gameSchema, type PersistedGame } from './schemas';

export interface SavedGames {
  difficulty: NumberPathSession | null;
  daily: NumberPathSession | null;
}

const schemaFor = (mode: GameMode) => (mode === 'daily' ? dailyGameSchema : gameSchema);

export function toPersisted(session: NumberPathSession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    mode: session.mode,
    seed: session.seed,
    difficulty: session.difficulty,
    dailyDate: session.dailyDate,
    width: session.board.width,
    height: session.board.height,
    numbers: encodeNumbers(session.board),
    walls: [...session.board.walls],
    solution: [...session.solution],
    path: [...session.path],
    hintCount: session.hintCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

/**
 * The session a record describes, or null when the record is one play could
 * not have written (§9): a board that does not build, a solution that is not
 * the one road, a path that is not a legal prefix — or a game already over.
 */
export function toSession(persisted: PersistedGame | null): NumberPathSession | null {
  if (persisted === null) return null;
  const decoded = decodeGame(persisted);
  if (decoded === null) return null;
  const session = restoreSession({
    mode: persisted.mode,
    seed: persisted.seed,
    difficulty: persisted.difficulty,
    dailyDate: persisted.dailyDate,
    board: decoded.board,
    solution: decoded.solution,
    path: decoded.path,
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
 * independent slots — one difficulty board, one daily (§7, §9) — "the game
 * they were playing" is only a fact when exactly one of them is suspended.
 * Two would make it a guess, and guessing wrong drops somebody onto the other
 * board mid-game. None and two both mean the home screen, which is where every
 * other door leads anyway. Nothing is cleared either way.
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

export async function loadSavedGames(kv: KVStore = preferencesKV): Promise<SavedGames> {
  const [difficulty, daily] = await Promise.all([
    loadRecord(gameSchema, kv),
    loadRecord(dailyGameSchema, kv),
  ]);
  return { difficulty: toSession(difficulty), daily: toSession(daily) };
}

export async function saveGame(
  session: NumberPathSession,
  kv: KVStore = preferencesKV,
): Promise<void> {
  await saveRecord(schemaFor(session.mode), toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(mode: GameMode, kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(schemaFor(mode).key, kv);
}
