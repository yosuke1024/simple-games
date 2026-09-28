/**
 * The Meta install question's doorway (issue #204,
 * docs/META_ANDROID_ACQUISITION.md): the review question's doorway — leaving
 * a game for the collection by the game's own back control — and nowhere
 * else; at most once per install; ahead of the review question and never on
 * the same return; closed by the hardware back without minimizing the app,
 * and closed as a "no".
 *
 * The native plugin is the only thing mocked on the Meta side:
 * services/acquisition/metaInstall.ts runs for real, so what is pinned is the
 * shell and the service together. The games are stubbed for the reason
 * App.route.test.tsx gives.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MetaInstallState } from '../services/acquisition/plugin';

const { capacitorMock, appMock, reviewMock, metaPlugin } = vi.hoisted(() => {
  type Listener = (event: unknown) => void;
  const listeners = new Map<string, Set<Listener>>();
  return {
    capacitorMock: { platform: 'android' },
    reviewMock: {
      shouldPromptReview: vi.fn<() => boolean>(() => false),
      markReviewPromptShown: vi.fn(),
      resolveReviewPrompt: vi.fn(),
    },
    metaPlugin: {
      getState: vi.fn<() => Promise<MetaInstallState>>(),
      setConsent: vi.fn<(options: { granted: boolean }) => Promise<MetaInstallState>>(),
      reportInstall: vi.fn<() => Promise<{ started: boolean }>>(),
    },
    appMock: {
      listeners,
      fire(name: string, event: unknown) {
        for (const listener of listeners.get(name) ?? []) listener(event);
      },
      App: {
        addListener: vi.fn((name: string, listener: Listener) => {
          if (!listeners.has(name)) listeners.set(name, new Set());
          listeners.get(name)!.add(listener);
          return Promise.resolve({
            remove: () => {
              listeners.get(name)?.delete(listener);
            },
          });
        }),
        getLaunchUrl: vi.fn(() => Promise.resolve(undefined)),
        minimizeApp: vi.fn(() => Promise.resolve()),
        exitApp: vi.fn(() => Promise.resolve()),
        getInfo: vi.fn(() => Promise.resolve({ version: '0.0.0' })),
      },
    },
  };
});

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
vi.mock('@capacitor/app', () => ({ App: appMock.App }));
vi.mock('@capacitor/network', () => ({
  Network: { getStatus: vi.fn(), addListener: vi.fn() },
}));
vi.mock('../services/acquisition/plugin', () => ({ MetaInstall: metaPlugin }));
vi.mock('../services/review', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/review')>()),
  shouldPromptReview: reviewMock.shouldPromptReview,
  markReviewPromptShown: reviewMock.markReviewPromptShown,
  resolveReviewPrompt: reviewMock.resolveReviewPrompt,
}));
vi.mock('../services/sound', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/sound')>()),
  releaseSound: vi.fn(),
}));
vi.mock('./lazyRoots', () => ({
  getLazyRoot: (gameId: string) =>
    function StubGameRoot({ onExit }: { onExit: () => void }) {
      return (
        <div>
          <p>{`playing ${gameId}`}</p>
          <button type="button" onClick={onExit}>
            All games
          </button>
        </div>
      );
    },
  resetLazyRoot: () => undefined,
}));

import { initMetaInstall, resetMetaInstallForTesting } from '../services/acquisition/metaInstall';
import { setOnlineForTesting } from '../services/network';
import { SettingsProvider } from '../state/SettingsContext';
import { settingsSchema, type LanguageSetting } from '../storage/schemas';
import { resetRecentGamesForTesting } from './recentGames';
import { App } from './App';

const HOUR = 60 * 60 * 1000;

function freshInstall(overrides: Partial<MetaInstallState> = {}): MetaInstallState {
  return {
    available: true,
    consent: 'unset',
    reported: false,
    installedAt: Date.now() - HOUR,
    ...overrides,
  };
}

/** Boot as main.tsx does it — the Meta state is read, then the shell renders. */
async function launch(language: LanguageSetting = 'en') {
  await initMetaInstall();
  return render(
    <SettingsProvider initialSettings={{ ...settingsSchema.defaultValue(), language }}>
      <App />
    </SettingsProvider>,
  );
}

const metaDialog = () => screen.queryByRole('dialog', { name: 'Tell Meta about this install?' });
const reviewDialog = () => screen.queryByRole('dialog', { name: 'Enjoying Simple Games?' });
const collectionHome = () => screen.findByRole('heading', { name: 'Simple Games' });

async function playAndLeave(user: ReturnType<typeof userEvent.setup>) {
  // After the first game the recent row carries a second Sudoku tile.
  await user.click(screen.getAllByRole('button', { name: /Sudoku/ })[0]!);
  expect(screen.getByText('playing sudoku')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'All games' }));
  expect(await collectionHome()).toBeInTheDocument();
}

function pressHardwareBack() {
  act(() => appMock.fire('backButton', {}));
}

