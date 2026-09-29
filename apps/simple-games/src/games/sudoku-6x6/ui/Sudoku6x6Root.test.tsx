/**
 * The game as a player meets it (docs/SUDOKU_6X6_RULES.md §2–§5, §9–§12):
 * three steps of Quick Rules and straight into a board, digits and notes from
 * the pad and the keyboard, an undo that takes back moves, a hint that
 * explains without playing, a solve that says so once — and neither a clock
 * nor a streak anywhere on the screen.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { S6_STORAGE_KEYS, type Stats } from '../storage/schemas';
import { Sudoku6x6Root } from './Sudoku6x6Root';

/**
 * A stand-in for the device store. The `kv` prop is a load-side seam only —
 * saves always go to Capacitor Preferences — so a test that reads back what a
 * save wrote has to stand behind both.
 */
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

const TUTORIAL_DONE = JSON.stringify({ schemaVersion: 1, tutorialCompleted: true });
const tutorialDone = { [S6_STORAGE_KEYS.flags]: TUTORIAL_DONE };

function renderGame(initial: Record<string, string> = {}) {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <Sudoku6x6Root onExit={onExit} kv={createMemoryKV(initial)} />
    </SettingsProvider>,
  );
  return { onExit };
}

/** Launches against the device store, the way a player's phone does. */
function launch(onExit: () => void = vi.fn()) {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <Sudoku6x6Root onExit={onExit} />
    </SettingsProvider>,
  );
  return onExit;
}

/** The same store, entered by the other door (issue #113). */
function launchFromShortcut(onExit: () => void = vi.fn()) {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <Sudoku6x6Root onExit={onExit} entry="shortcut" />
    </SettingsProvider>,
  );
  return onExit;
}

/** Lets the local reads and the saves they trigger resolve. */
const settle = () => act(async () => undefined);

/** The app goes to background. Android may kill it without another event. */
function background() {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  Reflect.deleteProperty(document, 'visibilityState');
}

const grid = () => screen.getByRole('group', { name: 'Sudoku 6×6 grid' });
const gridOrNull = () => screen.queryByRole('group', { name: 'Sudoku 6×6 grid' });
const pad = () => screen.getByRole('group', { name: 'Number pad' });
const cells = () => within(grid()).getAllByRole('button');
const cellAt = (index: number) => cells()[index]!;
const padKey = (digit: number) =>
  within(pad()).getByRole('button', { name: new RegExp(`^(Note )?${digit}(,|$)`) });
const homeScreen = () => screen.queryByRole('button', { name: /Daily Challenge/ });

/** The board on screen as the game itself saved it (§11). */
function savedBoard(key: string = S6_STORAGE_KEYS.game): {
  givens: string;
  solution: string;
  entries: string;
} {
  return JSON.parse(deviceStore.get(key)!) as { givens: string; solution: string; entries: string };
}

/** Total play seconds as they survive on disk, across every difficulty. */
function storedPlaySeconds(): number {
  const raw = deviceStore.get(S6_STORAGE_KEYS.stats);
  if (raw === undefined) return 0;
  const stats = JSON.parse(raw) as Stats;
  return stats.easy.totalPlaySeconds + stats.medium.totalPlaySeconds + stats.hard.totalPlaySeconds;
}

/** Plays every empty cell's answer through the grid and the pad. */
function solveOnScreen(key?: string) {
  const { givens, solution } = savedBoard(key);
  for (let i = 0; i < 36; i++) {
    if (givens[i] !== '.') continue;
    fireEvent.click(cellAt(i));
    fireEvent.click(padKey(Number(solution[i])));
  }
}

/** The first empty cell of the board on screen, and its answer. */
function firstEmpty(): { index: number; answer: number; wrong: number } {
  const { givens, solution } = savedBoard();
  const index = [...givens].findIndex((character) => character === '.');
  const answer = Number(solution[index]);
  return { index, answer, wrong: (answer % 6) + 1 };
}

afterEach(() => {
  cleanup();
  deviceStore.clear();
  vi.restoreAllMocks();
});

describe('first run (§12)', () => {
  it('shows Quick Rules and starts an Easy board right after', async () => {
    const user = userEvent.setup();
    launch();
    expect(await screen.findByText('1-6, once each')).toBeInTheDocument();
    // The figure is a real 6×6 with one box filled.
    expect(document.querySelectorAll('.tutorial-example .s6-figure-cell')).toHaveLength(36);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Fill and note')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Stuck? Take a hint')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    expect(cells()).toHaveLength(36);
    expect(within(pad()).getAllByRole('button')).toHaveLength(6);
    expect(screen.getByText('Easy')).toBeInTheDocument();
    await settle();
    expect(JSON.parse(deviceStore.get(S6_STORAGE_KEYS.flags)!)).toMatchObject({
      tutorialCompleted: true,
    });
  });
});

