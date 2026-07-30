import { describe, expect, it } from 'vitest';
import { blockingCells, blockingPath, canConnect, isMatchingValues, isValidPair } from './rules';
import { makeBoard } from './test-helpers';

describe('isMatchingValues', () => {
  it('accepts same digits', () => {
    expect(isMatchingValues(3, 3)).toBe(true);
    expect(isMatchingValues(7, 7)).toBe(true);
    expect(isMatchingValues(5, 5)).toBe(true);
  });

  it('accepts pairs summing to 10', () => {
    expect(isMatchingValues(1, 9)).toBe(true);
    expect(isMatchingValues(2, 8)).toBe(true);
    expect(isMatchingValues(4, 6)).toBe(true);
    expect(isMatchingValues(6, 4)).toBe(true);
  });

  it('rejects other combinations', () => {
    expect(isMatchingValues(3, 4)).toBe(false);
    expect(isMatchingValues(1, 2)).toBe(false);
    expect(isMatchingValues(9, 2)).toBe(false);
  });
});

describe('canConnect — horizontal (reading order within a row)', () => {
  it('connects adjacent cells in a row', () => {
    const board = makeBoard('19555');
    expect(canConnect(board, 0, 1)).toBe(true);
  });

  it('connects across cleared cells in a row', () => {
    const board = makeBoard('1..95');
    expect(canConnect(board, 0, 3)).toBe(true);
  });

  it('rejects when a live cell is between', () => {
    const board = makeBoard('129');
    expect(canConnect(board, 0, 2)).toBe(false);
  });
});

describe('canConnect — vertical', () => {
  it('connects vertically adjacent cells in the same column', () => {
    const board = makeBoard('155555555', '122222222');
    expect(canConnect(board, 0, 9)).toBe(true);
  });

  it('connects vertically across a cleared cell in the same column', () => {
    const board = makeBoard('155555555', '.22222222', '133333333');
    expect(canConnect(board, 0, 18)).toBe(true);
  });

  it('rejects vertically when a live cell is between', () => {
    const board = makeBoard('155555555', '222222222', '133333333');
    expect(canConnect(board, 0, 18)).toBe(false);
  });
});

describe('canConnect — diagonal', () => {
  it('connects diagonally adjacent cells (down-right)', () => {
    const board = makeBoard('255555555', '582222222');
    expect(canConnect(board, 0, 10)).toBe(true);
  });

  it('connects diagonally adjacent cells (down-left)', () => {
    const board = makeBoard('552555555', '585555555');
    expect(canConnect(board, 2, 10)).toBe(true);
  });

  it('connects diagonally across a cleared diagonal cell', () => {
    const board = makeBoard('255555555', '5.5555555', '558555555');
    expect(canConnect(board, 0, 20)).toBe(true);
  });

  it('rejects diagonally when a live cell is between', () => {
    const board = makeBoard('255555555', '535555555', '558555555');
    expect(canConnect(board, 0, 20)).toBe(false);
  });
});

describe('canConnect — row end to next row start (reading order wrap)', () => {
  it('connects the last cell of a row with the first cell of the next row', () => {
    const board = makeBoard('555555551', '955555555');
    expect(canConnect(board, 8, 9)).toBe(true);
  });

  it('connects across cleared cells spanning the row boundary', () => {
    const board = makeBoard('55555551.', '.95555555');
    expect(canConnect(board, 7, 10)).toBe(true);
  });

  it('rejects when a live cell sits between across the boundary', () => {
    const board = makeBoard('555555512', '955555555');
    // index 7 (1) and index 9 (9): index 8 (2) is live between them.
    expect(canConnect(board, 7, 9)).toBe(false);
  });
});

describe('canConnect — misc', () => {
  it('rejects the same cell', () => {
    const board = makeBoard('19');
    expect(canConnect(board, 0, 0)).toBe(false);
  });

  it('rejects out-of-range indices', () => {
    const board = makeBoard('19');
    expect(canConnect(board, 0, 5)).toBe(false);
    expect(canConnect(board, -1, 1)).toBe(false);
  });
});

describe('blockingCells', () => {
  it('is empty when the pair already connects', () => {
    expect(blockingCells(makeBoard('19'), 0, 1)).toEqual([]);
    expect(blockingCells(makeBoard('1..9'), 0, 3)).toEqual([]);
  });

  it('reports the live numbers standing in the way', () => {
    // 3 5 8 3 — the 5 and 8 block the two 3s (the case that confuses players).
    expect(blockingCells(makeBoard('3583'), 0, 3)).toEqual([1, 2]);
  });

  it('prefers the path closest to connecting', () => {
    // Same column, one live cell in the way vertically, but many in
    // reading order — the vertical path is the instructive one.
    const board = makeBoard('755555555', '755555555', '755555555');
    expect(blockingCells(board, 0, 18)).toEqual([9]);
  });

  it('reports diagonal blockers', () => {
    const board = makeBoard('255555555', '535555555', '558555555');
    expect(blockingCells(board, 0, 20)).toEqual([10]);
  });

  it('returns nothing for degenerate input', () => {
    const board = makeBoard('19');
    expect(blockingCells(board, 0, 0)).toEqual([]);
    expect(blockingCells(board, 0, 99)).toEqual([]);
  });
});

