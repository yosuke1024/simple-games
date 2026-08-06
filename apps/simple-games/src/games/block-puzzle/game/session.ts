/**
 * BlockSession — a pure, immutable snapshot of one game in progress: board,
 * tray, counters, and the undo history. The React layer only dispatches into
 * these functions; all rules live here and in engine.ts.
 *
 * There is no clear (§2). The game is endless and ends when the tray stops
 * fitting, so `status` flips exactly once, and the record is the score (§5).
 *
 * Undo is unlimited and free (§7), and it restores `batchIndex` along with
 * everything else. That is the whole reason the refill is a pure function of
 * (seed, batchIndex): put the board back and the same three pieces come back,
 * so undoing and replaying the same move gives the same game. A refill that
 * re-drew on undo would quietly turn the free help into a reroll.
 *
 * No clock on screen (§12); elapsed seconds are carried here for statistics.
 */
import { canPlace, clearLines, hasAnyMove, place, scoreFor } from './engine';
import { drawBatch, pieceById, type Piece } from './pieces';
import { emptyBoard, TRAY_SIZE, type Board, type GameStatus, type Tray } from './types';

/** Practically unlimited undo; a real game never comes close (§7). */
export const UNDO_HISTORY_LIMIT = 2000;

/** One step back: everything a placement touched, exactly as it was (§7). */
export interface HistoryEntry {
  readonly board: Board;
  readonly tray: Tray;
  readonly score: number;
  readonly batchIndex: number;
  readonly linesCleared: number;
  readonly placements: number;
  readonly status: GameStatus;
}

export interface BlockSession {
  readonly seed: string;
  readonly board: Board;
  /** Three slots; a used one holds null until all three are spent (§1). */
  readonly tray: Tray;
  readonly score: number;
  /** How many refills have been dealt — the draw's second coordinate (§6). */
  readonly batchIndex: number;
  readonly linesCleared: number;
  readonly status: GameStatus;
  readonly history: readonly HistoryEntry[];
  /** Pieces placed in this run. Not persisted (§10) — nothing on screen reads it. */
  readonly placements: number;
  readonly elapsedSeconds: number;
}

/**
 * A token that makes one game's seed its own. There are no levels and no
 * dates to seed from (§6), so a new game gets a new deal — while the seed
 * still pins that deal down completely, which is what makes the golden test
 * and the saved game mean anything.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const blockSeed = (token: string): string => `block-${token}`;

/** The pieces still on offer, in slot order; spent slots drop out. */
export function trayPieces(tray: Tray): readonly Piece[] {
  const pieces: Piece[] = [];
  for (const id of tray) {
    const piece = pieceById(id);
    if (piece) pieces.push(piece);
  }
  return pieces;
}

const statusFor = (board: Board, tray: Tray): GameStatus =>
  hasAnyMove(board, trayPieces(tray)) ? 'playing' : 'over';

/** A fresh game — an empty board and the seed's first batch. */
export function createSession(seed: string = blockSeed(newSeedToken())): BlockSession {
  const board = emptyBoard();
  const tray = drawBatch(seed, 0);
  return {
    seed,
    board,
    tray,
    score: 0,
    batchIndex: 0,
    linesCleared: 0,
    status: statusFor(board, tray),
    history: [],
    placements: 0,
    elapsedSeconds: 0,
  };
}

/**
 * Restores a session from persisted state. The undo history is not persisted
 * (§10): a resumed board starts from the position it was saved in, which is
 * the position the player left. `placements` restarts for the same reason —
 * it describes the run in memory and nothing on screen reads it.
 */
export function restoreSession(
  data: Omit<BlockSession, 'history' | 'status' | 'placements'>,
): BlockSession {
  return {
    ...data,
    history: [],
    placements: 0,
    status: statusFor(data.board, data.tray),
  };
}

/**
 * Puts the tray slot's piece down with its top-left corner at (row, col).
 * Returns null when the placement is not legal — off the board, over a filled
 * cell, an empty slot, or a game already over. That is a silent no-op by
 * design (§3): the board does not change, so nothing was lost and there is
 * nothing to say about it.
 */
export function placePiece(
  session: BlockSession,
  slot: number,
  row: number,
  col: number,
): BlockSession | null {
  if (session.status !== 'playing') return null;
  if (!Number.isInteger(slot) || slot < 0 || slot >= TRAY_SIZE) return null;
  const piece = pieceById(session.tray[slot]);
  if (piece === null) return null;

  if (!canPlace(session.board, piece, row, col)) return null;

  const placed = place(session.board, piece, row, col);
  const cleared = clearLines(placed.board);

  const tray = [...session.tray];
  tray[slot] = null;
  // The next three arrive only once all three are spent (§1), and they are
  // whatever (seed, batchIndex + 1) says — never a shape picked to help.
  let batchIndex = session.batchIndex;
  let nextTray: Tray = tray;
  if (tray.every((id) => id === null)) {
    batchIndex += 1;
    nextTray = drawBatch(session.seed, batchIndex);
  }

  const history = [
    ...session.history,
    {
      board: session.board,
      tray: session.tray,
      score: session.score,
      batchIndex: session.batchIndex,
      linesCleared: session.linesCleared,
      placements: session.placements,
      status: session.status,
    },
  ];
  if (history.length > UNDO_HISTORY_LIMIT) history.shift();

  return {
    ...session,
    board: cleared.board,
    tray: nextTray,
    score: session.score + scoreFor(placed.cells, cleared.lines),
    batchIndex,
    linesCleared: session.linesCleared + cleared.lines,
    status: statusFor(cleared.board, nextTray),
    history,
    placements: session.placements + 1,
  };
}

export function canUndo(session: BlockSession): boolean {
  return session.history.length > 0;
}

/**
 * Takes one placement back, whole (§7): board, tray, score, lines, and the
 * refill counter. Pure inverse of `placePiece`, including the status it
 * restores; whether the screen still offers it after a run has ended is the
 * context's call, not this function's.
 */
export function undo(session: BlockSession): BlockSession | null {
  const previous = session.history[session.history.length - 1];
  if (!previous) return null;
  return {
    ...session,
    board: previous.board,
    tray: previous.tray,
    score: previous.score,
    batchIndex: previous.batchIndex,
    linesCleared: previous.linesCleared,
    placements: previous.placements,
    status: previous.status,
    history: session.history.slice(0, -1),
  };
}
