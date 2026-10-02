/**
 * The Club screens, rendered against a stubbed server (club.md §9). The
 * storage functions run on the real Preferences plugin, which is localStorage
 * under jsdom, so the test clears it between cases.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { catalogs } from '../i18n';
import {
  addClubConnection,
  departClubConnection,
  findDeparted,
  loadClubConnections,
} from '../storage/connections';
import { enqueueResult, flushOutbox, pendingFor } from '../storage/outbox';
import { REQUEST_TIMEOUT_MS, type ClubClient } from '../api/client';
import { ClubApiError } from '../api/errors';
import { PUBLIC_CLUB_ENDPOINT } from '../public';
import { todayLocal } from './common';
import { ClubRoot } from './ClubRoot';
import { clearWithdrawnChallenges } from './ChallengeScreen';

/** Private Clubs ship switched off (ui/clubFeatures.ts); every path below is tested under both values. */
const flags = vi.hoisted(() => ({ privateClubs: true }));
vi.mock('@/ui/clubFeatures', () => ({
  get PRIVATE_CLUBS_ENABLED() {
    return flags.privateClubs;
  },
}));

const ENDPOINT = 'https://club.example.com';
const CLUB = { id: 'c_1', name: 'Suzuki Family', createdAt: '2026-09-09T00:00:00.000Z' };
/** The consent every join shows before its button. */
const AUTO_SEND = catalogs.en.clubAutoSendDisclosure;

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
const MIKA = { id: 'm_2', nickname: 'Mika', role: 'member', joinedAt: '2026-09-10T00:00:00.000Z' };
/** What `GET /club` answers for the viewer and the member list. */
let clubMe: Record<string, unknown> = KEN;
let clubMembers: Record<string, unknown>[] = [KEN];
let clubMemberCount: number | undefined;
let reportedList: { member: Record<string, unknown>; reportCount: number }[] = [];
let meBelowTop = false;
let dailyChallenges = false;
/** A token the server no longer accepts (the owner removed that member, or the Club was rebuilt). */
let rejectedToken: string | null = null;
/** The token a fresh `POST /join` hands out. */
let joinedToken = 'member-token-1';
/** What the device still had queued for the Club at the moment a `DELETE …/me` arrived. */
let queuedAtDelete: unknown[] | null = null;
/** The viewer's own ranking row / Today result, until the server is asked to delete it. */
let rankingRowDeleted = false;
let dailyResultDeleted = false;
let hasDailyResult = false;
/** What the next `DELETE …/me` answers: 204, or the 404 of a row that is already gone. */
let deleteAnswers: 204 | 404 = 204;
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
      return reply({ club: CLUB, member: KEN, memberToken: joinedToken }, 201);
    }
    if (rejectedToken !== null && JSON.stringify(init?.headers ?? {}).includes(rejectedToken)) {
      return reply({ error: { code: 'unauthorized', message: 'no' } }, 401);
    }
    if (path === '/me' && method === 'PATCH') {
      const body = JSON.parse(String(init?.body)) as { nickname: string };
      clubMe = { ...clubMe, nickname: body.nickname };
      return reply(clubMe);
    }
    if (
      method === 'DELETE' &&
      (path === '/rankings/sudoku/hard/me' || path === '/challenges/ch_d/results/me')
    ) {
      queuedAtDelete = await pendingFor(ENDPOINT);
      if (deleteAnswers === 404) return reply({ error: { code: 'not_found', message: 'no' } }, 404);
      if (path.startsWith('/rankings')) rankingRowDeleted = true;
      else dailyResultDeleted = true;
      return new Response(null, { status: 204, headers: { 'X-Club-Api': '1' } });
    }
    if (path === '/club') {
      return reply({
        club: CLUB,
        me: clubMe,
        members: clubMembers,
        ...(clubMemberCount === undefined ? {} : { memberCount: clubMemberCount }),
      });
    }
    if (path === '/members/reported') return reply(reportedList);
    if (path.startsWith('/members/') && path.endsWith('/report') && method === 'POST') {
      return new Response(null, { status: 204, headers: { 'X-Club-Api': '1' } });
    }
    if (path === '/members/m_2' && method === 'PATCH') {
      const body = JSON.parse(String(init?.body)) as { nickname: string };
      return reply({ ...MIKA, nickname: body.nickname });
    }
    if (path === '/members/m_2' && method === 'DELETE') {
      // The server forgot them; the reload after a purge must not see them again.
      clubMembers = clubMembers.filter((m) => m.id !== 'm_2');
      clubMemberCount = Math.max(0, clubMembers.length);
      return new Response(null, { status: 204, headers: { 'X-Club-Api': '1' } });
    }
    if (path === '/challenges') {
      const daily = url.searchParams.get('daily');
      if (daily === null || ignoresDaily) return reply([CHALLENGE]);
      return reply(daily === todayLocal() && dailyChallenges ? [DAILY_CHALLENGE] : []);
    }
    if (path === '/challenges/ch_d') return reply(DAILY_CHALLENGE);
    if (path === '/challenges/ch_d/results') {
      return reply([
        ...(hasDailyResult && !dailyResultDeleted
          ? [
              {
                memberId: 'm_7',
                nickname: 'Ken',
                submittedAt: '2026-09-10T01:00:00.000Z',
                outcome: 'completed',
                facts: { elapsedSeconds: 500, mistakes: 2, hints: 0 },
              },
            ]
          : []),
        {
          memberId: 'm_1',
          nickname: 'Yoh',
          submittedAt: '2026-09-10T00:00:00.000Z',
          outcome: 'completed',
          facts: { elapsedSeconds: 271, mistakes: 0, hints: 1 },
        },
      ]);
    }
    if (path === '/rankings/results' && method === 'POST') {
      return reply({
        gameId: 'sudoku',
        paramsKey: 'hard',
        improved: true,
        entry: null,
        entryCount: 1,
      });
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
      if (rankingRowDeleted) {
        return reply({
          gameId: 'sudoku',
          paramsKey: 'hard',
          entryCount: 23,
          entries: [LEADER, second],
          me: null,
        });
      }
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
  flags.privateClubs = true;
  rejectedToken = null;
  joinedToken = 'member-token-1';
  queuedAtDelete = null;
  rankingRowDeleted = false;
  dailyResultDeleted = false;
  hasDailyResult = false;
  deleteAnswers = 204;
  dailyChallenges = false;
  clubMe = KEN;
  clubMembers = [KEN];
  clubMemberCount = undefined;
  reportedList = [];
  meBelowTop = false;
  ignoresDaily = false;
  clearWithdrawnChallenges();
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
    // ...and that every game finished from now on is sent here by itself.
    expect(screen.getByText(AUTO_SEND)).toBeInTheDocument();
    expect(screen.queryByLabelText('Invite link')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Nickname'), 'Ken');
    await user.click(screen.getByRole('button', { name: 'Join and Play' }));

    expect(await screen.findByRole('heading', { name: 'Rankings' })).toBeInTheDocument();
    const joinCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/join'));
    expect(String(joinCall![0])).toBe(`${PUBLIC_CLUB_ENDPOINT}/api/v1/join`);
    const body = JSON.parse(String(joinCall![1]!.body)) as Record<string, unknown>;
    expect(body).toEqual({ nickname: 'Ken' });
    expect(body).not.toHaveProperty('inviteToken');
    // The disclosure was on the screen: the connection is stored as consented.
    expect((await loadClubConnections())[0]).toMatchObject({
      endpoint: PUBLIC_CLUB_ENDPOINT,
      autoSend: true,
    });
  });

  it('discloses automatic sending on a pasted invite link too, before the link is even pasted', async () => {
    stubServer();
    const user = userEvent.setup();
    renderRoot({ entry: 'discover' });
    await user.click(await screen.findByRole('button', { name: 'Join with an invite link' }));

    expect(screen.getByLabelText('Invite link')).toBeInTheDocument();
    expect(screen.getByText(AUTO_SEND)).toBeInTheDocument();
    // The Public Club House's own line is not part of this join.
    expect(
      screen.queryByText(/visible to everyone in the Public Club House/),
    ).not.toBeInTheDocument();
  });

  it('joins with a pasted invite link and stores the connection as consented', async () => {
    const fetchMock = stubServer();
    const user = userEvent.setup();
    renderRoot({ entry: 'discover' });
    await user.click(await screen.findByRole('button', { name: 'Join with an invite link' }));
    expect(screen.getByText(AUTO_SEND)).toBeInTheDocument();

    await user.type(
      screen.getByLabelText('Invite link'),
      `${ENDPOINT}/join#invite=${'a'.repeat(22)}`,
    );
    await user.type(screen.getByLabelText('Nickname'), 'Ken');
    await user.click(screen.getByRole('button', { name: 'Join and Play' }));

    expect(await screen.findByRole('heading', { name: 'Rankings' })).toBeInTheDocument();
    const joinCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/join'));
    expect(JSON.parse(String(joinCall![1]!.body))).toEqual({
      inviteToken: 'a'.repeat(22),
      nickname: 'Ken',
    });
    expect((await loadClubConnections())[0]).toMatchObject({ endpoint: ENDPOINT, autoSend: true });
    // Joined consented: no box asking again.
    expect(screen.queryByRole('button', { name: 'Send my results automatically' })).toBeNull();
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
      autoSend: true as const,
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

    // The paste field is hidden: the link already said where to go. The join says,
    // before the button, that results are sent automatically from here on.
    await screen.findByLabelText('Nickname');
    expect(screen.getByText(AUTO_SEND)).toBeInTheDocument();
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
    // The invite-URL join showed the disclosure too: stored as consented.
    expect((await loadClubConnections())[0]).toMatchObject({ endpoint: ENDPOINT, autoSend: true });
  });

  it('loads the club, today and the rankings: three requests', async () => {
    const fetchMock = stubServer();
    await joinedConnection();
    renderRoot();
    expect(await screen.findByRole('heading', { name: 'Rankings' })).toBeInTheDocument();
    const paths = fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname);
    expect(paths.sort()).toEqual(['/api/v1/challenges', '/api/v1/club', '/api/v1/rankings']);
  });

  it('opening a Club sends the results that waited, before it lists anything', async () => {
    const fetchMock = stubServer();
    await joinedConnection();
    await enqueueResult({
      kind: 'ranking',
      endpoint: ENDPOINT,
      createdAt: '2026-10-02T00:00:00.000Z',
      body: {
        gameId: 'sudoku',
        contractVersion: 1,
        paramsKey: 'hard',
        params: { difficulty: 'hard' },
        seed: 's',
        boardDigest: 'sd1:1',
        outcome: 'completed',
        facts: { elapsedSeconds: 200, mistakes: 0, hints: 0 },
      },
    });
    renderRoot();
    expect(await screen.findByRole('heading', { name: 'Rankings' })).toBeInTheDocument();
    const calls = fetchMock.mock.calls.map(
      ([url, init]) => `${init?.method ?? 'GET'} ${new URL(String(url)).pathname}`,
    );
    expect(calls[0]).toBe('POST /api/v1/rankings/results');
    expect(await pendingFor(ENDPOINT)).toEqual([]);
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
    // Only the way back is handed over: the result goes out like any other.
    expect(handlers.onPlayChallenge).toHaveBeenCalledWith({
      gameId: 'sudoku',
      focus: { endpoint: ENDPOINT, challengeId: 'ch_d' },
    });
  });

  it('heads the members with the total, not the page, and a member can Report', async () => {
    const fetchMock = stubServer();
    clubMembers = [KEN, MIKA];
    clubMemberCount = 1200;
    const user = userEvent.setup();
    await joinedConnection();
    renderRoot();

    expect(await screen.findByRole('heading', { name: '1200 members' })).toBeInTheDocument();
    // A member never sees Rename / Remove, nor a Reported section.
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Reported' })).not.toBeInTheDocument();
    // Only the other member's row has Report.
    await user.click(screen.getByRole('button', { name: 'Report' }));
    expect(screen.getByRole('alertdialog', { name: 'Report this nickname?' })).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Report' }).at(-1)!);
    expect(await screen.findByText('Reported')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Report' })).not.toBeInTheDocument();
    const posted = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/members/m_2/report'),
    );
    expect(posted?.[1]?.method).toBe('POST');
    // No fourth request for a member.
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/members/reported'))).toBe(
      false,
    );
  });

  it('falls back to the list length when the server sends no memberCount', async () => {
    stubServer();
    clubMembers = [KEN, MIKA];
    await joinedConnection();
    renderRoot();
    expect(await screen.findByRole('heading', { name: '2 members' })).toBeInTheDocument();
  });

  it('shows the owner the reported members and lets them rename', async () => {
    const fetchMock = stubServer();
    clubMe = { ...KEN, role: 'owner' };
    clubMembers = [clubMe, MIKA];
    reportedList = [{ member: MIKA, reportCount: 3 }];
    const user = userEvent.setup();
    await joinedConnection({ role: 'owner' });
    renderRoot();

    expect(await screen.findByRole('heading', { name: 'Reported' })).toBeInTheDocument();
    expect(screen.getByText('3 reports')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Report' })).not.toBeInTheDocument();

    // Both Mika lines (Reported and Members) offer Rename; use the first.
    await user.click(screen.getAllByRole('button', { name: 'Rename' })[0]!);
    const field = screen.getByLabelText('New nickname');
    await user.clear(field);
    await user.type(field, 'Mi');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getAllByText('Mi').length).toBe(2));
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(new URL(String(patch![0])).pathname).toBe('/api/v1/members/m_2');
    expect(JSON.parse(String(patch![1]!.body))).toEqual({ nickname: 'Mi' });
  });

  it('lets the owner remove and erase results with ?purge=1, or remove alone', async () => {
    const fetchMock = stubServer();
    clubMe = { ...KEN, role: 'owner' };
    clubMembers = [clubMe, MIKA];
    clubMemberCount = 2;
    const user = userEvent.setup();
    await joinedConnection({ role: 'owner' });
    renderRoot();

    await user.click(await screen.findByRole('button', { name: 'Remove' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Remove Mika?' });
    expect(dialog).toHaveTextContent('every result and ranking row of theirs is erased');
    await user.click(screen.getByRole('button', { name: 'Remove and erase results' }));

    expect(await screen.findByRole('heading', { name: '1 members' })).toBeInTheDocument();
    const del = fetchMock.mock.calls.find(([, init]) => init?.method === 'DELETE');
    expect(String(del![0])).toBe(`${ENDPOINT}/api/v1/members/m_2?purge=1`);
  });

  it('removes without ?purge when only Remove is chosen', async () => {
    const fetchMock = stubServer();
    clubMe = { ...KEN, role: 'owner' };
    clubMembers = [clubMe, MIKA];
    const user = userEvent.setup();
    await joinedConnection({ role: 'owner' });
    renderRoot();

    await user.click(await screen.findByRole('button', { name: 'Remove' }));
    const dialog = screen.getByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true),
    );
    const del = fetchMock.mock.calls.find(([, init]) => init?.method === 'DELETE');
    expect(String(del![0])).toBe(`${ENDPOINT}/api/v1/members/m_2`);
  });

  it('reports a ranking row that is not the viewer’s', async () => {
    const fetchMock = stubServer();
    const user = userEvent.setup();
    await joinedConnection({ memberId: 'm_7' });
    renderRoot();

    await user.click(await screen.findByRole('button', { name: /Sudoku · Hard · 1\. Ken 3:58/ }));
    await screen.findByText('24 entries');
    // The leader (m_1) is someone else; the viewer's own row has no Report.
    expect(screen.getAllByRole('button', { name: /^Report/ })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Report Ken' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Report' }),
    );
    expect(await screen.findByText('Reported')).toBeInTheDocument();
    const posted = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/members/m_1/report'),
    );
    expect(posted?.[1]?.method).toBe('POST');
  });

  it('stores the nickname the owner gave when the server says it changed', async () => {
    stubServer();
    clubMe = { ...KEN, nickname: 'Kenji' };
    clubMembers = [clubMe];
    await joinedConnection();
    renderRoot();
    expect(await screen.findByRole('heading', { name: '1 members' })).toBeInTheDocument();
    await waitFor(async () => expect((await loadClubConnections())[0]!.nickname).toBe('Kenji'));
  });
});