describe('blockingPath', () => {
  it('traces the corridor the pair would have taken, blockers included', () => {
    const board = makeBoard('3583');
    const { path, blockers } = blockingPath(board, 0, 3);
    expect(path).toEqual([1, 2]);
    expect(blockers).toEqual([1, 2]);
  });

  it('spans the row-end wrap, so a blocker past the row end is explained', () => {
    // Reading order runs 2行8列 → 2行9列 → 3行1列: the only blocker sits at the
    // far right, which reads as unrelated unless the corridor is drawn.
    const board = makeBoard('111111111', '111111185', '811111111');
    const { path, blockers } = blockingPath(board, 16, 18);
    expect(path).toEqual([17]);
    expect(blockers).toEqual([17]);
    expect(path).toContain(blockers[0]);
  });

  it('reports empty slots on the route, not just the blockers', () => {
    // 8 . 5 . 8 — the corridor is three slots wide, only the 5 is in the way.
    const board = makeBoard('8.5.8');
    const { path, blockers } = blockingPath(board, 0, 4);
    expect(path).toEqual([1, 2, 3]);
    expect(blockers).toEqual([2]);
  });

  it('follows the vertical path when that is the one closest to connecting', () => {
    const board = makeBoard('755555555', '755555555', '755555555');
    const { path, blockers } = blockingPath(board, 0, 18);
    expect(path).toEqual([9]);
    expect(blockers).toEqual([9]);
  });

  it('is empty for a connecting pair and for degenerate input', () => {
    expect(blockingPath(makeBoard('19'), 0, 1)).toEqual({ path: [], blockers: [] });
    expect(blockingPath(makeBoard('19'), 0, 0)).toEqual({ path: [], blockers: [] });
    expect(blockingPath(makeBoard('19'), 0, 99)).toEqual({ path: [], blockers: [] });
  });
});

describe('isValidPair', () => {
  it('requires both cells to be live', () => {
    const board = makeBoard('1.9');
    expect(isValidPair(board, 0, 1)).toBe(false);
    expect(isValidPair(board, 0, 2)).toBe(true);
  });

  it('requires matching values and a connection', () => {
    // 1 and 9 match but are blocked; 1 and 2 connect but do not match.
    const board = makeBoard('129');
    expect(isValidPair(board, 0, 2)).toBe(false);
    expect(isValidPair(board, 0, 1)).toBe(false);
  });
});

describe('wilds (§2)', () => {
  it('pair with any number', () => {
    // '*' is a wild; 3 and 7 would never match each other.
    expect(isValidPair(makeBoard('*3'), 0, 1)).toBe(true);
    expect(isValidPair(makeBoard('3*'), 0, 1)).toBe(true);
    expect(isValidPair(makeBoard('*7'), 0, 1)).toBe(true);
  });

  it('pair with each other', () => {
    expect(isValidPair(makeBoard('**'), 0, 1)).toBe(true);
  });

  it('still obey the connection rules', () => {
    // A wild bends the value rule, never the "clear a path first" rule.
    expect(isValidPair(makeBoard('*53'), 0, 2)).toBe(false);
    expect(isValidPair(makeBoard('*.3'), 0, 2)).toBe(true);
  });

  it('are themselves in the way of a pair behind them', () => {
    expect(canConnect(makeBoard('3*3'), 0, 2)).toBe(false);
    expect(blockingCells(makeBoard('3*3'), 0, 2)).toEqual([1]);
  });
});

describe('stones (§3, §4)', () => {
  it('block reading order, including across the row-end wrap', () => {
    // 'S' is a stone: opaque where a cleared cell or a hole is transparent.
    expect(canConnect(makeBoard('3S3'), 0, 2)).toBe(false);
    expect(canConnect(makeBoard('3.3'), 0, 2)).toBe(true);
    expect(canConnect(makeBoard('11111111S', 'S11111111'), 7, 10)).toBe(false);
  });

  it('block vertically', () => {
    const board = makeBoard('755555555', 'S55555555', '755555555');
    expect(canConnect(board, 0, 18)).toBe(false);
  });

  it('block diagonally', () => {
    const board = makeBoard('255555555', '5S5555555', '558555555');
    expect(canConnect(board, 0, 20)).toBe(false);
  });

  it('are never matchable, not even with another stone', () => {
    expect(isValidPair(makeBoard('SS'), 0, 1)).toBe(false);
    expect(isValidPair(makeBoard('S5'), 0, 1)).toBe(false);
    expect(isValidPair(makeBoard('S*'), 0, 1)).toBe(false);
  });

  it('are marked as being in the way, so the rejection is explained', () => {
    // Without this the route would be drawn around an empty-looking slot.
    const { path, blockers } = blockingPath(makeBoard('3S3'), 0, 2);
    expect(path).toEqual([1]);
    expect(blockers).toEqual([1]);
  });
});
