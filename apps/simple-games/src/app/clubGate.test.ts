/**
 * The Club House layer is loaded only when somebody asked for it
 * (docs/architecture/club.md §12-2). These tests inject the loader, so what
 * is asserted is *whether the loader was called*, never what it returns.
 *
 * Failure policy under test: a load that fails resolves to null and is **not**
 * retried. The result is cached like a success, so a broken chunk costs one
 * attempt per app session rather than a retry loop (offline means no request
 * and no loop — docs/OFFLINE_POLICY.md). Reopening the app is the retry.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryKV } from '../storage/kv';
import { STORAGE_KEYS } from '../storage/schemas';
import type { ClubModule } from '../ui/clubBridge';
import {
  clubConnections,
  initClubGate,
  isConnected,
  loadClubAtBoot,
  loadClubForEntry,
  loadClubForInvite,
  setClubLoaderForTesting,
  takeInviteFromLocation,
} from './clubGate';

const fakeModule = { fake: true } as unknown as ClubModule;

const connection = (over: Record<string, unknown> = {}) => ({
  endpoint: 'https://club.example.com',
  clubId: 'club-1',
  clubName: 'Friday Club',
  memberId: 'member-1',
  memberToken: 'secret-token',
  nickname: 'Ada',
  role: 'member',
  joinedAt: '2026-10-02T00:00:00.000Z',
  ...over,
});
const storedConnections = (connections: unknown[]) =>
  createMemoryKV({ [STORAGE_KEYS.club]: JSON.stringify({ schemaVersion: 1, connections }) });

let loader: ReturnType<typeof vi.fn<() => Promise<ClubModule>>>;

beforeEach(() => {
  loader = vi.fn<() => Promise<ClubModule>>(() => Promise.resolve(fakeModule));
  setClubLoaderForTesting(loader);
});

afterEach(() => {
  setClubLoaderForTesting(null);
});

describe('(a) a device that never joined and never asked', () => {
  it('does not load the layer at boot', async () => {
    await initClubGate(createMemoryKV());
    expect(isConnected()).toBe(false);
    expect(loadClubAtBoot()).toBeNull();
    expect(loader).not.toHaveBeenCalled();
  });
});

describe('(b) a stored connection', () => {
  it('loads the layer at boot, once however many times it is asked', async () => {
    await initClubGate(storedConnections([connection()]));
    expect(isConnected()).toBe(true);
    const first = loadClubAtBoot();
    const second = loadClubAtBoot();
    expect(await first).toBe(fakeModule);
    expect(await second).toBe(fakeModule);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('exposes the connections without the member token', async () => {
    await initClubGate(storedConnections([connection()]));
    expect(clubConnections()).toEqual([
      {
        endpoint: 'https://club.example.com',
        clubId: 'club-1',
        clubName: 'Friday Club',
        nickname: 'Ada',
        role: 'member',
      },
    ]);
    expect(JSON.stringify(clubConnections())).not.toContain('secret-token');
  });
});

describe('(c) an invite link', () => {
  const at = (href: string) => {
    const url = new URL(href);
    return { href: url.href, pathname: url.pathname, hash: url.hash };
  };

  it('reads the endpoint and the token, and strips the fragment at once', () => {
    const replaceState = vi.fn();
    const invite = takeInviteFromLocation(
      at('https://club.example.com/join#invite=abcDEF123_-xyz'),
      replaceState,
    );
    expect(invite).toEqual({ endpoint: 'https://club.example.com', token: 'abcDEF123_-xyz' });
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(replaceState).toHaveBeenCalledWith('https://club.example.com/join');
  });

  it('returns null, and leaves the address alone, for an ordinary game link', () => {
    const replaceState = vi.fn();
    expect(takeInviteFromLocation(at('https://pixapps.ai/play/?game=sudoku'), replaceState)).toBe(
      null,
    );
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('returns null for a /join address with no invite in the fragment', () => {
    const replaceState = vi.fn();
    expect(takeInviteFromLocation(at('https://club.example.com/join'), replaceState)).toBeNull();
    expect(
      takeInviteFromLocation(at('https://club.example.com/join#other=1'), replaceState),
    ).toBeNull();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('ignores an invite on a path that is not /join', () => {
    expect(
      takeInviteFromLocation(at('https://club.example.com/play/#invite=abc123'), vi.fn()),
    ).toBeNull();
  });

  it('loads the layer once for an invite, and not again on later asks', async () => {
    expect(await loadClubForInvite()).toBe(fakeModule);
    expect(await loadClubForInvite()).toBe(fakeModule);
    expect(loader).toHaveBeenCalledTimes(1);
  });
});

describe('(d) the two entries', () => {
  it('loads the layer once, shared with every other way in', async () => {
    expect(loader).not.toHaveBeenCalled();
    expect(await loadClubForEntry()).toBe(fakeModule);
    expect(await loadClubForEntry()).toBe(fakeModule);
    expect(await loadClubForInvite()).toBe(fakeModule);
    expect(loader).toHaveBeenCalledTimes(1);
  });
});

describe('(e) a layer that fails to load', () => {
  it('resolves null instead of throwing, and does not retry', async () => {
    loader.mockRejectedValue(new Error('chunk failed'));
    await initClubGate(storedConnections([connection()]));
    await expect(loadClubForEntry()).resolves.toBeNull();
    await expect(loadClubForEntry()).resolves.toBeNull();
    await expect(loadClubAtBoot()).resolves.toBeNull();
    expect(loader).toHaveBeenCalledTimes(1);
  });
});

describe('initClubGate with a broken sg.club record', () => {
  it('survives invalid JSON as "not connected"', async () => {
    await expect(
      initClubGate(createMemoryKV({ [STORAGE_KEYS.club]: '{not json' })),
    ).resolves.toBeUndefined();
    expect(isConnected()).toBe(false);
    expect(loadClubAtBoot()).toBeNull();
  });

  it('keeps the valid connections when one element is broken', async () => {
    await initClubGate(
      storedConnections([
        { endpoint: 'http://192.168.1.2' },
        connection(),
        'junk',
        connection({ endpoint: 'https://other.example.com', clubId: 'club-2' }),
      ]),
    );
    expect(clubConnections().map((c) => c.endpoint)).toEqual([
      'https://club.example.com',
      'https://other.example.com',
    ]);
  });

  it('is "not connected" when every element is broken', async () => {
    await initClubGate(storedConnections([{ nope: true }, 7]));
    expect(isConnected()).toBe(false);
    expect(loadClubAtBoot()).toBeNull();
    expect(loader).not.toHaveBeenCalled();
  });
});
