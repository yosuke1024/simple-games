import { describe, expect, it } from 'vitest';
import { act, createSession, findPath, lines, undo, CONFIG, type Session } from './index';
describe('Marble Weave rules', () => {
  it('finds orthogonal paths and rejects jumps and invalid coordinates', () => {
    const board = [1, 2, 0, 0, 2, 0, 0, 0, 0];
    expect(findPath(board, 0, 2, 3)).toEqual([0, 3, 6, 7, 8, 5, 2]);
    board[3] = 3;
    expect(findPath(board, 0, 2, 3)).toBeNull();
    expect(findPath(board, -1, 2, 3)).toBeNull();
    expect(findPath(board, 0, 99, 3)).toBeNull();
  });
  it('clears crossing lines once and never wraps rows', () => {
    const board = Array<number>(49).fill(0);
    [15, 16, 17, 18, 3, 10, 24].forEach((n) => {
      board[n] = 1;
    });
    expect(lines(board, [17], 7, 4).sort((a, b) => a - b)).toEqual([3, 10, 15, 16, 17, 18, 24]);
    const wrapped = Array<number>(49).fill(0);
    [5, 6, 7, 8].forEach((n) => {
      wrapped[n] = 1;
    });
    expect(lines(wrapped, [6], 7, 4)).toEqual([]);
  });
  it('does not spawn when a move clears and scores the actual cleared count', () => {
    const s = createSession('easy', 10);
    s.board.fill(0);
    [0, 1, 2, 10].forEach((n) => {
      s.board[n] = 1;
    });
    const next = act(s, { from: 10, to: 3 })!;
    expect(next.score).toBe(40);
    expect(next.cleared).toHaveLength(4);
    expect(next.spawned).toEqual([]);
    expect(next.next).toEqual(s.next);
    expect(next.rng).toBe(s.rng);
  });
  it('spawns preview colors and undo restores board, preview and randomness', () => {
    const s = createSession('normal', 36);
    const from = s.board.findIndex(Boolean),
      to = s.board.findIndex((n, i) => !n && findPath(s.board, from, i, 9));
    const action = { from, to },
      next = act(s, action)!;
    expect(next.spawned.map((i) => next.spawnedBoard[i])).toEqual(s.next);
    const previous = undo(next)!;
    expect(previous.board).toEqual(s.board);
    expect(previous.next).toEqual(s.next);
    expect(previous.rng).toBe(s.rng);
    expect(act(previous, action)).toEqual(next);
  });
  it('handles the last free cell without overwriting a marble', () => {
    const s = createSession('hard', 1);
    s.board = Array.from({ length: 81 }, (_, i) => ((i + Math.floor(i / 9)) % 7) + 1);
    s.board[0] = 0;
    const next = act(s, { from: 1, to: 0 })!;
    expect(next.spawned).toEqual([1]);
    expect(next.status).toBe('lost');
  });
  it('starts without pre-existing lines for every mode', () => {
    for (const mode of ['easy', 'normal', 'hard'] as const)
      for (let seed = 0; seed < 50; seed++) {
        const s: Session = createSession(mode, seed),
          c = CONFIG[mode];
        expect(s.board.filter(Boolean)).toHaveLength(5);
        expect(
          lines(
            s.board,
            s.board.map((_, i) => i),
            c.size,
            c.target,
          ),
        ).toEqual([]);
      }
  });
});
