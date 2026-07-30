/**
 * Persistence encoding of docs/NONOGRAM_RULES.md §10: exact round-trips, and
 * everything else fails closed.
 */
import { describe, expect, it } from 'vitest';
import { decodeMarks, decodeSolution, encodeCells } from './serialize';
import { createLevelSession } from './session';

describe('serialize (§10)', () => {
  it('round-trips a solution and a marks board', () => {
    const session = createLevelSession(200);
    const solution = decodeSolution(encodeCells(session.solution), session.size);
    expect(solution).toEqual([...session.solution]);

    const marks = decodeMarks('0120'.repeat(25), 10);
    expect(marks).toHaveLength(100);
    expect(encodeCells(marks!)).toBe('0120'.repeat(25));
  });

  it('rejects wrong lengths and stray characters', () => {
    expect(decodeSolution('01', 5)).toBeNull();
    expect(decodeSolution('2'.repeat(25), 5)).toBeNull();
    expect(decodeMarks('3'.repeat(25), 5)).toBeNull();
    expect(decodeMarks('', 5)).toBeNull();
  });
});
