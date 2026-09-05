import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { createLevelSession, generateLevelBoard, isLive } from '../game';
import { AppProvider } from '../state/GameContext';
import { type SavedGames } from '../storage/gamePersistence';
import {
  flagsSchema,
  NM_STORAGE_KEYS,
  prefsSchema,
  progressSchema,
  statsSchema,
  type Flags,
  type Progress,
} from '../storage/schemas';
import { NumberMatchScreens } from './NumberMatchRoot';

/**
 * A stand-in for the device store. The sessions below are handed to the
 * provider directly, so this is only ever read back — it is what a save
 * actually wrote.
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

const LEVEL1_CELLS = generateLevelBoard(1).filter(isLive).length;

function renderApp(
  flags: Flags = flagsSchema.defaultValue(),
  progress: Progress = progressSchema.defaultValue(),
  sessions: SavedGames = { level: null, daily: null, free: null },
) {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <AppProvider
        initialStats={statsSchema.defaultValue()}
        initialFlags={flags}
        initialProgress={progress}
        initialPrefs={prefsSchema.defaultValue()}
        initialSessions={sessions}
        onExit={onExit}
      >
        <NumberMatchScreens />
      </AppProvider>
    </SettingsProvider>,
  );
  return onExit;
}

const done: Flags = {
  schemaVersion: 1,
  tutorialCompleted: true,
  wildIntroSeen: true,
  stoneIntroSeen: true,
};

/** Lets the saves a background triggers resolve (they are promises, not
 * timers). */
const settle = () => act(async () => undefined);

/** The app goes to background. Android may kill it without another event. */
function background() {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  Reflect.deleteProperty(document, 'visibilityState');
}

/** The suspended board's own clock, as it survives on disk. */
function storedBoardSeconds(): number {
  const raw = deviceStore.get(NM_STORAGE_KEYS.game);
  if (raw === undefined) return 0;
  return (JSON.parse(raw) as { elapsedSeconds: number }).elapsedSeconds;
}

afterEach(() => {
  cleanup();
  deviceStore.clear();
});

