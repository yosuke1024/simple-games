import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { EMPTY, createLevelSession } from '../game';
import { TK_STORAGE_KEYS, type Stats } from '../storage/schemas';
import { TakuzuRoot } from './TakuzuRoot';

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

function renderGame(initial: Record<string, string> = {}) {
  const onExit = vi.fn();
  const kv = createMemoryKV(initial);
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <TakuzuRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

const tutorialDone = {
  [TK_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

const board = () => screen.getByRole('group', { name: /Takuzu board/ });
/** A cell's label ends at its position, or carries the rule-broken note (§9). */
const cellAt = (row: number, col: number) =>
  within(board()).getByRole('button', { name: new RegExp(`row ${row}, column ${col}(,|$)`) });

async function startLevelOne(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Level 1/ }));
}

/** Launches the app against the device store, the way a player's phone does. */
function launch() {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <TakuzuRoot onExit={vi.fn()} />
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

/** Total play seconds as they survive on disk, across every board size. */
function storedPlaySeconds(): number {
  const raw = deviceStore.get(TK_STORAGE_KEYS.stats);
  if (raw === undefined) return 0;
  const stats = JSON.parse(raw) as Stats;
  return (
    stats.size6.totalPlaySeconds + stats.size8.totalPlaySeconds + stats.size10.totalPlaySeconds
  );
}

/** The first square level 1 leaves to the player — the only kind a tap moves. */
function firstOpenCell(): { row: number; col: number } {
  const truth = createLevelSession(1);
  const index = truth.givens.findIndex((cell) => cell === EMPTY);
  return { row: Math.floor(index / truth.size) + 1, col: (index % truth.size) + 1 };
}

afterEach(() => {
  cleanup();
  deviceStore.clear();
});

describe('backgrounding (§11)', () => {
  // Play five minutes, background the app, let Android kill it, come back: the
  // board returns, and so must the five minutes. The session save alone cannot
  // carry them — `activate` treats a restored session's elapsedSeconds as
  // already counted, so anything not booked before the kill is gone for good.
  it('books play time before the app can be killed, and never twice', async () => {
    deviceStore.set(TK_STORAGE_KEYS.flags, tutorialDone[TK_STORAGE_KEYS.flags]!);
    // The play clock is a plain interval, so it has to be faked before the game
    // screen mounts — which rules out userEvent here (it waits on real timers).
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

  // The path that made the booking baseline matter: a suspended game is on
  // disk, the player opens Takuzu, looks at the home screen and leaves without
  // resuming. Nothing was played, so nothing may be booked — and the second
  // visit must not book it again either. Before the baseline was seeded from
  // the restored session, each visit added its whole elapsed time.
  it('books nothing when a suspended game is opened and left unresumed', async () => {
    deviceStore.set(TK_STORAGE_KEYS.flags, tutorialDone[TK_STORAGE_KEYS.flags]!);
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Level 1/ }));
      act(() => vi.advanceTimersByTime(7_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(7);

      for (const _visit of [1, 2]) {
        cleanup();
        launch();
        await settle();
        background();
        await settle();
        expect(storedPlaySeconds()).toBe(7);
      }
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('first run', () => {
  it('shows Quick Rules and starts level 1 right after (§12)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Never three in a row')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Half and half')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('No line twice')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    expect(screen.getByText('Level 1')).toBeInTheDocument();
    // Level 1 is a 6×6: thirty-six squares, roughly half of them fixed.
    expect(within(board()).getAllByRole('button')).toHaveLength(36);
  });
});

describe('playing (§2, §4)', () => {
  it('cycles a square empty → 0 → 1 → empty under the same tap', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const { row, col } = firstOpenCell();
    expect(cellAt(row, col).getAttribute('aria-label')).toMatch(/^Empty/);
    await user.click(cellAt(row, col));
    expect(cellAt(row, col).getAttribute('aria-label')).toMatch(/^0,/);
    await user.click(cellAt(row, col));
    expect(cellAt(row, col).getAttribute('aria-label')).toMatch(/^1,/);
    await user.click(cellAt(row, col));
    expect(cellAt(row, col).getAttribute('aria-label')).toMatch(/^Empty/);
  });

  it('leaves the fixed squares fixed (§1)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const fixed = within(board()).getAllByRole('button', { name: /^Fixed/ });
    expect(fixed.length).toBeGreaterThan(0);
    for (const cell of fixed) expect(cell).toBeDisabled();
  });

  it('solves level 1 by writing its solution, and says so once (§2)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    // The level is deterministic (§7), so the test can know the answer the
    // same way every player's device does.
    const truth = createLevelSession(1);
    for (let index = 0; index < truth.solution.length; index++) {
      if (truth.givens[index] !== EMPTY) continue;
      const row = Math.floor(index / truth.size) + 1;
      const col = (index % truth.size) + 1;
      // One tap writes 0; a second turns it into 1.
      await user.click(cellAt(row, col));
      if (truth.solution[index] === 1) await user.click(cellAt(row, col));
    }

    expect(await screen.findByRole('alertdialog', { name: 'Solved!' })).toBeInTheDocument();
    expect(screen.getByText('Hints used')).toBeInTheDocument();
  });
});

describe('hints (§8)', () => {
  it('offers a free hint with the line that proves it', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    await user.click(screen.getByRole('button', { name: 'Hint' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      'The highlighted line settles the marked square.',
    );
  });

  it('never writes the digit for the player', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const before = within(board())
      .getAllByRole('button')
      .map((cell) => cell.getAttribute('aria-label'));
    await user.click(screen.getByRole('button', { name: 'Hint' }));
    const after = within(board())
      .getAllByRole('button')
      .map((cell) => cell.getAttribute('aria-label'));
    expect(after).toEqual(before);
  });
});

describe('what this game deliberately does not have', () => {
  it('offers no undo — every tap already cycles back round (§8)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    expect(screen.queryByRole('button', { name: /undo/i })).not.toBeInTheDocument();
  });

  it('shows no clock and no streak while playing (§10)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
  });

  it('reports per-size facts on the statistics screen, and no streak (§10)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));

    expect(screen.getByText('Levels solved')).toBeInTheDocument();
    expect(screen.getByText('6×6')).toBeInTheDocument();
    expect(screen.getByText('8×8')).toBeInTheDocument();
    expect(screen.getByText('10×10')).toBeInTheDocument();
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

/* Keyboard input is an adapter over the same tap handler (issue #93): this
   checks board state the Hint button also produces, never a keyboard-only
   behaviour. */
describe('keyboard (issue #93)', () => {
  it('H asks for the hint, same as the Hint button', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    fireEvent.keyDown(window, { key: 'h' });
    expect(screen.getByRole('status')).toHaveTextContent(
      'The highlighted line settles the marked square.',
    );
  });
});
