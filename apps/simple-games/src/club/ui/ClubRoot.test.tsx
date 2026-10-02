/**
 * The Club screens, rendered against a stubbed server (club.md §9). The
 * storage functions run on the real Preferences plugin, which is localStorage
 * under jsdom, so the test clears it between cases.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { addClubConnection } from '../storage/connections';
import { PUBLIC_CLUB_ENDPOINT } from '../public';
import { todayLocal } from './common';
import { ClubRoot } from './ClubRoot';

const ENDPOINT = 'https://club.example.com';
const CLUB = { id: 'c_1', name: 'Suzuki Family', createdAt: '2026-09-09T00:00:00.000Z' };
const KEN = { id: 'm_7', nickname: 'Ken', role: 'member', joinedAt: '2026-09-09T00:00:00.000Z' };
const CHALLENGE = {
  id: 'ch_1',
  gameId: 'sudoku',
  contractVersion: 1,
  params: { difficulty: 'hard' },
  seed: 'sudoku-free-abc',
  boardDigest: 'sd1:9f3a1c07',
  title: null,
  createdBy: { id: 'm_1', nickname: 'Yoh' },
  createdAt: '2026-09-10T00:00:00.000Z',
  resultCount: 1,
  mine: false,
};

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Club-Api': '1' },
  });
}

let dailyChallenges = false;
const DAILY_CHALLENGE = {
  ...CHALLENGE,
  id: 'ch_d',
  seed: 'sudoku-daily-today',
  daily: todayLocal(),
};

function stubServer() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const path = url.pathname.replace('/api/v1', '');
    const method = init?.method ?? 'GET';
    if (path === '/health') return reply({ ok: true, api: 1, claimed: true });
    if (path === '/join' && method === 'POST') {
      return reply({ club: CLUB, member: KEN, memberToken: 'member-token-1' }, 201);
    }
    if (path === '/club') return reply({ club: CLUB, me: KEN, members: [KEN] });
    if (path === '/challenges') {
      const daily = url.searchParams.get('daily');
      if (daily === null) return reply([CHALLENGE]);
      return reply(daily === todayLocal() && dailyChallenges ? [DAILY_CHALLENGE] : []);
    }
    if (path === '/challenges/ch_1') return reply(CHALLENGE);
    if (path === '/challenges/ch_1/results') {
      return reply([
        {
          memberId: 'm_1',
          nickname: 'Yoh',
          submittedAt: '2026-09-10T00:00:00.000Z',
          outcome: 'completed',
          facts: { elapsedSeconds: 271, mistakes: 0, hints: 1 },
        },
      ]);
    }
    if (path === '/records') return reply([]);
    return reply({ error: { code: 'not_found', message: 'no' } }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderRoot(props: Partial<React.ComponentProps<typeof ClubRoot>> = {}) {
  const handlers = {
    onBack: vi.fn(),
    onPlayChallenge: vi.fn(),
    onConnectionsChanged: vi.fn(),
  };
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <ClubRoot entry="settings" {...handlers} {...props} />
    </SettingsProvider>,
  );
  return handlers;
}

beforeEach(() => {
  dailyChallenges = false;
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ClubRoot', () => {
  it('opens on Discover with no connections, and offers Join but not Create', async () => {
    stubServer();
    renderRoot({ entry: 'discover' });
    expect(await screen.findByRole('heading', { name: 'Play together' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join the Public Club House' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join with an invite link' })).toBeInTheDocument();
    expect(screen.queryByText(/Create my Club/)).not.toBeInTheDocument();
  });

  it('discloses before joining the Public Club House, then joins with a nickname alone', async () => {
    const fetchMock = stubServer();
    const user = userEvent.setup();
    renderRoot({ entry: 'discover' });
    await user.click(await screen.findByRole('button', { name: 'Join the Public Club House' }));

    expect(screen.getByText(/visible to everyone in the Public Club House/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Invite link')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Nickname'), 'Ken');
    await user.click(screen.getByRole('button', { name: 'Join and Play' }));

    expect(await screen.findByText(/Sudoku · Hard · by Yoh/)).toBeInTheDocument();
    const joinCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/join'));
    expect(String(joinCall![0])).toBe(`${PUBLIC_CLUB_ENDPOINT}/api/v1/join`);
    const body = JSON.parse(String(joinCall![1]!.body)) as Record<string, unknown>;
    expect(body).toEqual({ nickname: 'Ken' });
    expect(body).not.toHaveProperty('inviteToken');
  });

  it('hides the Public button on All Clubs once the Public Club House is joined', async () => {
    stubServer();
    const base = {
      clubId: 'c_1',
      clubName: 'A',
      memberId: 'm_1',
      memberToken: 't',
      nickname: 'Ken',
      role: 'member' as const,
      joinedAt: 'x',
    };
    await addClubConnection({ ...base, endpoint: ENDPOINT });
    await addClubConnection({ ...base, endpoint: 'https://other.example.com', clubName: 'B' });
    const { unmount } = render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <ClubRoot
          entry="settings"
          onBack={vi.fn()}
          onPlayChallenge={vi.fn()}
          onConnectionsChanged={vi.fn()}
        />
      </SettingsProvider>,
    );
    expect(
      await screen.findByRole('button', { name: 'Join the Public Club House' }),
    ).toBeInTheDocument();
    unmount();
    cleanup();
    localStorage.clear();
    await addClubConnection({ ...base, endpoint: ENDPOINT });
    await addClubConnection({ ...base, endpoint: PUBLIC_CLUB_ENDPOINT, clubName: 'Public' });
    renderRoot();
    expect(await screen.findByRole('button', { name: 'Join another Club' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Join the Public Club House' }),
    ).not.toBeInTheDocument();
  });

  it('lists a challenge tagged with today under Today, with the Daily label', async () => {
    stubServer();
    dailyChallenges = true;
    const user = userEvent.setup();
    renderRoot({ entry: 'invite', invite: { endpoint: ENDPOINT, token: 'a'.repeat(22) } });
    await user.type(await screen.findByLabelText('Nickname'), 'Ken');
    await user.click(screen.getByRole('button', { name: 'Join and Play' }));
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Sudoku · Hard · Daily · by Yoh/ }),
    ).toBeInTheDocument();
    // The same challenge is not listed again under Challenges.
    expect(screen.getAllByRole('button', { name: /Sudoku · Hard/ })).toHaveLength(2);
  });

  it('joins from an invite link and hands the new connection to the shell', async () => {
    const fetchMock = stubServer();
    const user = userEvent.setup();
    const handlers = renderRoot({
      entry: 'invite',
      invite: { endpoint: ENDPOINT, token: 'a'.repeat(22) },
    });

    // The paste field is hidden: the link already said where to go.
    await screen.findByLabelText('Nickname');
    expect(screen.queryByLabelText('Invite link')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Nickname'), '  Ken ');
    await user.click(screen.getByRole('button', { name: 'Join and Play' }));

    await waitFor(() => expect(handlers.onConnectionsChanged).toHaveBeenCalledTimes(1));
    expect(handlers.onConnectionsChanged.mock.calls[0]![0]).toEqual([
      {
        endpoint: ENDPOINT,
        clubId: 'c_1',
        clubName: 'Suzuki Family',
        nickname: 'Ken',
        role: 'member',
      },
    ]);
    const joinCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/join'));
    expect(JSON.parse(String(joinCall![1]!.body))).toEqual({
      inviteToken: 'a'.repeat(22),
      nickname: 'Ken',
    });
    // Straight into the Club: its challenge is listed.
    expect(await screen.findByText(/Sudoku · Hard · by Yoh/)).toBeInTheDocument();
  });

  it('shows a challenge, discloses before Play, and plays it with the digest', async () => {
    stubServer();
    const user = userEvent.setup();
    await addClubConnection({
      endpoint: ENDPOINT,
      clubId: 'c_1',
      clubName: 'Suzuki Family',
      memberId: 'm_7',
      memberToken: 'member-token-1',
      nickname: 'Ken',
      role: 'member',
      joinedAt: '2026-09-09T00:00:00.000Z',
    });
    const handlers = renderRoot();

    await user.click(await screen.findByRole('button', { name: /Sudoku · Hard · by Yoh/ }));
    expect(
      await screen.findByText('When you finish, your result is sent to Suzuki Family.'),
    ).toBeInTheDocument();
    // Ranked, with the facts the contract names.
    expect(await screen.findByText('4:31 Mistakes 0 Hints 1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Play' }));
    expect(handlers.onPlayChallenge).toHaveBeenCalledWith({
      gameId: 'sudoku',
      challenge: {
        seed: 'sudoku-free-abc',
        params: { difficulty: 'hard' },
        boardDigest: 'sd1:9f3a1c07',
      },
      active: {
        endpoint: ENDPOINT,
        clubName: 'Suzuki Family',
        challengeId: 'ch_1',
        gameId: 'sudoku',
        boardDigest: 'sd1:9f3a1c07',
        submitted: false,
      },
    });
  });
});
