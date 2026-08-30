import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { createLevelSession, isWhite } from '../game';
import { KK_STORAGE_KEYS, type Stats } from '../storage/schemas';
import { KakuroRoot } from './KakuroRoot';

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
      <KakuroRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

const tutorialDone = {
  [KK_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

const board = () => screen.getByRole('group', { name: /Kakuro board/ });

/**
 * A white square by its position. Only white squares are buttons — a clue
 * square is not somewhere a digit goes, so it is not one in the DOM either
 * (§4, §13), and scoping to the button role is what tells the two apart.
 */
const cellAt = (row: number, col: number) =>
  within(board()).getByRole('button', { name: new RegExp(`row ${row}, column ${col}(\\.|,|$)`) });

/** A clue square, which is read as words and never pressed. */
const clueAt = (row: number, col: number) =>
  within(board()).getByRole('img', { name: new RegExp(`row ${row}, column ${col}(\\.|,|$)`) });

const pad = () => screen.getByRole('group', { name: 'Number pad' });
const padKey = (digit: number) =>
  within(pad()).getByRole('button', { name: new RegExp(`^${digit}$`) });
/** The same key while Notes is on — it writes a candidate, and says so. */
const notePadKey = (digit: number) => within(pad()).getByRole('button', { name: `Note ${digit}` });

async function startLevelOne(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Level 1/ }));
}

/** Launches the app against the device store, the way a player's phone does. */
function launch() {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <KakuroRoot onExit={vi.fn()} />
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
  const raw = deviceStore.get(KK_STORAGE_KEYS.stats);
  if (raw === undefined) return 0;
  const stats = JSON.parse(raw) as Stats;
  return (
    stats.size6.totalPlaySeconds + stats.size8.totalPlaySeconds + stats.size10.totalPlaySeconds
  );
}

/** Level 1 is deterministic (§9), so a test knows its answer the same way a
 * player's device does. */
const truth = createLevelSession(1);
const positionOf = (index: number) => ({
  row: Math.floor(index / truth.size) + 1,
  col: (index % truth.size) + 1,
});
/** Every square of level 1 the player has to fill — which is all of them (§1). */
const openCells = [...truth.table.white];
/** The first horizontal run, and its two ends. */
const firstRow = truth.table.runs.find((run) => run.axis === 'row')!;

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
    deviceStore.set(KK_STORAGE_KEYS.flags, tutorialDone[KK_STORAGE_KEYS.flags]!);
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
  // disk, the player opens Kakuro, looks at the home screen and leaves without
  // resuming. Nothing was played, so nothing may be booked — and the second
  // visit must not book it again either. Before the baseline was seeded from
  // the restored session, each visit added its whole elapsed time.
  it('books nothing when a suspended game is opened and left unresumed', async () => {
    deviceStore.set(KK_STORAGE_KEYS.flags, tutorialDone[KK_STORAGE_KEYS.flags]!);
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

    expect(await screen.findByText('Add up to the clue')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('No digit twice')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Narrow it down')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    expect(screen.getByText('Level 1')).toBeInTheDocument();
    // Level 1 is a 6×6. Every white square is the player's, and none of them
    // arrives with a digit: this game hands out no givens at all (§1).
    expect(within(board()).getAllByRole('button')).toHaveLength(openCells.length);
    expect(within(board()).queryByRole('button', { name: /^[1-9], row/ })).toBeNull();
  });
});

