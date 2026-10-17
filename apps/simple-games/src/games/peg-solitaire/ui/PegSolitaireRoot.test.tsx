/**
 * Peg Solitaire through its screens, the way a player meets it
 * (docs/PEG_SOLITAIRE_RULES.md): Quick Rules and straight into a game, the
 * tap path (pick up → the landings are marked → jump), the keyboard and the
 * drag as other doors to the same taps, Undo to the very first position,
 * the ↻ and the result card's three endings, the statistics, the one saved
 * game and the ways it comes back — or, when it is damaged, does not.
 *
 * Saves go to Capacitor Preferences, mocked here as `deviceStore`; every
 * launch reads the same store, so what one launch writes is what the next one
 * finds, as on a phone.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import {
  ENGLISH,
  ENGLISH_PROBLEM,
  holeIndex,
  PROBLEMS,
  TRIANGLE,
  TRIANGLE_DIRECTIONS,
  type Problem,
} from '../game';
import {
  ENGLISH_SOLUTION,
  ENGLISH_STUCK,
  parseEnglishJumps,
  TRIANGLE_APEX_PERFECT_LAST,
  TRIANGLE_APEX_PREFIX,
  TRIANGLE_APEX_SINGLE_LAST,
  TRIANGLE_APEX_STUCK,
  type JumpList,
} from '../game/fixtures';
import { PG_STORAGE_KEYS, type PersistedGame, type Stats } from '../storage/schemas';
import { PegSolitaireRoot } from './PegSolitaireRoot';

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

afterEach(async () => {
  cleanup();
  // An unmount books the play clock into the slot (GameContext), and that
  // save is a promise: let it land before the store is wiped, or it would
  // land in the next test's store.
  await settle();
  deviceStore.clear();
  vi.restoreAllMocks();
});

/** Launches the game against the device store, the way a player's phone does. */
function launch(entry?: 'collection' | 'shortcut') {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <PegSolitaireRoot onExit={onExit} entry={entry} />
    </SettingsProvider>,
  );
  return { onExit };
}

/** The same store a launch reads, entered by the other door (issue #113). */
function launchFromShortcut() {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <PegSolitaireRoot onExit={onExit} entry="shortcut" />
    </SettingsProvider>,
  );
  return { onExit };
}

/**
 * Lets the local reads and the saves they trigger resolve. Saves are queued
 * per key behind each other (storage/repo.ts), a few promise hops each — and
 * they are promises, not timers, so this works under fake timers too.
 */
const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });

/** The app goes to background. Android may kill it without another event. */
function background() {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  Reflect.deleteProperty(document, 'visibilityState');
}

const put = (key: string, value: unknown) => deviceStore.set(key, JSON.stringify(value));
const read = <T,>(key: string): T | null => {
  const raw = deviceStore.get(key);
  return raw === undefined ? null : (JSON.parse(raw) as T);
};

function taughtAlready() {
  put(PG_STORAGE_KEYS.flags, { schemaVersion: 1, tutorialCompleted: true });
}

/** A game left suspended on `problem` after `jumps` — the record play writes. */
function suspend(problem: Problem, jumps: JumpList, elapsedSeconds = 0) {
  const record: PersistedGame = {
    schemaVersion: 1,
    board: problem.kind,
    start: problem.start,
    target: problem.target,
    jumps: jumps.map(([from, to]) => [from, to]),
    elapsedSeconds,
    savedAt: 1792200000000,
  };
  put(PG_STORAGE_KEYS.game, record);
}

const APEX: Problem = { kind: 'triangle', start: 0, target: 0 };
const SOLUTION = parseEnglishJumps(ENGLISH_SOLUTION);

const board = () => screen.getByRole('group', { name: /board, \d+ holes$/ });
const hole = (index: number) => board().querySelector<HTMLButtonElement>(`[data-hole="${index}"]`)!;
const pegsOnBoard = () => board().querySelectorAll('.pg-hole-peg').length;
const hasPeg = (index: number) => hole(index).classList.contains('pg-hole-peg');
const landingHoles = () =>
  Array.from(board().querySelectorAll<HTMLElement>('[data-hole]'))
    .filter((el) => el.querySelector('.pg-dot'))
    .map((el) => Number(el.dataset.hole))
    .sort((a, b) => a - b);
const status = () => screen.getByRole('status');
const undoButton = () =>
  within(document.querySelector<HTMLElement>('.action-bar')!).getByRole('button', {
    name: 'Undo',
  });
const resultCard = () => screen.queryByRole('alertdialog');
const tap = (index: number) => fireEvent.click(hole(index), { detail: 1 });
const savedGame = () => read<PersistedGame>(PG_STORAGE_KEYS.game);
const savedStats = () => read<Stats>(PG_STORAGE_KEYS.stats);
/** A press that begins, ends where it began, and clicks: the platform's tap. */
function pressAndTap(index: number) {
  fireEvent.pointerDown(hole(index), { pointerId: 9 });
  fireEvent.pointerUp(hole(index), { pointerId: 9 });
  fireEvent.click(hole(index), { detail: 1 });
}

const D2 = holeIndex(ENGLISH, 1, 3);
const D3 = holeIndex(ENGLISH, 2, 3);
const D4 = holeIndex(ENGLISH, 3, 3);

/** Opens the suspended game from the home's main button. */
async function resume() {
  launch();
  await settle();
  fireEvent.click(screen.getByRole('button', { name: /Resume/ }));
}

