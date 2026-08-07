/**
 * ReversiSession — a pure, immutable snapshot of one match in progress: board
 * + whose turn + undo history. The React layer only dispatches into these
 * functions; all rules live here, in engine.ts and in cpu.ts.
 *
 * Undo is one of this title's two helps, and it is free and unlimited (§6).
 * It steps back to the player's previous decision point — the CPU's reply and
 * the passes between come off together, because a position mid-CPU-turn is
 * not a place a player ever decided anything. It is a take-back, not a
 * reroll: the CPU's choice is decided by the seed and the move count (§5), so
 * putting the board back and playing the same disc brings the same reply.
 *
 * There is no clock on screen (§11); elapsed seconds are carried here for the
 * statistics only.
 */
import { hasAnyMove, placeDisc } from './engine';
import { chooseCpuMove } from './cpu';
import {
  countDiscs,
  FIRST_MOVE,
  initialBoard,
  opponentOf,
  type Board,
  type Difficulty,
  type GameStatus,
  type Player,
} from './types';

/** Practically unlimited undo; a match is at most sixty moves (§6). */
export const UNDO_HISTORY_LIMIT = 200;

/** One decision point: the position the player moved from. */
export interface HistoryEntry {
  readonly board: Board;
  readonly moveCount: number;
}

export interface ReversiSession {
  readonly seed: string;
  readonly difficulty: Difficulty;
  /**
   * The colour the player holds this match (§1). Black opens, so this is
   * also the choice of moving first or second — there is nothing else to
   * pick. The CPU holds the other colour; `cpuColorOf` is the only place
   * that says so.
   */
  readonly playerColor: Player;
  readonly board: Board;
  /** Whose turn it is. Meaningless once the status is terminal. */
  readonly toMove: Player;
  /** From the player's side of the table: 'won' means the player did (§3). */
  readonly status: GameStatus;
  /** Snapshots taken before each of the player's moves, oldest first. */
  readonly history: readonly HistoryEntry[];
  /** Discs placed this match, by either side. The CPU draw's second half (§5). */
  readonly moveCount: number;
  readonly elapsedSeconds: number;
}

/**
 * A token that makes one match's seed its own. There are no levels and no
 * dates to seed from, so every new match gets a new deal — while the seed
 * still pins the CPU down completely, which is what §6 rests on.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const matchSeed = (token: string): string => `reversi-${token}`;

/** The colour the CPU holds: whichever one the player did not take (§1). */
export const cpuColorOf = (session: ReversiSession): Player => opponentOf(session.playerColor);

/**
 * A fresh match. `playerColor` is the player's choice of side (§1); taking
 * white means black opens, so the session starts on the CPU's turn and the
 * screen plays it out the same way it plays out any other CPU turn.
 */
export function createSession(
  difficulty: Difficulty,
  playerColor: Player = FIRST_MOVE,
  seed: string = matchSeed(newSeedToken()),
): ReversiSession {
  return {
    seed,
    difficulty,
    playerColor,
    board: initialBoard(),
    toMove: FIRST_MOVE,
    status: 'playing',
    history: [],
    moveCount: 0,
    elapsedSeconds: 0,
  };
}

/**
 * The match's verdict once neither side can move: count the discs (§3). Said
 * from the player's side of the table, so it depends on the colour they took.
 */
function verdictOf(board: Board, playerColor: Player): GameStatus {
  const { black, white } = countDiscs(board);
  const mine = playerColor === FIRST_MOVE ? black : white;
  const theirs = playerColor === FIRST_MOVE ? white : black;
  if (mine > theirs) return 'won';
  if (theirs > mine) return 'lost';
  return 'draw';
}

interface TurnResolution {
  readonly toMove: Player;
  readonly status: GameStatus;
  /** The side whose turn was skipped, or null when nobody passed (§4). */
  readonly passed: Player | null;
}

/**
 * Who moves after `mover` placed a disc: the opponent if they can, the mover
 * again if only the opponent is stuck (an automatic pass, §4), and nobody
 * when the match is over (§3).
 */