describe('first run flow', () => {
  it('shows the 3-step tutorial and starts level 1 right after (spec §17)', async () => {
    const user = userEvent.setup();
    renderApp();

    expect(screen.getByText('Equal, or adds up to 10')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Pick two that connect')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // Level 1 board and the three free actions.
    expect(screen.getByText('Level 1')).toBeInTheDocument();
    const board = screen.getByRole('group', { name: 'Game board' });
    expect(within(board).getAllByRole('button')).toHaveLength(LEVEL1_CELLS);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hint' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
  });
});

describe('home flow', () => {
  it('shows home for returning players and opens statistics', async () => {
    const user = userEvent.setup();
    renderApp(done);

    expect(screen.getByRole('button', { name: /Level 1/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Statistics' }));
    // Three play sections: Levels, Daily Challenge and Free Play, plus the
    // best-score block.
    expect(screen.getAllByText('Games played')).toHaveLength(3);
    expect(screen.getByText('Best Scores')).toBeInTheDocument();
  });

  it('hands control back to the collection from home', async () => {
    const user = userEvent.setup();
    const onExit = renderApp(done);

    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('opens the level select with locked levels beyond the frontier', async () => {
    const user = userEvent.setup();
    renderApp(done, { ...progressSchema.defaultValue(), highestUnlocked: 3 });

    await user.click(screen.getByRole('button', { name: /^Levels/ }));
    expect(screen.getByRole('button', { name: 'Level 3' })).toBeInTheDocument();
    expect(screen.getByLabelText('Level 4, locked')).toBeInTheDocument();
    // Starting an unlocked level goes straight to the board.
    await user.click(screen.getByRole('button', { name: 'Level 2' }));
    expect(screen.getByText('Level 2')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Game board' })).toBeInTheDocument();
  });
});

describe('levels chip', () => {
  it('counts the levels with a recorded best out of the hundred', () => {
    renderApp(done, {
      ...progressSchema.defaultValue(),
      highestUnlocked: 3,
      bestScores: { '1': 200, '2': 180 },
    });
    expect(screen.getByRole('button', { name: /^Levels/ })).toHaveTextContent('2/100');
  });
});

describe('free play (§11)', () => {
  it('starts a board at the chosen tier, and resumes it from the home', async () => {
    const user = userEvent.setup();
    renderApp(done);

    // The picker stands on medium until told otherwise; here, hard.
    const picker = screen.getByRole('group', { name: 'Difficulty' });
    expect(within(picker).getByRole('button', { name: 'Medium' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(within(picker).getByRole('button', { name: 'Hard' }));
    await user.click(screen.getByRole('button', { name: /Free Play/ }));

    // The top bar names the mode and the tier — no level number.
    expect(screen.getByText('Free Play · Hard')).toBeInTheDocument();
    expect(screen.queryByText(/^Level \d/)).not.toBeInTheDocument();

    // A match, then away and back: the board is where it was left.
    const board = screen.getByRole('group', { name: 'Game board' });
    const fresh = within(board).getAllByRole('button').length;
    await user.click(screen.getByRole('button', { name: 'Hint' }));
    const hinted = board.querySelectorAll('.cell-hint');
    await user.click(hinted[0] as HTMLElement);
    await user.click(hinted[1] as HTMLElement);
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByRole('button', { name: /Free Play.*Resume.*Hard/ })).toBeInTheDocument();
    // The level climb is untouched by a free board.
    expect(screen.getByRole('button', { name: /Level 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Levels/ })).toHaveTextContent('0/100');

    await user.click(screen.getByRole('button', { name: /Free Play/ }));
    expect(screen.getByText('Free Play · Hard')).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'Game board' })).getAllByRole('button').length,
    ).toBeLessThan(fresh);
  });

  it('asks before replacing a suspended free board with a new one', async () => {
    const user = userEvent.setup();
    renderApp(done);
    await user.click(screen.getByRole('button', { name: /Free Play/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));

    await user.click(screen.getByRole('button', { name: 'New Game' }));
    expect(screen.getByRole('alertdialog', { name: 'Start a new game?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: /Free Play.*Resume/ })).toBeInTheDocument();
  });
});

describe('gameplay', () => {
  it('hint highlights a valid pair, matching scores it, and undo restores', async () => {
    const user = userEvent.setup();
    renderApp(done);
    await user.click(screen.getByRole('button', { name: /Level 1/ }));

    await user.click(screen.getByRole('button', { name: 'Hint' }));
    const board = screen.getByRole('group', { name: 'Game board' });
    const hinted = board.querySelectorAll('.cell-hint');
    expect(hinted).toHaveLength(2);

    await user.click(hinted[0] as HTMLElement);
    await user.click(hinted[1] as HTMLElement);
    expect(within(board).getAllByRole('button').length).toBeLessThanOrEqual(LEVEL1_CELLS - 2);
    // The match earned points (shown quietly in the top bar).
    const score = document.querySelector('.game-score');
    expect(Number(score!.textContent!.replace(/\D/g, ''))).toBeGreaterThan(0);

    const undoButton = screen.getByRole('button', { name: 'Undo' });
    expect(undoButton).toBeEnabled();
    await user.click(undoButton);
    expect(within(board).getAllByRole('button')).toHaveLength(LEVEL1_CELLS);
  });
});

/* Keyboard input is an adapter over the same tap handlers (issue #93): this
   checks board state the Undo button also produces, never a keyboard-only
   behaviour. */
describe('keyboard (issue #93)', () => {
  it('Ctrl+Z undoes the last match, same as the Undo button', async () => {
    const user = userEvent.setup();
    renderApp(done);
    await user.click(screen.getByRole('button', { name: /Level 1/ }));

    await user.click(screen.getByRole('button', { name: 'Hint' }));
    const board = screen.getByRole('group', { name: 'Game board' });
    const hinted = board.querySelectorAll('.cell-hint');
    await user.click(hinted[0] as HTMLElement);
    await user.click(hinted[1] as HTMLElement);
    expect(within(board).getAllByRole('button').length).toBeLessThanOrEqual(LEVEL1_CELLS - 2);

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(within(board).getAllByRole('button')).toHaveLength(LEVEL1_CELLS);
  });
});

describe('opening a suspended game without resuming (#109)', () => {
  // The board is not the only thing a suspended game carries — the minutes on
  // its clock are the player's too. `syncActiveGame` runs on every background
  // from whichever screen is showing, and it writes this provider's play clock
  // into the session it saves. Open the game, never press Resume, background:
  // a clock that never took the restored board's seconds saves a zero over
  // them, and the board comes back looking untouched.
  it("keeps a suspended board's clock when backgrounded from the game's home", async () => {
    // A level board suspended with nine seconds on it, the way the last launch
    // left it on disk.
    const suspended = { ...createLevelSession(1), elapsedSeconds: 9 };
    renderApp(done, progressSchema.defaultValue(), {
      level: suspended,
      daily: null,
      free: null,
    });

    // The game's own home — Resume is there to be pressed, and is not.
    expect(screen.getByRole('button', { name: 'Statistics' })).toBeInTheDocument();

    background();
    await settle();
    expect(storedBoardSeconds()).toBe(9);
  });
});
