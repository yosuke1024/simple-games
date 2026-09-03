/**
 * The result card (§12): the score and its parts, the record it was measured
 * against and how far off it was, and the way onward — which differs by mode.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { createFreeSession, createLevelSession, MAX_LEVEL, type GameSession } from '../../game';
import type { LastResult } from '../../state/GameContext';
import { ResultOverlay } from './ResultOverlay';

/** A session at its natural break, with a score to show. */
function ended(session: GameSession, status: 'cleared' | 'gameOver', total: number): GameSession {
  return {
    ...session,
    status,
    elapsedSeconds: 75,
    moveCount: 12,
    score: { ...session.score, total, matchPoints: total },
  };
}

function renderOverlay(session: GameSession, lastResult: LastResult | null) {
  const onRetry = vi.fn();
  const onNextLevel = vi.fn();
  const onNewFree = vi.fn();
  const onHome = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <ResultOverlay
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

describe('ResultOverlay', () => {
  it('renders nothing while the game is still going', () => {
    renderOverlay(createLevelSession(1), null);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('states the best it was measured against, and how far off this run was', () => {
    renderOverlay(ended(createLevelSession(2), 'cleared', 250), {
      isNewBest: false,
      bestScore: 300,
      previousBestScore: 300,
    });
    expect(screen.getByRole('alertdialog', { name: 'Board cleared!' })).toBeInTheDocument();
    expect(document.querySelector('.score-total')).toHaveTextContent('250');
    // The record is stated, not celebrated — with how far short this run fell.
    expect(screen.getByText('Best 300')).toBeInTheDocument();
    expect(screen.getByText('−50')).not.toHaveClass('result-delta-better');
    expect(screen.queryByText('New best!')).not.toBeInTheDocument();
  });

  it('marks a personal best exactly once, with the margin it was won by', () => {
    renderOverlay(ended(createLevelSession(2), 'cleared', 350), {
      isNewBest: true,
      bestScore: 350,
      previousBestScore: 300,
    });
    expect(screen.getAllByText('New best!')).toHaveLength(1);
    expect(screen.getByText('+50')).toHaveClass('result-delta-better');
  });

  it('has no margin to give on a first clear', () => {
    renderOverlay(ended(createLevelSession(2), 'cleared', 350), {
      isNewBest: true,
      bestScore: 350,
      previousBestScore: null,
    });
    expect(screen.getByText('New best!')).toBeInTheDocument();
    expect(screen.queryByText(/^[+−±]/)).not.toBeInTheDocument();
  });

  it('offers the next level after a level clear, and nothing past the last', async () => {
    const user = userEvent.setup();
    const { onNextLevel } = renderOverlay(ended(createLevelSession(2), 'cleared', 100), null);
    await user.click(screen.getByRole('button', { name: 'Next Level' }));
    expect(onNextLevel).toHaveBeenCalledTimes(1);
    cleanup();
    renderOverlay(ended(createLevelSession(MAX_LEVEL), 'cleared', 100), null);
    expect(screen.queryByRole('button', { name: 'Next Level' })).not.toBeInTheDocument();
  });

  it('offers another board at the same tier after a free one (§11)', async () => {
    const user = userEvent.setup();
    const { onNewFree, onNextLevel } = renderOverlay(
      ended(createFreeSession('medium'), 'cleared', 100),
      null,
    );
    expect(screen.queryByRole('button', { name: 'Next Level' })).not.toBeInTheDocument();
    // No record to state either: a free board is compared with nothing.
    expect(screen.queryByText(/^Best/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New Game' }));
    expect(onNewFree).toHaveBeenCalledTimes(1);
    expect(onNextLevel).not.toHaveBeenCalled();
  });

  it('leaves the retry and home after a dead end — plus a new board for free play', async () => {
    const user = userEvent.setup();
    const { onRetry } = renderOverlay(ended(createLevelSession(2), 'gameOver', 40), null);
    expect(screen.getByRole('alertdialog', { name: 'No more moves' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next Level' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New Game' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    cleanup();
    renderOverlay(ended(createFreeSession('easy'), 'gameOver', 40), null);
    expect(screen.getByRole('button', { name: 'New Game' })).toBeInTheDocument();
  });
});
