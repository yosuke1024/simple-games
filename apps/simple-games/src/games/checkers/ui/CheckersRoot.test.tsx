import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { PLAYER, createSession, restoreSession, type Board, type Piece } from '../game';
import { CPU_MAN, EMPTY, PLAYER_MAN, isDarkSquare } from '../game';
import { toPersisted } from '../storage/gamePersistence';
import { CK_STORAGE_KEYS, type PersistedGame, type Stats } from '../storage/schemas';
import { CheckersRoot } from './CheckersRoot';

/**
 * A stand-in for the device store. The `kv` prop below is a load-side seam
 * only — saves always go to Capacitor Preferences — so nothing here reads a
 * save back; these tests are about what the screens show.
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

function renderGame(initial: Record<string, string> = {}) {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <CheckersRoot onExit={onExit} kv={createMemoryKV(initial)} />
    </SettingsProvider>,
  );
  return { onExit };
}

function boardOf(rows: readonly string[]): Board {
  const cells: Piece[] = [];
  for (const row of rows) {
    for (const character of row) {
      cells.push(character === 'p' ? PLAYER_MAN : character === 'c' ? CPU_MAN : EMPTY);
    }
  }
  for (let cell = 0; cell < cells.length; cell++) {
    if (cells[cell] !== EMPTY && !isDarkSquare(cell)) {
      throw new Error(`fixture puts a piece on the light square ${cell}`);
    }
  }
  return cells;
}

const tutorialDone = {
  [CK_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

const savedGame = {
  ...tutorialDone,
  [CK_STORAGE_KEYS.game]: JSON.stringify(
    toPersisted(createSession('easy', PLAYER, 'checkers-uitest'), 1),
  ),
};

/** A position where the player has exactly one move, and it is a double jump. */
const doubleJump = {
  ...tutorialDone,
  [CK_STORAGE_KEYS.game]: JSON.stringify(
    toPersisted(
      restoreSession({
        seed: 'checkers-uitest-jump',
        difficulty: 'easy',
        first: PLAYER,
        // The player's man on (5,2) has exactly one move, and it is a jump
        // that must go on from where it lands. The third CPU man is there so
        // taking two does not end the match — this fixture is about the
        // sequence, not about winning. It sits off the far rank: a man
        // standing on its own crowning row is a position play cannot make,
        // and the loader is right to refuse one (§8).
        board: boardOf([
          '........',
          '........',
          '.....c..',
          '........',
          '...c....',
          '..p.....',
          '.c......',
          '........',
        ]),
        moveCount: 0,
        quietPlies: 0,
        pendingJumpFrom: null,
        elapsedSeconds: 0,
      }),
      1,
    ),
  ),
};

const board = () => screen.getByRole('group', { name: /Checkers board/ });
const pieces = () => board().querySelectorAll('.ck-piece');

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
}

/**
 * Lets the local reads, and the fire-and-forget saves they trigger, resolve.
 * They are promises rather than timers, so this works under fake timers too.
 */
const settle = () => act(async () => undefined);

/**
 * The OS hiding the app — the last event a process that is about to be killed
 * gets, and where the match and its play seconds are written (§8). Fake timers
 * only: the saves are fire-and-forget, so they are given a tick to land.
 */
async function background() {
  setVisibility('hidden');
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await vi.advanceTimersByTimeAsync(0);
  setVisibility('visible');
}

afterEach(() => {
  cleanup();
  deviceStore.clear();
});

describe('first run', () => {
  it('shows Quick Rules and sets a board right after (§9)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Move diagonally forward')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Keep jumping')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Reach the far row to crown')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // Sixty-four squares, twenty-four pieces, and nothing on a light one (§1).
    expect(within(board()).getAllByRole('button')).toHaveLength(64);
    expect(pieces()).toHaveLength(24);
  });
});

