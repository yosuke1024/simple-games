import { describe, expect, it } from 'vitest';
import type { Challenge, Result } from '../api/types';
import { challengeStartOf, contractFor, gameTitle, rankResults } from './challenge';

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
    expect(contractFor('solitaire')).toBeNull();
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

  it('with no contract nothing is ranked', () => {
    const out = rankResults(null, [res('a', 'completed', sd(1)), res('b', 'completed', sd(2))]);
    expect(out.map((r) => r.rank)).toEqual([null, null]);
    expect(out.map((r) => r.result.memberId)).toEqual(['a', 'b']);
  });
});

describe('challengeStartOf', () => {
  const base: Challenge = {
    id: 'c',
    gameId: 'sudoku',
    contractVersion: 1,
    params: { difficulty: 'easy', junk: 1 },
    seed: 'sudoku-club-1',
    boardDigest: 'sd1:00000000',
    title: null,
    createdBy: { id: 'm', nickname: 'n' },
    createdAt: 'x',
    resultCount: 0,
    mine: false,
    daily: null,
  };
  it('validates params through the contract', () => {
    expect(challengeStartOf(base)).toEqual({
      seed: 'sudoku-club-1',
      params: { difficulty: 'easy' },
      boardDigest: 'sd1:00000000',
    });
  });
  it('is null for an unknown game or bad params', () => {
    expect(challengeStartOf({ ...base, gameId: 'nope' })).toBeNull();
    expect(challengeStartOf({ ...base, gameId: 'solitaire' })).toBeNull();
    expect(challengeStartOf({ ...base, params: { difficulty: 'x' } })).toBeNull();
  });
});
