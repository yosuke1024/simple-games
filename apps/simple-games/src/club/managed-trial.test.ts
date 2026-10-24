import { afterEach, describe, expect, it, vi } from 'vitest';
import { createManagedClient, newOwnerKey, type OwnerSpace } from './api/managed';

const ORIGIN = 'https://managed.example.com';
const OWNER_KEY = 'a'.repeat(64);
const EXPIRY = '2099-11-23T00:00:00.000Z';
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'X-Club-Api': '1', 'Content-Type': 'application/json' },
  });

function ownerSpace(plan: 'trial' | 'basic', counts: number[] = []): OwnerSpace {
  const validUntil = plan === 'trial' ? null : EXPIRY;
  const memberCount = counts.reduce((sum, count) => sum + count, 0);
  return {
    owner: { id: 'o_one', plan, validUntil, status: 'active' },
    limits: { maxClubs: plan === 'trial' ? 1 : 3, maxMembersPerClub: plan === 'trial' ? 5 : 50 },
    clubs: counts.map((count, index) => ({
      id: `c_${index}`,
      name: `Club ${index}`,
      endpoint: `${ORIGIN}/clubs/c_${index}`,
      createdAt: '2026-10-23T00:00:00.000Z',
      memberCount: count,
      status: 'ready',
      visibility: 'private',
      approvalRequired: false,
      allowedGameIds: null,
    })),
    benefits: {
      adRemoval: { requiredMembers: 50, memberCount, active: memberCount >= 50, validUntil },
    },
  };
}

afterEach(() => vi.restoreAllMocks());

