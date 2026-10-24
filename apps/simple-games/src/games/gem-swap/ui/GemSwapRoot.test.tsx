/**
 * Gem Swap through its screens, the way a player meets it
 * (docs/GEM_SWAP_RULES.md §2, §3, §5–§10): Quick Rules and straight into a
 * round; the tap path (select → deselect → reselect → swap); an invalid swap
 * that changes nothing and says nothing aloud but one line; the swipe, with a
 * cancelled finger and the click a swipe leaves behind; the keyboard; Undo;
 * the end of a round and its card; the ↻; the gem count; the one saved round
 * and the ways it comes back — or, when it is damaged, does not; and the
 * replay of a cascade, skipped by a tap, a background or Reduced Motion.
 *
 * Saves go to Capacitor Preferences, mocked here as `deviceStore`; every
 * launch reads the same store, so what one launch writes is what the next one
 * finds, as on a phone. jsdom has no matchMedia, which useReducedMotion reads
 * as "reduce" — so most tests see the final board at once, and the replay
 * tests install the shared stand-in that answers "no preference".
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sounds } from '@/services/sound';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { stubMatchMedia } from '@/test/lifecycle';
import { RESULT_REVEAL_MS } from '@/ui/useResultReveal';
import {
  createRound,
  indexAt,
  playbackIntervalMs,
  replayRound,
  ROUND_SWAPS,
  trySwap,
  type Round,
} from '../game';
import { GS_STORAGE_KEYS, type PersistedGame, type Stats } from '../storage/schemas';
import { GemSwapRoot } from './GemSwapRoot';
import {
  cascadingRound,
  cell,
  firstValid,
  invalidAdjacent,
  recordOf,
  roundAfter,
  shownBoard,
} from './test-helpers';

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

const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });

let restoreMedia: (() => void) | null = null;
let spies: Record<'select' | 'match' | 'invalid' | 'undo' | 'gameOver' | 'clear', unknown>;

beforeEach(() => {
  spies = {
    select: vi.spyOn(sounds, 'select'),
    match: vi.spyOn(sounds, 'match'),
    invalid: vi.spyOn(sounds, 'invalid'),
    undo: vi.spyOn(sounds, 'undo'),
    gameOver: vi.spyOn(sounds, 'gameOver'),
    clear: vi.spyOn(sounds, 'clear'),
  };
});

afterEach(async () => {
  cleanup();
  // An unmount saves the round in play (GameContext); let it land before the
  // store is wiped, or it would land in the next test's store.
  await settle();
  deviceStore.clear();
  restoreMedia?.();
  restoreMedia = null;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const calls = (name: keyof typeof spies) =>
  (spies[name] as ReturnType<typeof vi.spyOn>).mock.calls.length;

function taughtAlready() {
  deviceStore.set(
    GS_STORAGE_KEYS.flags,
    JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
  );
}

function store(round: Round, elapsedSeconds = 0) {
  deviceStore.set(GS_STORAGE_KEYS.game, JSON.stringify(recordOf(round, elapsedSeconds)));
}

const saved = (): PersistedGame | null => {
  const raw = deviceStore.get(GS_STORAGE_KEYS.game);
  return raw === undefined ? null : (JSON.parse(raw) as PersistedGame);
};

const stats = (): Stats => JSON.parse(deviceStore.get(GS_STORAGE_KEYS.stats) ?? 'null') as Stats;

async function launch(options: { entry?: 'shortcut'; reducedMotion?: boolean } = {}) {
  const onExit = vi.fn();
  const settings = {
    ...settingsSchema.defaultValue(),
    reducedMotion: options.reducedMotion ?? false,
  };
  render(
    <SettingsProvider initialSettings={settings}>
      {options.entry === 'shortcut' ? (
        <GemSwapRoot onExit={onExit} entry="shortcut" />
      ) : (
        <GemSwapRoot onExit={onExit} />
      )}
    </SettingsProvider>,
  );
  await settle();
  return { onExit };
}

/** Straight onto `round`, suspended, the way a home-screen shortcut opens it. */
async function openOn(round: Round, options: { reducedMotion?: boolean } = {}) {
  taughtAlready();
  store(round);
  return launch({ entry: 'shortcut', ...options });
}

