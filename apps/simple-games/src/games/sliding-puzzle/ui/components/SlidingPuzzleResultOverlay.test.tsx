/**
 * The clear screen shows the run's facts and nothing that ranks the player
 * (docs/SLIDING_PUZZLE_RULES.md §9) — no score, no streak, and each personal
 * best mentioned once, quietly, with the margin against it when there is one.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { createLevelSession, type SlidingPuzzleSession } from '../../game';
import type { LastResult } from '../../state/GameContext';
import { SlidingPuzzleResultOverlay } from './SlidingPuzzleResultOverlay';

/** A level at its end, with the facts the card reads off it. */
function solvedSession(
  level: number,
  elapsedSeconds: number,
  moveCount: number,
): SlidingPuzzleSession {
  return { ...createLevelSession(level), status: 'solved', elapsedSeconds, moveCount };
}

function renderOverlay(session: SlidingPuzzleSession, lastResult: LastResult | null) {
  const onRetry = vi.fn();
  const onNextLevel = vi.fn();
  const onHome = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <SlidingPuzzleResultOverlay
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

describe('SlidingPuzzleResultOverlay', () => {
  it('shows nothing while the game is still in progress', () => {
    renderOverlay(createLevelSession(1), null);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('reports moves and time — and no score', () => {
    renderOverlay(solvedSession(1, 125, 43), {
      isNewBestMoves: false,
      isNewBestTime: false,
      bestMoves: 40,
      bestSeconds: 100,
      previousBestMoves: 40,
      previousBestSeconds: 100,
      moves: 43,
      seconds: 125,
    });
    expect(screen.getByRole('alertdialog', { name: 'Solved!' })).toBeInTheDocument();
    expect(screen.getByText('43')).toBeInTheDocument();
    expect(screen.getByText('2:05')).toBeInTheDocument();
    // Each previous best is stated, not celebrated — with how far off it was.
    expect(screen.getByText(/Fewest moves 40/)).toBeInTheDocument();
    expect(screen.getByText('+3')).toBeInTheDocument();
    expect(screen.getByText(/1:40/)).toBeInTheDocument();
    expect(screen.getByText('+0:25')).toBeInTheDocument();
    expect(screen.queryByText(/score/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });

  it('marks each personal best exactly once, with the margin it was won by', () => {
    renderOverlay(solvedSession(1, 90, 35), {
      isNewBestMoves: true,
      isNewBestTime: true,
      bestMoves: 35,
      bestSeconds: 90,
      previousBestMoves: 40,
      previousBestSeconds: 100,
      moves: 35,
      seconds: 90,
    });
    expect(screen.getAllByText('Your fewest moves yet.')).toHaveLength(1);
    expect(screen.getByText('−5')).toHaveClass('result-delta-better');
    expect(screen.getAllByText('Your fastest yet.')).toHaveLength(1);
    expect(screen.getByText('−0:10')).toHaveClass('result-delta-better');
  });

  it('has no margin to give on a first clear', () => {
    renderOverlay(solvedSession(1, 90, 35), {
      isNewBestMoves: true,
      isNewBestTime: true,
      bestMoves: 35,
      bestSeconds: 90,
      previousBestMoves: null,
      previousBestSeconds: null,
      moves: 35,
      seconds: 90,
    });
    expect(screen.queryByText(/^[+−±]/)).not.toBeInTheDocument();
  });

  it('offers the next level for a level game', async () => {
    const user = userEvent.setup();
    const { onNextLevel, onHome } = renderOverlay(solvedSession(2, 60, 20), null);
    await user.click(screen.getByRole('button', { name: 'Next Level' }));
    expect(onNextLevel).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(onHome).toHaveBeenCalledTimes(1);
  });
});
