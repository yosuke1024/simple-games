/**
 * GameSession — a pure, immutable snapshot of one game in progress:
 * board + undo history + status + score + counters. The React layer only
 * dispatches into these functions; all rules live here and in engine.ts.
 */
import { generateBoard } from './board';
import { INITIAL_CELLS, MAX_CELLS, UNDO_HISTORY_LIMIT } from './constants';
import { dailyDecorations, dailySeed } from './daily';
import { addNumbers, applyMatchDetailed, getStatus } from './engine';
import {
  DAILY_PAIR_BIAS,
  FREE_TIER_LEVEL,
  generateFreeBoard,
  generateLevelBoard,
  levelSeed,
  type FreeTier,
} from './levels';
import { connectionGap } from './rules';
import { createScore, scoreAddNumbers, scoreClear, scoreMatch, type ScoreState } from './score';
import { shapeForDaily } from './shapes';
import { isLive, type Board, type GameMode, type GameStatus } from './types';

/**
 * Snapshot taken before a mutation, tagged so undo can revert counters and
 * the exact score (which also makes match→undo→match score farming
 * impossible).
 */
export interface HistoryEntry {
  readonly board: Board;
  readonly action: 'match' | 'add';
  readonly score: ScoreState;
}

export interface GameSession {
  readonly mode: GameMode;
  readonly seed: string;
  /** Local YYYY-MM-DD for daily mode, null otherwise. */
  readonly dailyDate: string | null;
  /** 1..100 for level mode, null for the daily and for free play. */
  readonly level: number | null;
  /** The tier a free board was drawn at (§11「フリープレイ」), null otherwise. */
  readonly freeTier: FreeTier | null;
  readonly board: Board;
  /** Board snapshots before each mutation (match / add numbers). */
  readonly history: readonly HistoryEntry[];
  readonly status: GameStatus;
  readonly score: ScoreState;
  readonly moveCount: number;
  readonly addCount: number;
  readonly hintCount: number;
  readonly elapsedSeconds: number;
}

/** The board's starting numbers — the scoring budget for the whole game (§12). */
export function liveCellCount(board: Board): number {
  let count = 0;
  for (const cell of board) if (isLive(cell)) count++;
  return count;
}

function baseSession(
  mode: GameMode,
  seed: string,
  dailyDate: string | null,
  level: number | null,
  freeTier: FreeTier | null,
  board: Board,
): GameSession {
  return {
    mode,
    seed,
    dailyDate,
    level,
    freeTier,
    board,
    history: [],
    status: getStatus(board),
    score: createScore(liveCellCount(board)),
    moveCount: 0,
    addCount: 0,
    hintCount: 0,
    elapsedSeconds: 0,
  };
}

/** A fresh (or restarted) level game — deterministic per level. */
export function createLevelSession(level: number): GameSession {
  return baseSession('level', levelSeed(level), null, level, null, generateLevelBoard(level));
}

/** A fresh (or restarted) daily game for a local YYYY-MM-DD date. */
export function createDailySession(dateString: string): GameSession {
  const seed = dailySeed(dateString);
  const board = generateBoard(seed, {
    shape: shapeForDaily(dateString),
    cellCount: INITIAL_CELLS,
    // Without a bias the daily would be harsher than level 999; a fixed
    // mid-curve value keeps every day about equally hard.
    pairBias: DAILY_PAIR_BIAS,
    ...dailyDecorations(dateString),
  });
  return baseSession('daily', seed, dateString, null, null, board);
}

/**
 * A token that makes one free board's seed its own (§11「フリープレイ」).
 * Free play has no level number and no date to seed from, so a new game gets
 * a new board — while the seed still pins that board down completely, which
 * is what makes "retry the same board" exact and the saved game restorable.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

/** Its own prefix beside `level-` and `daily-`, so the three never collide. */
export const freeSeed = (token: string): string => `free-${token}`;

/** A fresh free board at a chosen tier — new unless a seed pins an old one. */
export function createFreeSession(
  tier: FreeTier,
  seed: string = freeSeed(newSeedToken()),
): GameSession {
  return baseSession('free', seed, null, null, tier, generateFreeBoard(tier, seed));
}

/** Recreates the same board for a session's seed (Restart). */
export function restartSession(session: GameSession): GameSession {
  if (session.mode === 'level' && session.level !== null) return createLevelSession(session.level);
  if (session.mode === 'free' && session.freeTier !== null) {
    return createFreeSession(session.freeTier, session.seed);
  }
  return createDailySession(session.dailyDate ?? '');
}

/** Restores a session from persisted state (undo history is not persisted). */
export function restoreSession(
  data: Pick<
    GameSession,
    | 'mode'
    | 'seed'
    | 'dailyDate'
    | 'level'
    | 'freeTier'
    | 'board'
    | 'score'
    | 'moveCount'
    | 'addCount'
    | 'hintCount'
    | 'elapsedSeconds'
  >,
): GameSession {
  return {
    ...data,
    history: [],
    status: getStatus(data.board),
  };
}

function pushHistory(session: GameSession, action: 'match' | 'add'): readonly HistoryEntry[] {
  const next = [...session.history, { board: session.board, action, score: session.score }];
  if (next.length > UNDO_HISTORY_LIMIT) next.shift();
  return next;
}

/** Clears a valid pair, scoring it. Returns null when the pair is invalid. */
export function matchPair(session: GameSession, i: number, j: number): GameSession | null {
  if (session.status !== 'playing') return null;
  const gap = connectionGap(session.board, i, j);
  const result = applyMatchDetailed(session.board, i, j);
  if (result === null || gap === null) return null;
  const status = getStatus(result.board);
  let score = scoreMatch(session.score, gap, result.rowsRemoved, result.rowCellsRemoved);
  const hintCount = session.hintCount;
  if (status === 'cleared') {
    // A free board is worth what the level it stands in for is worth (§12):
    // it was generated as that level, so its clear bonus is that level's.
    const bonusLevel =
      session.mode === 'free' && session.freeTier !== null
        ? FREE_TIER_LEVEL[session.freeTier]
        : session.level;
    score = scoreClear(score, session.mode, bonusLevel, session.addCount, hintCount);
  }
  return {
    ...session,
    board: result.board,
    history: pushHistory(session, 'match'),
    status,
    score,
    moveCount: session.moveCount + 1,
  };
}

/** Performs Add Numbers (resets the score streak). Returns null when not allowed. */
export function performAddNumbers(session: GameSession): GameSession | null {
  if (session.status !== 'playing') return null;
  const board = addNumbers(session.board, MAX_CELLS);
  if (board === null) return null;
  return {
    ...session,
    board,
    history: pushHistory(session, 'add'),
    status: getStatus(board),
    score: scoreAddNumbers(session.score),
    addCount: session.addCount + 1,
  };
}

export function canUndo(session: GameSession): boolean {
  return session.history.length > 0;
}

/** Reverts the last mutation, including its score. Returns null when empty. */
export function undo(session: GameSession): GameSession | null {
  const previous = session.history[session.history.length - 1];
  if (!previous) return null;
  return {
    ...session,
    board: previous.board,
    history: session.history.slice(0, -1),
    status: getStatus(previous.board),
    score: previous.score,
    moveCount: previous.action === 'match' ? Math.max(0, session.moveCount - 1) : session.moveCount,
    addCount: previous.action === 'add' ? Math.max(0, session.addCount - 1) : session.addCount,
  };
}

export function countHintUse(session: GameSession): GameSession {
  return { ...session, hintCount: session.hintCount + 1 };
}

export type { GameStatus };
