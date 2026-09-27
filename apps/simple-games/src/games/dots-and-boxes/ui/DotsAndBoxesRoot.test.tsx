import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import {
  claim,
  CPU,
  createSession,
  hEdge,
  PLAYER,
  vEdge,
  type DotsAndBoxesSession,
  type Side,
} from '../game';
import { CPU_DELAY_MS } from '../state/GameContext';
import { toPersisted } from '../storage/gamePersistence';
import { DB_STORAGE_KEYS, type PersistedGame, type Stats } from '../storage/schemas';
import { DotsAndBoxesRoot } from './DotsAndBoxesRoot';

/**
 * A stand-in for the device store. The `kv` prop below is a load-side seam
 * only — saves always go to Capacitor Preferences — so most tests here never
 * read a save back; they are about what the screens show. The ones that have
 * to see what a save actually wrote stand behind both instead (`launch`).
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
      <DotsAndBoxesRoot onExit={onExit} kv={createMemoryKV(initial)} />
    </SettingsProvider>,
  );
  return { onExit };
}

/** Launches the game against the device store, the way a player's phone does. */
function launch(entry?: 'collection' | 'shortcut') {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <DotsAndBoxesRoot onExit={onExit} entry={entry} />
    </SettingsProvider>,
  );
  return { onExit };
}

/** Lets the local reads and the saves they trigger resolve (they are promises,
 * not timers, so this works under fake timers too). */
const settle = () => act(async () => undefined);

/**
 * Winds this file's clock on and lets React answer it. The CPU's line is armed
 * on a real `setTimeout` (§4, `CPU_DELAY_MS`), so the tests own the clock and
 * step it themselves — the reply lands on the beat the rules give it, on any
 * machine (issue #158). They drive the screen with `fireEvent` for the same
 * reason: userEvent's async wrapper drains itself through a real 0ms timeout,
 * which a stopped clock never fires.
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
  [DB_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

/** A 3×3 match with these lines already down and `toMove` to draw. */
function savedMatch(lines: readonly (readonly [Side, number])[], toMove: Side = PLAYER) {
  let session: DotsAndBoxesSession = createSession('small', 'dots-and-boxes-uitest');
  let board = session.board;
  for (const [side, edge] of lines) board = claim(board, side, edge)!.board;
  session = { ...session, board, toMove, moveCount: lines.length };
  return {
    ...tutorialDone,
    [DB_STORAGE_KEYS.game]: JSON.stringify(toPersisted(session, 1)),
  };
}

/**
 * Box (0,0) with its top and left drawn: the player's next line on its
 * bottom hands the box to the CPU (§4 tier 1), which then draws once more.
 */
const cornerOpen = savedMatch([
  [PLAYER, hEdge(3, 0, 0)],
  [CPU, vEdge(3, 0, 0)],
]);

const board = () => screen.getByRole('group', { name: /Dots and Boxes board/ });
const cpuLines = () =>
  within(board()).queryAllByRole('img', { name: /^(Horizontal|Vertical) line .*, CPU$/ });
const allLines = () =>
  within(board()).queryAllByRole('img', { name: /^(Horizontal|Vertical) line / });
const openLines = () => within(board()).getAllByRole('button');

afterEach(() => {
  cleanup();
  deviceStore.clear();
});

describe('first run', () => {
  it('shows Quick Rules first and starts a 3×3 match right after (§9)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'How to Play' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Tap between two dots')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Close a box, go again')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Most boxes wins')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // A 3×3 board: 24 lines, every one of them a button, none drawn (§1).
    expect(screen.getByRole('group', { name: 'Dots and Boxes board, 3 by 3 boxes' })).toBeVisible();
    expect(openLines()).toHaveLength(24);
    expect(allLines()).toHaveLength(0);
    expect(screen.getByText('Your turn')).toBeInTheDocument();
  });
});

