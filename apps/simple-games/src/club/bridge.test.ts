import { describe, expect, it, vi } from 'vitest';
import { createMemoryKV, type KVStore } from '@/storage/kv';
import type { ClubConnection } from '@/storage/schemas';
import type { ActiveChallenge, ClubResultPayload } from '@/ui/clubBridge';
import { createBridge, loadConnections } from './bridge';
import { addClubConnection } from './storage/connections';
import { enqueueResult, pendingFor } from './storage/outbox';

const E = 'https://club.example.com';
const connection: ClubConnection = {
  endpoint: E,
  clubId: 'c_1',
  clubName: 'Family',
  memberId: 'm_1',
  memberToken: 'secret-token',
  nickname: 'Ken',
  role: 'member',
  joinedAt: 'x',
};
const challengeJson = {
  id: 'ch_1',
  gameId: 'sudoku',
  contractVersion: 1,
  params: { difficulty: 'hard' },
  seed: 'sudoku-club-1',
  boardDigest: 'sd1:1',
  title: null,
  createdBy: { id: 'm_1', nickname: 'Ken' },
  createdAt: 'x',
  resultCount: 1,
  mine: true,
};
const resultJson = {
  memberId: 'm_1',
  nickname: 'Ken',
  submittedAt: 'x',
  outcome: 'completed',
  facts: {},
};
const ok = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'X-Club-Api': '1' } });
const err = (status: number, code: string) => ok(status, { error: { code, message: 'x' } });

const payload: ClubResultPayload = {
  gameId: 'sudoku',
  outcome: 'completed',
  facts: { elapsedSeconds: 271, mistakes: 0, hints: 1, device: 'pixel' },
  seed: 'sudoku-club-1',
  params: { difficulty: 'hard' },
  boardDigest: 'sd1:1',
};
const active: ActiveChallenge = {
  endpoint: E,
  clubName: 'Family',
  challengeId: 'ch_1',
  gameId: 'sudoku',
  boardDigest: 'sd1:1',
  submitted: false,
};
const challengeResult = {
  outcome: 'completed' as const,
  facts: { elapsedSeconds: 305, mistakes: 2, hints: 0 },
  boardDigest: 'sd1:1',
};

async function setup(fetchImpl: ReturnType<typeof vi.fn>, act: ActiveChallenge | null = active) {
  const kv: KVStore = createMemoryKV();
  await addClubConnection(connection, kv);
  return { kv, bridge: createBridge(() => act, kv, fetchImpl as unknown as typeof fetch) };
}

describe('sendToClub', () => {
  it('sent: posts the validated challenge with a null title', async () => {
    const f = vi.fn().mockResolvedValue(ok(201, challengeJson));
    const { bridge } = await setup(f);
    expect(await bridge.sendToClub(E, payload)).toBe('sent');
    const body = JSON.parse(f.mock.calls[0]![1].body);
    expect(body.title).toBeNull();
    expect(body.result.facts).toEqual({ elapsedSeconds: 271, mistakes: 0, hints: 1 });
    expect(f.mock.calls[0]![1].headers.Authorization).toBe('Bearer secret-token');
  });

  it('rejected: unknown endpoint, unknown game, bad facts, server failure; never queued', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('offline'));
    const { bridge, kv } = await setup(f);
    expect(await bridge.sendToClub('https://other.example.com', payload)).toBe('rejected');
    expect(await bridge.sendToClub(E, { ...payload, gameId: 'solitaire' })).toBe('rejected');
    expect(await bridge.sendToClub(E, { ...payload, facts: { elapsedSeconds: 1 } })).toBe(
      'rejected',
    );
    expect(f).not.toHaveBeenCalled();
    expect(await bridge.sendToClub(E, payload)).toBe('rejected');
    expect(await pendingFor(E, kv)).toEqual([]);
  });
});

