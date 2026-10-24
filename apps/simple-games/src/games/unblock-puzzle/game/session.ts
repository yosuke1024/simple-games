/**
 * UnblockSession — a pure, immutable snapshot of one board: the board as
 * dealt, its fewest-moves count, the moves played, the board those moves
 * lead to, and the counters kept for the result screen
 * (docs/UNBLOCK_PUZZLE_RULES.md).
 *
 * The move list is the whole history (§4, §6). The board on screen is always
 * the dealt board with every move replayed, so undo is one pop, reset is the
 * empty list, and a save that holds the list can be checked move by move
 * through the rules on the way back in (§12). The move count is the list's
 * length and nothing else — it cannot drift from the board.
 *
 * The clock lives outside. Elapsed seconds are carried in by whoever owns the
 * timer and handed back out for the result screen and the statistics — this
 * layer never reads one, which is what keeps a session a pure function of its
 * seed and its moves (§9).
 */
import { DAILY_DIFFICULTY, addDays, dailySeed } from './daily';
import { isLegalSlide, isSolved, isValidBoard, slideRange, type SlideRange } from './engine';
import {
  COMPONENT_LIMIT,
  TIERS,
  baseFor,
  dailyPuzzle,
  generatePuzzle,
  meetsBlockBounds,
  meetsTier,
} from './generator';
import { solve } from './search';
import { encodeBoard, replayMoves, type Move } from './serialize';
import {
  isDifficulty,
  type Block,
  type Board,
  type Difficulty,
  type GameMode,
  type GameStatus,
  type Slide,
} from './types';

/**
 * The most moves one board records (§4, §12). Far past any real game — a
 * move a second for nearly three hours — and what keeps a save to a bounded
 * size. At the limit a new move is refused; undo and reset still work.
 */
export const MOVE_LIMIT = 9_999;

/**
 * Boards the Hint and the save check may search (§6, §12). Every board dealt
 * comes from a component of at most COMPONENT_LIMIT boards, listed in full,
 * so a search from anywhere in it ends before this limit — the limit only
 * bites on a board nobody dealt.
 */
export const HINT_STATE_LIMIT = COMPONENT_LIMIT;

export interface UnblockSession {
  readonly mode: GameMode;
  readonly seed: string;
  readonly difficulty: Difficulty;
  /** Local YYYY-MM-DD in daily mode, null in Free Play. */
  readonly dailyDate: string | null;
  /** The board as dealt (§8). Reset returns here. */
  readonly start: Board;
  /** The fewest moves from `start` to the exit — exact (§8). */
  readonly minMoves: number;
  /** Every move so far, oldest first, consecutive slides of one block merged (§4). */
  readonly moves: readonly Move[];
  /** The board on screen: `start` with `moves` played. */
  readonly board: Board;
  readonly status: GameStatus;
  readonly elapsedSeconds: number;
  readonly hintCount: number;
}

/**
 * A token that makes one Free Play board's seed its own. Free Play has no
 * levels and no dates to seed from (§9), so a new board gets a new token —
 * while the seed still pins that board down completely.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const freeSeed = (difficulty: Difficulty, token: string): string =>
  `unblock-puzzle-${difficulty}-${token}`;

function baseSession(
  mode: GameMode,
  seed: string,
  difficulty: Difficulty,
  dailyDate: string | null,
): UnblockSession {
  const puzzle = dailyDate === null ? generatePuzzle(seed, difficulty) : dailyPuzzle(dailyDate);
  return {
    mode,
    seed,
    difficulty,
    dailyDate,
    start: puzzle.board,
    minMoves: puzzle.minMoves,
    moves: [],
    board: puzzle.board,
    status: 'playing',
    elapsedSeconds: 0,
    hintCount: 0,
  };
}

/** A fresh Free Play board — new unless a seed pins an old one (§9). */
export function createFreeSession(
  difficulty: Difficulty,
  seed: string = freeSeed(difficulty, newSeedToken()),
): UnblockSession {
  return baseSession('free', seed, difficulty, null);
}

/** A fresh daily board for a local YYYY-MM-DD date — medium every day (§9). */
export function createDailySession(dateString: string): UnblockSession {
  return baseSession('daily', dailySeed(dateString), DAILY_DIFFICULTY, dateString);
}

/**
 * The same board from the start (Reset, §6): no moves, a fresh clock and
 * hint count. Nothing is regenerated — the dealt board is already here.
 */
export function restartSession(session: UnblockSession): UnblockSession {
  return {
    ...session,
    moves: [],
    board: session.start,
    status: 'playing',
    elapsedSeconds: 0,
    hintCount: 0,
  };
}

