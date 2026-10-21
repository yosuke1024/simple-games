/**
 * Make the Target, mounted the way the shell mounts it
 * (docs/MAKE_THE_TARGET_RULES.md): the first run through Quick Rules, the
 * number → operator → number taps and everything around them — Undo, the
 * `missed` panel, showing a solution, the win, ↻ — the keyboard, and what
 * survives leaving, a relaunch, a corrupt save, the background and a
 * home-screen shortcut.
 *
 * Problems here are either hand-built (ui/test-helpers.ts, put on the device
 * store as a saved game, so every move is known) or real generated ones — a
 * new problem, today's daily — read back from the record the game itself
 * saved when it dealt them. No test imports the generator (§5).
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sounds } from '@/services/sound';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { decodeMoves, localDateString, type Operator } from '../game';
import { TG_STORAGE_KEYS, type PersistedGame, type Stats } from '../storage/schemas';
import { MakeTheTargetRoot } from './MakeTheTargetRoot';
import { dailyGame, freeGame, MISS, play, storedRecord } from './test-helpers';

/**
 * A stand-in for the device store. The `kv` prop below is a load-side seam
 * only — saves always go to Capacitor Preferences — so a test that has to read
 * back what a save actually wrote has to stand behind both.
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

const FLAGS_DONE = JSON.stringify({ schemaVersion: 1, tutorialCompleted: true });
const tutorialDone = { [TG_STORAGE_KEYS.flags]: FLAGS_DONE };

function renderGame(initial: Record<string, string> = {}) {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <MakeTheTargetRoot onExit={onExit} kv={createMemoryKV(initial)} />
    </SettingsProvider>,
  );
  return { onExit };
}

/** Launches the app against the device store, the way a player's phone does. */
function launch(entry?: 'shortcut') {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      {entry === 'shortcut' ? (
        <MakeTheTargetRoot onExit={onExit} entry="shortcut" />
      ) : (
        <MakeTheTargetRoot onExit={onExit} />
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

const board = () => screen.getByRole('group', { name: 'Numbers' });
const queryBoard = () => screen.queryByRole('group', { name: 'Numbers' });
const tile = (slot: number) =>
  board().querySelector<HTMLButtonElement>(`button[data-slot="${slot}"]`);
const values = () =>
  [...board().querySelectorAll<HTMLButtonElement>('button[data-slot]')].map((b) => b.textContent);
const OP_NAMES: Record<Operator, string> = {
  '+': 'Add',
  '-': 'Subtract',
  '*': 'Multiply',
  '/': 'Divide',
};
const op = (sign: Operator) => screen.getByRole('button', { name: OP_NAMES[sign] });
const lines = () =>
  within(screen.getByRole('list', { name: 'Moves so far' }))
    .queryAllByRole('listitem')
    .map((item) => item.querySelector('[aria-hidden="true"]')!.textContent);
const spoken = () =>
  document.querySelector('.game-screen p.visually-hidden[aria-live="polite"]')!.textContent;
const today = () => localDateString(new Date());

/** Taps, in order: a number is a tile's slot, a sign an operator. */
function tap(...steps: (number | Operator)[]) {
  for (const step of steps) fireEvent.click(typeof step === 'number' ? tile(step)! : op(step));
}

/** Taps a stored move string (§10) — the kept solution of a problem the game dealt. */
function tapMoves(moves: string) {
  for (const move of decodeMoves(moves, 5)!) tap(move.left, move.op, move.right);
}

const stored = <T,>(key: string): T | null =>
  deviceStore.has(key) ? (JSON.parse(deviceStore.get(key)!) as T) : null;
const storedStats = () => stored<Stats>(TG_STORAGE_KEYS.stats);
const storedPlays = (bucket: 'easy' | 'medium' | 'hard' | 'daily') =>
  storedStats()?.[bucket].played ?? 0;
const storedPlaySeconds = () => {
  const stats = storedStats();
  if (stats === null) return 0;
  return (
    stats.easy.totalPlaySeconds +
    stats.medium.totalPlaySeconds +
    stats.hard.totalPlaySeconds +
    stats.daily.totalPlaySeconds
  );
};

/** A saved Free Play game on the hand-built problem, ready to resume from the home. */
const withFreeGame = (session = freeGame()) => ({
  ...tutorialDone,
  [TG_STORAGE_KEYS.game]: storedRecord(session),
});

async function resumeFree(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Resume/ }));
}

