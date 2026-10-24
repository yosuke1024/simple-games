/**
 * The device's own store (Capacitor Preferences) swallows a failed read as "nothing
 * stored". A restore that replaces a Club membership reads the Club outbox through the
 * reporting adapter instead, so a failed read stops the restore rather than letting
 * the old member's queued results stay to be sent as the restored one.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({ map: new Map<string, string>(), failOn: null as string | null }));
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(({ key }: { key: string }) =>
      key === store.failOn
        ? Promise.reject(new Error('read failed'))
        : Promise.resolve({ value: store.map.get(key) ?? null }),
    ),
    set: vi.fn(({ key, value }: { key: string; value: string }) => {
      store.map.set(key, value);
      return Promise.resolve();
    }),
    remove: vi.fn(({ key }: { key: string }) => {
      store.map.delete(key);
      return Promise.resolve();
    }),
  },
}));

import { createMemoryKV } from '../storage/kv';
import { STORAGE_KEYS } from '../storage/schemas';
import { createBackup } from './export';
import { serializeBackup } from './format';
import { applyBackup, readBackup } from './restore';

const connection = {
  endpoint: 'https://club.pixapps.ai/clubs/c_family0001',
  clubId: 'c_family0001',
  clubName: 'Family',
  memberId: 'm_one',
  memberToken: 'member-token-0123456789',
  nickname: 'Ken',
  role: 'member' as const,
  joinedAt: '2026-10-23T00:00:00.000Z',
};

beforeEach(() => {
  store.map.clear();
  store.failOn = null;
});

describe('restoring over a Club outbox the device cannot read', () => {
  it('fails and leaves the device as it was', async () => {
    const file = serializeBackup(
      await createBackup(
        { appVersion: 'test', platform: 'android', now: new Date('2026-10-24T00:00:00Z') },
        createMemoryKV({
          [STORAGE_KEYS.club]: JSON.stringify({
            schemaVersion: 1,
            connections: [{ ...connection, memberId: 'm_someone_else' }],
          }),
        }),
      ),
    );
    const before = JSON.stringify({ schemaVersion: 1, connections: [connection] });
    store.map.set(STORAGE_KEYS.club, before);
    store.failOn = STORAGE_KEYS.clubOutbox;
    const read = await readBackup(file);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(await applyBackup(read.prepared)).toBe('failed');
    expect(store.map.get(STORAGE_KEYS.club)).toBe(before);
  });
});
