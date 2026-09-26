import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { createSession, roll, score, toggleHold, type YachtSession } from '../game';
import { toPersisted } from '../storage/gamePersistence';
import { YT_STORAGE_KEYS, type PersistedGame, type Stats } from '../storage/schemas';
import { YachtRoot } from './YachtRoot';

/**
 * A stand-in for the device store. The `kv` prop below is a load-side seam
 * only — saves always go to Capacitor Preferences — so the tests that have to
 * read back what a save wrote stand behind both instead (`launch`).
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
      <YachtRoot onExit={onExit} kv={createMemoryKV(initial)} />
    </SettingsProvider>,
  );
  return { onExit };
}

/** Launches the game against the device store, the way a player's phone does. */
function launch(entry?: 'collection' | 'shortcut') {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <YachtRoot onExit={onExit} entry={entry} />
    </SettingsProvider>,
  );
  return { onExit };
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

const storedStats = (): Stats | null => {
  const raw = deviceStore.get(YT_STORAGE_KEYS.stats);
  return raw === undefined ? null : (JSON.parse(raw) as Stats);
};

const storedGame = (): PersistedGame | null => {
  const raw = deviceStore.get(YT_STORAGE_KEYS.game);
  return raw === undefined ? null : (JSON.parse(raw) as PersistedGame);
};

