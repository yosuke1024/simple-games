import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { EMPTY, createLevelSession } from '../game';
import { FT_STORAGE_KEYS, type Stats } from '../storage/schemas';
import { FutoshikiRoot } from './FutoshikiRoot';

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
      <FutoshikiRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

const tutorialDone = {
  [FT_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

const board = () => screen.getByRole('group', { name: /Futoshiki board/ });

/**
 * A square by its position. The comma is what makes this unambiguous: a
 * square's own position reads "row 1, column 3", while the sign sentences in
 * the same label read "Row 1: column 3 is smaller…" — so the separator
 * distinguishes the square from the signs it is party to.
 */
const cellAt = (row: number, col: number) =>
  within(board()).getByRole('button', { name: new RegExp(`row ${row}, column ${col}(\\.|,|$)`) });

const pad = () => screen.getByRole('group', { name: 'Number pad' });
const padKey = (digit: number) =>
  within(pad()).getByRole('button', { name: new RegExp(`^${digit},`) });
/** The same key while Notes is on — it writes a candidate, and says so. */
const notePadKey = (digit: number) => within(pad()).getByRole('button', { name: `Note ${digit}` });

async function startLevelOne(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Level 1/ }));
}

/** Launches the app against the device store, the way a player's phone does. */
function launch() {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <FutoshikiRoot onExit={vi.fn()} />
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
  const raw = deviceStore.get(FT_STORAGE_KEYS.stats);
  if (raw === undefined) return 0;
  const stats = JSON.parse(raw) as Stats;
  return (
    stats.size4.totalPlaySeconds +
    stats.size5.totalPlaySeconds +
    stats.size6.totalPlaySeconds +
    stats.size7.totalPlaySeconds
  );
}

/** One suspended board's own clock, as it survives on disk (§11). */
function storedSessionSeconds(key: string): number {
  const raw = deviceStore.get(key);
  if (raw === undefined) return 0;
  return (JSON.parse(raw) as { elapsedSeconds: number }).elapsedSeconds;
}

/** Level 1 is deterministic (§9), so a test knows its answer the same way a
 * player's device does. */
