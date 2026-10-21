/**
 * TangramSession — a pure, immutable snapshot of one figure in progress: the
 * figure, the pieces on the board, the turn each tray piece shows, and the
 * Undo history (docs/TANGRAM_RULES.md §1, §3). The React layer only
 * dispatches into these functions; all rules live here and in snap.ts.
 *
 * Every operation returns a new session, or null when it changed nothing —
 * and only a change is an operation (§3): a drop that cannot be placed, a
 * turn on the board with no room, a re-drop onto the same pose, anything
 * aimed at a fixed piece. A piece in the hand (being dragged or lifted by
 * the keyboard) is the UI's state; the session keeps it where it was until
 * the drop decides (§4, §8「手にある駒」).
 *
 * Completion is geometry (§5「完成」): all seven on the board, each placed
 * where it fits, so no two overlap and all are inside — and since the seven
 * areas sum to the silhouette's, nothing is left. The stored solution is
 * never compared. A finished figure is over: no Undo, no save (§3, §8).
 */
import { figureById, dailyFigure, isTier, type Figure, type Tier } from './catalog';
import { isCalendarDate } from './daily';
import { convexInside, convexOverlap } from './geometry';
import {
  canFlip,
  DEFAULT_ORIENTATION,
  isOrientation,
  isPieceId,
  PIECE_IDS,
  poseVertices,
  TURNS,
  type Orientation,
  type PieceId,
} from './pieces';
import {
  COORD_LIMIT,
  isPlaceable,
  isValidPivot,
  samePose,
  turnAbout,
  type BoardPieces,
  type Placement,
} from './snap';
import { hasEvenRationalParts, isBoundedPoint, ptEq, type Pt } from './z2';

/** Practically unlimited undo (§3); the oldest step is dropped beyond it. */
export const UNDO_HISTORY_LIMIT = 2_000;
/** The most seconds a record may claim (§8). */
export const MAX_ELAPSED_SECONDS = 1e9;

export type GameMode = 'free' | 'daily';
export type GameStatus = 'playing' | 'complete';
export type TrayOrientations = Readonly<Record<PieceId, Orientation>>;

/** One step back: the board and the tray exactly as they were (§3). */
export interface HistoryEntry {
  readonly board: BoardPieces;
  readonly tray: TrayOrientations;
}

export interface TangramSession {
  readonly figure: Figure;
  readonly mode: GameMode;
  /** The daily's local YYYY-MM-DD; null in Free Play. */
  readonly dailyDate: string | null;
  /** Pieces on the board, the fixed ones included (§3). */
  readonly board: BoardPieces;
  /** The turn each piece shows while it is in the tray (§3: kept from the board). */
  readonly tray: TrayOrientations;
  readonly history: readonly HistoryEntry[];
  readonly status: GameStatus;
  /** Seconds already booked for this figure; never shown during play (§7). */
  readonly elapsedSeconds: number;
}

const DEFAULT_TRAY: TrayOrientations = Object.fromEntries(
  PIECE_IDS.map((id) => [id, DEFAULT_ORIENTATION]),
) as Record<PieceId, Orientation>;

/** Medium's fixed pieces, where the catalog's solution puts them (§3). */
function fixedBoard(figure: Figure): BoardPieces {
  const board: Partial<Record<PieceId, Placement>> = {};
  for (const id of figure.fixed) {
    const pose = figure.solution[id];
    board[id] = { ...pose, pv: pose.at };
  }
  return board;
}

/** A fresh start on `figure`: every non-fixed piece in the tray, unturned. */
export function createSession(
  figure: Figure,
  mode: GameMode = 'free',
  dailyDate: string | null = null,
): TangramSession {
  return {
    figure,
    mode,
    dailyDate: mode === 'daily' ? dailyDate : null,
    board: fixedBoard(figure),
    tray: DEFAULT_TRAY,
    history: [],
    status: 'playing',
    elapsedSeconds: 0,
  };
}

/**
 * Today's daily: the Medium figure the date picks (§6). Null when the
 * string is not a calendar date (fail closed: the UI goes home).
 */
