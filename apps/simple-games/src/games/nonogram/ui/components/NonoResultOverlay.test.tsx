/**
 * The clear screen shows the run's facts and nothing that ranks the player
 * (docs/NONOGRAM_RULES.md §8, §9) — no score, no streak, and a personal best
 * mentioned once, quietly, with how far it moved.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import {
  createDailySession,
  createFreeSession,
  createLevelSession,
  paintCell,
  PAINTED,
  type NonogramSession,
} from '../../game';
import type { LastResult } from '../../state/GameContext';
import { NonoResultOverlay } from './NonoResultOverlay';

/** Paints exactly the solution — the honest way to finish any session. */
function solved(session: NonogramSession, elapsedSeconds: number): NonogramSession {
  let current = session;
  session.solution.forEach((cell, index) => {
    if (cell !== PAINTED) return;
    const next = paintCell(current, index);
    if (next !== null) current = next;
  });
  return { ...current, elapsedSeconds, hintCount: 1 };
}

function renderOverlay(session: NonogramSession, lastResult: LastResult | null) {
  const onRetry = vi.fn();
  const onNextLevel = vi.fn();
  const onNewFree = vi.fn();
  const onHome = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <NonoResultOverlay
        session={session}
        lastResult={lastResult}
        onRetry={onRetry}
        onNextLevel={onNextLevel}
        onNewFree={onNewFree}
        onHome={onHome}
      />
    </SettingsProvider>,
  );
  return { onRetry, onNextLevel, onNewFree, onHome };
}

afterEach(cleanup);

describe('NonoResultOverlay', () => {
  it('shows nothing while the game is still in progress', () => {
    renderOverlay(createLevelSession(1), null);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('reports time and hints — and no score', () => {
    renderOverlay(solved(createLevelSession(1), 125), {
      seconds: 125,
      hints: 1,
      isNewBestTime: false,
      bestSeconds: 100,
      previousBestSeconds: 100,
    });

    expect(screen.getByRole('alertdialog', { name: 'Solved!' })).toBeInTheDocument();
    expect(screen.getByText('2:05')).toBeInTheDocument();
    expect(screen.getByText('Hints used')).toBeInTheDocument();
    // The previous best is stated, not celebrated — with how far off it was.
    expect(screen.getByText(/1:40/)).toBeInTheDocument();
    expect(screen.getByText('+0:25')).toBeInTheDocument();
    expect(screen.queryByText(/score/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });

  it('marks a personal best exactly once, with the margin it was won by', () => {
    renderOverlay(solved(createLevelSession(1), 90), {
      seconds: 90,
      hints: 0,
      isNewBestTime: true,
      bestSeconds: 90,
      previousBestSeconds: 100,
    });
    expect(screen.getAllByText('Your fastest yet.')).toHaveLength(1);
    expect(screen.getByText('−0:10')).toHaveClass('result-delta-better');
  });

  it('has no margin to give on a first clear', () => {
    renderOverlay(solved(createLevelSession(1), 90), {
      seconds: 90,
      hints: 0,
      isNewBestTime: true,
      bestSeconds: 90,
      previousBestSeconds: null,
    });
    expect(screen.queryByText(/^[+−±]/)).not.toBeInTheDocument();
  });

  it('offers the next level for a level game', async () => {
    const user = userEvent.setup();
    const { onNextLevel, onRetry, onHome } = renderOverlay(solved(createLevelSession(2), 60), null);

    await user.click(screen.getByRole('button', { name: 'Next Level' }));
    expect(onNextLevel).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it('offers another board at the same tier after a free one (§6)', async () => {
    const user = userEvent.setup();
    const { onNewFree, onNextLevel } = renderOverlay(solved(createFreeSession('easy'), 60), null);
    expect(screen.queryByRole('button', { name: 'Next Level' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New Game' }));
    expect(onNewFree).toHaveBeenCalledTimes(1);
    expect(onNextLevel).not.toHaveBeenCalled();
  });

  it('has no next level for a daily game', () => {
    renderOverlay(solved(createDailySession('2026-08-01'), 60), null);
    expect(screen.queryByRole('button', { name: 'Next Level' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New Game' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry same board' })).toBeInTheDocument();
  });
});
