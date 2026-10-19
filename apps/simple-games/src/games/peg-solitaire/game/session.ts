/**
 * PegSolitaireSession — a pure, immutable snapshot of one game in progress:
 * the problem, the pegs, and the jumps played. The React layer only
 * dispatches into these functions; all rules live here and in engine.ts.
 *
 * The jump list is the whole history (docs/PEG_SOLITAIRE_RULES.md §6, §11).
 * Undo takes the last jump back exactly — a jump is its own inverse given
 * where it went (engine.ts `revertJump`) — so there are no snapshots to keep
 * and no limit to set: a game holds at most 31 jumps on the cross and 13 on
 * the triangle. The same list is what a save stores, and restoring replays
 * it through the rules, so a resumed game keeps its whole Undo history and
 * a corrupt save cannot invent a position.
 *
 * Undo is free and unlimited (§6): every finish can be taken back and played
 * on, a perfect clear included. What keeps the statistics honest is `cleared`
 * — set the first time a game reaches a perfect clear and kept through every
 * Undo after it, saved with the game — so a clear undone and made again is
 * still that game's one clear (§10).
 *
 * There is no clock on screen (§5); elapsed seconds are carried here for
 * the statistics only.
 */
import { geometryOf, isHole } from './boards';
import { applyJump, initialPegs, jumpBetween, outcomeOf, revertJump } from './engine';
import { findProblem } from './problems';
import { decodeJumps, encodeJumps, type StoredJump } from './serialize';
import {
  isBoardKind,
  type BoardKind,
  type GameStatus,
  type Jump,
  type Outcome,
  type Pegs,
  type Problem,
} from './types';

export interface PegSolitaireSession {
  readonly problem: Problem;
  readonly pegs: Pegs;
  /** Every jump played, oldest first: the Undo history and the save (§6, §11). */
  readonly jumps: readonly Jump[];
  readonly status: GameStatus;
  /** How the finished game stands; null while a jump is left (§3). */
  readonly outcome: Outcome | null;
  /**
   * True once this game has reached a perfect clear, and still true after
   * that clear is undone: the game's one clear has been counted (§6, §10).
   * Only a new game (a retry, a new board) starts without it.
   */
  readonly cleared: boolean;
  readonly elapsedSeconds: number;
}

/** A fresh game on `problem` (§3): every hole but the start holds a peg. */
export function createSession(problem: Problem): PegSolitaireSession {
  const geometry = geometryOf(problem.kind);
  const pegs = initialPegs(geometry, problem.start);
  const outcome = outcomeOf(geometry, problem, pegs);
  return {
    problem,
    pegs,
    jumps: [],
    status: outcome ? 'over' : 'playing',
    outcome,
    cleared: false,
    elapsedSeconds: 0,
  };
}

/**
 * Restart (§6): the same problem from its first position, with no history,
 * no clock and no clear behind it. It is a new game for the statistics (§10),
 * so a clear made in it counts.
 */
export function restartSession(session: PegSolitaireSession): PegSolitaireSession {
  return createSession(session.problem);
}

function settle(
  session: PegSolitaireSession,
  pegs: Pegs,
  jumps: readonly Jump[],
): PegSolitaireSession {
  const outcome = outcomeOf(geometryOf(session.problem.kind), session.problem, pegs);
  return {
    ...session,
    pegs,
    jumps,
    status: outcome ? 'over' : 'playing',
    outcome,
    cleared: session.cleared || outcome?.kind === 'perfect',
  };
}

/**
 * The peg at `from` jumps to `to` (§2). Null when the game is over or the
 * jump is not legal here — the rules offer nothing there, silently (§4).
 */
export function applyMove(
  session: PegSolitaireSession,
  from: number,
  to: number,
): PegSolitaireSession | null {
  if (session.status !== 'playing') return null;
  const geometry = geometryOf(session.problem.kind);
  const pegs = applyJump(geometry, session.pegs, from, to);
  if (!pegs) return null;
  const jump = jumpBetween(geometry, from, to)!;
  return settle(session, pegs, [...session.jumps, jump]);
}

/**
 * Whether Undo has anything to take back (§6): any jump at all, whatever the
 * game's outcome — a perfect clear can be undone like every other finish.
 */
export function canUndo(session: PegSolitaireSession): boolean {
  return session.jumps.length > 0;
}

/**
 * Takes the last jump back (§6): the jumper returns, the jumped peg comes
 * back, and a finished game — a perfect clear too — is in play again. A clear
 * taken back stays `cleared`. Null when there is nothing to take back.
 */
export function undo(session: PegSolitaireSession): PegSolitaireSession | null {
  if (!canUndo(session)) return null;
  const last = session.jumps[session.jumps.length - 1]!;
  return settle(session, revertJump(session.pegs, last), session.jumps.slice(0, -1));
}

