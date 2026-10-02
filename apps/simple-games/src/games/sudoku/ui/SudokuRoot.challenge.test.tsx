/**
 * A Club House challenge, opened through the Root (docs/SUDOKU_RULES.md §15,
 * docs/architecture/club.md §6-2): the board the challenge names, played in
 * its own slot, refused when this version builds another grid from the same
 * seed, and kept out of every personal record when it is solved.
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { recordGameCompleted } from '@/services/review';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import {
  boardDigestOf,
  CELLS,
  createClubSession,
  encodeBoard,
  encodeSolution,
  type Board,
} from '../game';
import { SD_STORAGE_KEYS } from '../storage/schemas';
import { SudokuRoot, type SudokuChallengeStart } from './SudokuRoot';

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

const SEED = 'sudoku-club-root-test';
const truth = createClubSession({ difficulty: 'easy' }, SEED);
const challenge: SudokuChallengeStart = {
  seed: SEED,
  params: { difficulty: 'easy' },
  boardDigest: boardDigestOf(truth),
};

const tutorialDone = {
  [SD_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

function open(initial: Record<string, string>, start: SudokuChallengeStart = challenge) {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <SudokuRoot onExit={onExit} kv={createMemoryKV(initial)} challenge={start} />
    </SettingsProvider>,
  );
  return { onExit };
}

/** The challenge's board, one digit short of solved, as its slot would hold it. */
function oneShort(): { record: string; lastIndex: number } {
  const lastIndex = truth.board.givens.findIndex((given) => given === 0);
  const entries = truth.board.givens.map((given, index) =>
    given === 0 && index !== lastIndex ? truth.solution[index]! : 0,
  );
  const board: Board = { givens: truth.board.givens, entries, notes: new Array(CELLS).fill(0) };
  const encoded = encodeBoard(board);
  const record = JSON.stringify({
    schemaVersion: 1,
    mode: 'club',
    seed: SEED,
    difficulty: 'easy',
    dailyDate: null,
    level: null,
    givens: encoded.givens,
    entries: encoded.entries,
    notes: encoded.notes,
    solution: encodeSolution(truth.solution),
    mistakeCount: 0,
    hintCount: 0,
    elapsedSeconds: 42,
    savedAt: Date.now(),
  });
  return { record, lastIndex };
}

const grid = () => screen.queryByRole('group', { name: 'Sudoku grid' });

afterEach(() => {
  cleanup();
  deviceStore.clear();
  vi.mocked(recordGameCompleted).mockClear();
});

describe('a Club House challenge (§15)', () => {
  it('opens straight onto the challenge’s board', async () => {
    open(tutorialDone);
    expect(await screen.findByText('Club House')).toBeInTheDocument();
    expect(screen.getByText('Easy')).toBeInTheDocument();
    const cells = within(grid()!).getAllByRole('button');
    const clues = truth.board.givens.filter((given) => given !== 0).length;
    expect(
      cells.filter((cell) => !cell.getAttribute('aria-label')?.startsWith('Empty')),
    ).toHaveLength(clues);
    // Starting a challenge is not a game started in the statistics.
    expect(deviceStore.has(SD_STORAGE_KEYS.stats)).toBe(false);
  });

  it('refuses a board this version builds differently, and goes back', async () => {
    const user = userEvent.setup();
    const { onExit } = open(tutorialDone, { ...challenge, boardDigest: 'sd1:00000000' });
    expect(
      await screen.findByText('This challenge was made with a different version of the game.'),
    ).toBeInTheDocument();
    expect(grid()).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('refuses params that are not this game’s', async () => {
    open(tutorialDone, { ...challenge, params: { difficulty: 'expert' } });
    expect(
      await screen.findByText('This challenge was made with a different version of the game.'),
    ).toBeInTheDocument();
    expect(grid()).not.toBeInTheDocument();
  });

  it('teaches the game first on a launch that has never seen it', async () => {
    const user = userEvent.setup();
    open({});
    expect(await screen.findByText('1-9, once each')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));
    // The rules lead to the challenge, not to level 1.
    expect(screen.getByText('Club House')).toBeInTheDocument();
    expect(screen.queryByText('Level 1')).not.toBeInTheDocument();
  });

  it('resumes only the same challenge from its slot', async () => {
    const { record } = oneShort();
    const other = JSON.stringify({ ...JSON.parse(record), seed: 'sudoku-club-another' });
    open({ ...tutorialDone, [SD_STORAGE_KEYS.clubGame]: other });
    await screen.findByText('Club House');
    // The suspended one was another challenge's: this one starts fresh.
    const filled = within(grid()!)
      .getAllByRole('button')
      .filter((cell) => !cell.getAttribute('aria-label')?.startsWith('Empty'));
    expect(filled).toHaveLength(truth.board.givens.filter((given) => given !== 0).length);
  });

  it('keeps a solved challenge out of statistics, progress and the review count', async () => {
    const user = userEvent.setup();
    const { record, lastIndex } = oneShort();
    deviceStore.set(SD_STORAGE_KEYS.clubGame, record);
    open({ ...tutorialDone, [SD_STORAGE_KEYS.clubGame]: record });
    await screen.findByText('Club House');

    const cells = within(grid()!).getAllByRole('button');
    await user.click(cells[lastIndex]!);
    const pad = screen.getByRole('group', { name: 'Number pad' });
    await user.click(within(pad).getAllByRole('button')[truth.solution[lastIndex]! - 1]!);

    const dialog = await screen.findByRole('alertdialog', { name: 'Solved!' });
    // The run's own facts, and no personal best to announce.
    expect(within(dialog).getByText('0:42')).toBeInTheDocument();
    expect(within(dialog).queryByText(/best/i)).not.toBeInTheDocument();
    expect(deviceStore.has(SD_STORAGE_KEYS.stats)).toBe(false);
    expect(deviceStore.has(SD_STORAGE_KEYS.progress)).toBe(false);
    expect(deviceStore.has(SD_STORAGE_KEYS.clubGame)).toBe(false);
    expect(recordGameCompleted).not.toHaveBeenCalled();
  });

  it('goes back to where the challenge came from', async () => {
    const user = userEvent.setup();
    const { onExit } = open(tutorialDone);
    await screen.findByText('Club House');
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
