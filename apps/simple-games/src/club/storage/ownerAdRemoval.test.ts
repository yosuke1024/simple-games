import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Preferences } from '@capacitor/preferences';
import { createBackup } from '@/backup/export';
import {
  initAdRemoval,
  isAdRemovalActive,
  isAdRemovalPurchased,
  isManagedOwnerAdRemovalPersisted,
  purchaseAdRemoval,
  resetAdRemovalForTesting,
  restoreAdRemoval,
  setAdRemovalStore,
  subscribeAdRemoval,
} from '@/monetization/adRemoval';
import { createMemoryKV, type KVStore } from '@/storage/kv';
import { clearLocalData } from '@/storage/repo';
import {
  clubConnectionsSchema,
  STORAGE_KEYS,
  type ManagedAdRemovalBenefit,
  type ManagedClubOwner,
} from '@/storage/schemas';
import {
  clearManagedOwnerAdRemoval,
  loadManagedOwner,
  saveManagedOwner,
  saveVerifiedManagedOwner,
} from './connections';

vi.mock('@/ui/clubFeatures', () => ({ MANAGED_CLUB_ORIGIN: 'https://managed.example' }));
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(() => Promise.resolve({ value: null })),
    set: vi.fn(() => Promise.resolve()),
    remove: vi.fn(() => Promise.resolve()),
  },
}));

const owner = { origin: 'https://managed.example', ownerToken: 'owner-key-0123456789' };
const benefit = (extra: Partial<ManagedAdRemovalBenefit> = {}): ManagedAdRemovalBenefit => ({
  requiredMembers: 50,
  memberCount: 50,
  active: true,
  validUntil: '2026-11-23T00:00:00.000Z',
  ...extra,
});
const cached = (managedOwner: ManagedClubOwner) => ({
  [STORAGE_KEYS.club]: JSON.stringify({ schemaVersion: 1, connections: [], managedOwner }),
});

