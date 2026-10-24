/**
 * PipeLinkSession — a pure, immutable snapshot of one board: its tiles, the
 * one answer, the starting and the current orientations, the undo history,
 * and the counters kept for the result screen (docs/PIPE_LINK_RULES.md).
 *
 * Undo exists (§6) because touch has no counter-clockwise turn: stepping an
 * elbow, a tee or an end back costs three taps. One turn — either way — is
 * one step; the history lives on the session and is never persisted (§7).
 *
 * The clock lives outside. Elapsed seconds are carried in by whoever owns
 * the timer — this layer never reads one, which is what keeps a session a
 * pure function of its seed (§8).
 *
 * No search runs here except on an explicit action: generation when a new
 * board is made (New Board, opening the daily), the technique solver on the
 * first Hint tap. A restore checks shape and content only (§7) — it never
 * re-proves uniqueness.
 */
import { isSolved, litSet, type Board } from './board';
import { DAILY_DIFFICULTY, dailySeed } from './daily';
import { generatePuzzle } from './generator';
import { findHint, type Hint } from './hint';
import { decodeParts, encodeOrientations, encodeTypes } from './serialize';
import { solve, type SolveResult } from './solver';
import { rotateCcw, rotateCw } from './tiles';
import { PRESETS, isDifficulty, type Difficulty, type GameMode, type GameStatus } from './types';

/**
 * How many steps back the player can go (§6) — initial value. A real game
 * never comes close; the cap only keeps a session that runs forever bounded.
 */
export const UNDO_HISTORY_LIMIT = 5_000;

/** The ceiling of the record's counters — hints and seconds (§7). */
export const MAX_COUNTER = 1e9;

/** One step of the undo history: the cell turned and its orientation before the turn. */
export interface Move {
  readonly cell: number;
  readonly previous: number;
}

export type TurnDirection = 'cw' | 'ccw';

export interface PipeLinkSession {
  readonly mode: GameMode;
  readonly seed: string;
  readonly difficulty: Difficulty;
  /** Local YYYY-MM-DD in daily mode, null in difficulty mode. */
  readonly dailyDate: string | null;
  readonly board: Board;
  /** The one answer (§4). Read only by the hint's last stage (§6) — never for the win (§2). */
  readonly solution: readonly number[];
  /** The scrambled starting orientations, kept for Restart (§8). */
  readonly initial: readonly number[];
  /** What the player sees now. */
  readonly current: readonly number[];
  /** Not persisted (§6, §7). */
  readonly history: readonly Move[];
  readonly status: GameStatus;
  readonly elapsedSeconds: number;
  readonly hintCount: number;
  /** The hint given since the board last changed, or null (§6: asked again, counted once). Not persisted. */
  readonly lastHint: Hint | null;
  /**
   * The technique solver's result from the types-only board, kept after the
   * first Hint tap (§4: one board, one result). Not persisted.
   */
  readonly techniques: SolveResult | null;
}

/**
 * A token that makes one difficulty game's seed its own (§8). The seed then
 * pins the board down completely.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const difficultySeed = (difficulty: Difficulty, token: string): string =>
  `pipe-link-${difficulty}-${token}`;

function baseSession(
  mode: GameMode,
  seed: string,
  difficulty: Difficulty,
  dailyDate: string | null,
): PipeLinkSession {
  const puzzle = generatePuzzle(seed, difficulty);
  return {
    mode,
    seed,
    difficulty,
    dailyDate,
    board: puzzle.board,
    solution: puzzle.solution,
    initial: puzzle.initial,
    current: puzzle.initial,
    history: [],
    status: 'playing',
    elapsedSeconds: 0,
    hintCount: 0,
    lastHint: null,
    techniques: null,
  };
}

/** A fresh difficulty game — new unless a seed pins an old one (§8). */
export function createDifficultySession(
  difficulty: Difficulty,
  seed: string = difficultySeed(difficulty, newSeedToken()),
): PipeLinkSession {
  return baseSession('difficulty', seed, difficulty, null);
}

/** Today's daily board for a local YYYY-MM-DD date — medium every day (§8). */
export function createDailySession(dateString: string): PipeLinkSession {
  return baseSession('daily', dailySeed(dateString), DAILY_DIFFICULTY, dateString);
}

/**
 * The same board from its starting orientations (Restart, §8): no history,
 * hints and clock at zero. Built from the session itself, not the seed, so
 * no search runs and a bundled board comes back as itself.
 */
export function restartSession(session: PipeLinkSession): PipeLinkSession {
  return {
    ...session,
    current: session.initial,
    history: [],
    status: 'playing',
    elapsedSeconds: 0,
    hintCount: 0,
    lastHint: null,
  };
}

/** Which tiles are lit (§2 rule 3). */
export const litOf = (session: PipeLinkSession): boolean[] =>
  litSet(session.board, session.current);

/**
 * One turn of one tile (§3): clockwise for a tap, counter-clockwise for a
 * right click or Shift+Enter. Null when nothing changes — the board is
 * solved, or the cell does not exist. Refusing every move once solved is
 * what makes the transition into it happen exactly once (§2).
 */