describe('submitActive', () => {
  it('sent: posts exactly the four fields', async () => {
    const f = vi.fn().mockResolvedValue(ok(201, resultJson));
    const { bridge } = await setup(f);
    expect(await bridge.submitActive(challengeResult)).toBe('sent');
    expect(f.mock.calls[0]![0]).toBe(`${E}/api/v1/challenges/ch_1/results`);
    expect(Object.keys(JSON.parse(f.mock.calls[0]![1].body))).toEqual([
      'contractVersion',
      'boardDigest',
      'outcome',
      'facts',
    ]);
  });

  it.each([
    ['no response', () => Promise.reject(new TypeError('offline'))],
    ['429 rate_limited', () => Promise.resolve(err(429, 'rate_limited'))],
    ['500 internal_error', () => Promise.resolve(err(500, 'internal_error'))],
    ['a 201 whose body is not a result', () => Promise.resolve(ok(201, { nope: true }))],
  ])('queued on %s: the result waits for the next chance', async (_what, answer) => {
    const f = vi.fn().mockImplementation(answer);
    const { bridge, kv } = await setup(f);
    expect(await bridge.submitActive(challengeResult)).toBe('queued');
    const pending = await pendingFor(E, kv);
    expect(pending).toHaveLength(1);
    expect(pending[0]!.challengeId).toBe('ch_1');
    expect(pending[0]!.result.facts).toEqual(challengeResult.facts);
  });

  it.each([
    [409, 'already_submitted'],
    [409, 'board_mismatch'],
    [404, 'not_found'],
    [401, 'unauthorized'],
    [400, 'invalid_request'],
    [403, 'forbidden'],
    [413, 'too_large'],
    [400, 'unsupported_version'],
  ])('rejected on %i %s: final, so never queued', async (status, code) => {
    const f = vi.fn().mockResolvedValue(err(status, code));
    const { bridge, kv } = await setup(f);
    expect(await bridge.submitActive(challengeResult)).toBe('rejected');
    expect(await pendingFor(E, kv)).toEqual([]);
  });

  it('rejected, never queued, by a server whose X-Club-Api this client does not know', async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify(resultJson), { status: 201 }));
    const { bridge, kv } = await setup(f);
    expect(await bridge.submitActive(challengeResult)).toBe('rejected');
    expect(await pendingFor(E, kv)).toEqual([]);
  });

  it('rejected without an active challenge or with bad facts', async () => {
    const f = vi.fn();
    const none = await setup(f, null);
    expect(await none.bridge.submitActive(challengeResult)).toBe('rejected');
    const { bridge } = await setup(f);
    expect(await bridge.submitActive({ ...challengeResult, facts: { elapsedSeconds: 1e9 } })).toBe(
      'rejected',
    );
    expect(f).not.toHaveBeenCalled();
  });

  it('flushes the outbox before sending the new result', async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(ok(201, resultJson)));
    const { bridge, kv } = await setup(f);
    await enqueueResult(
      {
        endpoint: E,
        challengeId: 'ch_old',
        result: {
          contractVersion: 1,
          boardDigest: 'sd1:9',
          outcome: 'completed',
          facts: { elapsedSeconds: 1, mistakes: 0, hints: 0 },
        },
        createdAt: 'x',
      },
      kv,
    );
    expect(await bridge.submitActive(challengeResult)).toBe('sent');
    expect(f.mock.calls.map((c) => c[0])).toEqual([
      `${E}/api/v1/challenges/ch_old/results`,
      `${E}/api/v1/challenges/ch_1/results`,
    ]);
    expect(await pendingFor(E, kv)).toEqual([]);
  });
});

describe('loadConnections', () => {
  it('returns summaries without tokens', async () => {
    const kv = createMemoryKV();
    await addClubConnection(connection, kv);
    const list = await loadConnections(kv);
    expect(list).toHaveLength(1);
    expect(JSON.stringify(list)).not.toContain('secret-token');
  });
});
