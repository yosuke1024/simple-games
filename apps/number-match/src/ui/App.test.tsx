import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { AppProvider } from '../state/AppContext';
import { SettingsProvider } from '../state/SettingsContext';
import { flagsSchema, settingsSchema, statsSchema, type Flags } from '../storage/schemas';
import { App } from './App';

function renderApp(flags: Flags = flagsSchema.defaultValue()) {
  return render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <AppProvider
        initialStats={statsSchema.defaultValue()}
        initialFlags={flags}
        initialSession={null}
      >
        <App />
      </AppProvider>
    </SettingsProvider>,
  );
}

afterEach(cleanup);

describe('first run flow', () => {
  it('shows the 3-step tutorial and starts a game right after (spec §17)', async () => {
    const user = userEvent.setup();
    renderApp();

    // Tutorial, step 1 → 2 → 3, then straight into a Classic game.
    expect(screen.getByText('Equal, or adds up to 10')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Pick two that connect')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // Game screen: board with 27 live cells and the three free actions.
    const board = screen.getByRole('group', { name: 'Game board' });
    expect(within(board).getAllByRole('button')).toHaveLength(27);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hint' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
  });
});

describe('home flow', () => {
  it('shows home for returning players and opens statistics', async () => {
    const user = userEvent.setup();
    renderApp({ schemaVersion: 1, tutorialCompleted: true });

    expect(screen.getByRole('button', { name: 'New Game' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Statistics' }));
    // Two sections: Classic and Daily Challenge.
    expect(screen.getAllByText('Games played')).toHaveLength(2);
  });
});

describe('gameplay', () => {
  it('hint highlights a valid pair, and tapping it clears the cells', async () => {
    const user = userEvent.setup();
    renderApp({ schemaVersion: 1, tutorialCompleted: true });
    await user.click(screen.getByRole('button', { name: 'New Game' }));

    await user.click(screen.getByRole('button', { name: 'Hint' }));
    const board = screen.getByRole('group', { name: 'Game board' });
    const hinted = board.querySelectorAll('.cell-hint');
    expect(hinted).toHaveLength(2);

    await user.click(hinted[0] as HTMLElement);
    await user.click(hinted[1] as HTMLElement);
    // Two cells were cleared (board may collapse rows, so count live buttons).
    expect(within(board).getAllByRole('button').length).toBeLessThanOrEqual(25);
    // Undo becomes available and restores the pair.
    const undoButton = screen.getByRole('button', { name: 'Undo' });
    expect(undoButton).toBeEnabled();
    await user.click(undoButton);
    expect(within(board).getAllByRole('button')).toHaveLength(27);
  });
});

describe('settings', () => {
  it('toggles sound and switches theme', async () => {
    const user = userEvent.setup();
    renderApp({ schemaVersion: 1, tutorialCompleted: true });
    await user.click(screen.getByRole('button', { name: 'Settings' }));

    const soundSwitch = screen.getByRole('switch', { name: 'Sound' });
    expect(soundSwitch).toHaveAttribute('aria-checked', 'true');
    await user.click(soundSwitch);
    expect(soundSwitch).toHaveAttribute('aria-checked', 'false');

    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