const tutorialDone = {
  [YT_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

/** A sheet two turns in: Choice and Ones filled, the third turn thrown once. */
function suspendedSession(): YachtSession {
  let session = roll(createSession('yacht-uitest'))!;
  session = score(session, 'choice')!;
  session = score(roll(session)!, 'ones')!;
  return toggleHold(roll(session)!, 0)!;
}

const savedGame = (session: YachtSession = suspendedSession()) => ({
  ...tutorialDone,
  [YT_STORAGE_KEYS.game]: JSON.stringify(toPersisted(session, 1)),
});

const dice = () => within(screen.getByRole('group', { name: 'Dice' })).getAllByRole('button');
const boxes = () =>
  within(screen.getByRole('group', { name: 'Score sheet' })).getAllByRole('button');
const rollButton = () => screen.getByRole('button', { name: /^Roll/ });
const box = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}:`) });

afterEach(async () => {
  cleanup();
  // Saves are fire-and-forget and queued per key (storage/repo.ts), so the
  // last test's may still be on their way to the store. Let them land before
  // wiping it, or the next test launches onto a game it never played.
  await new Promise((resolve) => setTimeout(resolve, 0));
  deviceStore.clear();
});

describe('first run', () => {
  it('shows Quick Rules and starts a sheet right after (§8)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'How to Play' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Roll and keep')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Three rolls a turn')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Fill one box')).toBeInTheDocument();
    // No guide is published yet, so there is nowhere to learn more (§8).
    expect(screen.queryByRole('button', { name: 'Learn More' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // A fresh sheet: five dice still in the cup, twelve boxes, nothing to press
    // but Roll (§2).
    expect(dice()).toHaveLength(5);
    expect(dice()[0]).toHaveAccessibleName('Die 1: not rolled yet');
    for (const die of dice()) expect(die).toBeDisabled();
    expect(boxes()).toHaveLength(12);
    for (const button of boxes()) expect(button).toBeDisabled();
    expect(rollButton()).toBeEnabled();
    expect(screen.getByText('Turn 1 / 12')).toBeInTheDocument();
    expect(screen.getByText('Total 0')).toBeInTheDocument();
  });
});

describe('a turn (§2)', () => {
  it('throws, keeps a die, and scores a box through the screen', async () => {
    renderGame(tutorialDone);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));

    fireEvent.click(rollButton());
    expect(screen.getByText('Rolls left: 2')).toBeInTheDocument();
    // Faces now, and every open box previews what these dice would score.
    expect(dice()[0]).toHaveAccessibleName(/^Die 1: [1-6]$/);
    for (const button of boxes()) expect(button).toBeEnabled();
    expect(box('Choice')).toHaveAccessibleName(/^Choice: \d+ if taken now$/);

    // Keep die 1: pressed, lifted, and announced as held (§9).
    const face = /Die 1: ([1-6])/.exec(dice()[0]!.getAttribute('aria-label')!)![1];
    fireEvent.click(dice()[0]!);
    expect(dice()[0]).toHaveAttribute('aria-pressed', 'true');
    expect(dice()[0]).toHaveAccessibleName(`Die 1: ${face}, held`);

    // The kept die survives the next throw.
    fireEvent.click(rollButton());
    expect(dice()[0]).toHaveAccessibleName(`Die 1: ${face}, held`);

    const points = Number(/: (\d+) if/.exec(box('Choice').getAttribute('aria-label')!)![1]);
    fireEvent.click(box('Choice'));

    // The box is filled and closed, and the next turn starts in the cup.
    expect(box('Choice')).toHaveAccessibleName(`Choice: scored ${points}`);
    expect(box('Choice')).toBeDisabled();
    expect(screen.getByText('Turn 2 / 12')).toBeInTheDocument();
    expect(screen.getByText(`Total ${points}`)).toBeInTheDocument();
    expect(dice()[0]).toHaveAccessibleName('Die 1: not rolled yet');
    expect(dice()[0]).toHaveAttribute('aria-pressed', 'false');
    await settle();
    expect(storedGame()!.scores.filter((value) => value !== null)).toEqual([points]);
  });

  it('gives three throws a turn, then only a box', async () => {
    renderGame(tutorialDone);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));

    fireEvent.click(rollButton());
    fireEvent.click(rollButton());
    fireEvent.click(rollButton());
    expect(screen.getByText('Rolls left: 0')).toBeInTheDocument();
    expect(rollButton()).toBeDisabled();
    // Nothing is left to keep a die from (§2).
    for (const die of dice()) expect(die).toBeDisabled();
    for (const button of boxes()) expect(button).toBeEnabled();
  });

  it('shows no clock while playing (§9)', async () => {
    renderGame(tutorialDone);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
    // And no help beyond the throws (§5).
    expect(screen.queryByRole('button', { name: /undo|hint/i })).not.toBeInTheDocument();
  });
});

/* Keyboard input is an adapter over the same tap handlers (issue #93): these
   check dice the buttons also produce, never a keyboard-only behaviour. */
describe('keyboard (issue #93)', () => {
  it('keeps dice with 1–5 and throws with R, same as the buttons', async () => {
    renderGame(tutorialDone);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));

    // Before the first throw a digit keeps nothing (§2).
    fireEvent.keyDown(window, { key: '2' });
    expect(dice()[1]).toHaveAttribute('aria-pressed', 'false');

    fireEvent.keyDown(window, { key: 'r' });
    expect(screen.getByText('Rolls left: 2')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: '2' });
    fireEvent.keyDown(window, { key: '5' });
    expect(dice()[1]).toHaveAttribute('aria-pressed', 'true');
    expect(dice()[4]).toHaveAttribute('aria-pressed', 'true');
    const kept = [dice()[1]!.getAttribute('aria-label'), dice()[4]!.getAttribute('aria-label')];

    fireEvent.keyDown(window, { key: 'R' });
    expect(screen.getByText('Rolls left: 1')).toBeInTheDocument();
    expect([dice()[1]!.getAttribute('aria-label'), dice()[4]!.getAttribute('aria-label')]).toEqual(
      kept,
    );

    // A second press lets it go; a held-down key and a chord do nothing.
    fireEvent.keyDown(window, { key: '2' });
    expect(dice()[1]).toHaveAttribute('aria-pressed', 'false');
    fireEvent.keyDown(window, { key: '2', repeat: true });
    fireEvent.keyDown(window, { key: '2', ctrlKey: true });
    expect(dice()[1]).toHaveAttribute('aria-pressed', 'false');
  });

  it('does nothing while the new-game dialog is open', async () => {
    renderGame(tutorialDone);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    fireEvent.click(rollButton());

    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    expect(
      screen.getByRole('alertdialog', { name: 'Replace the game in progress?' }),
    ).toBeInTheDocument();
    fireEvent.keyDown(window, { key: '1' });
    fireEvent.keyDown(window, { key: 'r' });
    expect(dice()[0]).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Rolls left: 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(window, { key: '1' });
    expect(dice()[0]).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('a full sheet (§6)', () => {
  it('ends on the total, books it, and clears the save', async () => {
    launch();
    await settle();
    // First launch: through Quick Rules into the first sheet.
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Playing' }));

    for (let turn = 1; turn <= 12; turn++) {
      fireEvent.click(rollButton());
      const open = boxes().find((button) => !button.hasAttribute('disabled'));
      fireEvent.click(open!);
    }
    await settle();

    // Reduced Motion (jsdom has no matchMedia) shows the card at once.
    const card = screen.getByRole('alertdialog', { name: 'Sheet complete' });
    const total = storedStats()!.bestScore!;
    // Total and best are the same number on a first sheet.
    expect(within(card).getAllByText(String(total))).toHaveLength(2);
    expect(screen.getByText(`Total ${total}`)).toBeInTheDocument();
    expect(storedStats()).toMatchObject({
      played: 1,
      completed: 1,
      bestScore: total,
      totalScore: total,
    });
    // A full sheet is not something to come back to (§7).
    expect(storedGame()).toBeNull();
    // A share names this game and carries the total only.
    expect(within(card).getByRole('button', { name: 'Share' })).toBeInTheDocument();

    fireEvent.click(within(card).getByRole('button', { name: 'New Game' }));
    await settle();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText('Turn 1 / 12')).toBeInTheDocument();
    expect(storedStats()!.played).toBe(2);
  });
});

describe('home', () => {
  it('resumes the sheet in progress and asks before replacing it', async () => {
    renderGame(savedGame());
    await settle();

    expect(
      screen.getByRole('button', { name: /^Resume\s*Turn 3 of 12 · \d+ points$/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    expect(
      screen.getByRole('alertdialog', { name: 'Replace the game in progress?' }),
    ).toHaveTextContent('Your game at turn 3 of 12 will be replaced by a new one.');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(screen.getByRole('button', { name: /^Resume/ }));
    expect(screen.getByText('Turn 3 / 12')).toBeInTheDocument();
    expect(dice()[0]).toHaveAttribute('aria-pressed', 'true');
  });

  it('exits to the collection', async () => {
    const { onExit } = renderGame(tutorialDone);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('reports one record, with the best and the average, and no streak (§6)', async () => {
    renderGame({
      ...tutorialDone,
      [YT_STORAGE_KEYS.stats]: JSON.stringify({
        schemaVersion: 1,
        played: 5,
        completed: 3,
        bestScore: 214,
        totalScore: 551,
        totalPlaySeconds: 1500,
      }),
    });
    await settle();
    // The best, quietly, on the button that starts the next one.
    expect(screen.getByRole('button', { name: /^New Game\s*Best 214$/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Statistics' }));

    const row = (label: string) => screen.getByText(label).parentElement!;
    expect(row('Games played')).toHaveTextContent('5');
    expect(row('Sheets completed')).toHaveTextContent('3');
    expect(row('Best score')).toHaveTextContent('214');
    expect(row('Average score')).toHaveTextContent('184');
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });

  it('discards a save that could not have been played, and waits on the home', async () => {
    const record = toPersisted(suspendedSession(), 1);
    renderGame({
      ...tutorialDone,
      [YT_STORAGE_KEYS.game]: JSON.stringify({ ...record, rollIndex: 40 }),
    });
    await settle();
    expect(screen.queryByRole('button', { name: /^Resume/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Game' })).toBeInTheDocument();
  });
});

describe('play time (§6, §7)', () => {
  it('books the seconds once across a background and a relaunch (#109)', async () => {
    for (const [key, value] of Object.entries(savedGame())) deviceStore.set(key, value);
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /^Resume/ }));

      act(() => vi.advanceTimersByTime(4_000));
      background();
      await settle();
      expect(storedGame()!.elapsedSeconds).toBe(4);
      expect(storedStats()!.totalPlaySeconds).toBe(4);

      // The process dies; the next launch stops on the home and goes away again.
      cleanup();
      launch();
      await settle();
      background();
      await settle();
      expect(storedGame()!.elapsedSeconds).toBe(4);
      expect(storedStats()!.totalPlaySeconds).toBe(4);
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * A pinned home-screen shortcut, and what Yacht does about it (issue #113).
 * The shell says only which door was used; the decision is this game's, taken
 * from its own single save slot (§7).
 */
describe('a home-screen shortcut', () => {
  function launchFromShortcut() {
    const onExit = vi.fn();
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <YachtRoot onExit={onExit} entry="shortcut" />
      </SettingsProvider>,
    );
    return { onExit };
  }

  const store = (records: Record<string, string>) => {
    for (const [key, value] of Object.entries(records)) deviceStore.set(key, value);
  };
  const sheetShown = () => screen.queryByRole('group', { name: 'Score sheet' });

  it('opens the one suspended sheet straight onto its dice', async () => {
    store(savedGame());
    launchFromShortcut();
    await settle();

    expect(sheetShown()).toBeInTheDocument();
    // The game that was left, not a fresh one: two boxes filled, die 1 kept.
    expect(screen.getByText('Turn 3 / 12')).toBeInTheDocument();
    expect(dice()[0]).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Rolls left: 2')).toBeInTheDocument();
  });

  it('leaves the sheet for this game’s home, not the collection', async () => {
    store(savedGame());
    const { onExit } = launchFromShortcut();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));

    expect(screen.getByRole('button', { name: /^Resume/ })).toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();
  });

  it('opens the home screen when nothing is suspended', async () => {
    store(tutorialDone);
    launchFromShortcut();
    await settle();

    expect(sheetShown()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Game' })).toBeInTheDocument();
  });

  it('is the only door that resumes: a tile on the collection still opens the home', async () => {
    store(savedGame());
    launch('collection');
    await settle();

    expect(sheetShown()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Resume/ })).toBeInTheDocument();
  });

  it('teaches the game first on a launch that has never seen Quick Rules', async () => {
    store(savedGame());
    deviceStore.delete(YT_STORAGE_KEYS.flags);
    launchFromShortcut();
    await settle();

    expect(screen.getByRole('heading', { level: 1, name: 'How to Play' })).toBeInTheDocument();
    expect(sheetShown()).not.toBeInTheDocument();

    // And finishing it returns to the sheet that was waiting, rather than
    // replacing it with a new one (§8).
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Playing' }));
    expect(screen.getByText('Turn 3 / 12')).toBeInTheDocument();
  });
});