async function joinedConnection(extra: Record<string, unknown> = {}) {
  await addClubConnection({
    endpoint: ENDPOINT,
    clubId: 'c_1',
    clubName: 'Suzuki Family',
    memberId: 'm_7',
    memberToken: 'member-token-1',
    nickname: 'Ken',
    role: 'member',
    joinedAt: '2026-09-09T00:00:00.000Z',
    // Joined under this build: it saw the disclosure. A legacy test passes `autoSend: undefined`.
    autoSend: true,
    ...extra,
  });
}

describe('Disconnect this device', () => {
  const HOSTING = 'delete the server in your hosting provider’s dashboard';
  const LAST_OWNER = 'This is the only Owner device.';

  async function openDisconnect() {
    const user = userEvent.setup();
    renderRoot();
    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Disconnect this device' }));
    return screen.getByRole('alertdialog', { name: 'Disconnect this device' });
  }

  it('tells a member only that the server and the others carry on', async () => {
    stubServer();
    await joinedConnection();
    const dialog = await openDisconnect();
    expect(dialog).toHaveTextContent('The server keeps running');
    expect(dialog).not.toHaveTextContent(HOSTING);
    expect(dialog).not.toHaveTextContent(LAST_OWNER);
  });

  it('tells the owner of a self-hosted Club how to stop paying, and that they are the last owner', async () => {
    stubServer();
    clubMe = { ...KEN, role: 'owner' };
    clubMembers = [clubMe, MIKA];
    await joinedConnection({ role: 'owner' });
    const dialog = await openDisconnect();
    await waitFor(() => expect(dialog).toHaveTextContent(LAST_OWNER));
    expect(dialog).toHaveTextContent(HOSTING);
  });

  it('never sends a Public Club House member to a hosting dashboard', async () => {
    stubServer();
    await joinedConnection({ endpoint: PUBLIC_CLUB_ENDPOINT, clubName: 'PixApps Club' });
    const dialog = await openDisconnect();
    expect(dialog).toHaveTextContent('The server keeps running');
    expect(dialog).not.toHaveTextContent(HOSTING);
  });
});

