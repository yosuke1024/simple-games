/**
 * Pipe Link, mounted the way the shell mounts it (docs/PIPE_LINK_RULES.md):
 * the first run through Quick Rules, turning tiles and everything around it —
 * undo, hint, restart, the win — and what survives leaving, a relaunch, a
 * corrupt save, the background and a home-screen shortcut.
 *
 * Boards here are real generated ones. Today's daily is the usual stand-in:
 * the test builds the same session from the same date, so it knows the
 * answer without reading the screen for it.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import {
  createDailySession,
  createDifficultySession,
  localDateString,
  rotateCcw,
  turnTile,
  type PipeLinkSession,
} from '../game';
import { toPersisted } from '../storage/gamePersistence';
import { PN_STORAGE_KEYS, type Stats } from '../storage/schemas';
import { RESULT_ARM_MS } from './components/ResultOverlay';
import { PipeLinkRoot } from './PipeLinkRoot';

/**
 * A stand-in for the device store. The `kv` prop is a load-side seam only —
 * saves always go to Capacitor Preferences — so a test that reads back what
 * a save wrote has to stand behind both.
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

function renderGame(initial: Record<string, string> = {}) {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <PipeLinkRoot onExit={onExit} kv={createMemoryKV(initial)} />
    </SettingsProvider>,
  );
  return onExit;
}

/** Launches against the device store, the way a player's phone does. */
function launch(entry?: 'shortcut') {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      {entry === 'shortcut' ? (
        <PipeLinkRoot onExit={onExit} entry="shortcut" />
      ) : (
        <PipeLinkRoot onExit={onExit} />
      )}
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

const board = () => screen.getByRole('group', { name: /^Pipe Link board/ });
const tiles = () => within(board()).getAllByRole('button');
const tile = (cell: number) => tiles()[cell]!;
const today = () => localDateString(new Date());
const spoken = () =>
  document.querySelector('.game-screen p.visually-hidden[aria-live="polite"]')!.textContent;
const note = () => document.querySelector('.pn-note')!.textContent ?? '';

/** A tap, as a finger's ends: a plain click with a press count. */
const tap = (cell: number) => fireEvent.click(tile(cell), { detail: 1 });

/**
 * A saved record of `session` one clockwise tap short of solved — every tile
 * on its answer but one (not a straight, so the tap's direction matters) —
 * and that tile. Winning through the board's own tap without spending the
 * test's time on the dozens of taps a scrambled board takes (the session
 * tests prove a scramble can be turned all the way round).
 */
function oneTapFromSolved(session: PipeLinkSession): { record: string; cell: number } {
  const cell = session.board.types.findIndex((type) => type !== 'straight');
  const current = [...session.solution];
  current[cell] = rotateCcw(session.board.types[cell]!, session.solution[cell]!);
  return { record: JSON.stringify(toPersisted({ ...session, current }, 1)), cell };
}

const stored = <T,>(key: string): T | null =>
  JSON.parse(deviceStore.get(key) ?? 'null') as T | null;
const storedStats = () => stored<Stats>(PN_STORAGE_KEYS.stats);
const storedPlaySeconds = () => {
  const stats = storedStats();
  return stats === null
    ? 0
    : stats.easy.totalPlaySeconds +
        stats.medium.totalPlaySeconds +
        stats.hard.totalPlaySeconds +
        stats.daily.totalPlaySeconds;
};
const storedBoard = () =>
  stored<{ elapsedSeconds: number; hintCount: number; current: string }>(PN_STORAGE_KEYS.game);

afterEach(async () => {
  cleanup();
  // Unmounting saves (docs/GAME_LIFECYCLE.md「アンマウントで計上する」), and
  // saves are fire-and-forget: let them land before wiping the store.
  await act(async () => undefined);
  deviceStore.clear();
  vi.restoreAllMocks();
});

describe('first run (§9)', () => {
  it('shows three Quick Rules steps and starts an easy board right after', async () => {
    const user = userEvent.setup();
    renderGame();
    expect(await screen.findByText('Tap to turn')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Water flows')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Fill every pipe')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));
    expect(board()).toHaveAccessibleName('Pipe Link board, 5 by 5');
    expect(tiles()).toHaveLength(25);
    expect(screen.getByText('Easy')).toBeInTheDocument();
  });
});