describe('playing', () => {
  it('draws a line through the DOM and hands the turn to the CPU (§2, §4)', async () => {
    vi.useFakeTimers();
    try {
      renderGame(savedMatch([]));
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /3 × 3.*Resume/ }));

      expect(screen.getByText('Your turn')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Horizontal line 1, 1, not drawn' }));
      expect(screen.getByRole('img', { name: 'Horizontal line 1, 1, yours' })).toBeInTheDocument();
      expect(openLines()).toHaveLength(23);
      expect(screen.getByText('CPU is thinking…')).toBeInTheDocument();

      // The CPU answers on a timer and on nothing else: a tick short of the
      // delay the board is still the player's alone (§4).
      await advance(CPU_DELAY_MS - 1);
      expect(cpuLines()).toHaveLength(0);
      await advance(1);
      expect(cpuLines()).toHaveLength(1);
      expect(screen.getByText('Your turn')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('lets the CPU keep the move after a box, one line per beat, and Undo takes it all back (§4, §5)', async () => {
    vi.useFakeTimers();
    try {
      renderGame(cornerOpen);
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /3 × 3.*Resume/ }));
      expect(allLines()).toHaveLength(2);
      expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();

      // The bottom of box (0,0): its third side, handed to the CPU.
      fireEvent.click(screen.getByRole('button', { name: 'Horizontal line 2, 1, not drawn' }));

      await advance(CPU_DELAY_MS);
      expect(screen.getByRole('img', { name: 'Box 1, 1, CPU' })).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'Boxes: you 0, CPU 1' })).toBeInTheDocument();
      // The box keeps the CPU's turn, and its next line waits for its own beat.
      expect(screen.getByText('CPU is thinking…')).toBeInTheDocument();
      expect(cpuLines()).toHaveLength(2);
      await advance(CPU_DELAY_MS - 1);
      expect(cpuLines()).toHaveLength(2);
      await advance(1);
      expect(cpuLines()).toHaveLength(3);
      expect(screen.getByText('Your turn')).toBeInTheDocument();

      // Undo: the player's line and the CPU's whole run come off together.
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      expect(allLines()).toHaveLength(2);
      expect(screen.getByRole('img', { name: 'Box 1, 1, open' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
      expect(screen.getByText('Your turn')).toBeInTheDocument();
      // Nothing is left armed: no CPU line arrives after the take-back.
      await advance(CPU_DELAY_MS * 3);
      expect(allLines()).toHaveLength(2);
      // Help is one button; nothing suggests a line (§6).
      expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('says so when the player closes a box and draws again (§2, §10)', async () => {
    vi.useFakeTimers();
    try {
      // Box (2,2) has three sides; its right side is the player's to take.
      renderGame(
        savedMatch([
          [CPU, hEdge(3, 2, 2)],
          [PLAYER, hEdge(3, 3, 2)],
          [CPU, vEdge(3, 2, 2)],
        ]),
      );
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /3 × 3.*Resume/ }));

      fireEvent.click(screen.getByRole('button', { name: 'Vertical line 3, 4, not drawn' }));
      expect(screen.getByRole('img', { name: 'Box 3, 3, yours' })).toBeInTheDocument();
      expect(screen.getByText('Another turn!')).toBeInTheDocument();
      // Still the player's move, however long they take.
      await advance(CPU_DELAY_MS * 2);
      expect(cpuLines()).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('moves focus to the next open line when the focused one is drawn (§10)', async () => {
    vi.useFakeTimers();
    try {
      renderGame(savedMatch([]));
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /3 × 3.*Resume/ }));

      const first = screen.getByRole('button', { name: 'Horizontal line 1, 1, not drawn' });
      first.focus();
      fireEvent.click(first);
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Horizontal line 1, 2, not drawn' }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('Ctrl+Z undoes the line and the reply together, same as the button', async () => {
    vi.useFakeTimers();
    try {
      renderGame(savedMatch([]));
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /3 × 3.*Resume/ }));

      fireEvent.click(screen.getByRole('button', { name: 'Vertical line 2, 2, not drawn' }));
      await advance(CPU_DELAY_MS);
      expect(allLines()).toHaveLength(2);

      fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
      expect(allLines()).toHaveLength(0);
      expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows no clock while playing (§10)', async () => {
    const user = userEvent.setup();
    renderGame(savedMatch([]));
    await user.click(await screen.findByRole('button', { name: /3 × 3.*Resume/ }));

    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
  });
});