describe('a connection from before automatic sending (club.md §4-1)', () => {
  const ACCEPT = 'Send my results automatically';

  it('shows the disclosure and one button at the top of the Club, and still lists everything', async () => {
    stubServer();
    await joinedConnection({ autoSend: undefined });
    renderRoot();
    expect(await screen.findByRole('heading', { name: 'Rankings' })).toBeInTheDocument();

    expect(screen.getByText(AUTO_SEND)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: ACCEPT })).toBeInTheDocument();
    // The Club is fully usable: Reload, Settings and the Disconnect behind it are where they were.
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    // Showing the box asks for nothing and stores nothing.
    expect((await loadClubConnections())[0]).not.toHaveProperty('autoSend');
  });

  it('pressing the button stores autoSend, hides the box, and tells the shell', async () => {
    stubServer();
    const user = userEvent.setup();
    await joinedConnection({ autoSend: undefined });
    const handlers = renderRoot();
    await user.click(await screen.findByRole('button', { name: ACCEPT }));

    await waitFor(async () => expect((await loadClubConnections())[0]!.autoSend).toBe(true));
    await waitFor(() => expect(screen.queryByText(AUTO_SEND)).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: ACCEPT })).not.toBeInTheDocument();
    expect(handlers.onConnectionsChanged).toHaveBeenCalledTimes(1);
    // Nothing else moved: same Club, same lists.
    expect(screen.getByRole('heading', { name: 'Rankings' })).toBeInTheDocument();
  });

  it('not pressing it changes nothing: nothing is stored, the box stays across Settings and back', async () => {
    stubServer();
    const user = userEvent.setup();
    await joinedConnection({ autoSend: undefined });
    const handlers = renderRoot();
    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('button', { name: 'Disconnect this device' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('button', { name: ACCEPT })).toBeInTheDocument();
    expect((await loadClubConnections())[0]).not.toHaveProperty('autoSend');
    expect(handlers.onConnectionsChanged).not.toHaveBeenCalled();
  });

  it('accepting one Club leaves the other unconsented', async () => {
    stubServer();
    const user = userEvent.setup();
    await joinedConnection({ autoSend: undefined });
    await joinedConnection({
      endpoint: 'https://other.example.com',
      clubName: 'Other',
      autoSend: undefined,
    });
    renderRoot();
    await user.click(await screen.findByRole('button', { name: 'Suzuki Family' }));
    await user.click(await screen.findByRole('button', { name: ACCEPT }));
    await waitFor(async () =>
      expect((await loadClubConnections()).map((c) => c.autoSend)).toEqual([true, undefined]),
    );
  });

  it('a Today challenge does not promise a send the connection will not make', async () => {
    stubServer();
    dailyChallenges = true;
    const user = userEvent.setup();
    await joinedConnection({ autoSend: undefined });
    renderRoot();

    await user.click(await screen.findByRole('button', { name: /Sudoku · Hard · Daily · by Yoh/ }));
    expect(await screen.findByText('4:31 Mistakes 0 Hints 1')).toBeInTheDocument();
    // Play is still there; only the sentence "your result is sent to ..." is not.
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(screen.queryByText(/your result is sent to/)).not.toBeInTheDocument();
  });

  it('a consented connection shows no box', async () => {
    stubServer();
    await joinedConnection();
    renderRoot();
    expect(await screen.findByRole('heading', { name: 'Rankings' })).toBeInTheDocument();
    expect(screen.queryByText(AUTO_SEND)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: ACCEPT })).not.toBeInTheDocument();
  });
});