describe('turning tiles (§3, §6)', () => {
  it('turns a tile on a tap, says what it did, and Undo takes it back', async () => {
    const user = userEvent.setup();
    renderGame({ [PN_STORAGE_KEYS.flags]: TUTORIAL_DONE });
    await user.click(await screen.findByRole('button', { name: /^Easy/ }));
    const before = tile(0).getAttribute('aria-label');
    const undoButton = screen.getByRole('button', { name: 'Undo' });
    expect(undoButton).toBeDisabled();
    tap(0);
    expect(tile(0).getAttribute('aria-label')).not.toBe(before);
    expect(spoken()).toMatch(/^Row 1, column 1: .*\. \d+ of 25 tiles lit\.$/);
    expect(undoButton).toBeEnabled();
    await user.click(undoButton);
    expect(tile(0).getAttribute('aria-label')).toBe(before);
    expect(undoButton).toBeDisabled();
  });

  it('undoes by Ctrl+Z too, once per press — a held key’s repeats do nothing', async () => {
    const user = userEvent.setup();
    renderGame({ [PN_STORAGE_KEYS.flags]: TUTORIAL_DONE });
    await user.click(await screen.findByRole('button', { name: /^Easy/ }));
    // Each tile's pipes, without its light — a neighbour's turn can change that.
    const pipes = () =>
      tiles().map((button) =>
        (button.getAttribute('aria-label') ?? '').replace(/, (not )?lit$/, ''),
      );
    const start = pipes();
    tap(1);
    tap(2);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, repeat: true });
    expect(pipes()[2]).toBe(start[2]);
    expect(pipes()[1]).not.toBe(start[1]);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(pipes()).toEqual(start);
  });

  it('brings the focus onto the board with an arrow pressed elsewhere', async () => {
    const user = userEvent.setup();
    renderGame({ [PN_STORAGE_KEYS.flags]: TUTORIAL_DONE });
    await user.click(await screen.findByRole('button', { name: /^Easy/ }));
    act(() => screen.getByRole('button', { name: 'Hint' }).focus());
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(tiles()).toContain(document.activeElement);
  });
});

describe('hints (§6)', () => {
  it('marks one tile and the way it should face, in marks and in words, and turns nothing', async () => {
    const user = userEvent.setup();
    deviceStore.set(PN_STORAGE_KEYS.flags, TUTORIAL_DONE);
    launch();
    await user.click(await screen.findByRole('button', { name: /Daily Challenge/ }));
    const truth = createDailySession(today());
    const labels = tiles().map((button) => button.getAttribute('aria-label'));
    await user.click(screen.getByRole('button', { name: 'Hint' }));
    const marked = tiles().filter((button) => button.classList.contains('pn-tile-hint'));
    expect(marked).toHaveLength(1);
    const cell = tiles().indexOf(marked[0]!);
    // The marked tile is off its answer, and the hint names the answer's way.
    expect(truth.current[cell]).not.toBe(truth.solution[cell]);
    expect(marked[0]).toHaveAccessibleName(/\. Hint: turn it to /);
    expect(note()).toContain('Turn the tile in the dotted ring');
    expect(note()).toMatch(/Marked: row \d, column \d\. Turn it to /);
    // Nothing turned.
    expect(
      tiles().map((button) => (button.getAttribute('aria-label') ?? '').split('. Hint')[0]),
    ).toEqual(labels);
    // The next move takes the mark away.
    tap(cell);
    expect(tiles().some((button) => button.classList.contains('pn-tile-hint'))).toBe(false);
    expect(note()).toBe('');
  });

  it('counts a hint once while the board has not changed; H asks as the button does', async () => {
    const user = userEvent.setup();
    deviceStore.set(PN_STORAGE_KEYS.flags, TUTORIAL_DONE);
    launch();
    await user.click(await screen.findByRole('button', { name: /^Easy/ }));
    fireEvent.keyDown(window, { key: 'h' });
    fireEvent.keyDown(window, { key: 'h', repeat: true });
    await user.click(screen.getByRole('button', { name: 'Hint' }));
    await settle();
    expect(storedBoard()?.hintCount).toBe(1);
    // A move, then another hint: counted.
    tap(0);
    fireEvent.keyDown(window, { key: 'H' });
    await settle();
    expect(storedBoard()?.hintCount).toBe(2);
  });
});

