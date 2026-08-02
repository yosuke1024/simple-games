/**
 * The settings screen says what the build actually does. Two platforms ship
 * from this source: the Android app shows one banner and sells its removal,
 * the web build (docs/WEB_VERSION.md) does neither. A claim that is true in
 * one of them is a false claim in the other, so it is gated, not translated.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { capacitorMock } = vi.hoisted(() => ({ capacitorMock: { native: false } }));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => capacitorMock.native },
}));

import {
  getRecentGames,
  initRecentGames,
  recordGameOpened,
  resetRecentGamesForTesting,
} from '../../app/recentGames';
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

async function openPrivacy(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Privacy Policy' }));
  return screen.getByRole('dialog', { name: 'Privacy Policy' });
}

beforeEach(() => {
  capacitorMock.native = false;
  resetRecentGamesForTesting();
});

afterEach(() => {
  cleanup();
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

describe('privacy summary', () => {
  it('names AdMob and the ad-removal purchase on the app build', async () => {
    capacitorMock.native = true;
    const user = userEvent.setup();
    renderSettings();
    const dialog = await openPrivacy(user);
    expect(dialog).toHaveTextContent(/AdMob/);
    expect(dialog).toHaveTextContent(/one-time purchase/);
  });

  it('claims neither on the web build, and still covers the rest', async () => {
    const user = userEvent.setup();
    renderSettings();
    const dialog = await openPrivacy(user);
    expect(dialog).not.toHaveTextContent(/AdMob/);
    expect(dialog).not.toHaveTextContent(/one-time purchase/);
    // The promises that hold everywhere are still stated.
    expect(dialog).toHaveTextContent(/No account/);
    expect(dialog).toHaveTextContent(/stored only on this device/);
  });

  it('explains deletion without naming an app the browser never installed', async () => {
    const user = userEvent.setup();
    renderSettings();
    const dialog = await openPrivacy(user);
    expect(dialog).not.toHaveTextContent(/Deleting the app/);
    // Deletion is still explained, using the reset action's own reviewed
    // description rather than new privacy wording nobody has translated.
    expect(dialog).toHaveTextContent(/Reset Local Data/);
    expect(dialog).toHaveTextContent(/removes your game, statistics, and settings/);
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
