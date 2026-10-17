/**
 * Bridges, mounted the way the shell mounts it (docs/BRIDGES_RULES.md): the
 * first run through Quick Rules, the select-then-tap cycle and everything
 * around it — undo, hint, retry, the win — and what survives leaving, a
 * relaunch, a corrupt save, the background and a home-screen shortcut.
 *
 * Boards here are real generated ones. Today's daily is the usual stand-in:
 * the test builds the same session from the same date, so it knows the
 * answer and every island's place without reading the screen for it.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sounds } from '@/services/sound';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import {
  candidatesFor,
  colOf,
  componentCount,
  createDailySession,
  createDifficultySession,
  doConnect,
  hintFor,
  localDateString,
  rowOf,
  type BridgesSession,
} from '../game';
import { toPersisted } from '../storage/gamePersistence';
import { BG_STORAGE_KEYS, type Stats } from '../storage/schemas';
import { RESULT_ARM_MS } from './components/BridgesResultOverlay';
import { BridgesRoot } from './BridgesRoot';

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

/**
 * The hint, passed straight through to the real one — a test that needs the
 * "nothing found" answer (§9, step 3), which no shipped board gives within
 * the work limit, asks for it once.
 */
vi.mock('../game', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../game')>();
  return { ...actual, hintFor: vi.fn(actual.hintFor) };
});

const tutorialDone = {
  [BG_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

function renderGame(initial: Record<string, string> = {}) {
  const onExit = vi.fn();
  const kv = createMemoryKV(initial);
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <BridgesRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

/** Launches the app against the device store, the way a player's phone does. */
function launch(entry?: 'shortcut') {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      {entry === 'shortcut' ? (
        <BridgesRoot onExit={onExit} entry="shortcut" />
      ) : (
        <BridgesRoot onExit={onExit} />
      )}
    </SettingsProvider>,
  );
  return onExit;
}

/** Lets the local reads and the saves they trigger resolve. */
const settle = () => act(async () => undefined);

/** The app goes to background. Android may kill it without another event. */
function background() {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  Reflect.deleteProperty(document, 'visibilityState');
}

const board = () => screen.getByRole('group', { name: /^Bridges board/ });
const islands = () => within(board()).getAllByRole('button');
const island = (ordinal: number) => islands()[ordinal]!;
const today = () => localDateString(new Date());

/** Clears the selection, the way a tap on the water does. */
const escape = () => fireEvent.keyDown(window, { key: 'Escape' });

/** One pair, select-then-tap, `times` taps on the partner. */
async function tapPair(
  user: ReturnType<typeof userEvent.setup>,
  a: number,
  b: number,
  times = 1,
): Promise<void> {
  escape();
  await user.click(island(a));
  for (let tap = 0; tap < times; tap++) await user.click(island(b));
}

/**
 * Builds the whole answer by taps — plain clicks, as a finger's tap ends, so
 * a board of twenty pairs does not spend the test's time on pointer sequences
 * the other tests already cover.
 */
function solveByTapping(truth: BridgesSession) {
  for (const edge of truth.graph.edges) {
    const count = truth.solution[edge.id]!;
    if (count === 0) continue;
    escape();
    fireEvent.click(island(edge.a), { detail: 1 });
    for (let tap = 0; tap < count; tap++) fireEvent.click(island(edge.b), { detail: 1 });
  }
}

/** An island's place as the spoken names give it: "row r, column c". */
const placeOf = (session: BridgesSession, ordinal: number) => {
  const index = session.islands[ordinal]!.index;
  return `row ${rowOf(index, session.width) + 1}, column ${colOf(index, session.width) + 1}`;
};

/** The hidden line that says what the last bridge step (or undo) did. */
const spoken = () =>
  document.querySelector('.game-screen p.visually-hidden[aria-live="polite"]')!.textContent;

/** The play count kept for one bucket, as it survives on disk. */
const storedPlays = (bucket: 'easy' | 'medium' | 'hard' | 'daily') =>
  (JSON.parse(deviceStore.get(BG_STORAGE_KEYS.stats) ?? 'null') as Stats | null)?.[bucket].played ??
  0;

/** A pretend cell for drags, in CSS pixels — jsdom lays nothing out on its own. */
const DRAG_CELL_PX = 40;

/**
 * Gives the board's field the rectangle a drag measures itself against, and
 * answers where each island's centre is on it.
 */
function giveTheFieldALayout(session: BridgesSession) {
  const field = board().querySelector('.bg-field') as HTMLElement;
  const width = DRAG_CELL_PX * session.width;
  const height = DRAG_CELL_PX * session.height;
  vi.spyOn(field, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width,
    height,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
  return (ordinal: number) => {
    const index = session.islands[ordinal]!.index;
    return {
      clientX: DRAG_CELL_PX * ((index % session.width) + 0.5),
      clientY: DRAG_CELL_PX * (Math.floor(index / session.width) + 0.5),
    };
  };
}

/**
 * A finger pressed on one island, slid to a point and lifted (§4), with the
 * click a browser may still send to the island it began on.
 */
function touchDrag(from: HTMLElement, path: readonly { clientX: number; clientY: number }[]) {
  const touch = { pointerId: 7, pointerType: 'touch', isPrimary: true };
  fireEvent.pointerDown(from, { button: 0, ...touch, ...path[0]! });
  for (const point of path.slice(1)) fireEvent.pointerMove(from, { ...touch, ...point });
  fireEvent.pointerUp(from, { ...touch, ...path[path.length - 1]! });
  fireEvent.click(from, { detail: 1 });
}

/** A pair the answer joins with one bridge (or two) — always a partner on an empty board. */
const answerPair = (truth: BridgesSession) =>
  truth.graph.edges.find((e) => truth.solution[e.id]! > 0)!;

/** Total play seconds as they survive on disk, across every bucket. */
function storedPlaySeconds(): number {
  const raw = deviceStore.get(BG_STORAGE_KEYS.stats);
  if (raw === undefined) return 0;
  const stats = JSON.parse(raw) as Stats;
  return (
    stats.easy.totalPlaySeconds +
    stats.medium.totalPlaySeconds +
    stats.hard.totalPlaySeconds +
    stats.daily.totalPlaySeconds
  );
}

async function openDaily(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Daily Challenge/ }));
}

