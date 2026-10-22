/**
 * The screens, end to end (docs/CHESS_RULES.md §12「画面の段」): Quick Rules,
 * the home's difficulty and side choice, the board's selection and marks in
 * both orientations, the promotion picker (inert board, Escape = Cancel, no
 * move played), check, Undo (button and Ctrl/Cmd+Z), the ↻ confirmation,
 * the CPU's one timer (and its pause in the background), the result card,
 * saves that fail closed, the shortcut door, and the play clock's booking.
 *
 * The CPU moves on a real `setTimeout` with the search inside it
 * (state/GameContext.tsx `CPU_DELAY_MS`), so the tests that need its reply
 * own the clock and step it (the reason ReversiRoot.test.tsx gives, issue
 * #158), and drive the screen with `fireEvent` under fake timers. Every CPU
 * here plays Easy, whose reply is one static look per legal move (§5.1).
 *
 * Saves go to Capacitor Preferences, mocked as a Map — the device store every
 * launch below loads from and saves to.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { CPU_DELAY_MS } from '../state/GameContext';
import { CH_STORAGE_KEYS, type PersistedGame, type Prefs, type Stats } from '../storage/schemas';
import { ChessRoot } from './ChessRoot';
import {
  BLACK_IN_CHECK,
  CPU_TO_MOVE,
  FOOLS_MATE_FOR_BLACK,
  PROMOTION,
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
      <ChessRoot onExit={onExit} />
    </SettingsProvider>,
  );
  return onExit;
}

/** The same store, entered by the other door. */
function launchFromShortcut() {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <ChessRoot onExit={onExit} entry="shortcut" />
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

const storedStats = () => stored<Stats>(CH_STORAGE_KEYS.stats);
const storedGame = () => stored<PersistedGame>(CH_STORAGE_KEYS.game);
const storedPrefs = () => stored<Prefs>(CH_STORAGE_KEYS.prefs);

function taughtAlready() {
  deviceStore.set(
    CH_STORAGE_KEYS.flags,
    JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
  );
}

function suspend(moves: string, options?: Parameters<typeof savedRecord>[1]) {
  deviceStore.set(CH_STORAGE_KEYS.game, savedRecord(moves, options));
}

const board = () => screen.getByRole('group', { name: 'Chess board' });
const maybeBoard = () => screen.queryByRole('group', { name: 'Chess board' });
const squares = () => [...board().querySelectorAll<HTMLButtonElement>('.ch-square')];
const enabledSquares = () => squares().filter((square) => !square.disabled);
const square = (name: string) =>
  board().querySelector<HTMLButtonElement>(`.ch-square[data-square="${name}"]`)!;
const pieces = () => board().querySelectorAll('.ch-piece').length;
const turnLineText = () => document.querySelector('.ch-turn-line')!.textContent;
const easyButton = () => screen.queryByRole('button', { name: /^Easy/ });

const YOUR_TURN = 'Your turn';
const CPU_TURN = 'CPU’s turn';

afterEach(async () => {
  cleanup();
  // Unmounting saves (docs/GAME_LIFECYCLE.md「アンマウントで計上する」), and
  // saves are fire-and-forget: let them land before wiping the store.
  await act(async () => undefined);
  deviceStore.clear();
  vi.restoreAllMocks();
});

describe('first run (§8)', () => {
  it('teaches three steps with figures, then sets the standard position', async () => {
    const user = userEvent.setup();
    launchFromCollection();

    expect(await screen.findByText('Each piece moves its own way')).toBeInTheDocument();
    // The figure is the board's own squares and pieces: a knight and its dots.
    expect(document.querySelectorAll('.ch-figure .ch-mark-move')).toHaveLength(8);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Capture, but keep your king safe')).toBeInTheDocument();
    expect(document.querySelectorAll('.ch-figure .ch-mark-capture')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Checkmate wins')).toBeInTheDocument();
    expect(document.querySelectorAll('.ch-figure .ch-check-ring')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // Sixty-four squares, thirty-two pieces, White to move — the player (§1).
    expect(squares()).toHaveLength(64);
    expect(pieces()).toBe(32);
    expect(turnLineText()).toBe(YOUR_TURN);
    // The first game counts as played when it starts (§7.3).
    await settle();
    expect(storedStats()!.easy.played).toBe(1);
  });

  it('resumes a suspended game on Start Playing rather than replace it (§7.1)', async () => {
    const user = userEvent.setup();
    suspend('e2e4 e7e5');
    launchFromCollection();
    await screen.findByText('Each piece moves its own way');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));
    expect(square('e4')).toHaveAccessibleName('e4, white pawn');
    expect(square('e5')).toHaveAccessibleName('e5, black pawn');
    await settle();
    expect(storedStats()).toBeUndefined();
  });
});

describe('the board (§1, §4, §9)', () => {
  it('picks a piece up, marks where it can go, and puts it down', async () => {
    taughtAlready();
    await onFakeClock(async () => {
      launchFromCollection();
      await settle();
      fireEvent.click(easyButton()!);

      // Only the pieces that can move are pressable: eight pawns, two knights.
      expect(enabledSquares()).toHaveLength(10);
      expect(square('e2')).toHaveAccessibleName('e2, white pawn');
      fireEvent.click(square('e2'));
      expect(square('e2')).toHaveAccessibleName('e2, white pawn, selected');
      expect(square('e3')).toHaveAccessibleName('e3: move here');
      expect(square('e4')).toHaveAccessibleName('e4: move here');
      expect(board().querySelectorAll('.ch-mark-move')).toHaveLength(2);

      // Another of your pieces picks that one up instead; the same one puts it back.
      fireEvent.click(square('g1'));
      expect(square('g1')).toHaveAccessibleName('g1, white knight, selected');
      fireEvent.click(square('g1'));
      expect(board().querySelectorAll('.ch-mark-move')).toHaveLength(0);

      fireEvent.click(square('e2'));
      fireEvent.click(square('e4'));
      expect(square('e4')).toHaveAccessibleName('e4, white pawn');
      expect(square('e2')).toHaveAccessibleName('e2, empty');
      // The last move is marked on both of its squares (§9).
      expect(square('e2')).toHaveAttribute('data-last');
      expect(square('e4')).toHaveAttribute('data-last');
      expect(turnLineText()).toBe(CPU_TURN);
      expect(enabledSquares()).toHaveLength(0);
    });
  });

  it('is drawn with the player at the bottom: White from a8, Black from h1 (§1)', async () => {
    taughtAlready();
    launchFromCollection();
    fireEvent.click(await screen.findByRole('button', { name: /^Easy/ }));
    expect(squares()[0]).toHaveAttribute('data-square', 'a8');
    expect(squares()[63]).toHaveAttribute('data-square', 'h1');
    cleanup();
    // Unmounting saves the game it held; let that land before replacing it.
    await settle();

    suspend('e2e4', { side: 'black' });
    launchFromCollection();
    fireEvent.click(await screen.findByRole('button', { name: /^Easy.*Resume/ }));
    expect(squares()[0]).toHaveAttribute('data-square', 'h1');
    expect(squares()[63]).toHaveAttribute('data-square', 'a8');
    expect(screen.getByText('You play Black')).toBeInTheDocument();
  });

  it('marks a capture with a ring, a quiet move with a dot (§4)', async () => {
    taughtAlready();
    suspend('e2e4 d7d5');
    launchFromCollection();
    fireEvent.click(await screen.findByRole('button', { name: /^Easy.*Resume/ }));
    fireEvent.click(square('e4'));
    expect(square('d5')).toHaveAccessibleName('d5, black pawn: capture here');
    expect(square('d5').querySelector('.ch-mark-capture')).not.toBeNull();
    expect(square('e5').querySelector('.ch-mark-move')).not.toBeNull();
  });

  it('says check in the turn line and rings the king, and offers only the answers (§4, §9)', async () => {
    taughtAlready();
    suspend(BLACK_IN_CHECK, { side: 'black' });
    launchFromCollection();
    fireEvent.click(await screen.findByRole('button', { name: /^Easy.*Resume/ }));
    expect(turnLineText()).toBe('Check — your king is attacked');
    expect(square('e8')).toHaveAccessibleName('e8, black king, in check');
    expect(square('e8').querySelector('.ch-check-ring')).not.toBeNull();
    // g6 is the one move that answers Qh5+: only the g-pawn can be picked up.
    expect(enabledSquares().map((element) => element.dataset.square)).toEqual(['g7']);
  });

  it('holds still under Reduced Motion, and slides when nothing asks it not to (§9)', async () => {
    taughtAlready();
    launchFromCollection();
    fireEvent.click(await screen.findByRole('button', { name: /^Easy/ }));
    // jsdom has no matchMedia, which reads as Reduced Motion on (the quiet side).
    expect(board()).toHaveClass('ch-board-still');
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
      expect(board()).not.toHaveClass('ch-board-still');
      fireEvent.click(square('g1'));
      fireEvent.click(square('f3'));
      expect(board().querySelectorAll('.ch-piece-move')).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('shows no clock and offers no hint (§6, §9)', async () => {
    taughtAlready();
    launchFromCollection();
    fireEvent.click(await screen.findByRole('button', { name: /^Easy/ }));
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();
  });

  it('plays from the keyboard: the squares are buttons Enter presses', async () => {
    taughtAlready();
    const user = userEvent.setup();
    launchFromCollection();
    await user.click(await screen.findByRole('button', { name: /^Easy/ }));
    square('d2').focus();
    await user.keyboard('{Enter}');
    expect(square('d2')).toHaveAccessibleName('d2, white pawn, selected');
    square('d4').focus();
    await user.keyboard('{Enter}');
    expect(square('d4')).toHaveAccessibleName('d4, white pawn');
  });
});

describe('promotion (§2.6, §4)', () => {
  it('asks for the piece first, queen focused, and the board inert while it asks', async () => {
    taughtAlready();
    suspend(PROMOTION);
    launchFromCollection();
    fireEvent.click(await screen.findByRole('button', { name: /^Easy.*Resume/ }));
    fireEvent.click(square('b7'));
    fireEvent.click(square('b8'));

    const picker = screen.getByRole('dialog', { name: 'Promote the pawn to' });
    const choices = within(picker).getAllByRole('button');
    expect(
      choices.map((choice) => choice.getAttribute('aria-label') ?? choice.textContent),
    ).toEqual(['white queen', 'white rook', 'white bishop', 'white knight', 'Cancel']);
    expect(choices[0]).toHaveFocus();
    expect(document.querySelector('.game-content')).toHaveAttribute('inert');
    // Nothing has been played yet.
    expect(square('b7')).toHaveAccessibleName('b7, white pawn, selected');
  });

  it('Escape cancels without moving, and the pawn stays in hand', async () => {
    taughtAlready();
    const user = userEvent.setup();
    suspend(PROMOTION);
    launchFromCollection();
    await user.click(await screen.findByRole('button', { name: /^Easy.*Resume/ }));
    await user.click(square('b7'));
    await user.click(square('b8'));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(square('b7')).toHaveAccessibleName('b7, white pawn, selected');
    expect(square('b8')).toHaveAccessibleName('b8: move here');
    expect(document.querySelector('.game-content')).not.toHaveAttribute('inert');
    await settle();
    expect(storedGame()!.moves).toBe(PROMOTION);
  });

  it('plays the piece chosen, a capture included', async () => {
    taughtAlready();
    await onFakeClock(async () => {
      suspend(PROMOTION);
      launchFromCollection();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /^Easy.*Resume/ }));
      fireEvent.click(square('b7'));
      fireEvent.click(square('a8'));
      fireEvent.click(screen.getByRole('button', { name: 'white knight' }));
      expect(square('a8')).toHaveAccessibleName('a8, white knight');
      expect(square('b7')).toHaveAccessibleName('b7, empty');
      await settle();
      expect(storedGame()!.moves).toBe(`${PROMOTION} b7a8n`);
    });
  });
});

