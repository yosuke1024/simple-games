import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { catalogs } from '../i18n';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema, STORAGE_KEYS } from '@/storage/schemas';
import { clearLocalData, loadRaw } from '@/storage/repo';
import {
  addClubConnection,
  loadClubConnections,
  loadManagedOwner,
  loadPendingJoins,
  saveManagedOwner,
  savePendingJoin,
} from '../storage/connections';
import { ClubRoot } from './ClubRoot';

const flags = vi.hoisted(() => ({ origin: 'https://managed.example.com' as string | null }));
vi.mock('@/ui/clubFeatures', () => ({
  PRIVATE_CLUBS_ENABLED: false,
  get MANAGED_CLUB_ORIGIN() {
    return flags.origin;
  },
}));
const ORIGIN = 'https://managed.example.com',
  E = `${ORIGIN}/clubs/c_one`;
const CLUB = { id: 'c_one', name: 'Family', createdAt: '2026-10-23T00:00:00.000Z' };
const MEMBER = { id: 'm_one', nickname: 'Ken', role: 'member', joinedAt: CLUB.createdAt };
const SETTINGS = { visibility: 'public', approvalRequired: true, allowedGameIds: ['sudoku'] };
const metadata = {
  id: CLUB.id,
  name: CLUB.name,
  endpoint: E,
  createdAt: CLUB.createdAt,
  memberCount: 1,
  status: 'ready',
  ...SETTINGS,
};
const application = {
  id: 'jr_one',
  nickname: 'Ken',
  createdAt: CLUB.createdAt,
  expiresAt: '2026-10-30T00:00:00.000Z',
  status: 'pending',
};
const token = 'request-token-is-secret';
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'X-Club-Api': '1', 'Content-Type': 'application/json' },
  });