const truth = createLevelSession(1);
const positionOf = (index: number) => ({
  row: Math.floor(index / truth.size) + 1,
  col: (index % truth.size) + 1,
});
/** The squares level 1 leaves to the player — the only kind a tap moves. */
const openCells = truth.board.givens
  .map((given, index) => (given === EMPTY ? index : -1))
  .filter((index) => index >= 0);

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
    deviceStore.set(FT_STORAGE_KEYS.flags, tutorialDone[FT_STORAGE_KEYS.flags]!);
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
  // disk, the player opens Futoshiki, looks at the home screen and leaves
  // without resuming. Nothing was played, so nothing may be booked — and the
  // second visit must not book it again either. Before the baseline was seeded
  // from the restored session, each visit added its whole elapsed time.
  it('books nothing when a suspended game is opened and left unresumed', async () => {
    deviceStore.set(FT_STORAGE_KEYS.flags, tutorialDone[FT_STORAGE_KEYS.flags]!);
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

/**
 * A pinned home-screen shortcut, and what Futoshiki does about it (issue
 * #113). The shell says only which door was used; every decision below is
 * this game's, taken from its own three save slots (§9, §11).
 */
describe('a home-screen shortcut', () => {
  /** The same device store a launch reads, entered by the other door. */
  function launchFromShortcut(onExit = vi.fn()) {
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <FutoshikiRoot onExit={onExit} entry="shortcut" />
      </SettingsProvider>,
    );
    return onExit;
  }

  /** Quick Rules behind the player, the way every launch after the first finds them. */
  function taughtAlready() {
    deviceStore.set(FT_STORAGE_KEYS.flags, tutorialDone[FT_STORAGE_KEYS.flags]!);
  }

  const maybeBoard = () => screen.queryByRole('group', { name: /Futoshiki board/ });
  const maybeHome = () => screen.queryByRole('button', { name: /Daily Challenge/ });

  /** Suspends level 1: start it, then step back to this game's home. */
  async function suspendLevelOne(user: ReturnType<typeof userEvent.setup>) {
    await startLevelOne(user);
    await user.click(screen.getByRole('button', { name: 'Home' }));
  }

  it('opens the one suspended game straight onto its board', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await suspendLevelOne(user);
    cleanup();

    launchFromShortcut();
    await settle();

    // The 4×4 the player left, not the home screen that offers it.
    expect(maybeBoard()).toBeInTheDocument();
    expect(within(board()).getAllByRole('button')).toHaveLength(16);
    expect(maybeHome()).not.toBeInTheDocument();
  });

  it('leaves the board for this game’s home, not the collection', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await suspendLevelOne(user);
    cleanup();

    const onExit = launchFromShortcut();
    await settle();
    await user.click(screen.getByRole('button', { name: 'Home' }));

    // One step back from a board is this game's home, whichever door the
    // board was reached through: the way in did not add a screen to undo.
    expect(maybeHome()).toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();
  });

  it('opens a suspended daily just as readily as a level', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    // The daily is the slot most easily forgotten: it is not the one the home
    // screen leads with, and a rule that counted only the other two would both
    // miss this board and mistake a level+daily pair for a single answer.
    await user.click(await screen.findByRole('button', { name: /Daily Challenge/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    cleanup();

    launchFromShortcut();
    await settle();

    expect(maybeBoard()).toBeInTheDocument();
    expect(screen.getByText('Daily')).toBeInTheDocument();
    // A daily is a 6×6 (§9), so this is that board and not the 4×4 level slot.
    expect(within(board()).getAllByRole('button')).toHaveLength(36);
  });

  it('opens the home screen when two games are suspended, rather than guessing', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await suspendLevelOne(user);
    await user.click(screen.getByRole('button', { name: /Free Play/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    cleanup();

    launchFromShortcut();
    await settle();

    // Both are still there to be picked up by hand — neither was chosen for
    // the player, and neither was thrown away either (§11).
    expect(maybeBoard()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Level 1.*Resume/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Free Play.*Resume/ })).toBeInTheDocument();
  });

  // The same rule over the pair the counting is likeliest to get wrong: a slot
  // left out of the count makes this look like a single answer, and the player
  // lands on the level they did not ask for with the daily still waiting.
  it('counts a suspended daily too, and so offers both rather than guessing', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await suspendLevelOne(user);
    await user.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    cleanup();

    launchFromShortcut();
    await settle();

    expect(maybeBoard()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Level 1.*Resume/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge.*Resume/ })).toBeInTheDocument();
  });

  it('opens the home screen when nothing is suspended', async () => {
    taughtAlready();
    launchFromShortcut();
    await settle();

    expect(maybeBoard()).not.toBeInTheDocument();
    expect(maybeHome()).toBeInTheDocument();
  });

  it('is the only door that resumes: a tile on the collection still opens the home', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await suspendLevelOne(user);
    cleanup();

    launch();
    await settle();

    expect(maybeBoard()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Level 1.*Resume/ })).toBeInTheDocument();
  });

  it('teaches the game first on a launch that has never seen it (§12)', async () => {
    const user = userEvent.setup();
    // A suspended board AND no Quick Rules behind the player, together. The
    // two can only meet through "Reset Local Data", which wipes the flags and
    // leaves the saves — but the test has to arrange it, because a launch
    // against an empty store lands on Quick Rules whatever the gate says, and
    // would pin nothing at all.
    taughtAlready();
    launch();
    await settle();
    await suspendLevelOne(user);
    cleanup();
    deviceStore.delete(FT_STORAGE_KEYS.flags);

    launchFromShortcut();

    // Quick Rules first: a shortcut is not a way past them.
    expect(await screen.findByText('Each digit once')).toBeInTheDocument();
    expect(maybeBoard()).not.toBeInTheDocument();
  });

  // The counterpart of the backgrounding tests above, on the slot that would
  // hide the mistake: mounting straight onto a game never runs `activate`, so
  // both clocks have to be seeded from the resumed slot at mount. A free
  // board is the one that proves it — seeded from the level slot instead, the
  // baseline would be zero and this session's five seconds would land twice.
  //
  // Both numbers are read, and that is the point. The statistics alone cannot
  // see the whole of it: leave the live clock at zero and the board's own
  // elapsedSeconds stops moving until the mount has run as long as the game
  // already had, which understates the eventual clear and can mint a best time
  // nobody played (§10). The board has to still know how long it has been
  // played, not just the totals.
  it('does not book the resumed game’s play seconds a second time', async () => {
    taughtAlready();
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Free Play/ }));
      act(() => vi.advanceTimersByTime(5_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(5);
      expect(storedSessionSeconds(FT_STORAGE_KEYS.freeGame)).toBe(5);

      cleanup();
      launchFromShortcut();
      await settle();
      expect(maybeBoard()).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(3_000));
      background();
      await settle();
      // Eight seconds of play, counted once, on a board that still knows it
      // has been played for eight — so the eventual clear is measured
      // honestly (§10).
      expect(storedPlaySeconds()).toBe(8);
      expect(storedSessionSeconds(FT_STORAGE_KEYS.freeGame)).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('first run', () => {
  it('shows Quick Rules and starts level 1 right after (§12)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Each digit once')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Follow the signs')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Notes and hints')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    expect(screen.getByText('Level 1')).toBeInTheDocument();
    // Level 1 is a 4×4: sixteen squares, six of them given.
    expect(within(board()).getAllByRole('button')).toHaveLength(16);
  });
});

