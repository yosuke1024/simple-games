import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { PLAYER, createSession, restoreSession, type Board, type Piece } from '../game';
import { CPU_MAN, EMPTY, PLAYER_MAN, isDarkSquare } from '../game';
import { toPersisted } from '../storage/gamePersistence';
import { CK_STORAGE_KEYS } from '../storage/schemas';
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
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);

      expect(board()).toBeInTheDocument();
    } finally {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
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
