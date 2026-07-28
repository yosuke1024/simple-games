import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { initialCellsForLevel } from '../game';
import { AppProvider } from '../state/AppContext';
import { SettingsProvider } from '../state/SettingsContext';
import {
  flagsSchema,
  progressSchema,
  settingsSchema,
  statsSchema,
  type Flags,
  type Progress,
} from '../storage/schemas';
import { App } from './App';

const LEVEL1_CELLS = initialCellsForLevel(1);

function renderApp(
  flags: Flags = flagsSchema.defaultValue(),
  progress: Progress = progressSchema.defaultValue(),
) {
  return render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <AppProvider
        initialStats={statsSchema.defaultValue()}
        initialFlags={flags}
        initialProgress={progress}
        initialSession={null}
      >
        <App />
      </AppProvider>
    </SettingsProvider>,
  );
}

const done: Flags = { schemaVersion: 1, tutorialCompleted: true };

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

  it('opens the level select with locked levels beyond the frontier', async () => {
    const user = userEvent.setup();
    renderApp(done, { ...progressSchema.defaultValue(), highestUnlocked: 3 });

    await user.click(screen.getByRole('button', { name: 'Select Level' }));
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

describe('settings', () => {
  it('toggles sound and switches theme', async () => {
    const user = userEvent.setup();
    renderApp(done);
    await user.click(screen.getByRole('button', { name: 'Settings' }));

    const soundSwitch = screen.getByRole('switch', { name: 'Sound' });
    expect(soundSwitch).toHaveAttribute('aria-checked', 'true');
    await user.click(soundSwitch);
    expect(soundSwitch).toHaveAttribute('aria-checked', 'false');

    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
