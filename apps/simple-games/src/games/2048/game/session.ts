/**
 * Game2048Session — a pure, immutable snapshot of one game in progress: board
 * + undo history + counters. The React layer only dispatches into these
 * functions; all rules live here and in engine.ts.
 *
 * Undo is the one help this title offers, and it is free and unlimited (§6).
 * What makes it help rather than a slot machine is that it does not reroll:
 * the spawn draw is decided by the seed and the spawn count (§5), so putting
 * the board back and taking the same move again hands back the same tile in
 * the same cell. `spawnIndex` travels with the board through the history for
 * exactly that reason.
 *
 * There is no clock on screen (§12); elapsed seconds are carried here for the
 * statistics only.
 */
import { hasMoves, move, spawnTile, hasTile } from './engine';
import { emptyBoard, TARGET_TILE, type Board, type Direction, type GameStatus } from './types';

/** Practically unlimited undo; a real game never comes close (§6). */
export const UNDO_HISTORY_LIMIT = 2000;

/** One step back: the board and everything that produced it. */
export interface HistoryEntry {
  readonly board: Board;
  readonly score: number;
  readonly spawnIndex: number;
  readonly moveCount: number;
}

export interface Game2048Session {
  readonly seed: string;
  readonly board: Board;
  /** The sum of every value this game has created (§7). */
  readonly score: number;
  /** How many tiles have been spawned — the draw's second half (§5). */
  readonly spawnIndex: number;
  /** Whether 2048 has been reached; the announcement happens once (§2). */
  readonly reached2048: boolean;
  readonly status: GameStatus;
  /** Snapshots taken before each move, oldest first. */
  readonly history: readonly HistoryEntry[];
  readonly moveCount: number;
  readonly elapsedSeconds: number;
}

/**
 * A token that makes one game's seed its own. There are no levels and no dates
 * to seed from, so every new board gets a new deal — while the seed still pins
 * that deal down completely, which is what §6 rests on.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const gameSeed = (token: string): string => `2048-${token}`;

/** A fresh board: two tiles, drawn from the seed (§5). */
export function createSession(seed: string = gameSeed(newSeedToken())): Game2048Session {
  const board = spawnTile(spawnTile(emptyBoard(), seed, 0), seed, 1);
  return {
    seed,
    board,
    score: 0,
    spawnIndex: 2,
    reached2048: false,
    status: 'playing',
    history: [],
    moveCount: 0,
    elapsedSeconds: 0,
  };
}

/**
 * Restores a session from persisted state. The undo history does not survive
 * a save (§10): a resumed board starts from the position it was saved in.
 */
export function restoreSession(data: Omit<Game2048Session, 'history' | 'status'>): Game2048Session {
  return {
    ...data,
    history: [],
    status: hasMoves(data.board) ? 'playing' : 'over',
  };
}

export interface MoveOutcome {
  readonly session: Game2048Session;
  /** True on the move that first makes a 2048 — the one announcement (§2). */
  readonly justReached: boolean;
  /** True when at least one pair joined, which the screen sounds out (§12). */
  readonly merged: boolean;
  /** The biggest tile the joins made (0 when none): the pitch of that sound. */
  readonly largestMerge: number;
}

/**
 * Tips the board one way (§4) and puts a new tile down (§5). Returns null when
 * the board does not change: that input does nothing at all, silently (§3).
 */
export function applyMove(session: Game2048Session, direction: Direction): MoveOutcome | null {
  if (session.status !== 'playing') return null;
  const result = move(session.board, direction);
  if (!result.moved) return null;

  const history = [
    ...session.history,
    {
      board: session.board,
      score: session.score,
      spawnIndex: session.spawnIndex,
      moveCount: session.moveCount,
    },
  ];
  if (history.length > UNDO_HISTORY_LIMIT) history.shift();

  // Checked before the spawn: a new tile is a 2 or a 4 and could never be the
  // one that reaches the target, so this reads the move's own doing.
  const reached2048 = session.reached2048 || hasTile(result.board, TARGET_TILE);
  const board = spawnTile(result.board, session.seed, session.spawnIndex);

  return {
    session: {
      ...session,
      board,
      score: session.score + result.gained,
      spawnIndex: session.spawnIndex + 1,
      reached2048,
      status: hasMoves(board) ? 'playing' : 'over',
      history,
      moveCount: session.moveCount + 1,
    },
    justReached: reached2048 && !session.reached2048,
    merged: result.gained > 0,
    largestMerge: result.largestMerge,
  };
}

export function canUndo(session: Game2048Session): boolean {
  return session.history.length > 0;
}

/**
 * Takes back one move: board, score, spawn count and move count together (§6).
 * Returns null when there is nothing to take back.
 *
 * `reached2048` deliberately stays set. Reaching it was a thing that happened,
 * and re-announcing it after an undo would turn one moment into a loop.
 */
export function undo(session: Game2048Session): Game2048Session | null {
  const previous = session.history[session.history.length - 1];
  if (!previous) return null;
  return {
    ...session,
    board: previous.board,
    score: previous.score,
    spawnIndex: previous.spawnIndex,
    moveCount: previous.moveCount,
    history: session.history.slice(0, -1),
    status: hasMoves(previous.board) ? 'playing' : 'over',
  };
}
