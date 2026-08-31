import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { BLACK, createSession } from '../game';
import { toPersisted } from '../storage/gamePersistence';
import { GM_STORAGE_KEYS } from '../storage/schemas';
import { GomokuRoot } from './GomokuRoot';

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
      <GomokuRoot onExit={onExit} kv={createMemoryKV(initial)} />
    </SettingsProvider>,
  );
  return { onExit };
}

const tutorialDone = {
  [GM_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

const savedGame = {
  ...tutorialDone,
  [GM_STORAGE_KEYS.game]: JSON.stringify(
    toPersisted(createSession('easy', BLACK, 'gomoku-uitest'), 1),
  ),
};

const board = () => screen.getByRole('group', { name: /Gomoku board/ });
const stones = () => board().querySelectorAll('.gm-stone');

afterEach(() => {
  cleanup();
  deviceStore.clear();
});

describe('first run', () => {
  it('shows Quick Rules and sets a board right after (§9)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Tap once to aim, again to place')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Five in a row wins')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Block the open three')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // Two hundred and twenty-five crossings, and an empty board (§1).
    expect(within(board()).getAllByRole('button')).toHaveLength(225);
    expect(stones()).toHaveLength(0);
  });
});

describe('placing a stone takes two taps (§2)', () => {
  it('marks on the first tap and places on the second', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Easy/ }));

    expect(screen.getByText(/Your turn/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Row 8, column 8: empty' }));

    // Nothing is on the board yet — the crossing is only aimed at.
    expect(stones()).toHaveLength(0);
    expect(screen.getByText('Tap the same point again to place your stone.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Row 8, column 8: tap again to place' }));
    expect(stones()).toHaveLength(1);

    // The CPU answers on its own timer.
    await waitFor(() => expect(stones()).toHaveLength(2));
    await waitFor(() => expect(screen.getByText(/Your turn/)).toBeInTheDocument());
  });

  it('moves the mark when another crossing is tapped, placing nothing', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Easy/ }));

    await user.click(screen.getByRole('button', { name: 'Row 8, column 8: empty' }));
    await user.click(screen.getByRole('button', { name: 'Row 4, column 4: empty' }));

    expect(stones()).toHaveLength(0);
    expect(
      screen.getByRole('button', { name: 'Row 4, column 4: tap again to place' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Row 8, column 8: empty' })).toBeInTheDocument();
  });
});

describe('playing', () => {
  it('takes back the stone and the reply together (§5)', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Easy/ }));

    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Row 8, column 8: empty' }));
    await user.click(screen.getByRole('button', { name: 'Row 8, column 8: tap again to place' }));
    await waitFor(() => expect(stones()).toHaveLength(2));

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(stones()).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    // Help is one button; nothing suggests a crossing (§6).
    expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();
  });

  it('shows no clock while playing (§10)', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Easy/ }));

    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
  });
});

describe('choosing a colour (§1)', () => {
  it('lets the CPU open when the player takes white, and keeps the choice', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);

    const white = await screen.findByRole('radio', { name: 'White · second' });
    expect(screen.getByRole('radio', { name: 'Black · first' })).toBeChecked();
    await user.click(white);
    expect(white).toBeChecked();

    await user.click(screen.getByRole('button', { name: /Easy/ }));
    // Black opens and black is the CPU here, so the first stone is not the
    // player's to place (§1, §4).
    expect(screen.getByText('CPU is thinking…')).toBeInTheDocument();
    await waitFor(() => expect(stones()).toHaveLength(1));
    await waitFor(() => expect(screen.getByText(/Your turn/)).toBeInTheDocument());
  });

  it('leaves the match in progress on the colour it started with', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);

    await user.click(await screen.findByRole('radio', { name: 'White · second' }));
    await user.click(screen.getByRole('button', { name: /Easy/ }));
    expect(screen.getByText(/Your turn/)).toBeInTheDocument();
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
      // event a killed process gets.
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

/* Keyboard input is an adapter over the same tap handlers (issue #93): this
   checks board state the Undo button also produces, never a keyboard-only
   behaviour. */
describe('keyboard (issue #93)', () => {
  it('Ctrl+Z undoes the stone and the reply together, same as the button', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Easy/ }));

    await user.click(screen.getByRole('button', { name: 'Row 8, column 8: empty' }));
    await user.click(screen.getByRole('button', { name: 'Row 8, column 8: tap again to place' }));
    await waitFor(() => expect(stones()).toHaveLength(2));

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(stones()).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});