describe('the signs are on the board, in words (§13)', () => {
  it('draws every sign as text, not as decoration', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const signs = within(board()).getAllByRole('img');
    expect(signs).toHaveLength(truth.constraints.length);
    // Real characters in the DOM. Drawn as CSS pseudo-content they would be
    // unreadable to assistive technology and half the rules would vanish.
    for (const sign of signs) expect(['<', '>']).toContain(sign.textContent);
  });

  it('says which side is smaller instead of naming the character', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    // Level 1 carries a sign down the first column: square (1,1) is the
    // smaller of the pair. "Less than" would leave a listener guessing which.
    expect(
      within(board()).getByRole('img', { name: 'Column 1: row 1 is smaller than row 2' }),
    ).toBeInTheDocument();
    expect(within(board()).queryByRole('img', { name: /less than sign/i })).toBeNull();
  });

  it('reads the sign again on both squares it touches', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    // Arriving at either square, a listener is told the same sentence.
    expect(cellAt(1, 1).getAttribute('aria-label')).toContain(
      'Column 1: row 1 is smaller than row 2',
    );
    expect(cellAt(2, 1).getAttribute('aria-label')).toContain(
      'Column 1: row 1 is smaller than row 2',
    );
  });
});

describe('playing (§4)', () => {
  it('writes a digit into the selected square', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const { row, col } = positionOf(openCells[0]!);
    expect(cellAt(row, col).getAttribute('aria-label')).toMatch(/^Empty/);
    await user.click(cellAt(row, col));
    await user.click(padKey(truth.solution[openCells[0]!]!));
    expect(cellAt(row, col).getAttribute('aria-label')).toMatch(
      new RegExp(`^${truth.solution[openCells[0]!]!},`),
    );
  });

  it('leaves the given squares fixed (§1)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const given = within(board()).getAllByRole('button', { name: /given/ });
    expect(given).toHaveLength(16 - openCells.length);
    for (const cell of given) expect(cell).toBeDisabled();
  });

  it('counts each digit down and disables it once it is all placed (§4)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    // Three of the four 4s are given, so one is left to place.
    expect(padKey(4).getAttribute('aria-label')).toBe('4, 1 left');
    const last = truth.solution.findIndex(
      (value, index) => value === 4 && truth.board.givens[index] === EMPTY,
    );
    const { row, col } = positionOf(last);
    await user.click(cellAt(row, col));
    await user.click(padKey(4));
    expect(padKey(4).getAttribute('aria-label')).toBe('4, 0 left');
    expect(padKey(4)).toBeDisabled();
  });

  it('offers only the digits this board size has', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    // A 4×4 pad has four keys — never a 5 the board could not hold.
    expect(within(pad()).getAllByRole('button')).toHaveLength(4);
  });

  it('pencils a note instead of a digit while Notes is on (§4)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const { row, col } = positionOf(openCells[0]!);
    await user.click(cellAt(row, col));
    await user.click(screen.getByRole('button', { name: 'Notes' }));
    await user.click(notePadKey(2));
    // The square is still empty: a note is a candidate, not an answer.
    expect(cellAt(row, col).getAttribute('aria-label')).toMatch(/^Empty/);
    expect(cellAt(row, col).textContent).toContain('2');
  });

  it('takes a move back, notes and all (§5)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    // Nothing to undo on a fresh board.
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();

    const { row, col } = positionOf(openCells[0]!);
    await user.click(cellAt(row, col));
    await user.click(padKey(2));
    expect(cellAt(row, col).getAttribute('aria-label')).toMatch(/^2,/);

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(cellAt(row, col).getAttribute('aria-label')).toMatch(/^Empty/);
  });
});

