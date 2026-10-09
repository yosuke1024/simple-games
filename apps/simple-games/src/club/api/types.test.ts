import { describe, expect, it } from 'vitest';
import { GAMES } from '@/app/registry';
import {
  validateChallenge,
  validateClub,
  validateClubRecord,
  validateClubResponse,
  validateReportedMember,
  validateHosting,
  validateInviteResponse,
  validateJoinResponse,
  validateList,
  validateMember,
  validateRankingEntry,
  validateRankingMine,
  validateRankingSubmitResponse,
  validateRankingSummary,
  validateRankingTable,
  validateResult,
  type RankingSubmit,
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

describe('RankingSubmit', () => {
  const body: RankingSubmit = {
    gameId: 'sudoku',
    contractVersion: 1,
    paramsKey: 'hard',
    params: { difficulty: 'hard' },
    seed: 'sudoku-club-x',
    boardDigest: 'sd1:9f3a1c07',
    outcome: 'completed',
    facts: { elapsedSeconds: 305, mistakes: 2, hints: 0 },
  };
  const fields = [
    'boardDigest',
    'contractVersion',
    'facts',
    'gameId',
    'outcome',
    'params',
    'paramsKey',
    'seed',
  ];

  it('is the result and its table, with no field that names a device or a person (club.md §5-5, §16-1)', () => {
    expect(Object.keys(body).sort()).toEqual(fields);
    const extra: RankingSubmit = {
      ...body,
      // @ts-expect-error extra keys (a device name, say) are a type error
      device: 'pixel',
    };
    expect(extra).toBeDefined();
  });

  it('may carry one more field, clientId: a random token for this result, optional and a string', () => {
    const withToken: RankingSubmit = { ...body, clientId: 'res-4f9a2c7e11b8d0aa' };
    expect(Object.keys(withToken).sort()).toEqual([...fields, 'clientId'].sort());
    // Optional: a body without it is still a RankingSubmit (a build before 2026-10-10 sent none).
    expect(body.clientId).toBeUndefined();
    const notAToken: RankingSubmit = {
      ...body,
      // @ts-expect-error a token is a string
      clientId: 12345678,
    };
    expect(notAToken).toBeDefined();
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
    expect(validateChallenge(challenge)).toEqual({ ...challenge, daily: null });
    expect(validateChallenge({ ...challenge, daily: '2026-10-02' })?.daily).toBe('2026-10-02');
    expect(validateChallenge({ ...challenge, daily: null })?.daily).toBeNull();
    expect(validateChallenge({ ...challenge, daily: 5 })).toBeNull();
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
    // memberCount: the total when sent, the list's length from an older server.
    expect(validateClubResponse({ club, me: member, members: [member] })!.memberCount).toBe(1);
    expect(
      validateClubResponse({ club, me: member, members: [member], memberCount: 1200 })!.memberCount,
    ).toBe(1200);
    expect(
      validateClubResponse({ club, me: member, members: [member], memberCount: 'x' }),
    ).toBeNull();
    expect(validateReportedMember({ member, reportCount: 2 })).toEqual({ member, reportCount: 2 });
    expect(validateReportedMember({ member, reportCount: -1 })).toBeNull();
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

  describe('ranking validators (club.md §5-3, §16-1)', () => {
    const entry = {
      id: '12',
      memberId: 'm',
      nickname: 'Ken',
      submittedAt: 'x',
      facts: { score: 1 },
      seed: 's',
      boardDigest: null,
    };
    /** What a server that predates `Entry.id` sends: the same row with no such key. */
    const withoutId: Record<string, unknown> = { ...entry };
    delete withoutId.id;

    it('an entry carries its id as a string; a server that predates it sends none, which is null', () => {
      expect(validateRankingEntry(entry)).toEqual(entry);
      expect(validateRankingEntry(entry)?.id).toBe('12');
      expect(validateRankingEntry(withoutId)).toEqual({ ...entry, id: null });
      expect(validateRankingEntry({ ...entry, id: null })).toEqual({ ...entry, id: null });
      // An id is the server's arrival counter as a string: a number is a different contract.
      expect(validateRankingEntry({ ...entry, id: 12 })).toBeNull();
      expect(validateRankingEntry({ ...entry, id: {} })).toBeNull();
      expect(validateRankingEntry({ ...entry, boardDigest: 5 })).toBeNull();
      expect(validateRankingEntry({ ...entry, seed: undefined })).toBeNull();
    });

    it('a summary needs a valid leader and a count', () => {
      const summary = { gameId: 'g', paramsKey: 'standard', entryCount: 3, leader: entry };
      expect(validateRankingSummary(summary)).toEqual(summary);
      expect(validateRankingSummary({ ...summary, leader: withoutId })?.leader.id).toBeNull();
      expect(validateRankingSummary({ ...summary, entryCount: -1 })).toBeNull();
      expect(validateRankingSummary({ ...summary, leader: {} })).toBeNull();
    });

    it('a table’s me is { rank, entry, nextValue } — or null when the caller is not in it', () => {
      const table = { gameId: 'g', paramsKey: 'k', entryCount: 3, entries: [entry], me: null };
      expect(validateRankingTable(table)).toEqual(table);
      // A server that predates `me`, or sends nothing for it, is the same as not being in the table.
      const { me: _me, ...noMe } = table;
      expect(validateRankingTable(noMe)?.me).toBeNull();
      expect(validateRankingTable({ ...table, me: undefined })?.me).toBeNull();

      const standing = { rank: 87, entry, nextValue: 123 };
      expect(validateRankingTable({ ...table, me: standing })).toEqual({ ...table, me: standing });
      expect(validateRankingTable({ ...table, me: standing })?.me?.rank).toBe(87);
      // Rank 1 is a rank; below the server's scan ceiling the rank is unknown, not wrong (club.md §16-1).
      expect(validateRankingTable({ ...table, me: { ...standing, rank: 1 } })?.me?.rank).toBe(1);
      expect(
        validateRankingTable({ ...table, me: { ...standing, rank: null } })?.me?.rank,
      ).toBeNull();
      expect(validateRankingTable({ ...table, me: { ...standing, rank: 0 } })).toBeNull();
      expect(validateRankingTable({ ...table, me: { ...standing, rank: -2 } })).toBeNull();
      expect(validateRankingTable({ ...table, me: { ...standing, rank: 1.5 } })).toBeNull();
      expect(validateRankingTable({ ...table, me: { ...standing, rank: '3' } })).toBeNull();
    });

    it('nextValue is the nearest better value: a finite number, null at the top, null from an old server', () => {
      const table = { gameId: 'g', paramsKey: 'k', entryCount: 3, entries: [entry] };
      const me = (extra: Record<string, unknown>) =>
        validateRankingTable({ ...table, me: { rank: 2, entry, ...extra } });
      expect(me({ nextValue: 123 })?.me?.nextValue).toBe(123);
      // 0 is a value like any other, not "missing".
      expect(me({ nextValue: 0 })?.me?.nextValue).toBe(0);
      expect(me({ nextValue: null })?.me?.nextValue).toBeNull();
      expect(me({})?.me?.nextValue).toBeNull();
      expect(me({ nextValue: undefined })?.me?.nextValue).toBeNull();
      for (const bad of ['x', '123', NaN, Infinity, -Infinity, {}, true]) {
        expect(me({ nextValue: bad })).toBeNull();
      }
      // An old server's me has no nextValue and its entry has no id: both fall back, neither fails.
      const old = validateRankingTable({ ...table, me: { rank: 4, entry: withoutId } });
      expect(old?.me).toEqual({ rank: 4, entry: { ...entry, id: null }, nextValue: null });
    });

    it('a table is malformed when any row, or the caller’s own row, is', () => {
      const table = { gameId: 'g', paramsKey: 'k', entryCount: 3, entries: [entry], me: null };
      expect(validateRankingTable({ ...table, entries: [{}] })).toBeNull();
      expect(validateRankingTable({ ...table, entries: [entry, { ...entry, id: 5 }] })).toBeNull();
      expect(validateRankingTable({ ...table, me: {} })).toBeNull();
      expect(validateRankingTable({ ...table, me: { rank: 1, entry: {} } })).toBeNull();
      expect(validateRankingTable({ ...table, me: { rank: 1 } })).toBeNull();
      expect(validateRankingTable({ ...table, entryCount: 1.5 })).toBeNull();
    });

    describe('validateRankingMine (GET /rankings/mine)', () => {
      const mine = {
        gameId: 'sudoku',
        paramsKey: 'hard',
        entryCount: 9,
        leader: entry,
        best: { rank: 3, entry: { ...entry, id: '40', memberId: 'me' }, nextValue: 305 },
      };

      it('accepts the documented shape', () => {
        expect(validateRankingMine(mine)).toEqual(mine);
        // The leader and the caller's best may be one row.
        const top = { ...mine, best: { rank: 1, entry, nextValue: null } };
        expect(validateRankingMine(top)).toEqual(top);
      });

      it('reads rank and nextValue as a table’s me does', () => {
        const unranked = validateRankingMine({ ...mine, best: { entry } });
        expect(unranked?.best).toEqual({ rank: null, entry, nextValue: null });
        expect(
          validateRankingMine({ ...mine, best: { ...mine.best, rank: null } })?.best.rank,
        ).toBeNull();
        expect(validateRankingMine({ ...mine, best: { ...mine.best, rank: 0 } })).toBeNull();
        expect(validateRankingMine({ ...mine, best: { ...mine.best, nextValue: NaN } })).toBeNull();
        expect(validateRankingMine({ ...mine, best: { ...mine.best, nextValue: 'x' } })).toBeNull();
        expect(validateRankingMine({ ...mine, leader: withoutId })?.leader.id).toBeNull();
      });

      it('rejects a missing leader or best, a bad count, and a bad row inside either', () => {
        expect(validateRankingMine({ ...mine, leader: undefined })).toBeNull();
        expect(validateRankingMine({ ...mine, leader: null })).toBeNull();
        expect(validateRankingMine({ ...mine, leader: {} })).toBeNull();
        expect(validateRankingMine({ ...mine, best: undefined })).toBeNull();
        expect(validateRankingMine({ ...mine, best: null })).toBeNull();
        expect(validateRankingMine({ ...mine, best: {} })).toBeNull();
        expect(validateRankingMine({ ...mine, best: { rank: 1, entry: {} } })).toBeNull();
        for (const bad of [undefined, null, -1, 1.5, '9', NaN]) {
          expect(validateRankingMine({ ...mine, entryCount: bad })).toBeNull();
        }
        expect(validateRankingMine({ ...mine, gameId: undefined })).toBeNull();
        expect(validateRankingMine({ ...mine, paramsKey: 3 })).toBeNull();
        for (const bad of [null, undefined, 1, 'x', [], {}]) {
          expect(validateRankingMine(bad)).toBeNull();
        }
      });

      it('validateList over it takes every row or none', () => {
        const other = { ...mine, gameId: 'minesweeper', paramsKey: 'easy', entryCount: 1 };
        expect(validateList([mine, other], validateRankingMine)).toEqual([mine, other]);
        // No table at all is an empty list, not a malformed one.
        expect(validateList([], validateRankingMine)).toEqual([]);
        expect(validateList([mine, { ...other, best: undefined }], validateRankingMine)).toBeNull();
        expect(validateList({ ...mine }, validateRankingMine)).toBeNull();
        expect(validateList(null, validateRankingMine)).toBeNull();
      });
    });

    it('a submit answer holds the row that went in, or null when nothing was stored', () => {
      const sent = { gameId: 'g', paramsKey: 'k', improved: false, entry: null, entryCount: 0 };
      expect(validateRankingSubmitResponse(sent)).toEqual(sent);
      const stored = { ...sent, improved: true, entry, entryCount: 4 };
      expect(validateRankingSubmitResponse(stored)).toEqual(stored);
      expect(validateRankingSubmitResponse({ ...stored, entry: withoutId })?.entry?.id).toBeNull();
      expect(validateRankingSubmitResponse({ ...sent, improved: 'no' })).toBeNull();
      expect(validateRankingSubmitResponse({ ...sent, entry: {} })).toBeNull();
      expect(validateRankingSubmitResponse({ ...stored, entry: { ...entry, id: 12 } })).toBeNull();
      // `entry` has no key of its own to be missing from: undefined is not null.
      expect(validateRankingSubmitResponse({ ...sent, entry: undefined })).toBeNull();
    });

    it('never throw on a wrong shape', () => {
      for (const bad of [null, undefined, 1, 'x', [], {}]) {
        expect(validateRankingEntry(bad)).toBeNull();
        expect(validateRankingSummary(bad)).toBeNull();
        expect(validateRankingTable(bad)).toBeNull();
        expect(validateRankingMine(bad)).toBeNull();
        expect(validateRankingSubmitResponse(bad)).toBeNull();
      }
    });
  });

  it('validateList rejects non-arrays and any bad element', () => {
    expect(validateList({}, validateClub)).toBeNull();
    expect(validateList([club, {}], validateClub)).toBeNull();
    expect(validateList([club], validateClub)).toEqual([club]);
  });
});
