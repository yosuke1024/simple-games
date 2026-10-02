/**
 * The shell's three Club House doors and the challenge round trip
 * (docs/architecture/club.md §2, §3, §7-1; docs/plans/2026-10-02-club-client.md
 * §2). What is pinned here is the shell's half only:
 *
 * - the layer loads on a press of one of the doors, at boot for a device that
 *   has joined, or for an invite link — and on nothing else;
 * - a failed load changes nothing on screen (club.md §12-2 (e));
 * - the bridge the result screens read carries the connections boot found;
 * - a challenge game receives its challenge, and leaving it returns to that
 *   challenge in the Club — not the collection, and with no review question.
 *
 * The Club layer is a stand-in (`setClubLoaderForTesting`): the real
 * `ClubRoot` is src/club's to test. The games are stubbed the way
 * App.shortcut.test.tsx stubs them.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useContext } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClubModule, ClubPlayRequest, ClubRootProps } from '../ui/clubBridge';
import { ClubBridgeContext } from '../ui/clubBridge';

const { capacitorMock, reviewMock } = vi.hoisted(() => ({
  capacitorMock: { platform: 'android' },
  reviewMock: {
    shouldPromptReview: vi.fn<() => boolean>(() => false),
    markReviewPromptShown: vi.fn(),
  },
}));

vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@capacitor/core')>();
  return {
    ...actual,
    Capacitor: {
      ...actual.Capacitor,
      isNativePlatform: () => capacitorMock.platform !== 'web',
      getPlatform: () => capacitorMock.platform,
    },
  };
});

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: () => Promise.resolve({ remove: () => undefined }),
    minimizeApp: () => Promise.resolve(),
    exitApp: () => Promise.resolve(),
    getInfo: () => Promise.resolve({ version: '0.0.0' }),
  },
}));

// Answered "yes, ask" so that a test can see the question *not* asked.
vi.mock('../services/review', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/review')>()),
  shouldPromptReview: reviewMock.shouldPromptReview,
  markReviewPromptShown: reviewMock.markReviewPromptShown,
}));

// A stub game that shows what the shell handed it: the challenge's seed and
// what the bridge says about the connections and the active challenge.
vi.mock('./lazyRoots', () => ({
  getLazyRoot: (gameId: string) =>
    function StubGameRoot({
      onExit,
      challenge,
    }: {
      onExit: () => void;
      challenge?: { seed: string };
    }) {
      const bridge = useContext(ClubBridgeContext);
      return (
        <div>
          <p>{`playing ${gameId}`}</p>
          <p data-testid="challenge">{challenge?.seed ?? 'none'}</p>
          <p data-testid="bridge">
            {bridge === null
              ? 'no bridge'
              : `${bridge.connections.length} connections, active ${
                  bridge.activeChallenge?.challengeId ?? 'none'
                }`}
          </p>
          <button type="button" onClick={onExit}>
            All games
          </button>
        </div>
      );
    },
  resetLazyRoot: () => undefined,
}));

import { SettingsProvider } from '../state/SettingsContext';
import { createMemoryKV } from '../storage/kv';
import { settingsSchema } from '../storage/schemas';
import { initClubGate, setClubLoaderForTesting } from './clubGate';
import { resetRecentGamesForTesting } from './recentGames';
import { App } from './App';

const ENDPOINT = 'https://club.example';

const PLAY: ClubPlayRequest = {
  gameId: 'sudoku',
  challenge: { seed: 'club-seed-1', params: { difficulty: 'easy' }, boardDigest: 'digest-1' },
  active: {
    endpoint: ENDPOINT,
    clubName: 'Suzuki Family',
    challengeId: 'ch-1',
    gameId: 'sudoku',
    boardDigest: 'digest-1',
    submitted: false,
  },
};

function FakeClubRoot({ entry, invite, focus, onBack, onPlayChallenge }: ClubRootProps) {
  return (
    <div>
      <p data-testid="club-entry">{entry}</p>
      <p data-testid="club-invite">{invite ? invite.token : 'none'}</p>
      <p data-testid="club-focus">{focus ? `${focus.endpoint} ${focus.challengeId}` : 'none'}</p>
      <button type="button" onClick={() => onPlayChallenge(PLAY)}>
        Play challenge
      </button>
      <button type="button" onClick={onBack}>
        Leave club
      </button>
    </div>
  );
}

const fakeModule: ClubModule = {
  ClubRoot: FakeClubRoot,
  createBridge: () => ({
    sendToClub: () => Promise.resolve('sent'),
    submitActive: () => Promise.resolve('sent'),
  }),
  loadConnections: () => Promise.resolve([]),
  inviteFromHref: () => null,
};

const loader = vi.fn<() => Promise<ClubModule>>();

const connection = {
  endpoint: ENDPOINT,
  clubId: 'club-1',
  clubName: 'Suzuki Family',
  memberId: 'member-1',
  memberToken: 'token-1',
  nickname: 'Yosuke',
  role: 'member',
  joinedAt: '2026-10-01T00:00:00.000Z',
};

function renderShell() {
  return render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <App />
    </SettingsProvider>,
  );
}

/** Lets the loader's promise and the renders it schedules land (see App.load.test.tsx). */
const settle = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

