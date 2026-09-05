/**
 * Converts between the in-memory SudokuSession and its persisted form.
 * Undo history is intentionally not persisted (docs/SUDOKU_RULES.md §11).
 *
 * Each mode has its own slot, so suspending a level game and playing the daily
 * (or a free board, §9) never costs you any of them.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import {
  decodeBoard,
  decodeSolution,
  encodeBoard,
  encodeSolution,
  restoreSession,
  type GameMode,
  type SudokuSession,
} from '../game';
import { dailyGameSchema, freeGameSchema, gameSchema, type PersistedGame } from './schemas';

export interface SavedGames {
  level: SudokuSession | null;
  daily: SudokuSession | null;
  free: SudokuSession | null;
}

const schemaFor = (mode: GameMode) =>
  mode === 'daily' ? dailyGameSchema : mode === 'free' ? freeGameSchema : gameSchema;

export function toPersisted(session: SudokuSession, savedAt: number): PersistedGame {
  const board = encodeBoard(session.board);
  return {
    schemaVersion: 1,
    mode: session.mode,
    seed: session.seed,
    difficulty: session.difficulty,
    dailyDate: session.dailyDate,
    level: session.level,
    givens: board.givens,
    entries: board.entries,
    notes: board.notes,
    solution: encodeSolution(session.solution),
    mistakeCount: session.mistakeCount,
    hintCount: session.hintCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

function toSession(persisted: PersistedGame | null): SudokuSession | null {
  if (persisted === null) return null;
  const board = decodeBoard({
    givens: persisted.givens,
    entries: persisted.entries,
    notes: persisted.notes,
  });
  const solution = decodeSolution(persisted.solution);
  if (board === null || solution === null) return null;

  const session = restoreSession({
    mode: persisted.mode,
    seed: persisted.seed,
    difficulty: persisted.difficulty,
    dailyDate: persisted.dailyDate,
    level: persisted.level,
    board,
    solution,
    mistakeCount: persisted.mistakeCount,
    hintCount: persisted.hintCount,
    elapsedSeconds: persisted.elapsedSeconds,
  });
  // Only resume a game that is still in progress.
  return session.status === 'playing' ? session : null;
}

/**
 * The one suspended game a home-screen shortcut may open straight onto, or
 * null when there is no single answer (issue #113).
 *
 * A shortcut is a way back into the game somebody was playing. With three
 * slots — a level, the daily, a free board (§11) — "the game they were
 * playing" is only a fact when exactly one of them is suspended. Two would
 * make it a guess, and guessing wrong drops somebody onto a board they did
 * not ask for, mid-puzzle. None and two both mean the home screen, which is
 * where every other door leads anyway.
 *
 * Reads the game's own saves and nothing else: the shell hands over which
 * door was used and never learns what this decided
 * (docs/ARCHITECTURE.md「ゲームレジストリの契約」).
 */
export function soleSuspendedMode(saved: SavedGames): GameMode | null {
  const suspended = (['level', 'daily', 'free'] as const).filter(
    (mode) => saved[mode]?.status === 'playing',
  );
  return suspended.length === 1 ? suspended[0]! : null;
}

export async function loadSavedGames(kv: KVStore = preferencesKV): Promise<SavedGames> {
  const [level, daily, free] = await Promise.all([
    loadRecord(gameSchema, kv),
    loadRecord(dailyGameSchema, kv),
    loadRecord(freeGameSchema, kv),
  ]);
  return { level: toSession(level), daily: toSession(daily), free: toSession(free) };
}

export async function saveGame(session: SudokuSession, kv: KVStore = preferencesKV): Promise<void> {
  await saveRecord(schemaFor(session.mode), toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(mode: GameMode, kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(schemaFor(mode).key, kv);
}
