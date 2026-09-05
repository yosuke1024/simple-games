/**
 * Converts between the in-memory SolitaireSession and its persisted form.
 * Undo history is intentionally not persisted (docs/SOLITAIRE_RULES.md §10).
 *
 * Each mode has its own slot, so suspending a free deal and playing the daily
 * never costs you either one.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import { restoreSession, type GameMode, type SolitaireSession } from '../game';
import { dailyGameSchema, gameSchema, type PersistedGame } from './schemas';

export interface SavedGames {
  free: SolitaireSession | null;
  daily: SolitaireSession | null;
}

const schemaFor = (mode: GameMode) => (mode === 'daily' ? dailyGameSchema : gameSchema);

export function toPersisted(session: SolitaireSession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    mode: session.mode,
    seed: session.seed,
    drawThree: session.drawThree,
    dailyDate: session.dailyDate,
    stock: [...session.board.stock],
    waste: [...session.board.waste],
    foundations: session.board.foundations.map((pile) => [...pile]),
    tableau: session.board.tableau.map((pile) => ({ down: [...pile.down], up: [...pile.up] })),
    moveCount: session.moveCount,
    hintCount: session.hintCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

function toSession(persisted: PersistedGame | null): SolitaireSession | null {
  if (persisted === null) return null;
  const session = restoreSession({
    mode: persisted.mode,
    seed: persisted.seed,
    drawThree: persisted.drawThree,
    dailyDate: persisted.dailyDate,
    board: {
      stock: persisted.stock,
      waste: persisted.waste,
      foundations: persisted.foundations,
      tableau: persisted.tableau,
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
 * A shortcut is a way back into the deal somebody was in the middle of. With
 * the two independent slots §10 keeps — one free, one daily — "the deal they
 * were playing" is only a fact when exactly one of them is suspended. Two
 * would make it a guess, and a wrong guess drops the player onto a board they
 * did not ask for, mid-deal. None and two both mean the home screen, which is
 * where every other door leads anyway; neither slot is touched either way.
 *
 * Reads this game's own saves and nothing else: the shell hands over which
 * door was used and never learns what was decided here
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
  session: SolitaireSession,
  kv: KVStore = preferencesKV,
): Promise<void> {
  await saveRecord(schemaFor(session.mode), toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(mode: GameMode, kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(schemaFor(mode).key, kv);
}