function resolveNextTurn(board: Board, mover: Player, playerColor: Player): TurnResolution {
  const opponent = opponentOf(mover);
  if (hasAnyMove(board, opponent)) return { toMove: opponent, status: 'playing', passed: null };
  if (hasAnyMove(board, mover)) return { toMove: mover, status: 'playing', passed: opponent };
  return { toMove: opponent, status: verdictOf(board, playerColor), passed: null };
}

export interface MoveOutcome {
  readonly session: ReversiSession;
  /** The cell the disc landed on, for the screen's last-move mark (§11). */
  readonly placed: number;
  /** The discs the move turned, for the flip animation (§11). */
  readonly flipped: readonly number[];
  /** The side whose turn the move skipped, or null (§4). */
  readonly passed: Player | null;
}

/**
 * The player places a disc (§2). Returns null when it is not the player's
 * turn or the cell is not a legal move — the screen only enables legal cells,
 * so an illegal tap is nothing, silently.
 */
export function applyPlayerMove(session: ReversiSession, cell: number): MoveOutcome | null {
  const me = session.playerColor;
  if (session.status !== 'playing' || session.toMove !== me) return null;
  const placed = placeDisc(session.board, me, cell);
  if (placed === null) return null;

  const history = [...session.history, { board: session.board, moveCount: session.moveCount }];
  if (history.length > UNDO_HISTORY_LIMIT) history.shift();

  const turn = resolveNextTurn(placed.board, me, me);
  return {
    session: {
      ...session,
      board: placed.board,
      toMove: turn.toMove,
      status: turn.status,
      history,
      moveCount: session.moveCount + 1,
    },
    placed: cell,
    flipped: placed.flipped,
    passed: turn.passed,
  };
}

/**
 * The CPU takes its turn (§5). Returns null when it is not the CPU's turn —
 * the caller schedules this off the session state, and a stale schedule must
 * land as nothing.
 */
export function applyCpuMove(session: ReversiSession): MoveOutcome | null {
  const cpu = cpuColorOf(session);
  if (session.status !== 'playing' || session.toMove !== cpu) return null;
  const cell = chooseCpuMove({
    board: session.board,
    player: cpu,
    difficulty: session.difficulty,
    seed: session.seed,
    moveCount: session.moveCount,
  });
  // A CPU with no move never gets the turn: the pass already happened when
  // the turn was resolved (§4). Null here would mean the session lied.
  if (cell === null) return null;
  const placed = placeDisc(session.board, cpu, cell)!;

  const turn = resolveNextTurn(placed.board, cpu, session.playerColor);
  return {
    session: {
      ...session,
      board: placed.board,
      toMove: turn.toMove,
      status: turn.status,
      moveCount: session.moveCount + 1,
    },
    placed: cell,
    flipped: placed.flipped,
    passed: turn.passed,
  };
}

export function canUndo(session: ReversiSession): boolean {
  return session.history.length > 0;
}

/**
 * Takes the match back to the player's previous decision point (§6). Returns
 * null when there is nothing to take back.
 */
export function undo(session: ReversiSession): ReversiSession | null {
  const previous = session.history[session.history.length - 1];
  if (!previous) return null;
  return {
    ...session,
    board: previous.board,
    toMove: session.playerColor,
    status: 'playing',
    history: session.history.slice(0, -1),
    moveCount: previous.moveCount,
  };
}

/**
 * Restores a session from persisted state. The undo history does not survive
 * a save (§9): a resumed match starts from the position it was saved in.
 *
 * The stored turn is normalised rather than trusted: a side with no move
 * never holds the turn in a live session (§4), and a finished board gets its
 * verdict back so the loader can discard it (§9).
 */
export function restoreSession(data: Omit<ReversiSession, 'history' | 'status'>): ReversiSession {
  let toMove = data.toMove;
  let status: GameStatus = 'playing';
  if (!hasAnyMove(data.board, toMove)) {
    const opponent = opponentOf(toMove);
    if (hasAnyMove(data.board, opponent)) toMove = opponent;
    else status = verdictOf(data.board, data.playerColor);
  }
  return { ...data, toMove, status, history: [] };
}
