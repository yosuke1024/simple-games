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
  id: 'r_1',
  memberId: 'm_1',
  nickname: 'Ken',
  submittedAt: '2026-09-10T00:00:00.000Z',
  facts: { elapsedSeconds: 238, mistakes: 0, hints: 1 },
  seed: 's',
  boardDigest: 'sd1:1',
};
/** The viewer's (m_7) result that sits below the rows sent when `meBelowTop`. */
const MINE = {
  ...LEADER,
  id: 'r_9',
  memberId: 'm_7',
  nickname: 'Ken B',
  facts: { elapsedSeconds: 600, mistakes: 3, hints: 0 },
};
/**
 * Sudoku · Hard as the server ranks it: one row per result (club.md §16-1), so
 * the viewer (m_7) is on it twice and Ken (m_1) twice.
 */
const HARD_ROWS = [
  LEADER,
  { ...MINE, id: 'r_2', facts: { elapsedSeconds: 300, mistakes: 1, hints: 0 } },
  {
    ...LEADER,
    id: 'r_3',
    memberId: 'm_2',
    nickname: 'Mika',
    facts: { elapsedSeconds: 320, mistakes: 0, hints: 0 },
  },
  { ...MINE, id: 'r_4', facts: { elapsedSeconds: 400, mistakes: 2, hints: 2 } },
  { ...LEADER, id: 'r_5', facts: { elapsedSeconds: 450, mistakes: 1, hints: 1 } },
];
/** Sudoku · Easy: Mika alone. */
const EASY_ROW = {
  ...LEADER,
  id: 'e_1',
  memberId: 'm_2',
  nickname: 'Mika',
  facts: { elapsedSeconds: 100, mistakes: 0, hints: 0 },
};
const sudokuTable = (paramsKey: string, entryCount: number) => ({
  gameId: 'sudoku',
  paramsKey,
  entryCount,
  leader: LEADER,
});
/** A `GET /rankings/mine` row: the viewer's standing in one table. */
const standing = (
  gameId: string,
  paramsKey: string,
  best: { rank: number | null; facts: Record<string, number>; nextValue: number | null },
  entryCount = 24,
) => ({
  gameId,
  paramsKey,
  entryCount,
  leader: LEADER,
  best: {
    rank: best.rank,
    entry: { ...MINE, id: `${gameId}-${paramsKey}`, facts: best.facts },
    nextValue: best.nextValue,
  },
});
const MIKA = { id: 'm_2', nickname: 'Mika', role: 'member', joinedAt: '2026-09-10T00:00:00.000Z' };
/** What `GET /club` answers for the viewer and the member list. */
let clubMe: Record<string, unknown> = KEN;
let clubMembers: Record<string, unknown>[] = [KEN];
let clubMemberCount: number | undefined;
let reportedList: { member: Record<string, unknown>; reportCount: number }[] = [];
let meBelowTop = false;
/** What `GET /rankings` lists. */
let rankingList: unknown[] = [sudokuTable('hard', 24)];
/** What `GET /rankings/mine` answers; 404 is a server from before the route. */
let mineList: unknown[] | 404 = [];
/** Rows the viewer deleted by id; the table is read without them. */
let deletedRows: string[] = [];
/** A server from before row ids: rows come without `id`. */
let rowsWithoutIds = false;
let dailyChallenges = false;
/** A token the server no longer accepts (the owner removed that member, or the Club was rebuilt). */
let rejectedToken: string | null = null;
/** The token a fresh `POST /join` hands out. */
let joinedToken = 'member-token-1';
/** What the device still had queued for the Club at the moment a DELETE arrived. */
let queuedAtDelete: unknown[] | null = null;
/** The viewer's own Today result, until the server is asked to delete it. */
let dailyResultDeleted = false;
let hasDailyResult = false;
/** What the next DELETE answers: 204, or the 404 of a row that is already gone. */
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
    const entryDelete = /^\/rankings\/sudoku\/hard\/entries\/([^/]+)$/.exec(path);
    if (method === 'DELETE' && (entryDelete || path === '/challenges/ch_d/results/me')) {
      queuedAtDelete = await pendingFor(ENDPOINT);
      if (deleteAnswers === 404) return reply({ error: { code: 'not_found', message: 'no' } }, 404);
      if (entryDelete) deletedRows.push(decodeURIComponent(entryDelete[1]!));
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
    if (path === '/rankings') return reply(rankingList);
    if (path === '/rankings/mine') {
      if (mineList === 404) return reply({ error: { code: 'not_found', message: 'no' } }, 404);
      return reply(mineList);
    }
    const withoutIds = <R extends { id?: string }>(row: R) => {
      if (!rowsWithoutIds) return row;
      const { id: _id, ...rest } = row;
      return rest;
    };
    if (path === '/rankings/sudoku/hard') {
      const rows = (
        meBelowTop ? HARD_ROWS.filter((row) => row.memberId !== 'm_7') : HARD_ROWS
      ).filter((row) => !deletedRows.includes(row.id));
      // The viewer's best row: the first of theirs in the order, or the one below the rows sent.
      const at = rows.findIndex((row) => row.memberId === 'm_7');
      const me =
        meBelowTop && !deletedRows.includes(MINE.id)
          ? { rank: 87, entry: MINE, nextValue: 590 }
          : at === -1
            ? null
            : {
                rank: at + 1,
                entry: rows[at]!,
                nextValue: at === 0 ? null : rows[at - 1]!.facts.elapsedSeconds,
              };
      return reply({
        gameId: 'sudoku',
        paramsKey: 'hard',
        entryCount: 24 - deletedRows.length,
        entries: rows.map(withoutIds),
        me: me === null ? null : { ...me, entry: withoutIds(me.entry) },
      });
    }
    if (path === '/rankings/sudoku/easy') {
      return reply({
        gameId: 'sudoku',
        paramsKey: 'easy',
        entryCount: 1,
        entries: [withoutIds(EASY_ROW)],
        me: null,
      });
    }
    const table = /^\/rankings\/([^/]+)\/([^/]+)$/.exec(path);
    if (table && method === 'GET') {
      return reply({ gameId: table[1], paramsKey: table[2], entryCount: 0, entries: [], me: null });
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
  rankingList = [sudokuTable('hard', 24)];
  mineList = [];
  deletedRows = [];
  rowsWithoutIds = false;
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
    // Straight into the Club: its rankings are on the shelves, one tile per game.
    expect(await screen.findByRole('heading', { name: 'Rankings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sudoku' })).toBeInTheDocument();
    // The invite-URL join showed the disclosure too: stored as consented.
    expect((await loadClubConnections())[0]).toMatchObject({ endpoint: ENDPOINT, autoSend: true });
  });

  it('loads the club, today, the rankings and your rankings: four requests', async () => {
    const fetchMock = stubServer();
    await joinedConnection();
    renderRoot();
    expect(await screen.findByRole('heading', { name: 'Rankings' })).toBeInTheDocument();
    const paths = fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname);
    expect(paths.sort()).toEqual([
      '/api/v1/challenges',
      '/api/v1/club',
      '/api/v1/rankings',
      '/api/v1/rankings/mine',
    ]);
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

  it('heads the members with the total, not the page; another member’s name opens the sheet with Report', async () => {
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
    // No row carries Report any more (decision 49); one's own name is plain text.
    expect(screen.queryByRole('button', { name: /Report/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ken' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mika' }));
    const sheet = screen.getByRole('dialog', { name: 'Mika' });
    // The name, the row's own record (the joined-on line), and one Report button.
    expect(within(sheet).getByRole('heading', { name: 'Mika' })).toBeInTheDocument();
    expect(sheet).toHaveTextContent('Joined');
    expect(
      within(sheet)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Report', 'Close']);
    await user.click(within(sheet).getByRole('button', { name: 'Report' }));
    const confirm = screen.getByRole('alertdialog', { name: 'Report this nickname?' });
    await user.click(within(confirm).getByRole('button', { name: 'Report' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Reported');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const posted = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/members/m_2/report'),
    );
    expect(posted?.[1]?.method).toBe('POST');
    // The row carries no mark: Mika's name still opens the sheet.
    expect(screen.getByRole('button', { name: 'Mika' })).toBeInTheDocument();
    // No owner-only request for a member.
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/members/reported'))).toBe(
      false,
    );
  });

  it('the sheet closes on Escape and on Close, and Cancel in the confirmation sends nothing', async () => {
    const fetchMock = stubServer();
    clubMembers = [KEN, MIKA];
    const user = userEvent.setup();
    await joinedConnection();
    renderRoot();

    await user.click(await screen.findByRole('button', { name: 'Mika' }));
    expect(screen.getByRole('dialog', { name: 'Mika' })).toBeInTheDocument();
    // Focus moved in, onto Close.
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // ...and back to the name that opened it.
    expect(screen.getByRole('button', { name: 'Mika' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Mika' }));
    // Tab stays inside the sheet.
    await user.tab();
    await user.tab();
    expect(screen.getByRole('dialog', { name: 'Mika' })).toContainElement(
      document.activeElement as HTMLElement,
    );
    await user.click(screen.getByRole('button', { name: 'Report' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
    );
    // Back on the sheet; Close closes it.
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/report'))).toBe(false);
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
    // The owner's device opens no sheet: names are plain text, the owner acts by Rename / Remove.
    expect(screen.queryByRole('button', { name: 'Mika' })).not.toBeInTheDocument();

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

describe('Ranking: deleting one of your results (decisions 42, 51)', () => {
  async function openRanking() {
    const user = userEvent.setup();
    await joinedConnection();
    renderRoot();
    await user.click(await screen.findByRole('button', { name: 'Sudoku' }));
    await screen.findByRole('heading', { name: 'Sudoku' });
    await screen.findAllByText('You');
    return user;
  }
  const deleteButtons = () => screen.queryAllByRole('button', { name: 'Delete my record' });
  const rowOf = (text: string) => screen.getByText(text).closest('.club-line') as HTMLElement;

  it('puts a quiet Delete on each of your rows, and on no one else’s', async () => {
    stubServer();
    await openRanking();
    // Two results of the viewer's on the table: two rows saying You, each with its own button.
    expect(screen.getAllByText('You')).toHaveLength(2);
    expect(deleteButtons()).toHaveLength(2);
    for (const button of deleteButtons()) {
      // The visible word is Delete; the accessible name says whose; not the danger colour.
      expect(button).toHaveTextContent(/^Delete$/);
      expect(button).not.toHaveClass('club-danger');
      expect(button.closest('.club-line')).toHaveClass('club-own');
    }
    const other = rowOf('7:30 Mistakes 1 Hints 1');
    expect(within(other).queryByRole('button', { name: 'Delete my record' })).toBeNull();
  });

  it('puts the button on the appended row when your best is below the rows sent', async () => {
    stubServer();
    meBelowTop = true;
    await openRanking();
    const own = rowOf('10:00 Mistakes 3 Hints 0');
    expect(within(own).getByText('#87')).toBeInTheDocument();
    expect(deleteButtons()).toHaveLength(1);
    expect(own).toContainElement(deleteButtons()[0]!);
  });

  it('says only this result goes; Cancel changes nothing', async () => {
    const fetchMock = stubServer();
    const user = await openRanking();
    await user.click(deleteButtons()[0]!);
    const dialog = screen.getByRole('alertdialog', { name: 'Delete this result?' });
    expect(dialog).toHaveTextContent('Only this result is deleted.');
    expect(dialog).toHaveTextContent('Your other results stay.');
    expect(dialog).toHaveTextContent('This cannot be undone.');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(0);
    expect(deleteButtons()).toHaveLength(2);
  });

  it('deletes that one row by its id, keeps the queue, and reads the table again', async () => {
    const fetchMock = stubServer();
    const user = await openRanking();
    // A queued result is another game's: it becomes another row, so nothing is dropped.
    await enqueueResult(rankingItem(ENDPOINT));
    const reads = rankingReads(fetchMock);

    // The second of the viewer's rows (6:40, #4).
    await user.click(within(rowOf('6:40 Mistakes 2 Hints 2')).getByRole('button'));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    await waitFor(() =>
      expect(callsTo(fetchMock, 'DELETE', '/rankings/sudoku/hard/entries/r_4')).toHaveLength(1),
    );
    // Never the compatibility route that deletes every row of the viewer's.
    expect(callsTo(fetchMock, 'DELETE', '/rankings/sudoku/hard/me')).toHaveLength(0);
    expect(queuedAtDelete).toHaveLength(1);
    expect(await pendingFor(ENDPOINT)).toHaveLength(1);
    await waitFor(() => expect(rankingReads(fetchMock)).toBeGreaterThan(reads));
    // Reloaded: that row is gone, the other one of the viewer's stays.
    await waitFor(() => expect(screen.queryByText('6:40 Mistakes 2 Hints 2')).toBeNull());
    expect(screen.getAllByText('You')).toHaveLength(1);
    expect(deleteButtons()).toHaveLength(1);
    expect(screen.getByText('23 entries')).toBeInTheDocument();
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

  it('deletes through the compatibility route on a server whose rows have no id', async () => {
    const fetchMock = stubServer();
    rowsWithoutIds = true;
    const user = await openRanking();
    expect(screen.getAllByText('You')).toHaveLength(2);
    // One row per member there, so the route that deletes all of the viewer's rows deletes that one.
    await user.click(deleteButtons()[0]!);
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    await waitFor(() =>
      expect(callsTo(fetchMock, 'DELETE', '/rankings/sudoku/hard/me')).toHaveLength(1),
    );
    expect(deletedRows).toEqual([]);
  });

  it('a delete makes the Club read its lists again on the way back, without resending', async () => {
    const fetchMock = stubServer();
    const user = await openRanking();
    await enqueueResult(rankingItem(ENDPOINT));
    const lists = callsTo(fetchMock, 'GET', '/rankings').length;
    await user.click(deleteButtons()[0]!);
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    await waitFor(() => expect(deletedRows).toEqual(['r_2']));
    await waitFor(() => expect(deleteButtons()).toHaveLength(1));

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { name: 'Rankings' })).toBeInTheDocument();
    await waitFor(() => expect(callsTo(fetchMock, 'GET', '/rankings')).toHaveLength(lists + 1));
    // A read, not the person's Reload: what waited stays queued.
    expect(callsTo(fetchMock, 'POST', '/rankings/results')).toHaveLength(0);
    expect(await pendingFor(ENDPOINT)).toHaveLength(1);
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

    // Waiting: the four requests are out, Reload is off, nothing says it failed yet.
    expect(hang.mock.calls).toHaveLength(4);
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
    expect(screen.getByRole('button', { name: 'Sudoku' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    expect(reloadButton()).toBeEnabled();
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(4);
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
    // four lists and waiting out the same limit again.
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
      expect(hang.mock.calls).toHaveLength(4);
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

/** The tiles on the Club's shelves, in the order drawn (their names; the glyph is hidden). */
const tiles = () =>
  Array.from(document.querySelectorAll('.game-cell')).map((b) => b.getAttribute('aria-label'));
/** The "Your rankings" rows, in the order drawn. */
const myRows = () => Array.from(document.querySelectorAll<HTMLElement>('.club-mine'));
const tabs = () => screen.queryAllByRole('tab');
const selectedTab = () => tabs().find((tab) => tab.getAttribute('aria-selected') === 'true');
const tableReads = (fetchMock: ReturnType<typeof stubServer>, paramsKey: string) =>
  fetchMock.mock.calls.filter(([url]) =>
    String(url).includes(`/api/v1/rankings/sudoku/${paramsKey}?`),
  ).length;

describe('Club screen: your rankings, then the rankings as shelves (club.md §9, decisions 46–47)', () => {
  it('folds the tables into one tile per game, on the home’s category shelves, in the home’s order', async () => {
    stubServer();
    rankingList = [
      { gameId: 'solitaire', paramsKey: 'draw-3', entryCount: 2, leader: LEADER },
      sudokuTable('hard', 24),
      { gameId: 'minesweeper', paramsKey: 'easy', entryCount: 3, leader: LEADER },
      sudokuTable('easy', 1),
      { gameId: 'freecell', paramsKey: 'standard', entryCount: 5, leader: LEADER },
      // A game this build does not know is not on any shelf.
      { gameId: 'not-a-game', paramsKey: 'x', entryCount: 1, leader: LEADER },
    ];
    await joinedConnection();
    renderRoot();
    expect(await screen.findByRole('heading', { name: 'Rankings' })).toBeInTheDocument();

    // Logic, then Cards (GAME_CATEGORIES); no shelf for a category with no table.
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Logic',
      'Cards',
    ]);
    // Sudoku's two tables are one tile; registry order within a shelf.
    expect(tiles()).toEqual(['Sudoku', 'Minesweeper', 'Solitaire', 'FreeCell']);
    // A tile is the game alone: no leader, no count (club.md §9).
    expect(screen.queryByText(/entries/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ken 3:58/)).not.toBeInTheDocument();
  });

  it('says Nothing here yet when there is no table at all', async () => {
    stubServer();
    rankingList = [];
    await joinedConnection();
    renderRoot();
    expect(await screen.findByRole('heading', { name: 'Rankings' })).toBeInTheDocument();
    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument();
    expect(tiles()).toEqual([]);
  });

  it('heads the Club with your rankings: rank, entries, your best and the gap, in the shelves’ order', async () => {
    stubServer();
    dailyChallenges = true;
    rankingList = [
      sudokuTable('easy', 80),
      sudokuTable('hard', 24),
      { gameId: 'solitaire', paramsKey: 'draw-1', entryCount: 3, leader: LEADER },
      { gameId: '2048', paramsKey: 'standard', entryCount: 9, leader: LEADER },
    ];
    // In the server's order (by key spelling), not the one the screen draws.
    mineList = [
      standing(
        '2048',
        'standard',
        { rank: 4, facts: { score: 1000, bestTile: 128 }, nextValue: 1200 },
        9,
      ),
      standing(
        'solitaire',
        'draw-1',
        { rank: 1, facts: { moves: 90, elapsedSeconds: 300, hints: 0 }, nextValue: null },
        3,
      ),
      standing('sudoku', 'hard', {
        rank: 2,
        facts: { elapsedSeconds: 300, mistakes: 1, hints: 0 },
        nextValue: 238,
      }),
      // Below the server's counting ceiling: no number, the rest as usual.
      standing(
        'sudoku',
        'easy',
        { rank: null, facts: { elapsedSeconds: 700, mistakes: 0, hints: 0 }, nextValue: 690 },
        80,
      ),
    ];
    await joinedConnection();
    renderRoot();

    expect(await screen.findByRole('heading', { name: 'Your rankings' })).toBeInTheDocument();
    // First on the screen, before Today and the shelves.
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Your rankings',
      'Today',
      'Rankings',
      '1 members',
    ]);
    // Fixed order: category, then registry, then the mode's place — never by rank.
    expect(myRows().map((row) => row.getAttribute('aria-label'))).toEqual([
      'Sudoku · Easy · 80 entries · 11:40 · 0:10 to the next rank',
      'Sudoku · Hard · #2 · 24 entries · 5:00 · 1:02 to the next rank',
      'Solitaire · Draw 1 · #1 · 3 entries · 90',
      '2048 · #4 · 9 entries · 1000 · Score 200 to the next rank',
    ]);
    const [easy, hard, solitaire, game2048] = myRows();
    // The first three wear the table's disc; the first of all has no gap to show.
    expect(hard!.querySelector('.club-medal-2')).not.toBeNull();
    expect(solitaire!.querySelector('.club-medal-1')).not.toBeNull();
    expect(solitaire).not.toHaveTextContent('to the next rank');
    expect(game2048!.querySelector('.club-medal')).toBeNull();
    expect(game2048).toHaveTextContent('#4 · 9 entries');
    expect(easy!.querySelector('.club-rank')).toBeNull();
    expect(easy).toHaveTextContent('0:10 to the next rank');
    // No count of tables joined.
    expect(screen.queryByText(/tables/)).not.toBeInTheDocument();
  });

  it('opens the table a row names, with its mode chosen', async () => {
    const fetchMock = stubServer();
    rankingList = [sudokuTable('easy', 1), sudokuTable('hard', 24)];
    mineList = [
      standing('sudoku', 'hard', { rank: 2, facts: HARD_ROWS[1]!.facts, nextValue: 238 }),
    ];
    const user = userEvent.setup();
    await joinedConnection();
    renderRoot();

    await user.click(await screen.findByRole('button', { name: /^Sudoku · Hard · #2/ }));
    expect(await screen.findByRole('heading', { name: 'Sudoku' })).toBeInTheDocument();
    expect(selectedTab()).toHaveTextContent('Hard');
    await waitFor(() => expect(tableReads(fetchMock, 'hard')).toBe(1));
    expect(tableReads(fetchMock, 'easy')).toBe(0);
  });

  it('a server without GET /rankings/mine shows no section and no error', async () => {
    stubServer();
    mineList = 404;
    await joinedConnection();
    renderRoot();
    expect(await screen.findByRole('heading', { name: 'Rankings' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your rankings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('a tile opens the first mode you have a row in, else the game’s first mode', async () => {
    const fetchMock = stubServer();
    rankingList = [sudokuTable('hard', 24), sudokuTable('easy', 1)];
    mineList = [
      standing('sudoku', 'hard', { rank: 2, facts: HARD_ROWS[1]!.facts, nextValue: 238 }),
    ];
    const user = userEvent.setup();
    await joinedConnection();
    renderRoot();
    await user.click(await screen.findByRole('button', { name: 'Sudoku' }));
    await screen.findByRole('heading', { name: 'Sudoku' });
    expect(selectedTab()).toHaveTextContent('Hard');
    await waitFor(() => expect(tableReads(fetchMock, 'hard')).toBe(1));

    cleanup();
    localStorage.clear();
    const again = stubServer();
    rankingList = [sudokuTable('hard', 24), sudokuTable('easy', 1)];
    mineList = [];
    await joinedConnection();
    renderRoot();
    await user.click(await screen.findByRole('button', { name: 'Sudoku' }));
    await screen.findByRole('heading', { name: 'Sudoku' });
    expect(selectedTab()).toHaveTextContent('Easy');
    await waitFor(() => expect(tableReads(again, 'easy')).toBe(1));
  });
});

describe('Ranking screen: one game, its modes as chips (club.md §16-2, decisions 45–48)', () => {
  async function openSudoku(extra: Record<string, unknown> = {}) {
    const user = userEvent.setup();
    await joinedConnection(extra);
    renderRoot();
    await user.click(await screen.findByRole('button', { name: 'Sudoku' }));
    await screen.findByRole('heading', { name: 'Sudoku' });
    return user;
  }

  it('lists the modes the Club has, easiest first; a chip reads its table once and replaces the screen', async () => {
    const fetchMock = stubServer();
    rankingList = [sudokuTable('hard', 24), sudokuTable('medium', 3), sudokuTable('easy', 1)];
    const user = await openSudoku();
    const lists = callsTo(fetchMock, 'GET', '/rankings').length;

    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(tabs().map((tab) => tab.textContent)).toEqual(['Easy', 'Medium', 'Hard']);
    // No row of the viewer's anywhere: the first mode.
    expect(selectedTab()).toHaveTextContent('Easy');
    expect(await screen.findByText('1:40 Mistakes 0 Hints 0')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Hard' }));
    expect(selectedTab()).toHaveTextContent('Hard');
    expect(await screen.findByText('3:58 Mistakes 0 Hints 1')).toBeInTheDocument();
    // Nothing of the Easy table is left under the Hard chip.
    expect(screen.queryByText('1:40 Mistakes 0 Hints 0')).not.toBeInTheDocument();
    expect(tableReads(fetchMock, 'hard')).toBe(1);
    // Pressing the chip on screen reads nothing.
    await user.click(screen.getByRole('tab', { name: 'Hard' }));
    expect(tableReads(fetchMock, 'hard')).toBe(1);

    await user.click(screen.getByRole('tab', { name: 'Medium' }));
    expect(await screen.findByText('Nothing here yet.')).toBeInTheDocument();

    // Back is the Club, not the mode before: the chips replaced the step, never stacked one.
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { name: 'Rankings' })).toBeInTheDocument();
    // ...shown as it was, without reading the lists again.
    expect(callsTo(fetchMock, 'GET', '/rankings')).toHaveLength(lists);
  });

  it('draws no chips for a game whose one table is its only mode', async () => {
    stubServer();
    rankingList = [{ gameId: 'freecell', paramsKey: 'standard', entryCount: 5, leader: LEADER }];
    const user = userEvent.setup();
    await joinedConnection();
    renderRoot();
    await user.click(await screen.findByRole('button', { name: 'FreeCell' }));
    expect(await screen.findByRole('heading', { name: 'FreeCell' })).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('says where you stand, marks the first three, and calls every row of yours You', async () => {
    stubServer();
    await openSudoku();
    // The viewer's best row: rank, entries, value, and the gap to the next rank.
    expect(
      await screen.findByText('#2 · 24 entries · 5:00 · 1:02 to the next rank'),
    ).toBeInTheDocument();
    const rows = Array.from(document.querySelectorAll<HTMLElement>('.club-panel .club-line'));
    expect(rows).toHaveLength(5);
    // Gold, silver, bronze on 1–3 only, the words kept for a screen reader.
    expect(rows.map((row) => row.querySelector('.club-medal')?.className ?? null)).toEqual([
      'club-medal club-medal-1',
      'club-medal club-medal-2',
      'club-medal club-medal-3',
      null,
      null,
    ]);
    expect(within(rows[0]!).getByText('#1')).toHaveClass('visually-hidden');
    expect(within(rows[3]!).getByText('#4')).not.toHaveClass('visually-hidden');
    // One row per result: the same people more than once, each of the viewer's rows is You.
    expect(rows.map((row) => row.querySelector('.settings-row-label')!.textContent)).toEqual([
      '1#1Ken',
      '2#2You',
      '3#3Mika',
      '#4You',
      '#5Ken',
    ]);
    expect(screen.queryByText('Ken B')).not.toBeInTheDocument();
    expect(screen.queryByText('#87')).not.toBeInTheDocument();
    expect(screen.getByText('24 entries')).toBeInTheDocument();
    expect(
      screen.getByText('One row per result: every game you finish is listed.'),
    ).toBeInTheDocument();
    // No row anywhere says Report (decision 49).
    expect(screen.queryByText('Report')).not.toBeInTheDocument();
  });

  it('appends your best row with its rank when it is below the rows sent', async () => {
    stubServer();
    meBelowTop = true;
    await openSudoku();
    expect(
      await screen.findByText('#87 · 24 entries · 10:00 · 0:10 to the next rank'),
    ).toBeInTheDocument();
    expect(screen.getByText('…')).toBeInTheDocument();
    const own = screen.getByText('10:00 Mistakes 3 Hints 0').closest('.club-line') as HTMLElement;
    expect(within(own).getByText('#87')).toBeInTheDocument();
    expect(within(own).getByText('You')).toBeInTheDocument();
  });

  it('Back shows the Club as it was, without a request; Reload reads it again', async () => {
    const fetchMock = stubServer();
    mineList = [
      standing('sudoku', 'hard', { rank: 2, facts: HARD_ROWS[1]!.facts, nextValue: 238 }),
    ];
    const user = await openSudoku();
    await screen.findByText('#2 · 24 entries · 5:00 · 1:02 to the next rank');
    const before = fetchMock.mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'Back' }));
    // At once, with the lists it had: no Loading, Your rankings and the shelves in place.
    expect(screen.getByRole('heading', { name: 'Your rankings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sudoku' })).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.length).toBe(before);

    await user.click(screen.getByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(callsTo(fetchMock, 'GET', '/rankings')).toHaveLength(2));
    expect(callsTo(fetchMock, 'GET', '/rankings/mine')).toHaveLength(2);
    expect(callsTo(fetchMock, 'GET', '/club')).toHaveLength(2);
  });

  it('another member’s name opens the sheet with that row’s record and Report', async () => {
    const fetchMock = stubServer();
    const user = await openSudoku();
    await screen.findByText('#2 · 24 entries · 5:00 · 1:02 to the next rank');
    // Ken is on the table twice; the first row is his 3:58.
    await user.click(screen.getAllByRole('button', { name: 'Ken' })[0]!);
    const sheet = screen.getByRole('dialog', { name: 'Ken' });
    expect(sheet).toHaveTextContent('3:58 Mistakes 0 Hints 1');
    expect(sheet).not.toHaveTextContent('7:30');
    await user.click(within(sheet).getByRole('button', { name: 'Report' }));
    await user.click(
      within(screen.getByRole('alertdialog', { name: 'Report this nickname?' })).getByRole(
        'button',
        { name: 'Report' },
      ),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Reported');
    const posted = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/members/m_1/report'),
    );
    expect(posted?.[1]?.method).toBe('POST');
    // Your own rows are You, never a name to press.
    expect(screen.queryByRole('button', { name: 'You' })).not.toBeInTheDocument();
  });

  it('opens no sheet on the owner’s device', async () => {
    stubServer();
    clubMe = { ...KEN, role: 'owner' };
    clubMembers = [clubMe];
    await openSudoku({ role: 'owner' });
    await screen.findByText('#2 · 24 entries · 5:00 · 1:02 to the next rank');
    expect(screen.getAllByText('Ken')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Ken' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mika' })).not.toBeInTheDocument();
  });
});

describe('Today challenge: the tables’ marks and the name sheet (club.md §9「Challenge」)', () => {
  async function openChallenge(extra: Record<string, unknown> = {}) {
    dailyChallenges = true;
    hasDailyResult = true;
    const user = userEvent.setup();
    await joinedConnection(extra);
    renderRoot();
    await user.click(await screen.findByRole('button', { name: /Sudoku · Hard · Daily · by Yoh/ }));
    await screen.findByText('8:20 Mistakes 2 Hints 0');
    return user;
  }

  it('marks the first three and opens the sheet on another member’s name', async () => {
    const fetchMock = stubServer();
    const user = await openChallenge();
    const yoh = screen.getByText('4:31 Mistakes 0 Hints 1').closest('.club-line') as HTMLElement;
    const own = screen.getByText('8:20 Mistakes 2 Hints 0').closest('.club-line') as HTMLElement;
    expect(yoh.querySelector('.club-medal-1')).not.toBeNull();
    expect(own.querySelector('.club-medal-2')).not.toBeNull();
    // Your own name is not a button; another's is.
    expect(within(own).queryByRole('button', { name: 'Ken' })).toBeNull();
    await user.click(within(yoh).getByRole('button', { name: 'Yoh' }));
    const sheet = screen.getByRole('dialog', { name: 'Yoh' });
    expect(sheet).toHaveTextContent('4:31 Mistakes 0 Hints 1');
    await user.click(within(sheet).getByRole('button', { name: 'Report' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Report' }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Reported');
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) => String(url).endsWith('/members/m_1/report') && init?.method === 'POST',
      ),
    ).toBe(true);
  });

  it('opens no sheet on the owner’s device', async () => {
    stubServer();
    clubMe = { ...KEN, role: 'owner' };
    clubMembers = [clubMe];
    await openChallenge({ role: 'owner' });
    expect(screen.getByText('Yoh')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Yoh' })).not.toBeInTheDocument();
  });
});