async function openDaily(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Daily Challenge/ }));
}

afterEach(async () => {
  cleanup();
  // Unmounting saves: the provider runs its leave sync on the way out
  // (docs/GAME_LIFECYCLE.md「アンマウントで計上する」), and saves are
  // fire-and-forget. Let them land before wiping the store.
  await act(async () => undefined);
  deviceStore.clear();
  vi.restoreAllMocks();
});

describe('first run (§11)', () => {
  it('shows three Quick Rules steps and starts an Easy problem right after', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Combine two')).toBeInTheDocument();
    expect(screen.getByText(/the first one you tap is on the left/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('A new number')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Match the target')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(values()).toHaveLength(4);
    await settle();
    expect(stored<{ tutorialCompleted: boolean }>(TG_STORAGE_KEYS.flags)?.tutorialCompleted).toBe(
      true,
    );
    expect(storedPlays('easy')).toBe(1);
    expect(stored<PersistedGame>(TG_STORAGE_KEYS.game)?.difficulty).toBe('easy');
  });

  it('resumes a suspended problem on Start Playing when only the flags were lost (§8)', async () => {
    const user = userEvent.setup();
    const session = play(freeGame('medium'), 0, '+', 1);
    renderGame({ [TG_STORAGE_KEYS.game]: storedRecord(session) });
    await screen.findByText('Combine two');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(values()).toEqual(['3', '3', '4']);
    await settle();
    // Resumed, not started: no play counted, nothing written over the slot.
    expect(storedPlays('easy') + storedPlays('medium')).toBe(0);
    expect(deviceStore.get(TG_STORAGE_KEYS.game)).toBeUndefined();
  });
});

describe('number, operator, number (§3)', () => {
  it('merges two tiles into the right term’s slot and writes the line under the board', async () => {
    const user = userEvent.setup();
    renderGame(withFreeGame());
    await resumeFree(user);
    expect(values()).toEqual(['1', '2', '3', '4']);
    expect(op('+')).toBeDisabled();

    tap(0);
    expect(tile(0)).toHaveAttribute('aria-pressed', 'true');
    expect(op('+')).toBeEnabled();
    tap('+');
    expect(op('+')).toHaveAttribute('aria-pressed', 'true');
    tap(1);

    // Slot 0 is empty and keeps its place; the answer stands in slot 1 (§1).
    expect(tile(0)).toBeNull();
    expect(tile(1)).toHaveTextContent('3');
    expect(values()).toEqual(['3', '3', '4']);
    expect(lines()).toEqual(['1 + 2 = 3']);
    expect(spoken()).toBe('1 plus 2 equals 3');
    // Nothing is chosen after a merge (§3).
    expect(board().querySelector('[aria-pressed="true"]')).toBeNull();
    expect(op('+')).toBeDisabled();
    await settle();
    expect(stored<PersistedGame>(TG_STORAGE_KEYS.game)?.moves).toBe('0+1');
  });

  it('moves, clears and swaps the choice as §3 says', async () => {
    const user = userEvent.setup();
    renderGame(withFreeGame());
    await resumeFree(user);

    tap(0);
    tap(0);
    expect(tile(0)).toHaveAttribute('aria-pressed', 'false');
    tap(0, 2);
    expect(tile(2)).toHaveAttribute('aria-pressed', 'true');
    expect(tile(0)).toHaveAttribute('aria-pressed', 'false');
    tap('*');
    tap('*');
    expect(op('*')).toHaveAttribute('aria-pressed', 'false');
    expect(tile(2)).toHaveAttribute('aria-pressed', 'true');
    tap('*', '-');
    expect(op('-')).toHaveAttribute('aria-pressed', 'true');
    expect(op('*')).toHaveAttribute('aria-pressed', 'false');
    // The first tile again clears it all.
    tap(2);
    expect(board().querySelector('[aria-pressed="true"]')).toBeNull();
    expect(op('-')).toBeDisabled();
  });

  it('refuses a merge the rules do not allow without a sound or a word, keeping the choice', async () => {
    const user = userEvent.setup();
    renderGame(withFreeGame());
    await resumeFree(user);
    const select = vi.spyOn(sounds, 'select');

    tap(0, '-');
    const before = select.mock.calls.length;
    tap(1); // 1 − 2 would be negative (§2)
    expect(values()).toEqual(['1', '2', '3', '4']);
    expect(tile(0)).toHaveAttribute('aria-pressed', 'true');
    expect(op('-')).toHaveAttribute('aria-pressed', 'true');
    expect(lines()).toEqual([]);
    expect(spoken()).toBe('');
    expect(select.mock.calls.length).toBe(before);

    // The other way round is legal: the direction is the order chosen.
    tap(0); // the chosen tile again clears the choice
    tap(1, '-', 0);
    expect(lines()).toEqual(['2 − 1 = 1']);
  });
});

describe('Undo (§5)', () => {
  it('takes back one move at a time, by button and by Ctrl+Z, and ignores a held Ctrl+Z', async () => {
    const user = userEvent.setup();
    renderGame(withFreeGame());
    await resumeFree(user);
    const undoSound = vi.spyOn(sounds, 'undo');
    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo).toBeDisabled();

    tap(0, '+', 1, 2, '*', 3);
    expect(values()).toEqual(['3', '12']);
    await user.click(undo);
    expect(values()).toEqual(['3', '3', '4']);
    expect(lines()).toEqual(['1 + 2 = 3']);
    expect(spoken()).toBe('Taken back: 3 times 4 equals 12');

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, repeat: true });
    expect(values()).toEqual(['3', '3', '4']);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(values()).toEqual(['1', '2', '3', '4']);
    expect(undo).toBeDisabled();
    expect(undoSound).toHaveBeenCalledTimes(2);
  });

  it('reaches back past a resume to the numbers as dealt (§5, §10)', async () => {
    const user = userEvent.setup();
    renderGame(withFreeGame(play(freeGame(), 0, '+', 1, 2, '+', 3)));
    await resumeFree(user);
    expect(lines()).toEqual(['1 + 2 = 3', '3 + 4 = 7']);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(values()).toEqual(['1', '2', '3', '4']);
  });
});

