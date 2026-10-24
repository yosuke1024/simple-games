import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema, type ClubConnection } from '@/storage/schemas';
import { addClubConnection, loadClubConnections } from '../storage/connections';
import { ClubManagementScreen } from './ClubManagementScreen';
import { AlbumsScreen } from './AlbumsScreen';
import { RecordBookScreen } from './RecordBookScreen';

const ORIGIN = 'https://managed.example.com';
const ENDPOINT = `${ORIGIN}/clubs/c_one`;
const DATE = '2026-10-23T00:00:00.000Z';
const CLUB = { id: 'c_one', name: 'Family', createdAt: DATE };
const MEMBER = { id: 'm_one', nickname: 'Ken', role: 'owner' as const, joinedAt: DATE };
const CONNECTION: ClubConnection = {
  endpoint: ENDPOINT,
  clubId: CLUB.id,
  clubName: CLUB.name,
  memberId: MEMBER.id,
  memberToken: 'member-token-secret',
  nickname: MEMBER.nickname,
  role: 'owner',
  joinedAt: DATE,
};
const ENTRY = {
  id: 'r_one',
  memberId: MEMBER.id,
  nickname: MEMBER.nickname,
  submittedAt: DATE,
  facts: { elapsedSeconds: 100, mistakes: 0, hints: 0 },
  seed: 's',
  boardDigest: 'sd1:a',
};
const RECORDS = {
  club: { id: CLUB.id, name: CLUB.name },
  generatedAt: DATE,
  memberCount: 3,
  basis: 'retained-member-bests',
  tables: [
    {
      gameId: 'sudoku',
      paramsKey: 'hard',
      participantCount: 2,
      axis: { fact: 'elapsedSeconds', direction: 'asc' },
      leader: ENTRY,
      medianBestValue: 150,
      me: { rank: 1, entry: ENTRY },
    },
  ],
  nextAfter: null,
  daily: [],
  nextDailyAfter: null,
};
const ALBUM = {
  id: 'a_one',
  title: 'October bests',
  createdAt: DATE,
  itemCount: 1,
  tables: [{ gameId: 'sudoku', paramsKey: 'hard', entry: ENTRY }],
  daily: [],
  unavailableCount: 0,
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'X-Club-Api': '1', 'Content-Type': 'application/json' },
  });
