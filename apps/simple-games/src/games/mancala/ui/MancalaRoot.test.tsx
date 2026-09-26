import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import {
  applyCpuMove,
  applyPlayerMove,
  CPU,
  createSession,
  PLAYER,
  restoreSession,
  type MancalaSession,
} from '../game';
import { toPersisted } from '../storage/gamePersistence';
import { MC_STORAGE_KEYS, type PersistedGame, type Stats } from '../storage/schemas';
import { CPU_DELAY_MS } from '../state/GameContext';
import { MancalaRoot } from './MancalaRoot';

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
      <MancalaRoot onExit={onExit} kv={createMemoryKV(initial)} />
    </SettingsProvider>,
  );
  return { onExit };
}

/** Launches the game against the device store, the way a player's phone does. */
function launch() {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <MancalaRoot onExit={onExit} />
    </SettingsProvider>,
  );
  return { onExit };
}

/** Lets the local reads and the saves they trigger resolve (promises, not timers). */
const settle = () => act(async () => undefined);

/**
 * Winds this file's clock on and lets React answer it. The CPU's move is
 * armed on a real `setTimeout` and the search runs inside it (§4,
 * state/GameContext.tsx `CPU_DELAY_MS`), so these tests own the clock and
 * step it themselves — the move lands on the beat the rules give it, on any
 * machine (issue #158). They drive the screen with `fireEvent` for the same
 * reason: userEvent drains itself through a real 0ms timeout, which a stopped
 * clock never fires.
 */
const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

/**
 * Lets the CPU play `moves` moves. One beat each, stepped one at a time: each
 * move's timer is armed by the render that follows the one before it
 * (state/GameContext.tsx), so a single long advance would run only the first
 * — an extra turn (§2.1) is a second beat, not a longer one.
 */
const beats = async (moves: number) => {
  for (let i = 0; i < moves; i++) await advance(CPU_DELAY_MS);
};

/** The app goes to background. Android may kill it without another event. */
function background() {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  Reflect.deleteProperty(document, 'visibilityState');
}

function storedStats(): Stats | null {
  const raw = deviceStore.get(MC_STORAGE_KEYS.stats);
  return raw === undefined ? null : (JSON.parse(raw) as Stats);
}

function storedMatchSeconds(): number {
  const raw = deviceStore.get(MC_STORAGE_KEYS.game);
  if (raw === undefined) return 0;
  return (JSON.parse(raw) as PersistedGame).elapsedSeconds;
}

const SEED = 'mancala-uitest';

const tutorialDone = {
  [MC_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

const savedGame = {
  ...tutorialDone,
  [MC_STORAGE_KEYS.game]: JSON.stringify(toPersisted(createSession('easy', PLAYER, SEED), 1)),
};

/** A saved match on any board, as a player could have left it. */
const savedOn = (session: MancalaSession) => ({
  ...tutorialDone,
  [MC_STORAGE_KEYS.game]: JSON.stringify(toPersisted(session, 1)),
});

/**
 * What the CPU will do after the player's pit `pit` on the saved opening: the
 * same functions the screen calls, on the same seed (§4 determinism). The
 * tests read the expected board from here rather than hard-coding the CPU's
 * choices a second time — compatibility.test.ts already pins those.
 */
function replyTo(pit: number): { session: MancalaSession; cpuMoves: number } {
  let session = applyPlayerMove(createSession('easy', PLAYER, SEED), pit)!;
  let cpuMoves = 0;
  while (session.status === 'playing' && session.toMove === CPU) {
    session = applyCpuMove(session)!;
    cpuMoves += 1;
  }
  return { session, cpuMoves };
}

const board = () => screen.getByRole('group', { name: /Mancala board/ });
const pitButton = (n: number) =>
  within(board()).getByRole('button', { name: new RegExp(`^Your pit ${n},`) });
const storeLabel = (who: 'Your' | 'CPU', count: number) =>
  within(board()).getByRole('img', { name: `${who} store, seeds: ${count}` });

/** Every count on the board, in index order, as the screen announces them. */
function announcedPits(): number[] {
  const read = (label: string | null) => Number(/seeds: (\d+)$/.exec(label ?? '')![1]);
  const pits = new Array<number>(14).fill(-1);
  for (let n = 1; n <= 6; n++) {
    pits[n - 1] = read(pitButton(n).getAttribute('aria-label'));
    pits[12 - (n - 1)] = read(
      within(board())
        .getByRole('img', { name: new RegExp(`^CPU pit ${n},`) })
        .getAttribute('aria-label'),
    );
  }
  pits[6] = read(
    within(board())
      .getByRole('img', { name: /^Your store/ })
      .getAttribute('aria-label'),
  );
  pits[13] = read(
    within(board())
      .getByRole('img', { name: /^CPU store/ })
      .getAttribute('aria-label'),
  );
  return pits;
}

afterEach(() => {
  cleanup();
  deviceStore.clear();
});

describe('first run', () => {
  it('shows Quick Rules and deals an easy match right after (§9)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'How to Play' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Tap a pit to sow')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('End in your store, go again')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('End in an empty pit, take')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // Six pits to press — the player's — and the opening board (§1).
    expect(within(board()).getAllByRole('button')).toHaveLength(6);
    expect(announcedPits()).toEqual([4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0]);
    expect(screen.getByText('Your turn')).toBeInTheDocument();
  });
});