describe('the missed panel (§4)', () => {
  it('says what the last number is, gives Undo the focus and stands in for the operators', async () => {
    const user = userEvent.setup();
    renderGame(withFreeGame());
    await resumeFree(user);
    const select = vi.spyOn(sounds, 'select');
    const gameOver = vi.spyOn(sounds, 'gameOver');

    tap(...MISS.slice(0, 8));
    const before = select.mock.calls.length;
    tap(...MISS.slice(8));
    expect(screen.getByText('That makes 10, not 21.')).toBeInTheDocument();
    expect(spoken()).toBe('6 plus 4 equals 10. That makes 10, not 21.');
    expect(select.mock.calls.length).toBe(before);
    expect(gameOver).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'Operators' })).not.toBeInTheDocument();
    // One Undo on screen — the panel's, with the focus; the bar's is hidden (§3).
    const undos = screen.getAllByRole('button', { name: 'Undo' });
    expect(undos).toHaveLength(1);
    expect(undos[0]).toHaveFocus();
    // jsdom loads no CSS and Testing Library trusts `hidden` alone, so the
    // count above cannot see the shared `.action-btn { display: flex }`. The
    // bar's button carries what make-the-target.css hides for real
    // (`.tg-actions .action-btn[hidden]` — ui/makeTheTargetCss.test.ts).
    const barUndo = document.querySelector('.tg-actions > .action-btn');
    expect(barUndo).toHaveAttribute('hidden');
    expect(undos[0]).not.toBe(barUndo);
    expect(tile(3)).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Show a solution' })).toBeInTheDocument();
    await settle();
    // Still a game to come back to.
    expect(stored<PersistedGame>(TG_STORAGE_KEYS.game)?.moves).toBe('0+11+22+3');

    await user.click(undos[0]!);
    expect(screen.queryByText(/That makes/)).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Operators' })).toBeInTheDocument();
    expect(values()).toEqual(['6', '4']);
    // The board's tab stop takes the focus back from the panel that went away.
    expect(board().contains(document.activeElement)).toBe(true);
  });

  it('offers no solution in the daily: Undo only (§5, §8)', async () => {
    const user = userEvent.setup();
    renderGame({
      ...tutorialDone,
      [TG_STORAGE_KEYS.dailyGame]: storedRecord(play(dailyGame(today()), ...MISS)),
    });
    await user.click(await screen.findByRole('button', { name: /Daily Challenge.*Resume/ }));
    expect(screen.getByText('That makes 10, not 21.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show a solution' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus();
  });
});

