/**
 * An invite link opening the installed app (Android App Links, iOS Universal Links;
 * 2026-10-24): on a cold start through the launch URL, on a warm one through
 * `appUrlOpen` — the same two doors a home-screen shortcut uses (App.shortcut.test.tsx).
 * The Club layer is a stand-in that shows the door it was opened through.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClubModule, ClubRootProps } from '../ui/clubBridge';

const { appMock } = vi.hoisted(() => {
  type Listener = (event: unknown) => void;
  const listeners = new Map<string, Set<Listener>>();
  const state = { launchUrl: undefined as string | undefined };
  return {
    appMock: {
      state,
      listeners,
      fire(name: string, event: unknown) {
        for (const listener of listeners.get(name) ?? []) listener(event);
      },
      App: {
        addListener: vi.fn((name: string, listener: Listener) => {
          if (!listeners.has(name)) listeners.set(name, new Set());
          listeners.get(name)!.add(listener);
          return Promise.resolve({ remove: () => listeners.get(name)?.delete(listener) });
        }),
        getLaunchUrl: vi.fn(() =>
          Promise.resolve(state.launchUrl ? { url: state.launchUrl } : undefined),
        ),
        minimizeApp: vi.fn(() => Promise.resolve()),
        exitApp: vi.fn(() => Promise.resolve()),
        getInfo: vi.fn(() => Promise.resolve({ version: '0.0.0' })),
      },
    },
  };
});

vi.mock('../ui/clubFeatures', () => ({
  PRIVATE_CLUBS_ENABLED: false,
  MANAGED_CLUB_ORIGIN: 'https://club.pixapps.ai',
}));

vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@capacitor/core')>();
  return {
    ...actual,
    Capacitor: { ...actual.Capacitor, isNativePlatform: () => true, getPlatform: () => 'android' },
  };
});

vi.mock('@capacitor/app', () => ({ App: appMock.App }));

import { SettingsProvider } from '../state/SettingsContext';
import { settingsSchema } from '../storage/schemas';
import { setClubLoaderForTesting } from './clubGate';
import { resetRecentGamesForTesting } from './recentGames';
import { initShortcutLaunch, resetShortcutLaunchForTesting } from './shortcutLaunch';
import { App } from './App';

const TOKEN = 'invite-token-0123456789';
const LINK = `https://club.pixapps.ai/join#club=c_family0001&invite=${TOKEN}`;

let mounts = 0;
function FakeClubRoot({ entry, invite, onBack }: ClubRootProps) {
  // Each mount is a fresh first screen (ClubRoot decides it once per mount).
  useEffect(() => {
    mounts += 1;
  }, []);
  return (
    <div>
      <p data-testid="club-entry">{entry}</p>
      <p data-testid="club-invite">{invite ? `${invite.endpoint} ${invite.token}` : 'none'}</p>
      <button type="button" onClick={onBack}>
        Leave club
      </button>
    </div>
  );
}

const fakeModule: ClubModule = {
  ClubRoot: FakeClubRoot,
  createBridge: () => ({ sendResult: () => Promise.resolve([]) }),
  loadConnections: () => Promise.resolve([]),
  inviteFromHref: () => null,
};

function renderShell() {
  return render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <App />
    </SettingsProvider>,
  );
}

const settle = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

beforeEach(() => {
  mounts = 0;
  appMock.state.launchUrl = undefined;
  appMock.listeners.clear();
  setClubLoaderForTesting(() => Promise.resolve(fakeModule));
  resetShortcutLaunchForTesting();
  resetRecentGamesForTesting();
});
afterEach(() => {
  cleanup();
  setClubLoaderForTesting(null);
});

describe('an invite link that opens the app', () => {
  it('opens the Join screen on a cold start', async () => {
    appMock.state.launchUrl = LINK;
    await initShortcutLaunch();
    renderShell();
    await settle();
    expect(await screen.findByTestId('club-entry')).toHaveTextContent('invite');
    expect(screen.getByTestId('club-invite')).toHaveTextContent(
      `https://club.pixapps.ai/clubs/c_family0001 ${TOKEN}`,
    );
  });

  it('opens the Join screen while the app is running', async () => {
    await initShortcutLaunch();
    renderShell();
    await screen.findByRole('heading', { name: 'Simple Games' });
    act(() => appMock.fire('appUrlOpen', { url: LINK }));
    await settle();
    expect(await screen.findByTestId('club-entry')).toHaveTextContent('invite');
    expect(screen.getByTestId('club-invite')).toHaveTextContent(TOKEN);
  });

  it('ignores the cold-start replay of the launch link, and reopens it afterwards', async () => {
    appMock.state.launchUrl = LINK;
    await initShortcutLaunch();
    renderShell();
    await settle();
    await screen.findByTestId('club-entry');
    expect(mounts).toBe(1);
    // The plugin raises the launch link once more: nothing new.
    act(() => appMock.fire('appUrlOpen', { url: LINK }));
    await settle();
    expect(mounts).toBe(1);
    // The person taps the same link again later (an approved request, say): a fresh door.
    act(() => appMock.fire('appUrlOpen', { url: LINK }));
    await settle();
    expect(mounts).toBe(2);
  });

  it('opens the launch link again after leaving it, even with no replay', async () => {
    appMock.state.launchUrl = LINK;
    await initShortcutLaunch();
    renderShell();
    await settle();
    await screen.findByTestId('club-entry');
    act(() => screen.getByRole('button', { name: 'Leave club' }).click());
    await screen.findByRole('heading', { name: 'Simple Games' });
    act(() => appMock.fire('appUrlOpen', { url: LINK }));
    await settle();
    expect(await screen.findByTestId('club-entry')).toHaveTextContent('invite');
  });

  it('leaves the collection as it is for a link that is not an invite', async () => {
    await initShortcutLaunch();
    renderShell();
    await screen.findByRole('heading', { name: 'Simple Games' });
    act(() => appMock.fire('appUrlOpen', { url: 'https://club.pixapps.ai/join' }));
    await settle();
    expect(screen.queryByTestId('club-entry')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Simple Games' })).toBeInTheDocument();
  });
});
