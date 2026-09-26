/**
 * NumberPathSession — a pure, immutable snapshot of one puzzle: the board,
 * its one solution, the path the player has drawn, the undo history, and the
 * counters kept for the result screen.
 *
 * The clock lives outside. Elapsed seconds are carried in by whoever owns the
 * timer and handed back out for the result screen and the statistics — this
 * layer never reads one, which is what keeps a session a pure function of its
 * seed (§6, §8).
 *
 * Undo restores the path and nothing else (§5): a hint was still taken, so
 * that counter does not move. One entry is one stroke, one tap or one
 * truncation, whatever it did to the path. The history is never persisted —
 * a resumed game starts with an empty stack (§9).
 */
import { DAILY_DIFFICULTY, dailySeed } from './daily';
import {
  applyTrace,
  canExtend,
  emptyPath,
  extend,
  firstDeviation,
  isSolution,
  neighbourOf,
  truncate,
} from './engine';
import { generatePuzzle } from './generator';
import {
  TIERS,
  type Board,
  type Difficulty,
  type Direction,
  type GameMode,
  type GameStatus,
  type Path,
} from './types';

/**
 * Practically unlimited undo; a real game never comes close (§5). The cap
 * exists so a session that somehow runs forever cannot grow without bound.
 */
export const UNDO_HISTORY_LIMIT = 500;

export interface NumberPathSession {
  readonly mode: GameMode;
  readonly seed: string;
  readonly difficulty: Difficulty;
  /** Local YYYY-MM-DD in daily mode, null in difficulty mode. */
  readonly dailyDate: string | null;
  readonly board: Board;
  /** The one path the board admits (§2, §6) — what the hint reads (§5). */
  readonly solution: Path;
  /** What the player has drawn: cells in order, starting on 1 (§3). */
  readonly path: Path;
  /** Paths before each change. Not persisted (§9). */
  readonly history: readonly Path[];
  readonly status: GameStatus;
  readonly elapsedSeconds: number;
  readonly hintCount: number;
}

/**
 * A token that makes one difficulty game's seed its own. Difficulty mode has
 * no levels and no dates to seed from (§7), so a new game gets a new board —
 * while the seed still pins that board down completely, which is what lets
 * Retry offer the same board back and a saved game come back exact.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const difficultySeed = (difficulty: Difficulty, token: string): string =>
  `number-path-${difficulty}-${token}`;

function baseSession(
  mode: GameMode,
  seed: string,
  difficulty: Difficulty,
  dailyDate: string | null,
): NumberPathSession {
  const puzzle = generatePuzzle(seed, difficulty);
  return {
    mode,
    seed,
    difficulty,
    dailyDate,
    board: puzzle.board,
    solution: puzzle.solution,
    path: emptyPath(puzzle.board),
    history: [],
    status: 'playing',
    elapsedSeconds: 0,
    hintCount: 0,
  };
}

/** A fresh difficulty game — new unless a seed pins an old one (§7). */
export function createDifficultySession(
  difficulty: Difficulty,
  seed: string = difficultySeed(difficulty, newSeedToken()),
): NumberPathSession {
  return baseSession('difficulty', seed, difficulty, null);
}

/** A fresh daily game for a local YYYY-MM-DD date — medium every day (§7). */
export function createDailySession(dateString: string): NumberPathSession {
  return baseSession('daily', dailySeed(dateString), DAILY_DIFFICULTY, dateString);
}

/** Rebuilds the same puzzle from scratch — Retry, the shared `tryAgain` (§5). */
export function restartSession(session: NumberPathSession): NumberPathSession {
  return session.mode === 'daily' && session.dailyDate !== null
    ? createDailySession(session.dailyDate)
    : createDifficultySession(session.difficulty, session.seed);
}

/**
 * Restores a session from persisted state. The win is re-derived from the
 * path rather than restored from the record: a saved status is one more thing
 * that can be wrong, and §2 is cheap to evaluate.
 */
export function restoreSession(
  data: Omit<NumberPathSession, 'history' | 'status'>,
): NumberPathSession {
  return {
    ...data,
    history: [],
    status: isSolution(data.board, data.path) ? 'solved' : 'playing',
  };
}

/** The board size a session's difficulty promises — for the top bar. */
export const tierOf = (session: NumberPathSession) => TIERS[session.difficulty];

