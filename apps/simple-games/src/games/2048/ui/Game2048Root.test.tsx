import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { createSession, type Board } from '../game';
import { toPersisted } from '../storage/gamePersistence';
import { TM_STORAGE_KEYS } from '../storage/schemas';
import { Game2048Root } from './Game2048Root';

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
  const kv = createMemoryKV(initial);
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <Game2048Root onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

const tutorialDone = {
  [TM_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

const board = (...rows: readonly number[][]): Board => ([] as number[]).concat(...rows);
const ZERO = [0, 0, 0, 0];

/** A pinned board, so the test knows what each direction is worth. */
const PAIR_ON_TOP = board([2, 2, 0, 0], ZERO, ZERO, ZERO);

const savedGame = {
  ...tutorialDone,
  [TM_STORAGE_KEYS.game]: JSON.stringify(
    toPersisted({ ...createSession('2048-uitest'), board: PAIR_ON_TOP }, 1),
  ),
};

const gameBoard = () => screen.getByRole('group', { name: /2048 board/ });
const tiles = () => gameBoard().querySelectorAll('.tm-tile');

afterEach(() => {
  cleanup();
  deviceStore.clear();
});

describe('first run', () => {
  it('shows Quick Rules and deals a board right after (§11)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Swipe to slide')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('A new tile appears')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Stuck? Take it back')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // Sixteen squares, every one of them announced, and two tiles on them (§5).
    expect(within(gameBoard()).getAllByRole('img')).toHaveLength(16);
    expect(tiles()).toHaveLength(2);
    expect(screen.getByText(/Score\s*0/)).toBeInTheDocument();
  });
});

describe('playing', () => {
  it('offers Undo from the first frame, with nothing yet to undo (§6, §8)', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Resume/ }));

    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo).toBeInTheDocument();
    expect(undo).toBeDisabled();
    // Help is one button, and it is not unlocked by watching anything (§8).
    expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();
  });

  it('slides on an arrow key, and takes the move back (§3, §6)', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Resume/ }));

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText(/Score\s*4/)).toBeInTheDocument();
    // The 4 the move made and the tile that followed it, with the pair the
    // merge consumed still travelling in underneath them (§12).
    expect(gameBoard().querySelectorAll('.tm-tile-merge')).toHaveLength(1);
    expect(gameBoard().querySelectorAll('.tm-tile-spawn')).toHaveLength(1);
    expect(gameBoard().querySelectorAll('.tm-tile-ghost')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText(/Score\s*0/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('does nothing at all for a direction the board cannot take (§3)', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Resume/ }));

    // Two tiles already against the top edge: up changes nothing, so nothing
    // is scored, no tile appears, and there is still nothing to undo.
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(screen.getByText(/Score\s*0/)).toBeInTheDocument();
    expect(tiles()).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('shows no clock while playing (§12)', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Resume/ }));

    // Nothing on screen is formatted as a running time.
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
  });
});

describe('home', () => {
  it('exits to the collection', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);

    expect(await screen.findByRole('button', { name: /New Game/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('reports counts on the statistics screen, and no streak (§9)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));

    expect(screen.getByText('Games played')).toBeInTheDocument();
    expect(screen.getByText('Best score')).toBeInTheDocument();
    expect(screen.getByText('Largest tile')).toBeInTheDocument();
    expect(screen.getByText('Times you reached 2048')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});
