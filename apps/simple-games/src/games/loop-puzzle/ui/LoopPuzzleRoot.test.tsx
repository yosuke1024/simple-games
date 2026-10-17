import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import {
  CROSS,
  LINE,
  createDailySession,
  createDifficultySession,
  doCycle,
  gridFor,
  horizontalEdge,
  localDateString,
  verticalEdge,
  type LoopPuzzleSession,
} from '../game';
import { toPersisted } from '../storage/gamePersistence';
import { LP_STORAGE_KEYS, type PersistedGame, type Stats } from '../storage/schemas';
import { LoopPuzzleRoot } from './LoopPuzzleRoot';

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
      <LoopPuzzleRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

const tutorialDone = {
  [LP_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

/** Launches the app against the device store, the way a player's phone does. */
function launch(entry?: 'collection' | 'shortcut') {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      {entry === 'shortcut' ? (
        <LoopPuzzleRoot onExit={onExit} entry="shortcut" />
      ) : (
        <LoopPuzzleRoot onExit={onExit} />
      )}
    </SettingsProvider>,
  );
  return onExit;
}

/** Lets the local reads and the saves they trigger resolve (promises, not timers). */
const settle = () => act(async () => undefined);

/** The app goes to background. Android may kill it without another event. */
function background() {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  Reflect.deleteProperty(document, 'visibilityState');
}

const board = () => screen.getByRole('group', { name: /Loop Puzzle board/ });
const queryBoard = () => screen.queryByRole('group', { name: /Loop Puzzle board/ });
const edgeButton = (edge: number) =>
  board().querySelector<HTMLButtonElement>(`button[data-edge="${edge}"]`)!;
const edgeLabels = () =>
  within(board())
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label'));
const feedback = () => screen.getByRole('status');
/** The sentence the status line shows, without the edge's spoken name read after it. */
const sentence = () => feedback().querySelector('.lp-feedback-text')?.textContent ?? '';

const today = () => localDateString(new Date());

/** The hint sentences that ask for a line, and those that rule one out (§6). */
const LINE_SENTENCES = [
  'The ringed number needs a line on the marked edge.',
  'At the ringed dot, the loop must use the marked edge.',
  'Without a line on the marked edge, a contradiction follows.',
  'The marked edge is part of the loop.',
];
const CROSS_SENTENCES = [
  'The ringed number leaves no line for the marked edge.',
  'At the ringed dot, the marked edge cannot be a line.',
  'A line on the marked edge would close a loop too soon.',
  'The loop is closed, so the marked edge is not part of it.',
  'A line on the marked edge leads to a contradiction.',
  'The marked edge is not part of the loop.',
];
const todaysDaily = (): LoopPuzzleSession => createDailySession(today());
const loopEdges = (truth: LoopPuzzleSession) =>
  truth.solution.flatMap((mark, edge) => (mark === LINE ? [edge] : []));
const offLoopEdges = (truth: LoopPuzzleSession) =>
  truth.solution.flatMap((mark, edge) => (mark === CROSS ? [edge] : []));

/** One tap per call, as a finger would. */
const tap = (edge: number, times = 1) => {
  for (let i = 0; i < times; i++) fireEvent.click(edgeButton(edge));
};

async function openDaily(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Daily Challenge/ }));
}

function storedStats(): Stats | null {
  const raw = deviceStore.get(LP_STORAGE_KEYS.stats);
  return raw === undefined ? null : (JSON.parse(raw) as Stats);
}

function storedPlaySeconds(): number {
  const stats = storedStats();
  if (stats === null) return 0;
  return stats.easy.totalPlaySeconds + stats.medium.totalPlaySeconds + stats.hard.totalPlaySeconds;
}

afterEach(() => {
  cleanup();
  deviceStore.clear();
  vi.restoreAllMocks();
});

describe('first run (§11)', () => {
  it('shows three Quick Rules and starts an easy board right after', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('One closed loop')).toBeInTheDocument();
    // No way out but through on the first pass, and no "Learn More" (§11).
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    expect(screen.queryByText('Learn More')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Read the numbers')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Tap an edge')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(within(board()).getAllByRole('button')).toHaveLength(gridFor(4, 4).edgeCount);
    await settle();
    expect(JSON.parse(deviceStore.get(LP_STORAGE_KEYS.flags)!).tutorialCompleted).toBe(true);
  });

  it('leads straight into the difficulty last chosen', async () => {
    const user = userEvent.setup();
    renderGame({
      [LP_STORAGE_KEYS.prefs]: JSON.stringify({ schemaVersion: 1, difficulty: 'hard' }),
    });
    await screen.findByText('One closed loop');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));
    expect(screen.getByText('Hard')).toBeInTheDocument();
    expect(within(board()).getAllByRole('button')).toHaveLength(gridFor(6, 6).edgeCount);
  });
});