describe('home', () => {
  it('wears the early-release notice, and exits to the collection', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);

    expect(await screen.findByRole('button', { name: /Easy/ })).toBeInTheDocument();
    expect(screen.getByText(/Early release/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('reports a record per opponent, and no streak (§7)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));

    expect(screen.getAllByText('Games played')).toHaveLength(3);
    expect(screen.getAllByText('Draws')).toHaveLength(3);
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });

  it('asks before a different opponent replaces the match in progress', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Hard/ }));
    expect(screen.getByText('Replace the match in progress?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: /Easy.*Resume/ })).toBeInTheDocument();
  });
});

describe('playing', () => {
  it('sows a pit through the DOM and lets the CPU answer on its beat (§2, §4)', async () => {
    vi.useFakeTimers();
    try {
      renderGame(savedGame);
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Easy/ }));

      expect(screen.getByText('Your turn')).toBeInTheDocument();
      fireEvent.click(pitButton(1));
      // Pit 1's four seeds went to pits 2–5, and the turn passed (§2).
      expect(announcedPits()).toEqual([0, 5, 5, 5, 5, 4, 0, 4, 4, 4, 4, 4, 4, 0]);
      expect(pitButton(2)).toBeDisabled();
      expect(screen.getByText('CPU is thinking…')).toBeInTheDocument();

      // The CPU answers on a timer and on nothing else: a tick short of the
      // delay the board is still as the player left it.
      await advance(CPU_DELAY_MS - 1);
      expect(announcedPits()).toEqual([0, 5, 5, 5, 5, 4, 0, 4, 4, 4, 4, 4, 4, 0]);

      // Then one move per beat — an extra turn is a second beat (§2.1, §4).
      const { session: expected, cpuMoves } = replyTo(0);
      await advance(1);
      await beats(cpuMoves - 1);
      expect(announcedPits()).toEqual(expected.pits);
      expect(screen.getByText(/Your turn/)).toBeInTheDocument();
      expect(pitButton(2)).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the turn after the last seed lands in the store (§2.1)', async () => {
    vi.useFakeTimers();
    try {
      renderGame(savedGame);
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Easy/ }));

      // Pit 3's four seeds: pits 4, 5, 6, then the store.
      fireEvent.click(pitButton(3));
      expect(storeLabel('Your', 1)).toBeInTheDocument();
      expect(screen.getByText('Another turn!')).toBeInTheDocument();
      // Nothing is scheduled for the CPU: the board is still the player's.
      await beats(3);
      expect(storeLabel('CPU', 0)).toBeInTheDocument();
      expect(pitButton(1)).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('takes back the move and every CPU move after it (§5)', async () => {
    vi.useFakeTimers();
    try {
      renderGame(savedGame);
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Easy/ }));

      expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
      fireEvent.click(pitButton(1));
      const { cpuMoves } = replyTo(0);
      await beats(cpuMoves);
      expect(screen.getByText(/Your turn/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      expect(announcedPits()).toEqual([4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0]);
      expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
      // Help is one button; nothing suggests a pit (§6).
      expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows no clock while playing (§10)', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Easy/ }));
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
  });

  it('ends on the move that empties a row, and books the win once (§3, §7)', async () => {
    // One seed left on the player's side, one from the store: sowing it ends
    // the game, and the CPU's six seeds go to the CPU's store.
    const endgame = restoreSession({
      seed: SEED,
      difficulty: 'normal',
      first: PLAYER,
      pits: [0, 0, 0, 0, 0, 1, 31, 1, 1, 1, 1, 1, 1, 10],
      toMove: PLAYER,
      moveCount: 40,
      elapsedSeconds: 0,
    });
    for (const [key, value] of Object.entries(savedOn(endgame))) deviceStore.set(key, value);
    const user = userEvent.setup();
    launch();
    await user.click(await screen.findByRole('button', { name: /Normal/ }));
    await user.click(pitButton(6));

    const dialog = await screen.findByRole('alertdialog', { name: 'You win!' });
    expect(within(dialog).getByText('32')).toBeInTheDocument();
    expect(within(dialog).getByText('16')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Share/ })).toBeInTheDocument();
    await settle();
    expect(storedStats()!.normal).toMatchObject({ wins: 1, losses: 0, draws: 0 });
    // A finished match is not kept to come back to (§8).
    expect(deviceStore.has(MC_STORAGE_KEYS.game)).toBe(false);
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

      fireEvent.click(screen.getByRole('button', { name: /Easy/ }));
      // The CPU's opening arrives on its own timer; until then the board is
      // not the player's to touch (§4).
      expect(screen.getByText('CPU is thinking…')).toBeInTheDocument();
      expect(pitButton(1)).toBeDisabled();
      for (let beat = 0; beat < 10 && screen.queryByText(/Your turn/) === null; beat++) {
        await advance(CPU_DELAY_MS);
      }
      expect(screen.getByText(/Your turn/)).toBeInTheDocument();
      expect(announcedPits()[13]).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

