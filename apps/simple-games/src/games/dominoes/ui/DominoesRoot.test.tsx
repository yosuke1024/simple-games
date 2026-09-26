import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import {
  createSession,
  distinctEnds,
  gameSeed,
  hasLegalPlay,
  lineEnds,
  needsEndChoice,
  newSeedToken,
  PLAYER,
  type DominoesSession,
  type Tile,
} from '../game';
import { findPosition } from '../game/test-helpers';
import { CPU_DELAY_MS } from '../state/GameContext';
import { toPersisted } from '../storage/gamePersistence';
import { DM_STORAGE_KEYS, type PersistedGame, type Stats } from '../storage/schemas';
import { DominoesRoot } from './DominoesRoot';

/**
 * A stand-in for the device store. The `kv` prop below is a load-side seam
 * only — saves always go to Capacitor Preferences — so the tests that have to
 * see what a save actually wrote stand behind both instead (`launch`).
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

function renderGame(initial: Record<string, string> = {}, entry?: 'collection' | 'shortcut') {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <DominoesRoot onExit={onExit} entry={entry} kv={createMemoryKV(initial)} />
    </SettingsProvider>,
  );
  return { onExit };
}

/** Launches the game against the device store, the way a player's phone does. */
function launch() {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <DominoesRoot onExit={vi.fn()} />
    </SettingsProvider>,
  );
}

function launchFromShortcut() {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <DominoesRoot onExit={vi.fn()} entry="shortcut" />
    </SettingsProvider>,
  );
}

/** Lets the local reads and the saves they trigger resolve (promises, not timers). */
const settle = () => act(async () => undefined);

/**
 * The CPU's action is armed on a real `setTimeout` (§5, `CPU_DELAY_MS`), so
 * the tests that wait for one own the clock and step it themselves (issue
 * #158), driving the screen with `fireEvent` — userEvent drains itself
 * through a real 0ms timeout a stopped clock never fires.
 */
const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

/** The app goes to background. Android may kill it without another event. */
function background() {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  Reflect.deleteProperty(document, 'visibilityState');
}