afterEach(() => {
  cleanup();
  deviceStore.clear();
  vi.restoreAllMocks();
});

describe('first run (§12)', () => {
  it('shows three Quick Rules steps and starts an easy board right after', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Numbers are bridges')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Straight, two at most')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Join them all')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(board()).toHaveAccessibleName(/^Bridges board, 7 by 7/);
    await settle();
    expect(JSON.parse(deviceStore.get(BG_STORAGE_KEYS.flags)!).tutorialCompleted).toBe(true);
  });
});

describe('Quick Rules shown again over a suspended board (§10, §12)', () => {
  it('resumes that board on Start Playing, rather than replace it unasked', async () => {
    const user = userEvent.setup();
    // The flags record is gone (and the remembered difficulty with it, so the
    // first-run board would be Easy); a Medium board is suspended.
    const session = createDifficultySession('medium', 'bridges-medium-flags-lost');
    const { a, b } = answerPair(session);
    const played = doConnect(session, a, b)!;
    renderGame({ [BG_STORAGE_KEYS.game]: JSON.stringify(toPersisted(played, 1)) });

    expect(await screen.findByText('Numbers are bridges')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    expect(board()).toHaveAccessibleName(/^Bridges board, 9 by 9/);
    await user.click(island(a));
    expect(island(b)).toHaveAccessibleName(/1 of 2 bridges$/);
    await settle();
    // Resumed, not started: no play counted, and no new board written over the slot.
    expect(islands()).toHaveLength(session.islands.length);
    expect(storedPlays('easy') + storedPlays('medium')).toBe(0);
    expect(deviceStore.get(BG_STORAGE_KEYS.game)).toBeUndefined();
  });
});

describe('select, then tap (§4)', () => {
  it('cycles a pair 0 → 1 → 2 → 0, keeping the first island selected', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    const truth = createDailySession(today());
    await openDaily(user);
    const { a, b } = answerPair(truth);

    await user.click(island(a));
    expect(island(a)).toHaveAccessibleName(/Selected$/);
    expect(island(b)).toHaveAccessibleName(/Can link to the selected island: 0 of 2 bridges$/);
    for (const count of [1, 2, 0]) {
      await user.click(island(b));
      expect(island(b)).toHaveAccessibleName(
        new RegExp(`Can link to the selected island: ${count} of 2 bridges$`),
      );
      expect(island(a)).toHaveAccessibleName(/Selected$/);
    }
    // The step is spoken, not shown: a polite note, never a toast.
    expect(screen.getByText(/^No bridge between row \d+, column \d+ and row/)).toBeInTheDocument();
  });

  it('rings exactly the islands the selected one can join', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    const truth = createDailySession(today());
    await openDaily(user);
    const { a } = answerPair(truth);

    await user.click(island(a));
    const partners = new Set(candidatesFor(truth, a).map((c) => c.island));
    expect(partners.size).toBeGreaterThan(0);
    islands().forEach((button, ordinal) => {
      expect(button.classList.contains('bg-island-partner'), `island ${ordinal}`).toBe(
        partners.has(ordinal),
      );
    });
  });

  it('moves the selection to an island it cannot join, building nothing', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    const truth = createDailySession(today());
    await openDaily(user);
    const { a } = answerPair(truth);
    const partners = new Set(candidatesFor(truth, a).map((c) => c.island));
    const stranger = truth.islands.findIndex((_, o) => o !== a && !partners.has(o));
    const before = islands().map((button) => button.className);

    await user.click(island(a));
    await user.click(island(stranger));
    expect(island(stranger)).toHaveAccessibleName(/Selected$/);
    expect(island(a)).not.toHaveAccessibleName(/Selected$/);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    // Nothing was built: the island states are the empty board's.
    escape();
    expect(islands().map((button) => button.className)).toEqual(before);
  });

  it('clears the selection on a second tap of the same island, and on Escape', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    const truth = createDailySession(today());
    await openDaily(user);
    const { a } = answerPair(truth);
    await user.click(island(a));
    await user.click(island(a));
    expect(island(a)).not.toHaveAccessibleName(/Selected$/);
    await user.click(island(a));
    escape();
    expect(island(a)).not.toHaveAccessibleName(/Selected$/);
  });

  it('plays by keyboard: an arrow brings the focus in, Enter taps, arrows walk', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    const truth = createDailySession(today());
    await openDaily(user);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(island(0)).toHaveFocus();
    // Island 0's first partner, whichever way it lies.
    const partner = candidatesFor(truth, 0)[0]!;
    const edge = truth.graph.edges[partner.edge]!;
    const direction = edge.horizontal ? 'ArrowRight' : 'ArrowDown';
    await user.keyboard('{Enter}');
    expect(island(0)).toHaveAccessibleName(/Selected$/);
    fireEvent.keyDown(island(0), { key: direction });
    expect(island(partner.island)).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(island(partner.island)).toHaveAccessibleName(/1 of 2 bridges$/);
  });
});

