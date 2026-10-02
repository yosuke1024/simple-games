import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '@/storage/kv';
import {
  CLUB_CONNECTIONS_MAX,
  CLUB_DEPARTED_MAX,
  STORAGE_KEYS,
  type ClubConnection,
} from '@/storage/schemas';
import {
  acceptAutoSend,
  addClubConnection,
  departClubConnection,
  findDeparted,
  forgetDeparted,
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

describe('departed Clubs (decision 43)', () => {
  it('Disconnect moves the credentials out of the active list and keeps them', async () => {
    const kv = createMemoryKV();
    await addClubConnection(conn(1, { autoSend: true, role: 'owner' }), kv);
    await addClubConnection(conn(2), kv);
    const next = await departClubConnection(conn(1).endpoint, kv);
    expect(next.map((c) => c.endpoint)).toEqual([conn(2).endpoint]);
    expect(await findDeparted(conn(1).endpoint, kv)).toEqual(
      conn(1, { autoSend: true, role: 'owner' }),
    );
    expect(await findDeparted(conn(2).endpoint, kv)).toBeNull();
  });

  it('every other writer carries the departed list along', async () => {
    const kv = createMemoryKV();
    await addClubConnection(conn(1), kv);
    await addClubConnection(conn(2), kv);
    await departClubConnection(conn(1).endpoint, kv);
    await updateClubName(conn(2).endpoint, 'Renamed', kv);
    await updateNickname(conn(2).endpoint, 'Kenji', kv);
    await acceptAutoSend(conn(2).endpoint, kv);
    await removeClubConnection(conn(2).endpoint, kv);
    expect(await findDeparted(conn(1).endpoint, kv)).not.toBeNull();
  });

  it('adding a connection to a departed Club forgets the departed entry', async () => {
    const kv = createMemoryKV();
    await addClubConnection(conn(1), kv);
    await departClubConnection(conn(1).endpoint, kv);
    await addClubConnection(conn(1, { memberToken: 'fresh' }), kv);
    expect(await findDeparted(conn(1).endpoint, kv)).toBeNull();
    expect((await loadClubConnections(kv))[0]!.memberToken).toBe('fresh');
    // Nothing is left behind: the record is as it was before anyone left.
    expect(JSON.parse((await kv.get(STORAGE_KEYS.club))!)).not.toHaveProperty('departed');
  });

  it('leaving twice keeps one entry for the Club, the latest', async () => {
    const kv = createMemoryKV();
    await addClubConnection(conn(1), kv);
    await departClubConnection(conn(1).endpoint, kv);
    await addClubConnection(conn(1, { memberToken: 'second' }), kv);
    await departClubConnection(conn(1).endpoint, kv);
    expect((await findDeparted(conn(1).endpoint, kv))!.memberToken).toBe('second');
  });

  it('keeps at most ten, the newest', async () => {
    const kv = createMemoryKV();
    for (let n = 1; n <= CLUB_DEPARTED_MAX + 2; n++) {
      await addClubConnection(conn(n), kv);
      await departClubConnection(conn(n).endpoint, kv);
    }
    expect(await findDeparted(conn(1).endpoint, kv)).toBeNull();
    expect(await findDeparted(conn(2).endpoint, kv)).toBeNull();
    expect(await findDeparted(conn(CLUB_DEPARTED_MAX + 2).endpoint, kv)).not.toBeNull();
    expect(await findDeparted(conn(3).endpoint, kv)).not.toBeNull();
  });

  it('forgetDeparted removes one entry and nothing else', async () => {
    const kv = createMemoryKV();
    await addClubConnection(conn(1), kv);
    await addClubConnection(conn(2), kv);
    await departClubConnection(conn(1).endpoint, kv);
    await departClubConnection(conn(2).endpoint, kv);
    await forgetDeparted(conn(1).endpoint, kv);
    expect(await findDeparted(conn(1).endpoint, kv)).toBeNull();
    expect(await findDeparted(conn(2).endpoint, kv)).not.toBeNull();
    // Nothing to forget is not an error.
    await expect(forgetDeparted('https://never.example.com', kv)).resolves.toBeUndefined();
  });

  it('a departed entry is not a connection: it is not in the list the shell reads', async () => {
    const kv = createMemoryKV();
    await addClubConnection(conn(1), kv);
    await departClubConnection(conn(1).endpoint, kv);
    expect(await loadClubConnections(kv)).toEqual([]);
  });
});
