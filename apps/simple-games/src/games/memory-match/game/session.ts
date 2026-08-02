/**
 * MemorySession — a pure, immutable snapshot of one game in progress: deck +
 * what is matched, what is face up, and the counters. The React layer only
 * dispatches into these functions; all rules live here.
 *
 * The one rule with any shape is the mismatch (§3): a missed pair stays face
 * up until the next flip, never on a timer. The device does not decide when
 * the player has looked long enough — so `faceUp` holding two cards is a
 * stable state, and the next legal tap is what clears it.
 *
 * There is no undo and no hint, by design (§8): the help this title offers is
 * the retried board, which the seed makes exact. No clock on screen (§4);
 * elapsed seconds are carried here for the clear screen and statistics only.
 */
import { DAILY_DIFFICULTY, dailySeed } from './daily';
import { generateDeck } from './deck';
import { cellCount, LAYOUTS, type Deck, type Difficulty, type GameMode, type GameStatus, type Layout } from './types';

export interface MemorySession {
  readonly mode: GameMode;
  readonly seed: string;
  /** Board layout — daily games use the Medium board (§7). */
  readonly difficulty: Difficulty;
  /** Local YYYY-MM-DD for daily mode, null for difficulty mode. */
  readonly dailyDate: string | null;
  readonly deck: Deck;
  /** Per cell: found and locked face up (§3). */
  readonly matched: readonly boolean[];
  /**
   * Cells currently face up but not matched: none, the attempt's first card,
   * or a shown mismatch (§3). Never a matched cell, never more than two.
   */
  readonly faceUp: readonly number[];
  readonly status: GameStatus;
  /** Attempts so far — one move per second card turned (§4). */
  readonly moveCount: number;
  readonly elapsedSeconds: number;
}

export const layoutOf = (session: MemorySession): Layout => LAYOUTS[session.difficulty];

/**
 * A token that makes one difficulty game's seed its own. Difficulty mode has
 * no levels and no dates to seed from (§6), so a new game gets a new deal —
 * while the seed still pins that deal down completely, which is what lets §8
 * offer the same board back for free.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const difficultySeed = (difficulty: Difficulty, token: string): string =>
  `memory-${difficulty}-${token}`;

function baseSession(
  mode: GameMode,
  seed: string,
  difficulty: Difficulty,
  dailyDate: string | null,
): MemorySession {
  const deck = generateDeck(seed, difficulty);
  return {
    mode,
    seed,
    difficulty,
    dailyDate,
    deck,
    matched: new Array<boolean>(deck.length).fill(false),
    faceUp: [],
    status: 'playing',
    moveCount: 0,
    elapsedSeconds: 0,
  };
}

/** A fresh difficulty game — a new deal unless a seed pins an old one. */
export function createDifficultySession(
  difficulty: Difficulty,
  seed: string = difficultySeed(difficulty, newSeedToken()),
): MemorySession {
  return baseSession('difficulty', seed, difficulty, null);
}

/** A fresh (or restarted) daily game for a local YYYY-MM-DD date. */
export function createDailySession(dateString: string): MemorySession {
  return baseSession('daily', dailySeed(dateString), DAILY_DIFFICULTY, dateString);
}

/** The same board again (§8): same seed, same layout, memory carried over. */
export function restartSession(session: MemorySession): MemorySession {
  return session.mode === 'daily' && session.dailyDate !== null
    ? createDailySession(session.dailyDate)
    : createDifficultySession(session.difficulty, session.seed);
}

/**
 * Restores a session from persisted state. Unmatched cards come back face
 * down (§10): whether the player still remembers the card they had turned is
 * not something a device can save.
 */
export function restoreSession(
  data: Omit<MemorySession, 'faceUp' | 'status'>,
): MemorySession {
  return {
    ...data,
    faceUp: [],
    status: data.matched.every(Boolean) ? 'solved' : 'playing',
  };
}

/**
 * Flips the tapped card (§3). Returns null when the tap does nothing: a
 * matched or already face-up card, an out-of-range index, or a game already
 * solved. A shown mismatch folds face down as the tap opens its card.
 */
export function tapCard(session: MemorySession, index: number): MemorySession | null {
  if (session.status !== 'playing') return null;
  if (!Number.isInteger(index) || index < 0 || index >= cellCount(layoutOf(session))) return null;
  if (session.matched[index] || session.faceUp.includes(index)) return null;

  // First card of an attempt — also the tap that puts a mismatch away.
  if (session.faceUp.length !== 1) {
    return { ...session, faceUp: [index] };
  }

  const first = session.faceUp[0]!;
  const moveCount = session.moveCount + 1;

  if (session.deck[first] === session.deck[index]) {
    const matched = [...session.matched];
    matched[first] = true;
    matched[index] = true;
    return {
      ...session,
      matched,
      faceUp: [],
      moveCount,
      status: matched.every(Boolean) ? 'solved' : 'playing',
    };
  }

  return { ...session, faceUp: [first, index], moveCount };
}
