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
import { dateLabel, todayLocal } from './common';
import { ClubRoot } from './ClubRoot';
import { clearWithdrawnChallenges } from './ChallengeScreen';

/** Private Clubs ship switched off (ui/clubFeatures.ts); every path below is tested under both values. */
const flags = vi.hoisted(() => ({ privateClubs: true }));
vi.mock('@/ui/clubFeatures', () => ({
  MANAGED_CLUB_ORIGIN: null,
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
/** The leader of the tables and the maker of the daily, as the member view answers for them (id m_1). */
const KEN_1 = { id: 'm_1', nickname: 'Ken', role: 'member', joinedAt: '2026-09-01T00:00:00.000Z' };
const YOH = { ...KEN_1, nickname: 'Yoh' };
/** What `GET /club` answers for the viewer and the member list. */
let clubMe: Record<string, unknown> = KEN;
let clubMembers: Record<string, unknown>[] = [KEN];
let clubMemberCount: number | undefined;
let reportedList: { member: Record<string, unknown>; reportCount: number }[] = [];
let meBelowTop = false;
/**
 * What `GET /members/<id>` answers, by member id (club.md §5-3). A member that is not here
 * (removed, unknown) is a 404, as is every member when `memberRouteMissing`.
 */
let memberViews: Record<string, { member: Record<string, unknown>; rankings: unknown[] }> = {};
/** A server from before `GET /members/<id>`: the same 404 for everyone. */
let memberRouteMissing = false;
/**
 * What `GET /members?before=<id>` answers, by the id it is asked about; a cursor that is not
 * here is an empty page. `beforeStatus` 404 is a server from before `?before=`, 500 a failure.
 */
let olderPages: Record<string, { members: Record<string, unknown>[]; memberCount: number }> = {};
let beforeStatus: 200 | 404 | 500 = 200;
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
    const memberDelete = /^\/members\/([^/]+)$/.exec(path);
    if (memberDelete && method === 'DELETE') {
      // The server forgot them; the reload after a purge must not see them again.
      clubMembers = clubMembers.filter((m) => m.id !== decodeURIComponent(memberDelete[1]!));
      clubMemberCount = Math.max(0, clubMembers.length);
      return new Response(null, { status: 204, headers: { 'X-Club-Api': '1' } });
    }
    if (path === '/members' && method === 'GET') {
      const before = url.searchParams.get('before');
      if (before === null) return reply({ error: { code: 'invalid_request', message: 'no' } }, 400);
      if (beforeStatus === 404) return reply({ error: { code: 'not_found', message: 'no' } }, 404);
      if (beforeStatus === 500)
        return reply({ error: { code: 'internal_error', message: 'no' } }, 500);
      return reply(
        olderPages[before] ?? { members: [], memberCount: clubMemberCount ?? clubMembers.length },
      );
    }
    const memberRoute = /^\/members\/([^/]+)$/.exec(path);
    if (memberRoute && method === 'GET') {
      const view = memberViews[decodeURIComponent(memberRoute[1]!)];
      if (memberRouteMissing || view === undefined) {
        return reply({ error: { code: 'not_found', message: 'no' } }, 404);
      }
      return reply(view);
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
  memberViews = {};
  memberRouteMissing = false;
  olderPages = {};
  beforeStatus = 200;
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

  it("opens the ways in over the joined Club from the home's Join a new Club House", async () => {
    stubServer();
    await addClubConnection({
      endpoint: ENDPOINT,
      clubId: 'c_1',
      clubName: 'A',
      memberId: 'm_1',
      memberToken: 't',
      nickname: 'Ken',
      role: 'member',
      joinedAt: 'x',
      autoSend: true,
    });
    renderRoot({ entry: 'join' });
    expect(
      await screen.findByRole('button', { name: 'Join the Public Club House' }),
    ).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { name: CLUB.name })).toBeInTheDocument();
  });

  it("offers no Public join from the home's Join a new Club House once it is joined", async () => {
    stubServer();
    await addClubConnection({
      endpoint: PUBLIC_CLUB_ENDPOINT,
      clubId: 'c_1',
      clubName: 'PixApps Club',
      memberId: 'm_1',
      memberToken: 't',
      nickname: 'Ken',
      role: 'member',
      joinedAt: 'x',
      autoSend: true,
    });
    renderRoot({ entry: 'join' });
    expect(await screen.findByRole('heading', { name: 'Play together' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Join the Public Club House' })).toBeNull();
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

  it('ends the Club screen with one Members row; the people are the next screen, opened with no request', async () => {
    const fetchMock = stubServer();
    clubMembers = [KEN, MIKA];
    clubMemberCount = 1200;
    const user = userEvent.setup();
    await joinedConnection();
    renderRoot();

    // The total is the row's value; no list, no heading and no name on the Club screen itself.
    const row = await screen.findByRole('button', { name: 'Members · 1200 members' });
    expect(row).toHaveTextContent('1200 members');
    expect(screen.queryByRole('heading', { name: '1200 members' })).not.toBeInTheDocument();
    expect(screen.queryByText('Mika')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Reported' })).not.toBeInTheDocument();
    // It is the last thing on the screen, after the shelves.
    const children = Array.from(document.querySelectorAll('.club-body > *'));
    expect(children[children.length - 1]).toBe(row);
    const before = fetchMock.mock.calls.length;

    await user.click(row);
    expect(screen.getByRole('heading', { level: 1, name: 'Members' })).toBeInTheDocument();
    // The total, not the page (club.md §17-2); one's own name is plain text, another's is pressable.
    expect(screen.getByRole('heading', { name: '1200 members' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mika' })).toBeInTheDocument();
    expect(screen.getByText('Ken')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ken' })).not.toBeInTheDocument();
    // A member sees no owner extras and no Report on the list (decision 49): a pattern, so a
    // per-row `Report Mika` would be caught as well.
    for (const name of [/Rename/, /Remove/, /Report/]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('heading', { name: 'Reported' })).not.toBeInTheDocument();
    // The lists the Club screen read are all it shows: nothing was asked for.
    expect(fetchMock.mock.calls.length).toBe(before);
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/members/reported'))).toBe(
      false,
    );

    // Back is the Club as it was, again with no request.
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { name: 'Rankings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Members · 1200 members' })).toBeInTheDocument();
    expect(fetchMock.mock.calls.length).toBe(before);
  });

  it('falls back to the list length when the server sends no memberCount', async () => {
    stubServer();
    clubMembers = [KEN, MIKA];
    const user = userEvent.setup();
    await joinedConnection();
    renderRoot();
    await user.click(await screen.findByRole('button', { name: 'Members · 2 members' }));
    expect(screen.getByRole('heading', { name: '2 members' })).toBeInTheDocument();
    // Everyone is on the page: nothing older to offer.
    expect(screen.queryByRole('button', { name: 'Show older members' })).not.toBeInTheDocument();
  });

  it('asks the owner for the Reported list too, as the fifth request, and the Members screen asks for nothing more', async () => {
    const fetchMock = stubServer();
    clubMe = { ...KEN, role: 'owner' };
    clubMembers = [clubMe, MIKA];
    reportedList = [{ member: MIKA, reportCount: 3 }];
    const user = userEvent.setup();
    await joinedConnection({ role: 'owner' });
    renderRoot();
    // The row is drawn once all five requests have answered, the Reported list among them, so
    // what is absent below is absent from a Club that has it to show.
    const row = await screen.findByRole('button', { name: 'Members · 2 members' });
    expect(screen.queryByRole('heading', { name: 'Reported' })).not.toBeInTheDocument();
    expect(screen.queryByText('Mika')).not.toBeInTheDocument();
    expect(screen.queryByText('3 reports')).not.toBeInTheDocument();
    for (const name of [/Rename/, /Remove/]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    const clubChildren = Array.from(document.querySelectorAll('.club-body > *'));
    expect(clubChildren[clubChildren.length - 1]).toBe(row);
    await user.click(row);
    expect(await screen.findByRole('heading', { name: 'Reported' })).toBeInTheDocument();
    const paths = fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname);
    expect(paths.sort()).toEqual([
      '/api/v1/challenges',
      '/api/v1/club',
      '/api/v1/members/reported',
      '/api/v1/rankings',
      '/api/v1/rankings/mine',
    ]);
  });

  it('stores the nickname the owner gave when the server says it changed', async () => {
    stubServer();
    clubMe = { ...KEN, nickname: 'Kenji' };
    clubMembers = [clubMe];
    await joinedConnection();
    renderRoot();
    expect(await screen.findByRole('button', { name: 'Members · 1 members' })).toBeInTheDocument();
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
/** The scrolling body of the screen on top (jsdom keeps whatever `scrollTop` is set to). */
const bodyOf = () => document.querySelector<HTMLElement>('.club-body')!;

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

  it('another member’s name opens that member’s view, with no sheet in between', async () => {
    const fetchMock = stubServer();
    memberViews = { m_1: { member: KEN_1, rankings: [] } };
    const user = await openSudoku();
    await screen.findByText('#2 · 24 entries · 5:00 · 1:02 to the next rank');
    // Ken is on the table twice; either row opens him. Your own rows are You, never a name to press.
    expect(screen.queryByRole('button', { name: 'You' })).not.toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Ken' })[0]!);

    expect(await screen.findByRole('heading', { level: 1, name: 'Ken' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(callsTo(fetchMock, 'GET', '/members/m_1')).toHaveLength(1);
    // Back is the table again, as it was: at once, with no request and no Loading.
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: 'Sudoku' })).toBeInTheDocument();
    expect(screen.getAllByText('You')).toHaveLength(2);
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    expect(tableReads(fetchMock, 'hard')).toBe(1);
  });

  it('Back from a member’s view lands where the table was scrolled to, and Reload still reads it', async () => {
    const fetchMock = stubServer();
    memberViews = { m_1: { member: KEN_1, rankings: [] } };
    const user = await openSudoku();
    await screen.findByText('#2 · 24 entries · 5:00 · 1:02 to the next rank');
    bodyOf().scrollTop = 321;
    await user.click(screen.getAllByRole('button', { name: 'Ken' })[0]!);
    await screen.findByRole('heading', { level: 1, name: 'Ken' });
    // The view is its own screen, at the top.
    expect(bodyOf().scrollTop).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(bodyOf().scrollTop).toBe(321);
    expect(tableReads(fetchMock, 'hard')).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(tableReads(fetchMock, 'hard')).toBe(2));
  });

  it('Back from a member’s view shows the mode that was on screen, read once', async () => {
    const fetchMock = stubServer();
    rankingList = [sudokuTable('hard', 24), sudokuTable('easy', 1)];
    memberViews = { m_2: { member: MIKA, rankings: [] } };
    const user = await openSudoku();
    await user.click(screen.getByRole('tab', { name: 'Easy' }));
    await screen.findByText('1:40 Mistakes 0 Hints 0');
    await user.click(screen.getByRole('button', { name: 'Mika' }));
    await screen.findByRole('heading', { level: 1, name: 'Mika' });

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(selectedTab()).toHaveTextContent('Easy');
    expect(screen.getByText('1:40 Mistakes 0 Hints 0')).toBeInTheDocument();
    expect(tableReads(fetchMock, 'easy')).toBe(1);
    // Another chip is still its own read.
    await user.click(screen.getByRole('tab', { name: 'Hard' }));
    expect(await screen.findByText('3:58 Mistakes 0 Hints 1')).toBeInTheDocument();
  });

  it('is the same on the owner’s device: another member’s name opens the view', async () => {
    stubServer();
    clubMe = { ...KEN, role: 'owner' };
    clubMembers = [clubMe];
    memberViews = { m_1: { member: KEN_1, rankings: [] } };
    const user = await openSudoku({ role: 'owner' });
    await screen.findByText('#2 · 24 entries · 5:00 · 1:02 to the next rank');
    // Ken and Mika are names to press (they were plain text here before); the viewer's rows are You.
    expect(screen.getAllByRole('button', { name: 'Ken' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Mika' })).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Ken' })[0]!);
    expect(await screen.findByRole('heading', { level: 1, name: 'Ken' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Report' })).not.toBeInTheDocument();
  });
});

describe('Today challenge: the tables’ marks and the member view (club.md §9「Challenge」)', () => {
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

  it('marks the first three and opens the member’s view on another member’s name', async () => {
    const fetchMock = stubServer();
    memberViews = { m_1: { member: YOH, rankings: [] } };
    const user = await openChallenge();
    const yoh = screen.getByText('4:31 Mistakes 0 Hints 1').closest('.club-line') as HTMLElement;
    const own = screen.getByText('8:20 Mistakes 2 Hints 0').closest('.club-line') as HTMLElement;
    expect(yoh.querySelector('.club-medal-1')).not.toBeNull();
    expect(own.querySelector('.club-medal-2')).not.toBeNull();
    // Your own name is not a button; another's is.
    expect(within(own).queryByRole('button', { name: 'Ken' })).toBeNull();
    await user.click(within(yoh).getByRole('button', { name: 'Yoh' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Yoh' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(callsTo(fetchMock, 'GET', '/members/m_1')).toHaveLength(1);
    // Back is the challenge as it was: at once, with no request, no Loading, the same place.
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('4:31 Mistakes 0 Hints 1')).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    expect(callsTo(fetchMock, 'GET', '/challenges/ch_d')).toHaveLength(1);
    expect(callsTo(fetchMock, 'GET', '/challenges/ch_d/results')).toHaveLength(1);
  });

  it('Back from a member’s view lands where the results were scrolled to', async () => {
    stubServer();
    memberViews = { m_1: { member: YOH, rankings: [] } };
    const user = await openChallenge();
    bodyOf().scrollTop = 123;
    await user.click(screen.getByRole('button', { name: 'Yoh' }));
    await screen.findByRole('heading', { level: 1, name: 'Yoh' });
    expect(bodyOf().scrollTop).toBe(0);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(bodyOf().scrollTop).toBe(123);
  });

  it('is the same on the owner’s device: the name opens the view', async () => {
    stubServer();
    clubMe = { ...KEN, role: 'owner' };
    clubMembers = [clubMe];
    memberViews = { m_1: { member: YOH, rankings: [] } };
    const user = await openChallenge({ role: 'owner' });
    await user.click(screen.getByRole('button', { name: 'Yoh' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Yoh' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });
});

describe('Members screen (club.md §9「Members」, §17-2)', () => {
  /** A member who joined before everyone on the first page. */
  const older = (i: number) => ({
    id: `o_${i}`,
    nickname: `Old${i}`,
    role: 'member',
    joinedAt: '2026-08-01T00:00:00.000Z',
  });
  const olderPage = (from: number, count: number) =>
    Array.from({ length: count }, (_, k) => older(from + k));
  const beforeCalls = (fetchMock: ReturnType<typeof stubServer>) =>
    fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/v1/members?before='));
  const openMembers = async (user: ReturnType<typeof userEvent.setup>) =>
    user.click(await screen.findByRole('button', { name: /^Members · / }));
  const OLDER_BUTTON = { name: 'Show older members' };

  async function openFirstPage(count: number) {
    clubMembers = [KEN, MIKA];
    clubMemberCount = count;
    const user = userEvent.setup();
    await joinedConnection();
    renderRoot();
    await openMembers(user);
    return user;
  }

  it('offers older members while the total says there are more, and reads them from the last one shown', async () => {
    const fetchMock = stubServer();
    olderPages = { m_2: { members: [older(1), older(2)], memberCount: 4 } };
    const user = await openFirstPage(4);

    // Nothing is read by itself: a press is the only request.
    expect(beforeCalls(fetchMock)).toHaveLength(0);
    await user.click(screen.getByRole('button', OLDER_BUTTON));

    expect(await screen.findByRole('button', { name: 'Old2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Old1' })).toBeInTheDocument();
    const calls = beforeCalls(fetchMock);
    expect(calls).toHaveLength(1);
    expect(String(calls[0]![0])).toBe(`${ENDPOINT}/api/v1/members?before=m_2`);
    // Everyone is shown now: the button goes, the total stays.
    expect(screen.queryByRole('button', OLDER_BUTTON)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '4 members' })).toBeInTheDocument();
  });

  it('reads one page per press, each from the last member shown, until a page adds nobody', async () => {
    const fetchMock = stubServer();
    olderPages = {
      m_2: { members: olderPage(1, 50), memberCount: 200 },
      o_50: { members: olderPage(51, 2), memberCount: 200 },
    };
    const user = await openFirstPage(200);

    await user.click(screen.getByRole('button', OLDER_BUTTON));
    expect(await screen.findByRole('button', { name: 'Old50' })).toBeInTheDocument();
    // 52 of 200 shown after the next one: more to ask for.
    expect(screen.getByRole('button', OLDER_BUTTON)).toBeEnabled();

    await user.click(screen.getByRole('button', OLDER_BUTTON));
    expect(await screen.findByRole('button', { name: 'Old52' })).toBeInTheDocument();
    // A short page does not end it: the page size is the server's own (an operator may set it)
    // and the total drifts, so only a page that adds nobody says there is nothing older.
    expect(screen.getByRole('button', OLDER_BUTTON)).toBeEnabled();

    await user.click(screen.getByRole('button', OLDER_BUTTON));
    await waitFor(() => expect(screen.queryByRole('button', OLDER_BUTTON)).not.toBeInTheDocument());
    expect(
      beforeCalls(fetchMock).map(([url]) => new URL(String(url)).searchParams.get('before')),
    ).toEqual(['m_2', 'o_50', 'o_52']);
  });

  it('goes quietly on a server from before ?before= (404): no error, no button', async () => {
    stubServer();
    beforeStatus = 404;
    const user = await openFirstPage(5);
    await user.click(screen.getByRole('button', OLDER_BUTTON));
    await waitFor(() => expect(screen.queryByRole('button', OLDER_BUTTON)).not.toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // The people already shown stay.
    expect(screen.getByRole('button', { name: 'Mika' })).toBeInTheDocument();
  });

  it('stays quiet after a 404 when a member’s view is opened and closed, and the Club is left and entered; the Club read anew asks once more', async () => {
    const fetchMock = stubServer();
    beforeStatus = 404;
    memberViews = { m_2: { member: MIKA, rankings: [] } };
    const user = await openFirstPage(5);
    await user.click(screen.getByRole('button', OLDER_BUTTON));
    await waitFor(() => expect(screen.queryByRole('button', OLDER_BUTTON)).not.toBeInTheDocument());
    expect(beforeCalls(fetchMock)).toHaveLength(1);

    // Members → a member → Back: this screen is built again, and the button must not be.
    await user.click(screen.getByRole('button', { name: 'Mika' }));
    await screen.findByRole('heading', { level: 1, name: 'Mika' });
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Members' })).toBeInTheDocument();
    expect(screen.queryByRole('button', OLDER_BUTTON)).not.toBeInTheDocument();

    // Members → Club → Members: the same.
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await openMembers(user);
    expect(screen.queryByRole('button', OLDER_BUTTON)).not.toBeInTheDocument();
    expect(beforeCalls(fetchMock)).toHaveLength(1);

    // The Club read anew has new lists, and the question is asked again.
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(await screen.findByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(callsTo(fetchMock, 'GET', '/club')).toHaveLength(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reload' })).toBeEnabled());
    await openMembers(user);
    expect(await screen.findByRole('button', OLDER_BUTTON)).toBeInTheDocument();
  });

  it('ends the list for good once a page adds nobody, though the total says more, through a member’s view and back', async () => {
    const fetchMock = stubServer();
    // Five were counted when the Club was read; only three can be found (someone left).
    olderPages = { m_2: { members: [older(1)], memberCount: 5 } };
    memberViews = { o_1: { member: older(1), rankings: [] } };
    const user = await openFirstPage(5);

    await user.click(screen.getByRole('button', OLDER_BUTTON));
    expect(await screen.findByRole('button', { name: 'Old1' })).toBeInTheDocument();
    // 3 of 5 shown: nothing yet says the list ends.
    expect(screen.getByRole('button', OLDER_BUTTON)).toBeEnabled();
    await user.click(screen.getByRole('button', OLDER_BUTTON));
    await waitFor(() => expect(screen.queryByRole('button', OLDER_BUTTON)).not.toBeInTheDocument());
    expect(beforeCalls(fetchMock)).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Old1' }));
    await screen.findByRole('heading', { level: 1, name: 'Old1' });
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Members' })).toBeInTheDocument();
    expect(screen.queryByRole('button', OLDER_BUTTON)).not.toBeInTheDocument();
    expect(beforeCalls(fetchMock)).toHaveLength(2);
  });

  it('says any other failure on the screen and keeps the button for another try', async () => {
    stubServer();
    beforeStatus = 500;
    const user = await openFirstPage(5);
    await user.click(screen.getByRole('button', OLDER_BUTTON));
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(screen.getByRole('button', OLDER_BUTTON)).toBeEnabled();
  });

  it('keeps the older members read when a member’s view is opened and closed', async () => {
    const fetchMock = stubServer();
    olderPages = { m_2: { members: [older(1), older(2)], memberCount: 4 } };
    memberViews = { o_1: { member: older(1), rankings: [] } };
    const user = await openFirstPage(4);
    await user.click(screen.getByRole('button', OLDER_BUTTON));
    await user.click(await screen.findByRole('button', { name: 'Old1' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Old1' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    // Still there, without reading them again.
    expect(await screen.findByRole('button', { name: 'Old2' })).toBeInTheDocument();
    expect(beforeCalls(fetchMock)).toHaveLength(1);
  });

  it('lands the list where it was scrolled to when a member’s view is closed', async () => {
    olderPages = { m_2: { members: [older(1), older(2)], memberCount: 4 } };
    memberViews = { o_1: { member: older(1), rankings: [] } };
    stubServer();
    const user = await openFirstPage(4);
    await user.click(screen.getByRole('button', OLDER_BUTTON));
    await user.click(await screen.findByRole('button', { name: 'Old1' }));
    await screen.findByRole('heading', { level: 1, name: 'Old1' });
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(bodyOf().scrollTop).toBe(0);

    bodyOf().scrollTop = 77;
    await user.click(screen.getByRole('button', { name: 'Old2' }));
    await screen.findByRole('heading', { level: 1, name: 'Old2' });
    expect(bodyOf().scrollTop).toBe(0);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(bodyOf().scrollTop).toBe(77);
  });

  it('shows the owner the reported members above the list and lets them rename; the Club’s lists follow without a request', async () => {
    const fetchMock = stubServer();
    clubMe = { ...KEN, role: 'owner' };
    clubMembers = [clubMe, MIKA];
    reportedList = [{ member: MIKA, reportCount: 3 }];
    const user = userEvent.setup();
    await joinedConnection({ role: 'owner' });
    renderRoot();
    await openMembers(user);

    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['Reported', '2 members']);
    expect(screen.getByText('3 reports')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Report' })).not.toBeInTheDocument();
    // Another member's name opens the view on the owner's device too; one's own does not.
    expect(screen.getAllByRole('button', { name: 'Mika' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Ken' })).not.toBeInTheDocument();

    // Both Mika lines (Reported and Members) offer Rename; use the first.
    await user.click(screen.getAllByRole('button', { name: 'Rename' })[0]!);
    const field = screen.getByLabelText('New nickname');
    await user.clear(field);
    await user.type(field, 'Mi');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Mi' })).toHaveLength(2));
    expect(screen.queryByLabelText('New nickname')).not.toBeInTheDocument();
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(new URL(String(patch![0])).pathname).toBe('/api/v1/members/m_2');
    expect(JSON.parse(String(patch![1]!.body))).toEqual({ nickname: 'Mi' });

    // The Club's lists were rewritten, not read again.
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('button', { name: 'Members · 2 members' })).toBeInTheDocument();
    expect(callsTo(fetchMock, 'GET', '/club')).toHaveLength(1);
  });

  it('lets the owner remove and erase results with ?purge=1; the Club reads its lists again when it is back', async () => {
    const fetchMock = stubServer();
    clubMe = { ...KEN, role: 'owner' };
    clubMembers = [clubMe, MIKA];
    clubMemberCount = 2;
    const user = userEvent.setup();
    await joinedConnection({ role: 'owner' });
    renderRoot();
    await openMembers(user);

    await user.click(await screen.findByRole('button', { name: 'Remove' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Remove Mika?' });
    expect(dialog).toHaveTextContent('every result and ranking row of theirs is erased');
    await user.click(screen.getByRole('button', { name: 'Remove and erase results' }));

    expect(await screen.findByRole('heading', { name: '1 members' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mika' })).not.toBeInTheDocument();
    const del = fetchMock.mock.calls.find(([, init]) => init?.method === 'DELETE');
    expect(String(del![0])).toBe(`${ENDPOINT}/api/v1/members/m_2?purge=1`);

    // Their rows are gone from the tables and the dailies: the Club reads them again,
    // as a read — what waited on this device is not resent.
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(callsTo(fetchMock, 'GET', '/club')).toHaveLength(2));
    expect(await screen.findByRole('button', { name: 'Members · 1 members' })).toBeInTheDocument();
    expect(callsTo(fetchMock, 'POST', '/rankings/results')).toHaveLength(0);
  });

  it('removes without ?purge when only Remove is chosen; the Club is not read again', async () => {
    const fetchMock = stubServer();
    clubMe = { ...KEN, role: 'owner' };
    clubMembers = [clubMe, MIKA];
    clubMemberCount = 2;
    const user = userEvent.setup();
    await joinedConnection({ role: 'owner' });
    renderRoot();
    await openMembers(user);

    await user.click(await screen.findByRole('button', { name: 'Remove' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' }),
    );
    expect(await screen.findByRole('heading', { name: '1 members' })).toBeInTheDocument();
    const del = fetchMock.mock.calls.find(([, init]) => init?.method === 'DELETE');
    expect(String(del![0])).toBe(`${ENDPOINT}/api/v1/members/m_2`);

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('button', { name: 'Members · 1 members' })).toBeInTheDocument();
    expect(callsTo(fetchMock, 'GET', '/club')).toHaveLength(1);
  });
});

describe('Member screen (club.md §9「Member」)', () => {
  /** Mika's standings in the server's order (the spelling of the keys), not the shelves'. */
  const MIKA_STANDINGS = [
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
    standing(
      'sudoku',
      'easy',
      { rank: null, facts: { elapsedSeconds: 700, mistakes: 0, hints: 0 }, nextValue: 690 },
      80,
    ),
    // A game this build does not know has no row to draw.
    standing('not-a-game', 'x', { rank: 1, facts: { score: 1 }, nextValue: null }),
  ];

  beforeEach(() => {
    clubMembers = [KEN, MIKA];
    memberViews = { m_2: { member: MIKA, rankings: MIKA_STANDINGS } };
    rankingList = [
      sudokuTable('easy', 80),
      sudokuTable('hard', 24),
      { gameId: 'solitaire', paramsKey: 'draw-1', entryCount: 3, leader: LEADER },
      { gameId: '2048', paramsKey: 'standard', entryCount: 9, leader: LEADER },
    ];
  });

  const asOwner = () => {
    clubMe = { ...KEN, role: 'owner' };
    clubMembers = [clubMe, MIKA];
  };

  /** Club → Members → Mika. */
  async function openMika(extra: Record<string, unknown> = {}) {
    const user = userEvent.setup();
    await joinedConnection(extra);
    renderRoot();
    await user.click(await screen.findByRole('button', { name: /^Members · / }));
    await user.click(await screen.findByRole('button', { name: 'Mika' }));
    await screen.findByRole('heading', { level: 1, name: 'Mika' });
    return user;
  }
  const posts = (fetchMock: ReturnType<typeof stubServer>) =>
    fetchMock.mock.calls.filter(
      ([url, init]) => String(url).endsWith('/members/m_2/report') && init?.method === 'POST',
    );

  it('reads the member once: the name, when they joined, and their tables as Your rankings draws them', async () => {
    const fetchMock = stubServer();
    await openMika();
    expect(await screen.findByRole('heading', { level: 2, name: 'Rankings' })).toBeInTheDocument();

    expect(callsTo(fetchMock, 'GET', '/members/m_2')).toHaveLength(1);
    expect(screen.getByText(/^Joined /)).toBeInTheDocument();
    // The shelves' order, the same rows as the Club's own: never by rank.
    expect(myRows().map((row) => row.getAttribute('aria-label'))).toEqual([
      'Sudoku · Easy · 80 entries · 11:40 · 0:10 to the next rank',
      'Sudoku · Hard · #2 · 24 entries · 5:00 · 1:02 to the next rank',
      'Solitaire · Draw 1 · #1 · 3 entries · 90',
      '2048 · #4 · 9 entries · 1000 · Score 200 to the next rank',
    ]);
    // Nothing else of a profile, and no Reload: the view is read when it opens.
    expect(screen.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument();
    expect(screen.queryByText(/played|last seen/i)).not.toBeInTheDocument();
  });

  it('takes the title and the join date from the server’s answer, not from the pressed row or the viewer', async () => {
    stubServer();
    // The list is old: Mika was renamed since, and joined on a day neither the row (2026-09-10)
    // nor the viewer (2026-09-09) carries.
    const JOINED = '2026-10-05T12:00:00.000Z';
    memberViews = { m_2: { member: { ...MIKA, nickname: 'Mi', joinedAt: JOINED }, rankings: [] } };
    const user = userEvent.setup();
    await joinedConnection();
    renderRoot();
    await user.click(await screen.findByRole('button', { name: /^Members · / }));
    await user.click(await screen.findByRole('button', { name: 'Mika' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Mi' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Mika' })).not.toBeInTheDocument();
    // The real formatter, so the timezone of the machine does not matter.
    expect(screen.getByText(`Joined ${dateLabel(JOINED, 'en')}`)).toBeInTheDocument();
  });

  it('says Nothing here yet for a member who is in no table', async () => {
    stubServer();
    memberViews = { m_2: { member: MIKA, rankings: [] } };
    await openMika();
    expect(await screen.findByText('Nothing here yet.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Rankings' })).toBeInTheDocument();
    expect(myRows()).toHaveLength(0);
  });

  it('a row opens that table with its mode chosen and the Club’s other modes as chips; Back is the view', async () => {
    const fetchMock = stubServer();
    const user = await openMika();
    await user.click(await screen.findByRole('button', { name: /^Sudoku · Hard · #2/ }));

    expect(await screen.findByRole('heading', { name: 'Sudoku' })).toBeInTheDocument();
    expect(tabs().map((tab) => tab.textContent)).toEqual(['Easy', 'Hard']);
    expect(selectedTab()).toHaveTextContent('Hard');
    await waitFor(() => expect(tableReads(fetchMock, 'hard')).toBe(1));
    expect(tableReads(fetchMock, 'easy')).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Mika' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /^Sudoku · Hard · #2/ })).toBeInTheDocument();
  });

  it('Report asks first; Cancel and Escape send nothing, Report sends one POST and says Reported', async () => {
    const fetchMock = stubServer();
    const user = await openMika();
    // A member's view has Report and none of the owner's two.
    expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Report' }));
    const confirm = screen.getByRole('alertdialog', { name: 'Report this nickname?' });
    expect(confirm).toHaveTextContent('Nothing else is sent.');
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Report' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(posts(fetchMock)).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Report' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Report' }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Reported');
    expect(posts(fetchMock)).toHaveLength(1);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    // The button stays: reporting twice is harmless.
    expect(screen.getByRole('button', { name: 'Report' })).toBeInTheDocument();
  });

  it('a server without GET /members/:id keeps the pressed name as the title, says so, and still offers Report', async () => {
    const fetchMock = stubServer();
    memberRouteMissing = true;
    const user = userEvent.setup();
    await joinedConnection();
    renderRoot();
    await user.click(await screen.findByRole('button', { name: /^Members · / }));
    await user.click(await screen.findByRole('button', { name: 'Mika' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That no longer exists.');
    expect(screen.getByRole('heading', { level: 1, name: 'Mika' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Rankings' })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Joined /)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Report' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Report' }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Reported');
    expect(posts(fetchMock)).toHaveLength(1);
  });

  it('opens on the owner’s device with Rename and Remove in place of Report', async () => {
    stubServer();
    asOwner();
    await openMika({ role: 'owner' });
    expect(await screen.findByRole('heading', { level: 2, name: 'Rankings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Report' })).not.toBeInTheDocument();
  });

  it('Rename retitles the view, and the Members list has the new name without a request', async () => {
    const fetchMock = stubServer();
    asOwner();
    const user = await openMika({ role: 'owner' });
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    const field = screen.getByLabelText('New nickname');
    await user.clear(field);
    await user.type(field, 'Mi');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Mi' })).toBeInTheDocument();
    expect(screen.queryByLabelText('New nickname')).not.toBeInTheDocument();
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(new URL(String(patch![0])).pathname).toBe('/api/v1/members/m_2');
    expect(JSON.parse(String(patch![1]!.body))).toEqual({ nickname: 'Mi' });

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('button', { name: 'Mi' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mika' })).not.toBeInTheDocument();
    expect(callsTo(fetchMock, 'GET', '/club')).toHaveLength(1);
    expect(callsTo(fetchMock, 'GET', '/members/m_2')).toHaveLength(1);
  });

  it('Remove and erase results leaves the view for the list without them, and the Club reads again when it is back', async () => {
    const fetchMock = stubServer();
    asOwner();
    const user = await openMika({ role: 'owner' });
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await user.click(screen.getByRole('button', { name: 'Remove and erase results' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Members' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1 members' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mika' })).not.toBeInTheDocument();
    const del = fetchMock.mock.calls.find(([, init]) => init?.method === 'DELETE');
    expect(String(del![0])).toBe(`${ENDPOINT}/api/v1/members/m_2?purge=1`);

    await user.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(callsTo(fetchMock, 'GET', '/club')).toHaveLength(2));
    expect(await screen.findByRole('button', { name: 'Members · 1 members' })).toBeInTheDocument();
  });

  it('Remove alone also leaves the view, and the Club keeps the lists it has', async () => {
    const fetchMock = stubServer();
    asOwner();
    const user = await openMika({ role: 'owner' });
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' }),
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Members' })).toBeInTheDocument();
    const del = fetchMock.mock.calls.find(([, init]) => init?.method === 'DELETE');
    expect(String(del![0])).toBe(`${ENDPOINT}/api/v1/members/m_2`);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('button', { name: 'Members · 1 members' })).toBeInTheDocument();
    expect(callsTo(fetchMock, 'GET', '/club')).toHaveLength(1);
  });

  it('the Remove dialog answers Escape as Cancel and hands the focus back to Remove (ARCHITECTURE「Escape は Cancel」)', async () => {
    const fetchMock = stubServer();
    asOwner();
    const user = await openMika({ role: 'owner' });
    const remove = screen.getByRole('button', { name: 'Remove' });
    await user.click(remove);
    expect(screen.getByRole('alertdialog', { name: 'Remove Mika?' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    // Back on the Remove that opened it, and nothing was sent.
    expect(remove).toHaveFocus();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
  });

  it('a removal made from a table’s row goes back to that table, not to the Members list', async () => {
    const fetchMock = stubServer();
    asOwner();
    rankingList = [sudokuTable('hard', 24)];
    memberViews = { m_1: { member: KEN_1, rankings: [] } };
    const user = userEvent.setup();
    await joinedConnection({ role: 'owner' });
    renderRoot();
    await user.click(await screen.findByRole('button', { name: 'Sudoku' }));
    await user.click((await screen.findAllByRole('button', { name: 'Ken' }))[0]!);
    await user.click(await screen.findByRole('button', { name: 'Remove' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' }),
    );

    // The table it was opened from, as it was (a removal without erasing leaves the rows);
    // the Members list was never on the way.
    expect(await screen.findByRole('heading', { level: 1, name: 'Sudoku' })).toBeInTheDocument();
    const del = fetchMock.mock.calls.find(([, init]) => init?.method === 'DELETE');
    expect(String(del![0])).toBe(`${ENDPOINT}/api/v1/members/m_1`);
    expect(screen.queryByRole('heading', { name: 'Members' })).not.toBeInTheDocument();
    expect(tableReads(fetchMock, 'hard')).toBe(1);
  });

  it('a removal that erases results, made from a table’s row, shows that table at once and reads it again', async () => {
    const fetchMock = stubServer();
    asOwner();
    rankingList = [sudokuTable('hard', 24)];
    memberViews = { m_1: { member: KEN_1, rankings: [] } };
    const user = userEvent.setup();
    await joinedConnection({ role: 'owner' });
    renderRoot();
    await user.click(await screen.findByRole('button', { name: 'Sudoku' }));
    await user.click((await screen.findAllByRole('button', { name: 'Ken' }))[0]!);
    await user.click(await screen.findByRole('button', { name: 'Remove' }));
    await user.click(screen.getByRole('button', { name: 'Remove and erase results' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Sudoku' })).toBeInTheDocument();
    const del = fetchMock.mock.calls.find(([, init]) => init?.method === 'DELETE');
    expect(String(del![0])).toBe(`${ENDPOINT}/api/v1/members/m_1?purge=1`);
    // Their rows are gone from the server's table: the one kept is shown while it is read again.
    expect(screen.getAllByText('You')).toHaveLength(2);
    await waitFor(() => expect(tableReads(fetchMock, 'hard')).toBe(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reload' })).toBeEnabled());
    // Read anew, it is the one kept: coming back to it later asks for nothing more.
    await user.click(screen.getAllByRole('button', { name: 'Ken' })[0]!);
    await user.click(await screen.findByRole('button', { name: 'Back' }));
    expect(tableReads(fetchMock, 'hard')).toBe(2);
  });

  it('a rename made from a table’s row reads that table again, for the new name', async () => {
    const fetchMock = stubServer();
    asOwner();
    rankingList = [sudokuTable('hard', 24)];
    const user = userEvent.setup();
    await joinedConnection({ role: 'owner' });
    renderRoot();
    await user.click(await screen.findByRole('button', { name: 'Sudoku' }));
    await user.click(await screen.findByRole('button', { name: 'Mika' }));
    await user.click(await screen.findByRole('button', { name: 'Rename' }));
    const field = screen.getByLabelText('New nickname');
    await user.clear(field);
    await user.type(field, 'Mi');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('heading', { level: 1, name: 'Mi' });

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Sudoku' })).toBeInTheDocument();
    await waitFor(() => expect(tableReads(fetchMock, 'hard')).toBe(2));
    // Only the tables: the Club's lists were rewritten, not read again.
    expect(callsTo(fetchMock, 'GET', '/club')).toHaveLength(1);
  });

  it('is never opened on one’s own name: Members shows it as text, tables as You', async () => {
    stubServer();
    rankingList = [sudokuTable('hard', 24)];
    memberViews = { m_1: { member: KEN_1, rankings: [] } };
    const user = userEvent.setup();
    await joinedConnection();
    renderRoot();
    await user.click(await screen.findByRole('button', { name: /^Members · / }));
    expect(screen.getByText('Ken')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ken' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(await screen.findByRole('button', { name: 'Sudoku' }));
    await screen.findAllByText('You');
    expect(screen.queryByRole('button', { name: 'You' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ken B' })).not.toBeInTheDocument();
  });
});
