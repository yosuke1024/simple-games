import { describe, expect, it, vi } from 'vitest';
import { createMemoryKV } from '@/storage/kv';
import { CLUB_OUTBOX_MAX, type ClubOutboxItem } from '@/storage/schemas';
import type { ClubClient } from '../api/client';
import { ClubApiError, type ClubErrorCode } from '../api/errors';
import { dropOutboxFor, enqueueResult, flushOutbox, pendingFor } from './outbox';

const A = 'https://a.example.com';
const B = 'https://b.example.com';
const item = (endpoint: string, n: number): ClubOutboxItem => ({
  endpoint,
  challengeId: `ch_${n}`,
  result: { contractVersion: 1, boardDigest: 'sd1:1', outcome: 'completed', facts: { n } },
  createdAt: `2026-10-02T00:00:${String(n % 60).padStart(2, '0')}.000Z`,
});

function clientWith(submit: (id: string) => Promise<unknown>): ClubClient {
  return { endpoint: A, submitResult: vi.fn(submit) } as unknown as ClubClient;
}

describe('outbox', () => {
  it('appends, filters by endpoint and caps at the oldest', async () => {
    const kv = createMemoryKV();
    for (let i = 0; i < CLUB_OUTBOX_MAX + 5; i++) await enqueueResult(item(i % 2 ? A : B, i), kv);
    const all = [...(await pendingFor(A, kv)), ...(await pendingFor(B, kv))];
    expect(all).toHaveLength(CLUB_OUTBOX_MAX);
    expect(all.some((i) => i.challengeId === 'ch_0')).toBe(false);
    expect(all.some((i) => i.challengeId === `ch_${CLUB_OUTBOX_MAX + 4}`)).toBe(true);
  });

  it('flushes oldest first and leaves other endpoints alone', async () => {
    const kv = createMemoryKV();
    await enqueueResult(item(A, 1), kv);
    await enqueueResult(item(B, 2), kv);
    await enqueueResult(item(A, 3), kv);
    const order: string[] = [];
    const client = clientWith(async (id) => void order.push(id));
    expect(await flushOutbox(A, client, kv)).toBe(2);
    expect(order).toEqual(['ch_1', 'ch_3']);
    expect(await pendingFor(A, kv)).toEqual([]);
    expect(await pendingFor(B, kv)).toHaveLength(1);
  });

  it.each([
    'already_submitted',
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
    await enqueueResult(item(A, 1), kv);
    const client = clientWith(async () => {
      throw new ClubApiError(code, 409);
    });
    expect(await flushOutbox(A, client, kv)).toBe(0);
    expect(await pendingFor(A, kv)).toEqual([]);
  });

  it('dropOutboxFor forgets one endpoint and leaves the others', async () => {
    const kv = createMemoryKV();
    await enqueueResult(item(A, 1), kv);
    await enqueueResult(item(B, 2), kv);
    await enqueueResult(item(A, 3), kv);
    await dropOutboxFor(A, kv);
    expect(await pendingFor(A, kv)).toEqual([]);
    expect(await pendingFor(B, kv)).toHaveLength(1);
  });

  it('stops on unreachable and keeps the rest', async () => {
    const kv = createMemoryKV();
    await enqueueResult(item(A, 1), kv);
    await enqueueResult(item(A, 2), kv);
    const client = clientWith(async () => {
      throw new ClubApiError('unreachable', null);
    });
    expect(await flushOutbox(A, client, kv)).toBe(0);
    expect(client.submitResult).toHaveBeenCalledTimes(1);
    expect(await pendingFor(A, kv)).toHaveLength(2);
  });
});
