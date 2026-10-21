/**
 * The screens, end to end (docs/NESTED_TIC_TAC_TOE_RULES.md §13「Phase 3」):
 * Quick Rules, the home's difficulty and side choice, the board's playable
 * cells and frames, the turn line, Undo (button and Ctrl/Cmd+Z), the ↻ and
 * home confirmations (inert board, Escape = Cancel), the CPU's one timer
 * (and its pause in the background), the result card in all three outcomes,
 * saves that fail closed, the shortcut door, and the play clock's booking.
 *
 * The CPU moves on a real `setTimeout` with the search inside it
 * (state/GameContext.tsx `CPU_DELAY_MS`), so the tests that need its reply
 * own the clock and step it (the reason ReversiRoot.test.tsx gives, issue
 * #158), and drive the screen with `fireEvent` under fake timers.
 *
 * Saves go to Capacitor Preferences, mocked as a Map — the device store every
 * launch below loads from and saves to.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sounds } from '@/services/sound';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { CPU_DELAY_MS } from '../state/GameContext';
import { NT_STORAGE_KEYS, type PersistedGame, type Prefs, type Stats } from '../storage/schemas';
import { NestedTicTacToeRoot } from './NestedTicTacToeRoot';
import {
  cpuCanWin,
  FREE_MOVE_FOR_SECOND,
  playerDrawsWith,
  playerTakesWith,
  playerToMove,
  playerWinsWith,
  savedRecord,
} from './testPositions';

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

/** A launch through the ordinary door: a tile on the collection, or the web address. */
function launchFromCollection() {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <NestedTicTacToeRoot onExit={onExit} />
    </SettingsProvider>,
  );
  return onExit;
}

/** The same store, entered by the other door. */
function launchFromShortcut() {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <NestedTicTacToeRoot onExit={onExit} entry="shortcut" />
    </SettingsProvider>,
  );
  return onExit;
}

/** Lets the local reads and the saves they trigger resolve (promises, not timers). */
const settle = () =>
  act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });

const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

/** Runs `body` on a fake clock, and always hands real timers back. */
async function onFakeClock(body: () => Promise<void>) {
  vi.useFakeTimers();
  try {
    await body();
  } finally {
    vi.useRealTimers();
  }
}

/** The app goes to background. Android may kill it without another event. */
function background() {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  Reflect.deleteProperty(document, 'visibilityState');
}

