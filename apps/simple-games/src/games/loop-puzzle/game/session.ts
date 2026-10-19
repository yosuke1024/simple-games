/**
 * LoopPuzzleSession — a pure, immutable snapshot of one puzzle: the clues,
 * the answer, the player's marks, the undo history, and the counters kept
 * for the result screen (docs/LOOP_PUZZLE_RULES.md).
 *
 * One tap is one step (§4, §6). The history holds the edge each step changed
 * and the mark it had before, lives on the session, and is never persisted
 * (§12). Nor is what the hints have said so far (`hinted`, `lastHint` — §6).
 *
 * The clock lives outside. Elapsed seconds are carried in by whoever owns the
 * timer and handed back out for the result screen and the statistics — this
 * layer never reads one, nor any randomness: a new game's token is minted by
 * the caller from the time and a random number it passes in. That is what
 * keeps a session a pure function of its seed and the player's taps (§9).
 */
import { DAILY_DIFFICULTY, dailySeed } from './daily';
import {
  cycleEdge,
  emptyMarks,
  findConflicts,
  isSolved,
  metClues,
  setEdge,
  type Conflicts,
} from './engine';
import { generatePuzzle } from './generator';
import { findHint, hintEdge, hintMark, sameHint, type Hint } from './solver';
import {
  CROSS,
  type Clue,
  type Difficulty,
  type GameMode,
  type GameStatus,
  type Mark,
  type Marks,
} from './types';

/**
 * How many steps back the player can go (§6). Undo is unlimited in play;
 * the cap only keeps a session that somehow runs forever from growing
 * without bound — a 6×6 board has 84 edges, and this is fifty-nine taps on
 * each.
 */
export const UNDO_HISTORY_LIMIT = 5000;

/**
 * The largest elapsed time and hint count a record may hold (§12) — what the
 * save schema accepts. The counters stop here rather than grow into a value
 * the schema would refuse, which would drop the suspended game.
 */
export const ELAPSED_SECONDS_MAX = 1e9;
export const HINT_COUNT_MAX = 1e6;

/** One step: the edge that changed and the mark it had before. */
export interface Step {
  readonly edge: number;
  readonly before: Mark;
}

export interface LoopPuzzleSession {
  readonly mode: GameMode;
  readonly seed: string;
  readonly difficulty: Difficulty;
  /** Local YYYY-MM-DD in daily mode, null in difficulty mode. */
  readonly dailyDate: string | null;
  readonly width: number;
  readonly height: number;
  readonly clues: readonly Clue[];
  /** The one answer: LINE on the loop, CROSS elsewhere (§8). */
  readonly solution: readonly Mark[];
  /** What the player has written, one mark per edge. */
  readonly marks: Marks;
  /** Steps taken, oldest first. Not persisted (§12). */
  readonly history: readonly Step[];
  readonly status: GameStatus;
  readonly elapsedSeconds: number;
  readonly hintCount: number;
  /**
   * Edges a hint has shown must be CROSS, in the order shown (§6). Every
   * later hint reads them as written, whether or not the player wrote them —
   * a CROSS is a note, never a chore — so no hint asks for the same CROSS
   * twice. Not persisted (§12).
   */
  readonly hinted: readonly number[];
  /** The hint given since the marks last changed, or null (§6: asked again, counted once). Not persisted. */
  readonly lastHint: Hint | null;
}

/**
 * A token that makes one difficulty game's seed its own. Difficulty mode has
 * no levels and no dates to seed from (§9), so a new game gets a new board —
 * while the seed still pins that board down completely. The caller passes
 * the time and the random source (the state layer: `Date.now()` and
 * `Math.random`); nothing in game/ reads either.
 */
export function newSeedToken(now: number, random: () => number): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const difficultySeed = (difficulty: Difficulty, token: string): string =>
  `loop-puzzle-${difficulty}-${token}`;

function baseSession(
  mode: GameMode,
  seed: string,
  difficulty: Difficulty,
  dailyDate: string | null,
): LoopPuzzleSession {
  const puzzle = generatePuzzle(seed, difficulty);
  return {
    mode,
    seed,
    difficulty,
    dailyDate,
    width: puzzle.width,
    height: puzzle.height,
    clues: puzzle.clues,
    solution: puzzle.solution,
    marks: emptyMarks(puzzle),
    history: [],
    status: 'playing',
    elapsedSeconds: 0,
    hintCount: 0,
    hinted: [],
    lastHint: null,
  };
}

/**
 * A fresh difficulty game from its seed (§9) — for a new board,
 * `difficultySeed(difficulty, newSeedToken(now, random))`.
 */
export function createDifficultySession(difficulty: Difficulty, seed: string): LoopPuzzleSession {
  return baseSession('difficulty', seed, difficulty, null);
}

/** A fresh daily game for a local YYYY-MM-DD date — medium every day (§9). */
export function createDailySession(dateString: string): LoopPuzzleSession {
  return baseSession('daily', dailySeed(dateString), DAILY_DIFFICULTY, dateString);
}

/**
 * The same board from scratch (Retry, §9): the clues and the answer this
 * session already holds, with a clean board, an empty history, and the clock
 * and the hint count at zero. Nothing is generated, so no search runs — and
 * the board is the one that was played even when it came from a save and
 * the generator has changed since (§12).
 */
export function restartSession(session: LoopPuzzleSession): LoopPuzzleSession {
  return {
    ...session,
    marks: emptyMarks(session),
    history: [],
    status: 'playing',
    elapsedSeconds: 0,
    hintCount: 0,
    hinted: [],
    lastHint: null,
  };
}

