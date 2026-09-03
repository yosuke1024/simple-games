/**
 * The clear screen shows the run's facts and nothing that ranks the player
 * (docs/MEMORY_MATCH_RULES.md §9) — no score, no streak, and each personal
 * best mentioned once, quietly, with the margin against it when there is one.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { createDifficultySession, type MemorySession } from '../../game';
import type { LastResult } from '../../state/GameContext';
import { MemoryResultOverlay } from './MemoryResultOverlay';

/** An easy board at its end, with the facts the card reads off it. */
function solvedSession(elapsedSeconds: number, moveCount: number): MemorySession {
  return { ...createDifficultySession('easy'), status: 'solved', elapsedSeconds, moveCount };
}

function renderOverlay(session: MemorySession, lastResult: LastResult | null) {
  const onRetry = vi.fn();
  const onHome = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <MemoryResultOverlay
        session={session}
        lastResult={lastResult}
        onRetry={onRetry}
        onHome={onHome}
      />
    </SettingsProvider>,
  );
  return { onRetry, onHome };
}

afterEach(cleanup);

describe('MemoryResultOverlay', () => {
  it('shows nothing while the game is still in progress', () => {
    renderOverlay(createDifficultySession('easy'), null);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('reports moves and time — and no score', () => {
    renderOverlay(solvedSession(125, 43), {
      isNewBestMoves: false,
      isNewBestTime: false,
      bestMoves: 40,
      bestSeconds: 100,
      previousBestMoves: 40,
      previousBestSeconds: 100,
      moves: 43,
      seconds: 125,
    });
    expect(screen.getByRole('alertdialog', { name: 'All pairs found!' })).toBeInTheDocument();
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
    renderOverlay(solvedSession(90, 35), {
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
    renderOverlay(solvedSession(90, 35), {
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

  it('offers the same board again, and home', async () => {
    const user = userEvent.setup();
    const { onRetry, onHome } = renderOverlay(solvedSession(60, 20), null);
    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(onHome).toHaveBeenCalledTimes(1);
  });
});