describe('first run (§12)', () => {
  it('teaches the game in three pictures and starts an English game right after', async () => {
    const user = userEvent.setup();
    launch();
    await settle();

    expect(screen.getByRole('heading', { level: 1, name: 'How to Play' })).toBeInTheDocument();
    expect(screen.getByText('Jump and remove')).toBeInTheDocument();
    expect(document.querySelector('.pg-figure')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Straight lines only')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Leave the last one')).toBeInTheDocument();
    // No guide page exists for this game, so there is nothing to learn more on.
    expect(screen.queryByRole('button', { name: 'Learn More' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));
    await settle();

    // The standard game: 33 holes, the middle one empty and ringed.
    expect(board()).toHaveAccessibleName('English board, 33 holes');
    expect(pegsOnBoard()).toBe(32);
    expect(hole(D4)).toHaveAccessibleName('Row 4, column 4: empty ringed hole');
    expect(status()).toHaveTextContent('Pegs left: 32');
    expect(undoButton()).toBeDisabled();
    // No clock, no move count, no hint (§5, §6).
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();

    // Remembered, counted, and saved as a game in progress.
    await settle();
    expect(read(PG_STORAGE_KEYS.flags)).toEqual({ schemaVersion: 1, tutorialCompleted: true });
    expect(savedStats()!.english.played).toBe(1);
    expect(savedGame()).toMatchObject({ board: 'english', start: 16, target: 16, jumps: [] });
  });
});

describe('the tap path (§4, §5)', () => {
  async function opening() {
    taughtAlready();
    launch();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: /English/ }));
  }

  it('picks a peg up, marks only where it can land, and jumps there — removing the jumped peg', async () => {
    await opening();
    tap(D2);
    expect(hole(D2)).toHaveAttribute('aria-pressed', 'true');
    expect(landingHoles()).toEqual([D4]);
    expect(hole(D4)).toHaveAccessibleName(
      'Row 4, column 4: empty ringed hole, a jump can land here',
    );

    tap(D4);
    expect(hasPeg(D2)).toBe(false);
    expect(hasPeg(D3)).toBe(false);
    expect(hasPeg(D4)).toBe(true);
    expect(hole(D4)).toHaveAccessibleName('Row 4, column 4: peg in the ringed hole');
    expect(pegsOnBoard()).toBe(31);
    expect(status()).toHaveTextContent('Pegs left: 31');
    expect(landingHoles()).toEqual([]);
    expect(undoButton()).toBeEnabled();
    await settle();
    expect(savedGame()!.jumps).toEqual([[D2, D4]]);
  });

  it('does nothing harmful for a hole that is not a landing, a diagonal included', async () => {
    await opening();
    // A peg with no jump: picked up, nothing marked, and a quiet line says so.
    const a3 = holeIndex(ENGLISH, 2, 0);
    tap(a3);
    expect(landingHoles()).toEqual([]);
    expect(status()).toHaveTextContent('This peg has no jump right now.');
    // The empty middle is not its landing: tapping it puts the peg down.
    tap(D4);
    expect(pegsOnBoard()).toBe(32);
    expect(hole(a3)).toHaveAttribute('aria-pressed', 'false');
    expect(status()).toHaveTextContent('Pegs left: 32');

    // After d2-d4, b5 → c4 → d3 is three in a diagonal row with d3 empty —
    // and still not a jump on the cross (§2).
    tap(D2);
    tap(D4);
    const b5 = holeIndex(ENGLISH, 4, 1);
    tap(b5);
    expect(landingHoles()).not.toContain(D3);
    tap(D3);
    expect(hasPeg(b5)).toBe(true);
    expect(hasPeg(D3)).toBe(false);
    expect(pegsOnBoard()).toBe(31);
    await settle();
    expect(savedGame()!.jumps).toHaveLength(1);
  });

  it('moves the pick to another peg, and puts it down on a second tap', async () => {
    await opening();
    const f4 = holeIndex(ENGLISH, 3, 5);
    tap(D2);
    tap(f4);
    expect(hole(D2)).toHaveAttribute('aria-pressed', 'false');
    expect(hole(f4)).toHaveAttribute('aria-pressed', 'true');
    expect(landingHoles()).toEqual([D4]);
    tap(f4);
    expect(hole(f4)).toHaveAttribute('aria-pressed', 'false');
    expect(landingHoles()).toEqual([]);
  });
});

