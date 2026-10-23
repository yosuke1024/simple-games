import { describe, expect, it } from 'vitest';
import {
  act,
  cells,
  clearLines,
  createSession,
  fits,
  gravityMs,
  HEIGHT,
  KINDS,
  landingPiece,
  level,
  pause,
  pieceAt,
  start,
  tick,
  WIDTH,
  type Session,
} from './index';
describe('Falling Blocks rules', () => {
  it('deals each of seven shapes exactly once per deterministic bag', () => {
    for (const seed of [0, 1, 42, 0xffffffff]) {
      for (let bag = 0; bag < 20; bag++) {
        const pieces = Array.from({ length: 7 }, (_, i) => pieceAt(seed, bag * 7 + i));
        expect([...pieces].sort()).toEqual([...KINDS].sort());
        expect(pieces).toEqual(Array.from({ length: 7 }, (_, i) => pieceAt(seed, bag * 7 + i)));
      }
    }
  });
  it('every shape has four unique cells through all rotations', () => {
    for (const kind of KINDS)
      for (let rotation = 0; rotation < 4; rotation++) {
        const result = cells({ kind, rotation, x: 3, y: 0 });
        expect(result).toHaveLength(4);
        expect(new Set(result.map(([x, y]) => `${x},${y}`)).size).toBe(4);
      }
  });
  it('movement stops at walls without mutating the source', () => {
    let run = start(createSession(4));
    const original = JSON.stringify(run);
    let left = run;
    for (let i = 0; i < 20; i++) left = act(left, 'left');
    expect(fits(left.board, left.active)).toBe(true);
    expect(Math.min(...cells(left.active).map(([x]) => x))).toBe(0);
    expect(act(left, 'left')).toBe(left);
    expect(JSON.stringify(run)).toBe(original);
    run = act(run, 'hardDrop');
    expect(run.board.filter(Boolean)).toHaveLength(4);
  });
  it('rotates with a horizontal wall kick but cannot pass through occupied cells', () => {
    const run: Session = {
      ...start(createSession(0)),
      active: { kind: 'I', rotation: 1, x: -2, y: 4 },
    };
    expect(fits(run.board, run.active)).toBe(true);
    const rotated = act(run, 'rotate');
    expect(rotated.active.rotation).toBe(2);
    expect(fits(rotated.board, rotated.active)).toBe(true);
    const blocked = { ...run, board: Array<number>(WIDTH * HEIGHT).fill(1) };
    expect(act(blocked, 'rotate')).toBe(blocked);
  });
  it('clears simultaneous rows and settles all cells above them', () => {
    const board = Array<number>(WIDTH * HEIGHT).fill(0);
    board[3 * WIDTH + 2] = 4;
    board.fill(2, (HEIGHT - 2) * WIDTH);
    const cleared = clearLines(board);
    expect(cleared.count).toBe(2);
    expect(cleared.board[5 * WIDTH + 2]).toBe(4);
    expect(cleared.board.filter(Boolean)).toHaveLength(1);
    expect(board[3 * WIDTH + 2]).toBe(4);
  });
  it('locks a square, clears two rows and uses the pre-clear level for scoring', () => {
    const board = Array<number>(WIDTH * HEIGHT).fill(0);
    for (let y = HEIGHT - 2; y < HEIGHT; y++)
      for (let x = 0; x < WIDTH; x++) if (x !== 4 && x !== 5) board[y * WIDTH + x] = 1;
    const run: Session = {
      ...start(createSession(1)),
      board,
      active: { kind: 'O', rotation: 0, x: 4, y: HEIGHT - 2 },
      lines: 9,
    };
    const result = tick(run);
    expect(result.lines).toBe(11);
    expect(result.score).toBe(300);
    expect(result.board.every((v) => v === 0)).toBe(true);
    expect(result.pieceIndex).toBe(1);
  });
  it('hard drop matches the ghost and awards exactly two points per dropped row', () => {
    const run = start(createSession(8));
    const ghost = landingPiece(run);
    const result = act(run, 'hardDrop');
    expect(result.score).toBe((ghost.y - run.active.y) * 2);
    for (const [x, y] of cells(ghost)) expect(result.board[y * WIDTH + x]).not.toBe(0);
  });
  it('top-out ends only when the next piece cannot spawn, and all input then stops', () => {
    let run = start(createSession(17));
    for (let i = 0; i < 30 && run.status !== 'over'; i++) run = act(run, 'hardDrop');
    expect(run.status).toBe('over');
    expect(tick(run)).toBe(run);
    expect(act(run, 'hardDrop')).toBe(run);
    expect(start(run)).toBe(run);
  });
  it('ready and paused boards never advance and speed is bounded', () => {
    const ready = createSession(2),
      stopped = pause(start(ready));
    for (const run of [ready, stopped]) {
      expect(tick(run)).toBe(run);
      expect(act(run, 'left')).toBe(run);
    }
    expect(level(0)).toBe(1);
    expect(level(10000)).toBe(20);
    expect(gravityMs(0)).toBe(850);
    expect(gravityMs(10000)).toBe(120);
  });
});