/**
 * Restores a session from persisted state (§12) — the board as decoded and
 * checked by `decodeBoard`, which re-derives the solution. The win is
 * re-derived from the marks rather than restored: a saved status is one
 * more thing that can be wrong, and §3 is cheap to evaluate. History starts
 * empty, and so does what the hints have said.
 */
export function restoreSession(
  data: Omit<LoopPuzzleSession, 'history' | 'status' | 'hinted' | 'lastHint'>,
): LoopPuzzleSession {
  return {
    ...data,
    history: [],
    status: isSolved(data, data.marks) ? 'solved' : 'playing',
    hinted: [],
    lastHint: null,
  };
}

function withMarks(session: LoopPuzzleSession, marks: Marks, step: Step): LoopPuzzleSession {
  let history = [...session.history, step];
  if (history.length > UNDO_HISTORY_LIMIT) history = history.slice(1);
  return {
    ...session,
    marks,
    history,
    status: isSolved(session, marks) ? 'solved' : 'playing',
    lastHint: null,
  };
}

/**
 * One tap on an edge (§4): UNKNOWN → LINE → CROSS → UNKNOWN. Null when the
 * edge does not exist or the board is solved.
 *
 * Refusing every move once the status is 'solved' is what makes the
 * transition into it happen exactly once: there is no path from solved back
 * to playing — not even by undo — so the caller can book the completion on
 * the edge and never again.
 */
export function doCycle(session: LoopPuzzleSession, edge: number): LoopPuzzleSession | null {
  if (session.status !== 'playing') return null;
  const next = cycleEdge(session.marks, edge);
  return next === null ? null : withMarks(session, next, { edge, before: session.marks[edge]! });
}

/**
 * Writes one mark directly (§4 — the keyboard's LINE / CROSS / clear keys).
 * Null when nothing changes, the edge does not exist, or the board is solved.
 */
export function doSet(
  session: LoopPuzzleSession,
  edge: number,
  mark: Mark,
): LoopPuzzleSession | null {
  if (session.status !== 'playing') return null;
  const next = setEdge(session.marks, edge, mark);
  return next === null ? null : withMarks(session, next, { edge, before: session.marks[edge]! });
}

export const canUndo = (session: LoopPuzzleSession): boolean =>
  session.status === 'playing' && session.history.length > 0;

/** Reverts the last step (§6). The hint count stays where it is. */
export function doUndo(session: LoopPuzzleSession): LoopPuzzleSession | null {
  if (!canUndo(session)) return null;
  const step = session.history[session.history.length - 1]!;
  const marks = [...session.marks];
  marks[step.edge] = step.before;
  return { ...session, marks, history: session.history.slice(0, -1), lastHint: null };
}

/** What the marks currently break, for the always-on display (§5). */
export const conflictsOf = (session: LoopPuzzleSession): Conflicts =>
  findConflicts(session, session.marks);

/** The numbers met right now, shown quietly (§5). */
export const metCluesOf = (session: LoopPuzzleSession): boolean[] =>
  metClues(session, session.marks);

/**
 * The hint of §6 — a mark that disagrees with the answer, else the next
 * deduction from the player's own board (with every CROSS a hint has already
 * shown read as written), else one edge of the answer. Free and unlimited;
 * never writes to the board.
 */
export function hintFor(session: LoopPuzzleSession): Hint | null {
  if (session.status !== 'playing') return null;
  return findHint(session, session.solution, session.marks, session.hinted);
}

/**
 * One tap on Hint (§6): the hint, and the session after giving it.
 *
 * - A CROSS it shows joins `hinted`, so the next hint moves on from it
 *   rather than asking for it again — the player may or may not write it.
 * - It is counted once. Asking again with nothing changed gives the same
 *   hint (a LINE, or a wrong mark, waits for the player) and does not count
 *   it a second time; a hint after a CROSS is a new one and counts.
 * - Nothing to say (null) changes nothing.
 */
export function askHint(session: LoopPuzzleSession): {
  readonly session: LoopPuzzleSession;
  readonly hint: Hint | null;
} {
  const hint = hintFor(session);
  if (hint === null) return { session, hint };
  if (session.lastHint !== null && sameHint(session.lastHint, hint)) return { session, hint };
  const edge = hintEdge(hint);
  const crossed = hint.kind !== 'wrong' && hintMark(hint) === CROSS;
  const hinted =
    crossed && !session.hinted.includes(edge) ? [...session.hinted, edge] : session.hinted;
  return { session: { ...doHintUse(session), hinted, lastHint: hint }, hint };
}

/**
 * Hints are counted for the result screen, never limited or charged for. The
 * count stops at HINT_COUNT_MAX — a number no game reaches — so a save always
 * holds one the schema accepts (§12).
 */
export const doHintUse = (session: LoopPuzzleSession): LoopPuzzleSession => ({
  ...session,
  hintCount: Math.min(HINT_COUNT_MAX, session.hintCount + 1),
});

/**
 * Carries the owner's running clock into the record, on the way to a save or
 * to the result screen (§10). Seconds only ever move forward, so a clock that
 * came back smaller after a restore is ignored rather than trusted; a value
 * that is not a finite number (NaN, Infinity) is ignored too, and the count
 * stops at ELAPSED_SECONDS_MAX — either would otherwise reach a save the
 * schema refuses (§12) and cost the player the suspended game.
 */
export function withElapsedSeconds(session: LoopPuzzleSession, seconds: number): LoopPuzzleSession {
  if (!Number.isFinite(seconds)) return session;
  const next = Math.min(ELAPSED_SECONDS_MAX, Math.max(session.elapsedSeconds, Math.floor(seconds)));
  return next === session.elapsedSeconds ? session : { ...session, elapsedSeconds: next };
}
