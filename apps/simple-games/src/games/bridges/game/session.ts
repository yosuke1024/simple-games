/**
 * BridgesSession — a pure, immutable snapshot of one puzzle: the islands,
 * the one answer, what the player has built, the undo history, and the
 * counters kept for the result screen (docs/BRIDGES_RULES.md).
 *
 * Undo exists here (§9) because the cycle 0 → 1 → 2 → 0 cannot step back:
 * taking one bridge off a double means going round through zero, and a
 * bridge taken away may have been what unblocked the way for another. One
 * tap on a pair is one step; the history lives on the session and is never
 * persisted (§10).
 *
 * The clock lives outside. Elapsed seconds are carried in by whoever owns the
 * timer and handed back out for the result screen and the statistics — this
 * layer never reads one, which is what keeps a session a pure function of
 * its seed (§8).
 *
 * `graph` is derived from the layout and never persisted: a restore rebuilds
 * it from the board (§10), so it cannot disagree with the islands.
 */
import { DAILY_DIFFICULTY, dailySeed } from './daily';
import {
  boardFacts,
  buildGraph,
  candidatesOf,
  cycleBridge,
  edgeBetween,
  emptyBridges,
  isSolved,
  type BoardFacts,
  type Graph,
} from './engine';
import { generatePuzzle } from './generator';
import { decodeBoards, encodeBoard, encodeBridges } from './serialize';
import { SEARCH_NODE_LIMIT, countSolutions, findHint, type Hint } from './solver';
import {
  PRESETS,
  isDifficulty,
  type Bridges,
  type Difficulty,
  type GameMode,
  type GameStatus,
  type Island,
} from './types';

/**
 * How many steps back the player can go. A real game never comes close; the
 * cap exists so a session that somehow runs forever cannot grow without bound.
 */
export const UNDO_HISTORY_LIMIT = 500;

/** The ceiling of the record's counters — hints and seconds (§10). */
const MAX_COUNTER = 1e9;

export interface BridgesSession {
  readonly mode: GameMode;
  readonly seed: string;
  readonly difficulty: Difficulty;
  /** Local YYYY-MM-DD in daily mode, null in difficulty mode. */
  readonly dailyDate: string | null;
  readonly width: number;
  readonly height: number;
  readonly islands: readonly Island[];
  /** The board's edges, rebuilt from the islands — never persisted. */
  readonly graph: Graph;
  /** The one answer: bridges per edge (§6). Never compared against for the win (§3). */
  readonly solution: Bridges;
  /** What the player has built: bridges per edge. */
  readonly bridges: Bridges;
  /** The bridges before each step. Not persisted (§10). */
  readonly history: readonly Bridges[];
  readonly status: GameStatus;
  readonly elapsedSeconds: number;
  readonly hintCount: number;
}

/**
 * A token that makes one difficulty game's seed its own. Difficulty mode has
 * no levels and no dates to seed from (§8), so a new game gets a new board —
 * while the seed still pins that board down completely, which is what lets
 * the retry offer the same board back.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const difficultySeed = (difficulty: Difficulty, token: string): string =>
  `bridges-${difficulty}-${token}`;

function baseSession(
  mode: GameMode,
  seed: string,
  difficulty: Difficulty,
  dailyDate: string | null,
): BridgesSession {
  const puzzle = generatePuzzle(seed, difficulty);
  const graph = buildGraph(puzzle);
  return {
    mode,
    seed,
    difficulty,
    dailyDate,
    width: puzzle.width,
    height: puzzle.height,
    islands: puzzle.islands,
    graph,
    solution: puzzle.solution,
    bridges: emptyBridges(graph),
    history: [],
    status: 'playing',
    elapsedSeconds: 0,
    hintCount: 0,
  };
}

/** A fresh difficulty game — new unless a seed pins an old one (§8). */
export function createDifficultySession(
  difficulty: Difficulty,
  seed: string = difficultySeed(difficulty, newSeedToken()),
): BridgesSession {
  return baseSession('difficulty', seed, difficulty, null);
}