describe('Undo and Restart (§6)', () => {
  it('takes every jump back, one at a time, to the very first position', async () => {
    taughtAlready();
    suspend(ENGLISH_PROBLEM, SOLUTION.slice(0, 6));
    await resume();
    expect(pegsOnBoard()).toBe(26);
    // The history came back with the save (§6, §11).
    for (let left = 27; left <= 32; left++) {
      fireEvent.click(undoButton());
      expect(pegsOnBoard()).toBe(left);
    }
    expect(undoButton()).toBeDisabled();
    expect(hole(D4)).toHaveAccessibleName('Row 4, column 4: empty ringed hole');
    await settle();
    expect(savedGame()!.jumps).toEqual([]);
  });

  it('restarts the same English board from ↻, asking first and offering no other board', async () => {
    taughtAlready();
    suspend(ENGLISH_PROBLEM, SOLUTION.slice(0, 3));
    await resume();
    await settle();
    const played = savedStats()?.english.played ?? 0;

    fireEvent.click(screen.getByRole('button', { name: 'Retry same board' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Start over?' });
    expect(within(dialog).queryByRole('button', { name: 'New board' })).not.toBeInTheDocument();
    // The board behind the question is out of reach.
    expect(board().closest('[inert]')).not.toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(pegsOnBoard()).toBe(29);

    fireEvent.click(screen.getByRole('button', { name: 'Retry same board' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Retry same board' }),
    );
    expect(pegsOnBoard()).toBe(32);
    expect(undoButton()).toBeDisabled();
    await settle();
    expect(savedStats()!.english.played).toBe(played + 1);
    expect(savedGame()).toMatchObject({ board: 'english', start: 16, target: 16, jumps: [] });
  });

  it('offers a new Triangle board from ↻ — never the one just played', async () => {
    taughtAlready();
    suspend(APEX, TRIANGLE_APEX_PREFIX.slice(0, 2));
    await resume();

    fireEvent.click(screen.getByRole('button', { name: 'Retry same board' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'New board' }),
    );
    await settle();
    const next = savedGame()!;
    expect(next.board).toBe('triangle');
    expect([next.start, next.target]).not.toEqual([0, 0]);
    expect(PROBLEMS.triangle).toContainEqual({
      kind: 'triangle',
      start: next.start,
      target: next.target,
    });
    expect(pegsOnBoard()).toBe(14);
    await settle();
    expect(savedStats()!.triangle.played).toBe(1);
  });
});

describe('the keyboard (§4)', () => {
  it('moves the focus with the arrows, picks up and jumps with Enter, and undoes with Ctrl+Z', async () => {
    taughtAlready();
    launch();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: /English/ }));
    // The home's button went with the home: the focus is put on the board,
    // on the ringed hole, rather than left on nothing.
    expect(document.activeElement).toBe(hole(D4));

    // From outside the board, the first arrow brings the focus onto it — on
    // the ringed hole.
    hole(D4).blur();
    expect(document.activeElement).toBe(document.body);
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(hole(D4));

    // Two holes up to d2, Enter picks it up; back down to d4, Enter jumps.
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(hole(D2));
    fireEvent.click(document.activeElement!, { detail: 0 });
    expect(hole(D2)).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    fireEvent.click(document.activeElement!, { detail: 0 });
    expect(hasPeg(D4)).toBe(true);
    expect(pegsOnBoard()).toBe(31);

    // Escape puts a picked-up peg down.
    const f4 = holeIndex(ENGLISH, 3, 5);
    tap(f4);
    expect(hole(f4)).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(hole(f4)).toHaveAttribute('aria-pressed', 'false');
    expect(board().querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);

    // A held Ctrl+Z undoes nothing; a press undoes one jump.
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, repeat: true });
    expect(pegsOnBoard()).toBe(31);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(pegsOnBoard()).toBe(32);
  });

  it('keeps the player’s place when the button they pressed goes away', async () => {
    taughtAlready();
    suspend(APEX, TRIANGLE_APEX_STUCK.slice(0, -1));
    await resume();
    // Opened from the home: on the board's tab stop, the ringed hole.
    expect(document.activeElement).toBe(hole(0));
    // Moved elsewhere on the board, the place is the player's.
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    const moved = document.activeElement;
    expect(moved).not.toBe(hole(0));
    expect(board().contains(moved)).toBe(true);

    const [from, to] = TRIANGLE_APEX_STUCK[TRIANGLE_APEX_STUCK.length - 1]!;
    tap(from);
    tap(to);
    const card = screen.getByRole('alertdialog', { name: 'No jumps left' });
    // Undo from the card: the card goes, and the focus is back on the board
    // where the keyboard left it — not dropped on the page.
    fireEvent.click(within(card).getByRole('button', { name: 'Undo' }));
    expect(resultCard()).toBeNull();
    expect(document.activeElement).toBe(moved);

    // A focus that is still somewhere is never taken: the action bar's Undo
    // keeps it.
    undoButton().focus();
    fireEvent.click(undoButton());
    expect(document.activeElement).toBe(undoButton());

    // A new game from the ↻ dialog starts the keyboard's place again at the
    // new board's ringed hole (§4).
    fireEvent.click(screen.getByRole('button', { name: 'Retry same board' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'New board' }),
    );
    await settle();
    const next = savedGame()!;
    expect(document.activeElement).toBe(hole(next.target));
    expect(hole(next.target)).toHaveAttribute('tabindex', '0');
  });

  it('carries no held Enter into the card: its repeats press nothing there (§4)', async () => {
    taughtAlready();
    suspend(APEX, TRIANGLE_APEX_STUCK.slice(0, -1));
    await resume();
    const [from, to] = TRIANGLE_APEX_STUCK[TRIANGLE_APEX_STUCK.length - 1]!;
    tap(from);
    tap(to);
    const card = screen.getByRole('alertdialog', { name: 'No jumps left' });
    const undo = within(card).getByRole('button', { name: 'Undo' });
    // The first offer has the focus, so the repeats of an Enter held from the
    // last jump land on it — and would undo that jump. `fireEvent` answers
    // false when the default (the button's click) was stopped.
    expect(undo).toHaveFocus();
    expect(fireEvent.keyDown(undo, { key: 'Enter', repeat: true })).toBe(false);
    expect(fireEvent.keyDown(undo, { key: ' ', repeat: true })).toBe(false);
    const retry = within(card).getByRole('button', { name: 'Retry same board' });
    expect(fireEvent.keyDown(retry, { key: 'Enter', repeat: true })).toBe(false);
    // A new press is a press.
    expect(fireEvent.keyDown(undo, { key: 'Enter' })).toBe(true);
    expect(screen.getByRole('alertdialog', { name: 'No jumps left' })).toBe(card);
  });

  it('answers nothing while the ↻ dialog is up', async () => {
    taughtAlready();
    suspend(ENGLISH_PROBLEM, SOLUTION.slice(0, 2));
    await resume();
    fireEvent.click(screen.getByRole('button', { name: 'Retry same board' }));
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(pegsOnBoard()).toBe(30);
    expect(board().contains(document.activeElement)).toBe(false);
  });
});

