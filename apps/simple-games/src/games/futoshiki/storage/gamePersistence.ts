/**
 * Converts between the in-memory FutoshikiSession and its persisted form
 * (docs/FUTOSHIKI_RULES.md §11). Undo history is deliberately not persisted
 * (§5).
 *
 * Loading is fail-closed, and `decodeGame` in the game layer is where that
 * happens: a record only becomes a session if it is one play could have
 * produced — a solution that is a Latin square, signs that point the way the
 * solution reads, givens that agree with it, no entry sitting on a given, and
 * no note under a written digit. Anything else is dropped for a fresh board,
 * because the alternative is handing the player a puzzle whose answer is
 * wrong.
 *
 * The rules live in one place on purpose. This module knows the shape of the
 * record; the game knows what a legal board is, and asking it is what keeps
 * the two from drifting.
 *
 * Each mode has its own slot, so suspending a level game and playing the daily
 * (or a free board, §9) never costs you any of them.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import {
  decodeGame,
  encodeConstraints,
  encodeGrid,
  encodeNotes,
  restoreSession,
  type FutoshikiSession,
  type GameMode,
} from '../game';
import { dailyGameSchema, freeGameSchema, gameSchema, type PersistedGame } from './schemas';

export interface SavedGames {
  level: FutoshikiSession | null;
  daily: FutoshikiSession | null;
  free: FutoshikiSession | null;
}

const schemaFor = (mode: GameMode) =>
  mode === 'daily' ? dailyGameSchema : mode === 'free' ? freeGameSchema : gameSchema;

export function toPersisted(session: FutoshikiSession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    mode: session.mode,
    seed: session.seed,
    size: session.size,
    dailyDate: session.dailyDate,
    level: session.level,
    freeTier: session.freeTier,
    solution: encodeGrid(session.solution),
    constraints: encodeConstraints(session.constraints, session.size),
    givens: encodeGrid(session.board.givens),
    entries: encodeGrid(session.board.entries),
    notes: encodeNotes(session.board.notes),
    mistakeCount: session.mistakeCount,
    hintCount: session.hintCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

export function toSession(persisted: PersistedGame | null): FutoshikiSession | null {
  if (persisted === null) return null;
  const decoded = decodeGame(persisted, persisted.size);
  if (decoded === null) return null;

  const session = restoreSession({
    mode: persisted.mode,
    seed: persisted.seed,
    size: persisted.size,
    dailyDate: persisted.dailyDate,
    level: persisted.level,
    freeTier: persisted.freeTier,
    solution: decoded.solution,
    constraints: decoded.constraints,
    board: decoded.board,
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
 * slots held independently — a level, the daily, a free board (§9, §11) —
 * "the game they were playing" is only a fact when exactly one of them is
 * suspended. Two make it a guess, and guessing wrong drops the player onto a
 * board mid-puzzle that they did not ask for. `savedAt` is on every record
 * and would break the tie, which is exactly why it is not read here: the
 * newer of two is still a guess, only a better dressed one. None and two
 * both mean the home screen, where every other door already leads and where
 * both games are still offered by hand.
 *
 * The status test is the home screen's own (`sessions.level?.status ===
 * 'playing'` and its two siblings), so what a shortcut resumes and what the
 * home offers can never drift apart. Reads this game's saves and nothing
 * else: the shell says which door was used and never learns what was decided
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

export async function saveGame(
  session: FutoshikiSession,
  kv: KVStore = preferencesKV,
): Promise<void> {
  await saveRecord(schemaFor(session.mode), toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(mode: GameMode, kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(schemaFor(mode).key, kv);
}
