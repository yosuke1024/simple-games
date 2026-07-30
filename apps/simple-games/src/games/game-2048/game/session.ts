/**
 * Game2048Session — a pure, immutable snapshot of one game: board, score, undo
 * history and counters. The React layer only dispatches into these functions;
 * all rules live here and in engine.ts.
 *
 * Undo restores the board, the score and the tile stream (§5). It does not
 * restore the counters: a move was still made, and 2048 was still reached.
 * Rewinding the tile stream is what keeps §6's promise honest — two players
 * making the same moves on the same daily see the same tiles, whether or not
 * either of them used undo.
 *
 * There is no clock on screen (§4); elapsed seconds are carried for the
 * statistics only.
 */
import { dailySeed } from './daily';
import {
  emptyBoard,
  hasWon,
  isGameOver,
  slide,
  spawnRng,
  spawnTile,
  type Movement,
} from './engine';
import type { Board, Direction, GameMode, GameStatus } from './types';

/**
 * Practically unlimited undo (§5): a game reaching 2048 takes roughly a
 * thousand moves, so no real run comes near the end of this.
 */
export const UNDO_HISTORY_LIMIT = 2000;

/** The two tiles an empty board opens with (§7). */
export const OPENING_TILES = 2;

/** What one undo step puts back. */
export interface HistoryEntry {
  readonly board: Board;
  readonly score: number;
  readonly spawnCount: number;
}

export interface Game2048Session {
  readonly mode: GameMode;
  readonly seed: string;
  /** Local YYYY-MM-DD for daily mode, null for classic. */
  readonly dailyDate: string | null;
  readonly board: Board;
  readonly score: number;
  readonly moveCount: number;
  /** How many tiles have been drawn — the position in the seed's stream. */
  readonly spawnCount: number;
  readonly history: readonly HistoryEntry[];
  readonly status: GameStatus;
  /** 2048 has been made in this game. Play carries on regardless (§3). */
  readonly won: boolean;
  /** The player has seen the congratulation, so it is not shown twice. */
  readonly winAcknowledged: boolean;
  readonly elapsedSeconds: number;
}

/**
 * A fresh classic seed (§6). Classic answers to nobody, so it only has to be
 * unrepeatable; the timestamp keeps two games apart even if Math.random does
 * not.
 */
export function createClassicSeed(): string {
  const random = Math.floor(Math.random() * 0xffffffff).toString(36);
  return `2048-classic-${Date.now().toString(36)}-${random}`;
}

function baseSession(mode: GameMode, seed: string, dailyDate: string | null): Game2048Session {
  // The opening two tiles come out of the same stream as every later spawn, so
  // the whole game — not just the first move — is a function of the seed (§7).
  let board = emptyBoard();
  for (let index = 0; index < OPENING_TILES; index++) {
    board = spawnTile(board, spawnRng(seed, index))?.board ?? board;
  }
  return {
    mode,
    seed,
    dailyDate,
    board,
    score: 0,
    moveCount: 0,
    spawnCount: OPENING_TILES,
    history: [],
    status: isGameOver(board) ? 'over' : 'playing',
    won: hasWon(board),
    winAcknowledged: false,
    elapsedSeconds: 0,
  };
}

/** A fresh classic game. Pass a seed only to reproduce one (tests, restart). */
export function createClassicSession(seed: string = createClassicSeed()): Game2048Session {
  return baseSession('classic', seed, null);
}

/** A fresh daily game for a local YYYY-MM-DD date — identical for everyone. */
export function createDailySession(dateString: string): Game2048Session {
  return baseSession('daily', dailySeed(dateString), dateString);
}

/**
 * Restart. A daily rebuilds the very same board, which is the whole point of a
 * shared seed (§6). Classic has nothing to rebuild: §6 gives every new classic
 * game a random seed, so restarting one is starting a new one.
 */
export function restartSession(session: Game2048Session): Game2048Session {
  return session.mode === 'daily' && session.dailyDate !== null
    ? createDailySession(session.dailyDate)
    : createClassicSession();
}

/** Restores a session from persisted state (undo history is not persisted, §5). */
export function restoreSession(
  data: Omit<Game2048Session, 'history' | 'status'>,
): Game2048Session {
  return {
    ...data,
    history: [],
    status: isGameOver(data.board) ? 'over' : 'playing',
  };
}

function pushHistory(session: Game2048Session): readonly HistoryEntry[] {
  const next = [
    ...session.history,
    { board: session.board, score: session.score, spawnCount: session.spawnCount },
  ];
  if (next.length > UNDO_HISTORY_LIMIT) next.shift();
  return next;
}

export interface MoveOutcome {
  readonly session: Game2048Session;
  /** Where every tile went — the UI's input for animating the move. */
  readonly movements: readonly Movement[];
  /** Where the new tile landed, or null when the slide filled the board. */
  readonly spawnIndex: number | null;
}

/**
 * Plays one move (§2). Returns null when the game is over, and when the board
 * would not change: a move that shifts nothing and merges nothing is not a
 * move, and must not be paid for with a new tile (§2.4).
 */
export function move(session: Game2048Session, direction: Direction): MoveOutcome | null {
  if (session.status !== 'playing') return null;
  const result = slide(session.board, direction);
  if (!result.moved) return null;

  const spawn = spawnTile(result.board, spawnRng(session.seed, session.spawnCount));
  const board = spawn?.board ?? result.board;
  return {
    session: {
      ...session,
      board,
      score: session.score + result.gained,
      moveCount: session.moveCount + 1,
      spawnCount: session.spawnCount + (spawn === null ? 0 : 1),
      history: pushHistory(session),
      status: isGameOver(board) ? 'over' : 'playing',
      won: session.won || hasWon(board),
    },
    movements: result.movements,
    spawnIndex: spawn?.index ?? null,
  };
}

export function canUndo(session: Game2048Session): boolean {
  return session.history.length > 0;
}

/**
 * Steps one move back: board, score and the tile stream (§5). The move count
 * and the fact that 2048 was reached stay where they are — undo takes back a
 * move, not the fact that it was made.
 *
 * Whether a finished game may be undone is a screen-level question, not a
 * board-level one, so the guard sits in the provider rather than here.
 */
export function undoMove(session: Game2048Session): Game2048Session | null {
  const previous = session.history[session.history.length - 1];
  if (!previous) return null;
  return {
    ...session,
    board: previous.board,
    score: previous.score,
    spawnCount: previous.spawnCount,
    history: session.history.slice(0, -1),
    status: isGameOver(previous.board) ? 'over' : 'playing',
  };
}

/** Marks the 2048 congratulation as seen, so resuming does not repeat it (§3). */
export function acknowledgeWin(session: Game2048Session): Game2048Session {
  return session.winAcknowledged ? session : { ...session, winAcknowledged: true };
}
