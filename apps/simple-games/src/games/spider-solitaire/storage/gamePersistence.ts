/**
 * Converts between the in-memory SpiderSession and its persisted form. Undo
 * history is intentionally not persisted (docs/SPIDER_SOLITAIRE_RULES.md §10).
 *
 * Each mode has its own slot, so suspending a free deal and playing the daily
 * never costs you either one.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import { restoreSession, type GameMode, type SpiderSession } from '../game';
import { dailyGameSchema, gameSchema, type PersistedGame } from './schemas';

export interface SavedGames {
  free: SpiderSession | null;
  daily: SpiderSession | null;
}

const schemaFor = (mode: GameMode) => (mode === 'daily' ? dailyGameSchema : gameSchema);

export function toPersisted(session: SpiderSession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    mode: session.mode,
    seed: session.seed,
    suitCount: session.suitCount,
    dailyDate: session.dailyDate,
    stock: [...session.board.stock],
    tableau: session.board.tableau.map((pile) => ({ down: [...pile.down], up: [...pile.up] })),
    completed: session.board.completed.map((run) => [...run]),
    moveCount: session.moveCount,
    hintCount: session.hintCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

function toSession(persisted: PersistedGame | null): SpiderSession | null {
  if (persisted === null) return null;
  const session = restoreSession({
    mode: persisted.mode,
    seed: persisted.seed,
    suitCount: persisted.suitCount,
    dailyDate: persisted.dailyDate,
    board: {
      suitCount: persisted.suitCount,
      stock: persisted.stock,
      tableau: persisted.tableau,
      completed: persisted.completed,
    },
    moveCount: persisted.moveCount,
    hintCount: persisted.hintCount,
    elapsedSeconds: persisted.elapsedSeconds,
  });
  // Only resume a game that is still in progress.
  return session.status === 'playing' ? session : null;
}

/**
 * The one suspended deal a home-screen shortcut may open straight onto, or
 * null when there is no single answer (issue #113).
 *
 * A shortcut is a way back into the game somebody was playing. With the two
 * independent slots of §10 — one free deal, one daily — "the deal they were
 * playing" is only a fact when exactly one of them is suspended. Two would
 * make it a guess, and guessing wrong drops somebody onto a board they did
 * not ask for, mid-deal. None and two both mean the home screen, which is
 * where every other door leads anyway; neither slot is touched either way.
 *
 * Iterates the mode literals, not the storage keys: `SS_STORAGE_KEYS.game`
 * holds the *free* deal (§10 — the key is what decides the mode), so a scan
 * written over key names would silently never find anything.
 *
 * Reads the game's own saves and nothing else: the shell hands over which
 * door was used and never learns what this decided
 * (docs/ARCHITECTURE.md「ゲームレジストリの契約」).
 */
export function soleSuspendedMode(saved: SavedGames): GameMode | null {
  const suspended = (['free', 'daily'] as const).filter(
    (mode) => saved[mode]?.status === 'playing',
  );
  return suspended.length === 1 ? suspended[0]! : null;
}

export async function loadSavedGames(kv: KVStore = preferencesKV): Promise<SavedGames> {
  const [free, daily] = await Promise.all([
    loadRecord(gameSchema, kv),
    loadRecord(dailyGameSchema, kv),
  ]);
  return { free: toSession(free), daily: toSession(daily) };
}

export async function saveGame(session: SpiderSession, kv: KVStore = preferencesKV): Promise<void> {
  await saveRecord(schemaFor(session.mode), toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(mode: GameMode, kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(schemaFor(mode).key, kv);
}