/** Moves played — the list's length, merged slides counting once (§4). */
export const moveCount = (session: UnblockSession): number => session.moves.length;

/**
 * Cells moved (§4): each recorded move's distance from where it began to
 * where it ended, summed. A move continued back and forth counts its net
 * distance, and a move slid back to where it began counts nothing — it is no
 * longer a move. Read off the move list alone, so undo and a restored save
 * agree with it (§12).
 */
export const cellsMoved = (session: UnblockSession): number =>
  session.moves.reduce((sum, move) => sum + Math.abs(move.to - move.from), 0);

/** How far a block can slide right now, for drags and the arrow controls (§5). */
export const rangeOf = (session: UnblockSession, block: number): SlideRange =>
  slideRange(session.board, block);

/**
 * One slide (§4): block `block` to offset `to`, through free cells only.
 *
 * Sliding the block the last move slid continues that move rather than
 * starting a new one — the drag that pauses, the arrow key pressed three
 * times — and a continuation that puts the block back where its move began
 * takes the move away altogether. So the count is the number of times a
 * different block was picked up, which is what the fewest-moves count of §8
 * measures too.
 *
 * Null when nothing happens: an illegal slide, a slide to where the block
 * already is, a board already solved, or a new move past MOVE_LIMIT.
 * Refusing every move once solved is what makes the transition into it
 * happen exactly once — there is no path back to playing, not even by undo.
 */
export function doSlide(session: UnblockSession, block: number, to: number): UnblockSession | null {
  if (session.status !== 'playing') return null;
  if (!isLegalSlide(session.board, { block, to })) return null;
  const from = session.board.positions[block]!;
  const last = session.moves[session.moves.length - 1];
  let moves: Move[];
  if (last !== undefined && last.block === block) {
    moves = session.moves.slice(0, -1);
    if (to !== last.from) moves.push({ block, from: last.from, to });
  } else {
    if (session.moves.length >= MOVE_LIMIT) return null;
    moves = [...session.moves, { block, from, to }];
  }
  const positions = [...session.board.positions];
  positions[block] = to;
  const board: Board = { blocks: session.board.blocks, positions };
  return { ...session, moves, board, status: isSolved(board) ? 'solved' : 'playing' };
}

export const canUndo = (session: UnblockSession): boolean =>
  session.status === 'playing' && session.moves.length > 0;

/** Takes the last move back, whole (§6). The hint count stays where it is. */
export function doUndo(session: UnblockSession): UnblockSession | null {
  if (!canUndo(session)) return null;
  const last = session.moves[session.moves.length - 1]!;
  const positions = [...session.board.positions];
  positions[last.block] = last.from;
  return {
    ...session,
    moves: session.moves.slice(0, -1),
    board: { blocks: session.board.blocks, positions },
  };
}

export type Hint =
  /**
   * Slide `block` to `to`. It continues the move just made, starts a new move,
   * or puts the block just moved back where its move began — whichever ends
   * in the fewest moves (§6).
   */
  | {
      readonly kind: 'move';
      readonly block: number;
      readonly to: number;
      /**
       * Moves the count rises by, net, on the way out along the hints (§6):
       * following them ends at the moves made so far plus this — or fewer,
       * when a hint puts back a move and so reopens the one before it.
       */
      readonly remaining: number;
    }
  /**
   * No move to show. `capped`: the search stopped at its limit. `unsolvable`:
   * the search covered every reachable board and none is solved. `invalid`:
   * the board breaks a rule of §1, or `last` is not the move that led to it.
   * None of them happens on a board this game dealt (§6); all are worded
   * honestly.
   */
  | { readonly kind: 'none'; readonly reason: 'capped' | 'unsolvable' | 'invalid' };

/**
 * The Hint of §6 for a board, by a breadth-first search of at most
 * `stateLimit` boards — or why there is none. Null when the board is already
 * solved: there is nothing left to hint. The search is exact: the move it
 * names is never a guess, and a search that ran out of room says so rather
 * than naming one.
 *
 * Without `last`, the answer is the first move of a shortest solution from
 * the board, and `remaining` is that solution's length.
 *
 * With `last` — the move that led to the board, as the session records it —
 * the moves are counted the way play counts them (§4): sliding the block
 * `last` moved continues that move for nothing, and sliding it back to where
 * the move began takes the move away. So the search starts one board back,
 * from the board before `last`, and the way out ends at the count so far
 * minus one plus that board's fewest moves. The first move of the shortest
 * solution from there decides the hint, ties broken toward the player's own
 * play (`solve`'s `prefer`): when a shortest solution starts with `last`
 * itself, the hint is its next move, from the board on screen; when one
 * starts with another slide of the same block, the hint continues the move;
 * otherwise `last` is on no shortest way out, and the hint puts its block
 * back.
 */