describe('a drag by touch (§4)', () => {
  it('slid from an island onto a partner builds a bridge, and leaves the first selected', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    const truth = createDailySession(today());
    await openDaily(user);
    const { id, a, b } = answerPair(truth);
    const at = giveTheFieldALayout(truth);
    const seen: string[] = [];
    board().addEventListener('pointerdown', (event) => seen.push(event.pointerType));

    touchDrag(island(a), [at(a), at(b)]);
    expect(seen).toEqual(['touch']);
    expect(island(b)).toHaveAccessibleName(/Can link to the selected island: 1 of 2 bridges$/);
    expect(island(a)).toHaveAccessibleName(/Selected$/);
    expect(spoken()).toBe(`One bridge between ${placeOf(truth, a)} and ${placeOf(truth, b)}`);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
    await settle();
    expect(JSON.parse(deviceStore.get(BG_STORAGE_KEYS.dailyGame)!).bridges[id]).toBe('1');

    // A second drag on the same pair is the next step of the cycle, as a tap is.
    touchDrag(island(a), [at(a), at(b)]);
    expect(island(b)).toHaveAccessibleName(/Can link to the selected island: 2 of 2 bridges$/);
  });

  it('let go on an island it cannot join, or on the water, builds nothing', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    const truth = createDailySession(today());
    await openDaily(user);
    const { a } = answerPair(truth);
    const partners = new Set(candidatesFor(truth, a).map((c) => c.island));
    const stranger = truth.islands.findIndex((_, o) => o !== a && !partners.has(o));
    const at = giveTheFieldALayout(truth);
    const before = islands().map((button) => button.className);

    touchDrag(island(a), [at(a), at(stranger)]);
    // Halfway between two cells holds no island's circle: open water.
    const water = {
      clientX: at(a).clientX + DRAG_CELL_PX / 2,
      clientY: at(a).clientY + DRAG_CELL_PX / 2,
    };
    touchDrag(island(a), [at(a), water]);

    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(islands().map((button) => button.className)).toEqual(before);
    expect(spoken()).toBe('');
    await settle();
    expect(JSON.parse(deviceStore.get(BG_STORAGE_KEYS.dailyGame)!).bridges).toMatch(/^0+$/);
  });
});