const tutorialDone = {
  [DM_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

const withGame = (session: DominoesSession) => ({
  ...tutorialDone,
  [DM_STORAGE_KEYS.game]: JSON.stringify(toPersisted(session, 1)),
});

const tileName = (tile: Tile) => `Tile ${tile[0]}–${tile[1]}`;

const lineGroup = () => screen.getByRole('group', { name: /Line of play/ });
const lineTiles = () => within(lineGroup()).getAllByRole('img');
const handGroup = () => screen.getByRole('group', { name: 'Your tiles' });
const handTiles = () => within(handGroup()).getAllByRole('button');
const boneyardCount = () => {
  const text = screen.getByText(/^Boneyard: \d+ tiles$/).textContent ?? '';
  return Number(/\d+/.exec(text)![0]);
};

/** The player to act, holding a tile that fits both ends — and they differ. */
const twoEnds = findPosition(
  'dm-ui-two-ends',
  (s) =>
    s.status === 'playing' &&
    s.toMove === PLAYER &&
    s.boneyard.length > 0 &&
    s.playerHand.length > 1 &&
    s.playerHand.some((tile) => needsEndChoice(s.line, tile)),
);

/** The player to act, holding a tile that fits exactly one end. */
const oneEnd = findPosition(
  'dm-ui-one-end',
  (s) =>
    s.status === 'playing' &&
    s.toMove === PLAYER &&
    s.boneyard.length > 0 &&
    s.playerHand.length > 1 &&
    s.playerHand.some((tile) => distinctEnds(s.line, tile).length === 1),
);

/** The player to act, with nothing that fits and tiles left to draw. */
const stuck = findPosition(
  'dm-ui-stuck',
  (s) =>
    s.status === 'playing' &&
    s.toMove === PLAYER &&
    s.boneyard.length > 0 &&
    !hasLegalPlay(s.line, s.playerHand),
);

/** The player to act, with nothing that fits and nothing left to draw. */
const mustPass = findPosition(
  'dm-ui-pass',
  (s) =>
    s.status === 'playing' &&
    s.toMove === PLAYER &&
    s.passes === 0 &&
    s.boneyard.length === 0 &&
    !hasLegalPlay(s.line, s.playerHand),
);

/** The player to act, one tile left, and it fits. */
const lastTile = findPosition(
  'dm-ui-last',
  (s) =>
    s.status === 'playing' &&
    s.toMove === PLAYER &&
    s.playerHand.length === 1 &&
    hasLegalPlay(s.line, s.playerHand),
);

afterEach(() => {
  cleanup();
  deviceStore.clear();
});

describe('first run', () => {
  it('shows Quick Rules first, then deals a game with the opening tile down (§10, §2)', async () => {
    // A fresh deal may be the CPU's to answer, on its own timer: the clock is
    // stopped so the table is read exactly as it was dealt. The deal itself
    // is seeded from the time and one random draw, both pinned here so the
    // first line can be checked word for word.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-27T09:00:00Z'));
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      const dealt = createSession(gameSeed(newSeedToken(Date.now(), () => 0.5)));
      const opened = `${dealt.opening.tile[0]}–${dealt.opening.tile[1]}`;
      const firstLine =
        dealt.opening.by === PLAYER
          ? `You opened with ${opened}`
          : hasLegalPlay(dealt.line, dealt.playerHand)
            ? `The CPU opened with ${opened}. Your turn`
            : 'No tile fits. Draw from the boneyard';
      renderGame();
      await settle();

      expect(screen.getByRole('heading', { level: 1, name: 'How to Play' })).toBeVisible();
      expect(screen.getByText('Match an end')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      expect(screen.getByText('Stuck? Draw')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      expect(screen.getByText('Go out first')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Start Playing' }));

      // One tile on the line — the opening — and fourteen in the boneyard.
      expect(lineTiles()).toHaveLength(1);
      expect(boneyardCount()).toBe(14);
      expect(handTiles().length).toBeGreaterThanOrEqual(6);
      // The first line says who opened, and with what (§2) — unless the
      // player has to draw before anything else.
      expect(screen.getByRole('status')).toHaveTextContent(firstLine);
      expect(handTiles()).toHaveLength(dealt.playerHand.length);
      // Nothing to undo, nothing to hint (§7), and no clock (§11).
      expect(screen.queryByRole('button', { name: /undo|hint/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
    } finally {
      random.mockRestore();
      vi.useRealTimers();
    }
  });
});

describe('home', () => {
  it('offers the game in progress, and asks before replacing it', async () => {
    const user = userEvent.setup();
    renderGame(withGame(oneEnd));

    await user.click(await screen.findByRole('button', { name: 'New Game' }));
    expect(screen.getByText('Start a new game?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('button', { name: 'Resume' }));
    expect(lineTiles()).toHaveLength(oneEnd.line.length);
    expect(handTiles()).toHaveLength(oneEnd.playerHand.length);
  });

  it('deals straight away when nothing is in progress', async () => {
    vi.useFakeTimers();
    try {
      renderGame(tutorialDone);
      await settle();
      expect(screen.queryByRole('button', { name: 'Resume' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
      expect(lineTiles()).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports one record, and no streak (§8)', async () => {
    const user = userEvent.setup();
    const stats: Stats = {
      schemaVersion: 1,
      played: 5,
      wins: 3,
      losses: 1,
      draws: 1,
      totalPlaySeconds: 125,
    };
    renderGame({ ...tutorialDone, [DM_STORAGE_KEYS.stats]: JSON.stringify(stats) });
    expect(await screen.findByText('Won 3 · Lost 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Statistics' }));
    expect(screen.getByText('Games played')).toBeInTheDocument();
    expect(screen.getByText('Draws')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });

  it('exits to the collection', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

describe('playing a tile (§3)', () => {
  it('asks which end when a tile fits both, and a second tap puts it back', async () => {
    vi.useFakeTimers();
    try {
      renderGame(withGame(twoEnds), 'shortcut');
      await settle();

      const tile = twoEnds.playerHand.find((held) => needsEndChoice(twoEnds.line, held))!;
      const ends = lineEnds(twoEnds.line)!;
      const leftName = `Play on the left end (${ends.left})`;
      const rightName = `Play on the right end (${ends.right})`;

      const button = within(handGroup()).getByRole('button', { name: tileName(tile) });
      expect(button).toHaveAttribute('aria-pressed', 'false');
      expect(screen.queryByRole('button', { name: leftName })).not.toBeInTheDocument();

      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText('Choose an end for this tile')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: leftName })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: rightName })).toBeInTheDocument();
      // Nothing was played yet.
      expect(lineTiles()).toHaveLength(twoEnds.line.length);

      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-pressed', 'false');
      expect(screen.queryByRole('button', { name: leftName })).not.toBeInTheDocument();

      fireEvent.click(button);
      fireEvent.click(screen.getByRole('button', { name: leftName }));
      expect(lineTiles()).toHaveLength(twoEnds.line.length + 1);
      expect(handTiles()).toHaveLength(twoEnds.playerHand.length - 1);
      // It went on the left: the new first tile is the one played.
      const [a, b] = tile;
      const first = lineTiles()[0]!.getAttribute('aria-label');
      expect([`Tile ${a}–${b}`, `Tile ${b}–${a}`]).toContain(first);
    } finally {
      vi.useRealTimers();
    }
  });

  it('plays a tile that fits one end at once, and the CPU answers after its beat (§5)', async () => {
    vi.useFakeTimers();
    try {
      renderGame(withGame(oneEnd), 'shortcut');
      await settle();

      const tile = oneEnd.playerHand.find((held) => distinctEnds(oneEnd.line, held).length === 1)!;
      // Only tiles that fit are enabled on the player's turn.
      for (const held of oneEnd.playerHand) {
        const fits = distinctEnds(oneEnd.line, held).length > 0;
        const button = within(handGroup()).getByRole('button', { name: tileName(held) });
        if (fits) expect(button).toBeEnabled();
        else expect(button).toBeDisabled();
      }
      expect(screen.getByRole('button', { name: 'Draw' })).toBeDisabled();

      fireEvent.click(within(handGroup()).getByRole('button', { name: tileName(tile) }));
      expect(lineTiles()).toHaveLength(oneEnd.line.length + 1);
      expect(screen.getByText('CPU is thinking…')).toBeInTheDocument();
      // The whole hand waits for the CPU.
      for (const button of handTiles()) expect(button).toBeDisabled();

      // One tile on the line or one off the boneyard — either way this moves
      // by exactly one when the CPU acts, and not a tick before.
      const progress = () => lineTiles().length - boneyardCount();
      const before = progress();
      await advance(CPU_DELAY_MS - 1);
      expect(progress()).toBe(before);
      await advance(1);
      expect(progress()).toBe(before + 1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('drawing and passing (§3)', () => {
  it('enables Draw only when nothing fits, and a draw takes the front tile', async () => {
    const user = userEvent.setup();
    renderGame(withGame(stuck), 'shortcut');
    await settle();

    expect(screen.getByText('No tile fits. Draw from the boneyard')).toBeInTheDocument();
    for (const button of handTiles()) expect(button).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Pass' })).not.toBeInTheDocument();

    const draw = screen.getByRole('button', { name: 'Draw' });
    expect(draw).toBeEnabled();
    await user.click(draw);
    expect(boneyardCount()).toBe(stuck.boneyard.length - 1);
    expect(handTiles()).toHaveLength(stuck.playerHand.length + 1);
    expect(
      within(handGroup()).getByRole('button', { name: tileName(stuck.boneyard[0]!) }),
    ).toBeInTheDocument();
  });

  it('offers Pass only with nothing to play and nothing to draw', async () => {
    vi.useFakeTimers();
    try {
      renderGame(withGame(mustPass), 'shortcut');
      await settle();

      expect(screen.getByText('No tile fits and the boneyard is empty. Pass')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Draw' })).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Pass' }));
      expect(screen.queryByRole('button', { name: 'Pass' })).not.toBeInTheDocument();
      expect(screen.getByText('CPU is thinking…')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the end of a game (§4)', () => {
  it('shows the result, the score and the record when the last tile goes down', async () => {
    const user = userEvent.setup();
    renderGame(withGame(lastTile), 'shortcut');
    await settle();

    const tile = lastTile.playerHand[0]!;
    await user.click(within(handGroup()).getByRole('button', { name: tileName(tile) }));
    const right = screen.queryByRole('button', { name: /Play on the right end/ });
    if (right) await user.click(right);

    const dialog = await screen.findByRole('alertdialog', { name: 'You win!' });
    expect(within(dialog).getByText('You played your last tile.')).toBeInTheDocument();
    expect(within(dialog).getByText(/^You score \d+$/)).toBeInTheDocument();
    expect(within(dialog).getByText(/^Pips left: you 0, CPU \d+$/)).toBeInTheDocument();
    expect(within(dialog).getByText('Won 1 · Lost 0')).toBeInTheDocument();
  });
});

describe('a home-screen shortcut (issue #113)', () => {
  it('opens the one suspended game straight onto the table', async () => {
    for (const [key, value] of Object.entries(withGame(oneEnd))) deviceStore.set(key, value);
    launchFromShortcut();
    await settle();

    expect(lineTiles()).toHaveLength(oneEnd.line.length);
    expect(screen.queryByRole('button', { name: 'Statistics' })).not.toBeInTheDocument();
  });

  it('opens the home screen when nothing is suspended', async () => {
    for (const [key, value] of Object.entries(tutorialDone)) deviceStore.set(key, value);
    launchFromShortcut();
    await settle();

    expect(screen.queryByRole('group', { name: /Line of play/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Game' })).toBeInTheDocument();
  });

  it('is the only door that resumes: a tile on the collection still opens the home', async () => {
    for (const [key, value] of Object.entries(withGame(oneEnd))) deviceStore.set(key, value);
    launch();
    await settle();

    expect(screen.queryByRole('group', { name: /Line of play/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
  });

  it('teaches the game first on a launch that has never seen Quick Rules', async () => {
    deviceStore.set(DM_STORAGE_KEYS.game, JSON.stringify(toPersisted(oneEnd, 1)));
    launchFromShortcut();

    expect(await screen.findByText('Match an end')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /Line of play/ })).not.toBeInTheDocument();

    // And Quick Rules lead onto the game that was waiting, not over it: the
    // save keeps its seed rather than being replaced by a fresh deal.
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Playing' }));
    await settle();
    expect(lineGroup()).toBeInTheDocument();
    expect((JSON.parse(deviceStore.get(DM_STORAGE_KEYS.game)!) as { seed: string }).seed).toBe(
      oneEnd.seed,
    );
  });

  // The counterpart of §9's promise that a restored elapsedSeconds comes back
  // as already booked: arriving at the table without passing through the
  // home screen has to seed the same two clocks `activate` does.
  it('does not book the resumed game’s play seconds a second time', async () => {
    for (const [key, value] of Object.entries(tutorialDone)) deviceStore.set(key, value);
    const storedPlaySeconds = () =>
      (JSON.parse(deviceStore.get(DM_STORAGE_KEYS.stats) ?? '{"totalPlaySeconds":0}') as Stats)
        .totalPlaySeconds;
    const storedGameSeconds = () =>
      (JSON.parse(deviceStore.get(DM_STORAGE_KEYS.game)!) as PersistedGame).elapsedSeconds;

    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
      await settle();

      act(() => vi.advanceTimersByTime(5_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(5);
      expect(storedGameSeconds()).toBe(5);

      cleanup();
      launchFromShortcut();
      await settle();
      expect(lineGroup()).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(3_000));
      background();
      await settle();
      expect(storedGameSeconds()).toBe(8);
      expect(storedPlaySeconds()).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });
});