describe('mistakes and violations (§5)', () => {
  it('marks a duplicate the moment it appears, on both squares', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    // Row 1 already holds a given 1; writing another one breaks rule 1.
    await user.click(cellAt(1, 3));
    await user.click(padKey(1));
    expect(cellAt(1, 3).getAttribute('aria-label')).toContain('Breaks a rule');
    expect(cellAt(1, 1).getAttribute('aria-label')).toContain('Breaks a rule');
  });

  it('marks a sign its two squares now read the wrong way', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const sign = within(board()).getByRole('img', {
      name: 'Row 1: column 4 is smaller than column 3',
    });
    expect(sign.className).not.toContain('futoshiki-sign-broken');

    await user.click(cellAt(1, 3));
    await user.click(padKey(2));
    await user.click(cellAt(1, 4));
    await user.click(padKey(3));
    expect(sign.className).toContain('futoshiki-sign-broken');
  });

  it('says nothing about a legal digit that happens to be wrong, unless asked to', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    // (1,3) answers 3. A 2 there breaks no rule yet — both signs on it have an
    // empty neighbour — so the violation display stays quiet and only the
    // optional mistake mark speaks.
    await user.click(cellAt(1, 3));
    await user.click(padKey(2));
    expect(cellAt(1, 3).getAttribute('aria-label')).not.toContain('Breaks a rule');
    expect(cellAt(1, 3).className).toContain('futoshiki-cell-mistake');
  });

  it('keeps quiet about it when the player has turned the setting off', async () => {
    const user = userEvent.setup();
    renderGame({
      ...tutorialDone,
      [FT_STORAGE_KEYS.prefs]: JSON.stringify({ schemaVersion: 1, highlightMistakes: false }),
    });
    await startLevelOne(user);

    await user.click(cellAt(1, 3));
    await user.click(padKey(2));
    expect(cellAt(1, 3).className).not.toContain('futoshiki-cell-mistake');
  });
});

describe('hints (§6)', () => {
  it('explains the next step without naming an axis', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    await user.click(screen.getByRole('button', { name: 'Hint' }));
    const message = screen.getByRole('status').textContent ?? '';
    expect(message.length).toBeGreaterThan(0);
    // The same deduction can come off a row, a column or the signs, so no
    // sentence here may claim one of them.
    expect(message).not.toMatch(/\brow\b|\bcolumn\b/i);
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

describe('solving (§2)', () => {
  it('says so once every square, line and sign holds', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    for (const index of openCells) {
      const { row, col } = positionOf(index);
      await user.click(cellAt(row, col));
      await user.click(padKey(truth.solution[index]!));
    }

    expect(await screen.findByRole('alertdialog', { name: 'Solved!' })).toBeInTheDocument();
    expect(screen.getByText('Mistakes')).toBeInTheDocument();
    expect(screen.getByText('Hints used')).toBeInTheDocument();
  });
});

describe('the pickers ask before replacing a suspended game (§9)', () => {
  it('asks before the daily backlog replaces a daily in progress', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);

    await user.click(await screen.findByRole('button', { name: /Daily Challenge/ }));
    expect(board()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: 'Past Dailies' }));

    // There is one daily slot, so an earlier day would take this one's place.
    const rows = screen.getAllByRole('button');
    const anotherDay = rows.find((row) => row.textContent?.includes('/'));
    expect(anotherDay).toBeDefined();
    await user.click(anotherDay!);
    expect(screen.getByRole('alertdialog', { name: 'Start a new game?' })).toBeInTheDocument();
  });

  it('asks before the level picker replaces a level in progress', async () => {
    const user = userEvent.setup();
    renderGame({
      ...tutorialDone,
      [FT_STORAGE_KEYS.progress]: JSON.stringify({
        schemaVersion: 1,
        highestUnlocked: 3,
        bestSeconds: {},
        dailySeconds: {},
      }),
    });

    await user.click(await screen.findByRole('button', { name: /Level 3/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: /^Levels/ }));
    await user.click(screen.getByRole('button', { name: 'Level 1' }));
    expect(screen.getByRole('alertdialog', { name: 'Start a new game?' })).toBeInTheDocument();
  });
});