describe('Quick Rules shown again over a suspended board (§11, §12)', () => {
  it('resumes that board on Start Playing, rather than replace it unasked', async () => {
    const user = userEvent.setup();
    // The flags record is gone (and the remembered difficulty with it, so the
    // first-run board would be Easy); a Medium board is suspended, one line in.
    const session = createDifficultySession('medium', 'loop-medium-flags-lost');
    const line = loopEdges(session)[0]!;
    const played = doCycle(session, line)!;
    renderGame({ [LP_STORAGE_KEYS.game]: JSON.stringify(toPersisted(played, 1)) });

    expect(await screen.findByText('One closed loop')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // The Medium board, with its line — not a new Easy one.
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(within(board()).getAllByRole('button')).toHaveLength(gridFor(5, 5).edgeCount);
    expect(edgeButton(line)).toHaveAccessibleName(/line$/);
    await settle();
    // Resumed, not started: no play counted, and no new board written over the slot.
    expect(storedStats()?.easy.played ?? 0).toBe(0);
    expect(storedStats()?.medium.played ?? 0).toBe(0);
    expect(deviceStore.get(LP_STORAGE_KEYS.game)).toBeUndefined();
  });
});

describe('playing (§3, §4, §6)', () => {
  it('cycles an edge through line, × and empty with taps', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await openDaily(user);
    const edge = horizontalEdge(gridFor(5, 5), 2, 2);
    await user.click(edgeButton(edge));
    expect(edgeButton(edge)).toHaveAccessibleName(/, line$/);
    await user.click(edgeButton(edge));
    expect(edgeButton(edge)).toHaveAccessibleName(/, crossed out$/);
    await user.click(edgeButton(edge));
    expect(edgeButton(edge)).toHaveAccessibleName(/, empty$/);
  });

  it('undoes one tap at a time — by button and by Ctrl+Z — and stops at the start', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await openDaily(user);
    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo).toBeDisabled();
    const edge = verticalEdge(gridFor(5, 5), 1, 1);
    tap(edge, 2);
    expect(edgeButton(edge)).toHaveAccessibleName(/crossed out$/);
    await user.click(undo);
    expect(edgeButton(edge)).toHaveAccessibleName(/line$/);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(edgeButton(edge)).toHaveAccessibleName(/empty$/);
    expect(undo).toBeDisabled();
  });

  it('plays from the keyboard: Tab to the board, arrows, Enter, Delete', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await openDaily(user);
    const grid = gridFor(5, 5);
    act(() => edgeButton(0).focus());
    await user.keyboard('{ArrowRight}{ArrowRight}{Enter}');
    expect(edgeButton(horizontalEdge(grid, 0, 2))).toHaveAccessibleName(/line$/);
    await user.keyboard('{ArrowDown}x');
    expect(edgeButton(verticalEdge(grid, 0, 2))).toHaveAccessibleName(/crossed out$/);
    await user.keyboard('{Delete}');
    expect(edgeButton(verticalEdge(grid, 0, 2))).toHaveAccessibleName(/empty$/);

    // From outside the board, the first arrow only brings the focus back onto
    // the board's tab stop — the edge last focused — and moves nothing.
    act(() => (document.activeElement as HTMLElement).blur());
    expect(document.activeElement).toBe(document.body);
    expect(fireEvent.keyDown(window, { key: 'ArrowUp' })).toBe(false);
    expect(document.activeElement).toBe(edgeButton(verticalEdge(grid, 0, 2)));
    expect(edgeButton(verticalEdge(grid, 0, 2))).toHaveAccessibleName(/empty$/);
  });

  it('wins on the loop’s lines alone: × marks are notes, never part of the win (§3)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await openDaily(user);
    const truth = todaysDaily();
    // A few × notes, and every line of the loop but one: not solved yet.
    for (const edge of offLoopEdges(truth).slice(0, 4)) tap(edge, 2);
    const lines = loopEdges(truth);
    for (const edge of lines.slice(0, -1)) tap(edge);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    // The last line closes the loop: solved, with the × marks still standing.
    tap(lines[lines.length - 1]!);
    expect(await screen.findByRole('alertdialog', { name: 'Solved!' })).toBeInTheDocument();
    expect(screen.getByText('Hints used')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    // A daily has no other board to offer.
    expect(screen.queryByRole('button', { name: 'New board' })).not.toBeInTheDocument();
    await settle();
    expect(storedStats()?.medium.solved).toBe(1);
    expect(storedStats()?.dailyTimes[today()]).toBeDefined();
    // A finished game is not kept for resuming (§12).
    expect(deviceStore.has(LP_STORAGE_KEYS.dailyGame)).toBe(false);
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
});

