/**
 * The result card states the run's facts and the player's own record
 * (docs/MINESWEEPER_RULES.md §9) — no score, no streak, a best mentioned
 * once, and the margin against it only when a win set one.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { createDifficultySession, type GameStatus, type MinesweeperSession } from '../../game';
import type { LastResult } from '../../state/GameContext';
import { MinesResultOverlay } from './MinesResultOverlay';

/** An easy board at its end, with the facts the card reads off it. */
function endedSession(status: GameStatus, elapsedSeconds: number): MinesweeperSession {
  return { ...createDifficultySession('easy'), status, elapsedSeconds, hintCount: 1 };
}

function renderOverlay(session: MinesweeperSession, lastResult: LastResult | null) {
  const onRetry = vi.fn();
  const onNewBoard = vi.fn();
  const onHome = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <MinesResultOverlay
        session={session}
        lastResult={lastResult}
        onRetry={onRetry}
        onNewBoard={onNewBoard}
        onHome={onHome}
      />
    </SettingsProvider>,
  );
  return { onRetry, onNewBoard, onHome };
}

afterEach(cleanup);

describe('MinesResultOverlay', () => {
  it('shows nothing while the game is still in progress', () => {
    renderOverlay(createDifficultySession('easy'), null);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('states the record after a slower win, with how far off it was', () => {
    renderOverlay(endedSession('won', 125), {
      won: true,
      seconds: 125,
      hints: 1,
      isNewBest: false,
      bestSeconds: 100,
      previousBestSeconds: 100,
    });
    expect(screen.getByRole('alertdialog', { name: 'Cleared!' })).toBeInTheDocument();
    expect(screen.getByText('2:05')).toBeInTheDocument();
    expect(screen.getByText(/1:40/)).toBeInTheDocument();
    expect(screen.getByText('+0:25')).toBeInTheDocument();
    expect(screen.queryByText(/score/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });

  it('marks a personal best exactly once, with the margin it was won by', () => {
    renderOverlay(endedSession('won', 90), {
      won: true,
      seconds: 90,
      hints: 1,
      isNewBest: true,
      bestSeconds: 90,
      previousBestSeconds: 100,
    });
    expect(screen.getAllByText('Your fastest yet.')).toHaveLength(1);
    expect(screen.getByText('−0:10')).toHaveClass('result-delta-better');
  });

  it('has no margin to give on a first win', () => {
    renderOverlay(endedSession('won', 90), {
      won: true,
      seconds: 90,
      hints: 1,
      isNewBest: true,
      bestSeconds: 90,
      previousBestSeconds: null,
    });
    expect(screen.queryByText(/^[+−±]/)).not.toBeInTheDocument();
  });

  it('states the record after a loss but measures nothing against it', () => {
    renderOverlay(endedSession('lost', 40), {
      won: false,
      seconds: 40,
      hints: 1,
      isNewBest: false,
      bestSeconds: 100,
      previousBestSeconds: null,
    });
    expect(screen.getByRole('alertdialog', { name: 'Mine opened' })).toBeInTheDocument();
    expect(screen.getByText(/1:40/)).toBeInTheDocument();
    expect(screen.queryByText(/^[+−±]/)).not.toBeInTheDocument();
  });
});
