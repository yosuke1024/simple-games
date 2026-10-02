import { describe, expect, it } from 'vitest';
import { GAMES } from '@/app/registry';
import {
  validateChallenge,
  validateClub,
  validateClubRecord,
  validateClubResponse,
  validateHosting,
  validateInviteResponse,
  validateJoinResponse,
  validateList,
  validateMember,
  validateResult,
  type ResultSubmission,
} from './types';

const contract = (id: string) => GAMES.find((g) => g.id === id)!.challenge!;

const club = { id: 'c_1', name: 'Family', createdAt: '2026-09-09T00:00:00.000Z' };
const member = { id: 'm_7', nickname: 'Ken', role: 'member', joinedAt: '2026-09-09T00:00:00.000Z' };
const challenge = {
  id: 'ch_1',
  gameId: 'sudoku',
  contractVersion: 1,
  params: { difficulty: 'hard' },
  seed: 'sudoku-club-x',
  boardDigest: 'sd1:9f3a1c07',
  title: null,
  createdBy: { id: 'm_7', nickname: 'Ken' },
  createdAt: '2026-09-09T00:00:00.000Z',
  resultCount: 1,
  mine: true,
};

describe('ResultSubmission', () => {
  it('has exactly the four fields of club.md §5-5', () => {
    const body: ResultSubmission = {
      contractVersion: 1,
      boardDigest: 'sd1:9f3a1c07',
      outcome: 'completed',
      facts: { elapsedSeconds: 305, mistakes: 2, hints: 0 },
    };
    expect(Object.keys(body)).toEqual(['contractVersion', 'boardDigest', 'outcome', 'facts']);
    const extra: ResultSubmission = {
      ...body,
      // @ts-expect-error extra keys (a device name, say) are a type error
      device: 'pixel',
    };
    expect(extra).toBeDefined();
  });
});

describe('registry contracts', () => {
  it.each(['sudoku', 'minesweeper', 'water-sort'])('%s has a contract', (id) => {
    expect(contract(id).contractVersion).toBe(1);
  });

  it('drops extra fields and rejects out-of-range values', () => {
    const sudoku = contract('sudoku');
    expect(
      sudoku.validateFacts({ elapsedSeconds: 10, mistakes: 0, hints: 0, device: 'pixel' }),
    ).toEqual({ elapsedSeconds: 10, mistakes: 0, hints: 0 });
    expect(sudoku.validateFacts({ elapsedSeconds: 86401, mistakes: 0, hints: 0 })).toBeNull();
    expect(sudoku.validateParams({ difficulty: 'hard', extra: 1 })).toEqual({ difficulty: 'hard' });
    expect(sudoku.validateParams({ difficulty: 'insane' })).toBeNull();

    const mines = contract('minesweeper');
    expect(mines.validateParams({ difficulty: 'easy', firstIndex: -1 })).toBeNull();
    expect(mines.validateFacts({ elapsedSeconds: 1, hints: 0, device: 'x' })).toEqual({
      elapsedSeconds: 1,
      hints: 0,
    });

    const water = contract('water-sort');
    expect(water.validateFacts({ moves: 100001, elapsedSeconds: 1, hints: 0 })).toBeNull();
    expect(water.validateFacts({ moves: 5, elapsedSeconds: 1, hints: 0, locale: 'ja' })).toEqual({
      moves: 5,
      elapsedSeconds: 1,
      hints: 0,
    });
  });
});

describe('validators', () => {
  it('accept the documented shapes', () => {
    expect(validateClub(club)).toEqual(club);
    expect(validateMember(member)).toEqual(member);
    expect(validateChallenge(challenge)).toEqual(challenge);
    expect(
      validateResult({
        memberId: 'm_7',
        nickname: 'Ken',
        submittedAt: 'x',
        outcome: 'played',
        facts: {},
      }),
    ).not.toBeNull();
    expect(
      validateClubRecord({
        gameId: 'sudoku',
        paramsKey: 'hard',
        facts: {},
        memberId: 'm_7',
        nickname: 'Ken',
        challengeId: 'ch_1',
      }),
    ).not.toBeNull();
    expect(
      validateHosting({ provider: null, manageUrl: null, referralUrl: null, lastActivityAt: null }),
    ).not.toBeNull();
    expect(validateJoinResponse({ club, member, memberToken: 't' })).not.toBeNull();
    expect(validateClubResponse({ club, me: member, members: [member] })).not.toBeNull();
    expect(validateInviteResponse({ token: 't', url: 'u' })).toEqual({ token: 't', url: 'u' });
  });

  it('return null on wrong shapes, never throw', () => {
    for (const bad of [null, undefined, 1, 'x', [], {}]) {
      expect(validateClub(bad)).toBeNull();
      expect(validateMember(bad)).toBeNull();
      expect(validateChallenge(bad)).toBeNull();
      expect(validateResult(bad)).toBeNull();
      expect(validateJoinResponse(bad)).toBeNull();
      expect(validateClubResponse(bad)).toBeNull();
      expect(validateInviteResponse(bad)).toBeNull();
      expect(validateHosting(bad)).toBeNull();
      expect(validateClubRecord(bad)).toBeNull();
    }
    expect(validateMember({ ...member, role: 'admin' })).toBeNull();
    expect(validateChallenge({ ...challenge, contractVersion: 2 })).toBeNull();
    expect(validateChallenge({ ...challenge, mine: 'yes' })).toBeNull();
    expect(
      validateResult({ memberId: 'a', nickname: 'b', submittedAt: 'c', outcome: 'won' }),
    ).toBeNull();
  });

  it('validateList rejects non-arrays and any bad element', () => {
    expect(validateList({}, validateClub)).toBeNull();
    expect(validateList([club, {}], validateClub)).toBeNull();
    expect(validateList([club], validateClub)).toEqual([club]);
  });
});
