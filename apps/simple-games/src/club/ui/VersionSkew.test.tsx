/**
 * A game whose contract changed what its tables and boards are (club.md
 * 「Spiderette への切り替え」, 2026-11-07): Spider Solitaire's 104-card tables
 * (`1-suit` / `2-suits` / `4-suits`) and 104-card dailies (params without
 * `layout`) stay on the server — 1.8.2 still sends to them — but this build
 * offers them nowhere as Spiderette's and offers no Play for such a daily.
 * The one way in that stays is to the viewer's own records there, so they can
 * still delete them one at a time (PRODUCT_PRINCIPLES「自分の記録は、本人が
 * 自分で、1 件ずつ消せる」): their rows in a 104-card table under "Your
 * rankings" (named `104 cards`), and a 104-card daily of today they have a
 * result in. Other games are untouched. Rendered against a stubbed server, as
 * ClubRoot.test.tsx.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema, type ClubConnection } from '@/storage/schemas';
import { catalogs } from '../i18n';
import { addClubConnection } from '../storage/connections';
import { currentTables, isCurrentBoard, isCurrentTable } from '../contract/challenge';
import { todayLocal } from './common';
import { AlbumsScreen } from './AlbumsScreen';
import { clearWithdrawnChallenges } from './ChallengeScreen';
import { ClubRoot } from './ClubRoot';
import { RecordBookScreen } from './RecordBookScreen';

vi.mock('@/ui/clubFeatures', () => ({ MANAGED_CLUB_ORIGIN: null, PRIVATE_CLUBS_ENABLED: true }));

const ENDPOINT = 'https://club.example.com';
const CLUB = { id: 'c_1', name: 'Suzuki Family', createdAt: '2026-09-09T00:00:00.000Z' };
const ME = { id: 'm_7', nickname: 'Ken', role: 'member', joinedAt: '2026-09-09T00:00:00.000Z' };
const YOH = { id: 'm_1', nickname: 'Yoh', role: 'member', joinedAt: '2026-09-01T00:00:00.000Z' };
const DIFFERENT_VERSION = catalogs.en.clubDifferentVersion;
const TODAY = todayLocal();

const SPIDER_FACTS = { moves: 120, elapsedSeconds: 400, hints: 0 };
const ENTRY = {
  id: 'r_1',
  memberId: 'm_1',
  nickname: 'Yoh',
  submittedAt: '2026-11-07T00:00:00.000Z',
  facts: SPIDER_FACTS,
  seed: 's',
  boardDigest: 'ss2:00000001',
};
const table = (gameId: string, paramsKey: string, facts: unknown = SPIDER_FACTS) => ({
  gameId,
  paramsKey,
  entryCount: 3,
  leader: { ...ENTRY, facts },
});
const standing = (gameId: string, paramsKey: string, facts: unknown = SPIDER_FACTS) => ({
  ...table(gameId, paramsKey, facts),
  best: {
    rank: 2,
    entry: { ...ENTRY, id: `${gameId}-${paramsKey}`, memberId: 'm_7', nickname: 'Ken', facts },
    nextValue: null,
  },
});
const SUDOKU_FACTS = { elapsedSeconds: 238, mistakes: 0, hints: 1 };

/** Both decks' tables, as a server that 1.8.2 and 1.8.3 both send to lists them (by spelling). */
const BOTH_DECKS = [
  table('spider-solitaire', '1-suit'),
  table('spider-solitaire', '2-suits'),
  table('spider-solitaire', '4-suits'),
  table('spider-solitaire', 'spiderette-1-suit'),
  table('spider-solitaire', 'spiderette-2-suits'),
  table('sudoku', 'hard', SUDOKU_FACTS),
];

