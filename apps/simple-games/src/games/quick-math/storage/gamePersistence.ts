/**
 * Converts between the in-memory QuickMathSession and its persisted form
 * (docs/QUICK_MATH_RULES.md §9).
 *
 * The questions never travel: the record carries the seed and the index, and
 * `restoreSession` regenerates the set. That keeps the record tiny and, more
 * usefully, makes it impossible for a save to disagree with the generator
 * about what question 7 was.
 *
 * Each mode has its own slot, so suspending a level set and doing the daily
 * never costs you either one.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import { restoreSession, type GameMode, type QuickMathSession } from '../game';
import { dailyGameSchema, gameSchema, type PersistedGame } from './schemas';

export interface SavedGames {
  level: QuickMathSession | null;
  daily: QuickMathSession | null;
}

const schemaFor = (mode: GameMode) => (mode === 'daily' ? dailyGameSchema : gameSchema);

export function toPersisted(session: QuickMathSession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    mode: session.mode,
    seed: session.seed,
    dailyDate: session.dailyDate,
    level: session.level,
    solvedCount: session.solvedCount,
    missCount: session.missCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

function toSession(persisted: PersistedGame | null): QuickMathSession | null {
  if (persisted === null) return null;
  const session = restoreSession({
    mode: persisted.mode,
    dailyDate: persisted.dailyDate,
    level: persisted.level,
    solvedCount: persisted.solvedCount,
    missCount: persisted.missCount,
    elapsedSeconds: persisted.elapsedSeconds,
  });
  // Only resume a set that is still in progress. `restoreSession` already
  // refuses an index past the end of its set.
  return session !== null && session.status === 'playing' ? session : null;
}

/**
 * The one suspended set a home-screen shortcut may open straight onto, or null
 * when there is no single answer (issue #113).
 *
 * A shortcut is a way back into the set somebody was in the middle of. The two
 * slots are held independently and neither evicts the other (§9), so "the set
 * they were on" is only a fact when exactly one of them is suspended. Two would
 * make it a guess, and guessing wrong drops somebody into the mode they did not
 * ask for, mid-set — the daily when they meant level 30. None and two both mean
 * the home screen, which is where every other door leads anyway, and where both
 * sets are offered by name.
 *
 * Reads this game's own saves and nothing else: the shell says which door was
 * used and never learns what was decided here
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
  session: QuickMathSession,
  kv: KVStore = preferencesKV,
): Promise<void> {
  await saveRecord(schemaFor(session.mode), toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(mode: GameMode, kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(schemaFor(mode).key, kv);
}
