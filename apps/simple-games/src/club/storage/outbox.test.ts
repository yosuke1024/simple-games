import { describe, expect, it, vi } from 'vitest';
import { createMemoryKV } from '@/storage/kv';
import { CLUB_OUTBOX_MAX, CLUB_OUTBOX_MAX_ATTEMPTS, type ClubOutboxItem } from '@/storage/schemas';
import type { ClubClient } from '../api/client';
import { ClubApiError, type ClubErrorCode } from '../api/errors';
import { dropOutboxFor, enqueueResult, fateOf, flushOutbox, itemKey, pendingFor } from './outbox';

const A = 'https://a.example.com';
const B = 'https://b.example.com';

/** The old form, still valid and flushable. */
const legacy = (endpoint: string, n: number): ClubOutboxItem => ({
  endpoint,
  challengeId: `ch_${n}`,
  result: { contractVersion: 1, boardDigest: 'sd1:1', outcome: 'completed', facts: { n } },
  createdAt: `2026-10-02T00:00:${String(n % 60).padStart(2, '0')}.000Z`,
});
const daily = (endpoint: string, seed: string, elapsedSeconds = 100): ClubOutboxItem => ({
  kind: 'daily',
  endpoint,
  createdAt: '2026-10-02T00:00:00.000Z',
  body: {
    gameId: 'sudoku',
    contractVersion: 1,
    params: { difficulty: 'hard' },
    seed,
    boardDigest: 'sd1:1',
    title: null,
    daily: '2026-10-02',
    result: { outcome: 'completed', facts: { elapsedSeconds, mistakes: 0, hints: 0 } },
  },
});
const ranking = (
  endpoint: string,
  gameId: string,
  facts: Record<string, unknown>,
): ClubOutboxItem => ({
  kind: 'ranking',
  endpoint,
  createdAt: '2026-10-02T00:00:00.000Z',
  body: {
    gameId,
    contractVersion: 1,
    paramsKey: gameId === 'sudoku' ? 'hard' : 'standard',
    params: gameId === 'sudoku' ? { difficulty: 'hard' } : {},
    seed: '',
    boardDigest: null,
    outcome: 'completed',
    facts,
  },
});
const score = (endpoint: string, value: number) =>
  ranking(endpoint, '2048', { score: value, bestTile: 8 });
const time = (endpoint: string, value: number) =>
  ranking(endpoint, 'sudoku', { elapsedSeconds: value, mistakes: 0, hints: 0 });

interface Calls {
  result: string[];
  challenge: string[];
  ranking: string[];
}
/** A client whose three operations record what they were asked to send. */
function clientWith(
  answer: (kind: keyof Calls, key: string) => Promise<unknown> = () => Promise.resolve({}),
): { client: ClubClient; calls: Calls } {
  const calls: Calls = { result: [], challenge: [], ranking: [] };
  const client = {
    endpoint: A,
    submitResult: vi.fn((id: string) => {
      calls.result.push(id);
      return answer('result', id);
    }),
    createChallenge: vi.fn((body: { seed: string }) => {
      calls.challenge.push(body.seed);
      return answer('challenge', body.seed);
    }),
    submitRanking: vi.fn((body: { gameId: string; paramsKey: string }) => {
      const key = `${body.gameId}/${body.paramsKey}`;
      calls.ranking.push(key);
      return answer('ranking', key);
    }),
  } as unknown as ClubClient;
  return { client, calls };
}

const failing = (code: ClubErrorCode, status: number | null = 500) =>
  vi.fn(() => Promise.reject(new ClubApiError(code, status)));