export function turnTile(
  session: PipeLinkSession,
  cell: number,
  direction: TurnDirection,
): PipeLinkSession | null {
  if (session.status !== 'playing') return null;
  if (!Number.isInteger(cell) || cell < 0 || cell >= session.current.length) return null;
  const type = session.board.types[cell]!;
  const previous = session.current[cell]!;
  const next = direction === 'cw' ? rotateCw(type, previous) : rotateCcw(type, previous);
  const current = [...session.current];
  current[cell] = next;
  let history = [...session.history, { cell, previous }];
  if (history.length > UNDO_HISTORY_LIMIT)
    history = history.slice(history.length - UNDO_HISTORY_LIMIT);
  return {
    ...session,
    current,
    history,
    status: isSolved(session.board, current) ? 'solved' : 'playing',
    lastHint: null,
  };
}

export const canUndo = (session: PipeLinkSession): boolean =>
  session.status === 'playing' && session.history.length > 0;

/** Takes the last turn back (§6). The hint count stays where it is. */
export function undo(session: PipeLinkSession): PipeLinkSession | null {
  if (!canUndo(session)) return null;
  const move = session.history[session.history.length - 1]!;
  const current = [...session.current];
  current[move.cell] = move.previous;
  return {
    ...session,
    current,
    history: session.history.slice(0, -1),
    lastHint: null,
  };
}

/**
 * One tap on Hint (§6): the hint, and the session after giving it. Free and
 * unlimited; never writes to the board. A hint asked again while the board
 * has not changed shows the same mark and is not counted again. Null hint
 * on a solved board. The technique solver runs on the first tap only and its
 * result stays on the session.
 */
export function askHint(session: PipeLinkSession): {
  readonly session: PipeLinkSession;
  readonly hint: Hint | null;
} {
  if (session.status !== 'playing') return { session, hint: null };
  if (session.lastHint !== null) return { session, hint: session.lastHint };
  const techniques = session.techniques ?? solve(session.board);
  const hint = findHint(session.board, session.solution, session.current, techniques);
  const withTechniques = techniques === session.techniques ? session : { ...session, techniques };
  if (hint === null) return { session: withTechniques, hint };
  return {
    session: {
      ...withTechniques,
      hintCount: Math.min(MAX_COUNTER, session.hintCount + 1),
      lastHint: hint,
    },
    hint,
  };
}

/**
 * Carries the owner's running clock into the record (§8). Seconds only move
 * forward; a value that is not finite is ignored, and the count stops at the
 * record's ceiling.
 */
export function withElapsedSeconds(session: PipeLinkSession, seconds: number): PipeLinkSession {
  if (!Number.isFinite(seconds)) return session;
  const next = Math.min(MAX_COUNTER, Math.max(session.elapsedSeconds, Math.floor(seconds)));
  return next === session.elapsedSeconds ? session : { ...session, elapsedSeconds: next };
}

// ---------- the saved record (§7) ----------

/**
 * Everything a suspended game needs, and nothing derived. The storage layer
 * adds its schema version and timestamp around it.
 */
export interface SessionRecord {
  readonly mode: GameMode;
  readonly seed: string;
  readonly difficulty: Difficulty;
  readonly dailyDate: string | null;
  readonly width: number;
  readonly height: number;
  readonly types: string;
  readonly source: number;
  readonly solution: string;
  readonly initial: string;
  readonly current: string;
  readonly hintCount: number;
  readonly elapsedSeconds: number;
}

export function toRecord(session: PipeLinkSession): SessionRecord {
  return {
    mode: session.mode,
    seed: session.seed,
    difficulty: session.difficulty,
    dailyDate: session.dailyDate,
    width: session.board.width,
    height: session.board.height,
    types: encodeTypes(session.board.types),
    source: session.board.source,
    solution: encodeOrientations(session.solution),
    initial: encodeOrientations(session.initial),
    current: encodeOrientations(session.current),
    hintCount: session.hintCount,
    elapsedSeconds: session.elapsedSeconds,
  };
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_SEED_LENGTH = 200;

const isCounter = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_COUNTER;

/**
 * Rebuilds a session from a record, failing closed (§7): null for anything
 * play could not have produced or that should not be resumed — a mode,
 * difficulty, date or seed that does not fit; a size that is not the
 * difficulty's; types, source or orientations that do not decode; an answer
 * that is not a solved arrangement of the board (serialize.ts); a current
 * board that is already solved. Linear in the board's size; no search runs.
 * Whether a daily's date is today is the storage layer's to decide (§7).
 */
export function fromRecord(raw: unknown): PipeLinkSession | null {
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
  const parts = decodeParts(
    {
      types: record.types,
      source: record.source,
      solution: record.solution,
      initial: record.initial,
      current: record.current,
    },
    preset.width,
    preset.height,
  );
  if (parts === null) return null;
  if (isSolved(parts.board, parts.current)) return null;
  return {
    mode,
    seed,
    difficulty,
    dailyDate: mode === 'daily' ? (dailyDate as string) : null,
    board: parts.board,
    solution: parts.solution,
    initial: parts.initial,
    current: parts.current,
    history: [],
    status: 'playing',
    elapsedSeconds: record.elapsedSeconds,
    hintCount: record.hintCount,
    lastHint: null,
    techniques: null,
  };
}
