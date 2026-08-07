/**
 * CheckersSession — a pure, immutable snapshot of one match in progress:
 * board + whose turn + undo history. The React layer only dispatches into
 * these functions; all rules live here, in engine.ts and in cpu.ts.
 *
 * A *turn* and a *step* are different things here, and the difference is the
 * whole shape of this module. Landing from a jump with another jump available
 * means the same piece must go on (§2), so one turn can be several steps. The
 * move counter counts turns; `pendingJumpFrom` holds a turn open between
 * them. Everything else — the CPU's draw, whose move it is, the undo stack —
 * is keyed to turns, because a turn is what a player decides.
 *
 * Undo is the one help this title offers beyond showing the legal moves, and
 * it is free and unlimited (§5). It steps back to the player's previous
 * decision point — a half-finished sequence goes back to before it started,
 * because the middle of a forced sequence is not a place anything was
 * decided. It is a take-back, not a reroll: the CPU's choice is decided by
 * the seed and the move count (§4), so putting the board back and playing the
 * same turn brings the same reply.
 *
 * There is no clock on screen (§10); elapsed seconds are carried here for the
 * statistics only.
 */
import { chooseCpuTurn } from './cpu';
import { applyStep, hasAnyMove, isQuietKingStep, legalMoves, type Move } from './engine';
import {
  CPU,
  DRAW_QUIET_PLIES,
  PLAYER,
  initialBoard,
  opponentOf,
  sideToMove,
  type Board,
  type Difficulty,
  type GameStatus,
  type Side,
} from './types';

/** Practically unlimited undo; a match is rarely a hundred turns (§5). */
export const UNDO_HISTORY_LIMIT = 200;

/** One decision point: the position the player began a turn from. */
export interface HistoryEntry {
  readonly board: Board;
  readonly moveCount: number;
  readonly quietPlies: number;
}

export interface CheckersSession {
  readonly seed: string;
  readonly difficulty: Difficulty;
  /**
   * Who opened this match — the player's choice, taken before the first move
   * (§1). It stays with the session because the board alone cannot say it.
   */
  readonly first: Side;
  readonly board: Board;
  /** Whose turn it is. Meaningless once the status is terminal. */
  readonly toMove: Side;
  /** From the player's side of the table: 'won' means the player did (§3). */
  readonly status: GameStatus;
  /**
   * The cell the piece in the middle of a capture sequence must jump from,
   * or null when no turn is half-played (§2).
   */
  readonly pendingJumpFrom: number | null;
  /** Snapshots taken before each of the player's turns, oldest first. */
  readonly history: readonly HistoryEntry[];
  /** Completed turns, by either side. The CPU draw's second half (§4). */
  readonly moveCount: number;
  /** Turns since the last capture or man move (§3). */
  readonly quietPlies: number;
  readonly elapsedSeconds: number;
}

/**
 * A token that makes one match's seed its own. There is nothing to deal in
 * this game and no dates to seed from, so every new match gets a new token —
 * while the seed still pins the CPU down completely, which is what §5 rests
 * on.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const matchSeed = (token: string): string => `checkers-${token}`;

/**
 * A fresh match. `first` is the player's choice of side (§1); the CPU opening
 * means the session starts on the CPU's turn, which the screen plays out the
 * same way it plays out any other CPU turn.
 */
export function createSession(
  difficulty: Difficulty,
  first: Side = PLAYER,
  seed: string = matchSeed(newSeedToken()),
): CheckersSession {
  return {
    seed,
    difficulty,
    first,
    board: initialBoard(),
    toMove: first,
    status: 'playing',
    pendingJumpFrom: null,
    history: [],
    moveCount: 0,
    quietPlies: 0,
    elapsedSeconds: 0,
  };
}

/**
 * What a completed turn makes of the match (§3): the side about to move has
 * lost if it cannot, and a long enough run of quiet king moves is a draw.
 */
function settle(
  session: CheckersSession,
  board: Board,
  mover: Side,
  quietPlies: number,
): CheckersSession {
  const moveCount = session.moveCount + 1;
  const next = opponentOf(mover);
  const status: GameStatus = !hasAnyMove(board, next)
    ? mover === PLAYER
      ? 'won'
      : 'lost'
    : quietPlies >= DRAW_QUIET_PLIES
      ? 'draw'
      : 'playing';
  return {
    ...session,
    board,
    toMove: next,
    status,
    pendingJumpFrom: null,
    moveCount,
    quietPlies,
  };
}

/** The moves the side to move may play right now (§2). */
export function currentMoves(session: CheckersSession): Move[] {
  if (session.status !== 'playing') return [];
  return legalMoves(session.board, session.toMove, session.pendingJumpFrom);
}

export interface StepOutcome {
  readonly session: CheckersSession;
  readonly move: Move;
  /** False while the same piece must jump on — the turn is not over (§2). */
  readonly turnComplete: boolean;
  /** True when this step crowned a man, which the screen animates (§10). */
  readonly crowned: boolean;
}

const sameMove = (a: Move, b: Move): boolean =>
  a.from === b.from && a.to === b.to && a.captured === b.captured;

/**
 * The player plays one step (§2). Returns null when it is not the player's
 * turn or the step is not legal — including a quiet move offered while a
 * capture is available, which the capture obligation makes no move at all.
 */
