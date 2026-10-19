/**
 * The Hint that finds nothing, as the player meets it (docs/UNBLOCK_PUZZLE_RULES.md
 * §6): no mark on the board, no guessed move, the line between the arrows
 * and the live region saying so, and nothing counted.
 *
 * A board this game dealt always has a way out inside the search's limit
 * (§8), so play can never reach this screen on its own. The search is
 * therefore made to come back empty here — `hintFor` alone is replaced, by a
 * stand-in that answers the way `findHint` answers when its limit is hit —
 * and everything around it is the real game. `findHint`'s own "capped",
 * "unsolvable" and "invalid" answers are tested in game/session.test.ts.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import {
  BOARD_SIZE,
  createDailySession,
  decodeBoard,
  encodeBoard,
  localDateString,
  replayMoves,
  slideRange,
  type Board,
  type Hint,
  type UnblockSession,
} from '../game';
import { UB_STORAGE_KEYS, type PersistedGame } from '../storage/schemas';
import { UnblockPuzzleRoot } from './UnblockPuzzleRoot';

const { deviceStore, search } = vi.hoisted(() => ({
  deviceStore: new Map<string, string>(),
  /** When true, the Hint's search comes back empty, as at its limit. */
  search: { empty: false, calls: 0 },
}));

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

vi.mock('../game', async (importOriginal) => {
  const real = await importOriginal<typeof import('../game')>();
  return {
    ...real,
    hintFor: (session: UnblockSession): Hint | null => {
      search.calls += 1;
      return search.empty ? { kind: 'none', reason: 'capped' } : real.hintFor(session);
    },
  };
});

const TUTORIAL_DONE = JSON.stringify({ schemaVersion: 1, tutorialCompleted: true });
const NONE = 'No move was found from here.';

const settle = () => act(async () => undefined);
const boardGroup = () => screen.getByRole('group', { name: /^Board, 6 by 6/ });
const blockLabels = () =>
  within(boardGroup())
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label'));
const live = () => document.querySelector('[aria-live="polite"]')!.textContent!;
const marks = () => document.querySelectorAll('.ub-ghost, .ub-block-hint').length;
/** The line between the arrow buttons (§5, §6). */
const line = () => document.querySelector('.ub-move-prompt')!.textContent;

function stored(): PersistedGame {
  return JSON.parse(deviceStore.get(UB_STORAGE_KEYS.dailyGame)!) as PersistedGame;
}

function boardOnScreen(): Board {
  const record = stored();
  return replayMoves(record.moves, decodeBoard(record.board)!, 9999)!.board;
}

/** Some block's one-cell slide, made the tap-only way: the block, then the cell (§5). */
function tapSomeSlide(board: Board) {
  for (let block = 0; block < board.blocks.length; block++) {
    const range = slideRange(board, block);
    const position = board.positions[block]!;
    const to = position < range.max ? position + 1 : position > range.min ? position - 1 : null;
    if (to === null) continue;
    const shape = board.blocks[block]!;
    const end = to > position ? to + shape.length - 1 : to;
    const cell =
      shape.orientation === 'h' ? shape.lane * BOARD_SIZE + end : end * BOARD_SIZE + shape.lane;
    fireEvent.click(document.querySelector(`[data-block="${block}"]`)!, { detail: 1 });
    fireEvent.click(document.querySelector(`[data-cell="${cell}"]`)!, { detail: 1 });
    return;
  }
  throw new Error('a dealt board has a move');
}

async function openToday() {
  deviceStore.set(UB_STORAGE_KEYS.flags, TUTORIAL_DONE);
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <UnblockPuzzleRoot onExit={vi.fn()} />
    </SettingsProvider>,
  );
  await settle();
  await userEvent.setup().click(screen.getByRole('button', { name: /Daily Challenge/ }));
  await settle();
  expect(encodeBoard(boardOnScreen())).toBe(
    encodeBoard(createDailySession(localDateString(new Date())).start),
  );
}

afterEach(async () => {
  cleanup();
  // Unmounting saves: the provider runs its leave sync on the way out
  // (docs/GAME_LIFECYCLE.md「アンマウントで計上する」), and saves are
  // fire-and-forget. Let them land before wiping the store, or the next test
  // launches onto a game it never played.
  await act(async () => undefined);
  deviceStore.clear();
  search.empty = false;
  search.calls = 0;
});

describe('a Hint that finds nothing (§6)', () => {
  it('says so, marks nothing, guesses nothing, and counts nothing', async () => {
    await openToday();
    const before = blockLabels();
    search.empty = true;

    fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
    await settle();
    expect(search.calls).toBe(1);
    expect(line()).toBe(NONE);
    expect(live()).toBe(NONE);
    expect(marks()).toBe(0);
    expect(blockLabels()).toEqual(before);
    expect(screen.getByText(/^Moves 0 ·/)).toBeInTheDocument();
    expect(stored().hintCount).toBe(0);

    // H asks again: nothing has moved, so nothing is searched — the same
    // words, said again (the live region changes), still nothing counted.
    fireEvent.keyDown(window, { key: 'h' });
    await settle();
    expect(search.calls).toBe(1);
    expect(live()).not.toBe(NONE);
    expect(live().trim()).toBe(NONE);
    expect(marks()).toBe(0);
    expect(stored().hintCount).toBe(0);

    // The next move clears the line, like any hint's.
    tapSomeSlide(boardOnScreen());
    await settle();
    expect(line()).not.toBe(NONE);
  });

  it('leaves nothing of an earlier hint behind', async () => {
    await openToday();

    fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
    await settle();
    expect(marks()).toBe(2);
    expect(line()).toBe('Slide the marked block to the dashed outline.');
    expect(stored().hintCount).toBe(1);

    // A move ends that hint; the search from the new board comes back empty.
    tapSomeSlide(boardOnScreen());
    await settle();
    search.empty = true;
    fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
    await settle();
    expect(search.calls).toBe(2);
    expect(marks()).toBe(0);
    expect(line()).toBe(NONE);
    expect(live()).toBe(NONE);
    // Only the hint that showed a move is on the record.
    expect(stored().hintCount).toBe(1);
  });
});
