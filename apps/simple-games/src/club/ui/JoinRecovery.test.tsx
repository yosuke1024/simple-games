/**
 * Joining a managed Club when something has gone wrong, and the owner's benefit when the
 * owner key is refused (Codex review of PR #256): a failed admission read can be retried
 * on the screen, a departed member returns with their saved credential even after the
 * invite was replaced, a new request never pushes out a stored receipt, and a refused key
 * clears the ad benefit from the record book as it does from the owner screen.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { translate } from '../../i18n';
import { SettingsProvider } from '@/state/SettingsContext';
import {
  settingsSchema,
  type ClubConnection,
  type ManagedAdRemovalBenefit,
} from '@/storage/schemas';
import {
  addClubConnection,
  departClubConnection,
  loadClubConnections,
  loadManagedOwner,
  loadPendingJoins,
  saveManagedOwner,
  savePendingJoin,
  saveVerifiedManagedOwner,
} from '../storage/connections';
import { JoinScreen } from './JoinScreen';
import { RecordBookScreen } from './RecordBookScreen';

const ORIGIN = 'https://managed.example.com';
vi.mock('@/ui/clubFeatures', () => ({
  PRIVATE_CLUBS_ENABLED: false,
  MANAGED_CLUB_ORIGIN: 'https://managed.example.com',
}));

const E = `${ORIGIN}/clubs/c_one`;
const DATE = '2026-10-23T00:00:00.000Z';
const CLUB = { id: 'c_one', name: 'Family', createdAt: DATE };
const MEMBER = { id: 'm_one', nickname: 'Ken', role: 'member' as const, joinedAt: DATE };
const ADMISSION = {
  visibility: 'private',
  approvalRequired: true,
  allowedGameIds: null,
  club: { id: CLUB.id, name: CLUB.name },
  memberCount: 1,
};
const INVITE = { endpoint: E, token: 'invite-token-0123456789' };
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'X-Club-Api': '1', 'Content-Type': 'application/json' },
  });
const t = (key: Parameters<typeof translate>[1], vars?: Parameters<typeof translate>[2]) =>
  translate('en', key, vars);

function renderJoin(connectionCount = 0) {
  const onJoined = vi.fn(async (connection: ClubConnection) => {
    await addClubConnection(connection);
  });
  const onPending = vi.fn(async () => undefined);
  render(
    <JoinScreen
      invite={INVITE}
      connectionCount={connectionCount}
      t={t}
      onBack={vi.fn()}
      onJoined={onJoined}
      onPending={onPending}
    />,
  );
  return { onJoined, onPending };
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('joining a managed Club after a failure', () => {
  it('retries a failed admission read from the same screen', async () => {
    let online = false;
    const fetcher = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/admission')) {
        if (!online) throw new TypeError('offline');
        return reply(ADMISSION);
      }
      return reply({ error: { code: 'not_found', message: 'missing' } }, 404);
    });
    vi.stubGlobal('fetch', fetcher);
    renderJoin();
    const user = userEvent.setup();
    await user.type(await screen.findByRole('textbox', { name: 'Nickname' }), 'Ken');
    const retry = await screen.findByRole('button', { name: 'Reload' });
    expect(screen.getByRole('button', { name: 'Join and Play' })).toBeDisabled();
    online = true;
    await user.click(retry);
    expect(await screen.findByRole('button', { name: 'Request to join' })).toBeEnabled();
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/admission'))).toHaveLength(
      2,
    );
  });

  it('restores a departed member with their saved credential after the invite was replaced', async () => {
    await addClubConnection({
      endpoint: E,
      clubId: CLUB.id,
      clubName: CLUB.name,
      memberId: MEMBER.id,
      memberToken: 'member-token-secret',
      nickname: MEMBER.nickname,
      role: 'member',
      joinedAt: DATE,
    });
    await departClubConnection(E);
    const fetcher = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/admission'))
        return reply({ error: { code: 'invite_expired', message: 'expired' } }, 409);
      if (url.endsWith('/club'))
        return reply({ club: CLUB, me: MEMBER, members: [MEMBER], memberCount: 2 });
      return reply({ error: { code: 'not_found', message: 'missing' } }, 404);
    });
    vi.stubGlobal('fetch', fetcher);
    const { onJoined } = renderJoin();
    const user = userEvent.setup();
    await screen.findByText(t('clubRejoinNote'));
    await user.type(screen.getByRole('textbox', { name: 'Nickname' }), 'Ken');
    await user.click(screen.getByRole('button', { name: 'Join and Play' }));
    await waitFor(() => expect(onJoined).toHaveBeenCalledOnce());
    expect((await loadClubConnections())[0]?.memberToken).toBe('member-token-secret');
    expect(fetcher.mock.calls.some(([url]) => String(url).endsWith('/join'))).toBe(false);
  });

  it('sends one request for two quick taps', async () => {
    const fetcher = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/admission')) return reply(ADMISSION);
      if (url.endsWith('/join'))
        return reply(
          {
            status: 'pending',
            club: CLUB,
            request: {
              id: 'jr_one',
              nickname: 'Ken',
              createdAt: DATE,
              expiresAt: '2026-10-30T00:00:00.000Z',
              status: 'pending',
            },
            requestToken: 'request-token-is-secret',
          },
          202,
        );
      return reply({ error: { code: 'not_found', message: 'missing' } }, 404);
    });
    vi.stubGlobal('fetch', fetcher);
    const { onPending } = renderJoin();
    const user = userEvent.setup();
    await user.type(await screen.findByRole('textbox', { name: 'Nickname' }), 'Ken');
    const button = await screen.findByRole('button', { name: 'Request to join' });
    // Both before React re-renders, as a double tap on a slow device lands.
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(onPending).toHaveBeenCalled());
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/join'))).toHaveLength(1);
  });

  it('refuses another request rather than dropping a stored receipt', async () => {
    for (let i = 0; i < 10; i++) {
      await savePendingJoin({
        endpoint: `${ORIGIN}/clubs/c_other${i}`,
        requestId: `jr_${i}`,
        requestToken: `request-token-${i}`,
        clubName: `Club ${i}`,
        nickname: 'Ken',
        createdAt: DATE,
        expiresAt: '2026-10-30T00:00:00.000Z',
      });
    }
    const fetcher = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/admission')) return reply(ADMISSION);
      return reply({ error: { code: 'not_found', message: 'missing' } }, 404);
    });
    vi.stubGlobal('fetch', fetcher);
    const { onPending } = renderJoin();
    const user = userEvent.setup();
    await user.type(await screen.findByRole('textbox', { name: 'Nickname' }), 'Ken');
    await user.click(await screen.findByRole('button', { name: 'Request to join' }));
    expect(await screen.findByText(t('clubErr_too_many_connections'))).toBeInTheDocument();
    expect(onPending).not.toHaveBeenCalled();
    expect(fetcher.mock.calls.some(([url]) => String(url).endsWith('/join'))).toBe(false);
    expect((await loadPendingJoins()).map((p) => p.requestToken)).toEqual(
      Array.from({ length: 10 }, (_, i) => `request-token-${i}`),
    );
  });
});

describe('the record book with a refused owner key', () => {
  it('clears the cached owner ad benefit', async () => {
    const credential = { origin: ORIGIN, ownerToken: 'owner-secret-0123456789' };
    await saveManagedOwner(credential);
    const benefit: ManagedAdRemovalBenefit = {
      requiredMembers: 50,
      memberCount: 50,
      active: true,
      validUntil: '2099-11-23T00:00:00.000Z',
    };
    expect(await saveVerifiedManagedOwner(credential, benefit)).toBe(true);
    expect((await loadManagedOwner())?.adRemoval?.active).toBe(true);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(reply({ error: { code: 'unauthorized', message: 'no' } }, 401)),
    );
    render(
      <SettingsProvider initialSettings={{ ...settingsSchema.defaultValue(), language: 'en' }}>
        <RecordBookScreen
          managed={{
            origin: ORIGIN,
            token: 'owner-secret-0123456789',
            owner: {
              owner: {
                id: 'o_one',
                plan: 'basic',
                validUntil: benefit.validUntil,
                status: 'active',
              },
              limits: { maxClubs: 3, maxMembersPerClub: 50 },
              clubs: [
                {
                  id: CLUB.id,
                  name: CLUB.name,
                  endpoint: E,
                  createdAt: DATE,
                  memberCount: 50,
                  status: 'ready',
                  visibility: 'private',
                  approvalRequired: true,
                  allowedGameIds: null,
                },
              ],
              benefits: { adRemoval: benefit },
            },
          }}
          onAlbums={vi.fn()}
          onBack={vi.fn()}
        />
      </SettingsProvider>,
    );
    await waitFor(async () => expect((await loadManagedOwner())?.adRemoval).toBeUndefined());
    expect((await loadManagedOwner())?.ownerToken).toBe('owner-secret-0123456789');
  });
});