export function createDailySession(dateString: string): TangramSession | null {
  const figure = dailyFigure(dateString);
  return figure ? createSession(figure, 'daily', dateString) : null;
}

/** ↻ (§6): the same figure from the start — no history, no clock. */
export const restartSession = (session: TangramSession): TangramSession =>
  createSession(session.figure, session.mode, session.dailyDate);

export const isFixed = (session: TangramSession, id: PieceId): boolean =>
  session.figure.fixed.includes(id);
export const isOnBoard = (session: TangramSession, id: PieceId): boolean =>
  session.board[id] !== undefined;
/** The pieces still in the tray, in tray order (§5 の表の下). */
export const trayPieces = (session: TangramSession): PieceId[] =>
  PIECE_IDS.filter((id) => !isOnBoard(session, id));

export const canUndo = (session: TangramSession): boolean =>
  session.status === 'playing' && session.history.length > 0;

/** Whether every piece is on the board and the board really is a cover (§5「完成」). */
export function isCompleteBoard(figure: Figure, board: BoardPieces): boolean {
  const polygons: Pt[][] = [];
  for (const id of PIECE_IDS) {
    const placed = board[id];
    if (!placed) return false;
    const vertices = poseVertices(id, placed);
    if (!convexInside(vertices, figure.outline)) return false;
    polygons.push(vertices);
  }
  for (let i = 0; i < polygons.length; i++) {
    for (let j = i + 1; j < polygons.length; j++) {
      if (convexOverlap(polygons[i]!, polygons[j]!)) return false;
    }
  }
  return true;
}

function commit(
  session: TangramSession,
  board: BoardPieces,
  tray: TrayOrientations,
): TangramSession {
  const history = [...session.history, { board: session.board, tray: session.tray }];
  if (history.length > UNDO_HISTORY_LIMIT) history.splice(0, history.length - UNDO_HISTORY_LIMIT);
  const complete = isCompleteBoard(session.figure, board);
  return {
    ...session,
    board,
    tray,
    history: complete ? [] : history,
    status: complete ? 'complete' : 'playing',
  };
}

/** Whether a placement is one the board may hold: exact, bounded, a lawful pivot (§5, §8). */
export function isLawfulPlacement(id: PieceId, placement: Placement): boolean {
  return (
    isOrientation(id, placement.r, placement.f) &&
    isBoundedPoint(placement.at, COORD_LIMIT) &&
    isBoundedPoint(placement.pv, COORD_LIMIT) &&
    hasEvenRationalParts(placement.at) &&
    isValidPivot(id, placement)
  );
}

/**
 * Puts a piece at a placement (§3「置く / 置き直し」): from the tray, or from
 * elsewhere on the board in one step. Null when the game is over, the piece
 * is fixed, the placement is not lawful or has no room, or the piece already
 * stands in that exact pose (then its pivot stays as it was — §3).
 */
export function placePiece(
  session: TangramSession,
  id: PieceId,
  placement: Placement,
): TangramSession | null {
  if (session.status !== 'playing' || isFixed(session, id)) return null;
  const current = session.board[id];
  if (current && samePose(current, placement)) return null;
  if (!isLawfulPlacement(id, placement)) return null;
  if (!isPlaceable(session.figure.outline, session.board, id, placement)) return null;
  const kept: Placement = { r: placement.r, f: placement.f, at: placement.at, pv: placement.pv };
  return commit(session, { ...session.board, [id]: kept }, session.tray);
}

/**
 * Sends a board piece back to the tray (§3, §4: Escape, a drop with no room,
 * a cancelled drag), keeping its turn and side there. Null for a fixed piece
 * or one already in the tray.
 */
export function returnToTray(session: TangramSession, id: PieceId): TangramSession | null {
  if (session.status !== 'playing' || isFixed(session, id)) return null;
  const placed = session.board[id];
  if (!placed) return null;
  const board: Partial<Record<PieceId, Placement>> = { ...session.board };
  delete board[id];
  return commit(session, board, { ...session.tray, [id]: { r: placed.r, f: placed.f } });
}

