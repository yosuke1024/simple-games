/**
 * Converts between the in-memory ShapeRegionsSession and its persisted form
 * (docs/SHAPE_REGIONS_RULES.md §11).
 *
 * Loading is fail-closed, and `decodeBoards` is where that happens: a record
 * only becomes a session if it is one play could have produced — a solution
 * that keeps every rule against its clues, and an assignment every clue can
 * reach through its own region. Anything else is dropped for a fresh board,
 * because the alternative is handing the player a puzzle whose answer is
 * wrong.
 *
 * Two independent slots: one difficulty game and one daily. Suspending a hard
 * board to play today's daily never costs you either one (§9).
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import {
  decodeBoards,
  encodeRegions,
  restoreSession,
  type GameMode,
  type ShapeRegionsSession,
} from '../game';
import { dailyGameSchema, gameSchema, type PersistedGame } from './schemas';

export interface SavedGames {
  difficulty: ShapeRegionsSession | null;
  daily: ShapeRegionsSession | null;
}

const schemaFor = (mode: GameMode) => (mode === 'daily' ? dailyGameSchema : gameSchema);

export function toPersisted(session: ShapeRegionsSession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    mode: session.mode,
    seed: session.seed,
    difficulty: session.difficulty,
    dailyDate: session.dailyDate,
    width: session.width,
    height: session.height,
    clues: session.clues.map((clue) => ({ ...clue })),
    solution: encodeRegions(session.solution),
    assignment: encodeRegions(session.assignment),
    hintCount: session.hintCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

export function toSession(persisted: PersistedGame | null): ShapeRegionsSession | null {
  if (persisted === null) return null;
  const layout = { width: persisted.width, height: persisted.height, clues: persisted.clues };
  const boards = decodeBoards(persisted, layout);
  if (boards === null) return null;

  const session = restoreSession({
    mode: persisted.mode,
    seed: persisted.seed,
    difficulty: persisted.difficulty,
    dailyDate: persisted.dailyDate,
    width: persisted.width,
    height: persisted.height,
    clues: persisted.clues,
    solution: boards.solution,
    assignment: boards.assignment,
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
 * independent slots — one difficulty board, one daily (§9, §11) — "the game
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
  session: ShapeRegionsSession,
  kv: KVStore = preferencesKV,
): Promise<void> {
  await saveRecord(schemaFor(session.mode), toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(mode: GameMode, kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(schemaFor(mode).key, kv);
}
