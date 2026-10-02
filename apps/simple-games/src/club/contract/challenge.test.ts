import { describe, expect, it } from 'vitest';
import type { Result } from '../api/types';
import { contractFor, gameTitle, rankResults, RESULTS_PAGE } from './challenge';

const res = (memberId: string, outcome: Result['outcome'], facts: unknown): Result => ({
  memberId,
  nickname: memberId,
  submittedAt: '2026-10-02T00:00:00.000Z',
  outcome,
  facts,
});
const sd = (elapsedSeconds: number) => ({ elapsedSeconds, mistakes: 0, hints: 0 });

describe('contractFor / gameTitle', () => {
  it('reads the registry', () => {
    expect(contractFor('sudoku')?.order).toBe('elapsedSeconds');
    expect(contractFor('checkers')).toBeNull(); // win/lose only: no table (club.md §16)
    expect(contractFor('nope')).toBeNull();
    expect(gameTitle('sudoku')).toBe('Sudoku');
    expect(gameTitle('nope')).toBeNull();
  });
});

describe('rankResults', () => {
  it('orders completed ascending, ties get successive ranks, played last unranked', () => {
    const out = rankResults(contractFor('minesweeper'), [
      res('a', 'played', {}),
      res('b', 'completed', { elapsedSeconds: 50, hints: 0 }),
      res('c', 'completed', { elapsedSeconds: 30, hints: 0 }),
      res('d', 'completed', { elapsedSeconds: 50, hints: 1 }),
      res('e', 'played', {}),
    ]);
    expect(out.map((r) => r.result.memberId)).toEqual(['c', 'b', 'd', 'a', 'e']);
    expect(out.map((r) => r.rank)).toEqual([1, 2, 3, null, null]);
    expect(out.map((r) => r.value)).toEqual([30, 50, 50, null, null]);
  });

  it('puts results that fail the contract at the end, unranked, in submission order', () => {
    const out = rankResults(contractFor('sudoku'), [
      res('bad', 'completed', { elapsedSeconds: 999999 }),
      res('ok', 'completed', sd(10)),
    ]);
    expect(out.map((r) => r.result.memberId)).toEqual(['ok', 'bad']);
    expect(out[1]!.rank).toBeNull();
  });

  it('ranks a higher-is-better game from the top (the contract direction)', () => {
    const out = rankResults(contractFor('reversi'), [
      res('a', 'completed', { score: 20, cpuScore: 44 }),
      res('b', 'completed', { score: 40, cpuScore: 24 }),
      res('c', 'completed', { score: 30, cpuScore: 34 }),
    ]);
    expect(contractFor('reversi')?.direction).toBe('desc');
    expect(out.map((r) => r.result.memberId)).toEqual(['b', 'c', 'a']);
    expect(out.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('leaves the asker’s own row unnumbered when the server appends it after the best page', () => {
    const page = Array.from({ length: RESULTS_PAGE }, (_, i) =>
      res(`m${i}`, 'completed', sd(i + 1)),
    );
    const out = rankResults(contractFor('sudoku'), [...page, res('me', 'completed', sd(9999))]);
    expect(out).toHaveLength(RESULTS_PAGE + 1);
    expect(out[RESULTS_PAGE - 1]!.rank).toBe(RESULTS_PAGE);
    expect(out[RESULTS_PAGE]!.result.memberId).toBe('me');
    expect(out[RESULTS_PAGE]!.rank).toBeNull();
  });

  it('with no contract nothing is ranked', () => {
    const out = rankResults(null, [res('a', 'completed', sd(1)), res('b', 'completed', sd(2))]);
    expect(out.map((r) => r.rank)).toEqual([null, null]);
    expect(out.map((r) => r.result.memberId)).toEqual(['a', 'b']);
  });
});