describe('outbox', () => {
  it('appends, filters by endpoint and caps at the oldest', async () => {
    const kv = createMemoryKV();
    for (let i = 0; i < CLUB_OUTBOX_MAX + 5; i++) await enqueueResult(legacy(i % 2 ? A : B, i), kv);
    const all = [...(await pendingFor(A, kv)), ...(await pendingFor(B, kv))];
    expect(all).toHaveLength(CLUB_OUTBOX_MAX);
    const ids = all.map((i) => (i.kind === undefined ? i.challengeId : ''));
    expect(ids).not.toContain('ch_0');
    expect(ids).toContain(`ch_${CLUB_OUTBOX_MAX + 4}`);
  });

  it('answers false and writes nothing when the store cannot be read', async () => {
    const kv = createMemoryKV();
    const broken = { ...kv, get: () => Promise.reject(new Error('unreadable')) };
    expect(await enqueueResult(score(A, 100), broken)).toBe(false);
    expect(await pendingFor(A, kv)).toEqual([]);
  });

  describe('coalescing', () => {
    it('keeps the better of two rankings for one table, whichever direction it points', async () => {
      const kv = createMemoryKV();
      // higher is better
      await enqueueResult(score(A, 1000), kv);
      await enqueueResult(score(A, 500), kv);
      await enqueueResult(score(A, 3000), kv);
      await enqueueResult(score(A, 2000), kv);
      // lower is better
      await enqueueResult(time(A, 300), kv);
      await enqueueResult(time(A, 400), kv);
      await enqueueResult(time(A, 250), kv);
      const queued = await pendingFor(A, kv);
      expect(queued).toHaveLength(2);
      expect(queued.map((i) => (i.kind === 'ranking' ? i.body.facts : null))).toEqual([
        { score: 3000, bestTile: 8 },
        { elapsedSeconds: 250, mistakes: 0, hints: 0 },
      ]);
    });

    it('a tie keeps the one already queued', async () => {
      const kv = createMemoryKV();
      await enqueueResult({ ...score(A, 100), createdAt: 'first' }, kv);
      await enqueueResult({ ...score(A, 100), createdAt: 'second' }, kv);
      expect((await pendingFor(A, kv)).map((i) => i.createdAt)).toEqual(['first']);
    });

    it('keeps tables, games and Clubs apart', async () => {
      const kv = createMemoryKV();
      await enqueueResult(score(A, 1), kv);
      await enqueueResult(score(B, 1), kv);
      await enqueueResult(time(A, 1), kv);
      expect(await pendingFor(A, kv)).toHaveLength(2);
      expect(await pendingFor(B, kv)).toHaveLength(1);
    });

    it('a daily keeps the first result for its board, as the server does', async () => {
      const kv = createMemoryKV();
      await enqueueResult(daily(A, 's1', 500), kv);
      await enqueueResult(daily(A, 's1', 100), kv);
      await enqueueResult(daily(A, 's2', 100), kv);
      const queued = await pendingFor(A, kv);
      expect(queued).toHaveLength(2);
      expect(queued[0]?.kind === 'daily' && queued[0].body.result.facts.elapsedSeconds).toBe(500);
    });

    it('an old-form result keeps the first for its challenge', async () => {
      const kv = createMemoryKV();
      await enqueueResult(legacy(A, 1), kv);
      await enqueueResult({ ...legacy(A, 1), createdAt: 'later' }, kv);
      expect(await pendingFor(A, kv)).toHaveLength(1);
    });

    it('a daily and a ranking of one game never merge', () => {
      expect(itemKey(daily(A, 's1'))).not.toBe(itemKey(time(A, 1)));
    });
  });

  describe('serialised mutations', () => {
    it('loses no item when many enqueues for different Clubs and tables run at once', async () => {
      const kv = createMemoryKV();
      const items: ClubOutboxItem[] = [];
      for (let i = 0; i < 20; i++) {
        items.push(ranking(i % 2 ? A : B, `game-${i}`, { score: i }));
      }
      await Promise.all(items.map((item) => enqueueResult(item, kv)));
      expect(await pendingFor(A, kv)).toHaveLength(10);
      expect(await pendingFor(B, kv)).toHaveLength(10);
    });

    it('an enqueue made while a flush removes an item is not lost', async () => {
      const kv = createMemoryKV();
      await enqueueResult(legacy(A, 1), kv);
      const { client } = clientWith(async () => {
        // The Club answers slowly; meanwhile another result arrives.
        await enqueueResult(score(A, 7), kv);
        return {};
      });
      await flushOutbox(A, client, kv);
      const left = await pendingFor(A, kv);
      expect(left.map((i) => i.kind)).toEqual(['ranking']);
    });
  });

  describe('flush', () => {
    it('sends each kind by its own request, oldest first, and leaves other Clubs alone', async () => {
      const kv = createMemoryKV();
      await enqueueResult(legacy(A, 1), kv);
      await enqueueResult(legacy(B, 2), kv);
      await enqueueResult(daily(A, 's1'), kv);
      await enqueueResult(score(A, 9), kv);
      const { client, calls } = clientWith();
      const report = await flushOutbox(A, client, kv);
      expect(report.sent).toBe(3);
      expect(report.blocked).toBe(false);
      expect(report.outcomes.map((o) => o.fate)).toEqual(['sent', 'sent', 'sent']);
      expect(calls).toEqual({ result: ['ch_1'], challenge: ['s1'], ranking: ['2048/standard'] });
      expect(await pendingFor(A, kv)).toEqual([]);
      expect(await pendingFor(B, kv)).toHaveLength(1);
    });

    it.each([
      'board_mismatch',
      'not_found',
      'unauthorized',
      'invalid_request',
      'forbidden',
      'too_large',
      'unsupported_version',
      'unsupported_server',
    ] as ClubErrorCode[])('drops an item answered %s, and goes on to the next', async (code) => {
      const kv = createMemoryKV();
      await enqueueResult(daily(A, 's1'), kv);
      await enqueueResult(score(A, 5), kv);
      let n = 0;
      const { client } = clientWith(() =>
        ++n === 1 ? Promise.reject(new ClubApiError(code, 400)) : Promise.resolve({}),
      );
      const report = await flushOutbox(A, client, kv);
      expect(report.outcomes.map((o) => o.fate)).toEqual(['rejected', 'sent']);
      expect(await pendingFor(A, kv)).toEqual([]);
    });

    it('already_submitted is delivered-equivalent: dropped, and reported as already', async () => {
      const kv = createMemoryKV();
      await enqueueResult(daily(A, 's1'), kv);
      const { client } = clientWith(() =>
        Promise.reject(new ClubApiError('already_submitted', 409)),
      );
      const report = await flushOutbox(A, client, kv);
      expect(report.outcomes.map((o) => o.fate)).toEqual(['already']);
      expect(report.sent).toBe(0);
      expect(await pendingFor(A, kv)).toEqual([]);
    });

    it.each(['unreachable', 'rate_limited'] as ClubErrorCode[])(
      'stops on %s, keeps the rest, and never counts it against the item',
      async (code) => {
        const kv = createMemoryKV();
        await enqueueResult(daily(A, 's1'), kv);
        await enqueueResult(score(A, 5), kv);
        const { client, calls } = clientWith(failing(code));
        for (let round = 0; round < CLUB_OUTBOX_MAX_ATTEMPTS + 3; round++) {
          const report = await flushOutbox(A, client, kv);
          expect(report.blocked).toBe(true);
          expect(report.outcomes.map((o) => o.fate)).toEqual(['queued']);
        }
        expect(calls.ranking).toEqual([]);
        const left = await pendingFor(A, kv);
        expect(left).toHaveLength(2);
        expect(left[0]?.attempts).toBeUndefined();
      },
    );

    it.each(['internal_error', 'malformed_response'] as ClubErrorCode[])(
      'counts %s, and gives up on the item after the cap so it cannot block its Club for good',
      async (code) => {
        const kv = createMemoryKV();
        await enqueueResult(daily(A, 's1'), kv);
        await enqueueResult(score(A, 5), kv);
        const { client } = clientWith((kind) =>
          kind === 'challenge' ? Promise.reject(new ClubApiError(code, 500)) : Promise.resolve({}),
        );
        for (let round = 1; round < CLUB_OUTBOX_MAX_ATTEMPTS; round++) {
          const report = await flushOutbox(A, client, kv);
          expect(report.blocked).toBe(true);
          expect((await pendingFor(A, kv))[0]?.attempts).toBe(round);
          expect(await pendingFor(A, kv)).toHaveLength(2);
        }
        // The last allowed failure drops it, and the flush carries on to the next item.
        const last = await flushOutbox(A, client, kv);
        expect(last.outcomes.map((o) => o.fate)).toEqual(['rejected', 'sent']);
        expect(last.blocked).toBe(false);
        expect(await pendingFor(A, kv)).toEqual([]);
      },
    );

    it('a replaced in-flight item is not removed by the attempt that held the old one', async () => {
      const kv = createMemoryKV();
      await enqueueResult(score(A, 100), kv);
      const { client } = clientWith(async () => {
        // A better result for the same table arrives while the old one is on the wire.
        await enqueueResult(score(A, 900), kv);
        return {};
      });
      await flushOutbox(A, client, kv);
      const left = await pendingFor(A, kv);
      expect(left).toHaveLength(1);
      expect(left[0]?.kind === 'ranking' && left[0].body.facts.score).toBe(900);
    });

    it('two flushes of one Club run one after the other and send an item once', async () => {
      const kv = createMemoryKV();
      await enqueueResult(score(A, 5), kv);
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      const { client, calls } = clientWith(() => gate.then(() => ({})));
      const first = flushOutbox(A, client, kv);
      const second = flushOutbox(A, client, kv);
      release();
      await Promise.all([first, second]);
      expect(calls.ranking).toEqual(['2048/standard']);
    });

    it('fateOf: the flush that sent it, a flush that settled it earlier, or still queued', async () => {
      const kv = createMemoryKV();
      const item = score(A, 5);
      await enqueueResult(item, kv);
      const { client } = clientWith();
      const first = await flushOutbox(A, client, kv);
      expect(fateOf(item, first)).toBe('sent');
      // Another flush found nothing; the earlier one's verdict is still known.
      const idle = await flushOutbox(A, client, kv);
      expect(fateOf(item, idle)).toBe('sent');
      // An item nothing has settled is waiting.
      expect(fateOf(score(A, 6), idle)).toBe('queued');
    });
  });

  it('dropOutboxFor forgets one endpoint and leaves the others', async () => {
    const kv = createMemoryKV();
    await enqueueResult(legacy(A, 1), kv);
    await enqueueResult(legacy(B, 2), kv);
    await enqueueResult(score(A, 3), kv);
    await dropOutboxFor(A, kv);
    expect(await pendingFor(A, kv)).toEqual([]);
    expect(await pendingFor(B, kv)).toHaveLength(1);
  });
});