describe('the Triangle (§2)', () => {
  /**
   * Its six directions, each through the screen: for every direction, an
   * opening (from a problem this game deals) where a jump that way is legal.
   * The landing is marked, the tap jumps, the jumped peg goes.
   */
  const OPENINGS = TRIANGLE_DIRECTIONS.map(([dRow, dCol]) => {
    for (const problem of PROBLEMS.triangle) {
      const to = TRIANGLE.holes[problem.start]!;
      const from = holeIndex(TRIANGLE, to.row - 2 * dRow, to.col - 2 * dCol);
      const over = holeIndex(TRIANGLE, to.row - dRow, to.col - dCol);
      if (from >= 0 && over >= 0) return { problem, from, over, to: problem.start };
    }
    throw new Error(`no opening jumps along (${dRow}, ${dCol})`);
  });

  it.each(OPENINGS.map((opening, i) => [TRIANGLE_DIRECTIONS[i]!.join(', '), opening] as const))(
    'jumps along direction (%s) from the screen',
    async (_, { problem, from, over, to }) => {
      taughtAlready();
      suspend(problem, []);
      await resume();
      tap(from);
      expect(landingHoles()).toContain(to);
      tap(to);
      expect(hasPeg(from)).toBe(false);
      expect(hasPeg(over)).toBe(false);
      expect(hasPeg(to)).toBe(true);
      expect(pegsOnBoard()).toBe(13);
    },
  );

  it('marks no landing off its three lines: not 6 → 8 → 11, not straight down', async () => {
    taughtAlready();
    // Hole 11 (index 10) empty: the peg in hole 6 (index 5) is two holes
    // away along a line the triangle does not have.
    suspend({ kind: 'triangle', start: 10, target: 10 }, []);
    await resume();
    tap(5);
    expect(landingHoles()).not.toContain(10);
    tap(10);
    expect(hasPeg(5)).toBe(true);
    cleanup();

    // Hole 5 (index 4) empty: straight down the screen from the apex.
    suspend({ kind: 'triangle', start: 4, target: 12 }, []);
    await resume();
    tap(0);
    expect(landingHoles()).not.toContain(4);
    tap(4);
    expect(hasPeg(0)).toBe(true);
    expect(pegsOnBoard()).toBe(14);
  });
});

