import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '@/storage/kv';
import { CLUB_CONNECTIONS_MAX, type ClubConnection } from '@/storage/schemas';
import {
  addClubConnection,
  loadClubConnections,
  removeClubConnection,
  summarize,
  updateClubName,
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