describe('the win (§2, §8)', () => {
  it('solves the daily by its answer, says so once with the facts, and offers no other board', async () => {
    const user = userEvent.setup();
    const { record, cell } = oneTapFromSolved(createDailySession(today()));
    renderGame({ [PN_STORAGE_KEYS.flags]: TUTORIAL_DONE, [PN_STORAGE_KEYS.dailyGame]: record });
    await user.click(await screen.findByRole('button', { name: /Daily Challenge.*Resume/ }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    tap(cell);
    const card = await screen.findByRole('alertdialog', { name: 'Every tile is lit' });
    expect(within(card).getByText('Water reaches all 49 tiles.')).toBeInTheDocument();
    expect(within(card).getByText('7×7')).toBeInTheDocument();
    expect(within(card).getByText('Hints used')).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'New board' })).not.toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Retry same board' })).toBeInTheDocument();
    // No praise on the card (docs/PRODUCT_PRINCIPLES.md).
    expect(card.textContent ?? '').not.toMatch(/nice|great|well done|amazing|perfect|!/i);
    // The board behind it answers nothing now.
    expect(document.querySelector('.game-content')).toHaveAttribute('inert');
  });

  it('keeps a difficulty win’s card offering a new board, and books the clear', async () => {
    const user = userEvent.setup();
    const { record, cell } = oneTapFromSolved(createDifficultySession('easy', 'pipe-link-win'));
    deviceStore.set(PN_STORAGE_KEYS.flags, TUTORIAL_DONE);
    deviceStore.set(PN_STORAGE_KEYS.game, record);
    launch();
    await user.click(await screen.findByRole('button', { name: /Easy.*Resume/ }));
    tap(cell);
    const card = await screen.findByRole('alertdialog', { name: 'Every tile is lit' });
    expect(within(card).getByRole('button', { name: 'New board' })).toBeInTheDocument();
    await settle();
    // A resume is not a new play; the clear is booked once.
    expect(storedStats()?.easy).toMatchObject({ played: 0, solved: 1 });
    // A solved board is history: the slot is cleared, not left to resume.
    expect(deviceStore.has(PN_STORAGE_KEYS.game)).toBe(false);
  });
  it('keeps the card up through a quick tap and a held Enter meant for the board (§3)', async () => {
    const { record, cell } = oneTapFromSolved(createDifficultySession('easy', 'pipe-link-arm'));
    renderGame({ [PN_STORAGE_KEYS.flags]: TUTORIAL_DONE, [PN_STORAGE_KEYS.game]: record });
    fireEvent.click(await screen.findByRole('button', { name: /Easy.*Resume/ }));
    tap(cell);
    const card = await screen.findByRole('alertdialog', { name: 'Every tile is lit' });
    const retry = within(card).getByRole('button', { name: 'Retry same board' });
    // Under Reduced Motion (jsdom has no matchMedia) the card is up at once.
    fireEvent.click(retry, { detail: 1 });
    expect(fireEvent.keyDown(retry, { key: 'Enter', repeat: true })).toBe(false);
    expect(screen.getByRole('alertdialog', { name: 'Every tile is lit' })).toBeInTheDocument();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, RESULT_ARM_MS + 50));
    });
    fireEvent.click(retry, { detail: 1 });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(board()).toBeInTheDocument();
  });
});

