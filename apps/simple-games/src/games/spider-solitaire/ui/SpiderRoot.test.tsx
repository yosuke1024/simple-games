import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { createFreeSession } from '../game';
import { toPersisted } from '../storage/gamePersistence';
import { SS_STORAGE_KEYS, type Stats } from '../storage/schemas';
import { SpiderRoot } from './SpiderRoot';

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
      <SpiderRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

const tutorialDone = {
  [SS_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

/**
 * The golden deal at one suit (compatibility.test.ts). Its ten face-up cards
 * are 4 A 10 7 4 9 6 7 2 Q of spades, so the 9 onto the 10 is a legal move and
 * both of those ranks appear exactly once.
 */
const savedGoldenGame = {
  ...tutorialDone,
  [SS_STORAGE_KEYS.game]: JSON.stringify(toPersisted(createFreeSession(1, 'ss-free-golden'), 1)),
};

const table = () => screen.getByRole('group', { name: 'Spider Solitaire table' });

async function resumeGoldenGame(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Resume/ }));
}

function launch() {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <SpiderRoot onExit={vi.fn()} />
    </SettingsProvider>,
  );
}

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
  const raw = deviceStore.get(SS_STORAGE_KEYS.stats);
  if (raw === undefined) return 0;
  return (JSON.parse(raw) as Stats).totalPlaySeconds;
}

afterEach(() => {
  cleanup();
  deviceStore.clear();
});

describe('backgrounding (§10)', () => {
  it('books play time before the app can be killed, and never twice', async () => {
    deviceStore.set(SS_STORAGE_KEYS.flags, tutorialDone[SS_STORAGE_KEYS.flags]!);
    // The play clock is a plain interval, so it has to be faked before the game
    // screen mounts — which rules out userEvent here (it waits on real timers).
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /New deal/ }));

      act(() => vi.advanceTimersByTime(5_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(5);

      // The process dies here; nothing else runs. Relaunch and resume.
      cleanup();
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Resume/ }));

      act(() => vi.advanceTimersByTime(3_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('first run', () => {
  it('shows Quick Rules and deals a free game right after (§11)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Stack down by rank')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('One suit travels together')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Deal when you are stuck')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // A fresh Spider layout (§1): 54 cards over ten columns, one face up per
    // column, and five deals still in hand.
    expect(
      within(table()).getByRole('button', { name: 'Stock, 5 deals left — tap to deal a row' }),
    ).toBeInTheDocument();
    expect(within(table()).getAllByRole('img', { name: 'Face down' })).toHaveLength(44);
    expect(table().querySelectorAll('[data-card]')).toHaveLength(10);
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
  });
});

describe('playing', () => {
  it('moves a run with two taps and turns over what it uncovers (§3)', async () => {
    const user = userEvent.setup();
    renderGame(savedGoldenGame);
    await resumeGoldenGame(user);

    expect(within(table()).getAllByRole('img', { name: 'Face down' })).toHaveLength(44);

    await user.click(within(table()).getByRole('button', { name: '9 of spades' }));
    await user.click(within(table()).getByRole('button', { name: '10 of spades' }));

    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
    // The column the 9 left had four hidden cards; one has turned over.
    expect(within(table()).getAllByRole('img', { name: 'Face down' })).toHaveLength(43);
    expect(table().querySelectorAll('[data-card]')).toHaveLength(11);
  });

  it('deals a row from the stock and undoes it whole (§3, §8)', async () => {
    const user = userEvent.setup();
    renderGame(savedGoldenGame);
    await resumeGoldenGame(user);

    expect(screen.getByRole('button', { name: /Undo/ })).toBeDisabled();
    await user.click(
      within(table()).getByRole('button', { name: 'Stock, 5 deals left — tap to deal a row' }),
    );

    expect(
      within(table()).getByRole('button', { name: 'Stock, 4 deals left — tap to deal a row' }),
    ).toBeInTheDocument();
    expect(table().querySelectorAll('[data-card]')).toHaveLength(20);
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();

    // One undo takes the whole row back — ten cards, one step.
    await user.click(screen.getByRole('button', { name: /Undo/ }));
    expect(
      within(table()).getByRole('button', { name: 'Stock, 5 deals left — tap to deal a row' }),
    ).toBeInTheDocument();
    expect(table().querySelectorAll('[data-card]')).toHaveLength(10);
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
  });

  it('never names a face-down card, and shows no clock or streak (§4, §12)', async () => {
    const user = userEvent.setup();
    renderGame(savedGoldenGame);
    await resumeGoldenGame(user);

    for (const back of within(table()).getAllByRole('img', { name: 'Face down' })) {
      expect(back).not.toHaveAttribute('data-card');
    }
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });

  it('offers a hint, and it is free (§8)', async () => {
    const user = userEvent.setup();
    renderGame(savedGoldenGame);
    await resumeGoldenGame(user);

    await user.click(screen.getByRole('button', { name: /Hint/ }));
    // A hint changes nothing on the board and costs nothing.
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Undo/ })).toBeDisabled();
  });
});

describe('home', () => {
  it('carries the suit setting to the next deal, not to the one in progress', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);

    const oneSuit = await screen.findByRole('button', { name: '1 suit' });
    expect(oneSuit).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: '4 suits' }));
    expect(screen.getByRole('button', { name: '4 suits' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '1 suit' })).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: /New deal/ }));
    expect(screen.getByText('4 suits')).toBeInTheDocument();
  });

  it('reaches the daily, the statistics and the way out', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);

    await user.click(await screen.findByRole('button', { name: /Past Dailies/i }));
    expect(screen.getByRole('heading', { name: /Daily Challenge/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Home' }));

    await user.click(screen.getByRole('button', { name: /Statistics/i }));
    // One section per difficulty (§9).
    expect(screen.getAllByText('Deals played')).toHaveLength(3);
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Home' }));

    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalled();
  });
});