describe('home (§9)', () => {
  it('offers three boards and the daily, no level list, and hands control back', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);
    expect(await screen.findByRole('button', { name: /^Easy/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Medium/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Hard/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge/ })).toBeInTheDocument();
    expect(screen.queryByText(/^Levels$/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('asks before replacing a suspended board with another difficulty (§11)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /^Easy/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByRole('button', { name: /^Easy.*Resume/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Hard/ }));
    expect(screen.getByText('Replace the board in progress?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(gridOrNull()).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Hard/ }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.getByText('Hard')).toBeInTheDocument();
    expect(gridOrNull()).toBeInTheDocument();
  });

  it('starts the daily at medium', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /Daily Challenge/ }));
    expect(screen.getByText('Daily')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });
});

describe('playing (§3, §4)', () => {
  it('places a digit, keeps a wrong one and marks it, and undoes it', async () => {
    deviceStore.set(S6_STORAGE_KEYS.flags, TUTORIAL_DONE);
    launch();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: /^Easy/ }));
    await settle();
    const { index, wrong } = firstEmpty();

    fireEvent.click(cellAt(index));
    fireEvent.click(padKey(wrong));
    expect(cellAt(index)).toHaveTextContent(String(wrong));
    // Mistakes are shown by default (§4), as colour and a ring.
    expect(cellAt(index).className).toContain('s6-cell-conflict');

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(cellAt(index)).toHaveAccessibleName(/^Empty/);
  });

  it('does not mark a wrong digit when the setting is off, unless it repeats (§4)', async () => {
    renderGame({
      ...tutorialDone,
      [S6_STORAGE_KEYS.prefs]: JSON.stringify({
        schemaVersion: 1,
        difficulty: 'easy',
        highlightMistakes: false,
      }),
    });
    fireEvent.click(await screen.findByRole('button', { name: /^Easy/ }));
    await settle();
    const { givens, solution } = savedBoard();
    // A wrong digit that repeats nothing in its row, column or box.
    for (let i = 0; i < 36; i++) {
      if (givens[i] !== '.') continue;
      for (let digit = 1; digit <= 6; digit++) {
        if (digit === Number(solution[i])) continue;
        fireEvent.click(cellAt(i));
        fireEvent.click(padKey(digit));
        if (!cellAt(i).className.includes('s6-cell-conflict')) {
          expect(cellAt(i)).toHaveTextContent(String(digit));
          return;
        }
        fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      }
    }
    throw new Error('no silent wrong digit found on this board');
  });

  it('writes notes in notes mode and clears them where a digit lands', async () => {
    renderGame(tutorialDone);
    fireEvent.click(await screen.findByRole('button', { name: /^Easy/ }));
    await settle();
    const { index, answer } = firstEmpty();

    fireEvent.click(screen.getByRole('button', { name: 'Notes' }));
    fireEvent.click(cellAt(index));
    fireEvent.click(padKey(answer));
    expect(cellAt(index).querySelector('.s6-notes')).toHaveTextContent(String(answer));

    fireEvent.click(screen.getByRole('button', { name: 'Notes' }));
    fireEvent.click(padKey(answer));
    expect(cellAt(index).querySelector('.s6-notes')).toBeNull();
    expect(cellAt(index)).toHaveAccessibleName(new RegExp(`^${answer}, row`));

    fireEvent.click(screen.getByRole('button', { name: 'Erase' }));
    expect(cellAt(index)).toHaveAccessibleName(/^Empty/);
  });

  it('answers the keyboard: arrows, digits, 0 to erase, N for notes (§3)', async () => {
    renderGame(tutorialDone);
    fireEvent.click(await screen.findByRole('button', { name: /^Easy/ }));
    await settle();
    const { givens } = savedBoard();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    // The first arrow lands on row 3, column 3.
    expect(cellAt(14)).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(cellAt(15)).toHaveAttribute('aria-pressed', 'true');

    const empty = [...givens].findIndex((character) => character === '.');
    fireEvent.click(cellAt(empty));
    fireEvent.keyDown(window, { key: '4' });
    expect(cellAt(empty)).toHaveTextContent('4');
    // A held key's repeats do not type again, and 7 is not a digit here.
    fireEvent.keyDown(window, { key: '5', repeat: true });
    fireEvent.keyDown(window, { key: '7' });
    expect(cellAt(empty)).toHaveTextContent('4');
    fireEvent.keyDown(window, { key: '0' });
    expect(cellAt(empty)).toHaveAccessibleName(/^Empty/);
    fireEvent.keyDown(window, { key: 'n' });
    expect(screen.getByRole('button', { name: 'Notes' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('solves the board and says so once, with a new board first (§2, §9)', async () => {
    deviceStore.set(S6_STORAGE_KEYS.flags, TUTORIAL_DONE);
    launch();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: /^Easy/ }));
    await settle();
    const { index, wrong } = firstEmpty();
    fireEvent.click(cellAt(index));
    fireEvent.click(padKey(wrong));
    solveOnScreen();

    const dialog = screen.getByRole('alertdialog', { name: 'Solved!' });
    const buttons = within(dialog).getAllByRole('button');
    expect(buttons[0]).toHaveTextContent('New board');
    expect(within(dialog).getByText('Mistakes').nextSibling).toHaveTextContent('1');
    await settle();
    expect(deviceStore.get(S6_STORAGE_KEYS.game)).toBeUndefined();
    const stats = JSON.parse(deviceStore.get(S6_STORAGE_KEYS.stats)!) as Stats;
    expect(stats.easy).toMatchObject({ played: 1, solved: 1 });

    fireEvent.click(within(dialog).getByRole('button', { name: 'New board' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(cells().some((cell) => /^Empty/.test(cell.getAttribute('aria-label') ?? ''))).toBe(true);
  });

  it('restarts the same board from a clean slate after asking', async () => {
    const user = userEvent.setup();
    deviceStore.set(S6_STORAGE_KEYS.flags, TUTORIAL_DONE);
    launch();
    await settle();
    await user.click(screen.getByRole('button', { name: /^Easy/ }));
    await settle();
    const before = savedBoard().givens;
    const { index, answer } = firstEmpty();
    fireEvent.click(cellAt(index));
    fireEvent.click(padKey(answer));

    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await settle();
    expect(savedBoard().givens).toBe(before);
    expect(cellAt(index)).toHaveAccessibleName(/^Empty/);
  });

  it('keeps a suspended board, entries and all, across a relaunch (§11)', async () => {
    deviceStore.set(S6_STORAGE_KEYS.flags, TUTORIAL_DONE);
    launch();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: /^Medium/ }));
    await settle();
    const { index, answer } = firstEmpty();
    fireEvent.click(cellAt(index));
    fireEvent.click(padKey(answer));
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    cleanup();

    launch();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: /^Medium.*Resume/ }));
    expect(cellAt(index)).toHaveAccessibleName(new RegExp(`^${answer}, row`));
    // Undo history is not saved (§4, §11).
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});

