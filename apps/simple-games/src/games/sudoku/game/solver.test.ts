import { describe, expect, it } from 'vitest';
import { gridFromString, gridToString } from './generator';
import { createRng } from './rng';
import {
  computeCandidates,
  countSolutions,
  generateSolvedGrid,
  hasConflict,
  hasUniqueSolution,
  isGridSolved,
  solve,
} from './solver';
import { CELLS, ROWS, COLS, BOXES } from './types';

/** A classic uniquely-solvable puzzle. */
const UNIQUE =
  '530070000' +
  '600195000' +
  '098000060' +
  '800060003' +
  '400803001' +
  '700020006' +
  '060000280' +
  '000419005' +
  '000080079';

const UNIQUE_SOLUTION =
  '534678912' +
  '672195348' +
  '198342567' +
  '859761423' +
  '426853791' +
  '713924856' +
  '961537284' +
  '287419635' +
  '345286179';

const EMPTY = '0'.repeat(CELLS);

describe('computeCandidates', () => {
  it('returns null for a grid that already repeats a digit in a unit', () => {
    const grid = gridFromString('55' + '0'.repeat(CELLS - 2))!;
    expect(computeCandidates(grid)).toBeNull();
  });

  it('narrows a cell to the digits its peers leave', () => {
    const grid = gridFromString(UNIQUE)!;
    const candidates = computeCandidates(grid);
    expect(candidates).not.toBeNull();
    // Cell 2 (row 0, col 2) is empty in the fixture; its solution digit must
    // still be a candidate.
    expect(candidates![2]! & (1 << (4 - 1))).not.toBe(0);
  });
});

describe('solve', () => {
  it('solves a known puzzle to its known solution', () => {
    const solved = solve(gridFromString(UNIQUE)!);
    expect(solved).not.toBeNull();
    expect(gridToString(solved!)).toBe(UNIQUE_SOLUTION);
  });

  it('returns null for a contradictory grid', () => {
    expect(solve(gridFromString('11' + '0'.repeat(CELLS - 2))!)).toBeNull();
  });

  it('fills an empty grid into a valid complete board', () => {
    const solved = solve(gridFromString(EMPTY)!);
    expect(solved).not.toBeNull();
    expect(isGridSolved(solved!)).toBe(true);
  });
});

describe('countSolutions', () => {
  it('counts exactly one for a unique puzzle', () => {
    expect(countSolutions(gridFromString(UNIQUE)!, 2)).toBe(1);
    expect(hasUniqueSolution(gridFromString(UNIQUE)!)).toBe(true);
  });

  it('counts zero for an unsolvable grid', () => {
    // Two 5s in the same row make it unsolvable.
    expect(countSolutions(gridFromString('550' + '0'.repeat(CELLS - 3))!, 2)).toBe(0);
  });

  it('stops at the limit for a grid with many solutions', () => {
    expect(countSolutions(gridFromString(EMPTY)!, 2)).toBe(2);
    expect(hasUniqueSolution(gridFromString(EMPTY)!)).toBe(false);
  });

  it('detects the ambiguity when a needed clue is removed', () => {
    // At least one clue must be load-bearing, or the puzzle is over-specified
    // and digging could have gone further. Removing that clue must be visible
    // as a second solution — the check every dig step depends on.
    const base = gridFromString(UNIQUE)!;
    const ambiguous = base
      .map((value, index) => {
        if (value === 0) return null;
        const probe = [...base];
        probe[index] = 0;
        return countSolutions(probe, 2);
      })
      .filter((count) => count !== null && count > 1);
    expect(ambiguous.length).toBeGreaterThan(0);
  });
});

describe('generateSolvedGrid', () => {
  it('produces a fully valid board where every unit holds 1-9', () => {
    const grid = generateSolvedGrid('seed-a', createRng('seed-a'));
    expect(isGridSolved(grid)).toBe(true);
    expect(hasConflict(grid)).toBe(false);
    for (const units of [ROWS, COLS, BOXES]) {
      for (const unit of units) {
        expect(new Set(unit.map((c) => grid[c]))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]));
      }
    }
  });

  it('is deterministic per seed and differs between seeds', () => {
    const a = gridToString(generateSolvedGrid('seed-a', createRng('seed-a')));
    const again = gridToString(generateSolvedGrid('seed-a', createRng('seed-a')));
    const b = gridToString(generateSolvedGrid('seed-b', createRng('seed-b')));
    expect(a).toBe(again);
    expect(a).not.toBe(b);
  });
});

describe('gridFromString', () => {
  it('accepts dots and zeros as empty and round-trips', () => {
    const dotted = UNIQUE.replace(/0/g, '.');
    expect(gridToString(gridFromString(dotted)!)).toBe(UNIQUE);
  });

  it('rejects wrong lengths and out-of-range characters', () => {
    expect(gridFromString('123')).toBeNull();
    expect(gridFromString('x'.repeat(CELLS))).toBeNull();
  });
});