describe('undo (§9)', () => {
  it('takes back one step at a time, by button and by Ctrl+Z', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    const truth = createDailySession(today());
    await openDaily(user);
    const { a, b } = answerPair(truth);
    const undo = () => screen.getByRole('button', { name: 'Undo' });
    expect(undo()).toBeDisabled();

    await tapPair(user, a, b, 2);
    expect(island(b)).toHaveAccessibleName(/2 of 2 bridges$/);
    const between = `between ${placeOf(truth, a)} and ${placeOf(truth, b)}`;
    expect(spoken()).toBe(`Two bridges ${between}`);
    await user.click(undo());
    // Undo moves the board, not the selection: the pair is still in view.
    expect(island(b)).toHaveAccessibleName(/1 of 2 bridges$/);
    // And it is heard, as every change to the board is.
    expect(spoken()).toBe(`One bridge ${between}`);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(island(b)).toHaveAccessibleName(/0 of 2 bridges$/);
    expect(spoken()).toBe(`No bridge ${between}`);
    expect(undo()).toBeDisabled();
  });

  it('hears two steps landing in one task as the two steps they were', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    const truth = createDailySession(today());
    await openDaily(user);
    const { a, b } = answerPair(truth);
    await tapPair(user, a, b, 2);
    const select = vi.spyOn(sounds, 'select');
    const back = vi.spyOn(sounds, 'undo');
    // Two taps in one task: 2 → 0, then 0 → 1. The second must be heard as a
    // bridge added, measured against the first's result, not this render's.
    act(() => {
      fireEvent.click(island(b), { detail: 1 });
      fireEvent.click(island(b), { detail: 1 });
    });
    expect(island(b)).toHaveAccessibleName(/1 of 2 bridges$/);
    expect(back).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledTimes(1);
    expect(spoken()).toBe(`One bridge between ${placeOf(truth, a)} and ${placeOf(truth, b)}`);
  });

  it('ignores a held Ctrl+Z’s repeats: one press, one step back', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    const truth = createDailySession(today());
    await openDaily(user);
    const { a, b } = answerPair(truth);
    await tapPair(user, a, b, 2);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, repeat: true });
    fireEvent.keyDown(window, { key: 'z', metaKey: true, repeat: true });
    expect(island(b)).toHaveAccessibleName(/2 of 2 bridges$/);
    fireEvent.keyDown(window, { key: 'z', metaKey: true });
    expect(island(b)).toHaveAccessibleName(/1 of 2 bridges$/);
  });
});