function reorient(
  session: TangramSession,
  id: PieceId,
  next: (o: Orientation) => Orientation,
): TangramSession | null {
  if (session.status !== 'playing' || isFixed(session, id)) return null;
  const placed = session.board[id];
  if (!placed) {
    return commit(session, session.board, { ...session.tray, [id]: next(session.tray[id]) });
  }
  const turned = turnAbout(placed, next(placed));
  if (!turned || !isLawfulPlacement(id, turned)) return null;
  if (!isPlaceable(session.figure.outline, session.board, id, turned)) return null;
  return commit(session, { ...session.board, [id]: turned }, session.tray);
}

/** 45° clockwise (§4): in the tray always; on the board about the pivot, when there is room. */
export const rotatePiece = (session: TangramSession, id: PieceId): TangramSession | null =>
  reorient(session, id, (o) => ({ r: (o.r + 1) % TURNS, f: o.f }));

/** Turns the parallelogram over (§4): the same way as a turn; no other piece flips. */
export function flipPiece(session: TangramSession, id: PieceId): TangramSession | null {
  if (!canFlip(id)) return null;
  return reorient(session, id, (o) => ({ r: o.r, f: o.f === 1 ? 0 : 1 }));
}

/** One operation back (§3). Null with nothing to take back or once the figure is complete. */
export function undo(session: TangramSession): TangramSession | null {
  if (!canUndo(session)) return null;
  const last = session.history[session.history.length - 1]!;
  return { ...session, board: last.board, tray: last.tray, history: session.history.slice(0, -1) };
}

/**
 * A clock reading as a record holds it (§8): whole seconds, 0 to
 * MAX_ELAPSED_SECONDS; fractions dropped, negatives and non-numbers 0.
 */
export function wholeElapsedSeconds(seconds: number): number {
  if (!(seconds > 0)) return 0;
  return Math.min(MAX_ELAPSED_SECONDS, Math.floor(seconds));
}

export const withElapsedSeconds = (session: TangramSession, seconds: number): TangramSession => ({
  ...session,
  elapsedSeconds: wholeElapsedSeconds(seconds),
});

// ---------------------------------------------------------------- records

export interface StoredPiece {
  readonly r: number;
  readonly f: 0 | 1;
  readonly at: readonly number[];
  readonly pv: readonly number[];
}

/**
 * What a save holds (§8), without the storage layer's `schemaVersion` and
 * `savedAt`: the figure, the non-fixed pieces on the board, the clock. Tray
 * turns, the history and the status are not written.
 */
export interface SessionRecord {
  readonly mode: GameMode;
  readonly tier: Tier;
  readonly figure: string;
  readonly dailyDate: string | null;
  readonly pieces: Readonly<Partial<Record<PieceId, StoredPiece>>>;
  readonly elapsedSeconds: number;
}

export function toRecord(session: TangramSession): SessionRecord {
  const pieces: Partial<Record<PieceId, StoredPiece>> = {};
  for (const id of PIECE_IDS) {
    const placed = session.board[id];
    if (!placed || isFixed(session, id)) continue;
    pieces[id] = { r: placed.r, f: placed.f, at: [...placed.at], pv: [...placed.pv] };
  }
  return {
    mode: session.mode,
    tier: session.figure.tier,
    figure: session.figure.id,
    dailyDate: session.dailyDate,
    pieces,
    elapsedSeconds: wholeElapsedSeconds(session.elapsedSeconds),
  };
}

/** Why a record was refused (§8). Each one sends the player to the game's home. */
export type RestoreRejection =
  | 'not-a-record'
  | 'bad-mode'
  | 'unknown-figure'
  | 'wrong-daily-figure'
  | 'bad-piece'
  | 'fixed-piece'
  | 'outside'
  | 'overlap'
  | 'finished'
  | 'bad-elapsed';

export type RestoreResult =
  | { readonly ok: true; readonly session: TangramSession }
  | { readonly ok: false; readonly reason: RestoreRejection };

const isRecordObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Four whole numbers within COORD_LIMIT, as a point; null otherwise. */
function decodePoint(value: unknown): Pt | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const parts = value as unknown[];
  if (!parts.every((v) => typeof v === 'number' && Number.isInteger(v))) return null;
  // `+ 0` turns a stored −0 into 0.
  const p = (parts as number[]).map((v) => v + 0) as unknown as Pt;
  return isBoundedPoint(p, COORD_LIMIT) ? p : null;
}

function decodePiece(id: PieceId, value: unknown): Placement | null {
  if (!isRecordObject(value)) return null;
  const { r, f } = value;
  if (!isOrientation(id, r, f)) return null;
  const at = decodePoint(value.at);
  const pv = decodePoint(value.pv);
  if (!at || !pv) return null;
  const placement: Placement = { r: (r as number) + 0, f: f as 0 | 1, at, pv };
  return isLawfulPlacement(id, placement) ? placement : null;
}

const fail = (reason: RestoreRejection): RestoreResult => ({ ok: false, reason });

/**
 * Rebuilds a saved figure (§8), failing closed and never throwing, whatever
 * it is given. The checks run in the order of §8's list, and each placement
 * is judged by the same geometry play uses — so a board that play could not
 * hold (out of the silhouette, overlapping, inexact, a pivot the next turn
 * could not carry) cannot be restored from a save or a backup either. Whether
 * each piece sits where a snap could have put it is not searched for (§8).
 * The storage layer checks the rest: schemaVersion, savedAt, the key's mode,
 * and that a daily is today's.
 */
export function restoreSession(value: unknown): RestoreResult {
  try {
    return restore(value);
  } catch {
    return fail('not-a-record');
  }
}

function restore(value: unknown): RestoreResult {
  if (!isRecordObject(value)) return fail('not-a-record');
  const { mode, tier, dailyDate } = value;
  if (mode !== 'free' && mode !== 'daily') return fail('bad-mode');
  if (!isTier(tier)) return fail('bad-mode');
  if (mode === 'daily' && (tier !== 'medium' || !isCalendarDate(dailyDate))) {
    return fail('bad-mode');
  }
  if (mode === 'free' && dailyDate !== null) return fail('bad-mode');
  const figure = figureById(value.figure);
  if (!figure || figure.tier !== tier) return fail('unknown-figure');
  if (mode === 'daily' && dailyFigure(dailyDate as string) !== figure) {
    return fail('wrong-daily-figure');
  }

  const stored = value.pieces;
  if (!isRecordObject(stored)) return fail('bad-piece');
  const placements: Partial<Record<PieceId, Placement>> = {};
  for (const key of Object.keys(stored)) {
    if (!isPieceId(key)) return fail('bad-piece');
    const placement = decodePiece(key, stored[key]);
    if (!placement) return fail('bad-piece');
    placements[key] = placement;
  }
  if (figure.fixed.some((id) => placements[id] !== undefined)) return fail('fixed-piece');

  const session = createSession(figure, mode, mode === 'daily' ? (dailyDate as string) : null);
  const board: Partial<Record<PieceId, Placement>> = { ...session.board, ...placements };
  const onBoard = PIECE_IDS.filter((id) => board[id] !== undefined);
  const polygons = onBoard.map((id) => poseVertices(id, board[id]!));
  if (polygons.some((vertices) => !convexInside(vertices, figure.outline))) {
    return fail('outside');
  }
  for (let i = 0; i < polygons.length; i++) {
    for (let j = i + 1; j < polygons.length; j++) {
      if (convexOverlap(polygons[i]!, polygons[j]!)) return fail('overlap');
    }
  }
  if (onBoard.length === PIECE_IDS.length) return fail('finished');

  const elapsed = value.elapsedSeconds;
  if (
    typeof elapsed !== 'number' ||
    !Number.isInteger(elapsed) ||
    elapsed < 0 ||
    elapsed > MAX_ELAPSED_SECONDS
  ) {
    return fail('bad-elapsed');
  }
  return { ok: true, session: { ...session, board, elapsedSeconds: elapsed + 0 } };
}

/** Whether two placements are the same pose and pivot. */
export const samePlacement = (a: Placement, b: Placement): boolean =>
  samePose(a, b) && ptEq(a.pv, b.pv);