/** And back again. */
function foreground() {
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

function stored<T>(key: string): T | undefined {
  const raw = deviceStore.get(key);
  return raw === undefined ? undefined : (JSON.parse(raw) as T);
}

const storedStats = () => stored<Stats>(NT_STORAGE_KEYS.stats);
const storedGame = () => stored<PersistedGame>(NT_STORAGE_KEYS.saveGame);

function taughtAlready() {
  deviceStore.set(
    NT_STORAGE_KEYS.flags,
    JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
  );
}

function suspend(moves: readonly number[], options?: Parameters<typeof savedRecord>[1]) {
  deviceStore.set(NT_STORAGE_KEYS.saveGame, savedRecord(moves, options));
}

const board = () => screen.getByRole('group', { name: /Nested Tic-Tac-Toe board/ });
const maybeBoard = () => screen.queryByRole('group', { name: /Nested Tic-Tac-Toe board/ });
const cells = () => [...board().querySelectorAll<HTMLButtonElement>('.nt-cell')];
const enabledCells = () => cells().filter((cell) => !cell.disabled);
const marks = () => board().querySelectorAll('.nt-cell .nt-mark').length;
const cell = (index: number) =>
  board().querySelector<HTMLButtonElement>(`.nt-cell[data-cell="${index}"]`)!;
const framed = () => [...board().querySelectorAll<HTMLElement>('.nt-small[data-playable]')];
const turnLineText = () => document.querySelector('.nt-turn-line')!.textContent;
const easyButton = () => screen.queryByRole('button', { name: /^Easy/ });

const YOUR_TURN_SENT = 'Your turn — play in the framed board';
const YOUR_TURN_FREE = 'Your turn — play in any open board';
const CPU_TURN = 'CPU’s turn';

afterEach(async () => {
  cleanup();
  // Unmounting saves (docs/GAME_LIFECYCLE.md「アンマウントで計上する」), and
  // saves are fire-and-forget: let them land before wiping the store.
  await act(async () => undefined);
  deviceStore.clear();
  vi.restoreAllMocks();
});

describe('first run (§9)', () => {
  it('teaches three steps, sending first, then opens a board anywhere', async () => {
    const user = userEvent.setup();
    launchFromCollection();

    expect(await screen.findByText('Your move sends theirs')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Where you play inside a small board picks the board your opponent plays in next.',
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      screen.getByText('If that board is taken or full, play in any open board.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      screen.getByText('Three in a row takes a small board; three taken boards in a row wins.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // Nine small boards of nine cells, nested and labelled (§10), and the
    // first move may go anywhere: all 81 are offered, every board framed.
    expect(within(board()).getAllByRole('group')).toHaveLength(9);
    // Every board is playable on the first move, and its label says so in
    // words: "framed" is a ring the ear does not get (§10「読み上げ」).
    expect(
      screen.getByRole('group', { name: 'Small board 1: open, play here' }),
    ).toBeInTheDocument();
    expect(cells()).toHaveLength(81);
    expect(enabledCells()).toHaveLength(81);
    expect(framed()).toHaveLength(9);
    expect(turnLineText()).toBe(YOUR_TURN_FREE);
    // The line is a live status region, so a screen reader hears the turn.
    expect(document.querySelector('.nt-turn-line')).toHaveAttribute('role', 'status');
    expect(
      screen.getByRole('button', { name: 'Small board 1, square 1: play here' }),
    ).toBeInTheDocument();
    // Counted once, on Easy, when it started (§7).
    await settle();
    expect(storedStats()!.easy.played).toBe(1);
    expect(stored<{ tutorialCompleted: boolean }>(NT_STORAGE_KEYS.flags)!.tutorialCompleted).toBe(
      true,
    );
  });

  it('resumes a suspended match on Start Playing rather than replace it (§8.3)', async () => {
    const user = userEvent.setup();
    // The flags record is gone while the match survives: separate records.
    suspend([40, 36]);
    launchFromCollection();

    expect(await screen.findByText('Your move sends theirs')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));
    await settle();

    expect(marks()).toBe(2);
    expect(turnLineText()).toBe(YOUR_TURN_SENT);
    // Resumed, not started: nothing counted.
    expect(storedStats()).toBeUndefined();
  });
});

describe('the board (§2, §6, §10)', () => {
  it('sends the CPU, then frames the one board the player is sent to', async () => {
    taughtAlready();
    await onFakeClock(async () => {
      launchFromCollection();
      await settle();
      fireEvent.click(easyButton()!);

      // Board 1's centre sends the reply to the centre board (index 4).
      fireEvent.click(screen.getByRole('button', { name: 'Small board 1, square 5: play here' }));
      expect(marks()).toBe(1);
      expect(turnLineText()).toBe(CPU_TURN);
      // The CPU's turn offers nothing and frames nothing.
      expect(enabledCells()).toHaveLength(0);
      expect(framed()).toHaveLength(0);
      expect(
        screen.getByRole('button', { name: 'Small board 1, square 5: your cross' }),
      ).toBeInTheDocument();

      await advance(CPU_DELAY_MS - 1);
      expect(marks()).toBe(1);
      await advance(1);
      expect(marks()).toBe(2);

      // The reply went into the board it was sent to, and its place inside
      // it names the one board the player may play in now.
      const cpuCell = [...board().querySelectorAll('.nt-cell')].findIndex((button) =>
        /CPU’s circle/.test(button.getAttribute('aria-label') ?? ''),
      );
      expect(Math.floor(cpuCell / 9)).toBe(4);
      const target = cpuCell % 9;
      expect(framed()).toHaveLength(1);
      expect(framed()[0]!.getAttribute('aria-label')).toBe(
        `Small board ${target + 1}: open, play here`,
      );
      // The open boards it was not sent to say only "open".
      const other = target === 0 ? 1 : 0;
      expect(
        screen.getByRole('group', { name: `Small board ${other + 1}: open` }),
      ).not.toHaveAttribute('data-playable');
      expect(
        enabledCells().every((button) => Math.floor(Number(button.dataset.cell) / 9) === target),
      ).toBe(true);
      expect(enabledCells().length).toBeGreaterThan(0);
      expect(
        enabledCells().every((button) => /: play here$/.test(button.getAttribute('aria-label')!)),
      ).toBe(true);
      expect(turnLineText()).toBe(YOUR_TURN_SENT);
      // The last move keeps its bar (§10) — the CPU's, now.
      expect(board().querySelectorAll('.nt-last')).toHaveLength(1);
    });
  });

  it('frames every open board on a free move, and never a closed one (§2 3)', async () => {
    taughtAlready();
    suspend(FREE_MOVE_FOR_SECOND, { playerGoesFirst: false });
    expect(playerToMove(FREE_MOVE_FOR_SECOND, false)).toBe(true);
    launchFromCollection();
    await settle();
    fireEvent.click(easyButton()!);

    // Board 1 was taken by the CPU's cross: closed, carrying the big mark,
    // and not offered; the other eight are framed.
    expect(
      screen.getByRole('group', { name: 'Small board 1: the CPU took it' }),
    ).toBeInTheDocument();
    expect(framed()).toHaveLength(8);
    expect(board().querySelectorAll('.nt-big')).toHaveLength(1);
    // 72 cells in the eight open boards, two of them already filled.
    expect(enabledCells()).toHaveLength(70);
    expect(cell(5).disabled).toBe(true);
    expect(turnLineText()).toBe(YOUR_TURN_FREE);
  });

  it('holds still under Reduced Motion, and moves when nothing asks it not to (§10)', async () => {
    taughtAlready();
    launchFromCollection();
    fireEvent.click(await screen.findByRole('button', { name: /^Easy/ }));
    // jsdom has no matchMedia, which reads as Reduced Motion on (the quiet side).
    expect(board()).toHaveClass('nt-board-still');
    cleanup();

    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      })),
    );
    try {
      launchFromCollection();
      fireEvent.click(await screen.findByRole('button', { name: /^Easy/ }));
      expect(board()).not.toHaveClass('nt-board-still');
      fireEvent.click(cell(40));
      expect(board().querySelectorAll('.nt-mark-pop')).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('shows no clock and offers no hint (§6, §10)', async () => {
    taughtAlready();
    const user = userEvent.setup();
    launchFromCollection();
    await user.click(await screen.findByRole('button', { name: /^Easy/ }));
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();
  });

  it('plays a cell from the keyboard: Tab stops only on playable cells, in index order', async () => {
    taughtAlready();
    // The centre of the centre, then the CPU's top-left of the centre board:
    // the player is sent to small board 1 (index 0).
    suspend([40, 36]);
    const user = userEvent.setup();
    launchFromShortcut();
    await settle();
    const playable = enabledCells().map((button) => Number(button.dataset.cell));
    expect(playable).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);

    // Walk the page once from the top: the cells reached are exactly the
    // playable ones, ascending — one small board's worth (§10).
    (document.activeElement as HTMLElement | null)?.blur();
    const reached: number[] = [];
    for (let i = 0; i < 20; i++) {
      await user.tab();
      const active = document.activeElement as HTMLElement;
      if (active.classList.contains('nt-cell')) reached.push(Number(active.dataset.cell));
      if (active.textContent === 'Undo') break;
    }
    expect(reached).toEqual(playable);

    cell(4).focus();
    await user.keyboard('{Enter}');
    expect(marks()).toBe(3);
    expect(turnLineText()).toBe(CPU_TURN);
  });
});

