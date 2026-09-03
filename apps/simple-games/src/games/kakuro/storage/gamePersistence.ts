/**
 * Converts between the in-memory KakuroSession and its persisted form
 * (docs/KAKURO_RULES.md §11). Undo history is deliberately not persisted (§5),
 * and neither are the clues — they are the sums of the runs, so the layout and
 * the answer already carry them and `decodeGame` adds them back up on the way
 * in. **What is never stored cannot drift.**
 *
 * Loading is fail-closed, and `decodeGame` in the game layer is where that
 * happens: a record only becomes a session if it is one play could have
 * produced — a layout whose white cells split into runs of two to nine and
 * form one region, an answer with a digit in every white cell and no digit
 * twice in a run, no entry and no note on a clue cell, and no note under a
 * written digit. Anything else is dropped for a fresh board, because the
 * alternative is handing the player a puzzle whose answer is wrong.
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
  encodeGrid,
  encodeLayout,
  encodeNotes,
  restoreSession,
  type GameMode,
  type KakuroSession,
} from '../game';
import { dailyGameSchema, freeGameSchema, gameSchema, type PersistedGame } from './schemas';

export interface SavedGames {
  level: KakuroSession | null;
  daily: KakuroSession | null;
  free: KakuroSession | null;
}

const schemaFor = (mode: GameMode) =>
  mode === 'daily' ? dailyGameSchema : mode === 'free' ? freeGameSchema : gameSchema;

export function toPersisted(session: KakuroSession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    mode: session.mode,
    seed: session.seed,
    size: session.size,
    dailyDate: session.dailyDate,
    level: session.level,
    freeTier: session.freeTier,
    layout: encodeLayout(session.layout),
    solution: encodeGrid(session.solution),
    entries: encodeGrid(session.board.entries),
    notes: encodeNotes(session.board.notes),
    mistakeCount: session.mistakeCount,
    hintCount: session.hintCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

export function toSession(persisted: PersistedGame | null): KakuroSession | null {
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
    layout: decoded.layout,
    solution: decoded.solution,
    table: decoded.table,
    board: decoded.board,
    mistakeCount: persisted.mistakeCount,
    hintCount: persisted.hintCount,
    elapsedSeconds: persisted.elapsedSeconds,
  });
  // Only resume a game that is still in progress.
  return session.status === 'playing' ? session : null;
}

export async function loadSavedGames(kv: KVStore = preferencesKV): Promise<SavedGames> {
  const [level, daily, free] = await Promise.all([
    loadRecord(gameSchema, kv),
    loadRecord(dailyGameSchema, kv),
    loadRecord(freeGameSchema, kv),
  ]);
  return { level: toSession(level), daily: toSession(daily), free: toSession(free) };
}

export async function saveGame(session: KakuroSession, kv: KVStore = preferencesKV): Promise<void> {
  await saveRecord(schemaFor(session.mode), toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(mode: GameMode, kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(schemaFor(mode).key, kv);
}
