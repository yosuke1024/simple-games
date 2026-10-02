import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '@/storage/kv';
import { CLUB_CONNECTIONS_MAX, type ClubConnection } from '@/storage/schemas';
import {
  acceptAutoSend,
  addClubConnection,
  loadClubConnections,
  removeClubConnection,
  summarize,
  updateClubName,
  updateNickname,
} from './connections';

const conn = (n: number, extra: Partial<ClubConnection> = {}): ClubConnection => ({
  endpoint: `https://club${n}.example.com`,
  clubId: `c_${n}`,
  clubName: `Club ${n}`,
  memberId: `m_${n}`,
  memberToken: `token-${n}`,
  nickname: 'Ken',
  role: 'member',
  joinedAt: '2026-10-02T00:00:00.000Z',
  ...extra,
});

describe('connections', () => {
  it('adds, replaces by endpoint, renames and removes', async () => {
    const kv = createMemoryKV();
    expect(await loadClubConnections(kv)).toEqual([]);
    await addClubConnection(conn(1), kv);
    await addClubConnection(conn(2), kv);
    const replaced = await addClubConnection(conn(1, { nickname: 'Yo' }), kv);
    expect(replaced.map((c) => c.nickname)).toEqual(['Yo', 'Ken']);
    expect((await updateClubName(conn(2).endpoint, 'Renamed', kv))[1]!.clubName).toBe('Renamed');
    expect(await removeClubConnection(conn(1).endpoint, kv)).toHaveLength(1);
    expect(await loadClubConnections(kv)).toHaveLength(1);
  });

  it('updates the nickname of one connection only', async () => {
    const kv = createMemoryKV();
    await addClubConnection(conn(1), kv);
    await addClubConnection(conn(2), kv);
    const next = await updateNickname(conn(2).endpoint, 'Kenji', kv);
    expect(next.map((c) => c.nickname)).toEqual(['Ken', 'Kenji']);
    expect((await loadClubConnections(kv))[1]!.nickname).toBe('Kenji');
  });

  it('acceptAutoSend marks one connection, keeps it through renames, and touches no other', async () => {
    const kv = createMemoryKV();
    await addClubConnection(conn(1), kv);
    await addClubConnection(conn(2), kv);
    // A connection from before automatic sending has no autoSend.
    expect((await loadClubConnections(kv)).map((c) => c.autoSend)).toEqual([undefined, undefined]);

    const next = await acceptAutoSend(conn(2).endpoint, kv);
    expect(next.map((c) => c.autoSend)).toEqual([undefined, true]);
    expect((await loadClubConnections(kv)).map((c) => c.autoSend)).toEqual([undefined, true]);

    // The consent survives the other writers of the record.
    await updateClubName(conn(2).endpoint, 'Renamed', kv);
    await updateNickname(conn(2).endpoint, 'Kenji', kv);
    const after = (await loadClubConnections(kv))[1]!;
    expect(after).toMatchObject({ clubName: 'Renamed', nickname: 'Kenji', autoSend: true });

    // Idempotent, and an endpoint that is not connected changes nothing.
    await acceptAutoSend(conn(2).endpoint, kv);
    await acceptAutoSend('https://nobody.example.com', kv);
    expect((await loadClubConnections(kv)).map((c) => c.autoSend)).toEqual([undefined, true]);
  });

  it('summarize does not carry the consent flag: the shell needs only names', () => {
    expect(Object.keys(summarize(conn(1, { autoSend: true }))).sort()).toEqual([
      'clubId',
      'clubName',
      'endpoint',
      'nickname',
      'role',
    ]);
  });

  it('refuses an eleventh connection but still replaces an existing one', async () => {
    const kv = createMemoryKV();
    for (let i = 0; i < CLUB_CONNECTIONS_MAX; i++) await addClubConnection(conn(i), kv);
    await expect(addClubConnection(conn(99), kv)).rejects.toThrow('too_many_connections');
    await expect(addClubConnection(conn(3, { nickname: 'New' }), kv)).resolves.toHaveLength(
      CLUB_CONNECTIONS_MAX,
    );
  });

  it('summarize never includes the token', () => {
    const s = summarize(conn(1));
    expect(Object.keys(s).sort()).toEqual(['clubId', 'clubName', 'endpoint', 'nickname', 'role']);
    expect(JSON.stringify(s)).not.toContain('token-1');
  });
});