/**
 * Moves the faked clock one beat at a time: each beat's timer is set by the
 * effect of the render the previous beat caused, so one long jump would only
 * ever land the first.
 */
function beats(count: number, ms: number) {
  for (let i = 0; i < count; i++) act(() => vi.advanceTimersByTime(ms));
}

const scoreShown = () => Number(document.querySelector('.gs-score-value')?.textContent);
const live = () => document.querySelector('[role="status"]')?.textContent?.trim() ?? '';
const tap = (index: number) => fireEvent.click(cell(index), { detail: 1 });

describe('first launch (§8)', () => {
  it('opens on Quick Rules, and its last step starts a round one tap later', async () => {
    await launch();
    expect(screen.getByRole('heading', { level: 1, name: 'How to Play' })).toBeInTheDocument();
    // Three steps, each a picture with its own words.
    expect(screen.getByRole('img', { name: /three hexagons line up/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('img', { name: /gems above fall/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('img', { name: /18 of its 30 swaps left/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start Playing' }));
    await settle();

    expect(screen.getByRole('group', { name: 'Gem board, 8 by 8' })).toBeInTheDocument();
    expect(document.querySelectorAll('[data-cell]')).toHaveLength(64);
    expect(screen.getByText('30 swaps left')).toBeInTheDocument();
    expect(scoreShown()).toBe(0);
    // Counted when it starts, and saved at once (§5, §7).
    expect(stats().played).toBe(1);
    expect(saved()?.swaps).toEqual([]);
    expect(saved()?.colors).toBe(6);
    expect(JSON.parse(deviceStore.get(GS_STORAGE_KEYS.flags)!).tutorialCompleted).toBe(true);
  });

  it('reads every cell aloud by position and cut, never by colour', async () => {
    const round = createRound('gem-swap-labels', 6);
    await openOn(round);
    const kindNames = ['hexagon', 'octagon', 'drop', 'marquise', 'shield', 'heart'];
    for (const index of [0, 7, 36, 63]) {
      const name = kindNames[round.board[index]!]!;
      const row = Math.floor(index / 8) + 1;
      const col = (index % 8) + 1;
      expect(cell(index)).toHaveAccessibleName(`Row ${row}, column ${col}, ${name}`);
    }
  });
});

describe('the tap path (§3)', () => {
  it('selects, deselects, reselects — and swaps with a neighbour', async () => {
    const round = createRound('gem-swap-tap', 6);
    await openOn(round);
    const [a, b] = firstValid(round);
    const far = a === 0 ? 63 : 0;

    tap(a);
    expect(cell(a)).toHaveAccessibleName(/, selected$/);
    expect(calls('select')).toBe(1);
    tap(a);
    expect(cell(a)).not.toHaveAccessibleName(/selected/);
    tap(a);
    tap(far);
    // Not a neighbour: the selection moves there instead.
    expect(cell(far)).toHaveAccessibleName(/, selected$/);
    expect(cell(a)).not.toHaveAccessibleName(/selected/);
    tap(a);
    tap(b);

    const after = trySwap(round, a, b)!;
    expect(shownBoard()).toEqual([...after.round.board]);
    expect(scoreShown()).toBe(after.move.score);
    expect(screen.getByText('29 swaps left')).toBeInTheDocument();
    expect(live()).toBe(`${after.move.score} cleared · 29 swaps left`);
    // The selection goes with the board it was made on.
    expect(document.querySelector('.gs-cell-selected')).toBeNull();
    // Reduced Motion (jsdom): no replay, one match for the move (§10).
    expect(calls('match')).toBe(1);
    await settle();
    expect(saved()?.swaps).toEqual([[Math.min(a, b), Math.max(a, b)]]);
  });

  it('an invalid swap changes nothing, sounds nothing, and keeps the selection', async () => {
    const round = createRound('gem-swap-invalid', 6);
    await openOn(round);
    const [a, b] = invalidAdjacent(round);
    tap(a);
    const selectSounds = calls('select');
    tap(b);
    expect(shownBoard()).toEqual([...round.board]);
    expect(scoreShown()).toBe(0);
    expect(screen.getByText('30 swaps left')).toBeInTheDocument();
    expect(cell(a)).toHaveAccessibleName(/, selected$/);
    expect(calls('select')).toBe(selectSounds);
    expect(calls('match')).toBe(0);
    expect(calls('invalid')).toBe(0);
    expect(live()).toBe('These two cannot be swapped');
    await settle();
    expect(saved()?.swaps).toEqual([]);
  });
});

describe('the swipe (§3)', () => {
  it('swaps toward a neighbour past 18 px, and spends the click it leaves behind', async () => {
    const round = createRound('gem-swap-swipe', 6);
    await openOn(round);
    const [a, b] = firstValid(round);
    const horizontal = b === a + 1;
    const from = cell(a);
    fireEvent.pointerDown(from, { pointerId: 3, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(from, {
      pointerId: 3,
      clientX: horizontal ? 125 : 100,
      clientY: horizontal ? 100 : 125,
    });
    fireEvent.click(from, { detail: 1 });

    expect(shownBoard()).toEqual([...trySwap(round, a, b)!.round.board]);
    // The trailing click was not a tap: nothing is selected.
    expect(document.querySelector('.gs-cell-selected')).toBeNull();
    expect(calls('select')).toBe(0);
  });

  it('a short drag is a tap: the click that follows selects', async () => {
    const round = createRound('gem-swap-short', 6);
    await openOn(round);
    const target = cell(20);
    fireEvent.pointerDown(target, { pointerId: 1, clientX: 50, clientY: 50 });
    fireEvent.pointerUp(target, { pointerId: 1, clientX: 60, clientY: 52 });
    fireEvent.click(target, { detail: 1 });
    expect(target).toHaveAccessibleName(/, selected$/);
    expect(shownBoard()).toEqual([...round.board]);
  });

  it('a cancelled finger swaps nothing, and another finger cannot finish its swipe', async () => {
    const round = createRound('gem-swap-cancel', 6);
    await openOn(round);
    const [a, b] = firstValid(round);
    const horizontal = b === a + 1;
    const far = { clientX: horizontal ? 140 : 100, clientY: horizontal ? 100 : 140 };
    fireEvent.pointerDown(cell(a), { pointerId: 7, clientX: 100, clientY: 100 });
    fireEvent.pointerCancel(cell(a), { pointerId: 7 });
    fireEvent.pointerUp(cell(a), { pointerId: 7, ...far });
    expect(shownBoard()).toEqual([...round.board]);

    // A different finger's release is not this press's end either.
    fireEvent.pointerDown(cell(a), { pointerId: 8, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(cell(a), { pointerId: 9, ...far });
    expect(shownBoard()).toEqual([...round.board]);
  });

  it('a swipe off the edge of the board does nothing', async () => {
    const round = createRound('gem-swap-edge', 6);
    await openOn(round);
    fireEvent.pointerDown(cell(0), { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(cell(0), { pointerId: 1, clientX: 60, clientY: 100 });
    expect(shownBoard()).toEqual([...round.board]);
    expect(live()).toBe('');
  });
});

describe('the keyboard (§3)', () => {
  it('arrows walk, Enter selects, an arrow while selected swaps, and the focus follows', async () => {
    const round = createRound('gem-swap-keys', 6);
    await openOn(round);
    const [a, b] = firstValid(round);
    // The board opens with the focus on its one tab stop.
    const start = document.activeElement as HTMLElement;
    expect(start.dataset.cell).toBe(String(indexAt(3, 3)));
    fireEvent.keyDown(start, { key: 'ArrowRight' });
    expect((document.activeElement as HTMLElement).dataset.cell).toBe(String(indexAt(3, 4)));

    // Walk to `a`.
    cell(a).focus();
    fireEvent.click(cell(a), { detail: 0 });
    expect(cell(a)).toHaveAccessibleName(/, selected$/);
    const key = b === a + 1 ? 'ArrowRight' : 'ArrowDown';
    fireEvent.keyDown(cell(a), { key });
    expect(shownBoard()).toEqual([...trySwap(round, a, b)!.round.board]);
    expect(document.activeElement).toBe(cell(b));
  });

  it('Escape lets go of the selection; an invalid arrow swap keeps it', async () => {
    const round = createRound('gem-swap-escape', 6);
    await openOn(round);
    const [a, b] = invalidAdjacent(round);
    cell(a).focus();
    fireEvent.click(cell(a), { detail: 0 });
    fireEvent.keyDown(cell(a), { key: b === a + 1 ? 'ArrowRight' : 'ArrowDown' });
    expect(shownBoard()).toEqual([...round.board]);
    expect(cell(a)).toHaveAccessibleName(/, selected$/);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(cell(a)).not.toHaveAccessibleName(/selected/);
  });

  it('stays silent to Escape while the ↻ dialog is open: the dialog takes it', async () => {
    const round = createRound('gem-swap-dialog', 6);
    await openOn(round);
    tap(5);
    fireEvent.click(screen.getByRole('button', { name: 'Retry same board' }));
    expect(screen.getByRole('alertdialog', { name: 'Start over?' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    // That Escape was the dialog's Cancel, not the board's.
    expect(cell(5)).toHaveAccessibleName(/, selected$/);
  });
});

describe('Undo (§6)', () => {
  it('takes a swap back whole, without rerolling: the same swap gives the same board', async () => {
    const round = createRound('gem-swap-undo', 6);
    await openOn(round);
    const [a, b] = firstValid(round);
    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo).toBeDisabled();
    tap(a);
    tap(b);
    const swapped = shownBoard();
    fireEvent.click(undo);
    expect(shownBoard()).toEqual([...round.board]);
    expect(scoreShown()).toBe(0);
    expect(screen.getByText('30 swaps left')).toBeInTheDocument();
    expect(calls('undo')).toBe(1);
    expect(live()).toBe('Swap taken back · 30 swaps left');
    await settle();
    expect(saved()?.swaps).toEqual([]);
    tap(a);
    tap(b);
    expect(shownBoard()).toEqual(swapped);
  });

  it('answers Ctrl+Z as well', async () => {
    const round = roundAfter(3);
    await openOn(round);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(shownBoard()).toEqual([
      ...replayRound({ ...round, swaps: round.swaps.slice(0, 2) })!.board,
    ]);
  });
});

describe('the end of a round (§5, §9)', () => {
  it('30 swaps: a factual card, the best for that gem count, the slot removed', async () => {
    const round = roundAfter(ROUND_SWAPS - 1);
    await openOn(round);
    const [a, b] = firstValid(round);
    tap(a);
    tap(b);
    const final = trySwap(round, a, b)!.round;
    expect(final.endReason).toBe('swaps');

    const card = screen.getByRole('alertdialog', { name: 'Round over' });
    expect(within(card).getByText('All 30 swaps are made.')).toBeInTheDocument();
    expect(within(card).getByText(String(final.score))).toBeInTheDocument();
    expect(within(card).getByText('New best with 6 gems')).toBeInTheDocument();
    // No Undo after the end, and the board behind is out of reach.
    expect(within(card).queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(cell(0).closest('[inert]')).not.toBeNull();
    // Nothing praises, nothing marks the end with a sound of its own (§10).
    expect(card.textContent).not.toMatch(/great|nice|well done|awesome/i);
    expect(calls('gameOver')).toBe(0);
    expect(calls('clear')).toBe(0);
    await settle();
    expect(saved()).toBeNull();
    expect(stats().best6).toBe(final.score);
    expect(stats().best5).toBe(0);
  });

  it('“Retry same board” deals the same opening board; “New board” a fresh one — each counted', async () => {
    const round = roundAfter(ROUND_SWAPS - 1);
    await openOn(round);
    const [a, b] = firstValid(round);
    tap(a);
    tap(b);
    const card = screen.getByRole('alertdialog', { name: 'Round over' });
    // New board first, and it has the focus (§9).
    const buttons = within(card).getAllByRole('button');
    expect(buttons[0]).toHaveTextContent('New board');
    expect(document.activeElement).toBe(buttons[0]);

    fireEvent.click(within(card).getByRole('button', { name: 'Retry same board' }));
    await settle();
    expect(shownBoard()).toEqual([...round.initial]);
    expect(screen.getByText('30 swaps left')).toBeInTheDocument();
    expect(stats().played).toBe(1);
    expect(saved()?.seed).toBe(round.seed);

    fireEvent.click(screen.getByRole('button', { name: 'Retry same board' }));
    fireEvent.click(screen.getByRole('button', { name: 'New board' }));
    await settle();
    expect(saved()?.seed).not.toBe(round.seed);
    expect(saved()?.swaps).toEqual([]);
    expect(stats().played).toBe(2);
  });

  it('waits the shared beat after the last move before the card covers the board', async () => {
    restoreMedia = stubMatchMedia();
    const round = roundAfter(ROUND_SWAPS - 1);
    vi.useFakeTimers();
    await openOn(round, { reducedMotion: false });
    const [a, b] = firstValid(round);
    tap(a);
    tap(b);
    const outcome = trySwap(round, a, b)!;
    const beat = playbackIntervalMs(outcome.move.stages.length)!;
    expect(screen.queryByRole('alertdialog')).toBeNull();
    beats(outcome.move.stages.length + 1, beat);
    expect(document.querySelector('.gs-board-replaying')).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    act(() => vi.advanceTimersByTime(RESULT_REVEAL_MS));
    expect(screen.getByRole('alertdialog', { name: 'Round over' })).toBeInTheDocument();
  });
});

describe('the ↻ (§9)', () => {
  it('offers the same board again and a new board, like the card — and Cancel keeps the round', async () => {
    const round = roundAfter(4);
    await openOn(round);
    fireEvent.click(screen.getByRole('button', { name: 'Retry same board' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Start over?' });
    expect(within(dialog).getByRole('button', { name: 'New board' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(shownBoard()).toEqual([...round.board]);

    fireEvent.click(screen.getByRole('button', { name: 'Retry same board' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Retry same board' }),
    );
    await settle();
    expect(shownBoard()).toEqual([...round.initial]);
    expect(saved()?.swaps).toEqual([]);
    // The round left behind is not a best; the new one is a round played.
    expect(stats().best6).toBe(0);
    expect(stats().played).toBe(1);
  });
});

describe('home, the gem count and the saved round (§2, §7)', () => {
  it('offers the suspended round back with its score and gem count, and resumes it as it was', async () => {
    const round = roundAfter(6, 5);
    taughtAlready();
    store(round, 40);
    await launch();
    const resume = screen.getByRole('button', { name: /^Resume/ });
    expect(resume).toHaveTextContent(`Score ${round.score} · 5 gems`);
    fireEvent.click(resume);
    expect(shownBoard()).toEqual([...round.board]);
    expect(screen.getByText('24 swaps left')).toBeInTheDocument();
    // Undo reaches back past the resume: the swap list is the history (§6).
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });

  it('a new game over a suspended round asks first', async () => {
    const round = roundAfter(2);
    taughtAlready();
    store(round);
    await launch();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await settle();
    expect(saved()?.seed).toBe(round.seed);
  });

  it('remembers the gem count and applies it from the next round only', async () => {
    taughtAlready();
    await launch();
    const five = screen.getByRole('button', { name: '5 · Easy' });
    expect(screen.getByRole('button', { name: '6 · Normal' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(five);
    expect(five).toHaveAttribute('aria-pressed', 'true');
    await settle();
    expect(JSON.parse(deviceStore.get(GS_STORAGE_KEYS.prefs)!)).toEqual({
      schemaVersion: 1,
      colors: 5,
    });
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    await settle();
    expect(saved()?.colors).toBe(5);
    expect(shownBoard().every((kind) => kind >= 0 && kind < 5)).toBe(true);
  });

  it('shows the three numbers the statistics keep', async () => {
    taughtAlready();
    deviceStore.set(
      GS_STORAGE_KEYS.stats,
      JSON.stringify({ schemaVersion: 1, played: 7, best5: 0, best6: 211, totalPlaySeconds: 90 }),
    );
    await launch();
    const list = document.querySelector('.gs-home-stats')!;
    expect(list.textContent).toContain('Games played7');
    expect(list.textContent).toContain('Best, 5 gems—');
    expect(list.textContent).toContain('Best, 6 gems211');
  });

  it('a damaged save is refused: the home, nothing to resume, nothing started', async () => {
    taughtAlready();
    const round = roundAfter(2);
    const record = recordOf(round);
    deviceStore.set(
      GS_STORAGE_KEYS.game,
      JSON.stringify({ ...record, swaps: [...record.swaps, [0, 9]] }),
    );
    await launch({ entry: 'shortcut' });
    expect(screen.getByRole('heading', { level: 1, name: 'Gem Swap' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Resume/ })).toBeNull();
    expect(stats()).toBeNull();
    // Never repaired and never deleted by reading: the next write replaces it.
    expect(deviceStore.get(GS_STORAGE_KEYS.game)).toBeDefined();
  });

  it('a shortcut opens straight onto the suspended round; the collection opens the home', async () => {
    const round = roundAfter(3);
    await openOn(round);
    expect(shownBoard()).toEqual([...round.board]);
    cleanup();
    await settle();
    await launch();
    expect(screen.getByRole('button', { name: /^Resume/ })).toBeInTheDocument();
  });

  it('saves on a background and books the seconds once', async () => {
    vi.useFakeTimers();
    const round = roundAfter(2);
    taughtAlready();
    store(round, 10);
    deviceStore.set(
      GS_STORAGE_KEYS.stats,
      JSON.stringify({ schemaVersion: 1, played: 1, best5: 0, best6: 0, totalPlaySeconds: 10 }),
    );
    await launch({ entry: 'shortcut' });
    act(() => vi.advanceTimersByTime(5_000));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Reflect.deleteProperty(document, 'visibilityState');
    await settle();
    expect(saved()?.elapsedSeconds).toBe(15);
    expect(stats().totalPlaySeconds).toBe(15);
    // Leaving now adds nothing more: the seconds are already booked.
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    expect(stats().totalPlaySeconds).toBe(15);
  });
});

describe('the cascade replay (§10)', () => {
  it('replays the move beat by beat, one match per stage, and settles on the final board', async () => {
    restoreMedia = stubMatchMedia();
    const { round, swap, stages } = cascadingRound(2);
    vi.useFakeTimers();
    await openOn(round, { reducedMotion: false });
    const [a, b] = swap;
    const outcome = trySwap(round, a, b)!;
    const beat = playbackIntervalMs(stages)!;
    tap(a);
    tap(b);
    // The first beat: the exchange, with the first stage's gems clearing.
    expect(shownBoard()).toEqual([...outcome.move.swapped]);
    expect(document.querySelectorAll('.gs-slot-clearing').length).toBe(
      outcome.move.stages[0]!.cleared.length,
    );
    expect(calls('match')).toBe(1);
    // The state is final already: the score and the bar do not wait.
    expect(scoreShown()).toBe(outcome.move.score);
    beats(1, beat);
    expect(shownBoard()).toEqual([...outcome.move.stages[0]!.board]);
    expect(calls('match')).toBe(2);
    beats(stages, beat);
    expect(shownBoard()).toEqual([...outcome.round.board]);
    expect(document.querySelector('.gs-board-replaying')).toBeNull();
    expect(calls('match')).toBe(stages);
    expect(vi.getTimerCount()).toBe(1); // the play clock, and nothing else
  });

  it('a tap during the replay only skips to the final board — no selection, no more sounds', async () => {
    restoreMedia = stubMatchMedia();
    const { round, swap } = cascadingRound(2);
    vi.useFakeTimers();
    await openOn(round, { reducedMotion: false });
    const [a, b] = swap;
    tap(a);
    tap(b);
    const target = cell(40);
    fireEvent.pointerDown(target, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(target, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.click(target, { detail: 1 });
    expect(shownBoard()).toEqual([...trySwap(round, a, b)!.round.board]);
    expect(document.querySelector('.gs-cell-selected')).toBeNull();
    beats(10, 200);
    expect(calls('match')).toBe(1);
  });

  it('a background ends the replay on the final board, and coming back resumes nothing', async () => {
    restoreMedia = stubMatchMedia();
    const { round, swap } = cascadingRound(2);
    vi.useFakeTimers();
    await openOn(round, { reducedMotion: false });
    tap(swap[0]);
    tap(swap[1]);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Reflect.deleteProperty(document, 'visibilityState');
    expect(shownBoard()).toEqual([...trySwap(round, swap[0], swap[1])!.round.board]);
    expect(document.querySelector('.gs-board-replaying')).toBeNull();
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(document.querySelector('.gs-board-replaying')).toBeNull();
  });

  it('under the app’s Reduced Motion draws the final board at once, with one sound', async () => {
    restoreMedia = stubMatchMedia();
    const { round, swap } = cascadingRound(2);
    await openOn(round, { reducedMotion: true });
    tap(swap[0]);
    tap(swap[1]);
    expect(shownBoard()).toEqual([...trySwap(round, swap[0], swap[1])!.round.board]);
    expect(document.querySelector('.gs-board-replaying')).toBeNull();
    expect(calls('match')).toBe(1);
  });
});

describe('leaving by the browser’s Back (docs/GAME_LIFECYCLE.md「アンマウントで計上する」)', () => {
  // Back in the browser — like a home-screen shortcut to another game — takes
  // the game off screen by unmounting its Root: no goHome, no
  // exitToCollection, no visibilitychange. The provider's own unmount sync
  // (`useOnUnmount(syncActiveGame)`) saves the round and books what is left.
  it('books the seconds played since the last sync, once, and not again on remount', async () => {
    vi.useFakeTimers();
    try {
      const round = roundAfter(2);
      await openOn(round);

      // A background books the first five, as it always has.
      act(() => vi.advanceTimersByTime(5_000));
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      Reflect.deleteProperty(document, 'visibilityState');
      await settle();
      expect(stats().totalPlaySeconds).toBe(5);
      expect(saved()?.elapsedSeconds).toBe(5);

      // Three more, then Back: the Root is simply unmounted.
      act(() => vi.advanceTimersByTime(3_000));
      cleanup();
      await settle();
      expect(stats().totalPlaySeconds).toBe(8);
      expect(saved()?.elapsedSeconds).toBe(8);
      // The round itself is kept as it was, to be resumed.
      expect(saved()?.swaps).toEqual(recordOf(round).swaps);

      // Forward again onto the same round, and away again at once: the round
      // still says eight, and none of the eight is booked a second time.
      await launch({ entry: 'shortcut' });
      expect(shownBoard()).toEqual([...round.board]);
      cleanup();
      await settle();
      expect(stats().totalPlaySeconds).toBe(8);
      expect(saved()?.elapsedSeconds).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });
});