describe('Undo (§5)', () => {
  it('takes the CPU’s reply and the player’s move back together', async () => {
    taughtAlready();
    await onFakeClock(async () => {
      launchFromCollection();
      await settle();
      fireEvent.click(easyButton()!);
      expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();

      fireEvent.click(cell(4));
      await advance(CPU_DELAY_MS);
      expect(marks()).toBe(2);
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      expect(marks()).toBe(0);
      expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
      expect(turnLineText()).toBe(YOUR_TURN_FREE);
      await settle();
      expect(storedGame()!.moves).toEqual([]);
    });
  });

  it('takes the player’s move alone during the CPU’s pause, and disarms its reply', async () => {
    taughtAlready();
    await onFakeClock(async () => {
      launchFromCollection();
      await settle();
      fireEvent.click(easyButton()!);
      fireEvent.click(cell(4));
      expect(turnLineText()).toBe(CPU_TURN);
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      expect(marks()).toBe(0);
      // The timer armed for that move is gone with it.
      await advance(CPU_DELAY_MS * 3);
      expect(marks()).toBe(0);
      expect(turnLineText()).toBe(YOUR_TURN_FREE);
    });
  });

  it('Ctrl+Z does what the button does, and nothing when it is disabled', async () => {
    taughtAlready();
    await onFakeClock(async () => {
      launchFromCollection();
      await settle();
      // Second: the CPU's opening mark is on the board and Undo is disabled
      // (it never takes that move back), so a Ctrl+Z that did anything would
      // show.
      fireEvent.click(screen.getByRole('radio', { name: 'Second, playing circle' }));
      fireEvent.click(easyButton()!);
      await advance(CPU_DELAY_MS);
      expect(marks()).toBe(1);
      expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
      fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
      expect(marks()).toBe(1);
      await settle();
      expect(storedGame()!.moves).toHaveLength(1);

      fireEvent.click(enabledCells()[0]!);
      await advance(CPU_DELAY_MS);
      expect(marks()).toBe(3);
      fireEvent.keyDown(window, { key: 'z', ctrlKey: true, repeat: true });
      expect(marks()).toBe(3);
      fireEvent.keyDown(window, { key: 'z', metaKey: true });
      expect(marks()).toBe(1);
    });
  });

  it('never takes back the CPU’s opening move when the player went second', async () => {
    taughtAlready();
    await onFakeClock(async () => {
      launchFromCollection();
      await settle();
      fireEvent.click(screen.getByRole('radio', { name: 'Second, playing circle' }));
      fireEvent.click(easyButton()!);
      await advance(CPU_DELAY_MS);
      expect(marks()).toBe(1);
      expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    });
  });

  it('works on a resumed match: the list is the history (§5, §8)', async () => {
    taughtAlready();
    suspend([40, 36]);
    launchFromShortcut();
    await settle();
    expect(marks()).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(marks()).toBe(0);
  });
});