/** A fresh daily game for a local YYYY-MM-DD date — medium every day (§8). */
export function createDailySession(dateString: string): BridgesSession {
  return baseSession('daily', dailySeed(dateString), DAILY_DIFFICULTY, dateString);
}

/**
 * The same puzzle from scratch (Retry): same islands, no bridges, counters
 * reset. Built from the session itself rather than the seed, so a retry
 * gives back exactly the board on screen.
 */
export function restartSession(session: BridgesSession): BridgesSession {
  return {
    ...session,
    bridges: emptyBridges(session.graph),
    history: [],
    status: 'playing',
    elapsedSeconds: 0,
    hintCount: 0,
  };
}

/** What the board shows (§5): each island against its number, and whether everything is one group. */
export const factsOf = (session: BridgesSession): BoardFacts =>
  boardFacts(session.graph, session.bridges);

/** The islands one island can be joined to right now (§4), with the edge to tap for each. */
export const candidatesFor = (session: BridgesSession, island: number) =>
  candidatesOf(session.graph, session.bridges, island);

function withBridges(session: BridgesSession, bridges: Bridges): BridgesSession {
  let history = [...session.history, session.bridges];
  if (history.length > UNDO_HISTORY_LIMIT) history = history.slice(1);
  return {
    ...session,
    bridges,
    history,
    status: isSolved(session.graph, bridges) ? 'solved' : 'playing',
  };
}

/**
 * One tap on an edge (§4): 0 → 1 → 2 → 0 bridges. Null when nothing
 * changes — the way is blocked by a crossing bridge, or the edge does not
 * exist — so nothing lands on the history.
 *
 * Refusing every move once the status is 'solved' is what makes the
 * transition into it happen exactly once: there is no path from solved back
 * to playing — not even by undo — so the caller can book the completion on
 * the edge and never again.
 */
export function doCycle(session: BridgesSession, edge: number): BridgesSession | null {
  if (session.status !== 'playing') return null;
  const next = cycleBridge(session.graph, session.bridges, edge);
  return next === null ? null : withBridges(session, next);
}

/**
 * The tap of §4 as the player makes it: one island selected, another tapped.
 * Null when the two do not see each other (no edge), or the way is blocked.
 */
export function doConnect(session: BridgesSession, a: number, b: number): BridgesSession | null {
  const edge = edgeBetween(session.graph, a, b);
  return edge === -1 ? null : doCycle(session, edge);
}

export const canUndo = (session: BridgesSession): boolean =>
  session.status === 'playing' && session.history.length > 0;

/** Reverts the last tap (§9). The hint count stays where it is. */
export function doUndo(session: BridgesSession): BridgesSession | null {
  if (!canUndo(session)) return null;
  const previous = session.history[session.history.length - 1]!;
  return { ...session, bridges: previous, history: session.history.slice(0, -1) };
}

/**
 * The hint of §9 — an edge over the answer, else the next deduction the
 * techniques prove from the player's own board. Free and unlimited; never
 * writes to the board. Null when solved, or when nothing could be proven
 * within the work limit (the hint then says so).
 */
export function hintFor(session: BridgesSession): Hint | null {
  if (session.status !== 'playing') return null;
  return findHint(session, session.solution, session.bridges, undefined, session.graph);
}

/** Hints are counted for the result screen, never limited or charged for. */
export const doHintUse = (session: BridgesSession): BridgesSession => ({
  ...session,
  hintCount: session.hintCount + 1,
});

/**
 * Carries the owner's running clock into the record, on the way to a save or
 * to the result screen (§11). Seconds only ever move forward, so a clock that
 * came back smaller after a restore is ignored rather than trusted. A value
 * that is not a finite number is ignored too, and the count stops at the
 * record's ceiling (10⁹ s) — either would otherwise make a record that
 * `fromRecord` refuses, and lose the game it holds.
 */
export function withElapsedSeconds(session: BridgesSession, seconds: number): BridgesSession {
  if (!Number.isFinite(seconds)) return session;
  const next = Math.min(MAX_COUNTER, Math.max(session.elapsedSeconds, Math.floor(seconds)));
  return next === session.elapsedSeconds ? session : { ...session, elapsedSeconds: next };
}