describe('Undo (§6)', () => {
  it('takes the CPU’s reply and the player’s move back together', async () => {
    taughtAlready();
    await onFakeClock(async () => {
      launchFromCollection();
      await settle();
      fireEvent.click(easyButton()!);
      const undoButton = screen.getByRole('button', { name: 'Undo' });
      expect(undoButton).toBeDisabled();
      fireEvent.click(square('e2'));
      fireEvent.click(square('e4'));
      await advance(CPU_DELAY_MS);
      expect(turnLineText()).toBe(YOUR_TURN);
      fireEvent.click(undoButton);
      expect(square('e2')).toHaveAccessibleName('e2, white pawn');
      expect(pieces()).toBe(32);
      expect(undoButton).toBeDisabled();
      await settle();
      expect(storedGame()!.moves).toBe('');
    });
  });

  it('takes the player’s move alone during the CPU’s pause, and disarms its reply', async () => {
    taughtAlready();
    await onFakeClock(async () => {
      launchFromCollection();
      await settle();
      fireEvent.click(easyButton()!);
      fireEvent.click(square('e2'));
      fireEvent.click(square('e4'));
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      await advance(CPU_DELAY_MS * 3);
      expect(turnLineText()).toBe(YOUR_TURN);
      expect(square('e2')).toHaveAccessibleName('e2, white pawn');
      await settle();
      expect(storedGame()!.moves).toBe('');
    });
  });

  it('Ctrl+Z does what the button does', async () => {
    taughtAlready();
    await onFakeClock(async () => {
      launchFromCollection();
      await settle();
      fireEvent.click(easyButton()!);
      fireEvent.click(square('e2'));
      fireEvent.click(square('e4'));
      await advance(CPU_DELAY_MS);
      fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
      expect(square('e2')).toHaveAccessibleName('e2, white pawn');
      expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    });
  });

  it('never takes back the CPU’s opening move when the player is Black', async () => {
    taughtAlready();
    await onFakeClock(async () => {
      deviceStore.set(
        CH_STORAGE_KEYS.prefs,
        JSON.stringify({ schemaVersion: 1, playerIsWhite: false }),
      );
      launchFromCollection();
      await settle();
      fireEvent.click(easyButton()!);
      expect(turnLineText()).toBe(CPU_TURN);
      await advance(CPU_DELAY_MS);
      expect(turnLineText()).toBe(YOUR_TURN);
      expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    });
  });

  it('works on a resumed game: the list is the history (§6, §7.1)', async () => {
    taughtAlready();
    suspend('e2e4 e7e5 g1f3 b8c6');
    launchFromCollection();
    fireEvent.click(await screen.findByRole('button', { name: /^Easy.*Resume/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(square('g1')).toHaveAccessibleName('g1, white knight');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(square('e2')).toHaveAccessibleName('e2, white pawn');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});

describe('the side (§1, §7.2)', () => {
  it('is White by default, kept in ch.prefs, and the CPU opens when the player takes Black', async () => {
    taughtAlready();
    await onFakeClock(async () => {
      launchFromCollection();
      await settle();
      const white = screen.getByRole('radio', { name: /White \(moves first\)/ });
      const black = screen.getByRole('radio', { name: /Black \(moves second\)/ });
      expect(white).toBeChecked();
      fireEvent.click(black);
      expect(black).toBeChecked();
      await settle();
      expect(storedPrefs()).toEqual({ schemaVersion: 1, playerIsWhite: false });

      fireEvent.click(easyButton()!);
      expect(turnLineText()).toBe(CPU_TURN);
      await advance(CPU_DELAY_MS);
      expect(turnLineText()).toBe(YOUR_TURN);
      expect(squares()[0]).toHaveAttribute('data-square', 'h1');
    });
  });

  it('leaves the game in progress on the side it started with', async () => {
    taughtAlready();
    suspend('e2e4 e7e5');
    launchFromCollection();
    fireEvent.click(await screen.findByRole('radio', { name: /Black/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Easy.*Resume/ }));
    expect(screen.getByText('You play White')).toBeInTheDocument();
    expect(turnLineText()).toBe(YOUR_TURN);
  });
});

describe('the home (§1)', () => {
  it('resumes the same difficulty, and asks before replacing it with another', async () => {
    taughtAlready();
    suspend('e2e4 e7e5');
    launchFromCollection();
    fireEvent.click(await screen.findByRole('button', { name: /^Normal/ }));
    expect(
      screen.getByRole('alertdialog', { name: 'Replace the game in progress?' }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(maybeBoard()).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Easy.*Resume/ }));
    expect(square('e4')).toHaveAccessibleName('e4, white pawn');
  });

  it('exits to the collection', async () => {
    taughtAlready();
    const onExit = launchFromCollection();
    fireEvent.click(await screen.findByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('reports a record per difficulty — played, won, drawn, lost — and no streak (§7.3)', async () => {
    taughtAlready();
    deviceStore.set(
      CH_STORAGE_KEYS.stats,
      JSON.stringify({
        schemaVersion: 1,
        totalPlaySeconds: 125,
        easy: { played: 4, wins: 2, losses: 1, draws: 1 },
        normal: { played: 0, wins: 0, losses: 0, draws: 0 },
        hard: { played: 0, wins: 0, losses: 0, draws: 0 },
      }),
    );
    launchFromCollection();
    expect(
      await screen.findByRole('button', { name: /^Easy.*Won 2 · Drawn 1 · Lost 1/ }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Statistics' }));
    expect(screen.getAllByText('Games played')).toHaveLength(3);
    expect(screen.getAllByText('Draws')).toHaveLength(3);
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});

describe('the ↻ (§9)', () => {
  it('asks first, holds the board inert while it asks, and Escape cancels', async () => {
    taughtAlready();
    const user = userEvent.setup();
    suspend('e2e4 e7e5');
    launchFromCollection();
    await user.click(await screen.findByRole('button', { name: /^Easy.*Resume/ }));
    await user.click(screen.getByRole('button', { name: 'New Game' }));
    expect(screen.getByRole('alertdialog')).toBeVisible();
    expect(document.querySelector('.game-content')).toHaveAttribute('inert');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(square('e4')).toHaveAccessibleName('e4, white pawn');

    await user.click(screen.getByRole('button', { name: 'New Game' }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(square('e4')).toHaveAccessibleName('e4, empty');
    await settle();
    // The game it replaced counted when it started; it is not a loss (§7.3).
    expect(storedStats()!.easy).toEqual({ played: 1, wins: 0, losses: 0, draws: 0 });
  });
});

describe('the result card (§3, §9)', () => {
  it('states the result and its reason apart, books it once, and offers the next game', async () => {
    taughtAlready();
    suspend(FOOLS_MATE_FOR_BLACK, { side: 'black' });
    launchFromCollection();
    fireEvent.click(await screen.findByRole('button', { name: /^Easy.*Resume/ }));
    fireEvent.click(square('d8'));
    fireEvent.click(square('h4'));

    const card = screen.getByRole('alertdialog', { name: 'You win' });
    expect(
      within(card).getByText('Checkmate: the king is in check and has no legal move.'),
    ).toBeInTheDocument();
    expect(within(card).getByText('Easy')).toBeInTheDocument();
    expect(within(card).getByText('Black')).toBeInTheDocument();
    // Two moves each: Black's second is the mate.
    expect(within(card).getByText('2')).toBeInTheDocument();
    expect(document.querySelector('.game-content')).toHaveAttribute('inert');
    // Never a praise title.
    expect(screen.queryByText(/nice|great|well done/i)).not.toBeInTheDocument();

    await settle();
    expect(storedStats()!.easy.wins).toBe(1);
    // A finished game is not saved (§7.1).
    expect(storedGame()).toBeUndefined();

    fireEvent.click(within(card).getByRole('button', { name: 'New Game' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await settle();
    expect(storedStats()!.easy).toEqual({ played: 1, wins: 1, losses: 0, draws: 0 });
  });
});

describe('the CPU’s one timer (§5)', () => {
  it('answers on CPU_DELAY_MS, and not a tick before', async () => {
    taughtAlready();
    await onFakeClock(async () => {
      launchFromCollection();
      await settle();
      fireEvent.click(easyButton()!);
      fireEvent.click(square('e2'));
      fireEvent.click(square('e4'));
      await advance(CPU_DELAY_MS - 1);
      expect(turnLineText()).toBe(CPU_TURN);
      await advance(1);
      expect(turnLineText()).toBe(YOUR_TURN);
      expect(pieces()).toBe(32);
    });
  });

  it('waits while the app is in the background, and plays once it is back', async () => {
    taughtAlready();
    await onFakeClock(async () => {
      launchFromCollection();
      await settle();
      fireEvent.click(easyButton()!);
      fireEvent.click(square('e2'));
      fireEvent.click(square('e4'));
      background();
      await advance(CPU_DELAY_MS * 4);
      expect(turnLineText()).toBe(CPU_TURN);
      // Saved on the CPU's turn, as it was left (§7.1).
      await settle();
      expect(storedGame()!.moves).toBe('e2e4');

      foreground();
      await advance(CPU_DELAY_MS - 1);
      expect(turnLineText()).toBe(CPU_TURN);
      await advance(1);
      expect(turnLineText()).toBe(YOUR_TURN);
    });
  });

  it('is disarmed by leaving the board, and armed again by Resume', async () => {
    taughtAlready();
    await onFakeClock(async () => {
      launchFromCollection();
      await settle();
      fireEvent.click(easyButton()!);
      fireEvent.click(square('e2'));
      fireEvent.click(square('e4'));
      fireEvent.click(screen.getByRole('button', { name: 'Home' }));
      await advance(CPU_DELAY_MS * 2);
      fireEvent.click(screen.getByRole('button', { name: /^Easy.*Resume/ }));
      expect(turnLineText()).toBe(CPU_TURN);
      await advance(CPU_DELAY_MS);
      expect(turnLineText()).toBe(YOUR_TURN);
    });
  });
});

describe('saves that fail closed (§7.1)', () => {
  const base = JSON.parse(savedRecord('e2e4 e7e5')) as Record<string, unknown>;
  const corrupt: [string, string][] = [
    ['an illegal move', JSON.stringify({ ...base, moves: 'e2e4 e7e4' })],
    ['a move out of turn', JSON.stringify({ ...base, moves: 'e2e4 e4e5' })],
    ['a malformed token', JSON.stringify({ ...base, moves: 'e2e4 O-O' })],
    ['two spaces', JSON.stringify({ ...base, moves: 'e2e4  e7e5' })],
    [
      'a move after the mate',
      JSON.stringify({ ...base, moves: `${FOOLS_MATE_FOR_BLACK} d8h4 a2a3` }),
    ],
    ['a finished game', JSON.stringify({ ...base, moves: `${FOOLS_MATE_FOR_BLACK} d8h4` })],
    ['an unknown side', JSON.stringify({ ...base, side: 'red' })],
    ['an unknown difficulty', JSON.stringify({ ...base, difficulty: 'expert' })],
    ['an unknown version', JSON.stringify({ ...base, schemaVersion: 2 })],
    ['moves that are not text', JSON.stringify({ ...base, moves: ['e2e4'] })],
    ['text that is not JSON', 'not json'],
  ];

  it.each(corrupt)('%s: the home, with nothing to resume and nothing started', async (_, raw) => {
    taughtAlready();
    deviceStore.set(CH_STORAGE_KEYS.game, raw);
    launchFromCollection();
    await settle();
    expect(easyButton()).toBeInTheDocument();
    expect(maybeBoard()).not.toBeInTheDocument();
    expect(easyButton()).not.toHaveTextContent('Resume');
    expect(storedStats()).toBeUndefined();
  });

  it('a shortcut onto a corrupt save opens the home too', async () => {
    taughtAlready();
    deviceStore.set(CH_STORAGE_KEYS.game, corrupt[0]![1]);
    launchFromShortcut();
    await settle();
    expect(maybeBoard()).not.toBeInTheDocument();
    expect(easyButton()).toBeInTheDocument();
  });
});

/**
 * A pinned home-screen shortcut (issue #113, §7.1): the shell says only which
 * door was used; every decision is this game's, from its one slot.
 */
describe('a home-screen shortcut', () => {
  it('opens the suspended game straight onto its board', async () => {
    taughtAlready();
    suspend('e2e4 e7e5');
    launchFromShortcut();
    await settle();
    expect(maybeBoard()).toBeInTheDocument();
    expect(square('e5')).toHaveAccessibleName('e5, black pawn');
  });

  it('leaves the board for this game’s home, not the collection', async () => {
    taughtAlready();
    suspend('e2e4 e7e5');
    const onExit = launchFromShortcut();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(easyButton()).toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();
  });

  it('resumes a game left on the CPU’s turn, and the CPU plays after the beat', async () => {
    taughtAlready();
    await onFakeClock(async () => {
      suspend(CPU_TO_MOVE);
      launchFromShortcut();
      await settle();
      expect(turnLineText()).toBe(CPU_TURN);
      await advance(CPU_DELAY_MS - 1);
      expect(turnLineText()).toBe(CPU_TURN);
      await advance(1);
      expect(turnLineText()).toBe(YOUR_TURN);
      await settle();
      expect(storedGame()!.moves.split(' ')).toHaveLength(2);
    });
  });

  it('opens the home when nothing is suspended', async () => {
    taughtAlready();
    launchFromShortcut();
    await settle();
    expect(easyButton()).toBeInTheDocument();
    expect(maybeBoard()).not.toBeInTheDocument();
  });

  it('is the only door that resumes: a tile still opens the home', async () => {
    taughtAlready();
    suspend('e2e4 e7e5');
    launchFromCollection();
    await settle();
    expect(maybeBoard()).not.toBeInTheDocument();
    expect(easyButton()).toHaveTextContent('Resume');
  });

  it('teaches the game first on a launch that has never seen Quick Rules', async () => {
    suspend('e2e4 e7e5');
    launchFromShortcut();
    expect(await screen.findByText('Each piece moves its own way')).toBeInTheDocument();
    expect(maybeBoard()).not.toBeInTheDocument();
  });
});

describe('the play clock (§7.3)', () => {
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
});
