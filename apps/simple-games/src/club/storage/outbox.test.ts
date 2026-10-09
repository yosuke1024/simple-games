import { describe, expect, it, vi } from 'vitest';
import { createMemoryKV } from '@/storage/kv';
import { CLUB_OUTBOX_MAX, CLUB_OUTBOX_MAX_ATTEMPTS, type ClubOutboxItem } from '@/storage/schemas';
import type { ClubClient } from '../api/client';
import { ClubApiError, type ClubErrorCode } from '../api/errors';
import {
  dropOutboxFor,
  dropOutboxMatching,
  enqueueResult,
  fateOf,
  flushOutbox,
  itemKey,
  pendingFor,
} from './outbox';

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
/**
 * A ranking item. With a `clientId` it is one result of its own, as the bridge
 * queues it now (club.md §4-2, 2026-10-10), with the token on the item and in
 * the body; without one it is what a build before that left in the queue.
 */
const ranking = (
  endpoint: string,
  gameId: string,
  facts: Record<string, unknown>,
  clientId?: string,
): ClubOutboxItem => ({
  kind: 'ranking',
  endpoint,
  createdAt: '2026-10-02T00:00:00.000Z',
  ...(clientId === undefined ? {} : { clientId }),
  body: {
    gameId,
    contractVersion: 1,
    paramsKey: gameId === 'sudoku' ? 'hard' : 'standard',
    params: gameId === 'sudoku' ? { difficulty: 'hard' } : {},
    seed: '',
    boardDigest: null,
    outcome: 'completed',
    facts,
    ...(clientId === undefined ? {} : { clientId }),
  },
});
const score = (endpoint: string, value: number, clientId?: string) =>
  ranking(endpoint, '2048', { score: value, bestTile: 8 }, clientId);
const time = (endpoint: string, value: number, clientId?: string) =>
  ranking(endpoint, 'sudoku', { elapsedSeconds: value, mistakes: 0, hints: 0 }, clientId);
/** A token in the server's shape, `^[A-Za-z0-9_-]{8,64}$`. */
const cid = (n: number) => `result-${String(n).padStart(4, '0')}`;
const idOf = (item: ClubOutboxItem | undefined) =>
  item?.kind === 'ranking' ? item.clientId : null;

