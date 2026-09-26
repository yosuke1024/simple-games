/**
 * MancalaSession — a pure, immutable snapshot of one match in progress:
 * board + whose turn + undo history. The React layer only dispatches into
 * these functions; all rules live here, in engine.ts and in cpu.ts.
 *
 * The turn is carried, not derived: a move that ends in the mover's own
 * store is followed by the same side moving again (§2.1), so the alternation
 * breaks and the board alone cannot say whose move it is (§8).
 *
 * Undo is the one help this title offers, and it is free and unlimited (§5).
 * It steps back to the player's previous decision point — the CPU's replies,
 * a chain of extra turns included, come off with the player's move, because
 * a position mid-CPU-turn is not a place a player ever decided anything. It
 * is a take-back, not a reroll: the CPU's choice is decided by the seed and
 * the move count (§4), so putting the board back and sowing the same pit
 * brings the same reply.
 *
 * There is no clock on screen (§10); elapsed seconds are carried here for
 * the statistics only.
 */
import { chooseCpuMove } from './cpu';
import { isGameOver, sow, storeCounts, sweepRemaining, type SowOutcome } from './engine';
import {
  CPU,
  initialPits,
  opponentOf,
  PLAYER,
  type Difficulty,
  type GameStatus,
  type Pits,
  type Side,
} from './types';

/** Practically unlimited undo; a match is rarely longer than 60 moves (§5). */
export const UNDO_HISTORY_LIMIT = 100;

/** One decision point: the position the player sowed from. */
export interface HistoryEntry {
  readonly pits: Pits;
  readonly toMove: Side;
  readonly moveCount: number;
}

/** What the last move did, for the screen's highlight, marks and sounds (§10). */
export interface LastMove {
  readonly by: Side;
  /** The pit the seeds were lifted from. */
  readonly pit: number;
  /** Every index that received a seed, in order (engine.ts `sow`). */
  readonly touched: readonly number[];
  /** Seeds a capture took into the mover's store, or 0 (§2.2). */
  readonly captured: number;
  /** Where the last seed landed — with `captured`, where the capture happened. */
  readonly lastIndex: number;
  /** Identity: the move counter after this move. One screen effect per move. */
  readonly moveCount: number;
}

export interface MancalaSession {
  readonly seed: string;
  readonly difficulty: Difficulty;
  /** Who opened this match — the player's choice, taken before the first move (§1). */
  readonly first: Side;
  readonly pits: Pits;
  /** Whose turn it is. Stored, because extra turns break the alternation (§2.1, §8). */
  readonly toMove: Side;
  /** From the player's side of the table: 'won' means the player did (§3). */
  readonly status: GameStatus;
  /** The move just played, or null when the board arrived rather than played out. */
  readonly lastMove: LastMove | null;
  /** Snapshots taken before each of the player's moves, oldest first (§5). */
  readonly history: readonly HistoryEntry[];
  /** Moves played this match, by either side. The CPU draw's second half (§4). */
  readonly moveCount: number;
  readonly elapsedSeconds: number;
}

/**
 * A token that makes one match's seed its own. There are no levels and no
 * dates to seed from, so every new match gets a new one — while the seed
 * still pins the CPU down completely, which is what §5 rests on.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const matchSeed = (token: string): string => `mancala-${token}`;

/**
 * A fresh match. `first` is the player's choice of side (§1); the CPU opening
 * means the session starts on the CPU's turn, which the screen plays out the
 * same way it plays out any other CPU turn.
 */
export function createSession(
  difficulty: Difficulty,
  first: Side = PLAYER,
  seed: string = matchSeed(newSeedToken()),
): MancalaSession {
  return {
    seed,
    difficulty,
    first,
    pits: initialPits(),
    toMove: first,
    status: 'playing',
    lastMove: null,
    history: [],
    moveCount: 0,
    elapsedSeconds: 0,
  };
}

/** The result a finished board stands at, from the player's side (§3). */
function resultOf(pits: Pits): GameStatus {
  const { player, cpu } = storeCounts(pits);
  return player > cpu ? 'won' : player < cpu ? 'lost' : 'draw';
}

/**
 * What one sowing makes of the match (§2, §3): the same side again after an
 * extra turn, the other side otherwise — and if either row is now empty, the
 * sweep and the result, whatever turn was coming.
 */
function settle(
  session: MancalaSession,
  mover: Side,
  pit: number,
  move: SowOutcome,
): MancalaSession {
  const moveCount = session.moveCount + 1;
  const lastMove: LastMove = {
    by: mover,
    pit,
    touched: move.touched,
    captured: move.captured,
    lastIndex: move.lastIndex,
    moveCount,
  };
  const toMove = move.extraTurn ? mover : opponentOf(mover);
  if (isGameOver(move.pits)) {
    const pits = sweepRemaining(move.pits);
    return { ...session, pits, toMove, status: resultOf(pits), lastMove, moveCount };
  }
  return { ...session, pits: move.pits, toMove, status: 'playing', lastMove, moveCount };
}

/**
 * The player sows a pit (§2). Null when it is not the player's turn, or the
 * pit is not theirs or is empty — the rules offer nothing there, silently.
 */
export function applyPlayerMove(session: MancalaSession, pit: number): MancalaSession | null {
  if (session.status !== 'playing' || session.toMove !== PLAYER) return null;
  const move = sow(session.pits, PLAYER, pit);
  if (move === null) return null;

  const history = [
    ...session.history,
    { pits: session.pits, toMove: session.toMove, moveCount: session.moveCount },
  ];
  if (history.length > UNDO_HISTORY_LIMIT) history.shift();

  return { ...settle(session, PLAYER, pit, move), history };
}

/**
 * The CPU takes one move of its turn (§4) — one sowing; an extra turn is a
 * second call, on its own beat. Null when it is not the CPU's turn: the caller
 * schedules this off the session state, and a stale schedule must land as
 * nothing.
 */
export function applyCpuMove(session: MancalaSession): MancalaSession | null {
  if (session.status !== 'playing' || session.toMove !== CPU) return null;
  const pit = chooseCpuMove({
    pits: session.pits,
    difficulty: session.difficulty,
    seed: session.seed,
    moveCount: session.moveCount,
  });
  const move = sow(session.pits, CPU, pit)!;
  return settle(session, CPU, pit, move);
}

export function canUndo(session: MancalaSession): boolean {
  return session.history.length > 0;
}

/**
 * Takes the match back to the player's previous decision point (§5).
 * Returns null when there is nothing to take back.
 */
export function undo(session: MancalaSession): MancalaSession | null {
  const previous = session.history[session.history.length - 1];
  if (!previous) return null;
  return {
    ...session,
    pits: previous.pits,
    toMove: previous.toMove,
    status: 'playing',
    lastMove: null,
    history: session.history.slice(0, -1),
    moveCount: previous.moveCount,
  };
}

/**
 * Restores a session from persisted state. The undo history does not survive
 * a save (§8), and neither does a finished match: a board with an empty row
 * is settled here — swept and scored — so the loader can see it is over and
 * discard it.
 */
export function restoreSession(
  data: Omit<MancalaSession, 'history' | 'status' | 'lastMove'>,
): MancalaSession {
  if (isGameOver(data.pits)) {
    const pits = sweepRemaining(data.pits);
    return { ...data, pits, status: resultOf(pits), lastMove: null, history: [] };
  }
  return { ...data, status: 'playing', lastMove: null, history: [] };
}
