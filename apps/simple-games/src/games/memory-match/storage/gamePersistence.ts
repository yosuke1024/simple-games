/**
 * Converts between the in-memory MemorySession and its persisted form. Face-up
 * unmatched cards are intentionally not persisted: they come back face down
 * (docs/MEMORY_MATCH_RULES.md §10).
 *
 * Each mode has its own slot, so suspending a difficulty game and playing the
 * daily never costs you either one.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import {
  decodeDeck,
  decodeMatched,
  encodeDeck,
  encodeMatched,
  restoreSession,
  type GameMode,
  type MemorySession,
} from '../game';
import { dailyGameSchema, gameSchema, type PersistedGame } from './schemas';

export interface SavedGames {
  difficulty: MemorySession | null;
  daily: MemorySession | null;
}

const schemaFor = (mode: GameMode) => (mode === 'daily' ? dailyGameSchema : gameSchema);

export function toPersisted(session: MemorySession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    mode: session.mode,
    seed: session.seed,
    difficulty: session.difficulty,
    dailyDate: session.dailyDate,
    deck: encodeDeck(session.deck),
    matched: encodeMatched(session.matched),
    moveCount: session.moveCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

function toSession(persisted: PersistedGame | null): MemorySession | null {
  if (persisted === null) return null;
  const deck = decodeDeck(persisted.deck, persisted.difficulty);
  if (deck === null) return null;
  const matched = decodeMatched(persisted.matched, deck);
  if (matched === null) return null;

  const session = restoreSession({
    mode: persisted.mode,
    seed: persisted.seed,
    difficulty: persisted.difficulty,
    dailyDate: persisted.dailyDate,
    deck,
    matched,
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
 * The two slots are independent by design (docs/MEMORY_MATCH_RULES.md §10), so
 * both can hold a live game at once — a difficulty board put down on Tuesday
 * and today's daily. "The game they were playing" is only a fact when exactly
 * one of them is suspended; with two it would be a guess, and guessing wrong
 * drops somebody onto a board they did not ask for, mid-game. None and two
 * both mean the home screen, which is where every other door leads anyway.
 *
 * Reads this game's own saves and nothing else: the shell says which door was
 * used and never learns what was decided here
 * (docs/ARCHITECTURE.md「ゲームレジストリの契約」). A slot that survived the
 * loader is already 'playing' — toSession drops a solved or unreadable
 * record — so this can only ever offer a game there is something left to do in.
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

export async function saveGame(session: MemorySession, kv: KVStore = preferencesKV): Promise<void> {
  await saveRecord(schemaFor(session.mode), toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(mode: GameMode, kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(schemaFor(mode).key, kv);
}