interface Calls {
  result: string[];
  challenge: string[];
  ranking: string[];
  /** The bodies `submitRanking` was given, in order. */
  rankingBodies: { clientId?: string; facts?: Record<string, unknown> }[];
}
/** A client whose three operations record what they were asked to send. */
function clientWith(
  answer: (kind: keyof Calls, key: string) => Promise<unknown> = () => Promise.resolve({}),
): { client: ClubClient; calls: Calls } {
  const calls: Calls = { result: [], challenge: [], ranking: [], rankingBodies: [] };
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
    submitRanking: vi.fn(
      (body: {
        gameId: string;
        paramsKey: string;
        clientId?: string;
        facts?: Record<string, unknown>;
      }) => {
        const key = `${body.gameId}/${body.paramsKey}`;
        calls.ranking.push(key);
        calls.rankingBodies.push(body);
        return answer('ranking', key);
      },
    ),
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

  describe('one row per result (club.md §4-2, 2026-10-10)', () => {
    it('keys a ranking item by its clientId, and an older one by its table', () => {
      expect(itemKey(score(A, 1, cid(1)))).toBe(`ranking|${A}|${cid(1)}`);
      expect(itemKey(score(A, 1))).toBe(`ranking|${A}|2048|standard`);
      expect(itemKey(score(A, 1, cid(1)))).not.toBe(itemKey(score(B, 1, cid(1))));
    });

    it('two results for one table are two items, in the order they finished', async () => {
      const kv = createMemoryKV();
      await enqueueResult(score(A, 1000, cid(1)), kv);
      await enqueueResult(score(A, 3000, cid(2)), kv);
      await enqueueResult(time(A, 300, cid(3)), kv);
      await enqueueResult(time(A, 250, cid(4)), kv);
      const queued = await pendingFor(A, kv);
      expect(queued.map(idOf)).toEqual([cid(1), cid(2), cid(3), cid(4)]);
      expect(queued.map((i) => (i.kind === 'ranking' ? i.body.clientId : null))).toEqual([
        cid(1),
        cid(2),
        cid(3),
        cid(4),
      ]);
    });

    it('a worse result queued after a better one is not dropped, whichever way the axis points', async () => {
      const kv = createMemoryKV();
      // higher is better
      await enqueueResult(score(A, 3000, cid(1)), kv);
      await enqueueResult(score(A, 500, cid(2)), kv);
      // lower is better
      await enqueueResult(time(A, 250, cid(3)), kv);
      await enqueueResult(time(A, 900, cid(4)), kv);
      // and a tie is a result too
      await enqueueResult(time(A, 900, cid(5)), kv);
      const queued = await pendingFor(A, kv);
      expect(queued.map(idOf)).toEqual([cid(1), cid(2), cid(3), cid(4), cid(5)]);
    });

    it('the same item queued again (a resend, a screen that mounted twice) is kept once', async () => {
      const kv = createMemoryKV();
      await enqueueResult(score(A, 1000, cid(1)), kv);
      await enqueueResult(score(A, 1000, cid(1)), kv);
      await enqueueResult(score(A, 1000, cid(2)), kv);
      expect((await pendingFor(A, kv)).map(idOf)).toEqual([cid(1), cid(2)]);
    });

    it('the same token in two Clubs is two items: each Club has its own queue', async () => {
      const kv = createMemoryKV();
      await enqueueResult(score(A, 1000, cid(1)), kv);
      await enqueueResult(score(B, 1000, cid(1)), kv);
      expect(await pendingFor(A, kv)).toHaveLength(1);
      expect(await pendingFor(B, kv)).toHaveLength(1);
    });

    it('a token the queue already holds is not replaced by a better value under it', async () => {
      const kv = createMemoryKV();
      await enqueueResult(score(A, 100, cid(1)), kv);
      await enqueueResult(score(A, 900, cid(1)), kv);
      const queued = await pendingFor(A, kv);
      expect(queued).toHaveLength(1);
      expect(queued[0]?.kind === 'ranking' && queued[0].body.facts.score).toBe(100);
    });

    it('keeps the clientId through storage, on the item and in the body', async () => {
      const kv = createMemoryKV();
      await enqueueResult(score(A, 1000, cid(7)), kv);
      const [item] = await pendingFor(A, kv);
      expect(item?.kind === 'ranking' && item.clientId).toBe(cid(7));
      expect(item?.kind === 'ranking' && item.body.clientId).toBe(cid(7));
    });

    it('past the cap the oldest results go, never one of the newest', async () => {
      const kv = createMemoryKV();
      for (let i = 0; i < CLUB_OUTBOX_MAX + 3; i++) await enqueueResult(score(A, 1000, cid(i)), kv);
      const queued = await pendingFor(A, kv);
      expect(queued).toHaveLength(CLUB_OUTBOX_MAX);
      expect(idOf(queued[0])).toBe(cid(3));
      expect(idOf(queued.at(-1))).toBe(cid(CLUB_OUTBOX_MAX + 2));
    });
  });

  describe('coalescing: what still merges', () => {
    it('ranking items an older build queued (no clientId) keep the better of two for one table, whichever direction it points', async () => {
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

    it('an older ranking item merges among its own kind only: a result with a clientId is a row beside it', async () => {
      const kv = createMemoryKV();
      await enqueueResult(score(A, 1000), kv);
      await enqueueResult(score(A, 3000), kv);
      await enqueueResult(score(A, 500, cid(1)), kv);
      await enqueueResult(score(A, 4000, cid(2)), kv);
      const queued = await pendingFor(A, kv);
      expect(queued.map(idOf)).toEqual([undefined, cid(1), cid(2)]);
      expect(queued[0]?.kind === 'ranking' && queued[0].body.facts.score).toBe(3000);
    });

    it('a tie between older ranking items keeps the one already queued', async () => {
      const kv = createMemoryKV();
      await enqueueResult({ ...score(A, 100), createdAt: 'first' }, kv);
      await enqueueResult({ ...score(A, 100), createdAt: 'second' }, kv);
      expect((await pendingFor(A, kv)).map((i) => i.createdAt)).toEqual(['first']);
    });

    it('older ranking items keep tables, games and Clubs apart', async () => {
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
      expect(itemKey(daily(A, 's1'))).not.toBe(itemKey(time(A, 1, cid(1))));
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
      expect(calls).toMatchObject({
        result: ['ch_1'],
        challenge: ['s1'],
        ranking: ['2048/standard'],
      });
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

    it('sends every ranking result as its own request, each body carrying its clientId, oldest first', async () => {
      const kv = createMemoryKV();
      await enqueueResult(score(A, 3000, cid(1)), kv);
      await enqueueResult(score(A, 500, cid(2)), kv);
      await enqueueResult(time(A, 250, cid(3)), kv);
      const { client, calls } = clientWith();
      const report = await flushOutbox(A, client, kv);
      expect(report.sent).toBe(3);
      expect(calls.ranking).toEqual(['2048/standard', '2048/standard', 'sudoku/hard']);
      expect(calls.rankingBodies.map((b) => b.clientId)).toEqual([cid(1), cid(2), cid(3)]);
      expect(calls.rankingBodies.map((b) => b.facts?.score ?? b.facts?.elapsedSeconds)).toEqual([
        3000, 500, 250,
      ]);
      expect(await pendingFor(A, kv)).toEqual([]);
    });

    it('a resend of an item whose answer was lost carries the same clientId', async () => {
      const kv = createMemoryKV();
      await enqueueResult(score(A, 3000, cid(1)), kv);
      const lost = clientWith(failing('unreachable', null));
      const first = await flushOutbox(A, lost.client, kv);
      expect(first.blocked).toBe(true);
      expect(await pendingFor(A, kv)).toHaveLength(1);

      const { client, calls } = clientWith();
      await flushOutbox(A, client, kv);
      expect(lost.client.submitRanking).toHaveBeenCalledTimes(1);
      expect(calls.rankingBodies.map((b) => b.clientId)).toEqual([cid(1)]);
      expect(await pendingFor(A, kv)).toEqual([]);
    });

    it('a failure of one result holds the ones behind it, none of them merged or dropped', async () => {
      const kv = createMemoryKV();
      await enqueueResult(score(A, 3000, cid(1)), kv);
      await enqueueResult(score(A, 500, cid(2)), kv);
      const { client, calls } = clientWith(failing('unreachable', null));
      const report = await flushOutbox(A, client, kv);
      expect(report.blocked).toBe(true);
      expect(calls.rankingBodies.map((b) => b.clientId)).toEqual([cid(1)]);
      expect((await pendingFor(A, kv)).map(idOf)).toEqual([cid(1), cid(2)]);
    });

    it('fateOf tells two results of one table apart', async () => {
      const kv = createMemoryKV();
      const first = score(A, 3000, cid(1));
      const second = score(A, 500, cid(2));
      await enqueueResult(first, kv);
      await enqueueResult(second, kv);
      let n = 0;
      const { client } = clientWith(() =>
        ++n === 1 ? Promise.resolve({}) : Promise.reject(new ClubApiError('invalid_request', 400)),
      );
      const report = await flushOutbox(A, client, kv);
      expect(fateOf(first, report)).toBe('sent');
      expect(fateOf(second, report)).toBe('rejected');
    });

    it('a result queued while another of its table is on the wire stays, and the sent one goes', async () => {
      const kv = createMemoryKV();
      await enqueueResult(score(A, 100, cid(1)), kv);
      const { client } = clientWith(async () => {
        // A better result for the same table arrives while the first is on the wire:
        // it is a row of its own, not a replacement.
        await enqueueResult(score(A, 900, cid(2)), kv);
        return {};
      });
      await flushOutbox(A, client, kv);
      const left = await pendingFor(A, kv);
      expect(left.map(idOf)).toEqual([cid(2)]);
    });

    it('a replaced in-flight item (an older build’s, no clientId) is not removed by the attempt that held the old one', async () => {
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

  describe('dropOutboxMatching (deleting one daily result)', () => {
    const rank = (
      endpoint: string,
      gameId: string,
      paramsKey: string,
      clientId?: string,
    ): ClubOutboxItem => ({
      kind: 'ranking',
      endpoint,
      createdAt: '2026-10-02T00:00:00.000Z',
      ...(clientId === undefined ? {} : { clientId }),
      body: {
        gameId,
        contractVersion: 1,
        paramsKey,
        params: {},
        seed: 's',
        boardDigest: 'sd1:1',
        outcome: 'completed',
        facts: { elapsedSeconds: 100 },
        ...(clientId === undefined ? {} : { clientId }),
      },
    });
    const dropDaily = (endpoint: string, kv: ReturnType<typeof createMemoryKV>) =>
      dropOutboxMatching(
        endpoint,
        {
          kind: 'daily',
          challengeId: 'ch_1',
          gameId: 'sudoku',
          seed: 'sudoku-daily-1',
          boardDigest: 'sd1:1',
        },
        kv,
      );

    it('never touches a ranking item, of that game or any other: only the daily of the challenge goes', async () => {
      const kv = createMemoryKV();
      await enqueueResult(rank(A, 'sudoku', 'hard', cid(1)), kv);
      await enqueueResult(rank(A, 'sudoku', 'easy'), kv);
      await enqueueResult(rank(B, 'sudoku', 'hard', cid(2)), kv);
      await enqueueResult(daily(A, 'sudoku-daily-1'), kv);
      await dropDaily(A, kv);
      const left = [...(await pendingFor(A, kv)), ...(await pendingFor(B, kv))];
      expect(left.map(itemKey).sort()).toEqual([
        `ranking|${A}|${cid(1)}`,
        `ranking|${A}|sudoku|easy`,
        `ranking|${B}|${cid(2)}`,
      ]);
    });

    it('drops the daily items of one challenge, and an old-form result addressed to it', async () => {
      const kv = createMemoryKV();
      await enqueueResult(daily(A, 'sudoku-daily-1'), kv);
      await enqueueResult(daily(A, 'sudoku-daily-2'), kv);
      await enqueueResult(daily(B, 'sudoku-daily-1'), kv);
      await enqueueResult(legacy(A, 1), kv);
      await enqueueResult(legacy(A, 2), kv);
      await enqueueResult(rank(A, 'sudoku', 'hard'), kv);
      await enqueueResult(rank(A, 'sudoku', 'hard', cid(1)), kv);
      await dropOutboxMatching(
        A,
        {
          kind: 'daily',
          challengeId: 'ch_1',
          gameId: 'sudoku',
          seed: 'sudoku-daily-1',
          boardDigest: 'sd1:1',
        },
        kv,
      );
      expect((await pendingFor(A, kv)).map(itemKey).sort()).toEqual([
        `daily|${A}|sudoku|sudoku-daily-2|sd1:1`,
        `ranking|${A}|${cid(1)}`,
        `ranking|${A}|sudoku|hard`,
        `result|${A}|ch_2`,
      ]);
      expect(await pendingFor(B, kv)).toHaveLength(1);
    });

    it('writes nothing when nothing matches', async () => {
      const kv = createMemoryKV();
      await enqueueResult(rank(A, 'sudoku', 'hard', cid(1)), kv);
      await enqueueResult(daily(A, 'sudoku-daily-2'), kv);
      const set = vi.spyOn(kv, 'set');
      await dropDaily(A, kv);
      expect(set).not.toHaveBeenCalled();
      expect(await pendingFor(A, kv)).toHaveLength(2);
    });

    it('runs through the same chain as the other changes: a concurrent enqueue is not lost', async () => {
      const kv = createMemoryKV();
      await enqueueResult(daily(A, 'sudoku-daily-1'), kv);
      await Promise.all([
        dropDaily(A, kv),
        enqueueResult(rank(A, 'sudoku', 'easy', cid(1)), kv),
        enqueueResult(rank(B, 'sudoku', 'easy', cid(2)), kv),
      ]);
      expect((await pendingFor(A, kv)).map(itemKey)).toEqual([`ranking|${A}|${cid(1)}`]);
      expect(await pendingFor(B, kv)).toHaveLength(1);
    });
  });
});