beforeEach(() => {
  capacitorMock.platform = 'android';
  loader.mockReset().mockImplementation(() => Promise.resolve(fakeModule));
  // Also forgets the connections a previous test's boot read.
  setClubLoaderForTesting(loader);
  reviewMock.shouldPromptReview.mockReset().mockReturnValue(true);
  reviewMock.markReviewPromptShown.mockReset();
  resetRecentGamesForTesting();
});

afterEach(() => {
  cleanup();
  setClubLoaderForTesting(null);
  window.history.replaceState(null, '', '/');
  try {
    window.localStorage.clear();
  } catch {
    // jsdom without a storage implementation: nothing to clear.
  }
});

describe('a device that has not joined', () => {
  it('loads nothing until "Play together" is pressed, then opens the discover entry', async () => {
    renderShell();
    await settle();
    expect(loader).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Club House' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Play together/ }));
    await settle();

    expect(loader).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('club-entry')).toHaveTextContent('discover');

    // Back to the collection, and in again: the layer is not loaded twice.
    fireEvent.click(screen.getByRole('button', { name: 'Leave club' }));
    expect(screen.getByRole('heading', { name: 'Simple Games' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Play together/ }));
    await settle();
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('opens the settings entry from Settings › Advanced › Club House', async () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    const advanced = screen.getByRole('region', { name: 'Advanced' });
    expect(advanced).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Club House' }));
    await settle();

    expect(loader).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('club-entry')).toHaveTextContent('settings');
  });

  it('leaves the home exactly as it was when the layer cannot be loaded', async () => {
    loader.mockImplementation(() => Promise.reject(new Error('chunk missing')));
    renderShell();

    fireEvent.click(screen.getByRole('button', { name: /Play together/ }));
    await settle();

    expect(loader).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Simple Games' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Play together/ })).toBeInTheDocument();
    expect(screen.queryByTestId('club-entry')).not.toBeInTheDocument();
  });
});

describe('a device that has joined', () => {
  beforeEach(async () => {
    await initClubGate(
      createMemoryKV({
        'sg.club': JSON.stringify({ schemaVersion: 1, connections: [connection] }),
      }),
    );
  });

  it('shows the club names instead of "Play together" and loads the layer once at boot', async () => {
    renderShell();
    await settle();

    expect(screen.getByRole('heading', { name: 'Club House' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Suzuki Family/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Play together/ })).not.toBeInTheDocument();
    expect(loader).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Suzuki Family/ }));
    await settle();
    expect(screen.getByTestId('club-entry')).toHaveTextContent('home');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('hands the result screens a bridge with the connection boot read', async () => {
    renderShell();
    await settle();

    fireEvent.click(screen.getByRole('button', { name: /^Sudoku$/ }));
    await settle();

    expect(screen.getByTestId('bridge')).toHaveTextContent('1 connections, active none');
    expect(screen.getByTestId('challenge')).toHaveTextContent('none');
  });

  it('plays a challenge and returns to it in the Club, with no review question', async () => {
    renderShell();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: /Suzuki Family/ }));
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Play challenge' }));
    await settle();

    expect(screen.getByText('playing sudoku')).toBeInTheDocument();
    expect(screen.getByTestId('challenge')).toHaveTextContent('club-seed-1');
    expect(screen.getByTestId('bridge')).toHaveTextContent('1 connections, active ch-1');

    fireEvent.click(screen.getByRole('button', { name: 'All games' }));
    await settle();

    expect(screen.queryByRole('heading', { name: 'Simple Games' })).not.toBeInTheDocument();
    expect(screen.getByTestId('club-entry')).toHaveTextContent('home');
    expect(screen.getByTestId('club-focus')).toHaveTextContent(`${ENDPOINT} ch-1`);
    expect(reviewMock.markReviewPromptShown).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('an invite link in the browser', () => {
  it('opens the Join entry at boot and takes the token out of the address', async () => {
    capacitorMock.platform = 'web';
    window.history.replaceState(null, '', '/join#invite=abc_DEF-123');

    renderShell();
    await settle();

    expect(loader).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('club-entry')).toHaveTextContent('invite');
    expect(screen.getByTestId('club-invite')).toHaveTextContent('abc_DEF-123');
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/join');
  });
});
