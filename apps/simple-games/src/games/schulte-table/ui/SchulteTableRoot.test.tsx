import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { ST_STORAGE_KEYS, type Stats } from '../storage/schemas';
import { SchulteTableRoot } from './SchulteTableRoot';

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
      <SchulteTableRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

const tutorialDone = {
  [ST_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

const board = () => screen.getByRole('group', { name: 'Number grid' });
const cells = () => within(board()).getAllByRole('button');

/** The cell showing `value`, found the way a player finds it: by reading. */
const cellFor = (value: number): HTMLElement => {
  const found = cells().find((cell) => cell.textContent === String(value));
  if (!found) throw new Error(`no cell showing ${value}`);
  return found;
};

/** The number the board is currently asking for. */
const target = (): number => Number(document.querySelector('.schulte-target-value')?.textContent);

async function startLevelOne(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Level 1/ }));
}

/** Plays a whole 3x3 round correctly. */
async function finishRound(user: ReturnType<typeof userEvent.setup>) {
  for (let i = 1; i <= 9; i++) await user.click(cellFor(target()));
}

/** Launches the app against the device store, the way a player's phone does. */
function launch() {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <SchulteTableRoot onExit={vi.fn()} />
    </SettingsProvider>,
  );
}

/** Lets local reads and the saves they trigger resolve (promises, not timers). */
const settle = () => act(async () => undefined);

/** The app goes to background. Android may kill it without another event. */
function background() {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  Reflect.deleteProperty(document, 'visibilityState');
}

function storedStats(): Stats | null {
  const raw = deviceStore.get(ST_STORAGE_KEYS.stats);
  return raw === undefined ? null : (JSON.parse(raw) as Stats);
}

afterEach(() => {
  cleanup();
  deviceStore.clear();
});

describe('first run', () => {
  it('shows Quick Rules and starts level 1 right after (§12)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Tap 1, then 2, then 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('The number to find is above the grid')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Finish the grid')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // Level 1 is a 3x3, and the board asks for 1 first.
    expect(cells()).toHaveLength(9);
    expect(target()).toBe(1);
  });
});

describe('playing (docs/SCHULTE_TABLE_RULES.md §3)', () => {
  it('advances through the order and finishes the round', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    await user.click(cellFor(1));
    expect(target()).toBe(2);
    await user.click(cellFor(2));
    expect(target()).toBe(3);

    for (let value = 3; value <= 9; value++) await user.click(cellFor(value));
    expect(await screen.findByText('All found')).toBeInTheDocument();
  });

  it('leaves a tapped cell exactly where it was, still readable', async () => {
    // §3: cells are never removed. An emptying board would make the last few
    // numbers easy to find for a reason that has nothing to do with the player.
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const first = cellFor(1);
    const labelBefore = first.getAttribute('aria-label');
    await user.click(first);

    expect(cells()).toHaveLength(9);
    expect(first.textContent).toBe('1');
    // The position in the label is unchanged; only "already tapped" is added.
    expect(first.getAttribute('aria-label')).toBe(`${labelBefore}, already tapped`);
  });

  it('does not advance on a wrong tap, and says nothing about it', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    await user.click(cellFor(5));

    expect(target()).toBe(1);
    expect(cellFor(5).getAttribute('aria-label')).not.toMatch(/already tapped/);
    // Nothing scolds: no warning text anywhere on screen (§3).
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('counts wrong taps only at the finish, never during play (§4)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    await user.click(cellFor(5));
    await user.click(cellFor(7));
    // Not on screen while playing.
    expect(screen.queryByText('Wrong taps')).not.toBeInTheDocument();

    await finishRound(user);
    expect(await screen.findByText('Wrong taps')).toBeInTheDocument();
    const facts = document.querySelector('.result-facts')!;
    expect(within(facts as HTMLElement).getByText('2')).toBeInTheDocument();
  });

  it('ignores a second tap on a cell already done, without counting a miss', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    await user.click(cellFor(1));
    await user.click(cellFor(1));
    await user.click(cellFor(1));

    expect(target()).toBe(2);
    for (let value = 2; value <= 9; value++) await user.click(cellFor(value));
    // Zero wrong taps: re-tapping a finished cell is not getting a number wrong.
    const facts = await screen.findByText('Wrong taps');
    expect(facts.parentElement?.textContent).toMatch(/Wrong taps0/);
  });
});

