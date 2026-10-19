/**
 * What a jump looks, sounds and feels like, and what an ending tells the
 * shell (docs/PEG_SOLITAIRE_RULES.md §10, §13) — through the screens, with
 * the shared services spied on rather than heard:
 *
 * - a jump by tap or key slides the jumper in and fades the jumped peg, only
 *   while motion is allowed: the app's Reduced Motion setting draws the new
 *   board at once, and a dropped peg is never slid (it is already there);
 * - the result card waits the shared beat after the last jump when motion is
 *   allowed, and is there at once under Reduced Motion;
 * - a jump is `select` + a light `tap`; a perfect clear adds `clear` and the
 *   success vibration; one peg left or stuck adds `gameOver` and no vibration;
 *   Undo is `undo`; picking a peg up is silent;
 * - only a perfect clear counts as a won game for the review question, and
 *   only once per game — a clear undone and made again is the same win.
 *
 * jsdom has no matchMedia, which useReducedMotion reads as "reduce", so the
 * cases that need motion install the shared stand-in (src/test/lifecycle.ts)
 * that answers "no preference".
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { stubMatchMedia } from '@/test/lifecycle';
import { RESULT_REVEAL_MS } from '@/ui/useResultReveal';
import { ENGLISH, ENGLISH_PROBLEM, holeIndex, type Problem } from '../game';
import {
  ENGLISH_SOLUTION,
  ENGLISH_STUCK,
  parseEnglishJumps,
  TRIANGLE_APEX_PERFECT_LAST,
  TRIANGLE_APEX_PREFIX,
  TRIANGLE_APEX_SINGLE_LAST,
  type JumpList,
} from '../game/fixtures';
import { PG_STORAGE_KEYS, type PersistedGame } from '../storage/schemas';
import { PegSolitaireRoot } from './PegSolitaireRoot';

const { deviceStore, recordGameCompleted } = vi.hoisted(() => ({
  deviceStore: new Map<string, string>(),
  recordGameCompleted: vi.fn(),
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
vi.mock('../../../services/review', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/review')>()),
  recordGameCompleted,
}));

const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });

let spies: Record<string, ReturnType<typeof vi.spyOn>>;
let restoreMedia: (() => void) | null = null;

beforeEach(() => {
  recordGameCompleted.mockClear();
  spies = {
    select: vi.spyOn(sounds, 'select'),
    undo: vi.spyOn(sounds, 'undo'),
    clear: vi.spyOn(sounds, 'clear'),
    gameOver: vi.spyOn(sounds, 'gameOver'),
    tap: vi.spyOn(haptics, 'tap'),
    success: vi.spyOn(haptics, 'clear'),
  };
});

afterEach(async () => {
  cleanup();
  await settle();
  deviceStore.clear();
  restoreMedia?.();
  restoreMedia = null;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** Lets the board move: the OS asks for nothing, and neither does the app (unless told). */
function allowMotion() {
  restoreMedia = stubMatchMedia();
}

/** Opens a game suspended on `problem` after `jumps`, straight onto its board. */
async function open(problem: Problem, jumps: JumpList, appReducedMotion = false) {
  deviceStore.set(
    PG_STORAGE_KEYS.flags,
    JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
  );
  const record: PersistedGame = {
    schemaVersion: 1,
    board: problem.kind,
    start: problem.start,
    target: problem.target,
    jumps: jumps.map(([from, to]) => [from, to]),
    elapsedSeconds: 0,
    savedAt: 1,
  };
  deviceStore.set(PG_STORAGE_KEYS.game, JSON.stringify(record));
  render(
    <SettingsProvider
      initialSettings={{ ...settingsSchema.defaultValue(), reducedMotion: appReducedMotion }}
    >
      <PegSolitaireRoot onExit={() => undefined} entry="shortcut" />
    </SettingsProvider>,
  );
  await settle();
}

const board = () => screen.getByRole('group', { name: /board, \d+ holes$/ });
const hole = (index: number) => board().querySelector<HTMLButtonElement>(`[data-hole="${index}"]`)!;
const tap = (index: number) => fireEvent.click(hole(index), { detail: 1 });
const sliding = () => board().querySelector('.pg-peg-arrive');
const fading = () => board().querySelector('.pg-peg-vanish');

