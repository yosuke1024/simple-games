/**
 * MakeTheTargetSession — a pure, immutable snapshot of one problem in play:
 * the problem, the moves made, the slots they leave, what is selected, and
 * the counters the result screen and the statistics read
 * (docs/MAKE_THE_TARGET_RULES.md §2–§5, §9).
 *
 * The move list is the whole history (§5): Undo replays the dealt numbers
 * through every move but the last (at most n−1 = 4 moves in v1), so there are
 * no snapshots to keep, and the same list is what a save stores (§10).
 *
 * Every tap function returns the session it was given — the same object —
 * when the tap changes nothing (an empty slot, an operator with no tile
 * chosen, a merge the rules refuse, a finished board). A refused merge is
 * silent (§3): nothing on the board or in the selection moves.
 *
 * The clock lives outside (§9): elapsed seconds are handed in by whoever
 * owns the timer, and a smaller reading than the one held is ignored. This
 * module reads no clock and no randomness, and imports neither the
 * generator nor the solver (§5「game/ のモジュールの境界」).
 */
import { DAILY_DIFFICULTY, dailySeed } from './daily';
import { applyMove, initialSlots, isLegalMove, outcomeOf, replay, type Expression } from './engine';
import type { Difficulty, GameMode, GameStatus, Move, Operator, Problem, Slots } from './types';

export interface MakeTheTargetSession {
  readonly mode: GameMode;
  readonly seed: string;
  readonly difficulty: Difficulty;
  /** Local YYYY-MM-DD in daily mode, null in Free Play. */
  readonly dailyDate: string | null;
  readonly problem: Problem;
  /** Every move made, oldest first: the Undo history and the save (§5, §10). */
  readonly moves: readonly Move[];
  readonly slots: Slots;
  readonly status: GameStatus;
  /** The tile chosen first — the left term (§3). */
  readonly selectedTile: number | null;
  /** The operator chosen after it (§3). Never set without a tile. */
  readonly selectedOperator: Operator | null;
  /**
   * Whether this is a retry of a problem already solved (§9): set by a Free
   * Play retry from `solved`, kept through later retries, always false in
   * the daily. The statistics layer reads it; this one only carries it.
   */
  readonly repeat: boolean;
  readonly elapsedSeconds: number;
}

/**
 * A token that makes one Free Play seed its own (§8). The caller passes the
 * time and the random source (the state layer: `Date.now()` and
 * `Math.random`); nothing in game/ reads either.
 */
export function newSeedToken(now: number, random: () => number): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

/** A Free Play seed (§8): `make-the-target-<difficulty>-<token>`. */
export const freeSeed = (difficulty: Difficulty, token: string): string =>
  `make-the-target-${difficulty}-${token}`;

/** Whether `seed` is a Free Play seed for `difficulty` with a non-empty token (§10). */
export function isFreeSeed(seed: string, difficulty: Difficulty): boolean {
  const prefix = freeSeed(difficulty, '');
  return seed.startsWith(prefix) && seed.length > prefix.length;
}

export interface SessionOrigin {
  readonly mode: GameMode;
  readonly seed: string;
  readonly dailyDate: string | null;
}

/** A fresh game on `problem`: the numbers dealt, nothing chosen, nothing played. */
export function createSession(problem: Problem, origin: SessionOrigin): MakeTheTargetSession {
  return {
    mode: origin.mode,
    seed: origin.seed,
    difficulty: problem.difficulty,
    dailyDate: origin.dailyDate,
    problem,
    moves: [],
    slots: initialSlots(problem.numbers),
    status: 'playing',
    selectedTile: null,
    selectedOperator: null,
    repeat: false,
    elapsedSeconds: 0,
  };
}

/** The origin of a Free Play game (§8). */
export const freeOrigin = (seed: string): SessionOrigin => ({
  mode: 'free',
  seed,
  dailyDate: null,
});

/** The origin of the daily for a local date (§8). Its difficulty is always Medium. */
export const dailyOrigin = (dateString: string): SessionOrigin => ({
  mode: 'daily',
  seed: dailySeed(dateString),
  dailyDate: dateString,
});

export { DAILY_DIFFICULTY };

/**
 * Plays `move` on a game in play (§2): the result in the right term's slot,
 * the selection cleared, and the board settled — `solved` or `missed` once
 * one number is left. Null when the game is not in play or the move is not
 * legal. Taps and the restore path both come through here.
 */
export function playMove(session: MakeTheTargetSession, move: Move): MakeTheTargetSession | null {
  if (session.status !== 'playing') return null;
  const slots = applyMove(session.slots, move);
  if (slots === null) return null;
  return {
    ...session,
    moves: [...session.moves, move],
    slots,
    status: outcomeOf(slots, session.problem.target),
    selectedTile: null,
    selectedOperator: null,
  };
}

