/**
 * Converts between the in-memory SlidingPuzzleSession and its persisted form.
 * Undo history is intentionally not persisted (docs/SLIDING_PUZZLE_RULES.md §10).
 *
 * Each mode has its own slot, so suspending a level game and playing the daily
 * never costs you either one.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import {
  decodeTiles,
  encodeTiles,
  restoreSession,
  type GameMode,
  type SlidingPuzzleSession,
} from '../game';
import { dailyGameSchema, gameSchema, type PersistedGame } from './schemas';

export interface SavedGames {
  level: SlidingPuzzleSession | null;
  daily: SlidingPuzzleSession | null;
}

const schemaFor = (mode: GameMode) => (mode === 'daily' ? dailyGameSchema : gameSchema);

export function toPersisted(session: SlidingPuzzleSession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    mode: session.mode,
    seed: session.seed,
    size: session.size,
    dailyDate: session.dailyDate,
    level: session.level,
    tiles: encodeTiles(session.tiles),
    moveCount: session.moveCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

function toSession(persisted: PersistedGame | null): SlidingPuzzleSession | null {
  if (persisted === null) return null;
  const tiles = decodeTiles(persisted.tiles, persisted.size);
  if (tiles === null) return null;

  const session = restoreSession({
    mode: persisted.mode,
    seed: persisted.seed,
    size: persisted.size,
    dailyDate: persisted.dailyDate,
    level: persisted.level,
    tiles,
    moveCount: persisted.moveCount,
    elapsedSeconds: persisted.elapsedSeconds,
  });
  // Only resume a game that is still in progress.
  return session.status === 'playing' ? session : null;
}

/**
 * The one suspended game a home-screen shortcut may open straight onto, or
 * null when there is no single answer (issue #113).
 *
 * A shortcut is a way back into the game somebody was playing. With two
 * independent slots — a level and the daily (§10) — "the game they were
 * playing" is only a fact when exactly one of them is suspended. Two would
 * make it a guess, and guessing wrong drops somebody onto a board they did
 * not ask for, mid-puzzle. None and two both mean the home screen, which is
 * where every other door leads anyway, and where both games are still offered.
 *
 * Reads the game's own saves and nothing else: the shell hands over which
 * door was used and never learns what this decided
 * (docs/ARCHITECTURE.md「ゲームレジストリの契約」).
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
  session: SlidingPuzzleSession,
  kv: KVStore = preferencesKV,
): Promise<void> {
  await saveRecord(schemaFor(session.mode), toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(mode: GameMode, kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(schemaFor(mode).key, kv);
}