const challenge = (id: string, gameId: string, params: unknown, seed: string, digest: string) => ({
  id,
  gameId,
  contractVersion: 1,
  params,
  seed,
  boardDigest: digest,
  title: null,
  createdBy: { id: 'm_1', nickname: 'Yoh' },
  createdAt: '2026-11-07T00:00:00.000Z',
  resultCount: 1,
  mine: false,
  daily: TODAY,
});
/** A 1.8.2 device's Spider daily: 104 cards, no `layout`, an `ss1:` digest. */
const OLD_SPIDER_DAILY = challenge(
  'ch_ss1',
  'spider-solitaire',
  { suitCount: 1 },
  `ss-daily-${TODAY}`,
  'ss1:0badc0de',
);
/** This build's Spiderette daily. */
const SPIDERETTE_DAILY = challenge(
  'ch_ss2',
  'spider-solitaire',
  { layout: 'spiderette', suitCount: 1 },
  `ss-spiderette-daily-${TODAY}`,
  'ss2:0000beef',
);
const SUDOKU_DAILY = challenge(
  'ch_sd',
  'sudoku',
  { difficulty: 'hard' },
  `sudoku-daily-${TODAY}`,
  'sd1:9f3a1c07',
);
const CHALLENGES = [OLD_SPIDER_DAILY, SPIDERETTE_DAILY, SUDOKU_DAILY];

let rankingList: unknown[] = [];
let mineList: { gameId: string; paramsKey: string }[] = [];
let memberRankings: unknown[] = [];
/** Today's dailies as the server lists them for the viewer (`mine` is theirs). */
let challengeList: (typeof OLD_SPIDER_DAILY)[] = CHALLENGES;
/** The viewer's rows in a table, by `<game>/<key>`: on the table's page, and what a DELETE takes off. */
let ownEntries: Record<string, { id: string | null }[]> = {};
/** The challenges the viewer has a result in: their result is in the list until a DELETE. */
let ownResultIn = new Set<string>();

const notFound = () => reply({ error: { code: 'not_found', message: 'no' } }, 404);
const noContent = () => new Response(null, { status: 204, headers: { 'X-Club-Api': '1' } });

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Club-Api': '1' },
  });
}

/** A row of the viewer's in a table, as `GET /rankings/<game>/<key>` sends it. */
const ownEntry = (id: string | null) => ({ ...ENTRY, id, memberId: 'm_7', nickname: 'Ken' });