describe('who moves first (§1)', () => {
  it('lets the CPU open as cross when the player moves second, and keeps the choice', async () => {
    taughtAlready();
    await onFakeClock(async () => {
      launchFromCollection();
      await settle();
      const first = screen.getByRole('radio', { name: 'First, playing cross' });
      const second = screen.getByRole('radio', { name: 'Second, playing circle' });
      expect(first).toBeChecked();
      // The word is on the button beside the drawn mark; the name says the mark.
      expect(first).toHaveTextContent('First');
      expect(first.querySelector('svg.nt-mark')).not.toBeNull();
      fireEvent.click(second);
      expect(second).toBeChecked();
      await settle();
      expect(stored<Prefs>(NT_STORAGE_KEYS.prefs)).toEqual({
        schemaVersion: 1,
        playerGoesFirst: false,
      });

      fireEvent.click(easyButton()!);
      expect(turnLineText()).toBe(CPU_TURN);
      expect(enabledCells()).toHaveLength(0);
      await advance(CPU_DELAY_MS);
      expect(marks()).toBe(1);
      expect(screen.getAllByRole('button', { name: /CPU’s cross$/ })).toHaveLength(1);
      expect(turnLineText()).toBe(YOUR_TURN_SENT);
    });
  });

  it('leaves the match in progress on the side it started with', async () => {
    taughtAlready();
    suspend([]);
    await onFakeClock(async () => {
      launchFromCollection();
      await settle();
      fireEvent.click(screen.getByRole('radio', { name: 'Second, playing circle' }));
      fireEvent.click(screen.getByRole('button', { name: /^Easy.*Resume/ }));
      // Still the player's first move: the CPU does not take over the opening.
      expect(turnLineText()).toBe(YOUR_TURN_FREE);
      await advance(CPU_DELAY_MS * 2);
      expect(marks()).toBe(0);
    });
  });

  it('starts the ↻ new match on the side the preference names now', async () => {
    taughtAlready();
    suspend([40, 36]);
    await onFakeClock(async () => {
      launchFromCollection();
      await settle();
      fireEvent.click(screen.getByRole('radio', { name: 'Second, playing circle' }));
      fireEvent.click(screen.getByRole('button', { name: /^Easy.*Resume/ }));
      fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
      fireEvent.click(screen.getByRole('button', { name: 'Start' }));
      expect(marks()).toBe(0);
      expect(turnLineText()).toBe(CPU_TURN);
      await advance(CPU_DELAY_MS);
      expect(screen.getAllByRole('button', { name: /CPU’s cross$/ })).toHaveLength(1);
    });
  });
});