describe('the clues are on the board, in words (§13)', () => {
  it('draws every sum as text, not as decoration', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    // One element per clue square — every square that is not the player's.
    const clues = within(board()).getAllByRole('img');
    expect(clues).toHaveLength(truth.size * truth.size - openCells.length);
    // Real digits in the DOM. Drawn as CSS pseudo-content they would be
    // unreadable to assistive technology, and this board would be an empty
    // grid: the clues are the whole of the puzzle here (§1).
    const printed = clues.map((clue) => clue.textContent).filter((text) => text !== '');
    expect(printed).toContain(String(firstRow.sum));
    expect(printed).toHaveLength(truth.table.runs.length - sharedClueSquares());
  });

  it('says which way each sum runs instead of naming the shape', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const { row, col } = positionOf(firstRow.clue);
    // "Sigma" or "diagonal" would leave a listener with no way to tell which
    // of the two sums runs right and which runs down.
    expect(clueAt(row, col).getAttribute('aria-label')).toContain(
      `Right, sum ${firstRow.sum} across ${firstRow.cells.length} cells`,
    );
    expect(within(board()).queryByRole('img', { name: /sigma|diagonal|slash/i })).toBeNull();
  });

  it('reads both of a square’s sums on the square itself', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    // The clue lives outside the square being filled, and arrives from two
    // directions at once. Repeating both here is what saves a listener a trip
    // to the clue square and back for every digit they write (§13).
    const first = firstRow.cells[0]!;
    const column = truth.table.runs[truth.table.colRun[first]!]!;
    const label = cellAt(positionOf(first).row, positionOf(first).col).getAttribute('aria-label');
    expect(label).toContain(`Right, sum ${firstRow.sum} across ${firstRow.cells.length} cells`);
    expect(label).toContain(`Down, sum ${column.sum} across ${column.cells.length} cells`);
  });

  it('leaves the clue squares unpressable, and still readable', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const { row, col } = positionOf(firstRow.clue);
    // Not a disabled button — not a button at all (§4). It is still in the
    // reading, which is the half of §13 that "not tappable" must not cost.
    expect(within(board()).queryByRole('button', { name: /^Clue,/ })).toBeNull();
    expect(clueAt(row, col)).toBeInTheDocument();
  });
});

describe('playing (§4)', () => {
  it('writes a digit into the selected square', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const index = openCells[0]!;
    const { row, col } = positionOf(index);
    expect(cellAt(row, col).getAttribute('aria-label')).toMatch(/^Empty/);
    await user.click(cellAt(row, col));
    await user.click(padKey(truth.solution[index]!));
    expect(cellAt(row, col).getAttribute('aria-label')).toMatch(
      new RegExp(`^${truth.solution[index]!},`),
    );
  });

  it('lights up both runs of the selected square, clue squares and all', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const index = firstRow.cells[1]!;
    const column = truth.table.runs[truth.table.colRun[index]!]!;
    await user.click(cellAt(positionOf(index).row, positionOf(index).col));

    // The other square of the horizontal run, and the two clue squares the
    // selection is working against.
    const partner = positionOf(firstRow.cells[0]!);
    expect(cellAt(partner.row, partner.col).className).toContain('kakuro-cell-run');
    const across = positionOf(firstRow.clue);
    const down = positionOf(column.clue);
    expect(clueAt(across.row, across.col).className).toContain('kakuro-clue-active');
    expect(clueAt(down.row, down.col).className).toContain('kakuro-clue-active');
  });

  it('offers nine keys and no count on any of them (§4)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    // Nine at every size, because the digits are 1–9 at every size (§3).
    expect(within(pad()).getAllByRole('button')).toHaveLength(9);
    // And no "n left": there is no constant to subtract from in this game, so
    // a counter here would be read as an invariant it is not (§4, §14).
    for (const key of within(pad()).getAllByRole('button')) {
      expect(key.getAttribute('aria-label')).toBeNull();
      expect(key.textContent).toMatch(/^[1-9]$/);
    }
  });

  it('never greys a digit out, however much of the board is written (§14)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    for (const index of openCells) {
      await user.click(cellAt(positionOf(index).row, positionOf(index).col));
      await user.click(padKey(truth.solution[index]!));
    }
    // Greying the digits a square cannot take would be running §7's first two
    // techniques for the player, which is the puzzle itself.
    for (const key of within(pad()).getAllByRole('button')) expect(key).toBeEnabled();
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
  it('marks a digit repeated inside one run, on both squares', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const [first, second] = [firstRow.cells[0]!, firstRow.cells[1]!];
    const repeated = truth.solution[first]!;
    for (const index of [first, second]) {
      await user.click(cellAt(positionOf(index).row, positionOf(index).col));
      await user.click(padKey(repeated));
    }
    for (const index of [first, second]) {
      const { row, col } = positionOf(index);
      expect(cellAt(row, col).getAttribute('aria-label')).toContain('Breaks a rule');
    }
  });

  it('tints the clue square with the run it belongs to', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const across = positionOf(firstRow.clue);
    expect(clueAt(across.row, across.col).className).not.toContain('kakuro-clue-broken');

    // One digit larger than the whole run's sum: every remaining square adds
    // at least one more, so the run is already dead and §5 says so now rather
    // than when the last square is filled.
    const target = firstRow.cells[0]!;
    await user.click(cellAt(positionOf(target).row, positionOf(target).col));
    await user.click(padKey(9));
    expect(firstRow.sum).toBeLessThan(9);
    expect(clueAt(across.row, across.col).className).toContain('kakuro-clue-broken');
  });

  it('says nothing about a legal digit that happens to be wrong, unless asked to', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const index = wrongButLegal();
    const { row, col } = positionOf(index.cell);
    await user.click(cellAt(row, col));
    await user.click(padKey(index.digit));
    expect(cellAt(row, col).getAttribute('aria-label')).not.toContain('Breaks a rule');
    expect(cellAt(row, col).className).toContain('kakuro-cell-mistake');
  });

  it('keeps quiet about it when the player has turned the setting off', async () => {
    const user = userEvent.setup();
    renderGame({
      ...tutorialDone,
      [KK_STORAGE_KEYS.prefs]: JSON.stringify({ schemaVersion: 1, highlightMistakes: false }),
    });
    await startLevelOne(user);

    const index = wrongButLegal();
    const { row, col } = positionOf(index.cell);
    await user.click(cellAt(row, col));
    await user.click(padKey(index.digit));
    expect(cellAt(row, col).className).not.toContain('kakuro-cell-mistake');
  });
});

