/**
 * The two cards say the run's facts and nothing that ranks the player
 * (docs/GAME_2048_RULES.md §9, §12): the ending states the record once, with
 * how far this run was from it; the reach states nothing but the score.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { createSession, type Game2048Session } from '../../game';
import type { LastResult } from '../../state/GameContext';
import { MergeResultOverlay } from './MergeResultOverlay';

/** A board declared out of moves — the overlay reads the status, not the tiles. */
function overSession(score: number): Game2048Session {
  return { ...createSession('merge-overlay-test'), status: 'over', score };
}

function renderOverlay(
  session: Game2048Session,
  lastResult: LastResult | null,
  announceReached = false,
) {
  const onKeepGoing = vi.fn();
  const onNewGame = vi.fn();
  const onHome = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <MergeResultOverlay
        session={session}
        lastResult={lastResult}
        announceReached={announceReached}
        onKeepGoing={onKeepGoing}
        onNewGame={onNewGame}
        onHome={onHome}
      />
    </SettingsProvider>,
  );
  return { onKeepGoing, onNewGame, onHome };
}

afterEach(cleanup);

describe('MergeResultOverlay', () => {
  it('shows nothing while the board still has moves and nothing to announce', () => {
    renderOverlay(createSession('merge-overlay-test'), null);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('states the record with how far short this run fell', () => {
    renderOverlay(overSession(800), {
      score: 800,
      bestScore: 1000,
      previousBestScore: 1000,
      bestTile: 128,
      isNewBestScore: false,
    });

    expect(screen.getByRole('alertdialog', { name: 'No moves left' })).toBeInTheDocument();
    expect(screen.getByText(/Best score/)).toHaveTextContent('1000');
    expect(screen.getByText('−200')).not.toHaveClass('result-delta-better');
  });

  it('marks a new record exactly once, with the margin it was won by', () => {
    renderOverlay(overSession(1200), {
      score: 1200,
      bestScore: 1200,
      previousBestScore: 1000,
      bestTile: 256,
      isNewBestScore: true,
    });
    expect(screen.getAllByText(/Your best score yet/)).toHaveLength(1);
    expect(screen.getByText('+200')).toHaveClass('result-delta-better');
  });

  it('has no margin to give on a first game', () => {
    renderOverlay(overSession(300), {
      score: 300,
      bestScore: 300,
      previousBestScore: null,
      bestTile: 64,
      isNewBestScore: true,
    });
    expect(screen.queryByText(/^[+−±]/)).not.toBeInTheDocument();
  });

  it('announces the reach with no record line — the board is still open', () => {
    renderOverlay(createSession('merge-overlay-test'), null, true);
    expect(screen.getByRole('alertdialog', { name: 'You reached 2048!' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep Going' })).toBeInTheDocument();
    expect(screen.queryByText(/Best score/)).not.toBeInTheDocument();
  });
});