describe('what this game deliberately does not have', () => {
  it('offers no undo and no hint, at any point (§9)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    expect(screen.queryByRole('button', { name: /undo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();

    // Still nothing part-way through — neither is unlocked by progress.
    await user.click(cellFor(1));
    expect(screen.queryByRole('button', { name: /undo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();
  });

  it('shows no clock, no countdown and no streak while playing (§4, §8)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    // Nothing on screen is formatted as a running time.
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
  });

  it('claims nothing about the brain, anywhere in the game (§14)', async () => {
    // The genre's standard sales pitch, which this collection refuses to make.
    const user = userEvent.setup();
    renderGame(tutorialDone);
    // Naming the claim is how its absence is checked for.
    const banned = /brain|IQ|cognitive|memory training|mental age/i; // [check-principles: allow]

    expect(document.body.textContent).not.toMatch(banned);
    await user.click(await screen.findByRole('button', { name: 'How to Play' }));
    expect(document.body.textContent).not.toMatch(banned);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Statistics' }));
    expect(document.body.textContent).not.toMatch(banned);
  });

  it('reports per-size facts and no streak on the statistics screen (§10)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));

    expect(screen.getByText('Levels finished')).toBeInTheDocument();
    expect(screen.getByText('3x3')).toBeInTheDocument();
    expect(screen.getByText('4x4')).toBeInTheDocument();
    expect(screen.getByText('5x5')).toBeInTheDocument();
    expect(screen.getAllByText('Wrong taps in total')).toHaveLength(3);
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});

describe('leaving a round (§11)', () => {
  it('counts it as played but never as finished, and keeps its wrong taps', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    await user.click(cellFor(5)); // a miss
    await user.click(cellFor(1)); // a hit, half-way into nothing
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();

    const stats = storedStats();
    expect(stats?.size3.played).toBe(1);
    expect(stats?.size3.cleared).toBe(0);
    expect(stats?.size3.totalMisses).toBe(1);

    // And the round is gone: opening level 1 again starts from the first number.
    await startLevelOne(user);
    expect(target()).toBe(1);
  });
});

describe('throwing a round away (§10, §11)', () => {
  // Retry mid-round replaces the session outright. Everything the abandoned
  // round produced still happened: its seconds were played and its wrong taps
  // were tapped, and `totalMisses` is defined as every wrong tap ever made.
  it('books the seconds and the wrong taps of the round Retry discards', async () => {
    deviceStore.set(ST_STORAGE_KEYS.flags, tutorialDone[ST_STORAGE_KEYS.flags]!);
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Level 1/ }));

      fireEvent.click(cellFor(5)); // a wrong tap
      fireEvent.click(cellFor(7)); // another
      act(() => vi.advanceTimersByTime(6_000));

      fireEvent.click(screen.getByRole('button', { name: 'Retry same board' }));
      fireEvent.click(screen.getByRole('button', { name: 'Start' }));
      await settle();

      const stats = storedStats();
      expect(stats?.size3.totalMisses).toBe(2);
      expect(stats?.size3.totalPlaySeconds).toBe(6);
      // Started twice, finished neither.
      expect(stats?.size3.played).toBe(2);
      expect(stats?.size3.cleared).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not book a finished round twice when Retry follows it', async () => {
    deviceStore.set(ST_STORAGE_KEYS.flags, tutorialDone[ST_STORAGE_KEYS.flags]!);
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Level 1/ }));

      fireEvent.click(cellFor(5)); // one wrong tap, then a clean run
      for (let i = 1; i <= 9; i++) fireEvent.click(cellFor(target()));
      act(() => vi.advanceTimersByTime(4_000));
      await settle();
      expect(storedStats()?.size3.totalMisses).toBe(1);

      // The finished round was booked by `finish`; Retry must not book it
      // again. Scoped to the dialog: the top bar carries the same label.
      const dialog = screen.getByRole('alertdialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Retry same board' }));
      await settle();
      expect(storedStats()?.size3.totalMisses).toBe(1);
      expect(storedStats()?.size3.cleared).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('backgrounding', () => {
  // Play, background the app, let Android kill it, come back. There is no
  // saved round to restore (§11) — but the seconds played were real, and
  // booking them before the kill is the only chance to keep them.
  it('books play time before the app can be killed, and never twice', async () => {
    deviceStore.set(ST_STORAGE_KEYS.flags, tutorialDone[ST_STORAGE_KEYS.flags]!);
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
      expect(storedStats()?.size3.totalPlaySeconds).toBe(5);

      // The process dies here; nothing else runs. Relaunch and play again.
      cleanup();
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Level 1/ }));

      act(() => vi.advanceTimersByTime(3_000));
      background();
      await settle();
      // Eight seconds of play, counted once.
      expect(storedStats()?.size3.totalPlaySeconds).toBe(8);
    } finally {
      vi.useRealTimers();
    }
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