describe('what this game deliberately does not have', () => {
  it('shows no clock and no mistake counter while playing (§10)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
    expect(screen.queryByText('Mistakes')).not.toBeInTheDocument();
  });

  it('reports per-size facts on the statistics screen, and no streak (§10)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));

    expect(screen.getByText('Levels solved')).toBeInTheDocument();
    for (const size of ['4×4', '5×5', '6×6', '7×7']) {
      expect(screen.getByText(size)).toBeInTheDocument();
    }
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});

describe('home', () => {
  it('offers every mode, says how far up the hundred, and hands control back', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);

    expect(await screen.findByRole('button', { name: /Level 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Free Play/ })).toBeInTheDocument();
    // The Levels chip says how many of the hundred are done: a fraction with
    // an end, not a bar that fills.
    expect(screen.getByText('0/100')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

/* Keyboard input is an adapter over the same tap handlers (issue #93): this
   checks board state the Undo button also produces, never a keyboard-only
   behaviour. */
describe('keyboard (issue #93)', () => {
  it('Ctrl+Z undoes the last digit, same as the Undo button', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const { row, col } = positionOf(openCells[0]!);
    await user.click(cellAt(row, col));
    await user.click(padKey(truth.solution[openCells[0]!]!));
    expect(cellAt(row, col).getAttribute('aria-label')).toMatch(/^\d,/);

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(cellAt(row, col).getAttribute('aria-label')).toMatch(/^Empty/);
  });
});

describe('free play (§9)', () => {
  it('starts a board at the chosen tier, and resumes it from the home', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await screen.findByRole('button', { name: /Level 1/ });

    // The picker stands on medium until told otherwise; here, hard — level
    // 95's parameters, a 7×7 — and the choice is written down at once.
    const picker = screen.getByRole('group', { name: 'Difficulty' });
    await user.click(within(picker).getByRole('button', { name: 'Hard' }));
    await settle();
    expect(JSON.parse(deviceStore.get(FT_STORAGE_KEYS.prefs)!)).toMatchObject({
      freeTier: 'hard',
    });
    await user.click(screen.getByRole('button', { name: /Free Play/ }));

    // The top bar names the mode and the size — no level number, no clock.
    expect(screen.getByText('Free Play')).toBeInTheDocument();
    expect(screen.getByText('7×7')).toBeInTheDocument();
    expect(screen.queryByText(/Level \d/)).not.toBeInTheDocument();
    expect(within(board()).getAllByRole('button')).toHaveLength(49);

    // A digit, then away and back: the board is where it was left.
    const empty = within(board())
      .getAllByRole('button')
      .find((cell) => cell.getAttribute('aria-label')?.startsWith('Empty'))!;
    await user.click(empty);
    await user.click(
      within(pad())
        .getAllByRole('button')
        .find((key) => !key.hasAttribute('disabled'))!,
    );
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByRole('button', { name: /Free Play.*Resume.*Hard/ })).toBeInTheDocument();
    // The level climb is untouched by a free board.
    expect(screen.getByRole('button', { name: /Level 1/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Free Play/ }));
    expect(screen.getByText('7×7')).toBeInTheDocument();
    expect(
      within(board())
        .getAllByRole('button')
        .some((cell) => cell.getAttribute('aria-label')?.startsWith('Empty')),
    ).toBe(true);
  });

  it('asks before replacing a suspended free board with a new one', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /Free Play/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));

    await user.click(screen.getByRole('button', { name: 'New Game' }));
    expect(screen.getByRole('alertdialog', { name: 'Start a new game?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: /Free Play.*Resume/ })).toBeInTheDocument();
  });
});
