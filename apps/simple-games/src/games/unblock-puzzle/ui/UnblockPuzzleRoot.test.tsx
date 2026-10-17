/**
 * The whole game as a player meets it (docs/UNBLOCK_PUZZLE_RULES.md §5–§13):
 * first run through Quick Rules into a board, the tap-only path, the arrow
 * buttons, the keyboard, Undo / Hint / the ↻ question, a clear and its card,
 * a board kept across leaving and across a relaunch, the two slots, a saved
 * game the loader refuses, backgrounding, and the home-screen shortcut.
 *
 * Saves go to Capacitor Preferences whatever `kv` says (the prop is a
 * load-side seam), so the device store is stood behind here, and read back to
 * learn which board a Free Play seed dealt — the token in a seed is the clock
 * and a random number, on purpose (§9).
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import {
  BOARD_SIZE,
  createDailySession,
  createFreeSession,
  decodeBoard,
  encodeBoard,
  localDateString,
  replayMoves,
  slide,
  slideRange,
  solve,
  type Board,
  type Slide,
} from '../game';
import { toPersisted } from '../storage/gamePersistence';
import { UB_STORAGE_KEYS, statsSchema, type PersistedGame, type Stats } from '../storage/schemas';
import { UnblockPuzzleRoot } from './UnblockPuzzleRoot';

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

const TUTORIAL_DONE = JSON.stringify({ schemaVersion: 1, tutorialCompleted: true });

/** Launches the game against the device store, the way a player's phone does. */
function launch() {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <UnblockPuzzleRoot onExit={onExit} />
    </SettingsProvider>,
  );
  return onExit;
}

/** The same store, entered by the other door (issue #113). */
function launchFromShortcut() {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <UnblockPuzzleRoot onExit={onExit} entry="shortcut" />
    </SettingsProvider>,
  );
  return onExit;
}

/** Lets the local reads and the saves they trigger resolve. */
const settle = () => act(async () => undefined);

const today = () => localDateString(new Date());

const boardGroup = () => screen.getByRole('group', { name: /^Board, 6 by 6/ });
const queryBoard = () => screen.queryByRole('group', { name: /^Board, 6 by 6/ });
const blockButton = (index: number) =>
  document.querySelector(`[data-block="${index}"]`) as HTMLButtonElement;
const cellAt = (index: number) => document.querySelector(`[data-cell="${index}"]`) as HTMLElement;
const blockLabels = () =>
  within(boardGroup())
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label'));

/** What a slot holds, as stored. */
function stored(key: string): PersistedGame | null {
  const raw = deviceStore.get(key);
  return raw === undefined ? null : (JSON.parse(raw) as PersistedGame);
}

/** The board on screen, read the way a resume reads it: the dealt board and its moves. */
function boardOf(key: string): Board {
  const record = stored(key)!;
  return replayMoves(record.moves, decodeBoard(record.board)!, 9999)!.board;
}

/** The cell a tap lands on to slide `move.block` to `move.to` (§5). */
function destinationCell(board: Board, move: Slide): number {
  const block = board.blocks[move.block]!;
  const position = board.positions[move.block]!;
  const end = move.to < position ? move.to : move.to + block.length - 1;
  return block.orientation === 'h' ? block.lane * BOARD_SIZE + end : end * BOARD_SIZE + block.lane;
}

/** One slide the tap-only way: the block, then the cell (§5). */
function tapSlide(board: Board, move: Slide): Board {
  const button = blockButton(move.block);
  if (button.getAttribute('aria-pressed') !== 'true') fireEvent.click(button, { detail: 1 });
  fireEvent.click(cellAt(destinationCell(board, move)), { detail: 1 });
  return slide(board, move)!;
}

/** A shortest way out of a board this game dealt — which always has one (§8). */
function solved(board: Board): { solution: readonly Slide[]; minMoves: number } {
  const result = solve(board, 6000);
  if (result.status !== 'solved') throw new Error(`a dealt board must solve, got ${result.status}`);
  return result;
}

/**
 * A one-cell slide some block can make, and which way along its lane it goes:
 * forward (right / down) when any block can, else backward. A dealt board may
 * have every movable block already at its far end.
 */
function oneStep(board: Board): Slide & { step: 1 | -1 } {
  for (const step of [1, -1] as const) {
    for (let block = 0; block < board.blocks.length; block++) {
      const range = slideRange(board, block);
      const to = board.positions[block]! + step;
      if (to >= range.min && to <= range.max && to !== board.positions[block]) {
        return { block, to, step };
      }
    }
  }
  throw new Error('a dealt board has a move');
}