describe('showing a solution (§5)', () => {
  it('asks first, and takes Escape as Cancel', async () => {
    const user = userEvent.setup();
    renderGame(withFreeGame(play(freeGame(), ...MISS)));
    await resumeFree(user);
    const show = screen.getByRole('button', { name: 'Show a solution' });
    await user.click(show);
    expect(screen.getByRole('alertdialog', { name: 'Show a solution?' })).toHaveTextContent(
      'This problem ends here and is not counted as solved.',
    );
    // The board behind it answers no key.
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(values()).toEqual(['10']);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(show).toHaveFocus();
  });

  it('ends the problem on the kept solution: no play added, not solved, no retry, its save cleared', async () => {
    const user = userEvent.setup();
    deviceStore.set(TG_STORAGE_KEYS.flags, FLAGS_DONE);
    deviceStore.set(TG_STORAGE_KEYS.game, storedRecord(play(freeGame(), ...MISS)));
    // A play on record, so the reveal's write of the stats has one to keep.
    deviceStore.set(
      TG_STORAGE_KEYS.stats,
      JSON.stringify({
        schemaVersion: 1,
        easy: { played: 1, solved: 0, totalPlaySeconds: 0, bestSeconds: null },
        medium: { played: 0, solved: 0, totalPlaySeconds: 0, bestSeconds: null },
        hard: { played: 0, solved: 0, totalPlaySeconds: 0, bestSeconds: null },
        daily: { played: 0, totalPlaySeconds: 0 },
        dailyTimes: {},
      }),
    );
    launch();
    await settle();
    await resumeFree(user);
    await settle();
    expect(storedPlays('easy')).toBe(1);
    await user.click(screen.getByRole('button', { name: 'Show a solution' }));
    await user.click(screen.getByRole('button', { name: 'Show' }));

    const card = screen.getByRole('alertdialog', { name: 'One way to make 21' });
    const solution = within(card).getByRole('list', { name: 'A solution' });
    expect(
      within(solution)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      '1 + 2 = 31 plus 2 equals 3',
      '3 + 4 = 73 plus 4 equals 7',
      '3 × 7 = 213 times 7 equals 21',
    ]);
    expect(within(card).getByRole('button', { name: 'New problem' })).toHaveFocus();
    expect(within(card).getByRole('button', { name: 'Home' })).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Retry same board' })).toBeNull();
    await settle();
    expect(deviceStore.has(TG_STORAGE_KEYS.game)).toBe(false);
    // The problem was counted when it was dealt; showing its solution is not another play.
    expect(storedPlays('easy')).toBe(1);
    expect(storedStats()?.easy.solved ?? 0).toBe(0);
    expect(storedStats()?.easy.bestSeconds ?? null).toBeNull();

    await user.click(within(card).getByRole('button', { name: 'Home' }));
    expect(screen.getByRole('button', { name: /^Easy/ })).not.toHaveTextContent(/Resume/);
  });

  it('books its seconds once, and the unmount after it adds nothing', async () => {
    deviceStore.set(TG_STORAGE_KEYS.flags, FLAGS_DONE);
    deviceStore.set(TG_STORAGE_KEYS.game, storedRecord(play(freeGame(), ...MISS)));
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Resume/ }));
      act(() => vi.advanceTimersByTime(6_000));
      fireEvent.click(screen.getByRole('button', { name: 'Show a solution' }));
      fireEvent.click(screen.getByRole('button', { name: 'Show' }));
      await settle();
      expect(storedPlaySeconds()).toBe(6);
      act(() => vi.advanceTimersByTime(4_000));
      cleanup();
      await settle();
      expect(storedPlaySeconds()).toBe(6);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the win (§4, §9)', () => {
  it('fills the target, says so once with the facts, and books the clear', async () => {
    const user = userEvent.setup();
    renderGame(withFreeGame(play(freeGame(), 0, '+', 1, 2, '+', 3)));
    await resumeFree(user);
    const clear = vi.spyOn(sounds, 'clear');
    tap(1, '*', 3);

    // The last line is read: the live region is not inside the container the
    // win makes inert, which would hide it from assistive technology (§12).
    expect(document.querySelector('.game-content')).toHaveAttribute('inert');
    expect(spoken()).toBe('3 times 7 equals 21');
    expect(document.querySelector('[aria-live="polite"]')!.closest('[inert]')).toBeNull();
    const card = screen.getByRole('alertdialog', { name: 'Target made.' });
    expect(document.querySelector('.tg-target')).toHaveClass('tg-target-made');
    expect(clear).toHaveBeenCalledTimes(1);
    expect(within(card).getByText('Your fastest yet.')).toBeInTheDocument();
    expect(card).toHaveTextContent('Target21');
    expect(card).toHaveTextContent('Numbers4');
    expect(card).toHaveTextContent('DifficultyEasy');
    // Free Play leads with a new problem (§8).
    expect(within(card).getByRole('button', { name: 'New problem' })).toHaveFocus();
    expect(within(card).getByRole('button', { name: 'Retry same board' })).toBeInTheDocument();
    await settle();
    expect(deviceStore.has(TG_STORAGE_KEYS.game)).toBe(false);
    expect(storedStats()?.easy.solved).toBe(1);
    expect(storedStats()?.easy.bestSeconds).toBe(0);
  });

  it('answers no key while the card is up: the board behind it is finished', async () => {
    const user = userEvent.setup();
    renderGame(withFreeGame(play(freeGame(), 0, '+', 1, 2, '+', 3)));
    await resumeFree(user);
    tap(1, '*', 3);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(values()).toEqual(['21']);
    expect(screen.getByRole('alertdialog', { name: 'Target made.' })).toBeInTheDocument();
  });

  it('counts a retry of the solved problem, and compares it with no record (§9)', async () => {
    const user = userEvent.setup();
    renderGame(withFreeGame(play(freeGame(), 0, '+', 1, 2, '+', 3)));
    await resumeFree(user);
    tap(1, '*', 3);
    const first = screen.getByRole('alertdialog', { name: 'Target made.' });
    await user.click(within(first).getByRole('button', { name: 'Retry same board' }));
    expect(values()).toEqual(['1', '2', '3', '4']);
    tap(0, '+', 1, 2, '+', 3, 1, '*', 3);
    const card = screen.getByRole('alertdialog', { name: 'Target made.' });
    expect(within(card).queryByText('Your fastest yet.')).toBeNull();
    expect(within(card).queryByText(/Fastest clear/)).toBeNull();
    await settle();
    expect(storedStats()?.easy).toMatchObject({ played: 1, solved: 2 });
  });

  it('offers the daily only its retry, and records the day (§8, §9)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await openDaily(user);
    await settle();
    const record = stored<PersistedGame>(TG_STORAGE_KEYS.dailyGame)!;
    expect(record.dailyDate).toBe(today());
    expect(screen.getByText('Daily')).toBeInTheDocument();
    tapMoves(record.solution);

    const card = screen.getByRole('alertdialog', { name: 'Target made.' });
    expect(within(card).queryByRole('button', { name: 'New problem' })).toBeNull();
    expect(within(card).getByRole('button', { name: 'Retry same board' })).toHaveFocus();
    await settle();
    expect(Object.keys(storedStats()!.dailyTimes)).toEqual([today()]);
    expect(storedStats()?.medium.solved).toBe(0);

    await user.click(within(card).getByRole('button', { name: 'Home' }));
    expect(screen.getByRole('button', { name: /Daily Challenge/ })).toHaveTextContent(
      'Completed today',
    );
  });
});

