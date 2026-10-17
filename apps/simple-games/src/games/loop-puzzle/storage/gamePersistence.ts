/**
 * Converts between the in-memory LoopPuzzleSession and its persisted form
 * (docs/LOOP_PUZZLE_RULES.md §12).
 *
 * Loading is fail-closed, and `decodeBoard` is where that happens: a record
 * only becomes a session if its digest is its clues' own, its clues have
 * exactly one loop (proven within the counting search's node limit — the
 * proof also re-derives the answer, which the record never carries), and its
 * marks do not already solve the board. Anything else is dropped and the
 * player lands on the game's home — never on a fresh board nobody asked for,
 * and never on a board without an answer.
 *
 * The search runs here, once per slot, when the game itself loads its saves
 * (opening the game) — not in the schema, so a backup check or the shell's
 * start-up never runs it (§12).
 *
 * Two independent slots: one difficulty game and one daily. Suspending a hard
 * board to play today's daily never costs you either one (§9).
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import {
  PRESETS,
  cluesDigest,
  decodeBoard,
  encodeClues,
  encodeMarks,
  localDateString,
  restoreSession,
  type GameMode,
  type LoopPuzzleSession,
} from '../game';
import { dailyGameSchema, gameSchema, type PersistedGame } from './schemas';

export interface SavedGames {
  difficulty: LoopPuzzleSession | null;
  daily: LoopPuzzleSession | null;
}

const schemaFor = (mode: GameMode) => (mode === 'daily' ? dailyGameSchema : gameSchema);

export function toPersisted(session: LoopPuzzleSession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    mode: session.mode,
    seed: session.seed,
    difficulty: session.difficulty,
    dailyDate: session.dailyDate,
    width: session.width,
    height: session.height,
    clues: encodeClues(session.clues),
    cluesDigest: cluesDigest(session.clues),
    marks: encodeMarks(session.marks),
    hintCount: session.hintCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

/**
 * The session a validated record stands for, or null when the board is not
 * one play could have left suspended (§12) — damaged clues, no single loop
 * within the search's limit, or marks that already won.
 */
export function toSession(persisted: PersistedGame | null): LoopPuzzleSession | null {
  if (persisted === null) return null;
  const board = decodeBoard(
    {
      width: persisted.width,
      height: persisted.height,
      clues: persisted.clues,
      digest: persisted.cluesDigest,
      marks: persisted.marks,
    },
    PRESETS[persisted.difficulty],
  );
  if (board === null) return null;

  const session = restoreSession({
    mode: persisted.mode,
    seed: persisted.seed,
    difficulty: persisted.difficulty,
    dailyDate: persisted.dailyDate,
    width: persisted.width,
    height: persisted.height,
    clues: board.clues,
    solution: board.solution,
    marks: board.marks,
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
 * independent slots — one difficulty board, one daily (§9, §12) — "the game
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

async function loadSlots(kv: KVStore): Promise<SavedGames> {
  const [difficulty, daily] = await Promise.all([
    loadRecord(gameSchema, kv),
    loadRecord(dailyGameSchema, kv),
  ]);
  return { difficulty: toSession(difficulty), daily: toSession(daily) };
}

/**
 * The daily slot holds today's board or nothing (docs/PRODUCT_PRINCIPLES.md
 * 「デイリーは今日の 1 問」, §9). A board left over from another day is dropped
 * here, record and all, so no door — the home button, a shortcut — can reopen
 * it. `today` is a seam for the tests; production reads the device clock.
 */
export async function loadSavedGames(
  kv: KVStore = preferencesKV,
  today: string = localDateString(new Date()),
): Promise<SavedGames> {
  const saved = await loadSlots(kv);
  if (saved.daily !== null && saved.daily.dailyDate !== today) {
    await removeRecord(dailyGameSchema.key, kv);
    return { ...saved, daily: null };
  }
  return saved;
}

export async function saveGame(
  session: LoopPuzzleSession,
  kv: KVStore = preferencesKV,
): Promise<void> {
  await saveRecord(schemaFor(session.mode), toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(mode: GameMode, kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(schemaFor(mode).key, kv);
}
