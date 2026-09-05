/**
 * Converts between the in-memory MahjongSession and its persisted form
 * (docs/MAHJONG_SOLITAIRE_RULES.md §10).
 *
 * Restoring is generation plus REPLAY: the board is rebuilt from the
 * identity alone (layout and seed both derive from it — storing either would
 * be a second truth), and the saved removal order is then replayed pair by
 * pair, each pair required to have been free and matching at its own moment.
 * One impossible step discards the record: fail-closed as a fact, not an
 * approximation. The work is bounded — generation runs under the node budget
 * with the witness as its floor (§5), and the replay is O(n) over at most 72
 * pairs — so a hostile record cannot buy unbounded computation either.
 *
 * Each mode has its own slot, so suspending a level game and playing the
 * daily never costs you either one.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import {
  encodeRemovals,
  generateBoard,
  paramsFor,
  replayRemovals,
  restoreSession,
  seedFor,
  type GameMode,
  type MahjongSession,
} from '../game';
import { dailyGameSchema, gameSchema, type PersistedGame } from './schemas';

export interface SavedGames {
  level: MahjongSession | null;
  daily: MahjongSession | null;
}

const schemaFor = (mode: GameMode) => (mode === 'daily' ? dailyGameSchema : gameSchema);

export function toPersisted(session: MahjongSession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    mode: session.mode,
    level: session.level,
    dailyDate: session.dailyDate,
    removed: encodeRemovals(session.layout, session.removed).map(
      (pair) => [...pair] as [number, number, number, number, number, number],
    ),
    hintCount: session.hintCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

function toSession(persisted: PersistedGame | null): MahjongSession | null {
  if (persisted === null) return null;
  const params = paramsFor(persisted.mode, persisted.level);
  const seed = seedFor(persisted.mode, persisted.level, persisted.dailyDate);
  const board = generateBoard(params, seed);
  const removed = replayRemovals(board.layout, board.faces, persisted.removed);
  if (removed === null) return null;
  const session = restoreSession({
    mode: persisted.mode,
    level: persisted.level,
    dailyDate: persisted.dailyDate,
    removed,
    elapsedSeconds: persisted.elapsedSeconds,
    hintCount: persisted.hintCount,
  });
  // Only resume a game that is still in progress.
  return session.status === 'playing' ? session : null;
}

/**
 * The one suspended game a home-screen shortcut may open straight onto, or
 * null when there is no single answer (issue #113).
 *
 * A shortcut is a way back into the game somebody was playing. With two slots
 * kept deliberately apart — a level and the daily, so switching modes never
 * costs the player either one (§6, §10) — "the game they were playing" is
 * only a fact when exactly one of them is suspended. Two would make it a
 * guess, and guessing wrong drops somebody onto a board they did not ask for,
 * mid-game. None and two both mean the home screen, which is where every
 * other door leads anyway, and where both games are still waiting.
 *
 * Reads this game's own saves and nothing else: the shell says which door was
 * used and never learns what was decided here
 * (docs/ARCHITECTURE.md「ゲームレジストリの契約」). The status test is the
 * home screen's own — a record that survived `toSession` is already in
 * progress, and saying so twice costs nothing.
 */
export function soleSuspendedMode(saved: SavedGames): GameMode | null {
  const suspended = (['level', 'daily'] as const).filter(
    (mode) => saved[mode]?.status === 'playing',
  );
  return suspended.length === 1 ? suspended[0]! : null;
}

export async function loadSavedGames(kv: KVStore = preferencesKV): Promise<SavedGames> {
  const [level, daily] = await Promise.all([
    loadRecord(gameSchema, kv),
    loadRecord(dailyGameSchema, kv),
  ]);
  return { level: toSession(level), daily: toSession(daily) };
}

export async function saveGame(
  session: MahjongSession,
  kv: KVStore = preferencesKV,
): Promise<void> {
  await saveRecord(schemaFor(session.mode), toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(mode: GameMode, kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(schemaFor(mode).key, kv);
}
