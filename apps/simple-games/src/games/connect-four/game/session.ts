/**
 * ConnectFourSession — a pure, immutable snapshot of one match in progress:
 * board + whose turn + undo history. The React layer only dispatches into
 * these functions; all rules live here, in engine.ts and in cpu.ts.
 *
 * Undo is the one help this title offers, and it is free and unlimited (§5).
 * It steps back to the player's previous decision point — the CPU's reply
 * comes off with the player's drop, because a position mid-CPU-turn is not a
 * place a player ever decided anything. It is a take-back, not a reroll: the
 * CPU's choice is decided by the seed and the move count (§4), so putting
 * the board back and dropping the same disc brings the same reply.
 *
 * There is no clock on screen (§10); elapsed seconds are carried here for
 * the statistics only.
 */
import { chooseCpuMove } from './cpu';
import { dropDisc, isBoardFull, lineThrough } from './engine';
import {
  CPU,
  EMPTY,
  emptyBoard,
  PLAYER,
  sideToMove,
  type Board,
  type Difficulty,
  type GameStatus,
  type Side,
} from './types';

/** Practically unlimited undo; a match is at most 21 drops each (§5). */
export const UNDO_HISTORY_LIMIT = 50;

/** One decision point: the position the player dropped from. */
export interface HistoryEntry {
  readonly board: Board;
  readonly moveCount: number;
}

export interface ConnectFourSession {
  readonly seed: string;
  readonly difficulty: Difficulty;
  /**
   * Who opened this match — the player's choice, taken before the first drop
   * (§1). It stays with the session because the board alone cannot say it:
   * an even number of discs means "the opener is up again", and which side
   * that is has to be remembered.
   */
  readonly first: Side;
  readonly board: Board;
  /** Whose turn it is. Meaningless once the status is terminal. */
  readonly toMove: Side;
  /** From the player's side of the table: 'won' means the player did (§3). */
  readonly status: GameStatus;
  /** The completed line, for the screen's ring — null while playing (§10). */
  readonly winningLine: readonly number[] | null;
  /** Snapshots taken before each of the player's drops, oldest first. */
  readonly history: readonly HistoryEntry[];
  /** Discs dropped this match, by either side. The CPU draw's second half (§4). */
  readonly moveCount: number;
  readonly elapsedSeconds: number;
}

/**
 * A token that makes one match's seed its own. There are no levels and no
 * dates to seed from, so every new match gets a new deal — while the seed
 * still pins the CPU down completely, which is what §5 rests on.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const matchSeed = (token: string): string => `connect-four-${token}`;

/**
 * A fresh match. `first` is the player's choice of side (§1); the CPU opening
 * means the session starts on the CPU's turn, which the screen plays out the
 * same way it plays out any other CPU turn.
 */
export function createSession(
  difficulty: Difficulty,
  first: Side = PLAYER,
  seed: string = matchSeed(newSeedToken()),
): ConnectFourSession {
  return {
    seed,
    difficulty,
    first,
    board: emptyBoard(),
    toMove: first,
    status: 'playing',
    winningLine: null,
    history: [],
    moveCount: 0,
    elapsedSeconds: 0,
  };
}

export interface MoveOutcome {
  readonly session: ConnectFourSession;
  /** Where the disc came to rest, for the drop animation (§10). */
  readonly placed: number;
}

/** What one drop makes of the match: a win, a full board, or the other turn. */
function settle(
  session: ConnectFourSession,
  board: Board,
  cell: number,
  mover: Side,
): ConnectFourSession {
  const line = lineThrough(board, cell);
  const status: GameStatus =
    line !== null ? (mover === PLAYER ? 'won' : 'lost') : isBoardFull(board) ? 'draw' : 'playing';
  return {
    ...session,
    board,
    toMove: mover === PLAYER ? CPU : PLAYER,
    status,
    winningLine: line,
    moveCount: session.moveCount + 1,
  };
}

/**
 * The player drops a disc (§2). Returns null when it is not the player's
 * turn or the column is full — a full column's input is nothing, silently.
 */
export function applyPlayerMove(session: ConnectFourSession, col: number): MoveOutcome | null {
  if (session.status !== 'playing' || session.toMove !== PLAYER) return null;
  const dropped = dropDisc(session.board, PLAYER, col);
  if (dropped === null) return null;

  const history = [...session.history, { board: session.board, moveCount: session.moveCount }];
  if (history.length > UNDO_HISTORY_LIMIT) history.shift();

  return {
    session: { ...settle(session, dropped.board, dropped.cell, PLAYER), history },
    placed: dropped.cell,
  };
}

/**
 * The CPU takes its turn (§4). Returns null when it is not the CPU's turn —
 * the caller schedules this off the session state, and a stale schedule must
 * land as nothing.
 */
export function applyCpuMove(session: ConnectFourSession): MoveOutcome | null {
  if (session.status !== 'playing' || session.toMove !== CPU) return null;
  const col = chooseCpuMove({
    board: session.board,
    difficulty: session.difficulty,
    seed: session.seed,
    moveCount: session.moveCount,
  });
  const dropped = dropDisc(session.board, CPU, col)!;
  return {
    session: settle(session, dropped.board, dropped.cell, CPU),
    placed: dropped.cell,
  };
}

export function canUndo(session: ConnectFourSession): boolean {
  return session.history.length > 0;
}

/**
 * Takes the match back to the player's previous decision point (§5).
 * Returns null when there is nothing to take back.
 */
export function undo(session: ConnectFourSession): ConnectFourSession | null {
  const previous = session.history[session.history.length - 1];
  if (!previous) return null;
  return {
    ...session,
    board: previous.board,
    toMove: PLAYER,
    status: 'playing',
    winningLine: null,
    history: session.history.slice(0, -1),
    moveCount: previous.moveCount,
  };
}

/**
 * Restores a session from persisted state. The undo history does not survive
 * a save (§8), and neither does a finished match: any completed line on the
 * board makes the status terminal, so the loader can discard it.
 *
 * The turn is derived rather than stored: the alternation never breaks, so
 * the disc counts and the stored opener say whose turn it is between them
 * (§1, types.ts).
 */
export function restoreSession(
  data: Omit<ConnectFourSession, 'history' | 'status' | 'toMove' | 'winningLine'>,
): ConnectFourSession {
  let line: readonly number[] | null = null;
  let winner: Side | null = null;
  for (let cell = 0; cell < data.board.length && line === null; cell++) {
    const piece = data.board[cell]!;
    if (piece === EMPTY) continue;
    const found = lineThrough(data.board, cell);
    if (found !== null) {
      line = found;
      winner = piece;
    }
  }
  const status: GameStatus =
    winner !== null
      ? winner === PLAYER
        ? 'won'
        : 'lost'
      : isBoardFull(data.board)
        ? 'draw'
        : 'playing';
  return {
    ...data,
    toMove: sideToMove(data.board, data.first),
    status,
    winningLine: line,
    history: [],
  };
}
