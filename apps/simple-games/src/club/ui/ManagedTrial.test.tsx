import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema, STORAGE_KEYS } from '@/storage/schemas';
import { clearLocalData, loadRaw } from '@/storage/repo';
import { loadManagedOwner, saveManagedOwner } from '../storage/connections';
import type { OwnerSpace } from '../api/managed';
import { ManagedScreen } from './ManagedScreen';

vi.mock('@/ui/clubFeatures', () => ({
  MANAGED_CLUB_ORIGIN: 'https://managed.example.com',
  PRIVATE_CLUBS_ENABLED: false,
}));

const ORIGIN = 'https://managed.example.com';
const EXPIRY = '2099-11-23T00:00:00.000Z';
const KEY = 'owner-token-is-secret';
const DATE = '2026-10-23T00:00:00.000Z';
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
      createdAt: DATE,
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

function renderOwner() {
  const handlers = {
    onBack: vi.fn(),
    onOpen: vi.fn().mockResolvedValue(undefined),
    onRecords: vi.fn(),
  };
  const view = render(
    <SettingsProvider initialSettings={{ ...settingsSchema.defaultValue(), language: 'en' }}>
      <ManagedScreen origin={ORIGIN} {...handlers} />
    </SettingsProvider>,
  );
  return { ...view, ...handlers };
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('free Trial and owner benefit screen', () => {
  it('does not create a server owner when the device cannot retain its recovery key', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    renderOwner();
    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Start free Trial' })).not.toBeDisabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Start free Trial' }));
    await screen.findByRole('alert');
    expect(write).toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    expect(await loadManagedOwner()).toBeNull();
  });

  it('starts without an operator key, saves the recovery credential before signup, and creates only one Trial Club', async () => {
    let bootstrapKey = '';
    const fetcher = vi.fn().mockImplementation(async (url: string, options: RequestInit) => {
      if (url.endsWith('/managed/trial')) {
        const saved = await loadManagedOwner();
        expect(saved).toMatchObject({ origin: ORIGIN, pendingTrial: true });
        bootstrapKey = saved!.ownerToken;
        expect(bootstrapKey).toMatch(/^[a-f0-9]{64}$/);
        expect(options.headers).toMatchObject({ Authorization: `Bearer ${bootstrapKey}` });
        return reply(ownerSpace('trial'), 201);
      }
      if (url.endsWith('/managed/clubs'))
        return reply(
          {
            endpoint: `${ORIGIN}/clubs/c_0`,
            club: { id: 'c_0', name: 'Family', createdAt: DATE },
            member: { id: 'm_one', nickname: 'Ken', role: 'owner', joinedAt: DATE },
            memberToken: 'member-secret',
          },
          201,
        );
      if (url.endsWith('/managed/owner')) return reply(ownerSpace('trial', [1]));
      throw new Error('unexpected request');
    });
    vi.stubGlobal('fetch', fetcher);
    const view = renderOwner();
    const user = userEvent.setup();
    const start = await screen.findByRole('button', { name: 'Start free Trial' });
    await waitFor(() => expect(start).not.toBeDisabled());
    expect(fetcher).not.toHaveBeenCalled();
    await user.click(start);
    await screen.findByText('0 of 1 Clubs · 5 members per Club');
    expect(screen.getByText('No time limit')).toBeInTheDocument();
    expect(await loadManagedOwner()).toMatchObject({ ownerToken: bootstrapKey });
    expect((await loadManagedOwner())?.pendingTrial).toBeUndefined();
    const recovery = screen.getByLabelText('Owner recovery key');
    expect(recovery).toHaveAttribute('type', 'password');
    expect(recovery).toHaveValue(bootstrapKey);
    await user.click(screen.getByRole('button', { name: 'Show owner key' }));
    expect(recovery).toHaveAttribute('type', 'text');
    const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    await user.click(screen.getByRole('button', { name: 'Copy owner key' }));
    expect(copy).toHaveBeenCalledWith(bootstrapKey);
    expect(await screen.findByText('Owner key copied')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Club name' }), {
      target: { value: 'Family' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Nickname' }), {
      target: { value: 'Ken' },
    });
    await user.click(screen.getByRole('button', { name: 'Create a Club' }));
    await waitFor(() => expect(view.onOpen).toHaveBeenCalledOnce());
    expect(view.onOpen.mock.calls[0]?.[0]).toMatchObject({
      role: 'owner',
      memberToken: 'member-secret',
    });
    expect(view.onOpen.mock.calls[0]?.[0].autoSend).toBeUndefined();
    expect(screen.getByText('1 of 1 Clubs · 5 members per Club')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create a Club' })).toBeNull();
    expect(fetcher.mock.calls.every(([url]) => !String(url).includes(bootstrapKey))).toBe(true);
  });

  it('resumes a lost Trial reply with exactly the saved key, including after reopening the screen', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('lost response'))
      .mockResolvedValueOnce(reply(ownerSpace('trial')));
    vi.stubGlobal('fetch', fetcher);
    const first = renderOwner();
    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Start free Trial' })).not.toBeDisabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Start free Trial' }));
    await screen.findByText('Could not reach the Club');
    const pending = await loadManagedOwner();
    expect(pending?.pendingTrial).toBe(true);
    expect(pending?.adRemoval).toBeUndefined();
    first.unmount();
    renderOwner();
    const resume = await screen.findByRole('button', { name: 'Continue Trial setup' });
    await waitFor(() => expect(resume).not.toBeDisabled());
    expect(fetcher).toHaveBeenCalledOnce();
    await user.click(resume);
    await screen.findByText('0 of 1 Clubs · 5 members per Club');
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const [, options] of fetcher.mock.calls)
      expect(options.headers.Authorization).toBe(`Bearer ${pending!.ownerToken}`);
    expect((await loadManagedOwner())?.pendingTrial).toBeUndefined();
  });

  it('never recreates a Trial key or benefit from a reply after leaving and resetting local data', async () => {
    let resolve!: (response: Response) => void;
    const response = new Promise<Response>((done) => {
      resolve = done;
    });
    const fetcher = vi.fn().mockReturnValue(response);
    vi.stubGlobal('fetch', fetcher);
    const view = renderOwner();
    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Start free Trial' })).not.toBeDisabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Start free Trial' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    expect((await loadManagedOwner())?.pendingTrial).toBe(true);
    view.unmount();
    await clearLocalData([STORAGE_KEYS.club]);
    await act(async () => {
      resolve(reply(ownerSpace('trial')));
      await response;
    });
    expect(await loadRaw(STORAGE_KEYS.club)).toBeNull();
    expect(await loadManagedOwner()).toBeNull();
  });

  it('shows combined progress across Clubs and applies 49 → 50 → 49 only when explicitly reloaded', async () => {
    await saveManagedOwner({ origin: ORIGIN, ownerToken: KEY });
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(reply(ownerSpace('basic', [25, 24])))
      .mockResolvedValueOnce(reply(ownerSpace('basic', [25, 25])))
      .mockResolvedValueOnce(reply(ownerSpace('basic', [24, 25])));
    vi.stubGlobal('fetch', fetcher);
    renderOwner();
    const user = userEvent.setup();
    await screen.findByText('49 / 50 members');
    expect(screen.getByText('2 of 3 Clubs · 50 members per Club')).toBeInTheDocument();
    expect(screen.getByText('This benefit is not active.')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Owner ad removal' })).toHaveAttribute(
      'value',
      '49',
    );
    expect(fetcher).toHaveBeenCalledOnce();
    expect((await loadManagedOwner())?.adRemoval).toMatchObject({ memberCount: 49, active: false });
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    await screen.findByText('50 / 50 members');
    expect(screen.getByText('Ads are hidden on this device.')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '50 / 50 members');
    expect((await loadManagedOwner())?.adRemoval).toMatchObject({ memberCount: 50, active: true });
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    await screen.findByText('49 / 50 members');
    expect(screen.getByText('This benefit is not active.')).toBeInTheDocument();
    expect((await loadManagedOwner())?.adRemoval).toMatchObject({ memberCount: 49, active: false });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('keeps 50-member progress visible when hosting access expires, with the benefit inactive', async () => {
    const expired = ownerSpace('basic', [25, 25]);
    expired.owner.status = 'expired';
    expired.benefits.adRemoval.active = false;
    await saveManagedOwner({ origin: ORIGIN, ownerToken: KEY });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(expired)));
    renderOwner();
    await screen.findByText('50 / 50 members');
    expect(screen.getByText('This benefit is not active.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Hosting access has expired. Existing records can still be viewed or deleted.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create a Club' })).toBeNull();
    expect((await loadManagedOwner())?.adRemoval?.active).toBe(false);
  });

  it('does not display an active benefit after its verified expiry has passed locally', async () => {
    const expired = ownerSpace('basic', [50]);
    expired.owner.validUntil = '2000-01-01T00:00:00.000Z';
    expired.benefits.adRemoval.validUntil = expired.owner.validUntil;
    await saveManagedOwner({ origin: ORIGIN, ownerToken: KEY });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(expired)));
    renderOwner();
    await screen.findByText('50 / 50 members');
    expect(screen.getByText('This benefit is not active.')).toBeInTheDocument();
    expect(screen.queryByText('Ads are hidden on this device.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create a Club' })).toBeNull();
  });

  it('clears the matching benefit when opening an owned Club returns unauthorized', async () => {
    await saveManagedOwner({ origin: ORIGIN, ownerToken: KEY });
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(reply(ownerSpace('basic', [50])))
      .mockResolvedValueOnce(reply({ error: { code: 'unauthorized', message: 'revoked' } }, 401));
    vi.stubGlobal('fetch', fetcher);
    renderOwner();
    const user = userEvent.setup();
    await screen.findByText('Ads are hidden on this device.');
    await user.click(screen.getByRole('button', { name: /Club 0/ }));
    await screen.findByText('This owner key is not valid.');
    expect((await loadManagedOwner())?.adRemoval).toBeUndefined();
    expect(screen.queryByText('Ads are hidden on this device.')).toBeNull();
  });

  it('keeps the verified benefit on a temporary network failure but clears it after an explicit unauthorized response', async () => {
    await saveManagedOwner({ origin: ORIGIN, ownerToken: KEY });
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(reply(ownerSpace('basic', [50])))
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(reply({ error: { code: 'unauthorized', message: 'revoked' } }, 401));
    vi.stubGlobal('fetch', fetcher);
    renderOwner();
    const user = userEvent.setup();
    await screen.findByText('Ads are hidden on this device.');
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    await screen.findByText('Could not reach the Club');
    expect((await loadManagedOwner())?.adRemoval?.active).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    await screen.findByText('This owner key is not valid.');
    expect((await loadManagedOwner())?.adRemoval).toBeUndefined();
    expect(screen.queryByText('Ads are hidden on this device.')).toBeNull();
    expect(screen.getByLabelText('Owner recovery key')).toHaveValue(KEY);
  });

  it('keeps a rejected Trial bootstrap credential for recovery instead of silently creating another owner', async () => {
    const key = 'b'.repeat(64);
    await saveManagedOwner({ origin: ORIGIN, ownerToken: key, pendingTrial: true });
    const fetcher = vi
      .fn()
      .mockResolvedValue(reply({ error: { code: 'unauthorized', message: 'revoked' } }, 401));
    vi.stubGlobal('fetch', fetcher);
    renderOwner();
    const user = userEvent.setup();
    const resume = await screen.findByRole('button', { name: 'Continue Trial setup' });
    await user.click(resume);
    await screen.findByText('This owner key is not valid.');
    expect((await loadManagedOwner())?.ownerToken).toBe(key);
    expect(screen.queryByRole('button', { name: 'Start free Trial' })).toBeNull();
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