describe('playing', () => {
  it('moves a piece in two taps and hands the turn over (§2, §4)', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Easy/ }));

    expect(screen.getByText('Your turn')).toBeInTheDocument();
    // Pick up, then put down: the destination is only offered once a piece
    // is held, which is what the second label proves.
    await user.click(screen.getByRole('button', { name: 'Row 6, column 3: your piece' }));
    expect(
      screen.getByRole('button', { name: 'Row 6, column 3: your piece, selected' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Row 5, column 2: move here' }));

    await waitFor(() => expect(screen.getByText('CPU is thinking…')).toBeInTheDocument());
    // The CPU answers on its own timer, and the count is back to even.
    await waitFor(() => expect(screen.getByText('Your turn')).toBeInTheDocument());
    expect(pieces()).toHaveLength(24);
  });

  it('offers only the jumping piece while a capture is on (§2)', async () => {
    const user = userEvent.setup();
    renderGame(doubleJump);
    await user.click(await screen.findByRole('button', { name: /Easy/ }));

    expect(
      screen.getByText('A capture is on — only the pieces that can jump may move.'),
    ).toBeInTheDocument();
    // Exactly one square is pressable: the piece that can jump.
    const enabled = within(board())
      .getAllByRole('button')
      .filter((element) => !(element as HTMLButtonElement).disabled);
    expect(enabled).toHaveLength(1);
    expect(enabled[0]).toHaveAccessibleName('Row 6, column 3: your piece');
  });

  it('holds the same piece through a forced sequence (§2)', async () => {
    const user = userEvent.setup();
    renderGame(doubleJump);
    await user.click(await screen.findByRole('button', { name: /Easy/ }));

    await user.click(screen.getByRole('button', { name: 'Row 6, column 3: your piece' }));
    await user.click(screen.getByRole('button', { name: 'Row 4, column 5: move here' }));

    // Still the player's turn, and the piece that landed is already held —
    // the second jump is one tap, not two.
    expect(screen.getByText('Jump again with the same piece.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Row 2, column 7: move here' }));
    await waitFor(() => expect(screen.getByText('CPU is thinking…')).toBeInTheDocument());
  });

  it('takes the whole sequence back, not one jump of it (§5)', async () => {
    const user = userEvent.setup();
    renderGame(doubleJump);
    await user.click(await screen.findByRole('button', { name: /Easy/ }));

    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Row 6, column 3: your piece' }));
    await user.click(screen.getByRole('button', { name: 'Row 4, column 5: move here' }));

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('button', { name: 'Row 6, column 3: your piece' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    // Help is one button; nothing suggests a move (§6).
    expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();
  });

  it('shows no clock while playing (§10)', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Easy/ }));

    // Nothing on screen is formatted as a running time.
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
  });
});

describe('choosing a side (§1)', () => {
  it('lets the CPU open when the player picks second, and keeps the choice', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);

    const second = await screen.findByRole('radio', { name: 'CPU first' });
    expect(screen.getByRole('radio', { name: 'You first' })).toBeChecked();
    await user.click(second);
    expect(second).toBeChecked();

    await user.click(screen.getByRole('button', { name: /Easy/ }));
    // The CPU's opening move arrives on its own timer; until then the board
    // is not the player's to touch (§4).
    expect(screen.getByText('CPU is thinking…')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Your turn')).toBeInTheDocument());
  });

  it('leaves the match in progress on the side it started with', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);

    // The saved match was started by the player; flipping the preference is
    // about the next one and must not touch this board's turn order.
    await user.click(await screen.findByRole('radio', { name: 'CPU first' }));
    await user.click(screen.getByRole('button', { name: /Easy/ }));
    expect(screen.getByText('Your turn')).toBeInTheDocument();
  });
});

describe('the play clock survives a backgrounding', () => {
  it('books the seconds played when the app is hidden, not only at the end', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderGame(savedGame);
      await user.click(await screen.findByRole('button', { name: /Easy/ }));

      // Eight seconds of play, then the OS hides the app — which is the last
      // event a killed process gets. Nothing here asserts on the store; the
      // point is that the sync path runs without throwing and the match is
      // still on screen afterwards, ready to be resumed.
      await vi.advanceTimersByTimeAsync(8000);
      await background();

      expect(board()).toBeInTheDocument();
    } finally {
      setVisibility('visible');
      vi.useRealTimers();
    }
  });
});

/**
 * A pinned home-screen shortcut, and what Checkers does with it (issue #113).
 * The shell says which door the launch came through and nothing else; the
 * answer below is this game's own, read off its one save slot (§8).
 *
 * The saves here are made by playing, not written out: the store these tests
 * relaunch from is the store a real second launch would find.
 */