describe('the keyboard (§3)', () => {
  it('brings the focus in with an arrow, walks the numbers in slot order, and presses with Enter', async () => {
    const user = userEvent.setup();
    renderGame(withFreeGame(play(freeGame(), 1, '+', 2)));
    await resumeFree(user);
    // Slots: 1, empty, 5, 4.
    (document.activeElement as HTMLElement | null)?.blur();
    await user.keyboard('{ArrowRight}');
    expect(tile(0)).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(tile(2)).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(tile(3)).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(tile(3)).toHaveFocus();
    await user.keyboard('{Home}');
    expect(tile(0)).toHaveFocus();
    await user.keyboard('{End}');
    expect(tile(3)).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(tile(2)).toHaveFocus();
    // One tab stop for the whole board.
    expect(board().querySelectorAll('[tabindex="0"]')).toHaveLength(1);

    await user.keyboard('{Enter}');
    expect(tile(2)).toHaveAttribute('aria-pressed', 'true');
    await user.keyboard('x');
    expect(op('*')).toHaveAttribute('aria-pressed', 'true');
    await user.keyboard('/');
    expect(op('/')).toHaveAttribute('aria-pressed', 'true');
    await user.keyboard('-');
    await user.keyboard('{End}{Enter}');
    expect(lines()).toEqual(['2 + 3 = 5', '5 − 4 = 1']);
  });

  it('clears the choice with Escape, and presses nothing on a held key', async () => {
    const user = userEvent.setup();
    renderGame(withFreeGame());
    await resumeFree(user);
    tap(0);
    fireEvent.keyDown(window, { key: '+', repeat: true });
    expect(op('+')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.keyDown(window, { key: '+' });
    expect(op('+')).toHaveAttribute('aria-pressed', 'true');
    await user.keyboard('{Escape}');
    expect(board().querySelector('[aria-pressed="true"]')).toBeNull();

    // A held Enter or Space presses a button once (§3): a repeat's default —
    // the browser's click — is cancelled on a tile and on Undo alike; the
    // first press is left alone.
    tap(0, '+', 1);
    for (const button of [tile(2)!, screen.getByRole('button', { name: 'Undo' })]) {
      expect(fireEvent.keyDown(button, { key: 'Enter', repeat: true })).toBe(false);
      expect(fireEvent.keyDown(button, { key: ' ', repeat: true })).toBe(false);
      expect(fireEvent.keyDown(button, { key: 'Enter' })).toBe(true);
    }
  });
});

describe('↻, new problems and the home (§5, §8)', () => {
  it('rebuilds the same problem on retry, after asking, and counts it as a play', async () => {
    const user = userEvent.setup();
    deviceStore.set(TG_STORAGE_KEYS.flags, FLAGS_DONE);
    deviceStore.set(TG_STORAGE_KEYS.game, storedRecord(play(freeGame(), 0, '+', 1)));
    launch();
    await settle();
    await resumeFree(user);
    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Start over?' });
    expect(within(dialog).getByRole('button', { name: 'New problem' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Retry same board' }));
    expect(values()).toEqual(['1', '2', '3', '4']);
    expect(lines()).toEqual([]);
    expect(board().contains(document.activeElement)).toBe(true);
    await settle();
    expect(storedPlays('easy')).toBe(1);
    expect(stored<PersistedGame>(TG_STORAGE_KEYS.game)?.moves).toBe('');
  });

  it('deals a new problem from the dialog, of the same difficulty', async () => {
    const user = userEvent.setup();
    deviceStore.set(TG_STORAGE_KEYS.flags, FLAGS_DONE);
    deviceStore.set(TG_STORAGE_KEYS.game, storedRecord(play(freeGame('medium'), 0, '+', 1)));
    launch();
    await settle();
    await resumeFree(user);
    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    await user.click(screen.getByRole('button', { name: 'New problem' }));
    await settle();
    const record = stored<PersistedGame>(TG_STORAGE_KEYS.game)!;
    expect(record.difficulty).toBe('medium');
    expect(record.seed).not.toBe(freeGame('medium').seed);
    expect(record.moves).toBe('');
    expect(storedPlays('medium')).toBe(1);
  });

  it('offers the daily no other problem, and answers no key while the question is up', async () => {
    const user = userEvent.setup();
    renderGame({
      ...tutorialDone,
      [TG_STORAGE_KEYS.dailyGame]: storedRecord(dailyGame(today())),
    });
    await user.click(await screen.findByRole('button', { name: /Daily Challenge.*Resume/ }));
    tap(0, '+');
    const restart = screen.getByRole('button', { name: 'Retry same board' });
    await user.click(restart);
    const dialog = screen.getByRole('alertdialog', { name: 'Start over?' });
    expect(within(dialog).queryByRole('button', { name: 'New problem' })).toBeNull();
    fireEvent.keyDown(window, { key: '*' });
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(op('+')).toHaveAttribute('aria-pressed', 'true');

    // Escape is the question's Cancel: the focus back on ↻, the choice left alone.
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(restart).toHaveFocus();
    expect(tile(0)).toHaveAttribute('aria-pressed', 'true');
    await user.keyboard('{Escape}');
    expect(tile(0)).toHaveAttribute('aria-pressed', 'false');
  });

  it('asks before replacing a suspended problem with another difficulty', async () => {
    const user = userEvent.setup();
    renderGame(withFreeGame());
    expect(await screen.findByRole('button', { name: /^Easy.*Resume/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Hard/ }));
    expect(
      screen.getByRole('alertdialog', { name: 'Replace the problem in progress?' }),
    ).toHaveTextContent('Your Easy problem will be replaced by a new Hard problem.');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: /^Easy.*Resume/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Hard/ }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.getByText('Hard')).toBeInTheDocument();
    expect(values()).toHaveLength(5);
    await settle();
    expect(stored<{ difficulty: string }>(TG_STORAGE_KEYS.prefs)?.difficulty).toBe('hard');
  });

  it('keeps the daily and the Free Play problem in their own slots', async () => {
    const user = userEvent.setup();
    deviceStore.set(TG_STORAGE_KEYS.flags, FLAGS_DONE);
    launch();
    await settle();
    await user.click(await screen.findByRole('button', { name: /^Medium/ }));
    const medium = values();
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await openDaily(user);
    const daily = values();
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    expect(stored<PersistedGame>(TG_STORAGE_KEYS.game)?.mode).toBe('free');
    expect(stored<PersistedGame>(TG_STORAGE_KEYS.dailyGame)?.mode).toBe('daily');

    cleanup();
    launch();
    await settle();
    await user.click(screen.getByRole('button', { name: /Medium.*Resume/ }));
    expect(values()).toEqual(medium);
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: /Daily Challenge.*Resume/ }));
    expect(values()).toEqual(daily);
  });

  it('lands on the home over a corrupt save, and starts nothing in its place', async () => {
    const broken = JSON.stringify({ ...JSON.parse(storedRecord(freeGame())), moves: '0-1' });
    for (const raw of ['{"schemaVersion":1,"mode":"fr', broken]) {
      deviceStore.set(TG_STORAGE_KEYS.flags, FLAGS_DONE);
      deviceStore.set(TG_STORAGE_KEYS.game, raw);
      launch('shortcut');
      expect(await screen.findByRole('button', { name: /^Easy/ })).not.toHaveTextContent(/Resume/);
      expect(queryBoard()).not.toBeInTheDocument();
      await settle();
      expect(deviceStore.get(TG_STORAGE_KEYS.stats)).toBeUndefined();
      expect(deviceStore.get(TG_STORAGE_KEYS.game)).toBe(raw);
      cleanup();
      await settle();
      deviceStore.clear();
    }
  });

  it('shows no clock while playing, and hands control back to the collection', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(withFreeGame());
    await resumeFree(user);
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('shows no time on the home: the fastest clear is on the statistics screen (§9)', async () => {
    const user = userEvent.setup();
    renderGame({
      ...tutorialDone,
      [TG_STORAGE_KEYS.stats]: JSON.stringify({
        schemaVersion: 1,
        easy: { played: 1, solved: 1, totalPlaySeconds: 42, bestSeconds: 42 },
        medium: { played: 0, solved: 0, totalPlaySeconds: 0, bestSeconds: null },
        hard: { played: 0, solved: 0, totalPlaySeconds: 0, bestSeconds: null },
        daily: { played: 0, totalPlaySeconds: 0 },
        dailyTimes: {},
      }),
    });
    const easy = await screen.findByRole('button', { name: /^Easy/ });
    expect(easy).toHaveTextContent('Easy4 numbers');
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Statistics' }));
    expect(screen.getAllByText('0:42').length).toBeGreaterThan(0);
  });

  it('reports per-difficulty facts, the daily’s days and the total, and no streak (§9)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));
    expect(screen.getAllByText('Problems solved')).toHaveLength(3);
    expect(screen.getByText('Days cleared')).toBeInTheDocument();
    expect(screen.getByText('All modes')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByRole('button', { name: /Daily Challenge/ })).toBeInTheDocument();
  });
});