describe('what the marks break (§5)', () => {
  it('says so when a dot has three lines, and only says so', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await openDaily(user);
    const grid = gridFor(5, 5);
    expect(feedback()).toHaveTextContent('');
    const branch = [
      verticalEdge(grid, 1, 2),
      horizontalEdge(grid, 2, 1),
      horizontalEdge(grid, 2, 2),
    ];
    for (const edge of branch) tap(edge);
    expect(feedback()).toHaveTextContent('A dot has more than two lines.');
    // Nothing was rewritten: all three lines still stand.
    for (const edge of branch) expect(edgeButton(edge)).toHaveAccessibleName(/line$/);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(feedback()).toHaveTextContent('');
  });

  it('says so when a closed loop leaves other lines out', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await openDaily(user);
    const grid = gridFor(5, 5);
    const square = [
      horizontalEdge(grid, 0, 0),
      verticalEdge(grid, 0, 1),
      horizontalEdge(grid, 1, 0),
      verticalEdge(grid, 0, 0),
    ];
    for (const edge of [...square, horizontalEdge(grid, 5, 4)]) tap(edge);
    expect(feedback()).toHaveTextContent('A closed loop leaves other lines outside it.');
  });

  it('says so when a number has more lines than it shows', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await openDaily(user);
    const truth = todaysDaily();
    const grid = gridFor(5, 5);
    const cell = truth.clues.findIndex((clue) => clue !== null && clue <= 2);
    const clue = truth.clues[cell]!;
    for (let side = 0; side <= clue; side++) tap(grid.cellEdges[4 * cell + side]!);
    expect(feedback()).toHaveTextContent('A number has more lines than it shows.');
    expect(
      screen.getByRole('img', { name: new RegExp(`^Number ${clue}.*too many lines$`) }),
    ).toBeInTheDocument();
  });
});

