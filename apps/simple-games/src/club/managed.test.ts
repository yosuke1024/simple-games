import { describe, expect, it, vi } from 'vitest';
import { createMemoryKV } from '@/storage/kv';
import {
  clubConnectionsSchema,
  isClubEndpoint,
  STORAGE_KEYS,
  type ClubConnection,
  type PendingClubJoin,
} from '@/storage/schemas';
import { createClient } from './api/client';
import { createManagedClient } from './api/managed';
import { createBridge } from './bridge';
import { inviteFromHref } from './invite';
import { joinOrRestore } from './join';
import {
  addClubConnection,
  loadClubConnections,
  loadManagedOwner,
  loadPendingJoins,
  saveManagedOwner,
  savePendingJoin,
  updateClubGames,
  updateClubName,
} from './storage/connections';
import { enqueueResult, flushOutbox, pendingFor } from './storage/outbox';
import { dailyComparisonKey } from './ui/RecordBookScreen';
import type { RecordDaily } from './api/ownerRecords';
import { PUBLIC_CLUB_ENDPOINT } from './public';
import { PIXAPPS_CLUB_ORIGIN } from '@/ui/clubFeatures';

describe('the managed service origin', () => {
  it('is the Public Club House origin: one deployment serves both', () => {
    expect(PIXAPPS_CLUB_ORIGIN).toBe(PUBLIC_CLUB_ENDPOINT);
  });
});

const ORIGIN = 'https://managed.example.com';
const E = `${ORIGIN}/clubs/c_one`;
const CLUB = { id: 'c_one', name: 'Family', createdAt: '2026-10-23T00:00:00.000Z' };
const MEMBER = { id: 'm_one', nickname: 'Ken', role: 'member' as const, joinedAt: CLUB.createdAt };
const connection: ClubConnection = {
  endpoint: E,
  clubId: CLUB.id,
  clubName: CLUB.name,
  memberId: MEMBER.id,
  memberToken: 'member-token',
  nickname: MEMBER.nickname,
  role: 'member',
  joinedAt: MEMBER.joinedAt,
  autoSend: true,
};
const application = {
  id: 'jr_one',
  nickname: 'Ken',
  createdAt: CLUB.createdAt,
  expiresAt: '2026-10-30T00:00:00.000Z',
  status: 'pending' as const,
};
const pending: PendingClubJoin = {
  endpoint: E,
  requestId: application.id,
  requestToken: 'request-token-is-secret',
  clubName: CLUB.name,
  nickname: MEMBER.nickname,
  createdAt: application.createdAt,
  expiresAt: application.expiresAt,
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'X-Club-Api': '1', 'Content-Type': 'application/json' },
  });
const payload = {
  gameId: 'sudoku' as const,
  outcome: 'completed' as const,
  params: { difficulty: 'hard' },
  facts: { elapsedSeconds: 100, hints: 0, mistakes: 0 },
  seed: 's',
  boardDigest: 'sd1:a',
};

describe('managed endpoint boundaries', () => {
  it('accepts one exact Club prefix while rejecting other paths, credentials and query strings', () => {
    expect(isClubEndpoint(E)).toBe(true);
    expect(isClubEndpoint(ORIGIN)).toBe(true);
    for (const bad of [
      `${E}/`,
      `${E}?token=x`,
      `${ORIGIN}/clubs/../other`,
      `${ORIGIN}/clubs/a/b`,
      'https://user:secret@managed.example.com/clubs/c_one',
    ])
      expect(isClubEndpoint(bad)).toBe(false);
  });
  it('takes the Club ID from a root invite fragment and rejects ambiguous IDs', () => {
    expect(inviteFromHref(`${ORIGIN}/join#club=c_one&invite=abcdefghijklmnopqrstuv`)).toEqual({
      endpoint: E,
      token: 'abcdefghijklmnopqrstuv',
    });
    expect(
      inviteFromHref(`${ORIGIN}/join#club=c_one&club=c_two&invite=abcdefghijklmnopqrstuv`),
    ).toBeNull();
    expect(inviteFromHref(`${ORIGIN}/join#club=../evil&invite=abcdefghijklmnopqrstuv`)).toBeNull();
  });
  it('never accepts a service response that would send a member key to a different host', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      json({
        club: CLUB,
        member: MEMBER,
        memberToken: 'secret',
        endpoint: 'https://other.example.com/clubs/c_one',
      }),
    );
    await expect(
      createManagedClient(ORIGIN, 'owner-token', fetcher).connect('c_one'),
    ).rejects.toMatchObject({ code: 'malformed_response' });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]![0]).toBe(`${ORIGIN}/api/v1/managed/clubs/c_one/connect`);
  });
});

