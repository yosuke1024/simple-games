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

const LEADER = {
  memberId: 'm_1',
  nickname: 'Ken',
  submittedAt: '2026-09-10T00:00:00.000Z',
  facts: { elapsedSeconds: 238, mistakes: 0, hints: 1 },
  seed: 's',
  boardDigest: 'sd1:1',
};
const MINE = {
  ...LEADER,
  memberId: 'm_7',
  nickname: 'Ken B',
  facts: { elapsedSeconds: 600, mistakes: 3, hints: 0 },
};
let meBelowTop = false;
let dailyChallenges = false;
/** A server from before `?daily=` existed: it ignores the parameter and answers with its ordinary list. */
let ignoresDaily = false;
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
      if (daily === null || ignoresDaily) return reply([CHALLENGE]);
      return reply(daily === todayLocal() && dailyChallenges ? [DAILY_CHALLENGE] : []);
    }
    if (path === '/challenges/ch_d') return reply(DAILY_CHALLENGE);
    if (path === '/challenges/ch_d/results') {
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
    if (path === '/rankings') {
      return reply([{ gameId: 'sudoku', paramsKey: 'hard', entryCount: 24, leader: LEADER }]);
    }
    if (path === '/rankings/sudoku/hard') {
      const second = {
        ...LEADER,
        memberId: 'm_2',
        nickname: 'Mika',
        facts: { elapsedSeconds: 300, mistakes: 1, hints: 0 },
      };
      return reply({
        gameId: 'sudoku',
        paramsKey: 'hard',
        entryCount: 24,
        entries: meBelowTop ? [LEADER, second] : [LEADER, { ...MINE, facts: second.facts }],
        me: { rank: meBelowTop ? 87 : 2, entry: MINE },
      });
    }
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
  meBelowTop = false;
  ignoresDaily = false;
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

    expect(await screen.findByRole('heading', { name: 'Rankings' })).toBeInTheDocument();
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
    expect(screen.getByRole('heading', { name: 'Rankings' })).toBeInTheDocument();
    // The old per-board lists are gone.
    for (const name of ['Challenges', 'Played', 'Records']) {
      expect(screen.queryByRole('heading', { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: /New Challenge/ })).not.toBeInTheDocument();
  });

  it('keeps Today empty when a server from before ?daily= answers with its ordinary list', async () => {
    stubServer();
    ignoresDaily = true;
    const user = userEvent.setup();
    renderRoot({ entry: 'invite', invite: { endpoint: ENDPOINT, token: 'a'.repeat(22) } });
    await user.type(await screen.findByLabelText('Nickname'), 'Ken');
    await user.click(screen.getByRole('button', { name: 'Join and Play' }));
    expect(await screen.findByRole('heading', { name: 'Rankings' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Today' })).not.toBeInTheDocument();
    // The ordinary list is not mistaken for today's.
    expect(screen.queryByRole('button', { name: /by Yoh/ })).not.toBeInTheDocument();
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
    // Straight into the Club: its rankings are listed, with the leader and the size.
    expect(await screen.findByRole('heading', { name: 'Rankings' })).toBeInTheDocument();
    expect(screen.getByText('1. Ken 3:58')).toBeInTheDocument();
    expect(screen.getByText('24 entries')).toBeInTheDocument();
  });

  it('loads the club, today and the rankings: three requests', async () => {
    const fetchMock = stubServer();
    await joinedConnection();
    renderRoot();
    expect(await screen.findByRole('heading', { name: 'Rankings' })).toBeInTheDocument();
    const paths = fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname);
    expect(paths.sort()).toEqual(['/api/v1/challenges', '/api/v1/club', '/api/v1/rankings']);
  });

  it('opens a ranking: You on the viewer row, in the order the server gave', async () => {
    stubServer();
    const user = userEvent.setup();
    await joinedConnection();
    renderRoot();

    await user.click(await screen.findByRole('button', { name: /Sudoku · Hard · 1\. Ken 3:58/ }));
    expect(await screen.findByRole('heading', { name: 'Sudoku · Hard' })).toBeInTheDocument();
    expect(await screen.findByText('Ken')).toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.queryByText('Ken B')).not.toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('24 entries')).toBeInTheDocument();
    expect(screen.queryByText('#87')).not.toBeInTheDocument();
  });

  it('appends the viewer row with its rank when it is outside the rows sent', async () => {
    stubServer();
    meBelowTop = true;
    const user = userEvent.setup();
    await joinedConnection();
    renderRoot();

    await user.click(await screen.findByRole('button', { name: /Sudoku · Hard · 1\. Ken 3:58/ }));
    expect(await screen.findByText('#87')).toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText('10:00 Mistakes 3 Hints 0')).toBeInTheDocument();
    expect(screen.getByText('24 entries')).toBeInTheDocument();
  });

  it('Back from a ranking returns to the Club', async () => {
    stubServer();
    const user = userEvent.setup();
    await joinedConnection();
    renderRoot();
    await user.click(await screen.findByRole('button', { name: /Sudoku · Hard · 1\. Ken 3:58/ }));
    await screen.findByRole('heading', { name: 'Sudoku · Hard' });
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { name: 'Rankings' })).toBeInTheDocument();
  });

  it('shows a Today challenge, discloses before Play, and plays the game daily', async () => {
    stubServer();
    dailyChallenges = true;
    const user = userEvent.setup();
    await joinedConnection();
    const handlers = renderRoot();

    await user.click(await screen.findByRole('button', { name: /Sudoku · Hard · Daily · by Yoh/ }));
    expect(
      await screen.findByText(
        'Open Sudoku and play today’s Daily. When you finish, your result is sent to Suzuki Family.',
      ),
    ).toBeInTheDocument();
    // Ranked, with the facts the contract names.
    expect(await screen.findByText('4:31 Mistakes 0 Hints 1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Play' }));
    // No board is handed over: the game opens its own daily (club.md §16-3).
    expect(handlers.onPlayChallenge).toHaveBeenCalledWith({
      gameId: 'sudoku',
      active: {
        endpoint: ENDPOINT,
        clubName: 'Suzuki Family',
        challengeId: 'ch_d',
        gameId: 'sudoku',
        boardDigest: 'sd1:9f3a1c07',
        submitted: false,
      },
    });
  });
});

async function joinedConnection() {
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
}
