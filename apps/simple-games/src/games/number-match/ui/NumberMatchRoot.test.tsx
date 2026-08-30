import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { generateLevelBoard, isLive } from '../game';
import { AppProvider } from '../state/GameContext';
import {
  flagsSchema,
  progressSchema,
  statsSchema,
  type Flags,
  type Progress,
} from '../storage/schemas';
import { NumberMatchScreens } from './NumberMatchRoot';

const LEVEL1_CELLS = generateLevelBoard(1).filter(isLive).length;

function renderApp(
  flags: Flags = flagsSchema.defaultValue(),
  progress: Progress = progressSchema.defaultValue(),
) {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <AppProvider
        initialStats={statsSchema.defaultValue()}
        initialFlags={flags}
        initialProgress={progress}
        initialSessions={{ level: null, daily: null }}
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

afterEach(cleanup);

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
    // Two play sections: Levels and Daily Challenge, plus the best-score block.
    expect(screen.getAllByText('Games played')).toHaveLength(2);
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

    await user.click(screen.getByRole('button', { name: 'Levels' }));
    expect(screen.getByRole('button', { name: 'Level 3' })).toBeInTheDocument();
    expect(screen.getByLabelText('Level 4, locked')).toBeInTheDocument();
    // Starting an unlocked level goes straight to the board.
    await user.click(screen.getByRole('button', { name: 'Level 2' }));
    expect(screen.getByText('Level 2')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Game board' })).toBeInTheDocument();
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