beforeEach(() => {
  capacitorMock.platform = 'android';
  setOnlineForTesting(true);
  appMock.listeners.clear();
  appMock.App.minimizeApp.mockClear();
  reviewMock.shouldPromptReview.mockReturnValue(false);
  reviewMock.markReviewPromptShown.mockClear();
  resetRecentGamesForTesting();
  resetMetaInstallForTesting();
  metaPlugin.getState.mockReset().mockResolvedValue(freshInstall());
  metaPlugin.setConsent
    .mockReset()
    .mockImplementation(({ granted }) =>
      Promise.resolve(freshInstall({ consent: granted ? 'granted' : 'declined' })),
    );
  metaPlugin.reportInstall.mockReset().mockResolvedValue({ started: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
  try {
    window.localStorage.clear();
  } catch {
    // jsdom without a storage implementation: nothing to clear.
  }
});

describe("the Meta install question's doorway", () => {
  it('is never at launch', async () => {
    await launch();
    expect(await collectionHome()).toBeInTheDocument();
    expect(metaDialog()).not.toBeInTheDocument();
    expect(metaPlugin.setConsent).not.toHaveBeenCalled();
  });

  it('opens on the way back from a game, booked as a no before anything is answered', async () => {
    const user = userEvent.setup();
    await launch();
    await playAndLeave(user);

    expect(metaDialog()).toBeInTheDocument();
    expect(metaPlugin.setConsent).toHaveBeenCalledWith({ granted: false });
    expect(metaPlugin.reportInstall).not.toHaveBeenCalled();
  });

  it('reports the install once, and only after "Allow"', async () => {
    const user = userEvent.setup();
    await launch();
    await playAndLeave(user);

    await user.click(screen.getByRole('button', { name: 'Allow' }));

    expect(metaDialog()).not.toBeInTheDocument();
    expect(metaPlugin.setConsent).toHaveBeenLastCalledWith({ granted: true });
    expect(metaPlugin.reportInstall).toHaveBeenCalledTimes(1);
  });

  it('sends nothing after "Don\'t allow", and does not come back', async () => {
    const user = userEvent.setup();
    await launch();
    await playAndLeave(user);

    await user.click(screen.getByRole('button', { name: "Don't allow" }));
    expect(metaDialog()).not.toBeInTheDocument();

    await playAndLeave(user);
    expect(metaDialog()).not.toBeInTheDocument();
    expect(metaPlugin.reportInstall).not.toHaveBeenCalled();
  });

  it('is what the hardware back closes — as a no, without minimizing the app', async () => {
    const user = userEvent.setup();
    await launch();
    await playAndLeave(user);
    expect(metaDialog()).toBeInTheDocument();

    pressHardwareBack();

    expect(metaDialog()).not.toBeInTheDocument();
    expect(appMock.App.minimizeApp).not.toHaveBeenCalled();
    expect(metaPlugin.setConsent).toHaveBeenCalledTimes(1);
    expect(metaPlugin.setConsent).toHaveBeenCalledWith({ granted: false });
    expect(metaPlugin.reportInstall).not.toHaveBeenCalled();

    pressHardwareBack();
    expect(appMock.App.minimizeApp).toHaveBeenCalledTimes(1);
  });

  it('comes ahead of the review question and never shares a return with it', async () => {
    const user = userEvent.setup();
    reviewMock.shouldPromptReview.mockReturnValue(true);
    await launch();
    await playAndLeave(user);

    expect(metaDialog()).toBeInTheDocument();
    expect(reviewDialog()).not.toBeInTheDocument();
    expect(reviewMock.markReviewPromptShown).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: "Don't allow" }));
    await playAndLeave(user);

    expect(metaDialog()).not.toBeInTheDocument();
    expect(reviewDialog()).toBeInTheDocument();
  });

  it('is not asked in a language nobody has checked its text in', async () => {
    const user = userEvent.setup();
    reviewMock.shouldPromptReview.mockReturnValue(true);
    await launch('de');
    await playAndLeave(user);

    expect(screen.queryByRole('dialog', { name: /Meta/ })).not.toBeInTheDocument();
    expect(metaPlugin.setConsent).not.toHaveBeenCalled();
    // The pause is still a pause: the review question keeps its doorway.
    expect(reviewMock.markReviewPromptShown).toHaveBeenCalledTimes(1);
  });

  it('is asked in Japanese', async () => {
    const user = userEvent.setup();
    await launch('ja');
    await user.click(screen.getAllByRole('button', { name: /Sudoku|数独|ナンプレ/ })[0]!);
    await user.click(screen.getByRole('button', { name: 'All games' }));

    expect(
      await screen.findByRole('dialog', { name: 'このインストールを Meta に知らせますか?' }),
    ).toBeInTheDocument();
  });

  it('does not exist in a build without Meta', async () => {
    const user = userEvent.setup();
    metaPlugin.getState.mockResolvedValue({ available: false });
    await launch();
    await playAndLeave(user);

    expect(metaDialog()).not.toBeInTheDocument();
    expect(metaPlugin.setConsent).not.toHaveBeenCalled();
  });

  it('is not asked of a player who updated from an older version', async () => {
    const user = userEvent.setup();
    metaPlugin.getState.mockResolvedValue(
      freshInstall({ installedAt: Date.now() - 30 * 24 * HOUR }),
    );
    await launch();
    await playAndLeave(user);

    expect(metaDialog()).not.toBeInTheDocument();
  });

  it('is never asked on iOS or the web', async () => {
    for (const platform of ['ios', 'web']) {
      cleanup();
      resetMetaInstallForTesting();
      capacitorMock.platform = platform;
      const user = userEvent.setup();
      await launch();
      await playAndLeave(user);
      expect(metaDialog()).not.toBeInTheDocument();
    }
    expect(metaPlugin.getState).not.toHaveBeenCalled();
  });
});
