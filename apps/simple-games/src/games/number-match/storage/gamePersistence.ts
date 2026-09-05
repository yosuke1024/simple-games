/**
 * Converts between the in-memory GameSession and its persisted form.
 * Undo history is intentionally not persisted (spec §8.1).
 *
 * Each mode has its own slot, so suspending a level game and playing the
 * daily — or a free board (§11) — never costs you any of them (docs §14).
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import { decodeBoard, encodeBoard, restoreSession, type GameMode, type GameSession } from '../game';
import {
  dailyGameSchema,
  freeGameSchema,
  gameSchema,
  NM_STORAGE_KEYS,
  strandedDailySchema,
  type PersistedGame,
} from './schemas';

export interface SavedGames {
  level: GameSession | null;
  daily: GameSession | null;
  free: GameSession | null;
}

const schemaFor = (mode: GameMode) =>
  mode === 'daily' ? dailyGameSchema : mode === 'free' ? freeGameSchema : gameSchema;

export function toPersisted(session: GameSession, savedAt: number): PersistedGame {
  const { values, mask } = encodeBoard(session.board);
  return {
    schemaVersion: 2,
    mode: session.mode,
    seed: session.seed,
    dailyDate: session.dailyDate,
    level: session.level,
    freeTier: session.freeTier,
    values,
    mask,
    score: session.score,
    moveCount: session.moveCount,
    addCount: session.addCount,
    hintCount: session.hintCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

function toSession(persisted: PersistedGame | null): GameSession | null {
  if (persisted === null) return null;
  const board = decodeBoard({ values: persisted.values, mask: persisted.mask });
  if (board === null) return null;
  const session = restoreSession({
    mode: persisted.mode,
    seed: persisted.seed,
    dailyDate: persisted.dailyDate,
    level: persisted.level,
    freeTier: persisted.freeTier,
    board,
    score: persisted.score,
    moveCount: persisted.moveCount,
    addCount: persisted.addCount,
    hintCount: persisted.hintCount,
    elapsedSeconds: persisted.elapsedSeconds,
  });
  // Only resume games that are still playable.
  return session.status === 'playing' ? session : null;
}

/**
 * The one suspended game a home-screen shortcut may open straight onto, or
 * null when there is no single answer (issue #113).
 *
 * The three slots exist precisely so that a level game, a daily and a free
 * board coexist without evicting one another (docs §14「中断は 3 つ独立して
 * 保持する」). That is also why "the game they were playing" is only a fact
 * here when exactly one of them is suspended: with two, picking the most
 * recent would drop somebody onto a board they did not ask for, mid-game.
 * None and two both mean the home screen — where every other door leads
 * anyway, and where all three are offered by name.
 *
 * Reads this game's own saves and nothing else: the shell says which door was
 * used and never learns what was decided here
 * (docs/ARCHITECTURE.md「ゲームレジストリの契約」).
 */
export function soleSuspendedMode(saved: SavedGames): GameMode | null {
  const suspended = (['level', 'daily', 'free'] as const).filter(
    (mode) => saved[mode]?.status === 'playing',
  );
  return suspended.length === 1 ? suspended[0]! : null;
}

/**
 * Loads the three slots. Builds before the split kept a daily game in the
 * level slot; such a record is moved to its own slot once, on first load.
 *
 * The level key is therefore read twice, with two schemas: `gameSchema` reads
 * it as what it is now (level games only — a daily record there is never
 * resumed in place), and `strandedDailySchema` reads it as what the old builds
 * left behind. Only one of the two can find anything, because there is only
 * one record. Splitting the read this way is what lets the live slot stay
 * strict while the migration keeps working. The free slot is younger than
 * the split and has no such history.
 */
export async function loadSavedGames(kv: KVStore = preferencesKV): Promise<SavedGames> {
  const [levelSlot, dailySlot, freeSlot, strandedDaily] = await Promise.all([
    loadRecord(gameSchema, kv),
    loadRecord(dailyGameSchema, kv),
    loadRecord(freeGameSchema, kv),
    loadRecord(strandedDailySchema, kv),
  ]);
  const free = toSession(freeSlot);

  if (strandedDaily !== null) {
    const migrated = dailySlot === null;
    if (migrated) await saveRecord(dailyGameSchema, strandedDaily, kv);
    await removeRecord(NM_STORAGE_KEYS.game, kv);
    return { level: null, daily: toSession(migrated ? strandedDaily : dailySlot), free };
  }

  return {
    level: toSession(levelSlot),
    daily: toSession(dailySlot),
    free,
  };
}

export async function saveGame(session: GameSession, kv: KVStore = preferencesKV): Promise<void> {
  await saveRecord(schemaFor(session.mode), toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(mode: GameMode, kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(schemaFor(mode).key, kv);
}
