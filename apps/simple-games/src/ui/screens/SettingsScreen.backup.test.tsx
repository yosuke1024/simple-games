/**
 * Backup & Restore on the settings screen (issue #160).
 *
 * The layer underneath is tested on its own terms (src/backup/); what is
 * checked here is the promise the SCREEN makes. That a restore is never
 * applied without being read first and confirmed once. That a file it will not
 * take produces a sentence saying which of the three things went wrong, rather
 * than a shrug. That what the player is looking at afterwards is what is
 * actually stored.
 *
 * Only the platform plumbing is mocked — the file the OS hands over, and where
 * an exported one goes. Everything between those two points is the real
 * export, the real validation and the real store, because a test that mocked
 * those would be testing this file's own idea of them.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { capacitorMock } = vi.hoisted(() => ({ capacitorMock: { native: false } }));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => capacitorMock.native,
    getPlatform: () => (capacitorMock.native ? 'android' : 'web'),
  },
}));
vi.mock('../openExternal', () => ({ openExternal: vi.fn() }));
vi.mock('../../backup/file', () => ({
  currentPlatform: vi.fn(() => 'web'),
  saveBackupFile: vi.fn(),
  pickBackupFile: vi.fn(),
}));

import { getFavoriteGames, resetFavoriteGamesForTesting } from '../../app/favoriteGames';
import { resetRecentGamesForTesting } from '../../app/recentGames';
import { resetAdRemovalForTesting } from '../../monetization/adRemoval';
import { pickBackupFile, saveBackupFile } from '../../backup/file';
import { SettingsProvider } from '../../state/SettingsContext';
import { loadRaw, saveRaw } from '../../storage/repo';
import { settingsSchema, STORAGE_KEYS } from '../../storage/schemas';
import { SettingsScreen } from './SettingsScreen';

const SUDOKU_PROGRESS = 'sd.progress';

const backupText = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    formatVersion: 1,
    createdAt: '2026-09-08T09:30:00.000Z',
    appVersion: '1.2.2',
    platform: 'ios',
    data: {},
    ...over,
  });

/** What the OS picker hands back — only the two things the reader touches. */
function pickedFile(text: string): File {
  return { size: text.length, text: () => Promise.resolve(text) } as unknown as File;
}

function renderSettings() {
  return render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <SettingsScreen onBack={() => undefined} />
    </SettingsProvider>,
  );
}

const exportButton = () => screen.getByRole('button', { name: 'Export Backup' });
const restoreButton = () => screen.getByRole('button', { name: 'Restore Backup' });
const dialog = () => screen.getByRole('alertdialog');

beforeEach(() => {
  capacitorMock.native = false;
  localStorage.clear();
  resetRecentGamesForTesting();
  resetFavoriteGamesForTesting();
  vi.mocked(saveBackupFile).mockResolvedValue(true);
  vi.mocked(pickBackupFile).mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  resetAdRemovalForTesting();
  vi.clearAllMocks();
});

describe('what the section says', () => {
  it('says what a backup is for, and that nothing is uploaded', () => {
    renderSettings();
    expect(screen.getByText(/Move your progress to another device/)).toBeInTheDocument();
    expect(screen.getByText(/never uploads it/)).toBeInTheDocument();
  });

  /**
   * docs/ADS_POLICY.md: the entitlement is not in the file. Said out loud
   * where a purchase exists to be misunderstood, and nowhere else — the web
   * build sells nothing, so the sentence would be about nothing.
   */
  it('warns that the purchase does not travel, on the build that has one', () => {
    capacitorMock.native = true;
    renderSettings();
    expect(screen.getByText(/ad-removal purchase is not part of the backup/)).toBeInTheDocument();
  });

  it('says nothing about purchases on the web build', () => {
    renderSettings();
    expect(screen.queryByText(/ad-removal purchase/)).not.toBeInTheDocument();
  });
});