const APEX: Problem = { kind: 'triangle', start: 0, target: 0 };
const D2 = holeIndex(ENGLISH, 1, 3);
const D3 = holeIndex(ENGLISH, 2, 3);
const D4 = holeIndex(ENGLISH, 3, 3);

describe('the jump’s motion (§13)', () => {
  it('slides the jumper in and fades the jumped peg for a tap, with motion allowed', async () => {
    allowMotion();
    await open(ENGLISH_PROBLEM, []);
    tap(D2);
    tap(D4);
    expect(hole(D4).querySelector('.pg-peg-arrive')).not.toBeNull();
    // Lifted while it carries the slide, so the jumper passes over the pits.
    expect(hole(D4)).toHaveClass('pg-hole-arriving');
    expect(hole(D3).querySelector('.pg-peg-vanish')).not.toBeNull();
    // An Undo is placed, not replayed.
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(sliding()).toBeNull();
    expect(fading()).toBeNull();
    expect(board().querySelector('.pg-hole-arriving')).toBeNull();
  });

  it('slides the peg for a key press as well', async () => {
    allowMotion();
    await open(ENGLISH_PROBLEM, []);
    // The board opens with the focus on the ringed hole; up twice is d2.
    expect(document.activeElement).toBe(hole(D4));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    fireEvent.click(document.activeElement!, { detail: 0 });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    fireEvent.click(document.activeElement!, { detail: 0 });
    expect(hole(D4).querySelector('.pg-peg-arrive')).not.toBeNull();
  });

  it('draws the new board at once under the app’s Reduced Motion', async () => {
    allowMotion();
    await open(ENGLISH_PROBLEM, [], true);
    tap(D2);
    tap(D4);
    expect(hole(D4)).toHaveClass('pg-hole-peg');
    expect(sliding()).toBeNull();
    expect(fading()).toBeNull();
  });

  it('never slides a dropped peg: it is already where it lands', async () => {
    allowMotion();
    await open(ENGLISH_PROBLEM, []);
    const PITCH = 50;
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
    const at = (row: number) => ({ clientX: 3.5 * PITCH, clientY: (row + 0.5) * PITCH });
    fireEvent.pointerDown(hole(D2), { pointerId: 1, ...at(1) });
    fireEvent.pointerMove(hole(D2), { pointerId: 1, ...at(2) });
    fireEvent.pointerMove(hole(D2), { pointerId: 1, ...at(3) });
    fireEvent.pointerUp(hole(D2), { pointerId: 1, ...at(3) });
    expect(hole(D4)).toHaveClass('pg-hole-peg');
    expect(sliding()).toBeNull();
    expect(fading()).toBeNull();
    // The jump still sounds like a jump.
    expect(spies.select).toHaveBeenCalledTimes(1);
  });
});

describe('the result card’s beat (§13)', () => {
  it('waits the shared beat after the last jump when motion is allowed', async () => {
    allowMotion();
    vi.useFakeTimers();
    await open(APEX, TRIANGLE_APEX_PREFIX);
    tap(TRIANGLE_APEX_PERFECT_LAST[0]);
    tap(TRIANGLE_APEX_PERFECT_LAST[1]);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    // The finished board is out of reach while it is looked at.
    expect(board().closest('[inert]')).not.toBeNull();
    act(() => vi.advanceTimersByTime(RESULT_REVEAL_MS - 1));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole('alertdialog', { name: 'Perfect clear!' })).toBeInTheDocument();
  });

  it('is there at once under the app’s Reduced Motion', async () => {
    allowMotion();
    await open(APEX, TRIANGLE_APEX_PREFIX, true);
    tap(TRIANGLE_APEX_PERFECT_LAST[0]);
    tap(TRIANGLE_APEX_PERFECT_LAST[1]);
    expect(screen.getByRole('alertdialog', { name: 'Perfect clear!' })).toBeInTheDocument();
  });
});

