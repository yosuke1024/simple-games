/**
 * Converts between the in-memory FreeCellSession and its persisted form.
 * Undo history is intentionally not persisted (docs/FREECELL_RULES.md §10).
 *
 * Each mode has its own slot, so suspending a free deal and playing the daily
 * never costs you either one.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import { restoreSession, type FreeCellSession, type GameMode } from '../game';
import { dailyGameSchema, gameSchema, type PersistedGame } from './schemas';

export interface SavedGames {
  free: FreeCellSession | null;
  daily: FreeCellSession | null;
}

const schemaFor = (mode: GameMode) => (mode === 'daily' ? dailyGameSchema : gameSchema);

export function toPersisted(session: FreeCellSession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    mode: session.mode,
    seed: session.seed,
    dailyDate: session.dailyDate,
    cells: [...session.board.cells],
    foundations: session.board.foundations.map((pile) => [...pile]),
    cascades: session.board.cascades.map((pile) => [...pile]),
    moveCount: session.moveCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

function toSession(persisted: PersistedGame | null): FreeCellSession | null {
  if (persisted === null) return null;
  const session = restoreSession({
    mode: persisted.mode,
    seed: persisted.seed,
    dailyDate: persisted.dailyDate,
    board: {
      cells: persisted.cells,
      foundations: persisted.foundations,
      cascades: persisted.cascades,
    },
    moveCount: persisted.moveCount,
    elapsedSeconds: persisted.elapsedSeconds,
  });
  // Only resume a game that is still in progress.
  return session.status === 'playing' ? session : null;
}

/**
 * The one suspended deal a home-screen shortcut may open straight onto, or
 * null when there is no single answer (issue #113).
 *
 * A shortcut is a way back into the deal somebody was playing. FreeCell keeps
 * two slots on purpose — one free, one daily (§10) — so that switching modes
 * never costs the player either one, and the price of that is that "the deal
 * they were playing" is only a fact when exactly one of them is suspended.
 * Two would make it a guess, and the board's topbar says only which mode it
 * is, so a wrong guess lands the player mid-deal with nothing to explain it.
 * None and two both mean the game's home, which is where every other door
 * leads anyway, and neither slot is touched either way.
 *
 * Reads this game's own saves and nothing else: the shell hands over which
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

export async function saveGame(
  session: FreeCellSession,
  kv: KVStore = preferencesKV,
): Promise<void> {
  await saveRecord(schemaFor(session.mode), toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(mode: GameMode, kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(schemaFor(mode).key, kv);
}