describe('the home (§1)', () => {
  it('resumes the same difficulty, and asks before replacing it with another', async () => {
    taughtAlready();
    suspend([40, 36]);
    const user = userEvent.setup();
    launchFromCollection();

    await user.click(await screen.findByRole('button', { name: /^Normal/ }));
    const dialog = screen.getByRole('alertdialog', { name: 'Replace the match in progress?' });
    expect(dialog).toHaveTextContent('Your Easy match will be replaced by a new Normal match.');
    // Escape is Cancel: still home, the match untouched.
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(maybeBoard()).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Easy.*Resume/ }));
    expect(marks()).toBe(2);
    await user.click(screen.getByRole('button', { name: 'Home' }));

    await user.click(screen.getByRole('button', { name: /^Normal/ }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(marks()).toBe(0);
    await settle();
    expect(storedStats()!.normal.played).toBe(1);
    // Abandoned, not lost (§7).
    expect(storedStats()!.easy.losses).toBe(0);
  });

  it('exits to the collection', async () => {
    taughtAlready();
    const user = userEvent.setup();
    const onExit = launchFromCollection();
    await screen.findByRole('button', { name: /^Easy/ });
    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('reports a record per difficulty, and no streak (§7)', async () => {
    taughtAlready();
    deviceStore.set(
      NT_STORAGE_KEYS.stats,
      JSON.stringify({
        schemaVersion: 1,
        totalPlaySeconds: 125,
        easy: { played: 4, wins: 2, losses: 1, draws: 1 },
        normal: { played: 0, wins: 0, losses: 0, draws: 0 },
        hard: { played: 1, wins: 0, losses: 1, draws: 0 },
      }),
    );
    const user = userEvent.setup();
    launchFromCollection();
    // The record, quietly, on the button it belongs to.
    expect(
      await screen.findByRole('button', { name: /^Easy.*Won 2 · Lost 1/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Statistics' }));

    for (const name of ['Easy', 'Normal', 'Hard']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
    expect(screen.getAllByText('Games played')).toHaveLength(3);
    expect(screen.getAllByText('Wins')).toHaveLength(3);
    expect(screen.getAllByText('Losses')).toHaveLength(3);
    expect(screen.getAllByText('Draws')).toHaveLength(3);
    expect(screen.getByText('Total play time')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});

describe('the ↻ (§10)', () => {
  it('asks first, holds the board inert while it asks, and Escape cancels', async () => {
    taughtAlready();
    suspend([40, 36]);
    const user = userEvent.setup();
    launchFromShortcut();
    await settle();

    await user.click(screen.getByRole('button', { name: 'New Game' }));
    expect(screen.getByRole('alertdialog', { name: 'Start a new game?' })).toBeInTheDocument();
    expect(document.querySelector('.game-content')).toHaveAttribute('inert');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(document.querySelector('.game-content')).not.toHaveAttribute('inert');
    expect(marks()).toBe(2);

    await user.click(screen.getByRole('button', { name: 'New Game' }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(marks()).toBe(0);
    await settle();
    // Same difficulty, counted as a new start; the old one is not a loss.
    expect(storedStats()!.easy).toEqual({ played: 1, wins: 0, losses: 0, draws: 0 });
  });
});

describe('the result card (§7, §10)', () => {
  it('states a win with the facts, books it once, and offers the next match', async () => {
    taughtAlready();
    const win = playerWinsWith();
    suspend(win.moves, { difficulty: 'hard' });
    const clear = vi.spyOn(sounds, 'clear');
    launchFromShortcut();
    await settle();

    fireEvent.click(cell(win.cell));
    const card = screen.getByRole('alertdialog', { name: 'You win' });
    expect(card).toHaveTextContent('Three of your boards in a row.');
    const facts = within(card)
      .getAllByRole('definition')
      .map((dd) => dd.textContent);
    const terms = within(card)
      .getAllByRole('term')
      .map((dt) => dt.textContent);
    expect(terms).toEqual(['Your boards', 'CPU boards', 'Difficulty']);
    expect(Number(facts[0])).toBeGreaterThanOrEqual(3);
    expect(facts[2]).toBe('Hard');
    expect(within(card).getByRole('button', { name: 'Share' })).toBeInTheDocument();
    // Nothing praises; the board behind is inert and the line says nothing.
    expect(card).not.toHaveTextContent(/nice|great|well done|amazing/i);
    expect(document.querySelector('.game-content')).toHaveAttribute('inert');
    expect(turnLineText()).toBe('');
    // The winning line is outlined; the other six boards dim.
    expect(board().querySelectorAll('.nt-small[data-win="mine"]')).toHaveLength(3);
    expect(board().querySelectorAll('.nt-small[data-dim]')).toHaveLength(6);
    expect(clear).toHaveBeenCalledTimes(1);

    await settle();
    expect(storedStats()!.hard).toEqual({ played: 0, wins: 1, losses: 0, draws: 0 });
    expect(storedGame()).toBeUndefined();

    fireEvent.click(within(card).getByRole('button', { name: 'New Game' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(marks()).toBe(0);
    await settle();
    expect(storedStats()!.hard.played).toBe(1);
  });

  it('states a loss plainly when the CPU completes its line', async () => {
    taughtAlready();
    const loss = cpuCanWin();
    suspend(loss.moves);
    const gameOver = vi.spyOn(sounds, 'gameOver');
    await onFakeClock(async () => {
      launchFromShortcut();
      await settle();
      expect(turnLineText()).toBe(CPU_TURN);
      await advance(CPU_DELAY_MS);
    });
    const card = screen.getByRole('alertdialog', { name: 'The CPU wins' });
    expect(card).toHaveTextContent('The CPU took three boards in a row.');
    expect(board().querySelectorAll('.nt-small[data-win="cpu"]')).toHaveLength(3);
    expect(gameOver).toHaveBeenCalledTimes(1);
    await settle();
    expect(storedStats()!.easy.losses).toBe(1);

    fireEvent.click(within(card).getByRole('button', { name: 'Home' }));
    expect(screen.getByRole('button', { name: /^Easy/ })).not.toHaveTextContent('Resume');
  });

  it('states a draw in its own words', async () => {
    taughtAlready();
    const draw = playerDrawsWith();
    suspend(draw.moves, { difficulty: 'normal' });
    const gameOver = vi.spyOn(sounds, 'gameOver');
    const clear = vi.spyOn(sounds, 'clear');
    launchFromShortcut();
    await settle();
    fireEvent.click(cell(draw.cell));
    const card = screen.getByRole('alertdialog', { name: 'A draw' });
    // The missing thing is a line of boards, not three in a row inside one:
    // the card's own facts count the boards each side took (§12 glossary).
    expect(card).toHaveTextContent(
      'Every small board closed, and neither side has three boards in a row.',
    );
    expect(card).not.toHaveTextContent('without three in a row');
    // A draw sounds like a loss, not a win (§10).
    expect(gameOver).toHaveBeenCalledTimes(1);
    expect(clear).not.toHaveBeenCalled();
    await settle();
    expect(storedStats()!.normal.draws).toBe(1);
  });
});

describe('sounds (§10)', () => {
  it('a move that takes its board plays select then match; Undo plays undo', async () => {
    taughtAlready();
    const take = playerTakesWith();
    suspend(take.moves);
    const select = vi.spyOn(sounds, 'select');
    const match = vi.spyOn(sounds, 'match');
    const undo = vi.spyOn(sounds, 'undo');
    await onFakeClock(async () => {
      launchFromShortcut();
      await settle();
      fireEvent.click(cell(take.cell));
      expect(select).toHaveBeenCalledTimes(1);
      expect(match).toHaveBeenCalledTimes(1);
      expect(select.mock.invocationCallOrder[0]!).toBeLessThan(match.mock.invocationCallOrder[0]!);
      // The taker's mark fades in across the board it took.
      expect(board().querySelectorAll('.nt-big-fade')).toHaveLength(1);
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      expect(undo).toHaveBeenCalledTimes(1);
    });
  });
});

describe('the CPU’s one timer (§4)', () => {
  it('waits while the app is in the background, and plays once it is back', async () => {
    taughtAlready();
    await onFakeClock(async () => {
      launchFromCollection();
      await settle();
      fireEvent.click(easyButton()!);
      fireEvent.click(cell(4));
      background();
      await advance(CPU_DELAY_MS * 4);
      expect(marks()).toBe(1);
      // Saved on the CPU's turn, as it was left (§8.1).
      await settle();
      expect(storedGame()!.moves).toEqual([4]);

      foreground();
      await advance(CPU_DELAY_MS - 1);
      expect(marks()).toBe(1);
      await advance(1);
      expect(marks()).toBe(2);
    });
  });

  it('is disarmed by leaving the board, and armed again by Resume', async () => {
    taughtAlready();
    await onFakeClock(async () => {
      launchFromCollection();
      await settle();
      fireEvent.click(easyButton()!);
      fireEvent.click(cell(4));
      fireEvent.click(screen.getByRole('button', { name: 'Home' }));
      await advance(CPU_DELAY_MS * 2);
      fireEvent.click(screen.getByRole('button', { name: /^Easy.*Resume/ }));
      expect(marks()).toBe(1);
      await advance(CPU_DELAY_MS);
      expect(marks()).toBe(2);
    });
  });
});

describe('saves that fail closed (§8.2)', () => {
  const corrupt: [string, string][] = [
    [
      'an illegal move (a filled cell)',
      JSON.stringify({ ...JSON.parse(savedRecord([40])), moves: [40, 40] }),
    ],
    [
      'a move outside the board it was sent to',
      JSON.stringify({ ...JSON.parse(savedRecord([40])), moves: [40, 0] }),
    ],
    ['an unknown version', JSON.stringify({ ...JSON.parse(savedRecord([40])), schemaVersion: 2 })],
    [
      'a finished list',
      JSON.stringify({
        ...JSON.parse(savedRecord([])),
        moves: [...playerWinsWith().moves, playerWinsWith().cell],
      }),
    ],
    ['text that is not JSON', 'not json'],
  ];

  it.each(corrupt)('%s: the home, with nothing to resume and nothing started', async (_, raw) => {
    taughtAlready();
    deviceStore.set(NT_STORAGE_KEYS.saveGame, raw);
    launchFromCollection();
    await settle();
    expect(maybeBoard()).not.toBeInTheDocument();
    expect(easyButton()).not.toHaveTextContent('Resume');
    expect(storedStats()).toBeUndefined();
  });

  it('a shortcut onto a corrupt save opens the home too', async () => {
    taughtAlready();
    deviceStore.set(NT_STORAGE_KEYS.saveGame, corrupt[0]![1]);
    launchFromShortcut();
    await settle();
    expect(maybeBoard()).not.toBeInTheDocument();
    expect(easyButton()).toBeInTheDocument();
  });
});

/**
 * A pinned home-screen shortcut (issue #113, §8.3): the shell says only which
 * door was used; every decision is this game's, from its one slot.
 */
describe('a home-screen shortcut', () => {
  it('opens the suspended match straight onto its board', async () => {
    taughtAlready();
    suspend([40, 36]);
    launchFromShortcut();
    await settle();
    expect(maybeBoard()).toBeInTheDocument();
    expect(marks()).toBe(2);
    expect(turnLineText()).toBe(YOUR_TURN_SENT);
    expect(easyButton()).not.toBeInTheDocument();
  });

  it('leaves the board for this game’s home, not the collection', async () => {
    taughtAlready();
    suspend([40, 36]);
    const user = userEvent.setup();
    const onExit = launchFromShortcut();
    await settle();
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(easyButton()).toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();
  });

  it('resumes a match left on the CPU’s turn, and the CPU plays after the beat', async () => {
    taughtAlready();
    suspend([40]);
    await onFakeClock(async () => {
      launchFromShortcut();
      await settle();
      expect(turnLineText()).toBe(CPU_TURN);
      expect(marks()).toBe(1);
      await advance(CPU_DELAY_MS - 1);
      expect(marks()).toBe(1);
      await advance(1);
      expect(marks()).toBe(2);
      expect(turnLineText()).toBe(YOUR_TURN_SENT);
    });
  });

  it('opens the home when nothing is suspended', async () => {
    taughtAlready();
    launchFromShortcut();
    await settle();
    expect(maybeBoard()).not.toBeInTheDocument();
    expect(easyButton()).toBeInTheDocument();
  });

  it('is the only door that resumes: a tile still opens the home', async () => {
    taughtAlready();
    suspend([40, 36]);
    launchFromCollection();
    await settle();
    expect(maybeBoard()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Easy.*Resume/ })).toBeInTheDocument();
  });

  it('teaches the game first on a launch that has never seen Quick Rules', async () => {
    suspend([40, 36]);
    launchFromShortcut();
    expect(await screen.findByText('Your move sends theirs')).toBeInTheDocument();
    expect(maybeBoard()).not.toBeInTheDocument();
  });
});

describe('the play clock (§7)', () => {
  it("keeps a suspended board's seconds when backgrounded from the game's home (#109)", async () => {
    taughtAlready();
    await onFakeClock(async () => {
      launchFromCollection();
      await settle();
      fireEvent.click(easyButton()!);
      await advance(9_000);
      background();
      await settle();
      expect(storedGame()!.elapsedSeconds).toBe(9);

      cleanup();
      launchFromCollection();
      await settle();
      expect(screen.getByRole('button', { name: 'Statistics' })).toBeInTheDocument();
      background();
      await settle();
      expect(storedGame()!.elapsedSeconds).toBe(9);
    });
  });

  it('books the seconds since the last sync on unmount, once, and not again on remount', async () => {
    taughtAlready();
    await onFakeClock(async () => {
      launchFromCollection();
      await settle();
      fireEvent.click(easyButton()!);
      await advance(5_000);
      background();
      await settle();
      expect(storedStats()!.totalPlaySeconds).toBe(5);

      await advance(3_000);
      cleanup();
      await settle();
      expect(storedStats()!.totalPlaySeconds).toBe(8);
      expect(storedGame()!.elapsedSeconds).toBe(8);

      launchFromShortcut();
      await settle();
      expect(maybeBoard()).toBeInTheDocument();
      cleanup();
      await settle();
      expect(storedStats()!.totalPlaySeconds).toBe(8);
      expect(storedGame()!.elapsedSeconds).toBe(8);
    });
  });

  it('does not count the seconds the app spends in the background', async () => {
    taughtAlready();
    await onFakeClock(async () => {
      launchFromCollection();
      await settle();
      fireEvent.click(easyButton()!);
      await advance(2_000);
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await advance(10_000);
      Reflect.deleteProperty(document, 'visibilityState');
      foreground();
      cleanup();
      await settle();
      expect(storedStats()!.totalPlaySeconds).toBe(2);
    });
  });
});