describe('dragging a peg (§4)', () => {
  const PITCH = 50;
  function giveBoardALayout() {
    vi.spyOn(board(), 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 7 * PITCH,
      height: 7 * PITCH,
      right: 7 * PITCH,
      bottom: 7 * PITCH,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
  }
  const point = (row: number, col: number) => ({
    clientX: (col + 0.5) * PITCH,
    clientY: (row + 0.5) * PITCH,
  });

  it('jumps when a peg is carried to its landing, and the release’s click plays nothing more', async () => {
    taughtAlready();
    suspend(ENGLISH_PROBLEM, []);
    await resume();
    giveBoardALayout();
    const peg = hole(D2);

    fireEvent.pointerDown(peg, { pointerId: 1, ...point(1, 3) });
    fireEvent.pointerMove(peg, { pointerId: 1, ...point(2, 3) });
    // Picked up while carried: its landing is marked.
    expect(landingHoles()).toEqual([D4]);
    fireEvent.pointerMove(peg, { pointerId: 1, ...point(3, 3) });
    fireEvent.pointerUp(peg, { pointerId: 1, ...point(3, 3) });
    expect(hasPeg(D4)).toBe(true);
    expect(pegsOnBoard()).toBe(31);

    fireEvent.click(peg, { detail: 1 });
    expect(pegsOnBoard()).toBe(31);
    expect(board().querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
  });

  it('puts the peg back, still picked up, when it is let go off its landings', async () => {
    taughtAlready();
    suspend(ENGLISH_PROBLEM, []);
    await resume();
    giveBoardALayout();
    const peg = hole(D2);
    fireEvent.pointerDown(peg, { pointerId: 1, ...point(1, 3) });
    fireEvent.pointerMove(peg, { pointerId: 1, ...point(1, 4) });
    fireEvent.pointerUp(peg, { pointerId: 1, ...point(1, 4) });
    // The click the release leaves lands on the captured peg, and is spent.
    fireEvent.click(peg, { detail: 1 });
    expect(pegsOnBoard()).toBe(32);
    expect(peg).toHaveAttribute('aria-pressed', 'true');
    // The next tap still works: on the landing, it jumps.
    pressAndTap(D4);
    expect(pegsOnBoard()).toBe(31);
  });

  it('treats pointercancel as a cancel — nothing jumps — and swallows the click it leaves', async () => {
    taughtAlready();
    suspend(ENGLISH_PROBLEM, []);
    await resume();
    giveBoardALayout();
    const peg = hole(D2);
    fireEvent.pointerDown(peg, { pointerId: 1, ...point(1, 3) });
    fireEvent.pointerMove(peg, { pointerId: 1, ...point(3, 3) });
    fireEvent.pointerCancel(peg, { pointerId: 1, ...point(3, 3) });
    expect(pegsOnBoard()).toBe(32);
    expect(document.querySelector('.pg-float')).toBeNull();
    fireEvent.click(peg, { detail: 1 });
    // The trailing click did not pick it up a second time or put it down.
    expect(peg).toHaveAttribute('aria-pressed', 'true');
    pressAndTap(D4);
    expect(pegsOnBoard()).toBe(31);
  });
});

describe('the endings (§3, §5, §10)', () => {
  it('a perfect clear: one peg in the ring, counted once, a new board first and Undo offered', async () => {
    taughtAlready();
    suspend(APEX, TRIANGLE_APEX_PREFIX, 30);
    await resume();
    const [from, to] = TRIANGLE_APEX_PERFECT_LAST;
    tap(from);
    tap(to);

    const card = screen.getByRole('alertdialog', { name: 'Perfect clear!' });
    expect(within(card).getByText('The last peg stands in the ringed hole.')).toBeInTheDocument();
    expect(within(card).getByText('Pegs left').nextElementSibling).toHaveTextContent('1');
    expect(
      within(card)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['New board', 'Retry same board', 'Undo', 'Home', 'Share']);
    // The next game is the first offer, and has the focus; Undo is there too.
    const newBoard = within(card).getByRole('button', { name: 'New board' });
    expect(newBoard).toHaveClass('btn-primary');
    expect(document.activeElement).toBe(newBoard);
    expect(within(card).getByRole('button', { name: 'Undo' })).toHaveClass('btn-secondary');
    // Behind the card the board and its Undo are out of reach.
    expect(board().closest('[inert]')).not.toBeNull();
    expect(undoButton().closest('[inert]')).not.toBeNull();

    await settle();
    expect(savedGame()).toBeNull();
    expect(savedStats()!.triangle).toEqual({ played: 0, best: 1, perfect: 1 });
    expect(savedStats()!.totalPlaySeconds).toBe(0);
  });

  it('an English perfect clear: no new board, Retry first — with the focus — then Undo', async () => {
    taughtAlready();
    suspend(ENGLISH_PROBLEM, SOLUTION.slice(0, -1));
    await resume();
    // The keyboard was somewhere else on the board before the last jump.
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(hole(D3));
    const [from, to] = SOLUTION[SOLUTION.length - 1]!;
    tap(from);
    tap(to);

    const card = screen.getByRole('alertdialog', { name: 'Perfect clear!' });
    expect(
      within(card)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Retry same board', 'Undo', 'Home', 'Share']);
    const retry = within(card).getByRole('button', { name: 'Retry same board' });
    expect(retry).toHaveClass('btn-primary');
    expect(document.activeElement).toBe(retry);
    await settle();
    expect(savedGame()).toBeNull();
    expect(savedStats()!.english).toEqual({ played: 0, best: 1, perfect: 1 });

    // The same board again, from its opening, with the keyboard's place back
    // on the ringed hole rather than where it was in the game just played.
    fireEvent.click(retry);
    expect(pegsOnBoard()).toBe(32);
    expect(document.activeElement).toBe(hole(D4));
    expect(hole(D3)).toHaveAttribute('tabindex', '-1');
  });

  it('a perfect clear undone from its card is in play — and saved — again, and counts once (§6, §10)', async () => {
    taughtAlready();
    suspend(APEX, TRIANGLE_APEX_PREFIX);
    await resume();
    const clearAgain = () => {
      tap(TRIANGLE_APEX_PERFECT_LAST[0]);
      tap(TRIANGLE_APEX_PERFECT_LAST[1]);
      return screen.getByRole('alertdialog', { name: 'Perfect clear!' });
    };
    let card = clearAgain();
    await settle();
    expect(savedGame()).toBeNull();
    expect(savedStats()!.triangle).toEqual({ played: 0, best: 1, perfect: 1 });
    // The keyboard is off while the card is up, as on every card: its Undo is
    // the card's button.
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(resultCard()).not.toBeNull();

    // Undo puts the position before the last jump back in play, and back in
    // the slot as a normal game in progress — one that carries its clear.
    fireEvent.click(within(card).getByRole('button', { name: 'Undo' }));
    expect(resultCard()).toBeNull();
    expect(status()).toHaveTextContent('Pegs left: 2');
    expect(hasPeg(TRIANGLE_APEX_PERFECT_LAST[0])).toBe(true);
    expect(hasPeg(TRIANGLE_APEX_PERFECT_LAST[1])).toBe(false);
    expect(board().closest('[inert]')).toBeNull();
    expect(board().contains(document.activeElement)).toBe(true);
    expect(undoButton()).toBeEnabled();
    await settle();
    expect(savedGame()).toEqual({
      schemaVersion: 1,
      board: 'triangle',
      start: 0,
      target: 0,
      jumps: TRIANGLE_APEX_PREFIX.map(([f, t]) => [f, t]),
      elapsedSeconds: expect.any(Number) as number,
      cleared: true,
      savedAt: expect.any(Number) as number,
    });
    // In play, Ctrl+Z goes on taking jumps back; the jump is played again.
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(status()).toHaveTextContent('Pegs left: 3');
    const [lastFrom, lastTo] = TRIANGLE_APEX_PREFIX[TRIANGLE_APEX_PREFIX.length - 1]!;
    tap(lastFrom);
    tap(lastTo);
    expect(status()).toHaveTextContent('Pegs left: 2');

    // The same clear again: the card says so, but the game's clear is counted.
    card = clearAgain();
    expect(within(card).getByText('Fewest on this board').nextElementSibling).toHaveTextContent(
      '1',
    );
    expect(within(card).queryByText('Fewer than ever on this board.')).not.toBeInTheDocument();
    await settle();
    expect(savedGame()).toBeNull();
    expect(savedStats()!.triangle).toEqual({ played: 0, best: 1, perfect: 1 });

    // Undone and finished off the ring: the one-peg record holds, the clear
    // stays counted once.
    fireEvent.click(within(card).getByRole('button', { name: 'Undo' }));
    tap(TRIANGLE_APEX_SINGLE_LAST[0]);
    tap(TRIANGLE_APEX_SINGLE_LAST[1]);
    card = screen.getByRole('alertdialog', { name: 'One peg left' });
    await settle();
    expect(savedStats()!.triangle).toEqual({ played: 0, best: 1, perfect: 1 });

    // Undone once more and the app closed: the resumed game still remembers
    // its clear, so clearing it after the relaunch counts nothing new.
    fireEvent.click(within(card).getByRole('button', { name: 'Undo' }));
    await settle();
    cleanup();
    await settle();
    expect(savedGame()!.cleared).toBe(true);
    await resume();
    expect(status()).toHaveTextContent('Pegs left: 2');
    card = clearAgain();
    await settle();
    expect(savedStats()!.triangle).toEqual({ played: 0, best: 1, perfect: 1 });

    // A new game is a new chance at a clear of its own.
    fireEvent.click(within(card).getByRole('button', { name: 'Retry same board' }));
    await settle();
    expect(savedGame()).not.toHaveProperty('cleared');
    expect(savedStats()!.triangle).toEqual({ played: 1, best: 1, perfect: 1 });
  });

  it('one peg left off the ring is told apart from a perfect clear, and can be undone', async () => {
    taughtAlready();
    suspend(APEX, TRIANGLE_APEX_PREFIX);
    await resume();
    const [from, to] = TRIANGLE_APEX_SINGLE_LAST;
    tap(from);
    tap(to);

    const card = screen.getByRole('alertdialog', { name: 'One peg left' });
    expect(within(card).getByText('The last peg is outside the ringed hole.')).toBeInTheDocument();
    await settle();
    expect(savedGame()).toBeNull();
    expect(savedStats()!.triangle).toEqual({ played: 0, best: 1, perfect: 0 });

    // Undo puts the game back in play — and back in the slot (§6, §11).
    fireEvent.click(within(card).getByRole('button', { name: 'Undo' }));
    expect(resultCard()).toBeNull();
    expect(status()).toHaveTextContent('Pegs left: 2');
    await settle();
    expect(savedGame()!.jumps).toHaveLength(TRIANGLE_APEX_PREFIX.length);

    // And this time the perfect clear.
    tap(TRIANGLE_APEX_PERFECT_LAST[0]);
    tap(TRIANGLE_APEX_PERFECT_LAST[1]);
    expect(screen.getByRole('alertdialog', { name: 'Perfect clear!' })).toBeInTheDocument();
    await settle();
    expect(savedStats()!.triangle).toEqual({ played: 0, best: 1, perfect: 1 });
  });

  it('n pegs and no jump: the count is the headline, and the fewest-left record is kept', async () => {
    taughtAlready();
    put(PG_STORAGE_KEYS.stats, {
      schemaVersion: 1,
      english: { played: 3, best: 9, perfect: 0 },
      triangle: { played: 0, best: null, perfect: 0 },
      totalPlaySeconds: 0,
    });
    const jumps = parseEnglishJumps(ENGLISH_STUCK);
    suspend(ENGLISH_PROBLEM, jumps.slice(0, -1));
    await resume();
    const [from, to] = jumps[jumps.length - 1]!;
    tap(from);
    tap(to);

    const card = screen.getByRole('alertdialog', { name: 'No jumps left' });
    expect(within(card).getByText('Pegs left').nextElementSibling).toHaveTextContent('7');
    expect(within(card).getByText('Fewest on this board').nextElementSibling).toHaveTextContent(
      '7',
    );
    expect(within(card).getByText('Fewer than ever on this board.')).toBeInTheDocument();
    // English deals one problem: no new board on its card.
    expect(within(card).queryByRole('button', { name: 'New board' })).not.toBeInTheDocument();
    await settle();
    expect(savedStats()!.english).toEqual({ played: 3, best: 7, perfect: 0 });

    // Retry from the card is a new game on the same board.
    fireEvent.click(within(card).getByRole('button', { name: 'Retry same board' }));
    expect(resultCard()).toBeNull();
    expect(pegsOnBoard()).toBe(32);
    await settle();
    expect(savedStats()!.english.played).toBe(4);
  });

  it('a stuck Triangle finish leaves Undo, retry, a new board and home on its card', async () => {
    taughtAlready();
    suspend(APEX, TRIANGLE_APEX_STUCK.slice(0, -1));
    await resume();
    const [from, to] = TRIANGLE_APEX_STUCK[TRIANGLE_APEX_STUCK.length - 1]!;
    tap(from);
    tap(to);
    const card = screen.getByRole('alertdialog', { name: 'No jumps left' });
    expect(
      within(card)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Undo', 'Retry same board', 'New board', 'Home', 'Share']);
    // Undo is the first offer, and has the focus.
    expect(document.activeElement).toBe(within(card).getByRole('button', { name: 'Undo' }));

    fireEvent.click(within(card).getByRole('button', { name: 'Home' }));
    // A finished game is nothing to resume (§11).
    expect(screen.queryByRole('button', { name: /Resume/ })).not.toBeInTheDocument();
  });
});

describe('the home (§7)', () => {
  it('starts a game in one tap, on the board chosen, and remembers the choice', async () => {
    taughtAlready();
    const { onExit } = launch();
    await settle();
    // English is the first offer on a fresh install.
    expect(screen.getByRole('button', { name: /English/ })).toHaveClass('btn-primary');
    expect(screen.getByRole('button', { name: /Triangle/ })).toHaveClass('btn-secondary');
    expect(screen.getByText(/Early release/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Triangle/ }));
    expect(board()).toHaveAccessibleName('Triangle board, 15 holes');
    await settle();
    expect(read(PG_STORAGE_KEYS.prefs)).toEqual({ schemaVersion: 1, board: 'triangle' });
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByRole('button', { name: /Triangle.*Resume/ })).toHaveClass('btn-primary');

    fireEvent.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('asks before the other board replaces the game in progress, naming both', async () => {
    taughtAlready();
    suspend(ENGLISH_PROBLEM, SOLUTION.slice(0, 2));
    launch();
    await settle();

    fireEvent.click(screen.getByRole('button', { name: /Triangle/ }));
    const dialog = screen.getByRole('alertdialog', { name: 'Replace the game in progress?' });
    expect(
      within(dialog).getByText('Your English game will be replaced by a new Triangle game.'),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await settle();
    expect(savedGame()!.board).toBe('english');

    // The same board resumes without a question.
    fireEvent.click(screen.getByRole('button', { name: /English.*Resume/ }));
    expect(pegsOnBoard()).toBe(30);
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));

    fireEvent.click(screen.getByRole('button', { name: /Triangle/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(board()).toHaveAccessibleName('Triangle board, 15 holes');
    await settle();
    expect(savedGame()!.board).toBe('triangle');
  });

  it('shows each board’s fewest-left record once there is one', async () => {
    taughtAlready();
    put(PG_STORAGE_KEYS.stats, {
      schemaVersion: 1,
      english: { played: 2, best: 4, perfect: 0 },
      triangle: { played: 0, best: null, perfect: 0 },
      totalPlaySeconds: 0,
    });
    launch();
    await settle();
    expect(screen.getByRole('button', { name: /English.*Fewest left: 4/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Triangle.*15 holes/ })).toBeInTheDocument();
  });

  it('reads a damaged choice of board as English', async () => {
    taughtAlready();
    put(PG_STORAGE_KEYS.prefs, { schemaVersion: 1, board: 'toString' });
    launch();
    await settle();
    expect(screen.getByRole('button', { name: /English/ })).toHaveClass('btn-primary');
  });
});

describe('statistics (§10)', () => {
  it('per board: games played, fewest pegs left, perfect clears — and total play time, no streak', async () => {
    taughtAlready();
    put(PG_STORAGE_KEYS.stats, {
      schemaVersion: 1,
      english: { played: 5, best: 3, perfect: 0 },
      triangle: { played: 9, best: 1, perfect: 2 },
      totalPlaySeconds: 3725,
    });
    launch();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Statistics' }));

    const english = screen.getByRole('heading', { name: 'English' }).closest('section')!;
    const triangle = screen.getByRole('heading', { name: 'Triangle' }).closest('section')!;
    const value = (section: HTMLElement, label: string) =>
      within(section).getByText(label).nextElementSibling!.textContent;
    expect(value(english, 'Games played')).toBe('5');
    expect(value(english, 'Fewest pegs left')).toBe('3');
    expect(value(english, 'Perfect clears')).toBe('0');
    expect(value(triangle, 'Fewest pegs left')).toBe('1');
    expect(value(triangle, 'Perfect clears')).toBe('2');
    expect(screen.getByText('Total play time').nextElementSibling).toHaveTextContent('1:02:05');
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });

  it('shows a dash, not a zero, for a record not set yet', async () => {
    taughtAlready();
    launch();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Statistics' }));
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('keeps a finish booked after pg.stats alone fell back while the game was suspended (§11)', async () => {
    taughtAlready();
    suspend(APEX, TRIANGLE_APEX_PREFIX);
    // The statistics record is unreadable; the save is fine.
    deviceStore.set(PG_STORAGE_KEYS.stats, '{"schemaVersion":1,"engl');
    await resume();
    tap(TRIANGLE_APEX_PERFECT_LAST[0]);
    tap(TRIANGLE_APEX_PERFECT_LAST[1]);
    await settle();
    expect(savedStats()!.triangle).toEqual({ played: 0, best: 1, perfect: 1 });

    // The next launch reads it back — `played` behind the other fields is legal.
    cleanup();
    launch();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Statistics' }));
    const triangle = screen.getByRole('heading', { name: 'Triangle' }).closest('section')!;
    expect(within(triangle).getByText('Perfect clears').nextElementSibling).toHaveTextContent('1');
  });
});

describe('the saved game (§11)', () => {
  it('comes back where it was left, with the save untouched until the next jump', async () => {
    taughtAlready();
    suspend(ENGLISH_PROBLEM, SOLUTION.slice(0, 4), 33);
    const before = deviceStore.get(PG_STORAGE_KEYS.game);
    launch();
    await settle();
    // Nothing starts by itself on launch: the home, with Resume on.
    expect(screen.getByRole('button', { name: /English.*Resume/ })).toBeInTheDocument();
    expect(deviceStore.get(PG_STORAGE_KEYS.game)).toBe(before);

    fireEvent.click(screen.getByRole('button', { name: /English.*Resume/ }));
    expect(pegsOnBoard()).toBe(28);
    await settle();
    expect(savedStats()).toBeNull();
  });

  it.each([
    ['an illegal jump', { jumps: [[D4, D2]] }],
    ['a problem never dealt', { start: 0, jumps: [] }],
    ['a finished game', { jumps: SOLUTION }],
    ['truncated JSON', 'truncated'],
  ] as const)('lands on the home with nothing restored for %s', async (_, damage) => {
    taughtAlready();
    if (damage === 'truncated') {
      deviceStore.set(PG_STORAGE_KEYS.game, '{"schemaVersion":1,"board":"english","sta');
    } else {
      suspend(ENGLISH_PROBLEM, []);
      put(PG_STORAGE_KEYS.game, { ...savedGame(), ...damage });
    }
    launch();
    await settle();
    expect(screen.getByRole('heading', { level: 1, name: 'Peg Solitaire' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Resume/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    // No game was started on the quiet.
    await settle();
    expect(savedStats()).toBeNull();
  });

  it('reads its records through the load-side seam as well', async () => {
    taughtAlready();
    const kv = createMemoryKV({
      [PG_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
      [PG_STORAGE_KEYS.prefs]: JSON.stringify({ schemaVersion: 1, board: 'triangle' }),
    });
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <PegSolitaireRoot onExit={vi.fn()} kv={kv} />
      </SettingsProvider>,
    );
    await settle();
    expect(screen.getByRole('button', { name: /Triangle/ })).toHaveClass('btn-primary');
  });

  it('saves when the app goes to the background, play time included, and resumes nothing by itself', async () => {
    taughtAlready();
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /English/ }));
      tap(D2);
      tap(D4);
      act(() => vi.advanceTimersByTime(7_000));
      background();
      await settle();
      expect(savedGame()).toMatchObject({ jumps: [[D2, D4]], elapsedSeconds: 7 });
      expect(savedStats()!.totalPlaySeconds).toBe(7);

      // Hidden time is not play time, and coming back moves nothing.
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      act(() => vi.advanceTimersByTime(60_000));
      Reflect.deleteProperty(document, 'visibilityState');
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(pegsOnBoard()).toBe(31);
      background();
      await settle();
      expect(savedGame()!.elapsedSeconds).toBe(7);
    } finally {
      vi.useRealTimers();
    }
  });

  it('books the clock when the game is unmounted mid-play — the web’s Back — and only once', async () => {
    taughtAlready();
    suspend(ENGLISH_PROBLEM, SOLUTION.slice(0, 2), 4);
    put(PG_STORAGE_KEYS.stats, {
      schemaVersion: 1,
      english: { played: 1, best: null, perfect: 0 },
      triangle: { played: 0, best: null, perfect: 0 },
      totalPlaySeconds: 4,
    });
    vi.useFakeTimers();
    try {
      await resume();
      act(() => vi.advanceTimersByTime(6_000));
      // The shell unmounts the game without a word to it.
      cleanup();
      await settle();
      expect(savedGame()).toMatchObject({ jumps: SOLUTION.slice(0, 2), elapsedSeconds: 10 });
      expect(savedStats()!.totalPlaySeconds).toBe(10);

      // A way out that synced already leaves the unmount nothing to book.
      await resume();
      act(() => vi.advanceTimersByTime(3_000));
      fireEvent.click(screen.getByRole('button', { name: 'Home' }));
      await settle();
      expect(savedStats()!.totalPlaySeconds).toBe(13);
      cleanup();
      await settle();
      expect(savedGame()!.elapsedSeconds).toBe(13);
      expect(savedStats()!.totalPlaySeconds).toBe(13);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a suspended game's clock when backgrounded from the game's home (#109)", async () => {
    taughtAlready();
    suspend(ENGLISH_PROBLEM, SOLUTION.slice(0, 2), 9);
    launch();
    await settle();
    background();
    await settle();
    expect(savedGame()!.elapsedSeconds).toBe(9);
    // Already booked when it was saved: not booked again.
    await settle();
    expect(savedStats()).toBeNull();
  });
});

/**
 * A pinned home-screen shortcut (issue #113). There is one slot, and
 * `loadSavedGame` hands back null for anything not still in play: either
 * there is one game to resume or there is none.
 */
describe('a home-screen shortcut', () => {
  it('opens the one suspended game straight onto its board', async () => {
    taughtAlready();
    suspend(APEX, TRIANGLE_APEX_PREFIX.slice(0, 3));
    launchFromShortcut();
    await settle();
    expect(board()).toHaveAccessibleName('Triangle board, 15 holes');
    expect(pegsOnBoard()).toBe(11);
    expect(screen.queryByRole('button', { name: 'All games' })).not.toBeInTheDocument();

    // One step back is this game's home, with the game still waiting.
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByRole('button', { name: /Triangle.*Resume/ })).toBeInTheDocument();
  });

  it('opens the home when nothing is suspended — it starts nothing', async () => {
    taughtAlready();
    launchFromShortcut();
    await settle();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All games' })).toBeInTheDocument();
    await settle();
    expect(savedStats()).toBeNull();
  });

  it('is the only door that resumes: a launch from the collection opens the home', async () => {
    taughtAlready();
    suspend(APEX, TRIANGLE_APEX_PREFIX.slice(0, 3));
    launch('collection');
    await settle();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resume/ })).toBeInTheDocument();
  });

  it('teaches the game first, then resumes the waiting game rather than starting a new one', async () => {
    suspend(APEX, TRIANGLE_APEX_PREFIX.slice(0, 3));
    launchFromShortcut();
    await settle();
    expect(screen.getByText('Jump and remove')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Playing' }));
    expect(board()).toHaveAccessibleName('Triangle board, 15 holes');
    expect(pegsOnBoard()).toBe(11);
    await settle();
    expect(savedStats()).toBeNull();
  });

  it('does not book the resumed game’s play seconds a second time', async () => {
    taughtAlready();
    put(PG_STORAGE_KEYS.stats, {
      schemaVersion: 1,
      english: { played: 1, best: null, perfect: 0 },
      triangle: { played: 0, best: null, perfect: 0 },
      totalPlaySeconds: 5,
    });
    suspend(ENGLISH_PROBLEM, SOLUTION.slice(0, 1), 5);
    vi.useFakeTimers();
    try {
      launchFromShortcut();
      await settle();
      expect(pegsOnBoard()).toBe(31);
      act(() => vi.advanceTimersByTime(3_000));
      background();
      await settle();
      expect(savedGame()!.elapsedSeconds).toBe(8);
      expect(savedStats()!.totalPlaySeconds).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });
});