/**
 * What a save holds (§11): the problem, the jumps as [from, to], the clock —
 * and `cleared: true` only for a game whose perfect clear was undone, so a
 * resumed game cannot count its clear a second time (§10). Every other game's
 * record is written without it.
 */
export interface SessionRecord {
  readonly board: BoardKind;
  readonly start: number;
  readonly target: number;
  readonly jumps: readonly StoredJump[];
  readonly elapsedSeconds: number;
  readonly cleared?: true;
}

/** The most seconds a record may claim — the same bound the statistics use. */
export const MAX_ELAPSED_SECONDS = 1e9;

/**
 * A clock reading as a record holds it (§11): whole seconds, 0 to
 * MAX_ELAPSED_SECONDS. Fractions are dropped, anything below 0 or not a
 * number reads 0, and anything past the bound reads the bound — so a record
 * `toRecord` writes is always one `restoreSession` accepts, whatever clock the
 * state layer kept.
 */
export function wholeElapsedSeconds(seconds: number): number {
  if (!(seconds > 0)) return 0;
  return Math.min(MAX_ELAPSED_SECONDS, Math.floor(seconds));
}

export function toRecord(session: PegSolitaireSession): SessionRecord {
  return {
    board: session.problem.kind,
    start: session.problem.start,
    target: session.problem.target,
    jumps: encodeJumps(session.jumps),
    elapsedSeconds: wholeElapsedSeconds(session.elapsedSeconds),
    ...(session.cleared ? { cleared: true as const } : {}),
  };
}

/**
 * Why a record was refused (§11). Every one sends the player to the game's
 * home with nothing restored — never into a new game started on the quiet.
 */
export type RestoreRejection =
  | 'not-a-record'
  | 'unknown-board'
  | 'unknown-problem'
  | 'malformed-jumps'
  | 'illegal-jump'
  | 'finished'
  | 'bad-elapsed'
  | 'bad-cleared';

export type RestoreResult =
  | { readonly ok: true; readonly session: PegSolitaireSession }
  | { readonly ok: false; readonly reason: RestoreRejection };

/** A record's fields as they come off the disk: nothing is trusted yet. */
export interface UntrustedRecord {
  readonly board: unknown;
  readonly start: unknown;
  readonly target: unknown;
  readonly jumps: unknown;
  readonly elapsedSeconds: unknown;
  /** Absent on every record but a game whose perfect clear was undone. */
  readonly cleared?: unknown;
}

/**
 * Rebuilds a saved game by replaying it (§11), failing closed and never
 * throwing, whatever it is given:
 * - the value must be a record (an object, not an array, not null);
 * - the board must be one of the two, and the start/target pair one this
 *   game deals (problems.ts) — anything else could not have been dealt;
 * - the jump list must have the right shape, and every jump must be legal
 *   where it was played, replayed from the start through the rules;
 * - the replayed game must still have a jump left: a finished game is not a
 *   game to resume (it was already counted when it ended, §10);
 * - the clock must be a whole number of seconds in range;
 * - `cleared`, when present, must be a boolean (absent reads as false).
 */
export function restoreSession(value: unknown): RestoreResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, reason: 'not-a-record' };
  }
  const record = value as Partial<UntrustedRecord>;
  if (!isBoardKind(record.board)) return { ok: false, reason: 'unknown-board' };
  const geometry = geometryOf(record.board);
  if (!isHole(geometry, record.start) || !isHole(geometry, record.target)) {
    return { ok: false, reason: 'unknown-problem' };
  }
  const problem = findProblem(record.board, record.start, record.target);
  if (!problem) return { ok: false, reason: 'unknown-problem' };
  const stored = decodeJumps(record.jumps, geometry);
  if (!stored) return { ok: false, reason: 'malformed-jumps' };
  const elapsed = record.elapsedSeconds;
  if (
    typeof elapsed !== 'number' ||
    !Number.isInteger(elapsed) ||
    elapsed < 0 ||
    elapsed > MAX_ELAPSED_SECONDS
  ) {
    return { ok: false, reason: 'bad-elapsed' };
  }
  const cleared = record.cleared === undefined ? false : record.cleared;
  if (typeof cleared !== 'boolean') return { ok: false, reason: 'bad-cleared' };

  let session = createSession(problem);
  for (const [from, to] of stored) {
    const next = applyMove(session, from, to);
    if (!next) return { ok: false, reason: 'illegal-jump' };
    session = next;
  }
  if (session.status !== 'playing') return { ok: false, reason: 'finished' };
  // `+ 0` turns a stored −0 into 0; every other accepted value is unchanged.
  return { ok: true, session: { ...session, cleared, elapsedSeconds: elapsed + 0 } };
}
