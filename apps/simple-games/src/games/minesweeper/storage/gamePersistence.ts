/**
 * Converts between the in-memory MinesweeperSession and its persisted form
 * (docs/MINESWEEPER_RULES.md §10).
 *
 * Two independent slots: one difficulty game and one daily. Suspending a hard
 * board to play today's daily never costs you either one (§8).
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import {
  decodeBoard,
  encodeBoard,
  PRESETS,
  restoreSession,
  type GameMode,
  type MinesweeperSession,
} from '../game';
import { dailyGameSchema, gameSchema, type PersistedGame } from './schemas';

export interface SavedGames {
  difficulty: MinesweeperSession | null;
  daily: MinesweeperSession | null;
}

const schemaFor = (mode: GameMode) => (mode === 'daily' ? dailyGameSchema : gameSchema);

export function toPersisted(session: MinesweeperSession, savedAt: number): PersistedGame {
  const board = encodeBoard(session.board);
  return {
    schemaVersion: 1,
    mode: session.mode,
    seed: session.seed,
    difficulty: session.difficulty,
    dailyDate: session.dailyDate,
    firstIndex: session.firstIndex,
    width: board.width,
    height: board.height,
    mines: board.mines,
    opened: board.opened,
    flagged: board.flagged,
    exploded: board.exploded,
    elapsedSeconds: session.elapsedSeconds,
    hintCount: session.hintCount,
    savedAt,
  };
}

function toSession(persisted: PersistedGame | null): MinesweeperSession | null {
  if (persisted === null) return null;
  const preset = PRESETS[persisted.difficulty];
  // Before the first tap there are no mines yet, so that is the shape the
  // board is checked against (§4).
  const expected = persisted.firstIndex === null ? { ...preset, mines: 0 } : preset;
  const board = decodeBoard(
    {
      width: persisted.width,
      height: persisted.height,
      mines: persisted.mines,
      opened: persisted.opened,
      flagged: persisted.flagged,
      exploded: persisted.exploded,
    },
    expected,
  );
  if (board === null) return null;

  const session = restoreSession({
    mode: persisted.mode,
    seed: persisted.seed,
    difficulty: persisted.difficulty,
    dailyDate: persisted.dailyDate,
    board,
    firstIndex: persisted.firstIndex,
    elapsedSeconds: persisted.elapsedSeconds,
    hintCount: persisted.hintCount,
  });
  // Only resume a game that is still in progress. A finished one is history.
  return session.status === 'playing' ? session : null;
}

export async function loadSavedGames(kv: KVStore = preferencesKV): Promise<SavedGames> {
  const [difficulty, daily] = await Promise.all([
    loadRecord(gameSchema, kv),
    loadRecord(dailyGameSchema, kv),
  ]);
  return { difficulty: toSession(difficulty), daily: toSession(daily) };
}

export async function saveGame(
  session: MinesweeperSession,
  kv: KVStore = preferencesKV,
): Promise<void> {
  await saveRecord(schemaFor(session.mode), toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(mode: GameMode, kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(schemaFor(mode).key, kv);
}