describe('hints (§9)', () => {
  it('names a pair the board proves, in marks and in words, and writes nothing', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    const truth = createDailySession(today());
    await openDaily(user);
    const before = islands().map((button) => button.getAttribute('aria-label')!);

    await user.click(screen.getByRole('button', { name: 'Hint' }));
    const note = screen.getByRole('status');
    expect(note).toHaveTextContent(/highlighted pair needs/);
    const marked = islands().flatMap((button, ordinal) =>
      button.classList.contains('bg-island-hint') ? [ordinal] : [],
    );
    expect(marked).toHaveLength(2);
    const ring = islands().findIndex((button) => button.classList.contains('bg-island-reason'));
    // The marked islands say so in their names; every other name is as it was.
    islands().forEach((button, ordinal) => {
      const label = button.getAttribute('aria-label');
      if (ordinal === ring) {
        expect(label).toBe(`${before[ordinal]}. Highlighted by the hint, in the dotted ring`);
      } else if (marked.includes(ordinal)) {
        expect(label).toBe(`${before[ordinal]}. Highlighted by the hint`);
      } else {
        expect(label).toBe(before[ordinal]);
      }
    });
    // The line under the board says where, for a screen reader: the pair,
    // and the ring when there is one.
    const where = `Highlighted: ${placeOf(truth, marked[0]!)} and ${placeOf(truth, marked[1]!)}.`;
    expect(note).toHaveTextContent(
      ring === -1 ? where : `${where} Dotted ring: ${placeOf(truth, ring)}.`,
    );
    // Nothing was written: no step to take back, no bridge in the save.
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    await settle();
    expect(JSON.parse(deviceStore.get(BG_STORAGE_KEYS.dailyGame)!).bridges).toMatch(/^0+$/);
  });

  it('H asks for the hint, same as the button (issue #93), and a held H asks once', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await openDaily(user);
    fireEvent.keyDown(window, { key: 'h', repeat: true });
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    fireEvent.keyDown(window, { key: 'h' });
    fireEvent.keyDown(window, { key: 'h', repeat: true });
    fireEvent.keyDown(window, { key: 'H', repeat: true });
    expect(screen.getByRole('status')).toHaveTextContent(/highlighted pair needs/);
    await settle();
    expect(JSON.parse(deviceStore.get(BG_STORAGE_KEYS.dailyGame)!).hintCount).toBe(1);
  });

  it('says so when it finds no certain step, marks nothing and counts nothing (§9)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await openDaily(user);
    vi.mocked(hintFor).mockReturnValueOnce(null);
    await user.click(screen.getByRole('button', { name: 'Hint' }));
    expect(screen.getByRole('status')).toHaveTextContent(/^No certain step found from here\.$/);
    expect(board().querySelectorAll('.bg-island-hint, .bg-island-wrong')).toHaveLength(0);
    expect(board().querySelector('.bg-hint-band')).toBeNull();
    expect(islands().some((button) => /hint/i.test(button.getAttribute('aria-label')!))).toBe(
      false,
    );
    await settle();
    expect(JSON.parse(deviceStore.get(BG_STORAGE_KEYS.dailyGame)!).hintCount).toBe(0);
  });

  it('points at a pair over the answer before anything else', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    const truth = createDailySession(today());
    await openDaily(user);
    // A pair the answer leaves empty, open on an empty board.
    const extra = truth.graph.edges.find(
      (edge) => truth.solution[edge.id] === 0 && truth.graph.crossings[edge.id]!.length === 0,
    )!;
    await tapPair(user, extra.a, extra.b);
    await user.click(screen.getByRole('button', { name: 'Hint' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Too many bridges between the highlighted islands.',
    );
    expect(island(extra.a)).toHaveClass('bg-island-wrong');
    expect(island(extra.b)).toHaveClass('bg-island-wrong');
    expect(island(extra.a)).toHaveAccessibleName(/Highlighted by the hint$/);
    expect(island(extra.b)).toHaveAccessibleName(/Highlighted by the hint$/);
    expect(screen.getByRole('status')).toHaveTextContent(
      `Highlighted: ${placeOf(truth, extra.a)} and ${placeOf(truth, extra.b)}.`,
    );
    // The hint cleared the selection so its marks stand alone; selecting is
    // not a move, and the words stay. The next move takes both away.
    await user.click(island(extra.a));
    expect(screen.getByRole('status')).toHaveTextContent(/Too many bridges/);
    await user.click(island(extra.b));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(island(extra.a)).not.toHaveClass('bg-island-wrong');
  });

  it('counts the hints it gave, for the result screen only', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await openDaily(user);
    await user.click(screen.getByRole('button', { name: 'Hint' }));
    await user.click(screen.getByRole('button', { name: 'Hint' }));
    await settle();
    expect(JSON.parse(deviceStore.get(BG_STORAGE_KEYS.dailyGame)!).hintCount).toBe(2);
  });
});