function withPath(session: NumberPathSession, path: Path, remember: boolean): NumberPathSession {
  let history = session.history;
  if (remember) {
    history = [...history, session.path];
    if (history.length > UNDO_HISTORY_LIMIT) history = history.slice(1);
  }
  return {
    ...session,
    path,
    history,
    status: isSolution(session.board, path) ? 'solved' : 'playing',
  };
}

/**
 * One trace over the board (§4): the cells a stroke passed through, in
 * order, or the single cell a tap landed on. `newStroke` says whether this
 * is the first change of a gesture — true for a tap and for the first move
 * of a drag that changes anything, false for every later move of the same
 * drag — because one gesture is one undo step (§5).
 *
 * Returns null when nothing changed, so the caller can tell the first move
 * that draws from the ones before it that did not. Refuses every move once
 * the status is 'solved', which is what makes the transition into it happen
 * exactly once.
 */
export function doTrace(
  session: NumberPathSession,
  cells: readonly number[],
  newStroke: boolean,
): NumberPathSession | null {
  if (session.status !== 'playing') return null;
  const path = applyTrace(session.board, session.path, cells);
  return path === session.path ? null : withPath(session, path, newStroke);
}

/** A tap (§4): cut the path back to a cell on it, or step onto a cell beside its end. */
export const doTap = (session: NumberPathSession, cell: number): NumberPathSession | null =>
  doTrace(session, [cell], true);

/** One step back from the end (§4, Backspace). Null when the path is only its start. */
export function doBacktrack(session: NumberPathSession): NumberPathSession | null {
  if (session.status !== 'playing' || session.path.length < 2) return null;
  const previous = session.path[session.path.length - 2]!;
  const path = truncate(session.path, previous);
  return path === null ? null : withPath(session, path, true);
}

export const canUndo = (session: NumberPathSession): boolean =>
  session.status === 'playing' && session.history.length > 0;

/**
 * Reverts the last change to the path (§5). The hint count stays where it
 * is: undo takes back a stroke, not the fact that help was asked for.
 */
export function doUndo(session: NumberPathSession): NumberPathSession | null {
  if (!canUndo(session)) return null;
  const previous = session.history[session.history.length - 1]!;
  return { ...session, path: previous, history: session.history.slice(0, -1) };
}

export type Hint =
  /** The path has left the one road: cut it back to this cell (§5). */
  | { readonly kind: 'back'; readonly cell: number }
  /** The path is on the road: this is its next cell (§5). */
  | { readonly kind: 'next'; readonly cell: number };

/**
 * The hint of §5. The stored solution is the one path the board admits, and
 * the generator proved that, so "the next cell of the solution" is a proven
 * continuation and never a guess. Nothing here writes to the path.
 */
export function hintFor(session: NumberPathSession): Hint | null {
  if (session.status !== 'playing') return null;
  const astray = firstDeviation(session.path, session.solution);
  if (astray > 0) return { kind: 'back', cell: session.path[astray - 1]! };
  const next = session.solution[session.path.length];
  return next === undefined ? null : { kind: 'next', cell: next };
}

/** Hints are counted for the result screen, never limited or charged for (§5). */
export const doHintUse = (session: NumberPathSession): NumberPathSession => ({
  ...session,
  hintCount: session.hintCount + 1,
});

/**
 * Carries the owner's running clock into the record, on the way to a save or
 * to the result screen (§8). Seconds only ever move forward, so a clock that
 * came back smaller after a restore is ignored rather than trusted.
 */
export function withElapsedSeconds(session: NumberPathSession, seconds: number): NumberPathSession {
  const next = Math.max(session.elapsedSeconds, Math.floor(seconds));
  return next === session.elapsedSeconds ? session : { ...session, elapsedSeconds: next };
}

/**
 * One arrow key (§4): a step from the end in `direction`. Onto the cell the
 * path just came from it is a step back — the same reading as dragging back
 * — and onto any other cell it is the one-cell extension a tap there would
 * be, or nothing at all. Null when nothing changed.
 */
export function doStep(session: NumberPathSession, direction: Direction): NumberPathSession | null {
  if (session.status !== 'playing') return null;
  const end = session.path[session.path.length - 1]!;
  const target = neighbourOf(end, direction, session.board.width, session.board.height);
  if (target < 0) return null;
  if (target === session.path[session.path.length - 2]) return doBacktrack(session);
  if (!canExtend(session.board, session.path, target)) return null;
  return withPath(session, extend(session.path, target), true);
}