beforeEach(() => {
  vi.mocked(Preferences.get).mockReset().mockResolvedValue({ value: null });
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-23T00:00:00.000Z'));
});
afterEach(() => {
  resetAdRemovalForTesting();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('managed owner ad-removal cache', () => {
  it('activates at 50 after a verified save, without writing or claiming a purchase', async () => {
    const kv = createMemoryKV();
    await initAdRemoval(kv);
    await saveManagedOwner(owner, kv);
    expect(isAdRemovalActive()).toBe(false);
    expect(await saveVerifiedManagedOwner(owner, benefit(), kv)).toBe(true);
    expect(isAdRemovalActive()).toBe(true);
    expect(isAdRemovalPurchased()).toBe(false);
    expect(await kv.get(STORAGE_KEYS.iap)).toBeNull();
    expect(await isManagedOwnerAdRemovalPersisted()).toBe(true);
  });

  it('boots offline from this device cache and makes no server request', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const kv = createMemoryKV(cached({ ...owner, adRemoval: benefit() }));
    await initAdRemoval(kv);
    expect(isAdRemovalActive()).toBe(true);
    expect(isAdRemovalPurchased()).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('suppresses ads when the real Preferences owner-cache read fails without claiming purchase', async () => {
    vi.mocked(Preferences.get).mockImplementation(({ key }) =>
      key === STORAGE_KEYS.club
        ? Promise.reject(new Error('storage unavailable'))
        : Promise.resolve({ value: null }),
    );
    await initAdRemoval();
    expect(isAdRemovalActive()).toBe(true);
    expect(isAdRemovalPurchased()).toBe(false);
  });

  it('revokes on a below-50 answer and keeps it revoked after another offline boot', async () => {
    const kv = createMemoryKV(cached({ ...owner, adRemoval: benefit() }));
    await initAdRemoval(kv);
    await saveVerifiedManagedOwner(owner, benefit({ memberCount: 49, active: false }), kv);
    expect(isAdRemovalActive()).toBe(false);
    await initAdRemoval(kv);
    expect(isAdRemovalActive()).toBe(false);
  });

  it('expires at the server hosting deadline and notifies already-mounted ad slots', async () => {
    const kv = createMemoryKV(
      cached({ ...owner, adRemoval: benefit({ validUntil: '2026-10-23T00:00:01.000Z' }) }),
    );
    await initAdRemoval(kv);
    const listener = vi.fn();
    subscribeAdRemoval(listener);
    await vi.advanceTimersByTimeAsync(999);
    expect(isAdRemovalActive()).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(isAdRemovalActive()).toBe(false);
    expect(listener).toHaveBeenCalled();
  });

  it.each([
    { ...owner, origin: 'https://self-hosted.example', adRemoval: benefit() },
    { ...owner, pendingTrial: true as const, adRemoval: benefit() },
    { ...owner, adRemoval: benefit({ validUntil: null }) },
    { ...owner, adRemoval: benefit({ validUntil: 'not-a-date' }) },
    { ...owner, adRemoval: benefit({ validUntil: '2026-10-23T00:00:00.000Z' }) },
    { ...owner, adRemoval: benefit({ memberCount: 49 }) },
  ])('never grants from an untrusted, pending, invalid or expired cache: %j', async (record) => {
    await initAdRemoval(createMemoryKV(cached(record)));
    expect(isAdRemovalActive()).toBe(false);
  });

  it('persists a pending Trial key without a benefit, then verifies that same key', async () => {
    const kv = createMemoryKV();
    await initAdRemoval(kv);
    const pending = { ...owner, pendingTrial: true as const, adRemoval: benefit() };
    await saveManagedOwner(pending, kv);
    expect(await loadManagedOwner(kv)).toEqual({ ...owner, pendingTrial: true });
    expect(isAdRemovalActive()).toBe(false);
    await saveVerifiedManagedOwner(
      pending,
      benefit({ memberCount: 0, active: false, validUntil: null }),
      kv,
    );
    expect(await loadManagedOwner(kv)).not.toHaveProperty('pendingTrial');
    expect(isAdRemovalActive()).toBe(false);
  });

  it('replacement, forgetting and unauthorized credentials cannot retain an old benefit', async () => {
    const kv = createMemoryKV(cached({ ...owner, adRemoval: benefit() }));
    await initAdRemoval(kv);
    const replacement = { ...owner, ownerToken: 'replacement-key-0123456789' };
    await saveManagedOwner(replacement, kv);
    expect(isAdRemovalActive()).toBe(false);
    expect(await saveVerifiedManagedOwner(owner, benefit(), kv)).toBe(false);
    await saveVerifiedManagedOwner(replacement, benefit(), kv);
    expect(await clearManagedOwnerAdRemoval(owner, kv)).toBe(false);
    expect(isAdRemovalActive()).toBe(true);
    await clearManagedOwnerAdRemoval(replacement, kv);
    expect(isAdRemovalActive()).toBe(false);
    await saveVerifiedManagedOwner(replacement, benefit(), kv);
    await saveManagedOwner(null, kv);
    expect(isAdRemovalActive()).toBe(false);
    expect(await saveVerifiedManagedOwner(replacement, benefit(), kv)).toBe(false);
    expect(await loadManagedOwner(kv)).toBeNull();
  });

  it('Reset clears the cache and runtime; an old owner response cannot recreate either', async () => {
    const kv = createMemoryKV(cached({ ...owner, adRemoval: benefit() }));
    await initAdRemoval(kv);
    await clearLocalData([STORAGE_KEYS.club], kv);
    expect(isAdRemovalActive()).toBe(false);
    await initAdRemoval(kv); // Settings Reset's existing runtime reinitialization.
    expect(await saveVerifiedManagedOwner(owner, benefit(), kv)).toBe(false);
    expect(await loadManagedOwner(kv)).toBeNull();
    expect(isAdRemovalActive()).toBe(false);
  });

  it('does not publish a pending grant when Reset was queued while its write was in flight', async () => {
    const memory = createMemoryKV(cached(owner));
    await initAdRemoval(memory);
    let enter!: () => void;
    let release!: () => void;
    const entered = new Promise<void>((resolve) => (enter = resolve));
    const blocked = new Promise<void>((resolve) => (release = resolve));
    const kv: KVStore = {
      ...memory,
      set: async (key, value) => {
        enter();
        await blocked;
        await memory.set(key, value);
      },
    };
    const observed: boolean[] = [];
    subscribeAdRemoval(() => observed.push(isAdRemovalActive()));
    const saving = saveVerifiedManagedOwner(owner, benefit(), kv);
    await entered;
    const resetting = clearLocalData([STORAGE_KEYS.club], kv);
    release();
    expect(await saving).toBe(false);
    await resetting;
    expect(observed).not.toContain(true);
    expect(await memory.get(STORAGE_KEYS.club)).toBeNull();
    expect(isAdRemovalActive()).toBe(false);
  });

  it('does not grant a benefit or start a Trial with a key that failed to persist', async () => {
    const memory = createMemoryKV(cached(owner));
    const kv: KVStore = { ...memory, set: () => Promise.resolve() };
    await initAdRemoval(kv);
    expect(await saveVerifiedManagedOwner(owner, benefit(), kv)).toBe(false);
    expect(isAdRemovalActive()).toBe(false);
    await expect(saveManagedOwner({ ...owner, pendingTrial: true }, kv)).rejects.toThrow(
      'owner_key_not_saved',
    );
  });

  it('does not overwrite unknown credentials when an owner update cannot read storage', async () => {
    const memory = createMemoryKV(cached({ ...owner, adRemoval: benefit() }));
    await initAdRemoval(memory);
    const set = vi.fn(memory.set);
    const kv: KVStore = {
      ...memory,
      get: () => Promise.reject(new Error('storage unavailable')),
      set,
    };
    expect(await saveVerifiedManagedOwner(owner, benefit({ memberCount: 60 }), kv)).toBe(false);
    expect(set).not.toHaveBeenCalled();
    expect(isAdRemovalActive()).toBe(true);
    expect(await loadManagedOwner(memory)).toEqual({ ...owner, adRemoval: benefit() });
  });

  it.each(['401', 'below50'] as const)(
    'revokes the current runtime benefit on %s even if its local record cannot be read',
    async (reason) => {
      const memory = createMemoryKV(cached({ ...owner, adRemoval: benefit() }));
      await initAdRemoval(memory);
      const set = vi.fn(memory.set);
      const kv: KVStore = {
        ...memory,
        get: () => Promise.reject(new Error('storage unavailable')),
        set,
      };
      const listener = vi.fn();
      subscribeAdRemoval(listener);
      const saved =
        reason === '401'
          ? await clearManagedOwnerAdRemoval(owner, kv)
          : await saveVerifiedManagedOwner(owner, benefit({ memberCount: 49, active: false }), kv);
      expect(saved).toBe(false);
      expect(isAdRemovalActive()).toBe(false);
      expect(isAdRemovalPurchased()).toBe(false);
      expect(listener).toHaveBeenCalled();
      // The denial is applied in memory; unreadable storage is never replaced
      // with defaults, nor is the failed persistence reported as successful.
      expect(set).not.toHaveBeenCalled();
      expect(await loadManagedOwner(memory)).toEqual({ ...owner, adRemoval: benefit() });
    },
  );

  it.each(['401', 'below50'] as const)(
    'does not let a stale %s revoke a replacement key when storage is unreadable',
    async (reason) => {
      const memory = createMemoryKV(cached({ ...owner, adRemoval: benefit() }));
      await initAdRemoval(memory);
      const replacement = { ...owner, ownerToken: 'replacement-key-0123456789' };
      await saveManagedOwner(replacement, memory);
      await saveVerifiedManagedOwner(replacement, benefit(), memory);
      const set = vi.fn(memory.set);
      const kv: KVStore = {
        ...memory,
        get: () => Promise.reject(new Error('storage unavailable')),
        set,
      };
      const listener = vi.fn();
      subscribeAdRemoval(listener);
      for (const stale of [owner, { ...replacement, origin: 'https://another.example' }]) {
        const saved =
          reason === '401'
            ? await clearManagedOwnerAdRemoval(stale, kv)
            : await saveVerifiedManagedOwner(
                stale,
                benefit({ memberCount: 49, active: false }),
                kv,
              );
        expect(saved).toBe(false);
        expect(isAdRemovalActive()).toBe(true);
      }
      expect(listener).not.toHaveBeenCalled();
      expect(set).not.toHaveBeenCalled();
      expect(await loadManagedOwner(memory)).toEqual({ ...replacement, adRemoval: benefit() });
    },
  );

  it.each(['purchase', 'restore'] as const)(
    'keeps the independent store %s valid after owner benefit revocation',
    async (method) => {
      const kv = createMemoryKV(cached({ ...owner, adRemoval: benefit() }));
      await initAdRemoval(kv);
      const storeAction = vi.fn(() => Promise.resolve(true));
      setAdRemovalStore({
        isAvailable: () => true,
        getPrice: () => Promise.resolve('$3.99'),
        purchase: storeAction,
        restore: storeAction,
      });
      expect(await (method === 'purchase' ? purchaseAdRemoval() : restoreAdRemoval())).toBe(true);
      expect(storeAction).toHaveBeenCalledOnce();
      await clearManagedOwnerAdRemoval(owner, kv);
      expect(isAdRemovalPurchased()).toBe(true);
      expect(isAdRemovalActive()).toBe(true);
      await initAdRemoval(kv);
      expect(isAdRemovalPurchased()).toBe(true);
      expect(isAdRemovalActive()).toBe(true);
    },
  );

  it('exports the owner key in a backup, never the benefit (2026-10-24)', async () => {
    const kv = createMemoryKV(cached({ ...owner, adRemoval: benefit() }));
    const backup = await createBackup({ appVersion: 'test', platform: 'web' }, kv);
    expect(backup.data).toHaveProperty([STORAGE_KEYS.club, 'managedOwner'], owner);
    expect(JSON.stringify(backup)).not.toContain('adRemoval');
    expect(
      clubConnectionsSchema.validate(JSON.parse((await kv.get(STORAGE_KEYS.club))!)),
    ).toHaveProperty('managedOwner.adRemoval.active', true);
  });
});