function stubServer() {
  /** One of the viewer's rows went; a table with none left leaves `GET /rankings/mine`. */
  const dropOwn = (table: string, keep: (row: { id: string | null }) => boolean) => {
    const rows = ownEntries[table];
    if (!rows || !rows.some((row) => !keep(row))) return notFound();
    ownEntries[table] = rows.filter(keep);
    if (ownEntries[table].length === 0) {
      mineList = mineList.filter((m) => `${m.gameId}/${m.paramsKey}` !== table);
    }
    return noContent();
  };
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const path = url.pathname.replace('/api/v1', '');
    const method = init?.method ?? 'GET';
    if (method === 'DELETE') {
      const entry = /^\/rankings\/([^/]+\/[^/]+)\/entries\/([^/]+)$/.exec(path);
      if (entry) return dropOwn(entry[1]!, (row) => row.id !== entry[2]);
      const all = /^\/rankings\/([^/]+\/[^/]+)\/me$/.exec(path);
      if (all) return dropOwn(all[1]!, () => false);
      const result = /^\/challenges\/([^/]+)\/results\/me$/.exec(path);
      if (result && ownResultIn.delete(result[1]!)) return noContent();
      return notFound();
    }
    if (method !== 'GET') return notFound();
    if (path === '/club') return reply({ club: CLUB, me: ME, members: [ME, YOH] });
    if (path === '/challenges') {
      return reply(url.searchParams.get('daily') === TODAY ? challengeList : []);
    }
    const one = /^\/challenges\/([^/]+)$/.exec(path);
    if (one) {
      const found = challengeList.find((c) => c.id === one[1]);
      return found ? reply(found) : notFound();
    }
    const results = /^\/challenges\/([^/]+)\/results$/.exec(path);
    if (results) {
      const result = (memberId: string, nickname: string) => ({
        memberId,
        nickname,
        submittedAt: '2026-11-07T00:00:00.000Z',
        outcome: 'completed',
        facts: SPIDER_FACTS,
      });
      return reply([
        result('m_1', 'Yoh'),
        ...(ownResultIn.has(results[1]!) ? [result('m_7', 'Ken')] : []),
      ]);
    }
    if (path === '/rankings') return reply(rankingList);
    if (path === '/rankings/mine') return reply(mineList);
    const ranking = /^\/rankings\/([^/]+)\/([^/]+)$/.exec(path);
    if (ranking) {
      const own = (ownEntries[`${ranking[1]}/${ranking[2]}`] ?? []).map((row) => ownEntry(row.id));
      return reply({
        gameId: ranking[1],
        paramsKey: ranking[2],
        entryCount: 1 + own.length,
        entries: [ENTRY, ...own],
        me: null,
      });
    }
    if (path === '/members/m_1') return reply({ member: YOH, rankings: memberRankings });
    return notFound();
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** The DELETE requests made so far, as their paths under the API. */
const deletes = (fetchMock: ReturnType<typeof stubServer>) =>
  fetchMock.mock.calls
    .filter(([, init]) => init?.method === 'DELETE')
    .map(([input]) => new URL(String(input)).pathname.replace('/api/v1', ''));

/** The `GET /rankings/<game>/<key>` reads made so far, as `<game>/<key>`. */
const tableReads = (fetchMock: ReturnType<typeof stubServer>) =>
  fetchMock.mock.calls
    .map(([input]) => new URL(String(input)).pathname)
    .filter((path) => /^\/api\/v1\/rankings\/[^/]+\/[^/]+$/.test(path) && !path.endsWith('/mine'))
    .map((path) => path.replace('/api/v1/rankings/', ''));
const myRows = () =>
  Array.from(document.querySelectorAll<HTMLElement>('.club-mine')).map((row) =>
    row.querySelector('.settings-row-label')?.textContent?.trim(),
  );
const chips = () => screen.queryAllByRole('tab').map((tab) => tab.textContent);
const selectedChip = () =>
  screen.queryAllByRole('tab').find((tab) => tab.getAttribute('aria-selected') === 'true')
    ?.textContent;

async function joined() {
  await addClubConnection({
    endpoint: ENDPOINT,
    clubId: 'c_1',
    clubName: 'Suzuki Family',
    memberId: 'm_7',
    memberToken: 'member-token-1',
    nickname: 'Ken',
    role: 'member',
    joinedAt: '2026-09-09T00:00:00.000Z',
    autoSend: true,
  });
}

function renderRoot(props: Partial<React.ComponentProps<typeof ClubRoot>> = {}) {
  const handlers = { onBack: vi.fn(), onPlayChallenge: vi.fn(), onConnectionsChanged: vi.fn() };
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <ClubRoot entry="settings" {...handlers} {...props} />
    </SettingsProvider>,
  );
  return handlers;
}