describe('exporting', () => {
  it('hands the platform a dated file holding what is stored', async () => {
    await saveRaw(SUDOKU_PROGRESS, JSON.stringify({ schemaVersion: 2, highestUnlocked: 9 }));

    const user = userEvent.setup();
    renderSettings();
    await user.click(exportButton());

    await waitFor(() => expect(saveBackupFile).toHaveBeenCalled());
    const [fileName, text] = vi.mocked(saveBackupFile).mock.calls[0] ?? [];
    expect(fileName).toMatch(/^simple-games-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(text).toContain(SUDOKU_PROGRESS);
    expect(text).toContain('"highestUnlocked": 9');
  });

  it('never puts the ad-removal entitlement in the file', async () => {
    await saveRaw(
      STORAGE_KEYS.iap,
      JSON.stringify({ schemaVersion: 1, adRemovalPurchased: true, purchasedAt: 1 }),
    );

    const user = userEvent.setup();
    renderSettings();
    await user.click(exportButton());

    await waitFor(() => expect(saveBackupFile).toHaveBeenCalled());
    const [, text] = vi.mocked(saveBackupFile).mock.calls[0] ?? [];
    expect(text).not.toContain('adRemovalPurchased');
  });

  it('says so when the file could not be written, and nothing when it could', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(exportButton());
    await waitFor(() => expect(saveBackupFile).toHaveBeenCalled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    vi.mocked(saveBackupFile).mockResolvedValue(false);
    await user.click(exportButton());
    expect(await screen.findByRole('status')).toHaveTextContent(
      'The backup file could not be created.',
    );
  });
});

describe('restoring', () => {
  it('asks once, naming the day the backup was taken, before it writes', async () => {
    await saveRaw(SUDOKU_PROGRESS, JSON.stringify({ schemaVersion: 2, highestUnlocked: 40 }));
    vi.mocked(pickBackupFile).mockResolvedValue(
      pickedFile(
        backupText({ data: { [SUDOKU_PROGRESS]: { schemaVersion: 2, highestUnlocked: 3 } } }),
      ),
    );

    const user = userEvent.setup();
    renderSettings();
    await user.click(restoreButton());

    const confirm = await screen.findByRole('alertdialog');
    expect(within(confirm).getByText(/September 8, 2026/)).toBeInTheDocument();
    // Read, validated, and still not applied.
    expect(await loadRaw(SUDOKU_PROGRESS)).toContain('"highestUnlocked":40');

    await user.click(within(confirm).getByRole('button', { name: 'Restore Backup' }));

    await waitFor(async () =>
      expect(await loadRaw(SUDOKU_PROGRESS)).toBe(
        '{"schemaVersion":2,"highestUnlocked":3,"bestTimes":{},"dailyTimes":{}}',
      ),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Your data was restored.');
  });

  it('changes nothing when the question is answered no', async () => {
    await saveRaw(SUDOKU_PROGRESS, JSON.stringify({ schemaVersion: 2, highestUnlocked: 40 }));
    vi.mocked(pickBackupFile).mockResolvedValue(pickedFile(backupText()));

    const user = userEvent.setup();
    renderSettings();
    await user.click(restoreButton());
    await user.click(within(dialog()).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await loadRaw(SUDOKU_PROGRESS)).toContain('"highestUnlocked":40');
  });

  /**
   * The restored shelf has to be on screen, not just in storage: a settings
   * screen still showing the old pins after a restore is the button lying
   * about what it did — the same rule "Reset Local Data" is held to.
   */
  it('shows the restored pins immediately, not after a restart', async () => {
    vi.mocked(pickBackupFile).mockResolvedValue(
      pickedFile(
        backupText({
          data: { [STORAGE_KEYS.favorites]: { schemaVersion: 1, ids: ['sudoku', 'hearts'] } },
        }),
      ),
    );

    const user = userEvent.setup();
    renderSettings();
    await user.click(restoreButton());
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Restore Backup',
      }),
    );

    await waitFor(() => expect(getFavoriteGames()).toEqual(['sudoku', 'hearts']));
    expect(screen.getByRole('button', { name: /^Sudoku/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('does nothing at all when the picker is dismissed', async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(restoreButton());

    await waitFor(() => expect(pickBackupFile).toHaveBeenCalled());
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

/**
 * Three refusals, three different sentences. One "could not restore" would
 * leave somebody retrying the one thing that cannot work.
 */
describe('a file the screen will not take', () => {
  const refusals: readonly [string, string, string][] = [
    ['is not a backup at all', 'hello, this is a photo', 'That file is not a Simple Games backup.'],
    [
      'came from a newer version',
      backupText({ formatVersion: 2 }),
      'This backup was made by a newer version of Simple Games.',
    ],
    [
      'is a backup with a broken record inside',
      backupText({ data: { [SUDOKU_PROGRESS]: { schemaVersion: 2, highestUnlocked: 'lots' } } }),
      'This backup file is damaged.',
    ],
  ];

  for (const [what, text, message] of refusals) {
    it(`${what} → says so, asks nothing, writes nothing`, async () => {
      await saveRaw(SUDOKU_PROGRESS, JSON.stringify({ schemaVersion: 2, highestUnlocked: 40 }));
      vi.mocked(pickBackupFile).mockResolvedValue(pickedFile(text));

      const user = userEvent.setup();
      renderSettings();
      await user.click(restoreButton());

      expect(await screen.findByRole('status')).toHaveTextContent(message);
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(await loadRaw(SUDOKU_PROGRESS)).toContain('"highestUnlocked":40');
    });
  }
});