describe('hints (§6)', () => {
  it('points at a wrong line first, and writes nothing', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await openDaily(user);
    const truth = todaysDaily();
    const wrong = offLoopEdges(truth)[0]!;
    tap(wrong);
    const before = edgeLabels();
    await user.click(screen.getByRole('button', { name: 'Hint' }));
    expect(feedback()).toHaveTextContent('The marked line is not part of the loop.');
    expect(edgeButton(wrong)).toHaveClass('lp-edge-hint');
    expect(edgeButton(wrong)).toHaveAccessibleDescription('Marked by the hint');
    expect(edgeLabels()).toEqual(before);
  });

  it('points at a wrong × when no line is wrong', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await openDaily(user);
    const truth = todaysDaily();
    const onLoop = loopEdges(truth)[0]!;
    tap(onLoop, 2);
    await user.click(screen.getByRole('button', { name: 'Hint' }));
    expect(feedback()).toHaveTextContent('The loop runs along the marked ×.');
    expect(edgeButton(onLoop)).toHaveClass('lp-edge-hint');
  });

  it('otherwise marks an edge the answer agrees with, says why, and writes nothing', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await openDaily(user);
    const truth = todaysDaily();
    const before = edgeLabels();
    fireEvent.keyDown(window, { key: 'h' });
    const marked = board().querySelector<HTMLButtonElement>('.lp-edge-hint')!;
    const edge = Number(marked.dataset.edge);
    const text = sentence();
    // A listener hears where: the marked edge's own name follows the sentence,
    // and Tab into the board lands on it (§13).
    expect(feedback()).toHaveTextContent(`${text} ${marked.getAttribute('aria-label')!}`);
    expect(marked).toHaveAttribute('tabindex', '0');
    // Every sentence names the mark the edge must take; the answer agrees.
    if (LINE_SENTENCES.includes(text)) expect(truth.solution[edge]).toBe(LINE);
    else if (CROSS_SENTENCES.includes(text)) expect(truth.solution[edge]).toBe(CROSS);
    else throw new Error(`unexpected hint: ${text}`);
    expect(edgeLabels()).toEqual(before);
    // The next step spends the hint: its mark and its words go.
    tap(edge);
    expect(board().querySelector('.lp-edge-hint')).toBeNull();
    expect(feedback()).not.toHaveTextContent(text);
  });

  it('counts the hints it gave on the result card, and never limits them', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await openDaily(user);
    const truth = todaysDaily();
    // Three hints, each followed as the player chooses: a line is drawn, an ×
    // is left unwritten (it is a note — §3). Every one is a new hint.
    const seen: number[] = [];
    for (let i = 0; i < 3; i++) {
      await user.click(screen.getByRole('button', { name: 'Hint' }));
      const edge = Number(board().querySelector<HTMLButtonElement>('.lp-edge-hint')!.dataset.edge);
      expect(seen, 'a hint repeated itself').not.toContain(edge);
      seen.push(edge);
      if (truth.solution[edge] === LINE) tap(edge);
    }
    for (const edge of loopEdges(truth)) if (!seen.includes(edge)) tap(edge);
    const card = await screen.findByRole('alertdialog', { name: 'Solved!' });
    expect(within(card).getByText('Hints used').nextElementSibling).toHaveTextContent('3');
  });

  it('moves on past an × the player leaves unwritten, and counts a repeated hint once (§6)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await openDaily(user);
    const truth = todaysDaily();
    const hinted = () =>
      Number(board().querySelector<HTMLButtonElement>('.lp-edge-hint')!.dataset.edge);
    // Ask until a line comes up, writing nothing: every × is said once and
    // the next hint goes on from it — never the same × again.
    const crosses = new Set<number>();
    let line = -1;
    for (let i = 0; i < truth.solution.length && line < 0; i++) {
      await user.click(screen.getByRole('button', { name: 'Hint' }));
      const edge = hinted();
      if (truth.solution[edge] === LINE) line = edge;
      else {
        expect(crosses.has(edge), `the × on edge ${edge} came back`).toBe(false);
        crosses.add(edge);
      }
    }
    expect(line).toBeGreaterThanOrEqual(0);
    // The line hint waits for the player: asked again, it is the same hint.
    await user.click(screen.getByRole('button', { name: 'Hint' }));
    expect(hinted()).toBe(line);
    for (const edge of loopEdges(truth)) tap(edge);
    const card = await screen.findByRole('alertdialog', { name: 'Solved!' });
    expect(within(card).getByText('Hints used').nextElementSibling).toHaveTextContent(
      String(crosses.size + 1),
    );
  });
});