export function findHint(
  board: Board,
  stateLimit: number = HINT_STATE_LIMIT,
  last?: Move,
): Hint | null {
  if (!isValidBoard(board)) return { kind: 'none', reason: 'invalid' };
  if (isSolved(board)) return null;
  const hint = (slide: Slide, remaining: number): Hint => ({
    kind: 'move',
    block: slide.block,
    to: slide.to,
    remaining,
  });
  if (last === undefined) {
    const result = solve(board, stateLimit);
    if (result.status !== 'solved') return { kind: 'none', reason: result.status };
    return hint(result.solution[0]!, result.minMoves);
  }
  const positions = [...board.positions];
  positions[last.block] = last.from;
  const before: Board = { blocks: board.blocks, positions };
  if (
    board.positions[last.block] !== last.to ||
    !isValidBoard(before) ||
    isSolved(before) ||
    !isLegalSlide(before, last)
  ) {
    return { kind: 'none', reason: 'invalid' };
  }
  const result = solve(before, stateLimit, last);
  if (result.status !== 'solved') return { kind: 'none', reason: result.status };
  const remaining = result.minMoves - 1;
  const first = result.solution[0]!;
  if (first.block !== last.block) return hint({ block: last.block, to: last.from }, remaining);
  // `before` is one move from `board`, which is not solved, so a solution that
  // passes through `board` has a move after it.
  if (first.to === last.to) return hint(result.solution[1]!, remaining);
  return hint(first, remaining);
}

/**
 * The Hint of §6 for the session as it is now: a fresh search every time, so
 * it answers for the player's own position, detours and all, counting moves
 * the way the session counts them. Free and unlimited; it never moves
 * anything. Null once the board is solved.
 */
export function hintFor(session: UnblockSession): Hint | null {
  if (session.status !== 'playing') return null;
  return findHint(session.board, HINT_STATE_LIMIT, session.moves[session.moves.length - 1]);
}

/** Hints are counted for the result screen, never limited or charged for. */
export const doHintUse = (session: UnblockSession): UnblockSession => ({
  ...session,
  hintCount: session.hintCount + 1,
});

/** A count of whole seconds: finite, whole, not negative. */
const isSeconds = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/**
 * Carries the owner's running clock into the record, on the way to a save or
 * to the result screen (§10). Seconds only ever move forward, so a clock that
 * came back smaller after a restore is ignored rather than trusted — and so
 * is one that is not a number of seconds at all (NaN, infinite, negative): a
 * single NaN let through would stay NaN through every later maximum. A
 * session holding such a value already counts from 0.
 */
export function withElapsedSeconds(session: UnblockSession, seconds: number): UnblockSession {
  const held = isSeconds(session.elapsedSeconds) ? session.elapsedSeconds : 0;
  const offered = Number.isFinite(seconds) && seconds >= 0 ? Math.floor(seconds) : 0;
  const next = Math.max(held, Number.isSafeInteger(offered) ? offered : 0);
  return next === session.elapsedSeconds ? session : { ...session, elapsedSeconds: next };
}

/**
 * Whether a starting board is one this game could have dealt at a difficulty
 * (§12): a legal board, not already solved, inside the tier's block bounds,
 * whose fewest moves — proved by a fresh search, not read from the record —
 * are exactly `minMoves` and fall in the tier on both measures (§7). A record
 * that fails was not dealt here. One forward search of at most
 * HINT_STATE_LIMIT boards: the cost of one Hint.
 */
export function isDealtBoard(start: Board, minMoves: number, difficulty: Difficulty): boolean {
  if (!isValidBoard(start) || isSolved(start)) return false;
  if (!meetsBlockBounds(TIERS[difficulty], start)) return false;
  const result = solve(start, HINT_STATE_LIMIT);
  if (result.status !== 'solved' || result.minMoves !== minMoves) return false;
  return meetsTier(TIERS[difficulty], result.minMoves, result.exploredStates);
}

/**
 * Whether a starting board and its fewest moves are exactly a bundled board
 * (§8, §12) — every one of which catalogue.test.ts has proved legal,
 * unsolved, exact and in its tier — so a record that holds one needs no
 * search to be believed. A string comparison, not a search.
 */
const isBundled = (start: Board, minMoves: number, bundled: { board: Board; minMoves: number }) =>
  minMoves === bundled.minMoves && encodeBoard(start) === encodeBoard(bundled.board);