/* Keyboard input is an adapter over the same tap handlers (issue #93): these
   check board state the buttons also produce, never a keyboard-only
   behaviour. */
describe('keyboard (issue #93)', () => {
  it('1–6 sow the player’s pits left to right, and Ctrl+Z undoes like the button', async () => {
    vi.useFakeTimers();
    try {
      renderGame(savedGame);
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Easy/ }));

      fireEvent.keyDown(window, { key: '1' });
      expect(announcedPits().slice(0, 7)).toEqual([0, 5, 5, 5, 5, 4, 0]);
      // Not the player's turn: a key is nothing, as a tap would be.
      fireEvent.keyDown(window, { key: '6' });
      expect(announcedPits()[5]).toBe(4);

      const { cpuMoves } = replyTo(0);
      await beats(cpuMoves);
      fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
      expect(announcedPits()).toEqual([4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0]);
      expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('answers nothing while the new-game dialog is open', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Easy/ }));
    await user.click(screen.getByRole('button', { name: 'New Game' }));
    expect(screen.getByText('Start a new game?')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: '3' });
    expect(storeLabel('Your', 0)).toBeInTheDocument();
  });
});

describe('opening a suspended game without resuming (#109)', () => {
  it("keeps a suspended board's clock when backgrounded from the game's home", async () => {
    deviceStore.set(MC_STORAGE_KEYS.flags, tutorialDone[MC_STORAGE_KEYS.flags]!);
    // The play clock is a plain interval, so it has to be faked before the
    // game screen mounts — which rules out userEvent here.
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Easy/ }));

      await advance(9_000);
      background();
      await settle();
      expect(storedMatchSeconds()).toBe(9);

      // The process dies here. Relaunch and stop on the game's own home.
      cleanup();
      launch();
      await settle();
      expect(screen.getByRole('button', { name: 'Statistics' })).toBeInTheDocument();

      // Away again without ever resuming: the nine seconds are still there.
      background();
      await settle();
      expect(storedMatchSeconds()).toBe(9);
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * A pinned home-screen shortcut, and what Mancala does about it (issue #113).
 * The shell says only which door was used; the decision below is this game's,
 * taken from its own single save slot (§8).
 */
describe('a home-screen shortcut', () => {
  function launchFromShortcut() {
    const onExit = vi.fn();
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <MancalaRoot onExit={onExit} entry="shortcut" />
      </SettingsProvider>,
    );
    return { onExit };
  }

  function taughtAlready() {
    deviceStore.set(MC_STORAGE_KEYS.flags, tutorialDone[MC_STORAGE_KEYS.flags]!);
  }

  /**
   * Resumes the fixed-seed Easy match, plays a move, lets the CPU answer, and
   * walks away (§8). The fixed seed is what lets `replyTo` say what the board
   * must look like afterwards; a fresh match would draw a seed of its own.
   */
  async function suspendAMatch() {
    for (const [key, value] of Object.entries(savedGame)) deviceStore.set(key, value);
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Easy/ }));
      fireEvent.click(pitButton(1));
      const { cpuMoves } = replyTo(0);
      await beats(cpuMoves);
      fireEvent.click(screen.getByRole('button', { name: 'Home' }));
      await settle();
      cleanup();
    } finally {
      vi.useRealTimers();
    }
  }

  const boardShown = () => screen.queryByRole('group', { name: /Mancala board/ });
  const homeShown = () => screen.queryByText('Choose your opponent');

  it('opens the one suspended match straight onto its board', async () => {
    taughtAlready();
    await suspendAMatch();

    launchFromShortcut();
    await settle();

    expect(boardShown()).toBeInTheDocument();
    // The match that was left, not a fresh one.
    expect(announcedPits()).toEqual(replyTo(0).session.pits);
    expect(homeShown()).not.toBeInTheDocument();
  });

  it('leaves the board for this game’s home, not the collection', async () => {
    taughtAlready();
    await suspendAMatch();

    const user = userEvent.setup();
    const { onExit } = launchFromShortcut();
    await settle();
    await user.click(screen.getByRole('button', { name: 'Home' }));

    expect(homeShown()).toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();
  });

  it('opens the home screen when nothing is suspended', async () => {
    taughtAlready();
    launchFromShortcut();
    await settle();

    expect(boardShown()).not.toBeInTheDocument();
    expect(homeShown()).toBeInTheDocument();
  });

  it('is the only door that resumes: a tile on the collection still opens the home', async () => {
    taughtAlready();
    await suspendAMatch();

    launch();
    await settle();

    expect(boardShown()).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Easy.*Resume/ })).toBeInTheDocument();
  });

  it('teaches the game first on a launch that has never seen Quick Rules', async () => {
    taughtAlready();
    await suspendAMatch();
    // The flag and the match are two independent records, so they can fall
    // out of step — a flags write that never landed leaves exactly this.
    deviceStore.delete(MC_STORAGE_KEYS.flags);

    launchFromShortcut();

    expect(await screen.findByText('Tap a pit to sow')).toBeInTheDocument();
    expect(boardShown()).not.toBeInTheDocument();

    // And Quick Rules lead onto the match that was waiting, not over it: the
    // save keeps its seed, and the board is the suspended one.
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Playing' }));
    await settle();
    expect(boardShown()).toBeInTheDocument();
    expect(announcedPits()).not.toEqual([4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0]);
    expect((JSON.parse(deviceStore.get(MC_STORAGE_KEYS.game)!) as { seed: string }).seed).toBe(
      SEED,
    );
  });

  it('plays a CPU turn it was suspended in, on the same beat (§8)', async () => {
    taughtAlready();
    // Left on the CPU's turn: the player had just moved.
    const afterPlayer = applyPlayerMove(createSession('easy', PLAYER, SEED), 0)!;
    for (const [key, value] of Object.entries(savedOn(afterPlayer))) deviceStore.set(key, value);

    vi.useFakeTimers();
    try {
      launchFromShortcut();
      await settle();
      expect(screen.getByText('CPU is thinking…')).toBeInTheDocument();
      const { session: expected, cpuMoves } = replyTo(0);
      await beats(cpuMoves);
      expect(announcedPits()).toEqual(expected.pits);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not book the resumed match’s play seconds a second time', async () => {
    taughtAlready();
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Easy/ }));

      act(() => vi.advanceTimersByTime(5_000));
      background();
      await settle();
      expect(storedStats()!.totalPlaySeconds).toBe(5);
      expect(storedMatchSeconds()).toBe(5);

      cleanup();
      launchFromShortcut();
      await settle();
      expect(boardShown()).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(3_000));
      background();
      await settle();
      // Eight seconds of play, counted once.
      expect(storedMatchSeconds()).toBe(8);
      expect(storedStats()!.totalPlaySeconds).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });
});