describe('managed Trial and owner benefit responses', () => {
  it('generates a full 256-bit recovery credential with Web Crypto', () => {
    const random = vi.spyOn(globalThis.crypto, 'getRandomValues');
    const key = newOwnerKey();
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(random.mock.calls[0]?.[0]).toBeInstanceOf(Uint8Array);
    expect(random.mock.calls[0]?.[0]?.byteLength).toBe(32);
  });

  it('starts an indefinite 5-member Trial with only the recovery key in Authorization', async () => {
    const data = ownerSpace('trial');
    const fetcher = vi.fn().mockResolvedValue(reply(data, 201));
    expect(await createManagedClient(ORIGIN, OWNER_KEY, fetcher).startTrial()).toEqual(data);
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toBe(`${ORIGIN}/api/v1/managed/trial`);
    expect(options).toMatchObject({
      method: 'POST',
      headers: { Authorization: `Bearer ${OWNER_KEY}` },
      body: '{}',
    });
    expect(url).not.toContain(OWNER_KEY);
    expect(options.body).not.toContain(OWNER_KEY);
  });

  it('accepts an idempotent replay after the same Trial owner has moved to Basic', async () => {
    const data = ownerSpace('basic', [25, 25]);
    const fetcher = vi.fn().mockResolvedValue(reply(data));
    expect(await createManagedClient(ORIGIN, OWNER_KEY, fetcher).startTrial()).toEqual(data);
  });

  it.each([undefined, 'a'.repeat(32), 'A'.repeat(64), 'z'.repeat(64)])(
    'rejects a non-bootstrap credential before making a Trial request: %s',
    async (key) => {
      const fetcher = vi.fn();
      await expect(createManagedClient(ORIGIN, key, fetcher).startTrial()).rejects.toMatchObject({
        code: 'invalid_request',
      });
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it.each([49, 50, 100])('validates the active-member total at %i', async (count) => {
    const data = ownerSpace('basic', count > 50 ? [50, count - 50] : [count]);
    const fetcher = vi.fn().mockResolvedValue(reply(data));
    expect(
      (await createManagedClient(ORIGIN, OWNER_KEY, fetcher).owner()).benefits.adRemoval,
    ).toEqual({
      requiredMembers: 50,
      memberCount: count,
      active: count >= 50,
      validUntil: EXPIRY,
    });
  });

  it('does not count a Club that is still provisioning', async () => {
    const data = ownerSpace('basic', [49, 1]);
    data.clubs[1]!.status = 'provisioning';
    data.benefits.adRemoval.memberCount = 49;
    data.benefits.adRemoval.active = false;
    const fetcher = vi.fn().mockResolvedValue(reply(data));
    expect(
      (await createManagedClient(ORIGIN, OWNER_KEY, fetcher).owner()).benefits.adRemoval.active,
    ).toBe(false);
  });

  it('accepts an expired entitlement with 50 current members and an inactive benefit', async () => {
    const data = ownerSpace('basic', [50]);
    data.owner.status = 'expired';
    data.benefits.adRemoval.active = false;
    const fetcher = vi.fn().mockResolvedValue(reply(data));
    expect(await createManagedClient(ORIGIN, OWNER_KEY, fetcher).owner()).toEqual(data);
  });

  const invalid = [
    [
      'unsupported plan',
      (data: OwnerSpace) => ({ ...data, owner: { ...data.owner, plan: 'plus' } }),
    ],
    ['missing benefits', (data: OwnerSpace) => ({ ...data, benefits: undefined })],
    [
      'wrong threshold',
      (data: OwnerSpace) => ({
        ...data,
        benefits: { adRemoval: { ...data.benefits.adRemoval, requiredMembers: 49 } },
      }),
    ],
    [
      'active below threshold',
      (data: OwnerSpace) => ({
        ...data,
        benefits: { adRemoval: { ...data.benefits.adRemoval, active: true } },
      }),
    ],
    [
      'inconsistent membership total',
      (data: OwnerSpace) => ({
        ...data,
        benefits: { adRemoval: { ...data.benefits.adRemoval, memberCount: 48 } },
      }),
    ],
    [
      'mismatched benefit expiry',
      (data: OwnerSpace) => ({
        ...data,
        benefits: {
          adRemoval: { ...data.benefits.adRemoval, validUntil: '2099-12-23T00:00:00.000Z' },
        },
      }),
    ],
    [
      'Basic without expiry',
      (data: OwnerSpace) => ({
        ...data,
        owner: { ...data.owner, validUntil: null },
        benefits: { adRemoval: { ...data.benefits.adRemoval, validUntil: null } },
      }),
    ],
    [
      'invalid expiry',
      (data: OwnerSpace) => ({ ...data, owner: { ...data.owner, validUntil: 'later' } }),
    ],
    [
      'wrong plan capacity',
      (data: OwnerSpace) => ({ ...data, limits: { maxClubs: 1, maxMembersPerClub: 5 } }),
    ],
  ] as const;
  it.each(invalid)('rejects %s without trusting the benefit', async (_reason, change) => {
    const fetcher = vi.fn().mockResolvedValue(reply(change(ownerSpace('basic', [49]))));
    await expect(createManagedClient(ORIGIN, OWNER_KEY, fetcher).owner()).rejects.toMatchObject({
      code: 'malformed_response',
    });
  });

  it('does not accept Basic capacity for a Trial owner', async () => {
    const data = ownerSpace('trial');
    data.limits = { maxClubs: 3, maxMembersPerClub: 50 };
    const fetcher = vi.fn().mockResolvedValue(reply(data));
    await expect(createManagedClient(ORIGIN, OWNER_KEY, fetcher).owner()).rejects.toMatchObject({
      code: 'malformed_response',
    });
  });

  it.each([
    ['Trial above the member cap', ownerSpace('trial', [50])],
    ['Trial with a second Club', ownerSpace('trial', [1, 1])],
    ['Basic above the member cap', ownerSpace('basic', [51])],
    ['Basic with a fourth Club', ownerSpace('basic', [1, 1, 1, 1])],
  ])('rejects %s even when the reported benefit matches the counts', async (_reason, data) => {
    const fetcher = vi.fn().mockResolvedValue(reply(data));
    await expect(createManagedClient(ORIGIN, OWNER_KEY, fetcher).owner()).rejects.toMatchObject({
      code: 'malformed_response',
    });
  });

  it('rejects duplicated Clubs even when their doubled count agrees with the benefit', async () => {
    const data = ownerSpace('basic', [25, 25]);
    data.clubs[1] = data.clubs[0]!;
    const fetcher = vi.fn().mockResolvedValue(reply(data));
    await expect(createManagedClient(ORIGIN, OWNER_KEY, fetcher).owner()).rejects.toMatchObject({
      code: 'malformed_response',
    });
  });
});
