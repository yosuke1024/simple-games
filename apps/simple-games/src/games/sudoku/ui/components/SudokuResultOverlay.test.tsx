/**
 * The clear screen shows the run's facts and nothing that ranks the player
 * (docs/SUDOKU_RULES.md §12) — no score, no streak, and a personal best
 * mentioned once, quietly.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { CELLS, createLevelSession, type Digit, type SudokuSession } from '../../game';
import { placeDigit } from '../../game';
import type { LastResult } from '../../state/GameContext';
import { SudokuResultOverlay } from './SudokuResultOverlay';

/** Plays a level to completion so the overlay has a real solved session. */
function solvedSession(level: number, elapsedSeconds: number): SudokuSession {
  let session = createLevelSession(level);
  for (let i = 0; i < CELLS; i++) {
    if (session.board.givens[i] !== 0) continue;
    const next = placeDigit(session, i, session.solution[i]! as Digit);
    if (next) session = next;
  }
  return { ...session, elapsedSeconds, mistakeCount: 2, hintCount: 1 };
}

function renderOverlay(session: SudokuSession, lastResult: LastResult | null) {
  const onRetry = vi.fn();
  const onNextLevel = vi.fn();
  const onHome = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <SudokuResultOverlay
        session={session}
        lastResult={lastResult}
        onRetry={onRetry}
        onNextLevel={onNextLevel}
        onHome={onHome}
      />
    </SettingsProvider>,
  );
  return { onRetry, onNextLevel, onHome };
}

afterEach(cleanup);

describe('SudokuResultOverlay', () => {
  it('shows nothing while the game is still in progress', () => {
    renderOverlay(createLevelSession(1), null);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('reports time, mistakes and hints — and no score', () => {
    const session = solvedSession(1, 125);
    renderOverlay(session, {
      isNewBest: false,
      bestSeconds: 100,
      previousBestSeconds: 100,
      seconds: 125,
      mistakes: 2,
      hints: 1,
    });

    expect(screen.getByRole('alertdialog', { name: 'Solved!' })).toBeInTheDocument();
    expect(screen.getByText('2:05')).toBeInTheDocument();
    expect(screen.getByText('Mistakes')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Hint')).toBeInTheDocument();
    // The previous best is stated, not celebrated — with how far off it was.
    expect(screen.getByText(/1:40/)).toBeInTheDocument();
    expect(screen.getByText('+0:25')).toBeInTheDocument();
    expect(screen.queryByText(/score/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });

  it('marks a personal best exactly once, with the margin it was won by', () => {
    renderOverlay(solvedSession(1, 90), {
      isNewBest: true,
      bestSeconds: 90,
      previousBestSeconds: 100,
      seconds: 90,
      mistakes: 0,
      hints: 0,
    });
    expect(screen.getAllByText('Your fastest yet.')).toHaveLength(1);
    expect(screen.getByText('−0:10')).toHaveClass('result-delta-better');
  });

  it('has no margin to give on a first clear', () => {
    renderOverlay(solvedSession(1, 90), {
      isNewBest: true,
      bestSeconds: 90,
      previousBestSeconds: null,
      seconds: 90,
      mistakes: 0,
      hints: 0,
    });
    expect(screen.queryByText(/^[+−±]/)).not.toBeInTheDocument();
  });

  it('offers the next level for a level game', async () => {
    const user = userEvent.setup();
    const { onNextLevel, onRetry, onHome } = renderOverlay(solvedSession(2, 60), null);

    await user.click(screen.getByRole('button', { name: 'Next Level' }));
    expect(onNextLevel).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it('has no next level for a daily game', () => {
    const daily = {
      ...solvedSession(1, 60),
      mode: 'daily' as const,
      level: null,
      dailyDate: '2026-08-01',
    };
    renderOverlay(daily, null);
    expect(screen.queryByRole('button', { name: 'Next Level' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry same board' })).toBeInTheDocument();
  });
});