describe('hints (§6)', () => {
  it('explains the next step without naming a direction', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    await user.click(screen.getByRole('button', { name: 'Hint' }));
    const message = screen.getByRole('status').textContent ?? '';
    expect(message.length).toBeGreaterThan(0);
    // The same deduction can come off the horizontal run, the vertical one, or
    // the crossing of the two, so no sentence here may claim one of them — and
    // no technique name ever reaches the screen either.
    expect(message).not.toMatch(/\brow\b|\bcolumn\b/i);
    expect(message).not.toMatch(/partition|naked|hidden single/i);
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
  it('says so once every run adds up with no digit twice', async () => {
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
      [KK_STORAGE_KEYS.progress]: JSON.stringify({
        schemaVersion: 1,
        highestUnlocked: 3,
        bestSeconds: {},
        dailySeconds: {},
      }),
    });

    await user.click(await screen.findByRole('button', { name: /Level 3/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: 'Levels' }));
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
    // Dimensions, never band names: a name would have to be translated (§10).
    for (const size of ['6×6', '8×8', '10×10']) {
      expect(screen.getByText(size)).toBeInTheDocument();
    }
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

/* Keyboard input is an adapter over the same tap handlers (issue #93): this
   checks board state the Undo button also produces, never a keyboard-only
   behaviour. */
describe('keyboard (issue #93)', () => {
  it('Ctrl+Z undoes the last digit, same as the Undo button', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const index = openCells[0]!;
    const { row, col } = positionOf(index);
    await user.click(cellAt(row, col));
    await user.click(padKey(truth.solution[index]!));
    expect(cellAt(row, col).getAttribute('aria-label')).toMatch(/^\d,/);

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(cellAt(row, col).getAttribute('aria-label')).toMatch(/^Empty/);
  });
});

/**
 * How many clue squares carry two sums on this board. A square with both
 * prints two numbers into one element, so the count of printed elements is
 * runs minus the squares that share one (§1).
 */
function sharedClueSquares(): number {
  const seen = new Set<number>();
  let shared = 0;
  for (const run of truth.table.runs) {
    if (seen.has(run.clue)) shared++;
    else seen.add(run.clue);
  }
  return shared;
}

/**
 * A square and a digit that breaks no rule and is still not the answer — the
 * exact case §5 draws its line at: the violation display says nothing, and
 * only the optional mistake mark speaks.
 */
function wrongButLegal(): { cell: number; digit: number } {
  for (const cell of truth.table.white) {
    if (!isWhite(truth.layout, cell)) continue;
    const across = truth.table.runs[truth.table.rowRun[cell]!]!;
    const down = truth.table.runs[truth.table.colRun[cell]!]!;
    for (let digit = 1; digit <= 9; digit++) {
      if (digit === truth.solution[cell]) continue;
      // On an empty board one digit can only break rule 2, and only by
      // exceeding the smaller of the two sums it sits under.
      if (digit < across.sum && digit < down.sum) return { cell, digit };
    }
  }
  throw new Error('level 1 has no legal-but-wrong first move');
}
