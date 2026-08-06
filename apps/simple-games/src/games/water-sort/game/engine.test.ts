/**
 * Pour rules (docs/WATER_SORT_RULES.md §2, §3): what may pour where, how much
 * travels, and what counts as sorted.
 */
import { describe, expect, it } from 'vitest';
import { applyPour, canonicalKey, canPour, isSolved, isTubeComplete, topRunLength } from './engine';
import { isValidTubes } from './types';

describe('topRunLength', () => {
  it('counts the consecutive top run', () => {
    expect(topRunLength([])).toBe(0);
    expect(topRunLength([1])).toBe(1);
    expect(topRunLength([0, 1, 1])).toBe(2);
    expect(topRunLength([1, 0, 1])).toBe(1);
    expect(topRunLength([2, 2, 2, 2])).toBe(4);
  });
});

describe('canPour / applyPour', () => {
  it('pours onto a matching color, as much as fits (§3)', () => {
    const tubes = [[0, 1, 1], [2, 1], [2, 2, 2], []];
    expect(canPour(tubes, 0, 1)).toBe(true);
    const result = applyPour(tubes, 0, 1)!;
    expect(result.moved).toBe(2);
    expect(result.tubes[0]).toEqual([0]);
    expect(result.tubes[1]).toEqual([2, 1, 1, 1]);
  });

  it('pours a partial run when the destination is short on room (§3)', () => {
    const tubes = [[0, 1, 1, 1], [2, 2, 2, 1], [], []];
    // Tube 1 has no room at all — the run cannot go there.
    expect(canPour(tubes, 0, 1)).toBe(false);

    const shortRoom = [[0, 1, 1, 1], [2, 2, 1], [], []];
    const result = applyPour(shortRoom, 0, 1)!;
    expect(result.moved).toBe(1);
    expect(result.tubes[0]).toEqual([0, 1, 1]);
    expect(result.tubes[1]).toEqual([2, 2, 1, 1]);
  });

  it('pours into an empty tube', () => {
    const tubes = [[0, 1, 1], [], [0, 0, 0], [2, 2, 2, 2]];
    const result = applyPour(tubes, 0, 1)!;
    expect(result.moved).toBe(2);
    expect(result.tubes[0]).toEqual([0]);
    expect(result.tubes[1]).toEqual([1, 1]);
  });

  it('rejects mismatched colors, full destinations, empty sources, and self-pours', () => {
    const tubes = [[0, 1], [2, 2], [0, 0, 0, 0], []];
    expect(canPour(tubes, 0, 1)).toBe(false); // 1 onto 2
    expect(canPour(tubes, 0, 2)).toBe(false); // full destination
    expect(canPour(tubes, 3, 0)).toBe(false); // empty source
    expect(canPour(tubes, 1, 1)).toBe(false); // self
    expect(applyPour(tubes, 0, 1)).toBeNull();
  });
});

describe('isSolved', () => {
  it('is true only when every tube is empty or complete (§2)', () => {
    expect(isSolved([[0, 0, 0, 0], [], [1, 1, 1, 1]])).toBe(true);
    expect(isSolved([[0, 0, 0], [0], [1, 1, 1, 1]])).toBe(false);
    expect(isTubeComplete([0, 0, 0, 0])).toBe(true);
    expect(isTubeComplete([0, 0, 0])).toBe(false);
    expect(isTubeComplete([0, 0, 0, 1])).toBe(false);
  });
});

describe('canonicalKey', () => {
  it('collapses tube order', () => {
    expect(canonicalKey([[0, 1], [], [2]])).toBe(canonicalKey([[2], [0, 1], []]));
    expect(canonicalKey([[0, 1]])).not.toBe(canonicalKey([[1, 0]]));
  });
});

describe('isValidTubes', () => {
  it('accepts a real board and rejects broken ones', () => {
    const board = [[0, 1, 2, 0], [1, 2, 0, 1], [2, 0, 1, 2], [], []];
    expect(isValidTubes(board, 3)).toBe(true);
    expect(isValidTubes(board, 4)).toBe(false); // wrong tube count for 4 colors
    expect(isValidTubes([...board.slice(1), [0]], 3)).toBe(false); // counts broken
    expect(isValidTubes([[0, 0, 0, 0, 0], [], [], [], []], 3)).toBe(false); // overfull
  });
});