/** The arrow key, and the arrow button's name, that move a block one cell that way. */
function arrowsFor(board: Board, move: { block: number; step: 1 | -1 }) {
  const horizontal = board.blocks[move.block]!.orientation === 'h';
  const names = horizontal ? ['Move left', 'Move right'] : ['Move up', 'Move down'];
  const keys = horizontal ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
  const across = horizontal ? 'ArrowDown' : 'ArrowRight';
  const [backButton, forwardButton] = move.step === 1 ? names : [names[1], names[0]];
  const [backKey, forwardKey] = move.step === 1 ? keys : [keys[1], keys[0]];
  return { button: forwardButton!, back: backButton!, key: forwardKey!, backKey: backKey!, across };
}

function storedStats(): Stats | null {
  const raw = deviceStore.get(UB_STORAGE_KEYS.stats);
  return raw === undefined ? null : (JSON.parse(raw) as Stats);
}

/** The app goes to background. Android may kill it without another event. */
function background() {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  Reflect.deleteProperty(document, 'visibilityState');
}

/** And comes back. */
function foreground() {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  Reflect.deleteProperty(document, 'visibilityState');
}

async function launchTutorialDone() {
  deviceStore.set(UB_STORAGE_KEYS.flags, TUTORIAL_DONE);
  const onExit = launch();
  await settle();
  return onExit;
}

afterEach(() => {
  cleanup();
  deviceStore.clear();
  vi.restoreAllMocks();
});

describe('first run (§13)', () => {
  it('shows three Quick Rules steps, then starts an easy board straight away', async () => {
    const user = userEvent.setup();
    launch();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'How to Play' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Slide along the line')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Free the target')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('One slide, one move')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));
    await settle();

    expect(boardGroup()).toBeInTheDocument();
    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(screen.getByText(/^Moves 0 · fewest \d+$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Target block/ })).toBeInTheDocument();
    // Saved the moment it is dealt, and counted as played (§10).
    expect(stored(UB_STORAGE_KEYS.game)?.difficulty).toBe('easy');
    expect(storedStats()?.easy.played).toBe(1);
    expect(JSON.parse(deviceStore.get(UB_STORAGE_KEYS.flags)!).tutorialCompleted).toBe(true);
  });

  // Quick Rules come back when the flags record is unreadable (§12), and a
  // Free Play board may be in progress at another difficulty than the one
  // remembered. Starting to play picks that board up: replacing it is a
  // question the home asks (§11), never a side effect of finishing a lesson.
  it('picks up a Free Play board in progress rather than dealing over it', async () => {
    const user = userEvent.setup();
    const hard = createFreeSession('hard', 'unblock-puzzle-hard-g1');
    deviceStore.set(UB_STORAGE_KEYS.game, JSON.stringify(toPersisted(hard, 0)));
    deviceStore.set(UB_STORAGE_KEYS.flags, JSON.stringify('corrupt'));
    deviceStore.set(
      UB_STORAGE_KEYS.prefs,
      JSON.stringify({ schemaVersion: 1, difficulty: 'easy' }),
    );
    launch();
    await screen.findByRole('heading', { level: 1, name: 'How to Play' });
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));
    await settle();

    expect(boardGroup()).toBeInTheDocument();
    expect(screen.getByText('Hard')).toBeInTheDocument();
    expect(stored(UB_STORAGE_KEYS.game)?.seed).toBe(hard.seed);
    expect(encodeBoard(boardOf(UB_STORAGE_KEYS.game))).toBe(encodeBoard(hard.start));
    // A resume, not a start: nothing counted as played.
    expect(storedStats()?.hard.played ?? 0).toBe(0);
    expect(storedStats()?.easy.played ?? 0).toBe(0);
  });
});