// ---------- the saved record (§10) ----------

/**
 * Everything a suspended game needs, and nothing derived: the board as one
 * character per cell, the answer and the player's bridges as one digit per
 * edge. The storage layer adds its schema version and timestamp around it.
 */
export interface SessionRecord {
  readonly mode: GameMode;
  readonly seed: string;
  readonly difficulty: Difficulty;
  readonly dailyDate: string | null;
  readonly width: number;
  readonly height: number;
  readonly board: string;
  readonly solution: string;
  readonly bridges: string;
  readonly hintCount: number;
  readonly elapsedSeconds: number;
}

export function toRecord(session: BridgesSession): SessionRecord {
  return {
    mode: session.mode,
    seed: session.seed,
    difficulty: session.difficulty,
    dailyDate: session.dailyDate,
    width: session.width,
    height: session.height,
    board: encodeBoard(session),
    solution: encodeBridges(session.solution),
    bridges: encodeBridges(session.bridges),
    hintCount: session.hintCount,
    elapsedSeconds: session.elapsedSeconds,
  };
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SEED_LENGTH = 200;

const isCounter = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_COUNTER;

/**
 * Rebuilds a session from a record, failing closed (§10): null for anything
 * play could not have produced or that should not be resumed —
 *
 * - a mode, difficulty, date or seed that does not fit (a daily that is not
 *   medium or has no date; a difficulty game with a date);
 * - a size that is not the difficulty's, or an island count outside its range;
 * - a board, answer or bridges that do not decode (serialize.ts);
 * - an answer that is not the board's only one — the counter re-proves it,
 *   so a hint can never point at a second answer;
 * - a board that is already solved: a finished game is history, not a game
 *   to resume.
 *
 * The re-proof is a search, bounded by SEARCH_NODE_LIMIT — the cap the
 * generator proved the board under, so every shipped board passes it again.
 * It is one of the searches §6 lists: it runs when the player opens the game
 * — which is also when a record that came in through a backup restore is
 * first read — never on a timer or ahead of time. A backup's export and
 * restore check the record's shape only (storage/schemas.ts).
 *
 * History starts empty; the status is read from the board. Whether a daily's
 * date is today is the storage layer's to decide (§10).
 */
export function fromRecord(raw: unknown): BridgesSession | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Partial<Record<keyof SessionRecord, unknown>>;
  const { mode, seed, difficulty, dailyDate, width, height } = record;
  if (mode !== 'difficulty' && mode !== 'daily') return null;
  if (typeof seed !== 'string' || seed.length === 0 || seed.length > MAX_SEED_LENGTH) return null;
  if (!isDifficulty(difficulty)) return null;
  if (mode === 'daily') {
    if (typeof dailyDate !== 'string' || !DATE_PATTERN.test(dailyDate)) return null;
    if (difficulty !== DAILY_DIFFICULTY) return null;
  } else if (dailyDate !== null) {
    return null;
  }
  if (!isCounter(record.hintCount) || !isCounter(record.elapsedSeconds)) return null;
  const preset = PRESETS[difficulty];
  if (width !== preset.width || height !== preset.height) return null;

  const decoded = decodeBoards(
    { board: record.board, solution: record.solution, bridges: record.bridges },
    preset.width,
    preset.height,
  );
  if (decoded === null) return null;
  const { layout, graph, solution, bridges } = decoded;
  const count = layout.islands.length;
  if (count < preset.minIslands || count > preset.maxIslands) return null;
  if (isSolved(graph, bridges)) return null;
  const proof = countSolutions(layout, 2, SEARCH_NODE_LIMIT, graph);
  if (!proof.complete || proof.solutions !== 1) return null;

  return {
    mode,
    seed,
    difficulty,
    dailyDate: mode === 'daily' ? (dailyDate as string) : null,
    width: preset.width,
    height: preset.height,
    islands: layout.islands,
    graph,
    solution,
    bridges,
    history: [],
    status: 'playing',
    elapsedSeconds: record.elapsedSeconds,
    hintCount: record.hintCount,
  };
}