describe('requests and owner credentials stay separate from sending memberships', () => {
  it('reuses an active membership or pending receipt when the same invitation is opened again', async () => {
    const kv = createMemoryKV();
    const fetcher = vi.fn();
    await savePendingJoin(pending, kv);
    const request = {
      endpoint: E,
      inviteToken: null,
      nickname: 'Ken',
      allowPending: true as const,
    };
    expect(await joinOrRestore(request, kv, fetcher)).toEqual({ pending });
    await addClubConnection(connection, kv);
    expect(await joinOrRestore(request, kv, fetcher)).toEqual({ connection, restored: true });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('returns a pending request without saving a connection or sending any result', async () => {
    const kv = createMemoryKV();
    const fetcher = vi.fn().mockResolvedValue(
      json(
        {
          status: 'pending',
          club: CLUB,
          request: application,
          requestToken: pending.requestToken,
        },
        202,
      ),
    );
    const outcome = await joinOrRestore(
      { endpoint: E, inviteToken: null, nickname: 'Ken', allowPending: true },
      kv,
      fetcher,
    );
    expect(outcome).toEqual({ pending });
    await savePendingJoin(pending, kv);
    expect(await loadClubConnections(kv)).toEqual([]);
    expect(await createBridge(kv, fetcher).sendResult(payload)).toEqual([]);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('retains all independent updates when a pending request, owner key and name are saved together', async () => {
    const kv = createMemoryKV();
    await addClubConnection(connection, kv);
    const request = { ...pending, endpoint: `${ORIGIN}/clubs/c_two` };
    await Promise.all([
      saveManagedOwner({ origin: ORIGIN, ownerToken: 'owner-token-is-secret' }, kv),
      savePendingJoin(request, kv),
      updateClubName(E, 'Renamed', kv),
      updateClubGames(E, ['sudoku'], kv),
    ]);
    expect(await loadManagedOwner(kv)).toEqual({
      origin: ORIGIN,
      ownerToken: 'owner-token-is-secret',
    });
    expect(await loadPendingJoins(kv)).toEqual([request]);
    expect(await loadClubConnections(kv)).toEqual([
      { ...connection, clubName: 'Renamed', allowedGameIds: ['sudoku'] },
    ]);
  });
  it('preserves existing connections when new metadata is malformed', () => {
    const record = clubConnectionsSchema.validate({
      schemaVersion: 1,
      connections: [connection],
      pending: [{ ...pending, endpoint: 'javascript:alert(1)' }],
      managedOwner: { origin: ORIGIN, ownerToken: 42 },
    });
    expect(record).toEqual({ schemaVersion: 1, connections: [connection] });
  });
  it('forgets a pending request when approval becomes a real membership', async () => {
    const kv = createMemoryKV();
    await savePendingJoin(pending, kv);
    await addClubConnection(connection, kv);
    expect(await loadPendingJoins(kv)).toEqual([]);
    const raw = JSON.parse((await kv.get(STORAGE_KEYS.club))!);
    expect(raw.pending).toBeUndefined();
  });
  it('checks a pending request only via an explicit status call, with its token in the body', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      json({
        status: 'approved',
        club: CLUB,
        member: MEMBER,
        memberToken: pending.requestToken,
      }),
    );
    const status = await createClient(E, null, fetcher).joinRequestStatus(pending.requestToken);
    expect(status.memberToken).toBe(pending.requestToken);
    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toBe(`${E}/api/v1/join-requests/status`);
    expect(url).not.toContain(pending.requestToken);
    expect(JSON.parse(options.body)).toEqual({ requestToken: pending.requestToken });
    expect(options.headers.Authorization).toBeUndefined();
  });
});

describe('Club game selection', () => {
  it('does not queue or send a newly finished game that is excluded', async () => {
    const kv = createMemoryKV();
    await addClubConnection({ ...connection, allowedGameIds: ['minesweeper'] }, kv);
    const fetcher = vi.fn();
    expect(await createBridge(kv, fetcher).sendResult(payload)).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
    expect(await pendingFor(E, kv)).toEqual([]);
  });
  it('drops a queued result locally after learning that the game is excluded', async () => {
    const kv = createMemoryKV();
    await addClubConnection({ ...connection, allowedGameIds: [] }, kv);
    await enqueueResult(
      {
        kind: 'ranking',
        endpoint: E,
        createdAt: CLUB.createdAt,
        clientId: 'operation_one',
        body: {
          ...payload,
          gameId: 'sudoku',
          contractVersion: 1,
          paramsKey: 'hard',
          clientId: 'operation_one',
        },
      },
      kv,
    );
    const fetcher = vi.fn();
    const report = await flushOutbox(E, createClient(E, connection.memberToken, fetcher), kv);
    expect(report.outcomes.map((r) => r.fate)).toEqual(['rejected']);
    expect(fetcher).not.toHaveBeenCalled();
    expect(await pendingFor(E, kv)).toEqual([]);
  });
  it('treats a newly learned server exclusion as terminal instead of blocking following results', async () => {
    const kv = createMemoryKV();
    await addClubConnection(connection, kv);
    const fetcher = vi
      .fn()
      .mockResolvedValue(json({ error: { code: 'game_disabled', message: 'disabled' } }, 403));
    const result = await createBridge(kv, fetcher).sendResult(payload);
    expect(result[0]?.outcome).toBe('rejected');
    expect(await pendingFor(E, kv)).toEqual([]);
  });
  it('retains results through repeated explicit flushes while hosting access can be renewed', async () => {
    const kv = createMemoryKV();
    await addClubConnection(connection, kv);
    const fetcher = vi
      .fn()
      .mockImplementation(async () =>
        json({ error: { code: 'subscription_inactive', message: 'renewable' } }, 403),
      );
    const result = await createBridge(kv, fetcher).sendResult(payload);
    expect(result[0]?.outcome).toBe('queued');
    for (let i = 0; i < 6; i++) {
      const report = await flushOutbox(E, createClient(E, connection.memberToken, fetcher), kv);
      expect(report.blocked).toBe(true);
    }
    const held = await pendingFor(E, kv);
    expect(held).toHaveLength(1);
    expect(held[0]?.attempts).toBeUndefined();
  });
});

it('compares daily boards by every board-defining field and ignores JSON property order', () => {
  const daily: RecordDaily = {
    challengeId: 'ch_one',
    gameId: 'sudoku',
    contractVersion: 1,
    params: { difficulty: 'hard', nested: { x: 1, y: 2 } },
    seed: 'seed',
    boardDigest: 'sd1:a',
    daily: '2026-10-23',
    participantCount: 2,
    axis: { fact: 'elapsedSeconds', direction: 'asc' },
    leader: null,
    me: null,
  };
  expect(dailyComparisonKey(daily)).toBe(
    dailyComparisonKey({
      ...daily,
      challengeId: 'ch_other',
      params: { nested: { y: 2, x: 1 }, difficulty: 'hard' },
    }),
  );
  expect(dailyComparisonKey(daily)).not.toBe(dailyComparisonKey({ ...daily, seed: 'other' }));
  expect(dailyComparisonKey(daily)).not.toBe(
    dailyComparisonKey({ ...daily, boardDigest: 'sd1:b' }),
  );
});