describe('playing (§4, §5)', () => {
  it('slides by tap, then tap, counting one move per slide', async () => {
    const user = userEvent.setup();
    await launchTutorialDone();
    await user.click(screen.getByRole('button', { name: /^Easy/ }));
    await settle();
    const board = boardOf(UB_STORAGE_KEYS.game);
    const move = oneStep(board);

    fireEvent.click(blockButton(move.block), { detail: 1 });
    expect(blockButton(move.block)).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(cellAt(destinationCell(board, move)), { detail: 1 });
    await settle();

    expect(screen.getByText(/^Moves 1 ·/)).toBeInTheDocument();
    expect(encodeBoard(boardOf(UB_STORAGE_KEYS.game))).toBe(encodeBoard(slide(board, move)!));
    // Read aloud: where the moved block is now.
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe(
      blockButton(move.block).getAttribute('aria-label'),
    );
  });

  it('moves the selected block one cell per arrow button, still one move', async () => {
    const user = userEvent.setup();
    await launchTutorialDone();
    await user.click(screen.getByRole('button', { name: /^Easy/ }));
    await settle();
    const board = boardOf(UB_STORAGE_KEYS.game);
    const move = oneStep(board);
    const arrows = arrowsFor(board, move);

    // Nothing selected: the arrows say so by being off.
    expect(screen.getByRole('button', { name: 'Move left' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move right' })).toBeDisabled();
    expect(screen.getByText('Tap a block to move it')).toBeInTheDocument();

    fireEvent.click(blockButton(move.block), { detail: 1 });
    await user.click(screen.getByRole('button', { name: arrows.button }));
    await settle();
    expect(screen.getByText(/^Moves 1 ·/)).toBeInTheDocument();
    // Back again with the other arrow: the same block back where its move began
    // takes the move away (§4).
    await user.click(screen.getByRole('button', { name: arrows.back }));
    await settle();
    expect(screen.getByText(/^Moves 0 ·/)).toBeInTheDocument();
    expect(encodeBoard(boardOf(UB_STORAGE_KEYS.game))).toBe(encodeBoard(board));
  });

  it('plays from the keyboard: arrows along the lane, nothing across it, no repeats', async () => {
    const user = userEvent.setup();
    await launchTutorialDone();
    await user.click(screen.getByRole('button', { name: /^Easy/ }));
    await settle();
    const board = boardOf(UB_STORAGE_KEYS.game);
    const move = oneStep(board);
    const arrows = arrowsFor(board, move);
    const button = blockButton(move.block);
    act(() => button.focus());

    // Across the lane: swallowed, nothing moves.
    fireEvent.keyDown(button, { key: arrows.across });
    expect(screen.getByText(/^Moves 0 ·/)).toBeInTheDocument();
    // A held key's repeat moves nothing.
    fireEvent.keyDown(button, { key: arrows.key, repeat: true });
    expect(screen.getByText(/^Moves 0 ·/)).toBeInTheDocument();
    // Along it: one cell, one move, and the block is now the selected one.
    fireEvent.keyDown(button, { key: arrows.key });
    await settle();
    expect(screen.getByText(/^Moves 1 ·/)).toBeInTheDocument();
    expect(blockButton(move.block)).toHaveAttribute('aria-pressed', 'true');
    // Esc lets go.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(blockButton(move.block)).toHaveAttribute('aria-pressed', 'false');
    // Ctrl+Z undoes, like the button.
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    await settle();
    expect(screen.getByText(/^Moves 0 ·/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('undoes one move at a time, and the button is off with nothing to undo (§6)', async () => {
    const user = userEvent.setup();
    await launchTutorialDone();
    await user.click(screen.getByRole('button', { name: /^Easy/ }));
    await settle();
    const start = boardOf(UB_STORAGE_KEYS.game);
    const { solution } = solved(start);
    tapSlide(tapSlide(start, solution[0]!), solution[1]!);
    await settle();
    expect(screen.getByText(/^Moves 2 ·/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await settle();
    expect(screen.getByText(/^Moves 0 ·/)).toBeInTheDocument();
    expect(encodeBoard(boardOf(UB_STORAGE_KEYS.game))).toBe(encodeBoard(start));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('shows no clock while playing, and hands control back to the collection', async () => {
    const user = userEvent.setup();
    const onExit = await launchTutorialDone();
    await user.click(screen.getByRole('button', { name: /^Easy/ }));
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

describe('the Hint (§6)', () => {
  it('names the next move of a shortest way out, marks it, moves nothing, and counts it', async () => {
    const user = userEvent.setup();
    await launchTutorialDone();
    await user.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    await settle();
    const daily = createDailySession(today());
    const before = blockLabels();

    await user.click(screen.getByRole('button', { name: 'Hint' }));
    await settle();
    // Said in words for a screen reader: which block, from where, to where.
    const first = solved(daily.start).solution[0]!;
    const shape = daily.start.blocks[first.block]!;
    const position = daily.start.positions[first.block]!;
    const target = `${first.to + 1}–${first.to + shape.length}`;
    const where =
      first.block === 0
        ? `the target block to columns ${target}`
        : shape.orientation === 'h'
          ? `the block in row ${shape.lane + 1}, columns ${position + 1}–${position + shape.length}, to columns ${target}`
          : `the block in column ${shape.lane + 1}, rows ${position + 1}–${position + shape.length}, to rows ${target}`;
    expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent(
      `Hint: slide ${where}.`,
    );
    // And on screen: marks on the board, and a line that says what they mean.
    expect(screen.getByText('Slide the marked block to the dashed outline.')).toBeInTheDocument();
    expect(document.querySelector('.ub-ghost')).not.toBeNull();
    expect(document.querySelector('.ub-block-hint')).not.toBeNull();
    expect(blockLabels()).toEqual(before);
    expect(screen.getByText(/^Moves 0 ·/)).toBeInTheDocument();
    expect(stored(UB_STORAGE_KEYS.dailyGame)?.hintCount).toBe(1);

    // H asks the same question; following the hint shortens the way by one.
    const hinted = Number((document.querySelector('.ub-block-hint') as HTMLElement).dataset.block);
    expect(hinted).toBe(first.block);
    tapSlide(daily.start, first);
    await settle();
    expect(document.querySelector('.ub-ghost')).toBeNull();
    expect(
      screen.queryByText('Slide the marked block to the dashed outline.'),
    ).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'h' });
    await settle();
    expect(stored(UB_STORAGE_KEYS.dailyGame)?.hintCount).toBe(2);
    const after = solve(boardOf(UB_STORAGE_KEYS.dailyGame), 6000);
    expect(after.status === 'solved' && after.minMoves).toBe(daily.minMoves - 1);
  });

  it('says the hint on screen again when asked again, and counts it once', async () => {
    const user = userEvent.setup();
    await launchTutorialDone();
    await user.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    await settle();
    const live = () => document.querySelector('[aria-live="polite"]')!.textContent!;

    await user.click(screen.getByRole('button', { name: 'Hint' }));
    await settle();
    const said = live();
    expect(said).toMatch(/^Hint: slide /);
    expect(stored(UB_STORAGE_KEYS.dailyGame)?.hintCount).toBe(1);

    // Nothing has moved since: the same answer, said again — the live region
    // changes, so a screen reader reads it — and not counted again.
    await user.click(screen.getByRole('button', { name: 'Hint' }));
    await settle();
    expect(live()).not.toBe(said);
    expect(live().trim()).toBe(said);
    fireEvent.keyDown(window, { key: 'h' });
    await settle();
    expect(live()).toBe(said);
    expect(stored(UB_STORAGE_KEYS.dailyGame)?.hintCount).toBe(1);
    expect(document.querySelectorAll('.ub-ghost')).toHaveLength(1);
  });
});

describe('clearing a board (§3, §10)', () => {
  it('raises the card once, with the facts, and offers a new board first', async () => {
    const user = userEvent.setup();
    await launchTutorialDone();
    await user.click(screen.getByRole('button', { name: /^Easy/ }));
    await settle();
    const start = boardOf(UB_STORAGE_KEYS.game);
    const result = solved(start);
    let board = start;
    for (const move of result.solution) board = tapSlide(board, move);
    await settle();

    const card = await screen.findByRole('alertdialog', { name: 'Cleared!' });
    expect(within(card).getByText('Out in the fewest possible moves.')).toBeInTheDocument();
    // The moves against the board's fewest, side by side.
    const fact = (label: string) =>
      within(card).getByText(label).closest('div')!.querySelector('dd')!.textContent;
    expect(fact('Moves')).toBe(String(result.minMoves));
    expect(fact('Fewest possible')).toBe(String(result.minMoves));
    expect(within(card).getByText('Net cells moved')).toBeInTheDocument();
    expect(within(card).getByText('Hints used')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Share' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'New board' })).toHaveFocus();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    // The board behind the card is out of reach.
    expect(document.querySelector('.game-content')).toHaveAttribute('inert');

    // Booked once: the save is gone, the clear counted, exact clear included.
    expect(stored(UB_STORAGE_KEYS.game)).toBeNull();
    expect(storedStats()?.easy).toMatchObject({ played: 1, solved: 1, optimal: 1 });

    await user.click(within(card).getByRole('button', { name: 'New board' }));
    await settle();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText(/^Moves 0 ·/)).toBeInTheDocument();
    expect(storedStats()?.easy.played).toBe(2);
  });

  it('says a record quietly, and only once one is beaten: the fastest clear', async () => {
    deviceStore.set(UB_STORAGE_KEYS.flags, TUTORIAL_DONE);
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /^Easy/ }));
      await settle();
      const start = boardOf(UB_STORAGE_KEYS.game);
      const { solution } = solved(start);
      const clear = async () => {
        let board = start;
        for (const move of solution) board = tapSlide(board, move);
        await settle();
        return screen.getByRole('alertdialog', { name: 'Cleared!' });
      };

      act(() => vi.advanceTimersByTime(10_000));
      let card = await clear();
      // The first clear sets the record and says nothing about it.
      expect(within(card).queryByText(/fastest/)).not.toBeInTheDocument();
      expect(card.querySelector('.result-delta')).toBeNull();
      expect(storedStats()?.easy.bestSeconds).toBe(10);

      fireEvent.click(within(card).getByRole('button', { name: 'Retry same board' }));
      await settle();
      act(() => vi.advanceTimersByTime(3_000));
      card = await clear();
      expect(within(card).getByText('Your fastest Easy clear yet.')).toBeInTheDocument();
      expect(card.querySelector('.result-delta')?.textContent).toBe('−0:07');
      expect(storedStats()?.easy.bestSeconds).toBe(3);

      // Slower than the record: nothing to say.
      fireEvent.click(within(card).getByRole('button', { name: 'Retry same board' }));
      await settle();
      act(() => vi.advanceTimersByTime(5_000));
      card = await clear();
      expect(within(card).queryByText(/fastest/)).not.toBeInTheDocument();
      expect(storedStats()?.easy.bestSeconds).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the daily (§9, §10)', () => {
  it('says the day is done, and a fewer-moves record on the day’s board', async () => {
    const user = userEvent.setup();
    const daily = createDailySession(today());
    const record: Stats = {
      ...statsSchema.defaultValue(),
      dailyMoves: { [today()]: daily.minMoves + 3 },
    };
    deviceStore.set(UB_STORAGE_KEYS.stats, JSON.stringify(record));
    await launchTutorialDone();
    const entry = screen.getByRole('button', { name: /Daily Challenge/ });
    expect(entry).toHaveTextContent('Completed today');
    expect(entry).not.toHaveTextContent('Resume');

    // Done today is not shut today: the same board can be played again.
    await user.click(entry);
    await settle();
    let board = daily.start;
    for (const move of solved(daily.start).solution) board = tapSlide(board, move);
    await settle();
    const card = await screen.findByRole('alertdialog', { name: 'Cleared!' });
    expect(within(card).getByText('Your fewest moves on today’s board yet.')).toBeInTheDocument();
    expect(card.querySelector('.result-delta')?.textContent).toBe('−3');
    expect(storedStats()?.dailyMoves[today()]).toBe(daily.minMoves);
  });

  it('does not take a daily in progress away when the date changes under it', async () => {
    deviceStore.set(UB_STORAGE_KEYS.flags, TUTORIAL_DONE);
    // Only the calendar is faked: the clock's interval and the saves run as usual.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 17, 23, 59, 30));
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Daily Challenge/ }));
      await settle();
      const start = createDailySession('2026-10-17').start;
      expect(encodeBoard(boardOf(UB_STORAGE_KEYS.dailyGame))).toBe(encodeBoard(start));
      const { solution } = solved(start);
      const board = tapSlide(start, solution[0]!);
      await settle();

      vi.setSystemTime(new Date(2026, 9, 18, 0, 0, 30));
      tapSlide(board, solution[1]!);
      await settle();
      expect(screen.getByText(/^Moves 2 ·/)).toBeInTheDocument();
      expect(stored(UB_STORAGE_KEYS.dailyGame)).toMatchObject({ dailyDate: '2026-10-17' });
      expect(stored(UB_STORAGE_KEYS.dailyGame)?.moves).toHaveLength(4);

      // The home now points at the new day's board, not at yesterday's.
      fireEvent.click(screen.getByRole('button', { name: 'Home' }));
      await settle();
      expect(screen.getByRole('button', { name: /Daily Challenge/ })).not.toHaveTextContent(
        'Resume',
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the ↻ question (§6)', () => {
  it('asks, then puts the same board back from the start', async () => {
    const user = userEvent.setup();
    await launchTutorialDone();
    await user.click(screen.getByRole('button', { name: /^Easy/ }));
    await settle();
    const start = boardOf(UB_STORAGE_KEYS.game);
    const seed = stored(UB_STORAGE_KEYS.game)!.seed;
    tapSlide(start, oneStep(start));
    await settle();

    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Start over?' });
    expect(within(dialog).getByRole('button', { name: 'New board' })).toBeInTheDocument();
    expect(document.querySelector('.game-content')).toHaveAttribute('inert');
    await user.click(within(dialog).getByRole('button', { name: 'Retry same board' }));
    await settle();
    expect(screen.getByText(/^Moves 0 ·/)).toBeInTheDocument();
    expect(stored(UB_STORAGE_KEYS.game)?.seed).toBe(seed);
    expect(encodeBoard(boardOf(UB_STORAGE_KEYS.game))).toBe(encodeBoard(start));
  });

  // The seconds a board was played count even when it is given up (§10):
  // the same board again and a new one both hand the clock to a fresh board.
  it('books the time of a board given up through ↻, either answer', async () => {
    deviceStore.set(UB_STORAGE_KEYS.flags, TUTORIAL_DONE);
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /^Easy/ }));
      await settle();
      const answer = (name: string) => {
        fireEvent.click(screen.getByRole('button', { name: 'Retry same board' }));
        const dialog = screen.getByRole('alertdialog', { name: 'Start over?' });
        fireEvent.click(within(dialog).getByRole('button', { name }));
      };

      act(() => vi.advanceTimersByTime(6_000));
      answer('Retry same board');
      await settle();
      expect(storedStats()?.easy.totalPlaySeconds).toBe(6);
      expect(stored(UB_STORAGE_KEYS.game)?.elapsedSeconds).toBe(0);

      act(() => vi.advanceTimersByTime(2_000));
      answer('New board');
      await settle();
      expect(storedStats()?.easy.totalPlaySeconds).toBe(8);

      act(() => vi.advanceTimersByTime(1_000));
      fireEvent.click(screen.getByRole('button', { name: 'Home' }));
      await settle();
      // Each second once, and each board counted as played once.
      expect(storedStats()?.easy).toMatchObject({ totalPlaySeconds: 9, played: 3 });
    } finally {
      vi.useRealTimers();
    }
  });

  // Found while measuring §8 in the browser: with a Hint on screen, a new
  // board rendered once against the old Hint before the Hint was cleared —
  // and a Hint naming a block the new board does not have threw. The Hint now
  // only ever shows on the board it was found on.
  it('lets go of the Hint with the board it was found on, even for a board of fewer blocks', async () => {
    const user = userEvent.setup();
    // An Easy board in progress whose opening Hint names block 10 of 12…
    const easy = createFreeSession('easy', 'unblock-puzzle-easy-hint-27');
    deviceStore.set(UB_STORAGE_KEYS.flags, TUTORIAL_DONE);
    deviceStore.set(UB_STORAGE_KEYS.game, JSON.stringify(toPersisted(easy, 0)));
    launch();
    await settle();
    await user.click(screen.getByRole('button', { name: /^Easy.*Resume/ }));
    await settle();
    await user.click(screen.getByRole('button', { name: 'Hint' }));
    expect(document.querySelector('.ub-block-hint')).toBe(blockButton(10));
    expect(document.querySelector('.ub-ghost')).not.toBeNull();
    // …then a new board with 10 blocks: this clock and random number mint a
    // seed whose Easy board has no block 10.
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_760_000_000_000);
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      await user.click(screen.getByRole('button', { name: 'Retry same board' }));
      const dialog = screen.getByRole('alertdialog', { name: 'Start over?' });
      await user.click(within(dialog).getByRole('button', { name: 'New board' }));
      await settle();
    } finally {
      now.mockRestore();
      random.mockRestore();
    }
    expect(stored(UB_STORAGE_KEYS.game)?.seed).toBe('unblock-puzzle-easy-mgj6k3cw-4zsov');
    expect(boardOf(UB_STORAGE_KEYS.game).blocks).toHaveLength(10);
    expect(boardGroup()).toBeInTheDocument();
    expect(document.querySelector('.ub-ghost')).toBeNull();
    expect(document.querySelector('.ub-block-hint')).toBeNull();
    expect(screen.getByText(/^Moves 0 ·/)).toBeInTheDocument();
  });

  it('offers only the retry for the daily: there is no other board today', async () => {
    const user = userEvent.setup();
    await launchTutorialDone();
    await user.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Start over?' });
    expect(within(dialog).queryByRole('button', { name: 'New board' })).not.toBeInTheDocument();
    // Keys do not reach the board behind the question.
    fireEvent.keyDown(window, { key: 'h' });
    await settle();
    expect(stored(UB_STORAGE_KEYS.dailyGame)?.hintCount).toBe(0);
  });
});

describe('keeping a board (§11)', () => {
  it('keeps a board across leaving and across a relaunch, moves and Undo included', async () => {
    const user = userEvent.setup();
    await launchTutorialDone();
    await user.click(screen.getByRole('button', { name: /^Easy/ }));
    await settle();
    const start = boardOf(UB_STORAGE_KEYS.game);
    const moved = tapSlide(start, oneStep(start));
    await settle();

    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    expect(screen.getByRole('button', { name: /Easy.*Resume/ })).toBeInTheDocument();

    // The process dies; the next launch reads the device store.
    cleanup();
    launch();
    await settle();
    await user.click(screen.getByRole('button', { name: /Easy.*Resume/ }));
    await settle();
    expect(screen.getByText(/^Moves 1 ·/)).toBeInTheDocument();
    expect(encodeBoard(boardOf(UB_STORAGE_KEYS.game))).toBe(encodeBoard(moved));
    // Nothing moved on its own on the way back, and Undo still reaches the move.
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await settle();
    expect(encodeBoard(boardOf(UB_STORAGE_KEYS.game))).toBe(encodeBoard(start));
  });

  it('keeps the Free Play board and the daily apart (§9)', async () => {
    const user = userEvent.setup();
    await launchTutorialDone();
    await user.click(screen.getByRole('button', { name: /^Easy/ }));
    await settle();
    const easy = boardOf(UB_STORAGE_KEYS.game);
    tapSlide(easy, oneStep(easy));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    await settle();
    expect(screen.getByText('Daily')).toBeInTheDocument();
    const daily = createDailySession(today());
    expect(encodeBoard(boardOf(UB_STORAGE_KEYS.dailyGame))).toBe(encodeBoard(daily.start));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();

    expect(screen.getByRole('button', { name: /Easy.*Resume/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge.*Resume/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Easy.*Resume/ }));
    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(screen.getByText(/^Moves 1 ·/)).toBeInTheDocument();
    expect(stored(UB_STORAGE_KEYS.game)?.mode).toBe('free');
    expect(stored(UB_STORAGE_KEYS.dailyGame)?.mode).toBe('daily');
  });

  it('asks before replacing a board in progress with another difficulty', async () => {
    const user = userEvent.setup();
    await launchTutorialDone();
    await user.click(screen.getByRole('button', { name: /^Easy/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: /^Medium/ }));
    expect(
      screen.getByRole('alertdialog', { name: 'Replace the board in progress?' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: /Easy.*Resume/ })).toBeInTheDocument();
    expect(stored(UB_STORAGE_KEYS.game)?.difficulty).toBe('easy');
  });

  it('remembers the difficulty last chosen, and leads the home with it', async () => {
    const user = userEvent.setup();
    await launchTutorialDone();
    await user.click(screen.getByRole('button', { name: /^Hard/ }));
    await settle();
    expect(JSON.parse(deviceStore.get(UB_STORAGE_KEYS.prefs)!).difficulty).toBe('hard');
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByRole('button', { name: /^Hard/ })).toHaveClass('btn-primary');
    expect(screen.getByRole('button', { name: /^Easy/ })).toHaveClass('btn-secondary');
  });
});

describe('a saved game the loader refuses lands on the home, with nothing started (§12)', () => {
  const freeRecord = (): PersistedGame => {
    // A real dealt board, recorded the way play records it.
    const daily = createDailySession(today());
    return {
      ...toPersisted(daily, 0),
      mode: 'free',
      dailyDate: null,
      seed: 'unblock-puzzle-medium-test',
    };
  };

  it.each([
    ['truncated JSON', () => JSON.stringify(freeRecord()).slice(0, 60)],
    ['a wrong type', () => JSON.stringify({ ...freeRecord(), minMoves: 'eleven' })],
    [
      'a board not dealt at that difficulty',
      () =>
        JSON.stringify({ ...freeRecord(), difficulty: 'hard', seed: 'unblock-puzzle-hard-test' }),
    ],
    [
      'a fewest-moves count the board does not have',
      () => JSON.stringify({ ...freeRecord(), minMoves: 3 }),
    ],
    ['a move the rules refuse', () => JSON.stringify({ ...freeRecord(), moves: 'z9' })],
  ])('%s', async (_name, payload) => {
    deviceStore.set(UB_STORAGE_KEYS.game, payload());
    await launchTutorialDone();
    expect(queryBoard()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Medium/ })).not.toHaveTextContent('Resume');
    expect(screen.queryByText('Resume')).not.toBeInTheDocument();
    // Nothing was started for the player: no play counted, nothing saved over.
    expect(storedStats()).toBeNull();
    expect(deviceStore.get(UB_STORAGE_KEYS.game)).toBe(payload());
    // The same record read through a shortcut also lands on the home.
    cleanup();
    launchFromShortcut();
    await settle();
    expect(queryBoard()).not.toBeInTheDocument();
  });

  it('a game already won', async () => {
    const daily = createDailySession(today());
    const result = solved(daily.start);
    let board = daily.start;
    for (const move of result.solution) board = slide(board, move)!;
    const won: PersistedGame = {
      ...freeRecord(),
      moves: result.solution
        .map((move) => `${String.fromCharCode(97 + move.block)}${move.to}`)
        .join(''),
    };
    expect(board.positions[0]).toBe(4);
    deviceStore.set(UB_STORAGE_KEYS.game, JSON.stringify(won));
    await launchTutorialDone();
    expect(screen.queryByText('Resume')).not.toBeInTheDocument();
    expect(storedStats()).toBeNull();
  });

  it('while the real thing, from the same writer, resumes', async () => {
    deviceStore.set(UB_STORAGE_KEYS.game, JSON.stringify(freeRecord()));
    await launchTutorialDone();
    expect(screen.getByRole('button', { name: /Medium.*Resume/ })).toBeInTheDocument();
  });
});

describe('backgrounding (§11)', () => {
  // Play five seconds, background the app, let Android kill it, come back:
  // the board returns, and so must the five seconds — booked once.
  it('books play time before the app can be killed, and never twice', async () => {
    deviceStore.set(UB_STORAGE_KEYS.flags, TUTORIAL_DONE);
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /^Easy/ }));
      await settle();

      act(() => vi.advanceTimersByTime(5_000));
      background();
      await settle();
      expect(storedStats()?.easy.totalPlaySeconds).toBe(5);
      expect(stored(UB_STORAGE_KEYS.game)?.elapsedSeconds).toBe(5);

      cleanup();
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Easy.*Resume/ }));
      act(() => vi.advanceTimersByTime(3_000));
      background();
      await settle();
      expect(storedStats()?.easy.totalPlaySeconds).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });

  it('coming back moves nothing and starts nothing by itself', async () => {
    const user = userEvent.setup();
    await launchTutorialDone();
    await user.click(screen.getByRole('button', { name: /^Easy/ }));
    await settle();
    const before = stored(UB_STORAGE_KEYS.game)!;
    background();
    foreground();
    await settle();
    const after = stored(UB_STORAGE_KEYS.game)!;
    expect(after.moves).toBe(before.moves);
    expect(after.board).toBe(before.board);
    expect(screen.getByText(/^Moves 0 ·/)).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

/**
 * A pinned home-screen shortcut, and what this game does about it (issue
 * #113). The shell says only which door was used; every decision below is
 * this game's, taken from its own two save slots (§11).
 */
describe('a home-screen shortcut', () => {
  it('opens the one suspended game straight onto its board', async () => {
    const user = userEvent.setup();
    await launchTutorialDone();
    await user.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    cleanup();

    launchFromShortcut();
    await settle();
    expect(boardGroup()).toBeInTheDocument();
    expect(screen.getByText('Daily')).toBeInTheDocument();
  });

  it('opens the home screen when two games are suspended, rather than guessing', async () => {
    const user = userEvent.setup();
    await launchTutorialDone();
    await user.click(screen.getByRole('button', { name: /^Easy/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    cleanup();

    launchFromShortcut();
    await settle();
    expect(queryBoard()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Easy.*Resume/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge.*Resume/ })).toBeInTheDocument();
  });

  it('teaches the game first on a launch that has never seen it (§13)', async () => {
    launchFromShortcut();
    expect(await screen.findByText('Slide along the line')).toBeInTheDocument();
    expect(queryBoard()).not.toBeInTheDocument();
  });
});

describe('statistics (§10)', () => {
  it('reports per-difficulty facts and the dailies cleared, and no streak', async () => {
    const user = userEvent.setup();
    await launchTutorialDone();
    await user.click(screen.getByRole('button', { name: 'Statistics' }));
    expect(screen.getAllByText('Boards cleared')).toHaveLength(3);
    expect(screen.getAllByText('Cleared in fewest moves')).toHaveLength(3);
    expect(screen.getByText('Daily Challenges cleared')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});