describe('backgrounding (§9, §10)', () => {
  it('books play time before the app can be killed, and never twice', async () => {
    deviceStore.set(TG_STORAGE_KEYS.flags, FLAGS_DONE);
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
      expect(stored<PersistedGame>(TG_STORAGE_KEYS.game)?.elapsedSeconds).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not run the clock or move anything while hidden or after', async () => {
    deviceStore.set(TG_STORAGE_KEYS.flags, FLAGS_DONE);
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /^Easy/ }));
      const dealt = values();
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
      expect(values()).toEqual(dealt);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('leaving by the browser’s Back (docs/GAME_LIFECYCLE.md「アンマウントで計上する」)', () => {
  it('books the seconds played since the last sync, once, and not again on remount', async () => {
    deviceStore.set(TG_STORAGE_KEYS.flags, FLAGS_DONE);
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
      expect(stored<PersistedGame>(TG_STORAGE_KEYS.game)?.elapsedSeconds).toBe(8);

      launch();
      await settle();
      cleanup();
      await settle();
      expect(storedPlaySeconds()).toBe(8);
      expect(stored<PersistedGame>(TG_STORAGE_KEYS.game)?.elapsedSeconds).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });

  it('books the problem a ↻ replaces once, and the unmount after it only what came later', async () => {
    deviceStore.set(TG_STORAGE_KEYS.flags, FLAGS_DONE);
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
      expect(stored<PersistedGame>(TG_STORAGE_KEYS.game)?.elapsedSeconds).toBe(0);

      act(() => vi.advanceTimersByTime(2_000));
      fireEvent.click(screen.getByRole('button', { name: 'Retry same board' }));
      fireEvent.click(
        within(screen.getByRole('alertdialog', { name: 'Start over?' })).getByRole('button', {
          name: 'New problem',
        }),
      );
      await settle();
      expect(storedPlaySeconds()).toBe(6);

      act(() => vi.advanceTimersByTime(1_000));
      cleanup();
      await settle();
      expect(storedPlaySeconds()).toBe(7);
      expect(stored<PersistedGame>(TG_STORAGE_KEYS.game)?.elapsedSeconds).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * A pinned home-screen shortcut (issue #113). The shell says only which door
 * was used; every decision below is this game's, taken from its two slots.
 */
describe('a home-screen shortcut', () => {
  it('opens the one suspended game straight onto its board', async () => {
    deviceStore.set(TG_STORAGE_KEYS.flags, FLAGS_DONE);
    deviceStore.set(TG_STORAGE_KEYS.dailyGame, storedRecord(dailyGame(today())));
    launch('shortcut');
    await settle();
    expect(board()).toBeInTheDocument();
    expect(screen.getByText('Daily')).toBeInTheDocument();
  });

  it('opens the home screen when two games are suspended, rather than guessing', async () => {
    deviceStore.set(TG_STORAGE_KEYS.flags, FLAGS_DONE);
    deviceStore.set(TG_STORAGE_KEYS.dailyGame, storedRecord(dailyGame(today())));
    deviceStore.set(TG_STORAGE_KEYS.game, storedRecord(play(freeGame(), ...MISS)));
    launch('shortcut');
    await settle();
    expect(queryBoard()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Easy.*Resume/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge.*Resume/ })).toBeInTheDocument();
  });

  it('teaches the game first on a launch that has never seen it (§11)', async () => {
    deviceStore.set(TG_STORAGE_KEYS.game, storedRecord(freeGame()));
    launch('shortcut');
    expect(await screen.findByText('Combine two')).toBeInTheDocument();
    expect(queryBoard()).not.toBeInTheDocument();
  });
});
