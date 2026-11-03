/** Finite, fully visible puzzles. The v1 rules remain only for saved games. */
import * as legacy from './legacy';
import { PUZZLES, puzzleById } from './puzzles';
export { MODES, isMode, reachable, findPath, lines } from './legacy';
export type { Mode, Action } from './legacy';
export { PUZZLES, puzzleById } from './puzzles';
export type { Puzzle } from './puzzles';
export interface Session extends Omit<legacy.Session, 'status'> {
  rulesVersion: 1 | 2;
  puzzleId: string | null;
  size: number;
  target: number;
  moveLimit: number;
  status: 'playing' | 'lost' | 'won';
}
function wrapLegacy(s: legacy.Session): Session {
  return { ...s, rulesVersion: 1, puzzleId: null, ...legacy.CONFIG[s.mode], moveLimit: 4096 };
}
export const createLegacySession = (mode: legacy.Mode, seed: number): Session =>
  wrapLegacy(legacy.createSession(mode, seed));
export function createSession(mode: legacy.Mode, seed: number, puzzleId?: string): Session {
  const options = PUZZLES.filter((p) => p.mode === mode);
  const p = puzzleId === undefined ? options[(seed >>> 0) % options.length] : puzzleById(puzzleId);
  if (!p) throw new Error('Unknown puzzle');
  if (p.mode !== mode) throw new Error('Puzzle difficulty does not match');
  const board = [...p.board];
  return {
    mode,
    seed: seed >>> 0,
    rulesVersion: 2,
    puzzleId: p.id,
    size: p.size,
    target: p.target,
    moveLimit: p.moveLimit,
    board,
    actions: [],
    elapsedSeconds: 0,
    rng: 0,
    next: [],
    score: 0,
    status: 'playing',
    path: [],
    cleared: [],
    spawned: [],
    movedBoard: board,
    spawnedBoard: board,
  };
}
export function act(s: Session, action: legacy.Action): Session | null {
  if (s.status !== 'playing') return null;
  if (s.rulesVersion === 1) {
    const next = legacy.act(s as legacy.Session, action);
    return next ? wrapLegacy(next) : null;
  }
  if (!action || typeof action !== 'object' || s.actions.length >= s.moveLimit) return null;
  const path = legacy.findPath(s.board, action.from, action.to, s.size);
  if (!path) return null;
  const board = [...s.board];
  board[action.to] = board[action.from]!;
  board[action.from] = 0;
  const movedBoard = [...board];
  const cleared = legacy.lines(board, [action.to], s.size, s.target);
  for (const i of cleared) board[i] = 0;
  return {
    ...s,
    board,
    path,
    cleared,
    movedBoard,
    spawnedBoard: movedBoard,
    actions: [...s.actions, { from: action.from, to: action.to }],
    status: board.some(Boolean) ? 'playing' : 'won',
  };
}
export function undo(s: Session): Session | null {
  if (s.status !== 'playing' || !s.actions.length) return null;
  let previous =
    s.rulesVersion === 1
      ? createLegacySession(s.mode, s.seed)
      : createSession(s.mode, s.seed, s.puzzleId!);
  for (const a of s.actions.slice(0, -1)) previous = act(previous, a)!;
  return { ...previous, elapsedSeconds: s.elapsedSeconds };
}
export const resultValue = (s: Session) => (s.rulesVersion === 1 ? s.score : s.actions.length);