/**
 * A tap on the tile in `slot` (§3):
 * - an empty slot, a slot off the board, or a game not in play: nothing;
 * - nothing chosen: the tile is chosen;
 * - the chosen tile again: everything is cleared;
 * - another tile with no operator chosen: the choice moves to it;
 * - another tile with an operator chosen: the merge, if the rules allow it —
 *   otherwise nothing at all changes (the tile and the operator stay chosen).
 */
export function tapTile(session: MakeTheTargetSession, slot: number): MakeTheTargetSession {
  if (session.status !== 'playing') return session;
  if (!Number.isInteger(slot) || slot < 0 || slot >= session.slots.length) return session;
  if (session.slots[slot] === null) return session;
  const chosen = session.selectedTile;
  if (chosen === null) return { ...session, selectedTile: slot };
  if (chosen === slot) return clearSelection(session);
  if (session.selectedOperator === null) return { ...session, selectedTile: slot };
  const move: Move = { left: chosen, op: session.selectedOperator, right: slot };
  if (!isLegalMove(session.slots, move)) return session;
  return playMove(session, move)!;
}

/**
 * A tap on an operator (§3): nothing until a tile is chosen (the buttons are
 * disabled then); the same operator again clears just the operator; another
 * one replaces it.
 */
export function tapOperator(session: MakeTheTargetSession, op: Operator): MakeTheTargetSession {
  if (session.status !== 'playing' || session.selectedTile === null) return session;
  return { ...session, selectedOperator: session.selectedOperator === op ? null : op };
}

/** Escape (§3): clears the selection. The same session when nothing is chosen. */
export function clearSelection(session: MakeTheTargetSession): MakeTheTargetSession {
  if (session.selectedTile === null && session.selectedOperator === null) return session;
  return { ...session, selectedTile: null, selectedOperator: null };
}

/**
 * Whether Undo has a move to take back (§5): any move, in play or `missed`.
 * A solved or revealed game is over and takes nothing back.
 */
export function canUndo(session: MakeTheTargetSession): boolean {
  return session.moves.length > 0 && (session.status === 'playing' || session.status === 'missed');
}

/**
 * Takes the last move back (§5): both tiles return to their slots, a
 * `missed` board is in play again, and the selection is cleared. Null when
 * there is nothing to take back.
 */
export function undo(session: MakeTheTargetSession): MakeTheTargetSession | null {
  if (!canUndo(session)) return null;
  const moves = session.moves.slice(0, -1);
  const replayed = replay(session.problem.numbers, moves)!;
  return {
    ...session,
    moves,
    slots: replayed.slots,
    status: 'playing',
    selectedTile: null,
    selectedOperator: null,
  };
}

/**
 * Retry the same problem (§5 Restart): the problem the session holds, with
 * no moves and no clock — nothing is regenerated and nothing searches. A
 * Free Play retry of a solved problem, and every retry after one, is a
 * `repeat` (§9); the daily never is. Null for a revealed game: its card has
 * no retry (§5).
 */
export function restartSession(session: MakeTheTargetSession): MakeTheTargetSession | null {
  if (session.status === 'revealed') return null;
  const repeat = session.mode === 'free' && (session.repeat || session.status === 'solved');
  return {
    ...createSession(session.problem, session),
    repeat,
  };
}

/**
 * Whether「解を 1 つ見る」is offered (§5): Free Play only, and only on the
 * `missed` panel.
 */
export function canReveal(session: MakeTheTargetSession): boolean {
  return session.mode === 'free' && session.status === 'missed';
}

/**
 * Ends the problem by showing the solution kept with it (§5): `revealed`,
 * which takes no moves, no Undo and no retry. Nothing searches — the
 * solution is the one the problem was dealt with. Null where it is not
 * offered.
 */
export function revealSolution(session: MakeTheTargetSession): MakeTheTargetSession | null {
  if (!canReveal(session)) return null;
  return { ...session, status: 'revealed', selectedTile: null, selectedOperator: null };
}

/**
 * The owner of the clock hands in its reading (§9). A smaller reading, or
 * one that is not a finite number, is ignored.
 */
export function withElapsed(session: MakeTheTargetSession, seconds: number): MakeTheTargetSession {
  if (!Number.isFinite(seconds) || seconds <= session.elapsedSeconds) return session;
  return { ...session, elapsedSeconds: seconds };
}

/** The expression lines under the board (§4): one per move, oldest first. */
export function expressionLines(session: MakeTheTargetSession): Expression[] {
  return replay(session.problem.numbers, session.moves)!.expressions;
}

/**
 * The solution kept with the problem, as expression lines from the dealt
 * numbers (§5) — for a `revealed` board only, null in every other status.
 * §5 has one way in (the `missed` panel → confirm → `revealed`) and no Hint;
 * this keeps the screen from reaching the solution any other way.
 */
export function solutionLines(session: MakeTheTargetSession): Expression[] | null {
  if (session.status !== 'revealed') return null;
  return replay(session.problem.numbers, session.problem.solution)!.expressions;
}