describe('restart, new board and the home (§7, §8)', () => {
  it('puts the same board back to its starting orientations on Restart, after asking', async () => {
    const user = userEvent.setup();
    renderGame({ [PN_STORAGE_KEYS.flags]: TUTORIAL_DONE });
    await user.click(await screen.findByRole('button', { name: /^Easy/ }));
    const start = tiles().map((button) => button.getAttribute('aria-label'));
    tap(3);
    tap(4);
    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Start over?' });
    expect(within(dialog).getByRole('button', { name: 'New board' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Retry same board' }));
    expect(tiles().map((button) => button.getAttribute('aria-label'))).toEqual(start);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('answers no key while the ↻ question is open, and Escape is its Cancel', async () => {
    const user = userEvent.setup();
    renderGame({ [PN_STORAGE_KEYS.flags]: TUTORIAL_DONE });
    await user.click(await screen.findByRole('button', { name: /^Easy/ }));
    tap(0);
    const labels = tiles().map((button) => button.getAttribute('aria-label'));
    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'h' });
    expect(document.querySelector('.game-content')).toHaveAttribute('inert');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(tiles().map((button) => button.getAttribute('aria-label'))).toEqual(labels);
    expect(document.querySelector('.pn-tile-hint')).toBeNull();
  });

  it('offers only Restart for the daily (§8)', async () => {
    const user = userEvent.setup();
    renderGame({ [PN_STORAGE_KEYS.flags]: TUTORIAL_DONE });
    await user.click(await screen.findByRole('button', { name: /Daily Challenge/ }));
    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Start over?' });
    expect(within(dialog).queryByRole('button', { name: 'New board' })).not.toBeInTheDocument();
  });

  it('counts a new board and a restart as plays, and a resume as none (§8)', async () => {
    const user = userEvent.setup();
    deviceStore.set(PN_STORAGE_KEYS.flags, TUTORIAL_DONE);
    launch();
    await user.click(await screen.findByRole('button', { name: /^Easy/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: /Easy.*Resume/ }));
    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    await user.click(
      within(screen.getByRole('alertdialog', { name: 'Start over?' })).getByRole('button', {
        name: 'Retry same board',
      }),
    );
    await settle();
    expect(storedStats()?.easy.played).toBe(2);
    expect(storedStats()?.medium.played).toBe(0);
  });

  it('asks before replacing a suspended difficulty game with another difficulty', async () => {
    const user = userEvent.setup();
    renderGame({ [PN_STORAGE_KEYS.flags]: TUTORIAL_DONE });
    await user.click(await screen.findByRole('button', { name: /^Easy/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: /^Medium/ }));
    expect(
      screen.getByRole('alertdialog', { name: 'Replace the board in progress?' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: /Easy.*Resume/ })).toBeInTheDocument();
  });

  it('opens a saved board as it was left, from a record on disk', async () => {
    const user = userEvent.setup();
    const played = turnTile(createDifficultySession('hard', 'pipe-link-hard-root'), 9, 'cw')!;
    renderGame({
      [PN_STORAGE_KEYS.flags]: TUTORIAL_DONE,
      [PN_STORAGE_KEYS.game]: JSON.stringify(toPersisted(played, 1)),
    });
    await user.click(await screen.findByRole('button', { name: /Hard.*Resume/ }));
    expect(board()).toHaveAccessibleName('Pipe Link board, 8 by 8');
    expect(tiles()).toHaveLength(64);
    // No undo history survives a save (§6).
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('lands on the home over a corrupt save, and starts nothing in its place', async () => {
    const record = toPersisted(createDifficultySession('easy', 'pipe-link-easy-root'), 1);
    renderGame({
      [PN_STORAGE_KEYS.flags]: TUTORIAL_DONE,
      [PN_STORAGE_KEYS.game]: JSON.stringify({ ...record, source: 99 }),
    });
    expect(await screen.findByRole('button', { name: /^Easy/ })).toHaveTextContent('5×5');
    expect(screen.queryByRole('group', { name: /^Pipe Link board/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Resume')).not.toBeInTheDocument();
  });

  it('shows no clock while playing, and hands control back to the collection', async () => {
    const user = userEvent.setup();
    const onExit = renderGame({ [PN_STORAGE_KEYS.flags]: TUTORIAL_DONE });
    await user.click(await screen.findByRole('button', { name: /^Easy/ }));
    expect(document.querySelector('.game-screen')!.textContent).not.toMatch(/\d+:\d\d/);
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalled();
  });

  it('reports per-difficulty facts, the daily’s days and the total, and no streak (§8)', async () => {
    const user = userEvent.setup();
    renderGame({ [PN_STORAGE_KEYS.flags]: TUTORIAL_DONE });
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));
    expect(screen.getAllByText('Boards solved')).toHaveLength(3);
    expect(screen.getByText('Days cleared')).toBeInTheDocument();
    expect(screen.getByText('All modes')).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toMatch(/streak/i);
  });
});

describe('backgrounding and leaving (§7, docs/GAME_LIFECYCLE.md「アンマウントで計上する」)', () => {
  it('books play time before the app can be killed, and never twice', async () => {
    deviceStore.set(PN_STORAGE_KEYS.flags, TUTORIAL_DONE);
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
      fireEvent.click(screen.getByRole('button', { name: /Easy.*Resume/ }));
      act(() => vi.advanceTimersByTime(3_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not run the clock or turn a tile on its own while hidden or after', async () => {
    deviceStore.set(PN_STORAGE_KEYS.flags, TUTORIAL_DONE);
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /^Easy/ }));
      const labels = tiles().map((button) => button.getAttribute('aria-label'));
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      act(() => vi.advanceTimersByTime(60_000));
      Reflect.deleteProperty(document, 'visibilityState');
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      act(() => vi.advanceTimersByTime(2_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(2);
      expect(tiles().map((button) => button.getAttribute('aria-label'))).toEqual(labels);
    } finally {
      vi.useRealTimers();
    }
  });

  it('books the seconds since the last sync on unmount, once, and not again on remount', async () => {
    deviceStore.set(PN_STORAGE_KEYS.flags, TUTORIAL_DONE);
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /^Easy/ }));
      act(() => vi.advanceTimersByTime(5_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(5);

      act(() => vi.advanceTimersByTime(3_000));
      cleanup();
      await settle();
      expect(storedPlaySeconds()).toBe(8);
      expect(storedBoard()?.elapsedSeconds).toBe(8);

      launch();
      await settle();
      cleanup();
      await settle();
      expect(storedPlaySeconds()).toBe(8);
      expect(storedBoard()?.elapsedSeconds).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });

  it('books the board a ↻ replaces once, and the unmount after it only what came later', async () => {
    deviceStore.set(PN_STORAGE_KEYS.flags, TUTORIAL_DONE);
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /^Easy/ }));
      act(() => vi.advanceTimersByTime(4_000));
      fireEvent.click(screen.getByRole('button', { name: 'Retry same board' }));
      fireEvent.click(
        within(screen.getByRole('alertdialog', { name: 'Start over?' })).getByRole('button', {
          name: 'Retry same board',
        }),
      );
      await settle();
      expect(storedPlaySeconds()).toBe(4);
      expect(storedBoard()?.elapsedSeconds).toBe(0);

      act(() => vi.advanceTimersByTime(2_000));
      fireEvent.click(screen.getByRole('button', { name: 'Retry same board' }));
      fireEvent.click(
        within(screen.getByRole('alertdialog', { name: 'Start over?' })).getByRole('button', {
          name: 'New board',
        }),
      );
      await settle();
      expect(storedPlaySeconds()).toBe(6);

      act(() => vi.advanceTimersByTime(1_000));
      cleanup();
      await settle();
      expect(storedPlaySeconds()).toBe(7);
      expect(storedBoard()?.elapsedSeconds).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('a home-screen shortcut', () => {
  it('opens the one suspended game straight onto its board', async () => {
    const user = userEvent.setup();
    deviceStore.set(PN_STORAGE_KEYS.flags, TUTORIAL_DONE);
    launch();
    await settle();
    await user.click(await screen.findByRole('button', { name: /Daily Challenge/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    cleanup();

    launch('shortcut');
    await settle();
    expect(board()).toHaveAccessibleName('Pipe Link board, 7 by 7');
    expect(screen.getByText('Daily')).toBeInTheDocument();
  });

  it('opens the home screen when two games are suspended, rather than guessing', async () => {
    const user = userEvent.setup();
    deviceStore.set(PN_STORAGE_KEYS.flags, TUTORIAL_DONE);
    launch();
    await settle();
    await user.click(await screen.findByRole('button', { name: /^Easy/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    cleanup();

    launch('shortcut');
    await settle();
    expect(screen.queryByRole('group', { name: /^Pipe Link board/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Easy.*Resume/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge.*Resume/ })).toBeInTheDocument();
  });

  it('teaches the game first on a launch that has never seen it (§9)', async () => {
    launch('shortcut');
    expect(await screen.findByText('Tap to turn')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /^Pipe Link board/ })).not.toBeInTheDocument();
  });
});