const owner = {
  owner: { id: 'o_one', plan: 'basic', validUntil: '2026-11-23T00:00:00.000Z', status: 'active' },
  limits: { maxClubs: 3, maxMembersPerClub: 50 },
  clubs: [] as unknown[],
};
function renderRoot() {
  const handlers = { onBack: vi.fn(), onPlayChallenge: vi.fn(), onConnectionsChanged: vi.fn() };
  render(
    <SettingsProvider initialSettings={{ ...settingsSchema.defaultValue(), language: 'en' }}>
      <ClubRoot entry="settings" {...handlers} />
    </SettingsProvider>,
  );
  return handlers;
}
beforeEach(() => {
  localStorage.clear();
  flags.origin = ORIGIN;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('managed Club flows', () => {
  it('does not restore an owner key from a delayed reply after leaving the screen and resetting data', async () => {
    let resolve!: (response: Response) => void;
    const response = new Promise<Response>((done) => {
      resolve = done;
    });
    const fetcher = vi.fn().mockReturnValue(response);
    vi.stubGlobal('fetch', fetcher);
    renderRoot();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Owner space' }));
    fireEvent.change(await screen.findByLabelText('Owner key'), {
      target: { value: 'owner-token-is-secret' },
    });
    await user.click(screen.getByRole('button', { name: 'Open owner space' }));
    expect(fetcher).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await clearLocalData([STORAGE_KEYS.club]);
    await act(async () => {
      resolve(reply(owner));
      await response;
    });
    expect(await loadRaw(STORAGE_KEYS.club)).toBeNull();
    expect(await loadManagedOwner()).toBeNull();
  });

  it('does not restore a membership from delayed approval after leaving and resetting data', async () => {
    await savePendingJoin({
      endpoint: E,
      requestId: application.id,
      requestToken: token,
      clubName: CLUB.name,
      nickname: MEMBER.nickname,
      createdAt: application.createdAt,
      expiresAt: application.expiresAt,
    });
    let resolve!: (response: Response) => void;
    const response = new Promise<Response>((done) => {
      resolve = done;
    });
    const fetcher = vi.fn().mockReturnValue(response);
    vi.stubGlobal('fetch', fetcher);
    renderRoot();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Join requests' }));
    await user.click(screen.getByRole('button', { name: 'Check request' }));
    expect(fetcher).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await clearLocalData([STORAGE_KEYS.club]);
    await act(async () => {
      resolve(reply({ status: 'approved', club: CLUB, member: MEMBER, memberToken: token }));
      await response;
    });
    expect(await loadRaw(STORAGE_KEYS.club)).toBeNull();
    expect(await loadClubConnections()).toEqual([]);
  });

  it('opens an already joined directory Club with the same credentials and no second join', async () => {
    await addClubConnection({
      endpoint: E,
      clubId: CLUB.id,
      clubName: CLUB.name,
      memberId: MEMBER.id,
      memberToken: token,
      nickname: MEMBER.nickname,
      role: 'member',
      joinedAt: CLUB.createdAt,
      autoSend: true,
    });
    const fetcher = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/managed/directory')) return reply({ clubs: [metadata], nextCursor: null });
      if (url.endsWith('/club'))
        return reply({ club: CLUB, me: MEMBER, members: [MEMBER], memberCount: 1 });
      if (url.endsWith('/settings')) return reply(SETTINGS);
      return reply([]);
    });
    vi.stubGlobal('fetch', fetcher);
    renderRoot();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'All Clubs' }));
    await user.click(screen.getByRole('button', { name: 'Find a Club' }));
    await user.click(await screen.findByRole('button', { name: 'Play' }));
    await screen.findByRole('heading', { name: CLUB.name });
    expect(await loadClubConnections()).toHaveLength(1);
    expect((await loadClubConnections())[0]?.memberToken).toBe(token);
    expect(fetcher.mock.calls.some(([url]) => String(url).endsWith('/join'))).toBe(false);
  });
  it('keeps managed discovery and owner entry hidden with no service configured, with zero requests', async () => {
    flags.origin = null;
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    renderRoot();
    await screen.findByRole('button', { name: 'Join the Public Club House' });
    expect(screen.queryByRole('button', { name: 'Owner space' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Find a Club' })).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('shows disclosure before a listed approval request, persists it without membership, then joins only after an explicit check', async () => {
    const fetcher = vi.fn().mockImplementation(async (url: string, options: RequestInit) => {
      if (url.endsWith('/managed/directory')) return reply({ clubs: [metadata], nextCursor: null });
      if (url.endsWith('/admission'))
        return reply({ ...SETTINGS, club: { id: CLUB.id, name: CLUB.name }, memberCount: 1 });
      if (url.endsWith('/join'))
        return reply(
          { status: 'pending', club: CLUB, request: application, requestToken: token },
          202,
        );
      if (url.endsWith('/join-requests/status'))
        return reply({ status: 'approved', club: CLUB, member: MEMBER, memberToken: token });
      if (url.endsWith('/club'))
        return reply({ club: CLUB, me: MEMBER, members: [MEMBER], memberCount: 2 });
      if (url.endsWith('/settings')) return reply(SETTINGS);
      if (options.method === 'GET') return reply([]);
      return reply({ error: { code: 'not_found', message: 'missing' } }, 404);
    });
    vi.stubGlobal('fetch', fetcher);
    renderRoot();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Find a Club' }));
    await user.click(await screen.findByRole('button', { name: 'Request to join' }));
    expect(await screen.findByText(catalogs.en.clubManagedJoinDisclosure)).toBeInTheDocument();
    const join = await screen.findByRole('button', { name: 'Request to join' });
    expect(join).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Nickname' }), 'Ken');
    await user.click(join);
    await screen.findByRole('button', { name: 'Check request' });
    expect(await loadClubConnections()).toEqual([]);
    expect((await loadPendingJoins())[0]?.requestToken).toBe(token);
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('/join-requests/status'))).toBe(
      false,
    );
    await user.click(screen.getByRole('button', { name: 'Check request' }));
    await waitFor(async () =>
      expect((await loadClubConnections())[0]).toMatchObject({
        endpoint: E,
        memberToken: token,
        autoSend: true,
      }),
    );
    expect(await loadPendingJoins()).toEqual([]);
    expect(
      fetcher.mock.calls.filter(([url]) => String(url).includes('/join-requests/status')),
    ).toHaveLength(1);
  });

  it.each(['Check request', 'Cancel request'])(
    'forgets a pruned pending receipt on an explicit %s',
    async (action) => {
      await savePendingJoin({
        endpoint: E,
        requestId: application.id,
        requestToken: token,
        clubName: CLUB.name,
        nickname: MEMBER.nickname,
        createdAt: application.createdAt,
        expiresAt: application.expiresAt,
      });
      const fetcher = vi
        .fn()
        .mockResolvedValue(
          reply({ error: { code: 'unauthorized', message: 'request expired' } }, 401),
        );
      vi.stubGlobal('fetch', fetcher);
      renderRoot();
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: 'Join requests' }));
      await user.click(await screen.findByRole('button', { name: action }));
      await screen.findByText('This request has expired.');
      expect(await loadPendingJoins()).toEqual([]);
      expect(await loadClubConnections()).toEqual([]);
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );

  it('keeps a pending receipt after a failed connection', async () => {
    await savePendingJoin({
      endpoint: E,
      requestId: application.id,
      requestToken: token,
      clubName: CLUB.name,
      nickname: MEMBER.nickname,
      createdAt: application.createdAt,
      expiresAt: application.expiresAt,
    });
    const fetcher = vi.fn().mockRejectedValue(new TypeError('offline'));
    vi.stubGlobal('fetch', fetcher);
    renderRoot();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Join requests' }));
    await user.click(await screen.findByRole('button', { name: 'Check request' }));
    await screen.findByText('Could not reach the Club');
    expect(await loadPendingJoins()).toHaveLength(1);
  });

  it('validates an owner key before storing it and never puts it in a URL', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(reply({ error: { code: 'unauthorized', message: 'bad key' } }, 401));
    vi.stubGlobal('fetch', fetcher);
    renderRoot();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Owner space' }));
    const keyField = await screen.findByLabelText('Owner key');
    expect(keyField).toHaveAttribute('type', 'password');
    await user.type(keyField, 'owner-token-not-valid');
    await user.click(screen.getByRole('button', { name: 'Open owner space' }));
    await screen.findByText('This owner key is not valid.');
    expect(await loadManagedOwner()).toBeNull();
    expect(fetcher.mock.calls[0]![0]).not.toContain('owner-token-not-valid');
    expect(fetcher.mock.calls[0]![1].headers.Authorization).toBe('Bearer owner-token-not-valid');
  });

  it('creates a Basic Club with an idempotency key and asks separately for automatic-send consent', async () => {
    await saveManagedOwner({ origin: ORIGIN, ownerToken: 'owner-token-is-secret' });
    let created = false;
    const fetcher = vi.fn().mockImplementation(async (url: string, options: RequestInit) => {
      if (url.endsWith('/managed/owner'))
        return reply({ ...owner, clubs: created ? [metadata] : [] });
      if (url.endsWith('/managed/clubs')) {
        created = true;
        return reply(
          {
            club: CLUB,
            member: { ...MEMBER, role: 'owner' },
            memberToken: 'owner-member-token',
            endpoint: E,
          },
          201,
        );
      }
      if (url.endsWith('/club'))
        return reply({
          club: CLUB,
          me: { ...MEMBER, role: 'owner' },
          members: [{ ...MEMBER, role: 'owner' }],
          memberCount: 1,
        });
      if (url.endsWith('/settings')) return reply({ ...SETTINGS, visibility: 'private' });
      if (options.method === 'GET') return reply([]);
      return reply({ error: { code: 'not_found', message: 'missing' } }, 404);
    });
    vi.stubGlobal('fetch', fetcher);
    renderRoot();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Owner space' }));
    await screen.findByText('0 of 3 Clubs · 50 members per Club');
    fireEvent.change(screen.getByRole('textbox', { name: 'Club name' }), {
      target: { value: 'Family' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Nickname' }), {
      target: { value: 'Ken' },
    });
    await user.click(screen.getByRole('button', { name: 'Create a Club' }));
    await screen.findByRole('button', { name: 'Send my results automatically' });
    expect((await loadClubConnections())[0]?.autoSend).toBeUndefined();
    const creation = fetcher.mock.calls.find(([url]) => String(url).endsWith('/managed/clubs'));
    expect(JSON.parse(creation![1].body)).toMatchObject({
      name: 'Family',
      nickname: 'Ken',
      clientId: expect.stringMatching(/^[A-Za-z0-9_-]{8,64}$/),
    });
    await user.click(screen.getByRole('button', { name: 'Send my results automatically' }));
    await waitFor(async () => expect((await loadClubConnections())[0]?.autoSend).toBe(true));
  });
});