describe('home', () => {
  it('offers three boards, leads with the last one picked, and exits to the collection', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame({
      ...tutorialDone,
      [DB_STORAGE_KEYS.prefs]: JSON.stringify({ schemaVersion: 1, size: 'large' }),
    });

    const large = await screen.findByRole('button', { name: '5 × 5' });
    expect(large).toHaveClass('btn-primary');
    expect(screen.getByRole('button', { name: '3 × 3' })).toHaveClass('btn-secondary');
    expect(screen.getByRole('button', { name: '4 × 4' })).toHaveClass('btn-secondary');

    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('asks before replacing a match in progress with another board', async () => {
    const user = userEvent.setup();
    renderGame(cornerOpen);

    await user.click(await screen.findByRole('button', { name: '4 × 4' }));
    expect(screen.getByText('Replace the game in progress?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: /3 × 3.*Resume/ })).toBeInTheDocument();
  });

  it('reports a record per board, and no streak (§7)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));

    expect(screen.getAllByText('Games played')).toHaveLength(3);
    expect(screen.getAllByText('Losses')).toHaveLength(3);
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});

describe('choosing a side (§1)', () => {
  it('lets the CPU open when the player picks second, and keeps the choice', async () => {
    vi.useFakeTimers();
    try {
      renderGame(tutorialDone);
      await settle();

      const second = screen.getByRole('radio', { name: 'CPU first' });
      expect(screen.getByRole('radio', { name: 'You first' })).toBeChecked();
      fireEvent.click(second);
      expect(second).toBeChecked();
      await settle();
      expect(
        (JSON.parse(deviceStore.get(DB_STORAGE_KEYS.prefs)!) as { playerGoesFirst: boolean })
          .playerGoesFirst,
      ).toBe(false);

      fireEvent.click(screen.getByRole('button', { name: '3 × 3' }));
      // The CPU's opening arrives on its own timer; until then the board is
      // not the player's to touch (§4).
      expect(screen.getByText('CPU is thinking…')).toBeInTheDocument();
      expect(cpuLines()).toHaveLength(0);
      await advance(CPU_DELAY_MS);
      expect(cpuLines()).toHaveLength(1);
      expect(screen.getByText('Your turn')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * A pinned home-screen shortcut, and what Dots and Boxes does about it (issue
 * #113). The shell says only which door was used; the decision below is this
 * game's, taken from its own single save slot (§8).
 */
describe('a home-screen shortcut', () => {
  const boardShown = () => screen.queryByRole('group', { name: /Dots and Boxes board/ });
  const homeShown = () => screen.queryByText('Choose a board');

  function store(records: Record<string, string>) {
    for (const [key, value] of Object.entries(records)) deviceStore.set(key, value);
  }

  it('opens the one suspended match straight onto its board', async () => {
    store(cornerOpen);
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <DotsAndBoxesRoot onExit={vi.fn()} entry="shortcut" />
      </SettingsProvider>,
    );
    await settle();

    expect(boardShown()).toBeInTheDocument();
    // The match that was left, not a fresh one: both lines are still down.
    expect(allLines()).toHaveLength(2);
    expect(homeShown()).not.toBeInTheDocument();
  });

  it('opens the home screen when nothing is suspended', async () => {
    store(tutorialDone);
    launch('shortcut');
    await settle();

    expect(boardShown()).not.toBeInTheDocument();
    expect(homeShown()).toBeInTheDocument();
  });

  it('is the only door that resumes: a tile on the collection still opens the home', async () => {
    store(cornerOpen);
    launch();
    await settle();

    expect(boardShown()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /3 × 3.*Resume/ })).toBeInTheDocument();
  });

  it('teaches the game first on a launch that has never seen Quick Rules', async () => {
    store(cornerOpen);
    deviceStore.delete(DB_STORAGE_KEYS.flags);
    launch('shortcut');

    expect(await screen.findByText('Tap between two dots')).toBeInTheDocument();
    expect(boardShown()).not.toBeInTheDocument();

    // And Quick Rules lead onto the match that was waiting, not over it: the
    // two lines already drawn are still there, and the save keeps its seed.
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Playing' }));
    await settle();
    expect(boardShown()).toBeInTheDocument();
    expect(allLines()).toHaveLength(2);
    expect((JSON.parse(deviceStore.get(DB_STORAGE_KEYS.game)!) as { seed: string }).seed).toBe(
      'dots-and-boxes-uitest',
    );
  });

  it('plays the CPU’s turn when the match was left on it', async () => {
    // Left right after handing over box (0,0): the CPU owes its run.
    let session = createSession('small', 'dots-and-boxes-uitest');
    let lines = session.board;
    for (const edge of [hEdge(3, 0, 0), vEdge(3, 0, 0), hEdge(3, 1, 0)]) {
      lines = claim(lines, PLAYER, edge)!.board;
    }
    session = { ...session, board: lines, toMove: CPU, moveCount: 3 };
    store({ ...tutorialDone, [DB_STORAGE_KEYS.game]: JSON.stringify(toPersisted(session, 1)) });

    vi.useFakeTimers();
    try {
      launch('shortcut');
      await settle();
      expect(screen.getByText('CPU is thinking…')).toBeInTheDocument();
      await advance(CPU_DELAY_MS);
      expect(screen.getByRole('img', { name: 'Box 1, 1, CPU' })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not book the resumed match’s play seconds a second time', async () => {
    store(cornerOpen);
    vi.useFakeTimers();
    try {
      launch('shortcut');
      await settle();
      act(() => vi.advanceTimersByTime(5_000));
      background();
      await settle();
      const stats = JSON.parse(deviceStore.get(DB_STORAGE_KEYS.stats)!) as Stats;
      const game = JSON.parse(deviceStore.get(DB_STORAGE_KEYS.game)!) as PersistedGame;
      expect(game.elapsedSeconds).toBe(5);
      expect(stats.totalPlaySeconds).toBe(5);

      cleanup();
      launch('shortcut');
      await settle();
      act(() => vi.advanceTimersByTime(3_000));
      background();
      await settle();
      const after = JSON.parse(deviceStore.get(DB_STORAGE_KEYS.stats)!) as Stats;
      const resumed = JSON.parse(deviceStore.get(DB_STORAGE_KEYS.game)!) as PersistedGame;
      // Eight seconds of play, counted once.
      expect(resumed.elapsedSeconds).toBe(8);
      expect(after.totalPlaySeconds).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });
});