describe('hints (§5)', () => {
  it('explains the next step in a sentence and never writes a digit', async () => {
    renderGame(tutorialDone);
    fireEvent.click(await screen.findByRole('button', { name: /^Easy/ }));
    await settle();
    const before = cells().map((cell) => cell.getAttribute('aria-label'));

    fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      /Only one digit fits this cell|This is the only place \d can go here/,
    );
    expect(screen.getByRole('status')).not.toHaveTextContent(/single|naked|hidden/i);
    expect(document.querySelectorAll('.s6-cell-hint-target')).toHaveLength(1);
    expect(cells().map((cell) => cell.getAttribute('aria-label'))).toEqual(before);
  });

  it('H asks for the hint, and does nothing while the Retry dialog is open', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /^Easy/ }));
    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    fireEvent.keyDown(window, { key: 'h' });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(window, { key: 'h' });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

describe('backgrounding (§11)', () => {
  it('books play time before the app can be killed, and never twice', async () => {
    deviceStore.set(S6_STORAGE_KEYS.flags, TUTORIAL_DONE);
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /^Easy/ }));
      act(() => vi.advanceTimersByTime(5_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(5);

      cleanup();
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /^Easy/ }));
      act(() => vi.advanceTimersByTime(3_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(8);

      // Opened and left without resuming: nothing more is booked.
      cleanup();
      launch();
      await settle();
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * A pinned home-screen shortcut (issue #113). The shell says only which door
 * was used; every decision below is this game's, from its own two slots.
 */
describe('a home-screen shortcut', () => {
  async function suspendEasy() {
    launch();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: /^Easy/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    cleanup();
  }

  it('opens the one suspended game straight onto its board, and leaves to this game’s home', async () => {
    deviceStore.set(S6_STORAGE_KEYS.flags, TUTORIAL_DONE);
    await suspendEasy();

    const onExit = launchFromShortcut();
    await settle();
    expect(gridOrNull()).toBeInTheDocument();
    expect(screen.getByText('Easy')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(homeScreen()).toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();
  });

  it('opens the home screen when both slots are suspended, rather than guessing', async () => {
    deviceStore.set(S6_STORAGE_KEYS.flags, TUTORIAL_DONE);
    launch();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: /^Easy/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    fireEvent.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    cleanup();

    launchFromShortcut();
    await settle();
    expect(gridOrNull()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Easy.*Resume/ })).toBeInTheDocument();
  });

  it('opens the home screen when nothing is suspended, and teaches first on a first launch', async () => {
    launchFromShortcut();
    expect(await screen.findByText('1-6, once each')).toBeInTheDocument();
    expect(gridOrNull()).not.toBeInTheDocument();
    cleanup();

    deviceStore.set(S6_STORAGE_KEYS.flags, TUTORIAL_DONE);
    launchFromShortcut();
    await settle();
    expect(gridOrNull()).not.toBeInTheDocument();
    expect(homeScreen()).toBeInTheDocument();
  });
});

describe('what this game deliberately does not have (§10, §14)', () => {
  it('shows no clock and no streak while playing, and none in the statistics', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /^Easy/ }));
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: /Statistics/ }));
    expect(screen.getByText('Days solved')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});
