import { describe, expect, it, vi } from 'vitest';
import { createMemoryKV } from '@/storage/kv';
import type { ClubConnection } from '@/storage/schemas';
import { joinOrRestore } from './join';
import { addClubConnection, departClubConnection, findDeparted } from './storage/connections';

const E = 'https://club.example.com';
const CLUB = { id: 'c_1', name: 'Family', createdAt: 'x' };
const ME = { id: 'm_7', nickname: 'Ken', role: 'owner', joinedAt: '2026-09-09T00:00:00.000Z' };
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'X-Club-Api': '1' } });
const departedConnection: ClubConnection = {
  endpoint: E,
  clubId: 'c_1',
  clubName: 'Old name',
  memberId: 'm_7',
  memberToken: 'old-token',
  nickname: 'Ken',
  role: 'member',
  joinedAt: '2026-09-09T00:00:00.000Z',
};

async function kvWithDeparted() {
  const kv = createMemoryKV();
  await addClubConnection(departedConnection, kv);
  await departClubConnection(E, kv);
  return kv;
}
const asFetch = (f: ReturnType<typeof vi.fn>) => f as unknown as typeof fetch;
const urls = (f: ReturnType<typeof vi.fn>) =>
  f.mock.calls.map(
    (c) => `${(c[1] as RequestInit).method ?? 'GET'} ${String(c[0]).replace(E, '')}`,
  );

describe('joinOrRestore', () => {
  it('with nothing departed it is an ordinary join', async () => {
    const f = vi
      .fn()
      .mockResolvedValue(reply(201, { club: CLUB, member: ME, memberToken: 'new-token' }));
    const out = await joinOrRestore(
      { endpoint: E, inviteToken: null, nickname: 'Ken' },
      createMemoryKV(),
      asFetch(f),
    );
    expect(out.restored).toBe(false);
    expect(urls(f)).toEqual(['POST /api/v1/join']);
    expect(out.connection).toMatchObject({
      memberId: 'm_7',
      memberToken: 'new-token',
      autoSend: true,
    });
  });

  it('restores the departed member when the token lives, and takes the server’s current facts', async () => {
    const kv = await kvWithDeparted();
    const f = vi.fn().mockResolvedValue(
      reply(200, {
        club: { ...CLUB, name: 'New name' },
        me: ME,
        members: [ME],
        memberCount: 1,
      }),
    );
    const out = await joinOrRestore(
      { endpoint: E, inviteToken: null, nickname: 'Ken' },
      kv,
      asFetch(f),
    );
    expect(out.restored).toBe(true);
    expect(urls(f)).toEqual(['GET /api/v1/club']);
    expect(out.connection).toEqual({
      ...departedConnection,
      clubName: 'New name',
      role: 'owner',
      autoSend: true,
    });
  });

  it('renames when the typed name differs from the server’s', async () => {
    const kv = await kvWithDeparted();
    const f = vi
      .fn()
      .mockResolvedValueOnce(reply(200, { club: CLUB, me: ME, members: [ME] }))
      .mockResolvedValueOnce(reply(200, { ...ME, nickname: 'Kenji' }));
    const out = await joinOrRestore(
      { endpoint: E, inviteToken: null, nickname: 'Kenji' },
      kv,
      asFetch(f),
    );
    expect(urls(f)).toEqual(['GET /api/v1/club', 'PATCH /api/v1/me']);
    expect(out.connection.nickname).toBe('Kenji');
    expect(out.connection.memberId).toBe('m_7');
  });

  it.each([
    ['unauthorized', 401],
    ['not_found', 404],
  ])('a %s answer drops the departed entry and joins afresh', async (code, status) => {
    const kv = await kvWithDeparted();
    const f = vi
      .fn()
      .mockResolvedValueOnce(reply(status, { error: { code, message: 'x' } }))
      .mockResolvedValueOnce(
        reply(201, { club: CLUB, member: { ...ME, id: 'm_9' }, memberToken: 'fresh' }),
      );
    const out = await joinOrRestore(
      { endpoint: E, inviteToken: 'a'.repeat(22), nickname: 'Ken' },
      kv,
      asFetch(f),
    );
    expect(out.restored).toBe(false);
    expect(urls(f)).toEqual(['GET /api/v1/club', 'POST /api/v1/join']);
    expect(JSON.parse(String((f.mock.calls[1]![1] as RequestInit).body))).toEqual({
      inviteToken: 'a'.repeat(22),
      nickname: 'Ken',
    });
    expect(out.connection).toMatchObject({ memberId: 'm_9', memberToken: 'fresh' });
    expect(await findDeparted(E, kv)).toBeNull();
  });

  it('a 404 from PATCH /me (server without self-rename) throws and keeps the departed entry', async () => {
    const kv = await kvWithDeparted();
    const f = vi
      .fn()
      .mockResolvedValueOnce(reply(200, { club: CLUB, me: ME, members: [ME] }))
      .mockResolvedValueOnce(reply(404, { error: { code: 'not_found', message: 'x' } }));
    await expect(
      joinOrRestore({ endpoint: E, inviteToken: null, nickname: 'Kenji' }, kv, asFetch(f)),
    ).rejects.toMatchObject({ code: 'not_found' });
    expect(urls(f)).toEqual(['GET /api/v1/club', 'PATCH /api/v1/me']);
    expect(await findDeparted(E, kv)).not.toBeNull();
  });

  it('a network failure throws and changes nothing', async () => {
    const kv = await kvWithDeparted();
    const f = vi.fn().mockRejectedValue(new TypeError('offline'));
    await expect(
      joinOrRestore({ endpoint: E, inviteToken: null, nickname: 'Ken' }, kv, asFetch(f)),
    ).rejects.toMatchObject({ code: 'unreachable' });
    expect(urls(f)).toEqual(['GET /api/v1/club']);
    expect(await findDeparted(E, kv)).not.toBeNull();
  });

  it('a server error other than "gone" throws and keeps the entry', async () => {
    const kv = await kvWithDeparted();
    const f = vi
      .fn()
      .mockResolvedValue(reply(500, { error: { code: 'internal_error', message: 'x' } }));
    await expect(
      joinOrRestore({ endpoint: E, inviteToken: null, nickname: 'Ken' }, kv, asFetch(f)),
    ).rejects.toMatchObject({ code: 'internal_error' });
    expect(await findDeparted(E, kv)).not.toBeNull();
  });
});