describe('sound, vibration and the review question (§10, §13)', () => {
  it('is silent for picking a peg up and putting it down; a jump is select and a light tap', async () => {
    await open(ENGLISH_PROBLEM, []);
    tap(D2);
    tap(D2);
    tap(holeIndex(ENGLISH, 2, 0));
    expect(spies.select).not.toHaveBeenCalled();
    expect(spies.tap).not.toHaveBeenCalled();
    tap(D2);
    tap(D4);
    expect(spies.select).toHaveBeenCalledTimes(1);
    expect(spies.tap).toHaveBeenCalledTimes(1);
    expect(spies.clear).not.toHaveBeenCalled();
    expect(spies.gameOver).not.toHaveBeenCalled();
    expect(spies.success).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(spies.undo).toHaveBeenCalledTimes(1);
    expect(recordGameCompleted).not.toHaveBeenCalled();
  });

  it('a perfect clear: clear and the success vibration, and one won game', async () => {
    const solution = parseEnglishJumps(ENGLISH_SOLUTION);
    await open(ENGLISH_PROBLEM, solution.slice(0, -1));
    const [from, to] = solution[solution.length - 1]!;
    tap(from);
    tap(to);
    expect(screen.getByRole('alertdialog', { name: 'Perfect clear!' })).toBeInTheDocument();
    expect(spies.select).toHaveBeenCalledTimes(1);
    expect(spies.tap).toHaveBeenCalledTimes(1);
    expect(spies.clear).toHaveBeenCalledTimes(1);
    expect(spies.success).toHaveBeenCalledTimes(1);
    expect(spies.gameOver).not.toHaveBeenCalled();
    expect(recordGameCompleted).toHaveBeenCalledTimes(1);
  });

  it('a perfect clear undone and made again sounds like one, but is one won game', async () => {
    await open(APEX, TRIANGLE_APEX_PREFIX);
    tap(TRIANGLE_APEX_PERFECT_LAST[0]);
    tap(TRIANGLE_APEX_PERFECT_LAST[1]);
    const card = screen.getByRole('alertdialog', { name: 'Perfect clear!' });
    expect(recordGameCompleted).toHaveBeenCalledTimes(1);

    fireEvent.click(within(card).getByRole('button', { name: 'Undo' }));
    expect(spies.undo).toHaveBeenCalledTimes(1);
    tap(TRIANGLE_APEX_PERFECT_LAST[0]);
    tap(TRIANGLE_APEX_PERFECT_LAST[1]);
    expect(screen.getByRole('alertdialog', { name: 'Perfect clear!' })).toBeInTheDocument();
    // The clear is heard and felt each time it is made…
    expect(spies.clear).toHaveBeenCalledTimes(2);
    expect(spies.success).toHaveBeenCalledTimes(2);
    // …and counted, for the review question, once per game (§10).
    expect(recordGameCompleted).toHaveBeenCalledTimes(1);
  });

  it('one peg left: game over, never scolded by a vibration, and not a won game', async () => {
    await open(APEX, TRIANGLE_APEX_PREFIX);
    tap(TRIANGLE_APEX_SINGLE_LAST[0]);
    tap(TRIANGLE_APEX_SINGLE_LAST[1]);
    const card = screen.getByRole('alertdialog', { name: 'One peg left' });
    expect(spies.gameOver).toHaveBeenCalledTimes(1);
    expect(spies.clear).not.toHaveBeenCalled();
    expect(spies.success).not.toHaveBeenCalled();
    // Only the jump's own light tap.
    expect(spies.tap).toHaveBeenCalledTimes(1);
    expect(recordGameCompleted).not.toHaveBeenCalled();

    // Undone and cleared after all: that one is a won game, once.
    fireEvent.click(within(card).getByRole('button', { name: 'Undo' }));
    expect(spies.undo).toHaveBeenCalledTimes(1);
    tap(TRIANGLE_APEX_PERFECT_LAST[0]);
    tap(TRIANGLE_APEX_PERFECT_LAST[1]);
    expect(spies.clear).toHaveBeenCalledTimes(1);
    expect(recordGameCompleted).toHaveBeenCalledTimes(1);
  });

  it('stuck with pegs left: game over, no vibration beyond the jump, not a won game', async () => {
    const stuck = parseEnglishJumps(ENGLISH_STUCK);
    await open(ENGLISH_PROBLEM, stuck.slice(0, -1));
    const [from, to] = stuck[stuck.length - 1]!;
    tap(from);
    tap(to);
    expect(screen.getByRole('alertdialog', { name: 'No jumps left' })).toBeInTheDocument();
    expect(spies.gameOver).toHaveBeenCalledTimes(1);
    expect(spies.clear).not.toHaveBeenCalled();
    expect(spies.success).not.toHaveBeenCalled();
    expect(spies.tap).toHaveBeenCalledTimes(1);
    expect(recordGameCompleted).not.toHaveBeenCalled();
  });
});