describe('the win (§3)', () => {
  it('solves the daily by its answer, says so once, and offers no other board', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    const truth = createDailySession(today());
    await openDaily(user);
    solveByTapping(truth);

    const dialog = await screen.findByRole('alertdialog', { name: 'All connected!' });
    expect(within(dialog).getByText('Hints used')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Retry same board' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'New board' })).not.toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    await settle();
    // The finished game is not saved for resuming, and the day is recorded.
    expect(deviceStore.get(BG_STORAGE_KEYS.dailyGame)).toBeUndefined();
    const stats = JSON.parse(deviceStore.get(BG_STORAGE_KEYS.stats)!) as Stats;
    expect(Object.keys(stats.dailyTimes)).toEqual([today()]);
  });

  it('keeps the card up through a quick second tap and a held Enter meant for the board (§13)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    const truth = createDailySession(today());
    await openDaily(user);
    // Every bridge but the last by taps; the last by Enter on the partner.
    const edges = truth.graph.edges.filter((edge) => truth.solution[edge.id]! > 0);
    const last = edges[edges.length - 1]!;
    for (const edge of edges) {
      const count = truth.solution[edge.id]!;
      escape();
      fireEvent.click(island(edge.a), { detail: 1 });
      const taps = edge === last ? count - 1 : count;
      for (let tap = 0; tap < taps; tap++) fireEvent.click(island(edge.b), { detail: 1 });
    }
    island(last.b).focus();
    await user.keyboard('{Enter}');

    const card = screen.getByRole('alertdialog', { name: 'All connected!' });
    const retry = within(card).getByRole('button', { name: 'Retry same board' });
    expect(retry).toHaveFocus();
    // That Enter held down: its repeats land on Retry, and none presses it.
    // (`fireEvent` answers false when the default — the button's click — was stopped.)
    expect(fireEvent.keyDown(retry, { key: 'Enter', repeat: true })).toBe(false);
    // A second Enter, or a second tap, on the card's first beat was meant for the board.
    await user.keyboard('{Enter}');
    fireEvent.click(within(card).getByRole('button', { name: 'Home' }), { detail: 1 });
    await settle();
    expect(screen.getByRole('alertdialog', { name: 'All connected!' })).toBeInTheDocument();
    expect(storedPlays('daily')).toBe(1);
    expect(
      Object.keys((JSON.parse(deviceStore.get(BG_STORAGE_KEYS.stats)!) as Stats).dailyTimes),
    ).toEqual([today()]);

    // Once it is up a moment, the card answers as any card does — but a held
    // key's repeats still press nothing.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, RESULT_ARM_MS + 50));
    });
    expect(fireEvent.keyDown(retry, { key: 'Enter', repeat: true })).toBe(false);
    await user.click(retry);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await settle();
    expect(storedPlays('daily')).toBe(2);
  });

  it('answers no key while the card is up: the board behind it is finished', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    const truth = createDailySession(today());
    await openDaily(user);
    solveByTapping(truth);
    await screen.findByRole('alertdialog', { name: 'All connected!' });
    fireEvent.keyDown(window, { key: 'h' });
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    // The line under the board: the card has a status line of its own.
    expect(document.querySelector('.bg-note')).toBeEmptyDOMElement();
    expect(islands().some((button) => button === document.activeElement)).toBe(false);
    expect(islands().every((button) => button.classList.contains('bg-island-complete'))).toBe(true);
  });

  it('is not won while the islands are apart, however every number reads', async () => {
    const user = userEvent.setup();
    // A medium board with an assignment that meets every number in two groups.
    const session = createDifficultySession('medium', 'bridges-medium-split-0');
    const split = splitAssignment(session);
    expect(split).not.toBeNull();
    const record = toPersisted({ ...session, bridges: split! }, 1);
    renderGame({ ...tutorialDone, [BG_STORAGE_KEYS.game]: JSON.stringify(record) });
    await user.click(await screen.findByRole('button', { name: /^Medium.*Resume/ }));

    expect(islands().every((button) => button.classList.contains('bg-island-complete'))).toBe(true);
    expect(screen.getByRole('status')).toHaveTextContent(
      /Every number is met, but the islands form \d+ groups/,
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

describe('retry, new board and the home (§8, §10)', () => {
  it('rebuilds the same board on retry, after asking', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    const truth = createDailySession(today());
    await openDaily(user);
    const { a, b } = answerPair(truth);
    await tapPair(user, a, b);

    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Start over?' });
    // The daily has one board: the dialog offers no other.
    expect(within(dialog).queryByRole('button', { name: 'New board' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Retry same board' }));
    expect(island(b)).toHaveAccessibleName(/0 of \d bridges$/);
    expect(islands()).toHaveLength(truth.islands.length);
  });

  it('answers no key while the ↻ dialog is open', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    const truth = createDailySession(today());
    await openDaily(user);
    const { a, b } = answerPair(truth);
    await tapPair(user, a, b);
    escape();
    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    expect(screen.getByRole('alertdialog', { name: 'Start over?' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'h' });
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(islands().some((button) => button === document.activeElement)).toBe(false);
    expect(island(b)).toHaveAccessibleName(/1 of \d bridges$/);
    await settle();
    expect(JSON.parse(deviceStore.get(BG_STORAGE_KEYS.dailyGame)!).hintCount).toBe(0);
  });

  it('counts a new board and a retry as plays, and a resume as none (§11)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /^Easy/ }));
    await settle();
    expect(storedPlays('easy')).toBe(1);
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: /^Easy.*Resume/ }));
    await settle();
    expect(storedPlays('easy')).toBe(1);
    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    await user.click(
      within(screen.getByRole('alertdialog', { name: 'Start over?' })).getByRole('button', {
        name: 'Retry same board',
      }),
    );
    await settle();
    expect(storedPlays('easy')).toBe(2);
  });

  it('asks before replacing a suspended difficulty game with another difficulty', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /^Easy/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByRole('button', { name: /Easy.*Resume/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Medium/ }));
    expect(
      screen.getByRole('alertdialog', { name: 'Replace the board in progress?' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: /Easy.*Resume/ })).toBeInTheDocument();
  });

  it('keeps the daily and the difficulty game in their own slots', async () => {
    const user = userEvent.setup();
    deviceStore.set(BG_STORAGE_KEYS.flags, tutorialDone[BG_STORAGE_KEYS.flags]!);
    launch();
    await settle();
    const truth = createDailySession(today());
    const { a, b } = answerPair(truth);

    await user.click(await screen.findByRole('button', { name: /^Hard/ }));
    expect(board()).toHaveAccessibleName(/10 by 10/);
    const hardLabels = islands().map((button) => button.getAttribute('aria-label'));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await openDaily(user);
    await tapPair(user, a, b);
    escape();
    const dailyLabels = islands().map((button) => button.getAttribute('aria-label'));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();

    // Both wait, each on its own key.
    expect(JSON.parse(deviceStore.get(BG_STORAGE_KEYS.game)!).mode).toBe('difficulty');
    expect(JSON.parse(deviceStore.get(BG_STORAGE_KEYS.dailyGame)!).mode).toBe('daily');
    cleanup();
    launch();
    await settle();
    await user.click(screen.getByRole('button', { name: /Hard.*Resume/ }));
    expect(islands().map((button) => button.getAttribute('aria-label'))).toEqual(hardLabels);
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: /Daily Challenge.*Resume/ }));
    expect(islands().map((button) => button.getAttribute('aria-label'))).toEqual(dailyLabels);
  });

  it('opens a saved board as it was left, from a record on disk', async () => {
    const user = userEvent.setup();
    const session = createDifficultySession('easy', 'bridges-easy-resume');
    const { a, b } = answerPair(session);
    const played = doConnect(session, a, b)!;
    renderGame({
      ...tutorialDone,
      [BG_STORAGE_KEYS.game]: JSON.stringify(toPersisted(played, 1)),
    });
    await user.click(await screen.findByRole('button', { name: /^Easy.*Resume/ }));
    await user.click(island(a));
    expect(island(b)).toHaveAccessibleName(/1 of 2 bridges$/);
    // The undo history is not saved (§9).
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('lands on the home over a corrupt save, and starts nothing in its place', async () => {
    const session = createDifficultySession('easy', 'bridges-easy-corrupt');
    const record = toPersisted(session, 1);
    const broken = { ...record, solution: record.solution.replace(/[12]/, '0') };
    for (const raw of ['{"schemaVersion":1,"mode":"diff', JSON.stringify(broken)]) {
      renderGame({ ...tutorialDone, [BG_STORAGE_KEYS.game]: raw });
      expect(await screen.findByRole('button', { name: /^Easy/ })).not.toHaveTextContent(/Resume/);
      expect(screen.queryByRole('group', { name: /^Bridges board/ })).not.toBeInTheDocument();
      // Nothing was started: no game counted, no board written over the slot.
      await settle();
      expect(deviceStore.get(BG_STORAGE_KEYS.stats)).toBeUndefined();
      expect(deviceStore.get(BG_STORAGE_KEYS.game)).toBeUndefined();
      cleanup();
    }
  });

  it('shows no clock while playing, and hands control back to the collection', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);
    await openDaily(user);
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('reports per-difficulty facts, the daily’s days and the total, and no streak (§11)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));
    expect(screen.getAllByText('Boards solved')).toHaveLength(3);
    expect(screen.getByText('Days cleared')).toBeInTheDocument();
    expect(screen.getByText('All modes')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});

describe('backgrounding (§10)', () => {
  // Play five seconds, background the app, let Android kill it, come back:
  // the board returns, and so must the five seconds — once.
  it('books play time before the app can be killed, and never twice', async () => {
    deviceStore.set(BG_STORAGE_KEYS.flags, tutorialDone[BG_STORAGE_KEYS.flags]!);
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /^Easy/ }));

      act(() => vi.advanceTimersByTime(5_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(5);

      cleanup();
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Easy.*Resume/ }));

      act(() => vi.advanceTimersByTime(3_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not run the clock or make a move on its own while hidden or after', async () => {
    deviceStore.set(BG_STORAGE_KEYS.flags, tutorialDone[BG_STORAGE_KEYS.flags]!);
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /^Easy/ }));
      const labels = islands().map((button) => button.getAttribute('aria-label'));
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      act(() => vi.advanceTimersByTime(60_000));
      Reflect.deleteProperty(document, 'visibilityState');
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      act(() => vi.advanceTimersByTime(2_000));
      background();
      await settle();
      // Hidden minutes are not play; coming back moved nothing.
      expect(storedPlaySeconds()).toBe(2);
      expect(islands().map((button) => button.getAttribute('aria-label'))).toEqual(labels);
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * A pinned home-screen shortcut, and what this game does about it (issue
 * #113). The shell says only which door was used; every decision below is
 * this game's, taken from its own two save slots (§10).
 */
describe('a home-screen shortcut', () => {
  it('opens the one suspended game straight onto its board', async () => {
    const user = userEvent.setup();
    deviceStore.set(BG_STORAGE_KEYS.flags, tutorialDone[BG_STORAGE_KEYS.flags]!);
    launch();
    await settle();
    await openDaily(user);
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    cleanup();

    launch('shortcut');
    await settle();
    expect(board()).toBeInTheDocument();
    expect(screen.getByText('Daily')).toBeInTheDocument();
  });

  it('opens the home screen when two games are suspended, rather than guessing', async () => {
    const user = userEvent.setup();
    deviceStore.set(BG_STORAGE_KEYS.flags, tutorialDone[BG_STORAGE_KEYS.flags]!);
    launch();
    await settle();
    await user.click(await screen.findByRole('button', { name: /^Easy/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await openDaily(user);
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    cleanup();

    launch('shortcut');
    await settle();
    expect(screen.queryByRole('group', { name: /^Bridges board/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Easy.*Resume/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge.*Resume/ })).toBeInTheDocument();
  });

  it('teaches the game first on a launch that has never seen it (§12)', async () => {
    launch('shortcut');
    expect(await screen.findByText('Numbers are bridges')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /^Bridges board/ })).not.toBeInTheDocument();
  });
});

/**
 * An assignment that meets every island's number and leaves the islands in
 * more than one group — the one way a board can look finished and not be
 * (§3). A bounded depth-first search over the edges in order; null when none
 * turns up within the budget.
 */
function splitAssignment(session: BridgesSession, budget = 50_000): number[] | null {
  const { graph, islands: list } = session;
  const count = graph.edges.length;
  const bridges = new Array<number>(count).fill(0);
  const totals = new Array<number>(list.length).fill(0);
  const open = list.map((_, ordinal) => graph.islandEdges[ordinal]!.length);
  let nodes = 0;
  const visit = (edgeId: number): number[] | null => {
    if (++nodes > budget) return null;
    if (edgeId === count) {
      if (!list.every((entry, ordinal) => totals[ordinal] === entry.value)) return null;
      return componentCount(graph, bridges) > 1 ? [...bridges] : null;
    }
    const { a, b } = graph.edges[edgeId]!;
    for (const n of [0, 1, 2]) {
      if (n > 0 && graph.crossings[edgeId]!.some((other) => other < edgeId && bridges[other]! > 0))
        break;
      if (totals[a]! + n > list[a]!.value || totals[b]! + n > list[b]!.value) break;
      bridges[edgeId] = n;
      totals[a]! += n;
      totals[b]! += n;
      open[a]!--;
      open[b]!--;
      const closed =
        (open[a] !== 0 || totals[a] === list[a]!.value) &&
        (open[b] !== 0 || totals[b] === list[b]!.value);
      const found = closed ? visit(edgeId + 1) : null;
      bridges[edgeId] = 0;
      totals[a]! -= n;
      totals[b]! -= n;
      open[a]!++;
      open[b]!++;
      if (found) return found;
    }
    return null;
  };
  return visit(0);
}