export interface SessionRecord {
  readonly mode: GameMode;
  readonly seed: string;
  readonly difficulty: Difficulty;
  readonly dailyDate: string | null;
  readonly start: Board;
  readonly minMoves: number;
  /** The move list as `encodeMoves` writes it (§12). */
  readonly moves: string;
  readonly elapsedSeconds: number;
  readonly hintCount: number;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** A block description of the right shape — `isValidBlock` then reads its values. */
const isBlockShape = (value: unknown): value is Block =>
  isObject(value) &&
  typeof value.orientation === 'string' &&
  typeof value.length === 'number' &&
  typeof value.lane === 'number';

/** A board of the right shape — `isValidBoard` then reads its rules. */
const isBoardShape = (value: unknown): value is Board =>
  isObject(value) &&
  Array.isArray(value.blocks) &&
  Array.isArray(value.positions) &&
  value.blocks.every(isBlockShape) &&
  value.positions.every((position) => typeof position === 'number');

/** A real local calendar date written YYYY-MM-DD. */
const isDateString = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && addDays(value, 0) === value;

/**
 * Rebuilds a session from what a save holds (§12), or null when the record
 * is not one play could have produced — and it never throws, whatever the
 * record holds:
 *
 * - a field of the wrong type or range: a mode other than free / daily, a
 *   difficulty this game does not have, an empty seed, a start that is not a
 *   board, a count of seconds or hints that is not a whole number ≥ 0;
 * - a daily without a real date, a Free Play board with one, a daily that is
 *   not medium;
 * - a seed that is not of its mode's form — a daily's must be its date's
 *   (`dailySeed`), a Free Play board's must name its difficulty (`freeSeed`);
 * - a daily whose starting board or fewest moves is not exactly the bundled
 *   board its date deals: the daily is the same board for everyone (§9,
 *   §10), and finding that day's board is a lookup;
 * - a Free Play starting board this game would not deal at that difficulty:
 *   the seed's bundled board as it is passes at once (catalogue.test.ts has
 *   proved every one), anything else must pass `isDealtBoard` — one bounded
 *   forward search;
 * - a move list that does not replay;
 * - a game already won: the replayed board is solved, and a finished game is
 *   a result, not something to resume.
 *
 * The status is never read from the record; a restored session is always in
 * play.
 */
export function restoreSession(record: SessionRecord): UnblockSession | null {
  const raw: unknown = record;
  if (!isObject(raw)) return null;
  const { mode, seed, difficulty, dailyDate, start, minMoves, moves, elapsedSeconds, hintCount } =
    raw;
  if (mode !== 'free' && mode !== 'daily') return null;
  if (!isDifficulty(difficulty) || typeof seed !== 'string' || seed.length === 0) return null;
  if (!isBoardShape(start) || typeof moves !== 'string') return null;
  if (typeof minMoves !== 'number' || !Number.isSafeInteger(minMoves) || minMoves < 1) return null;
  if (!isSeconds(elapsedSeconds) || !isSeconds(hintCount)) return null;
  let date: string | null = null;
  if (mode === 'daily') {
    if (!isDateString(dailyDate) || difficulty !== DAILY_DIFFICULTY) return null;
    if (seed !== dailySeed(dailyDate)) return null;
    date = dailyDate;
  } else {
    if (dailyDate !== null) return null;
    const prefix = `unblock-puzzle-${difficulty}-`;
    if (!seed.startsWith(prefix) || seed.length === prefix.length) return null;
  }
  if (date !== null) {
    // The daily is one bundled board, the same for everyone (§9, §10): the
    // record must hold exactly that board — a lookup, not a deal or a search.
    if (!isValidBoard(start) || !isBundled(start, minMoves, dailyPuzzle(date))) return null;
  } else if (!isValidBoard(start) || !isBundled(start, minMoves, baseFor(seed, difficulty))) {
    // Not the seed's bundled board as it is (an Easy or Medium board changed
    // on the tap, or a board from an earlier version of the generator): one
    // bounded forward search proves it instead.
    if (!isDealtBoard(start, minMoves, difficulty)) return null;
  }
  const replayed = replayMoves(moves, start, MOVE_LIMIT);
  if (replayed === null || isSolved(replayed.board)) return null;
  return {
    mode,
    seed,
    difficulty,
    dailyDate: date,
    start,
    minMoves,
    moves: replayed.moves,
    board: replayed.board,
    status: 'playing',
    elapsedSeconds,
    hintCount,
  };
}