beforeEach(() => {
  rankingList = BOTH_DECKS;
  mineList = [];
  memberRankings = [];
  challengeList = CHALLENGES;
  ownEntries = {};
  ownResultIn = new Set();
  clearWithdrawnChallenges();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('which tables and boards this build still makes', () => {
  it('retires only the 104-card Spider tables; every other game keeps every key', () => {
    for (const key of ['1-suit', '2-suits', '4-suits']) {
      expect(isCurrentTable('spider-solitaire', key), key).toBe(false);
    }
    for (const key of ['spiderette-1-suit', 'spiderette-2-suits', 'spiderette-4-suits']) {
      expect(isCurrentTable('spider-solitaire', key), key).toBe(true);
    }
    expect(isCurrentTable('sudoku', 'hard')).toBe(true);
    expect(isCurrentTable('solitaire', 'draw-1')).toBe(true);
    // A game this build does not know is not this rule's to hide (the shelves leave it out).
    expect(isCurrentTable('not-a-game', '1-suit')).toBe(true);
    expect(currentTables(BOTH_DECKS).map((r) => `${r.gameId}/${r.paramsKey}`)).toEqual([
      'spider-solitaire/spiderette-1-suit',
      'spider-solitaire/spiderette-2-suits',
      'sudoku/hard',
    ]);
  });

  it('calls a board another version made one whose params the contract refuses', () => {
    expect(isCurrentBoard('spider-solitaire', OLD_SPIDER_DAILY.params)).toBe(false);
    expect(isCurrentBoard('spider-solitaire', SPIDERETTE_DAILY.params)).toBe(true);
    expect(isCurrentBoard('sudoku', SUDOKU_DAILY.params)).toBe(true);
    expect(isCurrentBoard('sudoku', { difficulty: 'expert' })).toBe(false);
    expect(isCurrentBoard('not-a-game', {})).toBe(true);
  });
});

describe('the Club screen and a game’s tables leave the 104-card Spider tables out', () => {
  it('shows only Spiderette chips, and the tile opens the first Spiderette table', async () => {
    const fetchMock = stubServer();
    const user = userEvent.setup();
    await joined();
    renderRoot();
    await user.click(await screen.findByRole('button', { name: 'Spider Solitaire' }));
    expect(await screen.findByRole('heading', { name: 'Spider Solitaire' })).toBeInTheDocument();
    // One chip per Spiderette table, never "1 suit, 1 suit, 2 suits, ...".
    expect(chips()).toEqual(['1 suit', '2 suits']);
    expect(selectedChip()).toBe('1 suit');
    await waitFor(() =>
      expect(tableReads(fetchMock)).toEqual(['spider-solitaire/spiderette-1-suit']),
    );
  });

  it('a 104-card row of yours comes last in Your rankings, named so, and does not choose the mode a tile opens', async () => {
    const fetchMock = stubServer();
    mineList = [
      standing('spider-solitaire', '1-suit'),
      standing('spider-solitaire', 'spiderette-2-suits'),
      standing('sudoku', 'hard', SUDOKU_FACTS),
    ];
    const user = userEvent.setup();
    await joined();
    renderRoot();
    expect(await screen.findByRole('heading', { name: 'Your rankings' })).toBeInTheDocument();
    // Never a second "Spider Solitaire · 1 suit": the 104-card table says what it was.
    expect(myRows()).toEqual([
      'Sudoku · Hard',
      'Spider Solitaire · 2 suits',
      'Spider Solitaire · 104 cards · 1 suit',
    ]);

    await user.click(screen.getByRole('button', { name: 'Spider Solitaire' }));
    await screen.findByRole('heading', { name: 'Spider Solitaire' });
    expect(chips()).toEqual(['1 suit', '2 suits']);
    expect(selectedChip()).toBe('2 suits');
    await waitFor(() =>
      expect(tableReads(fetchMock)).toEqual(['spider-solitaire/spiderette-2-suits']),
    );
  });

  it('with only 104-card rows of yours, the section lists them and the tile still opens Spiderette', async () => {
    const fetchMock = stubServer();
    mineList = [standing('spider-solitaire', '4-suits'), standing('spider-solitaire', '1-suit')];
    const user = userEvent.setup();
    await joined();
    renderRoot();
    expect(await screen.findByRole('heading', { name: 'Your rankings' })).toBeInTheDocument();
    expect(myRows()).toEqual([
      'Spider Solitaire · 104 cards · 1 suit',
      'Spider Solitaire · 104 cards · 4 suits',
    ]);
    await user.click(screen.getByRole('button', { name: 'Spider Solitaire' }));
    await screen.findByRole('heading', { name: 'Spider Solitaire' });
    expect(chips()).toEqual(['1 suit', '2 suits']);
    await waitFor(() =>
      expect(tableReads(fetchMock)).toEqual(['spider-solitaire/spiderette-1-suit']),
    );
  });

  it('a Club with only 104-card Spider tables puts no Spider tile on the shelves', async () => {
    stubServer();
    rankingList = [table('spider-solitaire', '1-suit'), table('sudoku', 'hard', SUDOKU_FACTS)];
    await joined();
    renderRoot();
    expect(await screen.findByRole('button', { name: 'Sudoku' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Spider Solitaire' })).not.toBeInTheDocument();
  });

  it('a member’s view lists their Spiderette table only, and opens it with Spiderette chips', async () => {
    const fetchMock = stubServer();
    memberRankings = [
      standing('spider-solitaire', '1-suit'),
      standing('spider-solitaire', 'spiderette-1-suit'),
    ];
    const user = userEvent.setup();
    await joined();
    renderRoot();
    await user.click(await screen.findByRole('button', { name: /^Members/ }));
    await user.click(await screen.findByRole('button', { name: 'Yoh' }));
    await screen.findByRole('heading', { name: 'Yoh' });
    expect(myRows()).toEqual(['Spider Solitaire · 1 suit']);

    await user.click(screen.getByRole('button', { name: /^Spider Solitaire · 1 suit/ }));
    await screen.findByRole('heading', { name: 'Spider Solitaire' });
    expect(chips()).toEqual(['1 suit', '2 suits']);
    await waitFor(() =>
      expect(tableReads(fetchMock)).toEqual(['spider-solitaire/spiderette-1-suit']),
    );
  });
});

describe('your own rows in a 104-card table can still be deleted, one at a time', () => {
  const deleteButtons = () => screen.queryAllByRole('button', { name: 'Delete my record' });
  const LEGACY_1 = 'Spider Solitaire · 104 cards · 1 suit';

  it('opens the 104-card table alone, under its own name, with Delete on your row and no Play', async () => {
    const fetchMock = stubServer();
    mineList = [
      standing('spider-solitaire', '1-suit'),
      standing('spider-solitaire', 'spiderette-1-suit'),
    ];
    ownEntries = { 'spider-solitaire/1-suit': [{ id: 'r_own' }] };
    const user = userEvent.setup();
    await joined();
    renderRoot();
    await screen.findByRole('heading', { name: 'Your rankings' });
    await user.click(screen.getByRole('button', { name: new RegExp(`^${LEGACY_1} · `) }));

    expect(await screen.findByRole('heading', { name: LEGACY_1 })).toBeInTheDocument();
    // Alone: no chips, so never a "1 suit" chip beside Spiderette's "1 suit".
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(chips()).toEqual([]);
    await waitFor(() => expect(tableReads(fetchMock)).toEqual(['spider-solitaire/1-suit']));
    await screen.findByText('You');
    expect(deleteButtons()).toHaveLength(1);
    // Nothing on this screen opens the game.
    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Play again' })).not.toBeInTheDocument();

    await user.click(deleteButtons()[0]!);
    await user.click(
      within(screen.getByRole('alertdialog', { name: 'Delete this result?' })).getByRole('button', {
        name: 'Delete',
      }),
    );
    await waitFor(() => expect(deleteButtons()).toHaveLength(0));
    expect(deletes(fetchMock)).toEqual(['/rankings/spider-solitaire/1-suit/entries/r_own']);
    // The table is read again, still alone.
    expect(tableReads(fetchMock)).toEqual(['spider-solitaire/1-suit', 'spider-solitaire/1-suit']);
    expect(chips()).toEqual([]);

    // Back on the Club, read again: the row is gone, and the tile still opens Spiderette alone.
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByRole('heading', { name: 'Your rankings' });
    await waitFor(() => expect(myRows()).toEqual(['Spider Solitaire · 1 suit']));
    await user.click(screen.getByRole('button', { name: 'Spider Solitaire' }));
    await screen.findByRole('heading', { name: 'Spider Solitaire' });
    expect(chips()).toEqual(['1 suit', '2 suits']);
  });

  it('a row from a server without row ids goes through the compatibility route', async () => {
    const fetchMock = stubServer();
    mineList = [standing('spider-solitaire', '4-suits')];
    ownEntries = { 'spider-solitaire/4-suits': [{ id: null }] };
    const user = userEvent.setup();
    await joined();
    renderRoot();
    await user.click(
      await screen.findByRole('button', { name: /^Spider Solitaire · 104 cards · 4 suits · / }),
    );
    await screen.findByRole('heading', { name: 'Spider Solitaire · 104 cards · 4 suits' });
    await screen.findByText('You');
    await user.click(deleteButtons()[0]!);
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    await waitFor(() => expect(deleteButtons()).toHaveLength(0));
    expect(deletes(fetchMock)).toEqual(['/rankings/spider-solitaire/4-suits/me']);
  });
});

describe('a daily another version of the game made is not offered to play', () => {
  it('Today lists the Spiderette and Sudoku dailies, not a 104-card one with no result of yours', async () => {
    stubServer();
    await joined();
    renderRoot();
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
    const today = Array.from(document.querySelectorAll('.club-line'))
      .map((row) => row.getAttribute('aria-label'))
      .filter((label) => label?.includes('Daily'));
    expect(today).toEqual([
      'Spider Solitaire · 1 suit · Daily · by Yoh',
      'Sudoku · Hard · Daily · by Yoh',
    ]);
  });

  it('the 104-card daily, opened again from its game, says it is another version and has no Play', async () => {
    stubServer();
    await joined();
    const handlers = renderRoot({
      focus: { endpoint: ENDPOINT, challengeId: OLD_SPIDER_DAILY.id },
    });
    expect(await screen.findByText(DIFFERENT_VERSION)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Play again' })).not.toBeInTheDocument();
    // No promise of a send it would not make.
    expect(screen.queryByText(/your result is sent to/)).not.toBeInTheDocument();
    // Its results are still there to read.
    expect(await screen.findByRole('button', { name: 'Yoh' })).toBeInTheDocument();
    expect(handlers.onPlayChallenge).not.toHaveBeenCalled();
  });

  it('a 104-card daily you have a result in is listed, opens with no Play, and your result can be deleted', async () => {
    const fetchMock = stubServer();
    challengeList = [{ ...OLD_SPIDER_DAILY, mine: true }, SPIDERETTE_DAILY, SUDOKU_DAILY];
    ownResultIn = new Set([OLD_SPIDER_DAILY.id]);
    const deleteButtons = () => screen.queryAllByRole('button', { name: 'Delete my record' });
    const user = userEvent.setup();
    await joined();
    const handlers = renderRoot();
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
    const today = Array.from(document.querySelectorAll('.club-line'))
      .map((row) => row.getAttribute('aria-label'))
      .filter((label) => label?.includes('Daily'));
    expect(today).toEqual([
      'Spider Solitaire · Daily · by Yoh',
      'Spider Solitaire · 1 suit · Daily · by Yoh',
      'Sudoku · Hard · Daily · by Yoh',
    ]);

    await user.click(screen.getByRole('button', { name: 'Spider Solitaire · Daily · by Yoh' }));
    expect(await screen.findByText(DIFFERENT_VERSION)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Play again' })).not.toBeInTheDocument();
    await screen.findByText('You');
    expect(deleteButtons()).toHaveLength(1);

    await user.click(deleteButtons()[0]!);
    await user.click(
      within(
        screen.getByRole('alertdialog', { name: 'Remove your result from this challenge?' }),
      ).getByRole('button', { name: 'Delete' }),
    );
    await waitFor(() => expect(deleteButtons()).toHaveLength(0));
    expect(deletes(fetchMock)).toEqual([`/challenges/${OLD_SPIDER_DAILY.id}/results/me`]);
    // Still no Play once withdrawn, and the others' results stay to read.
    expect(screen.getByText(DIFFERENT_VERSION)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Play again' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yoh' })).toBeInTheDocument();
    expect(handlers.onPlayChallenge).not.toHaveBeenCalled();
  });

  it('the Spiderette daily is played as before', async () => {
    stubServer();
    const user = userEvent.setup();
    await joined();
    const handlers = renderRoot({
      focus: { endpoint: ENDPOINT, challengeId: SPIDERETTE_DAILY.id },
    });
    await user.click(await screen.findByRole('button', { name: 'Play' }));
    expect(screen.queryByText(DIFFERENT_VERSION)).not.toBeInTheDocument();
    expect(handlers.onPlayChallenge).toHaveBeenCalledWith({
      gameId: 'spider-solitaire',
      focus: { endpoint: ENDPOINT, challengeId: SPIDERETTE_DAILY.id },
    });
  });

  it('another game’s daily is untouched', async () => {
    stubServer();
    const user = userEvent.setup();
    await joined();
    const handlers = renderRoot();
    await user.click(await screen.findByRole('button', { name: /^Sudoku · Hard · Daily/ }));
    await user.click(await screen.findByRole('button', { name: 'Play' }));
    expect(handlers.onPlayChallenge).toHaveBeenCalledWith({
      gameId: 'sudoku',
      focus: { endpoint: ENDPOINT, challengeId: SUDOKU_DAILY.id },
    });
  });
});

describe('the owner’s record book and albums leave the 104-card Spider records out', () => {
  const MANAGED = 'https://managed.example.com/clubs/c_one';
  const OWNER: ClubConnection = {
    endpoint: MANAGED,
    clubId: 'c_one',
    clubName: 'Family',
    memberId: 'm_one',
    memberToken: 'member-token-secret',
    nickname: 'Ken',
    role: 'owner',
    joinedAt: '2026-10-23T00:00:00.000Z',
  };
  const AXIS = { fact: 'moves', direction: 'asc' };
  const recordTable = (paramsKey: string) => ({
    gameId: 'spider-solitaire',
    paramsKey,
    participantCount: 2,
    axis: AXIS,
    leader: ENTRY,
    medianBestValue: null,
    me: null,
  });
  const result = {
    memberId: 'm_1',
    nickname: 'Yoh',
    submittedAt: '2026-11-07T00:00:00.000Z',
    outcome: 'completed',
    facts: SPIDER_FACTS,
  };
  const recordDaily = (c: typeof OLD_SPIDER_DAILY) => ({
    challengeId: c.id,
    gameId: c.gameId,
    contractVersion: 1,
    params: c.params,
    seed: c.seed,
    boardDigest: c.boardDigest,
    daily: TODAY,
    participantCount: 1,
    axis: AXIS,
    leader: result,
    me: null,
  });
  const RECORDS = {
    club: { id: 'c_one', name: 'Family' },
    generatedAt: '2026-11-07T00:00:00.000Z',
    memberCount: 3,
    basis: 'retained-member-bests',
    tables: [recordTable('1-suit'), recordTable('spiderette-1-suit')],
    nextAfter: null,
    daily: [recordDaily(OLD_SPIDER_DAILY), recordDaily(SPIDERETTE_DAILY)],
    nextDailyAfter: null,
  };
  const ALBUM = {
    id: 'a_one',
    title: 'November bests',
    createdAt: '2026-11-07T00:00:00.000Z',
    itemCount: 4,
    tables: [
      { gameId: 'spider-solitaire', paramsKey: '1-suit', entry: ENTRY },
      { gameId: 'spider-solitaire', paramsKey: 'spiderette-1-suit', entry: ENTRY },
    ],
    daily: [
      { ...recordDaily(OLD_SPIDER_DAILY), entry: result },
      { ...recordDaily(SPIDERETTE_DAILY), entry: result },
    ],
    unavailableCount: 1,
  };
  const stubRecords = () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/owner/records?')) return reply(RECORDS);
      if (url.endsWith('/albums')) return reply({ albums: [ALBUM] });
      if (url.endsWith('/albums/a_one')) return reply(ALBUM);
      return reply({ error: { code: 'not_found', message: 'no' } }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
  };
  const renderPanel = (node: React.ReactNode) =>
    render(
      <SettingsProvider initialSettings={{ ...settingsSchema.defaultValue(), language: 'en' }}>
        {node}
      </SettingsProvider>,
    );

  it('the record book has one Spiderette table and one Spiderette daily', async () => {
    stubRecords();
    renderPanel(<RecordBookScreen connection={OWNER} onAlbums={vi.fn()} onBack={vi.fn()} />);
    expect(
      await screen.findByRole('heading', { name: 'Spider Solitaire · 1 suit' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: /^Spider Solitaire/ })).toHaveLength(2);
    expect(screen.getAllByRole('heading', { name: /^Spider Solitaire · Daily/ })).toHaveLength(1);
  });

  it('the album form offers only Spiderette records', async () => {
    stubRecords();
    const user = userEvent.setup();
    renderPanel(<AlbumsScreen connection={OWNER} onBack={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Publish album' })).not.toBeDisabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Publish album' }));
    await screen.findByRole('textbox', { name: 'Album title' });
    expect(screen.getAllByRole('checkbox').map((box) => box.parentElement?.textContent)).toEqual([
      'Spider Solitaire · 1 suit',
      `Spider Solitaire · Daily · ${TODAY}`,
    ]);
  });

  it('an album holding 104-card records counts them with the ones no longer available', async () => {
    stubRecords();
    const user = userEvent.setup();
    renderPanel(<AlbumsScreen connection={{ ...OWNER, role: 'member' }} onBack={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: /November bests/ }));
    expect(await screen.findByText('3 records are no longer available.')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: /^Spider Solitaire/ })).toHaveLength(2);
  });
});