const callsTo = (fetchMock: ReturnType<typeof stubServer>, method: string, suffix: string) =>
  fetchMock.mock.calls.filter(
    ([url, init]) => String(url).endsWith(`/api/v1${suffix}`) && (init?.method ?? 'GET') === method,
  );

describe('Private Clubs switched off (club.md §14, decision 44)', () => {
  beforeEach(() => {
    flags.privateClubs = false;
  });

  it('Discover offers the Public Club House only, with no Join with a link and no private line', async () => {
    stubServer();
    renderRoot({ entry: 'discover' });
    expect(await screen.findByRole('heading', { name: 'Play together' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join the Public Club House' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Join with an invite link' })).toBeNull();
    expect(screen.getByText(catalogs.en.clubDiscoverBodyPublic)).toBeInTheDocument();
    expect(screen.queryByText(/privately/i)).toBeNull();
    // No teaser either (PRODUCT_PRINCIPLES keeps Coming Soon in "not adopted").
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });

  it('an invite handed to the root is not acted on: it opens like any other entry', async () => {
    stubServer();
    renderRoot({ entry: 'invite', invite: { endpoint: ENDPOINT, token: 'a'.repeat(22) } });
    expect(await screen.findByRole('heading', { name: 'Play together' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Invite link')).toBeNull();
  });

  it('All Clubs has no Join another Club, and the owner has no Invite button or panel', async () => {
    stubServer();
    clubMe = { ...KEN, role: 'owner' };
    clubMembers = [clubMe];
    await joinedConnection({ role: 'owner' });
    await joinedConnection({
      endpoint: 'https://other.example.com',
      clubName: 'Other',
      role: 'owner',
    });
    const user = userEvent.setup();
    renderRoot();
    expect(await screen.findByRole('heading', { name: 'All Clubs' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Join another Club' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Suzuki Family' }));
    expect(await screen.findByRole('heading', { name: 'Rankings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Invite' })).toBeNull();
  });
});

describe('Private Clubs switched on', () => {
  it('shows Join with a link and the owner Invite button', async () => {
    stubServer();
    clubMe = { ...KEN, role: 'owner' };
    clubMembers = [clubMe];
    renderRoot({ entry: 'discover' });
    expect(
      await screen.findByRole('button', { name: 'Join with an invite link' }),
    ).toBeInTheDocument();
    expect(screen.getByText(catalogs.en.clubDiscoverBody)).toBeInTheDocument();
    cleanup();
    await joinedConnection({ role: 'owner' });
    renderRoot();
    expect(await screen.findByRole('button', { name: 'Invite' })).toBeInTheDocument();
  });
});

describe('Disconnect keeps the way back, and joining again returns the same member (decision 43)', () => {
  async function disconnect() {
    const user = userEvent.setup();
    const handlers = renderRoot();
    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Disconnect this device' }));
    await user.click(
      within(screen.getByRole('alertdialog', { name: 'Disconnect this device' })).getByRole(
        'button',
        { name: 'Disconnect' },
      ),
    );
    await screen.findByRole('heading', { name: 'Play together' });
    return handlers;
  }

  it('moves the credentials to the departed list and sends nothing for them', async () => {
    stubServer();
    await joinedConnection({ endpoint: PUBLIC_CLUB_ENDPOINT, clubName: 'PixApps Club' });
    await enqueueResult({
      kind: 'ranking',
      endpoint: PUBLIC_CLUB_ENDPOINT,
      createdAt: '2026-10-02T00:00:00.000Z',
      body: {
        gameId: 'sudoku',
        contractVersion: 1,
        paramsKey: 'hard',
        params: { difficulty: 'hard' },
        seed: 's',
        boardDigest: 'sd1:1',
        outcome: 'completed',
        facts: { elapsedSeconds: 200, mistakes: 0, hints: 0 },
      },
    });
    await disconnect();

    expect(await loadClubConnections()).toEqual([]);
    expect(await findDeparted(PUBLIC_CLUB_ENDPOINT)).toMatchObject({
      memberId: 'm_7',
      memberToken: 'member-token-1',
    });
    // The queue for a Club that is not joined is gone, as before.
    expect(await pendingFor(PUBLIC_CLUB_ENDPOINT)).toEqual([]);
  });

  async function rejoinPublic(typed: string) {
    const user = userEvent.setup();
    renderRoot({ entry: 'discover' });
    await user.click(await screen.findByRole('button', { name: 'Join the Public Club House' }));
    // The screen says this device was here before; the old name is not prefilled (it may be stale).
    expect(await screen.findByText(catalogs.en.clubRejoinNote)).toBeInTheDocument();
    expect(screen.getByLabelText('Nickname')).toHaveValue('');
    await user.type(screen.getByLabelText('Nickname'), typed);
    await user.click(screen.getByRole('button', { name: 'Join and Play' }));
    return expect(await screen.findByRole('heading', { name: 'Rankings' })).toBeInTheDocument();
  }

  async function departedPublic(extra: Record<string, unknown> = {}) {
    await joinedConnection({
      endpoint: PUBLIC_CLUB_ENDPOINT,
      clubName: 'PixApps Club',
      role: 'owner',
      ...extra,
    });
    await departClubConnection(PUBLIC_CLUB_ENDPOINT);
  }

  it('restores the same member: no new join, same id, token and role, owner kept', async () => {
    const fetchMock = stubServer();
    clubMe = { ...KEN, role: 'owner' };
    clubMembers = [clubMe];
    await departedPublic();
    await rejoinPublic('Ken');

    expect(callsTo(fetchMock, 'POST', '/join')).toHaveLength(0);
    expect(callsTo(fetchMock, 'PATCH', '/me')).toHaveLength(0);
    // Verified with the departed token, not an anonymous request.
    const verify = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/api/v1/club'));
    expect(JSON.stringify(verify![1]!.headers)).toContain('member-token-1');
    expect(await loadClubConnections()).toEqual([
      expect.objectContaining({
        endpoint: PUBLIC_CLUB_ENDPOINT,
        memberId: 'm_7',
        memberToken: 'member-token-1',
        role: 'owner',
        nickname: 'Ken',
        autoSend: true,
      }),
    ]);
    expect(await findDeparted(PUBLIC_CLUB_ENDPOINT)).toBeNull();
  });

  it('restores as consented even when the connection had never accepted automatic sending', async () => {
    stubServer();
    await departedPublic({ autoSend: undefined });
    await rejoinPublic('Ken');
    expect((await loadClubConnections())[0]).toMatchObject({ autoSend: true });
  });

  it('renames the member when the typed nickname differs from the server’s', async () => {
    const fetchMock = stubServer();
    await departedPublic();
    await rejoinPublic('Kenji');

    expect(callsTo(fetchMock, 'POST', '/join')).toHaveLength(0);
    const patch = callsTo(fetchMock, 'PATCH', '/me');
    expect(patch).toHaveLength(1);
    expect(JSON.parse(String(patch[0]![1]!.body))).toEqual({ nickname: 'Kenji' });
    expect(await loadClubConnections()).toEqual([
      expect.objectContaining({ memberId: 'm_7', nickname: 'Kenji' }),
    ]);
  });

  it('joins afresh, and forgets the departed entry, when the server no longer knows the token', async () => {
    const fetchMock = stubServer();
    await departedPublic();
    rejectedToken = 'member-token-1';
    joinedToken = 'member-token-2';
    const user = userEvent.setup();
    renderRoot({ entry: 'discover' });
    await user.click(await screen.findByRole('button', { name: 'Join the Public Club House' }));
    await user.type(screen.getByLabelText('Nickname'), 'Ken');
    await user.click(screen.getByRole('button', { name: 'Join and Play' }));
    expect(await screen.findByRole('heading', { name: 'Rankings' })).toBeInTheDocument();

    expect(callsTo(fetchMock, 'POST', '/join')).toHaveLength(1);
    expect(await findDeparted(PUBLIC_CLUB_ENDPOINT)).toBeNull();
    expect((await loadClubConnections())[0]).toMatchObject({ memberToken: 'member-token-2' });
  });

  it('on a network failure shows the error and changes nothing', async () => {
    stubServer();
    await departedPublic();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('offline');
      }),
    );
    const user = userEvent.setup();
    renderRoot({ entry: 'discover' });
    await user.click(await screen.findByRole('button', { name: 'Join the Public Club House' }));
    await user.type(screen.getByLabelText('Nickname'), 'Ken');
    await user.click(screen.getByRole('button', { name: 'Join and Play' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach');
    expect(await loadClubConnections()).toEqual([]);
    expect(await findDeparted(PUBLIC_CLUB_ENDPOINT)).not.toBeNull();
  });

  it('a Club never left shows no rejoin note and no prefilled name', async () => {
    stubServer();
    const user = userEvent.setup();
    renderRoot({ entry: 'discover' });
    await user.click(await screen.findByRole('button', { name: 'Join the Public Club House' }));
    expect(screen.getByLabelText('Nickname')).toHaveValue('');
    expect(screen.queryByText(catalogs.en.clubRejoinNote)).toBeNull();
  });
});

describe('Settings: change your name', () => {
  async function openSettings() {
    const user = userEvent.setup();
    const handlers = renderRoot();
    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    return { user, handlers };
  }

  it('saves through PATCH /me, updates the cached nickname and tells the shell', async () => {
    const fetchMock = stubServer();
    await joinedConnection();
    const { user, handlers } = await openSettings();
    const field = screen.getByLabelText('Change your name');
    expect(field).toHaveValue('Ken');
    // Nothing to save until the name differs.
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.clear(field);
    await user.type(field, '  Kenji ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Name saved');
    const patch = callsTo(fetchMock, 'PATCH', '/me');
    expect(patch).toHaveLength(1);
    expect(JSON.parse(String(patch[0]![1]!.body))).toEqual({ nickname: 'Kenji' });
    await waitFor(async () => expect((await loadClubConnections())[0]!.nickname).toBe('Kenji'));
    await waitFor(() => expect(handlers.onConnectionsChanged).toHaveBeenCalled());
    expect(handlers.onConnectionsChanged.mock.calls.at(-1)![0]).toEqual([
      expect.objectContaining({ nickname: 'Kenji' }),
    ]);
  });

  it('applies the join nickname rules: empty and over 24 characters cannot be saved', async () => {
    stubServer();
    await joinedConnection();
    const { user } = await openSettings();
    const field = screen.getByLabelText('Change your name');
    await user.clear(field);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.type(field, '   ');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(field).toHaveAttribute('maxlength', '24');
  });

  it('shows the server’s refusal and keeps the stored name', async () => {
    stubServer();
    await joinedConnection();
    const { user } = await openSettings();
    // The server no longer knows this member.
    rejectedToken = 'member-token-1';
    const field = screen.getByLabelText('Change your name');
    await user.clear(field);
    await user.type(field, 'Kenji');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('no longer a member');
    expect((await loadClubConnections())[0]!.nickname).toBe('Ken');
  });
});

const rankingItem = (endpoint: string, paramsKey = 'hard') =>
  ({
    kind: 'ranking',
    endpoint,
    createdAt: '2026-10-02T00:00:00.000Z',
    body: {
      gameId: 'sudoku',
      contractVersion: 1,
      paramsKey,
      params: { difficulty: paramsKey },
      seed: 's',
      boardDigest: 'sd1:1',
      outcome: 'completed',
      facts: { elapsedSeconds: 200, mistakes: 0, hints: 0 },
    },
  }) as const;

const dailyItem = (seed: string, endpoint = ENDPOINT) =>
  ({
    kind: 'daily',
    endpoint,
    createdAt: '2026-10-02T00:00:00.000Z',
    body: {
      gameId: 'sudoku',
      contractVersion: 1,
      params: { difficulty: 'hard' },
      seed,
      boardDigest: 'sd1:9f3a1c07',
      title: null,
      daily: todayLocal(),
      result: { outcome: 'completed', facts: { elapsedSeconds: 500, mistakes: 2, hints: 0 } },
    },
  }) as const;

describe('Settings has no way to erase everything (decision 42)', () => {
  it('offers rename and Disconnect only: no erase-all row', async () => {
    stubServer();
    await joinedConnection();
    const user = userEvent.setup();
    renderRoot();
    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('button', { name: 'Disconnect this device' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /erase|delete/i })).not.toBeInTheDocument();
  });
});

/** The table is read with `?top=`, which `callsTo` does not match. */
const rankingReads = (fetchMock: ReturnType<typeof stubServer>) =>
  fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/v1/rankings/sudoku/hard?'))
    .length;

describe('Ranking: deleting your own row (decision 42)', () => {
  async function openRanking() {
    const user = userEvent.setup();
    await joinedConnection();
    renderRoot();
    await user.click(await screen.findByRole('button', { name: /Sudoku · Hard · 1\. Ken 3:58/ }));
    await screen.findByRole('heading', { name: 'Sudoku · Hard' });
    await screen.findByText('You');
    return user;
  }
  const deleteButtons = () => screen.queryAllByRole('button', { name: 'Delete my record' });

  it('puts the button on your own row only', async () => {
    stubServer();
    await openRanking();
    expect(deleteButtons()).toHaveLength(1);
    // Leader and the second row are other members': Report, never Delete.
    const own = screen.getByText('You').closest('.club-line') as HTMLElement;
    expect(within(own).getByRole('button', { name: 'Delete my record' })).toBeInTheDocument();
    const other = screen
      .getByText('Ken', { selector: '.settings-row-label' })
      .closest('.club-line') as HTMLElement;
    expect(
      within(other).queryByRole('button', { name: 'Delete my record' }),
    ).not.toBeInTheDocument();
  });

  it('puts the button on the appended row when you are below the rows sent', async () => {
    stubServer();
    meBelowTop = true;
    await openRanking();
    const own = screen.getByText('You').closest('.club-line') as HTMLElement;
    expect(within(own).getByText('#87')).toBeInTheDocument();
    expect(deleteButtons()).toHaveLength(1);
    expect(own).toContainElement(deleteButtons()[0]!);
  });

  it('says what happens; Cancel changes nothing', async () => {
    const fetchMock = stubServer();
    const user = await openRanking();
    await user.click(deleteButtons()[0]!);
    const dialog = screen.getByRole('alertdialog', { name: 'Delete your record in this ranking?' });
    expect(dialog).toHaveTextContent('Your next finished game enters it again.');
    expect(dialog).toHaveTextContent('This cannot be undone.');
    await enqueueResult(rankingItem(ENDPOINT));
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(callsTo(fetchMock, 'DELETE', '/rankings/sudoku/hard/me')).toHaveLength(0);
    expect(await pendingFor(ENDPOINT)).toHaveLength(1);
    expect(deleteButtons()).toHaveLength(1);
  });

  it('drops the queued items that would recreate it, deletes, and reads the table again', async () => {
    const fetchMock = stubServer();
    const user = await openRanking();
    // Same table, another table, another Club: only the first goes.
    await enqueueResult(rankingItem(ENDPOINT));
    await enqueueResult(rankingItem(ENDPOINT, 'easy'));
    await enqueueResult(rankingItem('https://other.example.com'));
    const reads = rankingReads(fetchMock);

    await user.click(deleteButtons()[0]!);
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    await waitFor(() =>
      expect(callsTo(fetchMock, 'DELETE', '/rankings/sudoku/hard/me')).toHaveLength(1),
    );
    // The queue was already clean when the request arrived.
    expect(queuedAtDelete).toHaveLength(1);
    expect((queuedAtDelete as { body: { paramsKey: string } }[])[0]!.body.paramsKey).toBe('easy');
    expect(await pendingFor('https://other.example.com')).toHaveLength(1);
    await waitFor(() => expect(rankingReads(fetchMock)).toBeGreaterThan(reads));
    // Reloaded: the row is gone, and so is the button.
    await waitFor(() => expect(screen.getByText('23 entries')).toBeInTheDocument());
    expect(screen.queryByText('You')).not.toBeInTheDocument();
    expect(deleteButtons()).toHaveLength(0);
    // Still a member of the Club.
    expect(await loadClubConnections()).toHaveLength(1);
  });

  it('treats a 404 (already gone) as done and reads the table again', async () => {
    const fetchMock = stubServer();
    const user = await openRanking();
    deleteAnswers = 404;
    const reads = rankingReads(fetchMock);
    await user.click(deleteButtons()[0]!);
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    await waitFor(() => expect(rankingReads(fetchMock)).toBeGreaterThan(reads));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the error when the server refuses', async () => {
    stubServer();
    const user = await openRanking();
    rejectedToken = 'member-token-1';
    await user.click(deleteButtons()[0]!);
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('no longer a member');
  });
});

describe('Today challenge: deleting your own result (decision 42)', () => {
  async function openChallenge() {
    dailyChallenges = true;
    hasDailyResult = true;
    const user = userEvent.setup();
    await joinedConnection();
    renderRoot();
    await user.click(await screen.findByRole('button', { name: /Sudoku · Hard · Daily · by Yoh/ }));
    await screen.findByText('8:20 Mistakes 2 Hints 0');
    return user;
  }
  const deleteButtons = () => screen.queryAllByRole('button', { name: 'Delete my record' });

  it('puts the button on your own result only', async () => {
    stubServer();
    await openChallenge();
    expect(deleteButtons()).toHaveLength(1);
    const own = screen.getByText('You').closest('.club-line') as HTMLElement;
    expect(own).toContainElement(deleteButtons()[0]!);
  });

  it('says what happens; Cancel changes nothing', async () => {
    const fetchMock = stubServer();
    const user = await openChallenge();
    await user.click(deleteButtons()[0]!);
    const dialog = screen.getByRole('alertdialog', {
      name: 'Remove your result from this challenge?',
    });
    expect(dialog).toHaveTextContent('You cannot send another result to this challenge.');
    expect(dialog).toHaveTextContent('This cannot be undone.');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(callsTo(fetchMock, 'DELETE', '/challenges/ch_d/results/me')).toHaveLength(0);
    expect(deleteButtons()).toHaveLength(1);
  });

  it('drops the queued daily items for this challenge, deletes, and reads it again', async () => {
    const fetchMock = stubServer();
    const user = await openChallenge();
    // This challenge's daily goes; another board's daily and another Club's stay.
    await enqueueResult(dailyItem('sudoku-daily-today'));
    await enqueueResult(dailyItem('sudoku-daily-other'));
    await enqueueResult(dailyItem('sudoku-daily-today', 'https://other.example.com'));
    const reads = callsTo(fetchMock, 'GET', '/challenges/ch_d/results').length;

    await user.click(deleteButtons()[0]!);
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    await waitFor(() =>
      expect(callsTo(fetchMock, 'DELETE', '/challenges/ch_d/results/me')).toHaveLength(1),
    );
    expect(queuedAtDelete).toHaveLength(1);
    expect((queuedAtDelete as { body: { seed: string } }[])[0]!.body.seed).toBe(
      'sudoku-daily-other',
    );
    await waitFor(() =>
      expect(callsTo(fetchMock, 'GET', '/challenges/ch_d/results').length).toBeGreaterThan(reads),
    );
    await waitFor(() => expect(screen.queryByText('You')).not.toBeInTheDocument());
    expect(deleteButtons()).toHaveLength(0);
    expect(await loadClubConnections()).toHaveLength(1);
    expect(await pendingFor('https://other.example.com')).toHaveLength(1);
  });

  it('after withdrawing, the screen promises no send and offers Play again', async () => {
    stubServer();
    const user = await openChallenge();
    // Before: the server's `mine` is false here, so the disclosure and `Play` show.
    expect(screen.getByText(/your result is sent to/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();

    await user.click(deleteButtons()[0]!);
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    // The server refuses any later result (already_submitted), so nothing is promised.
    await waitFor(() => expect(deleteButtons()).toHaveLength(0));
    expect(screen.queryByText(/your result is sent to/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument();
  });

  it('treats a 404 (already gone) as done and reads the challenge again', async () => {
    const fetchMock = stubServer();
    const user = await openChallenge();
    deleteAnswers = 404;
    const reads = callsTo(fetchMock, 'GET', '/challenges/ch_d/results').length;
    await user.click(deleteButtons()[0]!);
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    await waitFor(() =>
      expect(callsTo(fetchMock, 'GET', '/challenges/ch_d/results').length).toBeGreaterThan(reads),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the error when the server refuses', async () => {
    stubServer();
    const user = await openChallenge();
    rejectedToken = 'member-token-1';
    await user.click(deleteButtons()[0]!);
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('no longer a member');
  });
});

describe('Opening a Club with no network (club.md §10)', () => {
  // A WKWebView with no network can leave a fetch pending after the abort; the
  // screen must still end in one line, with Reload working once the network is
  // back. RTL's waitFor/findBy wait on a real `setTimeout(0)` that fake timers
  // swallow, so these cases move the clock by hand and use plain queries.
  const UNREACHABLE = 'Could not reach Suzuki Family';

  /** A fetch the platform never settles, abort or not. */
  const hangingFetch = () =>
    vi.fn((..._args: Parameters<typeof fetch>) => new Promise<Response>(() => {}));

  async function advance(ms: number) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  /**
   * Timers still pending once the zero-delay ones are run (jsdom fires a
   * `storage` event from a `setTimeout(0)` after every localStorage write).
   * Anything left is a deadline that was never cancelled.
   */
  async function pendingTimers() {
    await advance(0);
    return vi.getTimerCount();
  }

  const reloadButton = () => screen.getByRole('button', { name: 'Reload' });

  /**
   * How long a Club screen waits for its own flush before it reads the lists. The
   * constant is not exported: this mirrors FLUSH_WAIT_MS in ClubScreen.tsx (one
   * request's timeout and a beat), and the timing tests below fail if they drift.
   */
  const FLUSH_WAIT_MS = REQUEST_TIMEOUT_MS + 1_000;

  /**
   * A flush for this Club that is still running and never settles on its own (a
   * result screen's, outbox.ts `flushing`): whatever flushes after it queues behind it.
   */
  function holdFlush() {
    let release!: () => void;
    const gate = new Promise<never>((_, reject) => {
      release = () => reject(new ClubApiError('unreachable', null, 'released'));
    });
    const stuck = { submitRanking: () => gate } as unknown as ClubClient;
    return { release, earlier: flushOutbox(ENDPOINT, stuck) };
  }

  /**
   * Let the held flush finish, and the Club screen's own flush queued behind it
   * (it asks the hanging server and gives up at its deadline), so the next test
   * finds this Club's queue free.
   */
  async function drainHeld(release: () => void, earlier: Promise<unknown>) {
    release();
    await earlier;
    await advance(REQUEST_TIMEOUT_MS);
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ends in "Could not reach" with Reload enabled, and Reload loads once the network is back', async () => {
    await joinedConnection();
    const hang = hangingFetch();
    vi.stubGlobal('fetch', hang);
    vi.useFakeTimers();
    renderRoot();
    await advance(0);

    // Waiting: the three requests are out, Reload is off, nothing says it failed yet.
    expect(hang.mock.calls).toHaveLength(3);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(reloadButton()).toBeDisabled();
    await advance(REQUEST_TIMEOUT_MS - 1);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // The limit passes: one line, Reload enabled, no "Loading…".
    await advance(1);
    expect(screen.getByRole('alert')).toHaveTextContent(UNREACHABLE);
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    expect(reloadButton()).toBeEnabled();
    // Nothing is left running behind the settled screen.
    expect(await pendingTimers()).toBe(0);

    // The network is back: Reload reads the Club again, in the same open screen.
    const fetchMock = stubServer();
    fireEvent.click(reloadButton());
    await advance(0);
    expect(screen.getByRole('heading', { name: 'Rankings' })).toBeInTheDocument();
    expect(screen.getByText('1. Ken 3:58')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    expect(reloadButton()).toBeEnabled();
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('with a result queued for the Club, the flush it starts with cannot keep the screen on "Loading…"', async () => {
    await joinedConnection();
    await enqueueResult(rankingItem(ENDPOINT));
    const hang = hangingFetch();
    vi.stubGlobal('fetch', hang);
    vi.useFakeTimers();
    renderRoot();
    await advance(0);

    // The queued result goes first, and its request hangs: still just loading.
    expect(hang.mock.calls).toHaveLength(1);
    expect(String(hang.mock.calls[0]![0])).toContain('/rankings/results');
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    await advance(REQUEST_TIMEOUT_MS - 1);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // The send's own limit passes: the flush says the Club is unreachable, and the
    // screen says so right then — about 10 s in, not 20 — instead of asking for the
    // three lists and waiting out the same limit again.
    await advance(1);
    expect(screen.getByRole('alert')).toHaveTextContent(UNREACHABLE);
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    expect(reloadButton()).toBeEnabled();
    // The only request that ever went out is the queued result's POST: no list GETs.
    expect(hang.mock.calls).toHaveLength(1);
    // A send that never got through costs the result nothing: it waits for the next try.
    expect(await pendingFor(ENDPOINT)).toHaveLength(1);
    expect(await pendingTimers()).toBe(0);
    // ...and nothing follows later: a further limit's time passes with no new request.
    await advance(REQUEST_TIMEOUT_MS);
    expect(hang.mock.calls).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent(UNREACHABLE);
  });

  it('a flush that never settles holds the screen for one request time and a beat at most, then the Club is read', async () => {
    // A result screen's own flush for this Club is still running (outbox.ts
    // `flushing`), and it never settles; the Club screen queues behind it.
    await joinedConnection();
    await enqueueResult(rankingItem(ENDPOINT));
    const { release, earlier } = holdFlush();
    const hang = hangingFetch();
    vi.stubGlobal('fetch', hang);
    vi.useFakeTimers();
    try {
      renderRoot();
      await advance(0);

      // Waiting on the queue: nothing was asked of the server yet.
      expect(hang.mock.calls).toHaveLength(0);
      expect(screen.getByText('Loading…')).toBeInTheDocument();
      await advance(FLUSH_WAIT_MS - 1);
      expect(hang.mock.calls).toHaveLength(0);
      expect(screen.getByText('Loading…')).toBeInTheDocument();

      // The wait is over: the screen stops waiting and reads the Club...
      await advance(1);
      expect(hang.mock.calls).toHaveLength(3);
      expect(screen.getByText('Loading…')).toBeInTheDocument();
      // ...which, with every request hanging, ends in the one line a request time later.
      await advance(REQUEST_TIMEOUT_MS - 1);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      await advance(1);
      expect(screen.getByRole('alert')).toHaveTextContent(UNREACHABLE);
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
      expect(reloadButton()).toBeEnabled();
    } finally {
      await drainHeld(release, earlier);
    }
  });

  it('a screen that is gone by the time the wait ends sends no list request', async () => {
    await joinedConnection();
    await enqueueResult(rankingItem(ENDPOINT));
    const { release, earlier } = holdFlush();
    const hang = hangingFetch();
    vi.stubGlobal('fetch', hang);
    vi.useFakeTimers();
    try {
      renderRoot();
      await advance(0);
      expect(hang.mock.calls).toHaveLength(0);
      expect(screen.getByText('Loading…')).toBeInTheDocument();

      // The person leaves the Club screen a moment before its wait for the queue ends.
      await advance(FLUSH_WAIT_MS - 1);
      cleanup();
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();

      // The wait ends, and a request's time more: nothing asks the server for a list
      // on behalf of a screen that no longer exists.
      await advance(1);
      await advance(REQUEST_TIMEOUT_MS);
      expect(hang.mock.calls).toHaveLength(0);
    } finally {
      await drainHeld(release, earlier);
    }
  });

  it('a normal open leaves no timer behind', async () => {
    await joinedConnection();
    await enqueueResult(rankingItem(ENDPOINT));
    stubServer();
    vi.useFakeTimers();
    renderRoot();
    await advance(0);
    expect(screen.getByRole('heading', { name: 'Rankings' })).toBeInTheDocument();
    expect(await pendingFor(ENDPOINT)).toEqual([]);
    // The wait that guards the queued send was cancelled with the send.
    expect(await pendingTimers()).toBe(0);
  });

  it('Reload sends what waited: a result queued while offline goes out when the person presses Reload', async () => {
    await joinedConnection();
    await enqueueResult(rankingItem(ENDPOINT));
    const fetchMock = stubServer();
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      renderRoot();
      // Offline: the one line at once, and the result stays queued.
      expect(await screen.findByRole('alert')).toHaveTextContent(UNREACHABLE);
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
      expect(reloadButton()).toBeEnabled();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(await pendingFor(ENDPOINT)).toHaveLength(1);

      // The network is back. Reload is the person's own action: it flushes the
      // queue (the open screen already used its one flush), then reads the Club.
      online.mockReturnValue(true);
      fireEvent.click(reloadButton());
      expect(await screen.findByRole('heading', { name: 'Rankings' })).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      const posts = fetchMock.mock.calls.filter(
        ([url, init]) =>
          String(url).endsWith('/rankings/results') && (init as RequestInit).method === 'POST',
      );
      expect(posts).toHaveLength(1);
      // The result goes before the lists are read, oldest first (club.md §10).
      expect(fetchMock.mock.calls[0]![0]).toBe(`${ENDPOINT}/api/v1/rankings/results`);
      expect(await pendingFor(ENDPOINT)).toEqual([]);
    } finally {
      online.mockRestore();
    }
  });

  it('a device that reports itself offline gets the one line at once, and Reload works when it is back', async () => {
    await joinedConnection();
    const fetchMock = stubServer();
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      renderRoot();
      expect(await screen.findByRole('alert')).toHaveTextContent(UNREACHABLE);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
      expect(reloadButton()).toBeEnabled();

      online.mockReturnValue(true);
      fireEvent.click(reloadButton());
      expect(await screen.findByRole('heading', { name: 'Rankings' })).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    } finally {
      online.mockRestore();
    }
  });
});

describe('Resending the queue is the person’s own action (club.md §10)', () => {
  const reload = () => screen.getByRole('button', { name: 'Reload' });

  it('the refresh after changing your name reads the lists but does not resend; Reload does', async () => {
    await joinedConnection();
    await enqueueResult(rankingItem(ENDPOINT));
    // The server answers the queued result, every time, with a failure that is not
    // final and not "unreachable": the item stays queued and the flush is "blocked".
    const server = stubServer();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).endsWith('/api/v1/rankings/results') && init?.method === 'POST'
        ? reply({ error: { code: 'rate_limited', message: 'slow down' } }, 429)
        : server(input, init),
    );
    vi.stubGlobal('fetch', fetchMock);
    const posts = () => callsTo(fetchMock, 'POST', '/rankings/results');
    const user = userEvent.setup();
    renderRoot();

    // Opening the screen is the person's action: the queued result is sent once,
    // refused for now, and the lists load all the same.
    expect(await screen.findByRole('heading', { name: 'Rankings' })).toBeInTheDocument();
    expect(posts()).toHaveLength(1);
    expect(callsTo(fetchMock, 'GET', '/club')).toHaveLength(1);
    expect(await pendingFor(ENDPOINT)).toHaveLength(1);

    // Changing your own name: the PATCH goes out and the screen reads the lists again...
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const field = screen.getByLabelText('Change your name');
    await user.clear(field);
    await user.type(field, 'Kenji');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Name saved');
    expect(callsTo(fetchMock, 'PATCH', '/me')).toHaveLength(1);
    await waitFor(() => expect(callsTo(fetchMock, 'GET', '/club')).toHaveLength(2));
    await waitFor(() => expect(callsTo(fetchMock, 'GET', '/rankings')).toHaveLength(2));
    // ...but that refresh is the screen's own, not the person's asking: nothing is resent.
    expect(posts()).toHaveLength(1);

    // Back on the Club screen, Reload is the person's action again: one more send.
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(reload()).toBeEnabled());
    await user.click(reload());
    await waitFor(() => expect(callsTo(fetchMock, 'GET', '/club')).toHaveLength(3));
    await waitFor(() => expect(reload()).toBeEnabled());
    expect(posts()).toHaveLength(2);
    // Still refused, so still queued; the lists are on screen and no error is.
    expect(await pendingFor(ENDPOINT)).toHaveLength(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rankings' })).toBeInTheDocument();
  });
});