describe('retry and the home (§9, §12)', () => {
  it('rebuilds the same board on retry, after asking — and the daily offers nothing else', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await openDaily(user);
    const numbers = () => screen.getAllByRole('img').map((img) => img.getAttribute('aria-label'));
    const fresh = numbers();
    const edge = loopEdges(todaysDaily())[0]!;
    tap(edge);

    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Start over?' });
    expect(within(dialog).queryByRole('button', { name: 'New board' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Retry same board' }));
    expect(edgeButton(edge)).toHaveAccessibleName(/empty$/);
    // The same numbers, read as a fresh board reads them.
    expect(numbers()).toEqual(fresh);
  });

  it('lets a key held from the last tap start nothing on the result card (§4)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await openDaily(user);
    for (const edge of loopEdges(todaysDaily())) tap(edge);
    const card = await screen.findByRole('alertdialog', { name: 'Solved!' });
    const retry = within(card).getByRole('button', { name: 'Retry same board' });
    expect(retry).toHaveFocus();
    // A browser clicks a focused button on Enter's keydown, repeats included,
    // unless that keydown is cancelled: a repeat is cancelled, a press is not.
    expect(fireEvent.keyDown(retry, { key: 'Enter', repeat: true })).toBe(false);
    expect(fireEvent.keyDown(retry, { key: ' ', repeat: true })).toBe(false);
    expect(fireEvent.keyDown(retry, { key: 'Enter' })).toBe(true);
    expect(screen.getByRole('alertdialog', { name: 'Solved!' })).toBeInTheDocument();
  });

  it('offers a new board from ↻ in free play, and counts it as a game played', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /^Easy/ }));
    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'New board' }),
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(within(board()).getAllByRole('button')).toHaveLength(gridFor(4, 4).edgeCount);
    await settle();
    expect(storedStats()?.easy.played).toBe(2);
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

  it('keeps a suspended board across leaving, and across a relaunch (§12)', async () => {
    const user = userEvent.setup();
    deviceStore.set(LP_STORAGE_KEYS.flags, tutorialDone[LP_STORAGE_KEYS.flags]!);
    launch();
    await settle();
    await openDaily(user);
    const line = loopEdges(todaysDaily())[0]!;
    const cross = offLoopEdges(todaysDaily())[0]!;
    tap(line);
    tap(cross, 2);

    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    expect(screen.getByRole('button', { name: /Daily Challenge.*Resume/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    expect(edgeButton(line)).toHaveAccessibleName(/line$/);

    // The process dies; the next launch reads the device store.
    cleanup();
    launch();
    await settle();
    await user.click(screen.getByRole('button', { name: /Daily Challenge.*Resume/ }));
    expect(edgeButton(line)).toHaveAccessibleName(/line$/);
    expect(edgeButton(cross)).toHaveAccessibleName(/crossed out$/);
    // Resumed, nothing more: no step taken for the player, the undo history empty.
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('keeps the daily and the free-play board in their own slots', async () => {
    const user = userEvent.setup();
    deviceStore.set(LP_STORAGE_KEYS.flags, tutorialDone[LP_STORAGE_KEYS.flags]!);
    launch();
    await settle();
    await user.click(await screen.findByRole('button', { name: /^Easy/ }));
    tap(0);
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await openDaily(user);
    tap(1, 2);
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();

    const free = JSON.parse(deviceStore.get(LP_STORAGE_KEYS.game)!) as PersistedGame;
    const daily = JSON.parse(deviceStore.get(LP_STORAGE_KEYS.dailyGame)!) as PersistedGame;
    expect([free.mode, free.difficulty, free.marks[0]]).toEqual(['difficulty', 'easy', 'L']);
    expect([daily.mode, daily.difficulty, daily.dailyDate, daily.marks[1]]).toEqual([
      'daily',
      'medium',
      today(),
      'X',
    ]);

    cleanup();
    launch();
    await settle();
    await user.click(screen.getByRole('button', { name: /Easy.*Resume/ }));
    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(edgeButton(0)).toHaveAccessibleName(/line$/);
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: /Daily Challenge.*Resume/ }));
    expect(screen.getByText('Daily')).toBeInTheDocument();
    expect(edgeButton(1)).toHaveAccessibleName(/crossed out$/);
  });

  it('reports per-difficulty facts, the days cleared and the total time — no streak (§10)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));
    expect(screen.getAllByText('Puzzles solved')).toHaveLength(3);
    expect(screen.getByText('Days cleared')).toBeInTheDocument();
    expect(screen.getByText('All boards')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});

describe('saves that cannot be resumed (§12)', () => {
  const dailyRecord = (): PersistedGame => toPersisted(todaysDaily(), 1_790_000_000_000);

  it('lands on the home after a corrupt save, and starts nothing in its place', async () => {
    deviceStore.set(LP_STORAGE_KEYS.flags, tutorialDone[LP_STORAGE_KEYS.flags]!);
    deviceStore.set(LP_STORAGE_KEYS.game, '{"schemaVersion":1,"mode":"diff');
    deviceStore.set(
      LP_STORAGE_KEYS.dailyGame,
      JSON.stringify({ ...dailyRecord(), cluesDigest: 'lp1:00000000' }),
    );
    launch();
    await settle();
    expect(await screen.findByRole('button', { name: /^Easy/ })).not.toHaveTextContent('Resume');
    expect(screen.getByRole('button', { name: /Daily Challenge/ })).not.toHaveTextContent('Resume');
    expect(queryBoard()).not.toBeInTheDocument();
    await settle();
    // No game was started for the player: nothing was counted as played.
    expect(storedStats()).toBeNull();
  });

  it('lands on the home through a shortcut too', async () => {
    deviceStore.set(LP_STORAGE_KEYS.flags, tutorialDone[LP_STORAGE_KEYS.flags]!);
    const solved = { ...todaysDaily() };
    deviceStore.set(
      LP_STORAGE_KEYS.dailyGame,
      JSON.stringify(toPersisted({ ...solved, marks: solved.solution }, 1_790_000_000_000)),
    );
    launch('shortcut');
    await settle();
    expect(await screen.findByRole('button', { name: /Daily Challenge/ })).toBeInTheDocument();
    expect(queryBoard()).not.toBeInTheDocument();
  });

  it('drops a daily from another day and offers today’s', async () => {
    const user = userEvent.setup();
    deviceStore.set(LP_STORAGE_KEYS.flags, tutorialDone[LP_STORAGE_KEYS.flags]!);
    deviceStore.set(
      LP_STORAGE_KEYS.dailyGame,
      JSON.stringify(toPersisted(createDailySession('2020-01-01'), 1_590_000_000_000)),
    );
    launch();
    await settle();
    expect(await screen.findByRole('button', { name: /Daily Challenge/ })).not.toHaveTextContent(
      'Resume',
    );
    expect(deviceStore.has(LP_STORAGE_KEYS.dailyGame)).toBe(false);
    await openDaily(user);
    expect(screen.getByText('Daily')).toBeInTheDocument();
  });
});

describe('backgrounding (§12)', () => {
  // Play five seconds, background the app, let Android kill it, come back:
  // the board returns, and so must the five seconds — booked once.
  it('books play time before the app can be killed, and never twice', async () => {
    deviceStore.set(LP_STORAGE_KEYS.flags, tutorialDone[LP_STORAGE_KEYS.flags]!);
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

  it('does not run the clock while the page is hidden', async () => {
    deviceStore.set(LP_STORAGE_KEYS.flags, tutorialDone[LP_STORAGE_KEYS.flags]!);
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /^Easy/ }));
      act(() => vi.advanceTimersByTime(2_000));
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      act(() => vi.advanceTimersByTime(60_000));
      Reflect.deleteProperty(document, 'visibilityState');
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  // ↻ mid-game replaces the board on screen and restarts the clock at zero:
  // the seconds already played on the old one must be booked first, or the
  // totals of §10 come out short (the 2026-10-17 review).
  for (const choice of ['Retry same board', 'New board'] as const) {
    it(`books the replaced board's seconds when ↻ ${choice} is used mid-game (§10)`, async () => {
      deviceStore.set(LP_STORAGE_KEYS.flags, tutorialDone[LP_STORAGE_KEYS.flags]!);
      vi.useFakeTimers();
      try {
        launch();
        await settle();
        fireEvent.click(screen.getByRole('button', { name: /^Easy/ }));
        act(() => vi.advanceTimersByTime(30_000));
        fireEvent.click(screen.getByRole('button', { name: 'Retry same board' }));
        fireEvent.click(
          within(screen.getByRole('alertdialog')).getByRole('button', { name: choice }),
        );
        await settle();
        expect(storedPlaySeconds()).toBe(30);
        act(() => vi.advanceTimersByTime(5_000));
        fireEvent.click(screen.getByRole('button', { name: 'Home' }));
        await settle();
        expect(storedPlaySeconds()).toBe(35);
        expect(storedStats()?.easy.played).toBe(2);
      } finally {
        vi.useRealTimers();
      }
    });
  }
});

/**
 * A pinned home-screen shortcut, and what this game does about it (issue
 * #113). The shell says only which door was used; every decision below is
 * this game's, taken from its own two save slots (§12).
 */
describe('a home-screen shortcut', () => {
  it('opens the one suspended game straight onto its board', async () => {
    const user = userEvent.setup();
    deviceStore.set(LP_STORAGE_KEYS.flags, tutorialDone[LP_STORAGE_KEYS.flags]!);
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
    deviceStore.set(LP_STORAGE_KEYS.flags, tutorialDone[LP_STORAGE_KEYS.flags]!);
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
    expect(queryBoard()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Easy.*Resume/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge.*Resume/ })).toBeInTheDocument();
  });

  it('teaches the game first on a launch that has never seen it (§11)', async () => {
    launch('shortcut');
    expect(await screen.findByText('One closed loop')).toBeInTheDocument();
    expect(queryBoard()).not.toBeInTheDocument();
  });
});
