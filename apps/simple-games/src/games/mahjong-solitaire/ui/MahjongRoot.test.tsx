import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { generateBoard, levelParams } from '../game';
import { MJ_STORAGE_KEYS, type Stats } from '../storage/schemas';
import { MahjongRoot } from './MahjongRoot';

/**
 * A stand-in for the device store. The `kv` prop below is a load-side seam
 * only — saves always go to Capacitor Preferences — so a test that has to
 * read back what a save actually wrote has to stand behind both.
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
      <MahjongRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

const tutorialDone = {
  [MJ_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

const board = () => screen.getByRole('group', { name: /Mahjong board/ });

async function startLevelOne(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Level 1/ }));
}

/** Launches the app against the device store, the way a player's phone does. */
function launch() {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <MahjongRoot onExit={vi.fn()} />
    </SettingsProvider>,
  );
}

/** Lets the local reads and the saves they trigger resolve (they are promises,
 * not timers, so this works under fake timers too). */
const settle = () => act(async () => undefined);

/** The app goes to background. Android may kill it without another event. */
function background() {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  Reflect.deleteProperty(document, 'visibilityState');
}

/** Total play seconds as they survive on disk. */
function storedPlaySeconds(): number {
  const raw = deviceStore.get(MJ_STORAGE_KEYS.stats);
  if (raw === undefined) return 0;
  const stats = JSON.parse(raw) as Stats;
  return stats.totalPlaySeconds;
}

afterEach(() => {
  cleanup();
  deviceStore.clear();
});

describe('backgrounding (§10)', () => {
  // Play five seconds, background the app, let Android kill it, come back:
  // the board returns, and so must the five seconds. The session save alone
  // cannot carry them — `activate` treats a restored session's elapsedSeconds
  // as already counted, so anything not booked before the kill is gone for
  // good.
  it('books play time before the app can be killed, and never twice', async () => {
    deviceStore.set(MJ_STORAGE_KEYS.flags, tutorialDone[MJ_STORAGE_KEYS.flags]!);
    // The play clock is a plain interval, so it has to be faked before the
    // game screen mounts — which rules out userEvent here (it waits on real
    // timers).
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Level 1/ }));

      act(() => vi.advanceTimersByTime(5_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(5);

      // The process dies here; nothing else runs. Relaunch and resume.
      cleanup();
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Level 1/ }));

      act(() => vi.advanceTimersByTime(3_000));
      background();
      await settle();
      // Eight seconds of play, counted once: the restored five are neither
      // lost nor booked a second time.
      expect(storedPlaySeconds()).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('first run', () => {
  it('shows Quick Rules and starts level 1 right after (§11)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Take matching pairs')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Flowers and seasons are groups')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Clear the board')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    expect(screen.getByText('Level 1')).toBeInTheDocument();
    // Level 1 is the 24-tile sprout, every tile a labelled button.
    expect(screen.getByText('24 tiles left')).toBeInTheDocument();
    expect(within(board()).getAllByRole('button')).toHaveLength(24);
  });
});

describe('taking pairs (§2, §3)', () => {
  it('removes a matching free pair on two taps', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    // The golden level-1 board holds exactly two free Bamboo 2 tiles.
    const pair = within(board()).getAllByRole('button', { name: 'Bamboo 2, can be taken' });
    expect(pair).toHaveLength(2);
    await user.click(pair[0]!);
    expect(pair[0]).toHaveAttribute('aria-pressed', 'true');
    await user.click(pair[1]!);
    expect(screen.getByText('22 tiles left')).toBeInTheDocument();
  });

  it('moves the selection quietly on a non-matching tap — never a scold (§3)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const dots = within(board()).getAllByRole('button', { name: 'Dots 7, can be taken' })[0]!;
    const wind = within(board()).getAllByRole('button', {
      name: 'East Wind, can be taken',
    })[0]!;
    await user.click(dots);
    expect(dots).toHaveAttribute('aria-pressed', 'true');
    await user.click(wind);
    expect(dots).toHaveAttribute('aria-pressed', 'false');
    expect(wind).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('24 tiles left')).toBeInTheDocument();
  });

  it('does nothing on a blocked tile', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const blocked = within(board()).getAllByRole('button', { name: /blocked/ })[0]!;
    await user.click(blocked);
    expect(blocked).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('24 tiles left')).toBeInTheDocument();
  });
});

describe('undo and hint (§8) — free, unlimited, never behind anything', () => {
  it('undo takes back the last pair', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const pair = within(board()).getAllByRole('button', { name: 'Bamboo 2, can be taken' });
    await user.click(pair[0]!);
    await user.click(pair[1]!);
    expect(screen.getByText('22 tiles left')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText('24 tiles left')).toBeInTheDocument();
  });

  it('hint points at a takeable pair', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    await user.click(screen.getByRole('button', { name: 'Hint' }));
    expect(document.querySelectorAll('.mj-hint')).toHaveLength(2);
  });
});

describe('winning (§2, §5)', () => {
  it('clears the board along the construction order and celebrates', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    // The deal is deterministic (§5), so the test can know a winning order
    // the same way every player's device could: the construction's own.
    const { solvedOrder } = generateBoard(levelParams(1), 'mj-level-1');
    const removed = new Set<number>();
    for (let k = 0; k + 1 < solvedOrder.length; k += 2) {
      const a = solvedOrder[k]!;
      const b = solvedOrder[k + 1]!;
      // Buttons render in tile-index order; position = index minus removed.
      const buttons = within(board()).getAllByRole('button');
      const position = (index: number) =>
        index - [...removed].filter((gone) => gone < index).length;
      await user.click(buttons[position(a)]!);
      await user.click(buttons[position(b)]!);
      removed.add(a).add(b);
    }

    expect(await screen.findByRole('alertdialog', { name: 'Cleared!' })).toBeInTheDocument();
    expect(screen.getByText('Hints used')).toBeInTheDocument();
  });
});

describe('what this game deliberately does not have', () => {
  it('shows no clock and no streak while playing (§9)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
  });

  it('reports counts on the statistics screen, and no streak (§9)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));

    expect(screen.getByText('Levels cleared')).toBeInTheDocument();
    expect(screen.getByText('Dailies cleared')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});

describe('home', () => {
  it('offers both modes and hands control back to the collection', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);

    expect(await screen.findByRole('button', { name: /Level 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