const renderPanel = (node: ReactNode) =>
  render(
    <SettingsProvider initialSettings={{ ...settingsSchema.defaultValue(), language: 'en' }}>
      {node}
    </SettingsProvider>,
  );
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('owner Club tools', () => {
  it('saves independent visibility, approval and game choices and approves a pending member explicitly', async () => {
    await addClubConnection(CONNECTION);
    const request = {
      id: 'jr_one',
      nickname: 'Mika',
      createdAt: DATE,
      expiresAt: '2026-10-30T00:00:00.000Z',
      status: 'pending',
    };
    const fetcher = vi.fn().mockImplementation(async (url: string, options: RequestInit) => {
      if (url.endsWith('/settings') && options.method === 'GET')
        return reply({
          visibility: 'private',
          approvalRequired: false,
          allowedGameIds: ['sudoku'],
        });
      if (url.endsWith('/settings') && options.method === 'PATCH')
        return reply(JSON.parse(String(options.body)));
      if (url.endsWith('/join-requests')) return reply([request]);
      if (url.endsWith('/join-requests/jr_one/approve'))
        return reply({ status: 'approved', request: { ...request, status: 'approved' } });
      return reply({ error: { code: 'not_found', message: 'missing' } }, 404);
    });
    vi.stubGlobal('fetch', fetcher);
    const changed = vi.fn();
    renderPanel(
      <ClubManagementScreen connection={CONNECTION} onChanged={changed} onBack={vi.fn()} />,
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole('radio', { name: 'Public' }));
    await user.click(screen.getByRole('checkbox', { name: 'Approve new members automatically' }));
    await user.click(screen.getByRole('checkbox', { name: 'Sudoku' }));
    await user.click(screen.getByRole('checkbox', { name: 'Minesweeper' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Settings saved');
    const patch = fetcher.mock.calls.find(([, options]) => options.method === 'PATCH');
    expect(JSON.parse(patch![1].body)).toEqual({
      visibility: 'public',
      approvalRequired: true,
      allowedGameIds: ['minesweeper'],
    });
    expect((await loadClubConnections())[0]?.allowedGameIds).toEqual(['minesweeper']);
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('/approve'))).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(screen.queryByText('Mika')).toBeNull());
    expect(fetcher.mock.calls.filter(([url]) => String(url).includes('/approve'))).toHaveLength(1);
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it('publishes only selected record references after the member-visibility disclosure', async () => {
    let published = false;
    const fetcher = vi.fn().mockImplementation(async (url: string, options: RequestInit) => {
      if (url.includes('/owner/records?')) return reply(RECORDS);
      if (url.endsWith('/albums') && options.method === 'GET')
        return reply({ albums: published ? [ALBUM] : [] });
      if (url.endsWith('/albums') && options.method === 'POST') {
        published = true;
        return reply(ALBUM, 201);
      }
      return reply({ error: { code: 'not_found', message: 'missing' } }, 404);
    });
    vi.stubGlobal('fetch', fetcher);
    renderPanel(<AlbumsScreen connection={CONNECTION} onBack={vi.fn()} />);
    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Publish album' })).not.toBeDisabled(),
    );
    expect(screen.getByText(/Members of this Club can read the album/)).toBeInTheDocument();
    expect(fetcher.mock.calls.some(([, options]) => options.method === 'POST')).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Publish album' }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Album title' }), {
      target: { value: ALBUM.title },
    });
    await user.click(screen.getByRole('checkbox', { name: /Sudoku.*Hard/ }));
    await user.click(screen.getByRole('button', { name: 'Publish album' }));
    await screen.findByRole('heading', { name: ALBUM.title });
    const publish = fetcher.mock.calls.find(([, options]) => options.method === 'POST');
    expect(JSON.parse(publish![1].body)).toEqual({
      title: ALBUM.title,
      tables: [{ gameId: 'sudoku', paramsKey: 'hard' }],
      challengeIds: [],
      clientId: expect.stringMatching(/^[a-f0-9]{32}$/),
    });
    expect(publish![1].body).not.toContain('elapsedSeconds');
  });

  it('lets a member read an album with missing sources without offering owner actions', async () => {
    const fetcher = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/albums')) return reply({ albums: [ALBUM] });
      if (url.endsWith('/albums/a_one'))
        return reply({ ...ALBUM, tables: [], unavailableCount: 1 });
      return reply({ error: { code: 'not_found', message: 'missing' } }, 404);
    });
    vi.stubGlobal('fetch', fetcher);
    renderPanel(<AlbumsScreen connection={{ ...CONNECTION, role: 'member' }} onBack={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /October bests/ }));
    await screen.findByText('1 records are no longer available.');
    expect(screen.queryByRole('button', { name: 'Publish album' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete album' })).toBeNull();
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('/owner/records'))).toBe(false);
  });

  it.each([false, true])(
    'reads available owned Clubs without adding memberships or consent, even when one connection fails: %s',
    async (oneFails) => {
      const clubs = ['c_one', 'c_two'].map((id) => ({
        id,
        name: id,
        endpoint: `${ORIGIN}/clubs/${id}`,
        createdAt: DATE,
        memberCount: 3,
        visibility: 'private' as const,
        approvalRequired: false,
        allowedGameIds: null,
        status: 'ready' as const,
      }));
      const fetcher = vi.fn().mockImplementation(async (url: string, options: RequestInit) => {
        if (url.endsWith('/connect')) {
          const club = clubs.find((c) => url.includes(`/clubs/${c.id}/`))!;
          expect(options.headers).toMatchObject({ Authorization: 'Bearer owner-secret' });
          if (oneFails && club.id === 'c_two')
            return reply(
              { error: { code: 'internal_error', message: 'temporarily unavailable' } },
              500,
            );
          return reply({
            club: { id: club.id, name: club.name, createdAt: DATE },
            member: MEMBER,
            memberToken: `token-${club.id}`,
            endpoint: club.endpoint,
          });
        }
        if (url.includes('/owner/records?')) {
          const club = clubs.find((c) => url.startsWith(c.endpoint))!;
          expect(options.headers).toMatchObject({ Authorization: `Bearer token-${club.id}` });
          return reply({ ...RECORDS, club: { id: club.id, name: club.name } });
        }
        return reply({ error: { code: 'not_found', message: 'missing' } }, 404);
      });
      vi.stubGlobal('fetch', fetcher);
      renderPanel(
        <RecordBookScreen
          managed={{
            origin: ORIGIN,
            token: 'owner-secret',
            owner: {
              owner: {
                id: 'o_one',
                plan: 'basic',
                validUntil: '2026-11-23T00:00:00.000Z',
                status: 'active',
              },
              limits: { maxClubs: 3, maxMembersPerClub: 50 },
              clubs,
              benefits: {
                adRemoval: {
                  requiredMembers: 50,
                  memberCount: clubs.reduce((sum, club) => sum + club.memberCount, 0),
                  active: false,
                  validUntil: '2026-11-23T00:00:00.000Z',
                },
              },
            },
          }}
          onAlbums={vi.fn()}
          onBack={vi.fn()}
        />,
      );
      await screen.findAllByText(oneFails ? 'c_one' : 'c_two');
      expect(await loadClubConnections()).toEqual([]);
      expect(
        fetcher.mock.calls.filter(([url]) => String(url).includes('/owner/records?')),
      ).toHaveLength(oneFails ? 1 : 2);
      expect(screen.getAllByText('2 members with records')).toHaveLength(oneFails ? 1 : 2);
      expect(screen.getAllByText('Your place among members: #1')).toHaveLength(oneFails ? 1 : 2);
      if (oneFails) expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.');
    },
  );
});