export function applyPlayerStep(session: CheckersSession, move: Move): StepOutcome | null {
  if (session.status !== 'playing' || session.toMove !== PLAYER) return null;
  const legal = legalMoves(session.board, PLAYER, session.pendingJumpFrom);
  if (!legal.some((candidate) => sameMove(candidate, move))) return null;

  const outcome = applyStep(session.board, move);

  // Only the start of a turn is a decision point: a sequence is forced from
  // its second step on, so undo goes back past the whole thing (§5).
  const history =
    session.pendingJumpFrom === null
      ? [
          ...session.history,
          {
            board: session.board,
            moveCount: session.moveCount,
            quietPlies: session.quietPlies,
          },
        ]
      : [...session.history];
  if (history.length > UNDO_HISTORY_LIMIT) history.shift();

  if (outcome.continueFrom !== null) {
    return {
      session: {
        ...session,
        board: outcome.board,
        pendingJumpFrom: outcome.continueFrom,
        history,
      },
      move,
      turnComplete: false,
      crowned: outcome.promoted,
    };
  }

  const quietPlies = isQuietKingStep(session.board, move) ? session.quietPlies + 1 : 0;
  return {
    session: { ...settle(session, outcome.board, PLAYER, quietPlies), history },
    move,
    turnComplete: true,
    crowned: outcome.promoted,
  };
}

/**
 * The turn the CPU has decided on, as the steps it is made of (§4). Returns
 * null when it is not the CPU's turn, or when it has no legal move — which is
 * a loss, not a pass, and one `settle` has already recorded.
 *
 * A session restored in the middle of a forced sequence plans the rest of it
 * rather than a fresh turn (§8): the obligation survives the save, so the
 * piece that must jump on is the only one that may.
 */
export function planCpuTurn(session: CheckersSession): readonly Move[] | null {
  if (session.status !== 'playing' || session.toMove !== CPU) return null;
  const turn = chooseCpuTurn({
    board: session.board,
    side: CPU,
    difficulty: session.difficulty,
    seed: session.seed,
    moveCount: session.moveCount,
    continueFrom: session.pendingJumpFrom,
    quietPlies: session.quietPlies,
  });
  return turn === null ? null : turn.steps;
}

/**
 * Plays one step of a turn the CPU has already decided on. Separate from the
 * planning so the screen can show a capture sequence one jump at a time (§10)
 * while the rules stay in one place: `applyCpuTurn` is this in a loop, which
 * is what keeps the animated path and the golden test the same code.
 */
export function applyCpuStep(session: CheckersSession, move: Move): StepOutcome | null {
  if (session.status !== 'playing' || session.toMove !== CPU) return null;
  const legal = legalMoves(session.board, CPU, session.pendingJumpFrom);
  if (!legal.some((candidate) => sameMove(candidate, move))) return null;

  const outcome = applyStep(session.board, move);
  if (outcome.continueFrom !== null) {
    return {
      session: { ...session, board: outcome.board, pendingJumpFrom: outcome.continueFrom },
      move,
      turnComplete: false,
      crowned: outcome.promoted,
    };
  }

  const quietPlies = isQuietKingStep(session.board, move) ? session.quietPlies + 1 : 0;
  return {
    session: settle(session, outcome.board, CPU, quietPlies),
    move,
    turnComplete: true,
    crowned: outcome.promoted,
  };
}

export interface CpuTurnOutcome {
  readonly session: CheckersSession;
  /** Every step of the turn, in order, for the screen to play out (§10). */
  readonly steps: readonly Move[];
}

/**
 * The CPU takes its whole turn at once (§4) — planning it and playing every
 * step. The screen goes through `planCpuTurn` and `applyCpuStep` instead so
 * the jumps are visible; this is the same walk with no pauses in it.
 */
export function applyCpuTurn(session: CheckersSession): CpuTurnOutcome | null {
  const steps = planCpuTurn(session);
  if (steps === null) return null;

  let current = session;
  for (const step of steps) {
    const outcome = applyCpuStep(current, step);
    if (outcome === null) return null;
    current = outcome.session;
  }
  return { session: current, steps };
}

export function canUndo(session: CheckersSession): boolean {
  return session.history.length > 0;
}

/**
 * Takes the match back to the player's previous decision point (§5).
 * Returns null when there is nothing to take back.
 */
export function undo(session: CheckersSession): CheckersSession | null {
  const previous = session.history[session.history.length - 1];
  if (!previous) return null;
  return {
    ...session,
    board: previous.board,
    toMove: sideToMove(previous.moveCount, session.first),
    status: 'playing',
    pendingJumpFrom: null,
    history: session.history.slice(0, -1),
    moveCount: previous.moveCount,
    quietPlies: previous.quietPlies,
  };
}

/**
 * Restores a session from persisted state. The undo history does not survive
 * a save (§8), and neither does a finished match: a side that cannot move has
 * lost, so the loader can discard the position rather than resume it.
 *
 * The turn is derived rather than stored: turns strictly alternate, so the
 * completed-turn count and the stored opener say whose move it is between
 * them (§1, types.ts).
 */
export function restoreSession(
  data: Omit<CheckersSession, 'history' | 'status' | 'toMove'>,
): CheckersSession {
  const toMove = sideToMove(data.moveCount, data.first);
  const status: GameStatus = !hasAnyMove(data.board, toMove)
    ? toMove === PLAYER
      ? 'lost'
      : 'won'
    : data.quietPlies >= DRAW_QUIET_PLIES
      ? 'draw'
      : 'playing';
  return { ...data, toMove, status, history: [] };
}
