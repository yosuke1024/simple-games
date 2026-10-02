/**
 * A Club House challenge, opened through the Root (docs/MINESWEEPER_RULES.md
 * §14, docs/architecture/club.md §6-2): the minefield the challenge names,
 * already opened on its first cell, refused when this version lays other
 * mines from the same inputs, and kept out of the statistics however it ends.
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { recordGameCompleted } from '@/services/review';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { boardDigestOf, createClubSession, encodeBoard } from '../game';
import { toPersisted } from '../storage/gamePersistence';
import { MS_STORAGE_KEYS } from '../storage/schemas';
import { MinesweeperRoot, type MinesweeperChallengeStart } from './MinesweeperRoot';

const { deviceStore } = vi.hoisted(() => ({ deviceStore: new Map<string, string>() }));
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: ({ key }: { key: string }) => Promise.resolve({ value: deviceStore.get(key) ?? null }),
    set: ({ key, value }: { key: string; value: string }) => {
      deviceStore.set(key, value);
      return Promise.resolve();
    },
    remove: ({ key }: { key: string }) => {
      deviceStore.delete(key);
      return Promise.resolve();
    },
  },
}));
vi.mock('@/services/review', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/review')>()),
  recordGameCompleted: vi.fn(),
}));

const SEED = 'mines-club-root-test';
const FIRST = 40;
const truth = createClubSession({ difficulty: 'easy', firstIndex: FIRST }, SEED);
const mines = [...encodeBoard(truth.board).mines].map((bit) => bit === '1');
const challenge: MinesweeperChallengeStart = {
  seed: SEED,
  params: { difficulty: 'easy', firstIndex: FIRST },
  boardDigest: boardDigestOf(truth),
};

const tutorialDone = {
  [MS_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

function open(initial: Record<string, string>, start: MinesweeperChallengeStart = challenge) {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <MinesweeperRoot onExit={onExit} kv={createMemoryKV(initial)} challenge={start} />
    </SettingsProvider>,
  );
  return { onExit };
}

const minefield = () => screen.queryByRole('group', { name: /^Minefield/ });
const cells = () => within(minefield()!).getAllByRole('button');
const MISMATCH = 'This challenge was made with a different version of the game.';

afterEach(() => {
  cleanup();
  deviceStore.clear();
  vi.mocked(recordGameCompleted).mockClear();
});

describe('a Club House challenge (§14)', () => {
  it('opens on the challenge’s first cell, already tapped', async () => {
    open(tutorialDone);
    expect(await screen.findByText(/Club House/)).toBeInTheDocument();
    expect(cells()[FIRST]!.getAttribute('aria-label')).not.toMatch(/^Unopened/);
    expect(deviceStore.has(MS_STORAGE_KEYS.stats)).toBe(false);
  });

  it('refuses a board this version lays differently, and goes back', async () => {
    const user = userEvent.setup();
    const { onExit } = open(tutorialDone, { ...challenge, boardDigest: 'ms1:00000000' });
    expect(await screen.findByText(MISMATCH)).toBeInTheDocument();
    expect(minefield()).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('refuses a first cell the board does not have', async () => {
    open(tutorialDone, { ...challenge, params: { difficulty: 'easy', firstIndex: 200 } });
    expect(await screen.findByText(MISMATCH)).toBeInTheDocument();
  });

  it('teaches the game first on a launch that has never seen it', async () => {
    const user = userEvent.setup();
    open({});
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));
    expect(screen.getByText(/Club House/)).toBeInTheDocument();
    expect(cells()[FIRST]!.getAttribute('aria-label')).not.toMatch(/^Unopened/);
  });

  it('keeps a lost challenge out of the statistics', async () => {
    const user = userEvent.setup();
    open(tutorialDone);
    await screen.findByText(/Club House/);
    await user.click(cells()[mines.indexOf(true)]!);
    expect(await screen.findByRole('alertdialog', { name: 'Mine opened' })).toBeInTheDocument();
    expect(deviceStore.has(MS_STORAGE_KEYS.stats)).toBe(false);
    expect(deviceStore.has(MS_STORAGE_KEYS.clubGame)).toBe(false);
  });

  it('keeps a cleared challenge out of statistics, bests and the review count', async () => {
    const user = userEvent.setup();
    // The same board, every safe cell open but one, as its slot would hold it.
    const last = mines.findIndex((mine, index) => !mine && !truth.board.opened[index]);
    const opened = mines.map((mine, index) => !mine && index !== last);
    const nearly = { ...truth, board: { ...truth.board, opened }, elapsedSeconds: 42 };
    const record = JSON.stringify(toPersisted(nearly, Date.now()));
    deviceStore.set(MS_STORAGE_KEYS.clubGame, record);
    open({ ...tutorialDone, [MS_STORAGE_KEYS.clubGame]: record });
    await screen.findByText(/Club House/);

    await user.click(cells()[last]!);
    const dialog = await screen.findByRole('alertdialog', { name: 'Cleared!' });
    expect(within(dialog).queryByText(/best/i)).not.toBeInTheDocument();
    expect(deviceStore.has(MS_STORAGE_KEYS.stats)).toBe(false);
    expect(deviceStore.has(MS_STORAGE_KEYS.clubGame)).toBe(false);
    expect(recordGameCompleted).not.toHaveBeenCalled();
  });

  it('goes back to where the challenge came from', async () => {
    const user = userEvent.setup();
    const { onExit } = open(tutorialDone);
    await screen.findByText(/Club House/);
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