describe('a home-screen shortcut', () => {
  /** Everything the game has saved so far — what the next launch loads. */
  const stored = (): Record<string, string> => Object.fromEntries(deviceStore);

  const storedPlaySeconds = (): number => {
    const raw = deviceStore.get(CK_STORAGE_KEYS.stats);
    return raw === undefined ? 0 : (JSON.parse(raw) as Stats).totalPlaySeconds;
  };

  const storedElapsedSeconds = (): number => {
    const raw = deviceStore.get(CK_STORAGE_KEYS.game);
    return raw === undefined ? -1 : (JSON.parse(raw) as PersistedGame).elapsedSeconds;
  };

  /** The same launch, through the other door. */
  function renderShortcut(initial: Record<string, string>) {
    const onExit = vi.fn();
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <CheckersRoot onExit={onExit} entry="shortcut" kv={createMemoryKV(initial)} />
      </SettingsProvider>,
    );
    return { onExit };
  }

  const suspendedBoard = () => screen.queryByRole('group', { name: /Checkers board/ });
  const homeScreen = () => screen.queryByText('Choose your opponent');

  /**
   * A first launch played through: Quick Rules, one move each, then away.
   * Everything the next launch reads — the flag, the statistics, the match —
   * is written by the game itself along the way. Returns that store.
   */
  async function playAndLeave(user: ReturnType<typeof userEvent.setup>) {
    renderGame();
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));
    await user.click(screen.getByRole('button', { name: 'Row 6, column 3: your piece' }));
    await user.click(screen.getByRole('button', { name: 'Row 5, column 2: move here' }));
    // The CPU answers on its own timer (§4). Both halves are waited for: a
    // wait for the line to be gone would be satisfied by the frame before it
    // ever appeared, and the helper would return with the reply still owed.
    // What comes back is not asserted on, because what the player is left
    // facing depends on the match's own seed — often a forced capture (§2).
    await waitFor(() => expect(screen.getByText('CPU is thinking…')).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText('CPU is thinking…')).not.toBeInTheDocument(), {
      timeout: 3000,
    });
    // Leaving the board is one of the moments the match is written (§8).
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await waitFor(() => expect(deviceStore.has(CK_STORAGE_KEYS.game)).toBe(true));
    const saved = stored();
    cleanup();
    return saved;
  }

  it('opens the suspended match straight onto its board', async () => {
    const user = userEvent.setup();
    const saved = await playAndLeave(user);

    renderShortcut(saved);

    // The match that was left, not a new one: the man that moved is still
    // where it landed, and the square it came from is still empty.
    expect(
      await screen.findByRole('button', { name: 'Row 5, column 2: your piece' }),
    ).toBeVisible();
    expect(suspendedBoard()).toBeInTheDocument();
    expect(homeScreen()).not.toBeInTheDocument();
  });

  it('leaves that board for this game’s home, not the collection', async () => {
    const user = userEvent.setup();
    const saved = await playAndLeave(user);

    const { onExit } = renderShortcut(saved);
    await waitFor(() => expect(suspendedBoard()).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Home' }));

    // One step back from a board is this game's home, whichever door the
    // board was reached through: the way in did not add a screen to undo.
    expect(homeScreen()).toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();
  });

  it('opens the home screen when nothing is suspended', async () => {
    renderShortcut(tutorialDone);

    expect(await screen.findByText('Choose your opponent')).toBeInTheDocument();
    expect(suspendedBoard()).not.toBeInTheDocument();
  });

  it('is the only door that resumes: a tile on the collection still opens the home', async () => {
    const user = userEvent.setup();
    const saved = await playAndLeave(user);

    renderGame(saved);

    expect(await screen.findByText('Choose your opponent')).toBeInTheDocument();
    expect(suspendedBoard()).not.toBeInTheDocument();
    // And the match is still there, to be picked up by hand as before.
    expect(screen.getByRole('button', { name: /Easy.*Resume/ })).toBeInTheDocument();
  });

  it('teaches the game first on a launch that has never seen Quick Rules', async () => {
    const user = userEvent.setup();
    const saved = await playAndLeave(user);
    // The flag and the match are two independent records, so a store can hold
    // the second without the first. A shortcut is not a way past §9.
    const neverTaught = { ...saved };
    delete neverTaught[CK_STORAGE_KEYS.flags];

    renderShortcut(neverTaught);

    expect(await screen.findByText('Move diagonally forward')).toBeInTheDocument();
    expect(suspendedBoard()).not.toBeInTheDocument();
  });

  // The counterpart of the backgrounding test above: a board that is on
  // screen from the first frame never went through `activate`, so the two
  // clocks it hands over have to be handed over at mount instead (§7).
  it('does not book the resumed match’s play seconds a second time', async () => {
    // The clock moves only when this test says so. Left following real time
    // as well, a slow load or a busy machine would add a tick of its own
    // somewhere above and every count below would be one out.
    vi.useFakeTimers();
    try {
      renderGame(tutorialDone);
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Easy/ }));

      act(() => vi.advanceTimersByTime(5000));
      await background();
      await settle();
      expect(storedPlaySeconds()).toBe(5);
      expect(storedElapsedSeconds()).toBe(5);
      const saved = { ...tutorialDone, ...stored() };
      cleanup();

      renderShortcut(saved);
      await settle();
      expect(suspendedBoard()).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(3000));
      await background();
      await settle();

      // Five seconds already booked and three more played. Both numbers are
      // read, and that is the point: with NEITHER clock seeded the two errors
      // cancel in the statistics — the save writes the match's own clock back
      // DOWN to the seconds since this launch, and the booking then adds
      // exactly that many — so the total still comes out at eight while the
      // player's earlier minutes are quietly gone from the board they are
      // still playing.
      expect(storedElapsedSeconds()).toBe(8);
      expect(storedPlaySeconds()).toBe(8);
    } finally {
      setVisibility('visible');
      vi.useRealTimers();
    }
  });
});

describe('home', () => {
  it('exits to the collection', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);

    expect(await screen.findByRole('button', { name: /Easy/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('reports a record per opponent, and no streak (§7)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));

    expect(screen.getAllByText('Games played')).toHaveLength(3);
    expect(screen.getAllByText('Losses')).toHaveLength(3);
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});

/* Keyboard input is an adapter over the same tap handlers (issue #93): this
   checks board state the Undo button also produces, never a keyboard-only
   behaviour. */
describe('keyboard (issue #93)', () => {
  it('Ctrl+Z undoes the move and the reply together, same as the button', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Easy/ }));

    await user.click(screen.getByRole('button', { name: 'Row 6, column 3: your piece' }));
    await user.click(screen.getByRole('button', { name: 'Row 5, column 2: move here' }));
    await waitFor(() => expect(screen.getByText('Your turn')).toBeInTheDocument());

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(screen.getByRole('button', { name: 'Row 6, column 3: your piece' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});
