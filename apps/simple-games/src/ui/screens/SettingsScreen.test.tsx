/**
 * The settings screen says what the build actually does. Two platforms ship
 * from this source: the Android app shows one banner and sells its removal,
 * the web build (docs/WEB_VERSION.md) does neither. A claim that is true in
 * one of them is a false claim in the other, so it is gated, not translated.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { capacitorMock, openExternalMock } = vi.hoisted(() => ({
  capacitorMock: { native: false },
  openExternalMock: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => capacitorMock.native },
}));
vi.mock('../openExternal', () => ({ openExternal: openExternalMock }));

import { PRIVACY_URL, TERMS_URL } from '@simple-games/brand';
import {
  getRecentGames,
  initRecentGames,
  recordGameOpened,
  resetRecentGamesForTesting,
} from '../../app/recentGames';
import { setWebAdsConfigForTesting } from '../../services/ads/web/config';
import { SettingsProvider } from '../../state/SettingsContext';
import { createMemoryKV } from '../../storage/kv';
import { settingsSchema } from '../../storage/schemas';
import { SettingsScreen } from './SettingsScreen';

function renderSettings() {
  return render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <SettingsScreen onBack={() => undefined} />
    </SettingsProvider>,
  );
}

beforeEach(() => {
  capacitorMock.native = false;
  resetRecentGamesForTesting();
  openExternalMock.mockClear();
});

afterEach(() => {
  cleanup();
  setWebAdsConfigForTesting(null);
});

describe('ads and support section', () => {
  it('explains the banner and the one-time purchase on the app build', () => {
    capacitorMock.native = true;
    renderSettings();
    expect(screen.getByText(/small banner ad/)).toBeInTheDocument();
  });

  it('is absent on the web build, which has no banner and sells nothing', () => {
    renderSettings();
    expect(screen.queryByText(/small banner ad/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove Ads$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restore Purchase' })).not.toBeInTheDocument();
  });
});

/**
 * The privacy policy and terms are links to pixapps.ai, not bundled text
 * (2026-08-02, packages/brand PRIVACY_URL). These tests exist to keep the
 * single source single: the day someone re-adds a copy of the policy here,
 * there are two wordings to keep true again, and one of them will drift.
 */
describe('policy links', () => {
  it('opens the hosted pages rather than showing a copy', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: 'Privacy Policy' }));
    expect(openExternalMock).toHaveBeenLastCalledWith(PRIVACY_URL);

    await user.click(screen.getByRole('button', { name: 'Terms of Use' }));
    expect(openExternalMock).toHaveBeenLastCalledWith(TERMS_URL);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('carries no bundled policy text on either platform', () => {
    for (const native of [true, false]) {
      capacitorMock.native = native;
      const { unmount } = renderSettings();
      // Sentences the retired privacy1-5 / privacyWebAds keys used to render.
      expect(screen.queryByText(/No account/)).not.toBeInTheDocument();
      expect(screen.queryByText(/stored only on this device/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Google AdSense/)).not.toBeInTheDocument();
      unmount();
    }
  });

  /**
   * The two facts a player can still read with no connection — which is why
   * they were kept while the summary went. Both are needed by the screen for
   * their own reasons, so neither is a second copy of the policy.
   */
  it('still states offline what deleting does, and that ads and a purchase exist', async () => {
    capacitorMock.native = true;
    const user = userEvent.setup();
    renderSettings();
    expect(screen.getByText(/small banner ad/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset Local Data' }));
    expect(screen.getByText(/removes your game, statistics, and settings/)).toBeInTheDocument();
  });
});

/**
 * "Reset Local Data" has to be true the moment it finishes, not after the next
 * launch: every shared record the shell keeps in memory is reloaded, or the
 * deleted data is still on screen and the button has lied.
 */
describe('reset local data', () => {
  it('clears the home shortcut row, not just the stored copy', async () => {
    await initRecentGames(createMemoryKV());
    recordGameOpened('sudoku');
    expect(getRecentGames()).toEqual(['sudoku']);

    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole('button', { name: /Reset Local Data/ }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(getRecentGames()).toEqual([]));
  });
});
