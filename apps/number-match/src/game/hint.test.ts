import { describe, expect, it } from 'vitest';
import { findHint, hasAnyMove } from './hint';
import { makeBoard } from './test-helpers';

describe('findHint', () => {
  it('returns the lowest-index valid pair deterministically', () => {
    // Pairs (0,1) and (2,3) both valid; the scan must return (0,1).
    const board = makeBoard('1928');
    expect(findHint(board)).toEqual([0, 1]);
  });

  it('finds pairs that connect across cleared cells', () => {
    const board = makeBoard('1..9');
    expect(findHint(board)).toEqual([0, 3]);
  });

  it('returns null when no valid pair exists', () => {
    const board = makeBoard('12');
    expect(findHint(board)).toBeNull();
    expect(hasAnyMove(board)).toBe(false);
  });

  it('returns null on an empty or fully cleared board', () => {
    expect(findHint([])).toBeNull();
    expect(findHint(makeBoard('...'))).toBeNull();
  });

  it('never returns a value-matching but blocked pair', () => {
    const board = makeBoard('129');
    expect(findHint(board)).toBeNull();
  });
});
