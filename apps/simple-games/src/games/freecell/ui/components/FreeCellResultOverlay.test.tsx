/**
 * The win screen shows the run's facts and nothing that ranks the player
 * (docs/FREECELL_RULES.md §9, §12): moves and time, each record mentioned
 * once, and how far this run was from it.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { createFreeSession, type FreeCellSession } from '../../game';
import type { LastResult } from '../../state/GameContext';
import { FreeCellResultOverlay } from './FreeCellResultOverlay';

/** A free deal declared won — the overlay reads the status, not the board. */
function wonSession(moves: number, seconds: number): FreeCellSession {
  return { ...createFreeSession(), status: 'won', moveCount: moves, elapsedSeconds: seconds };
}

function renderOverlay(session: FreeCellSession, lastResult: LastResult | null) {
  const onNewDeal = vi.fn();
  const onRetry = vi.fn();
  const onHome = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <FreeCellResultOverlay
        session={session}
        lastResult={lastResult}
        onNewDeal={onNewDeal}
        onRetry={onRetry}
        onHome={onHome}
      />
    </SettingsProvider>,
  );
  return { onNewDeal, onRetry, onHome };
}

afterEach(cleanup);

describe('FreeCellResultOverlay', () => {
  it('shows nothing while the deal is still in play', () => {
    renderOverlay(createFreeSession(), null);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('states both records with how far off this run was', () => {
    renderOverlay(wonSession(130, 200), {
      isNewBestMoves: false,
      isNewBestTime: false,
      bestMoves: 110,
      bestSeconds: 182,
      previousBestMoves: 110,
      previousBestSeconds: 182,
      moves: 130,
      seconds: 200,
    });

    expect(screen.getByRole('alertdialog', { name: 'You won!' })).toBeInTheDocument();
    // Each record is stated, not celebrated — with how far off it was.
    expect(screen.getByText(/Fewest moves/)).toHaveTextContent('110');
    expect(screen.getByText('+20')).not.toHaveClass('result-delta-better');
    expect(screen.getByText(/Fastest clear/)).toHaveTextContent('3:02');
    expect(screen.getByText('+0:18')).not.toHaveClass('result-delta-better');
    expect(screen.queryByText(/score/i)).not.toBeInTheDocument();
  });

  it('marks each new record exactly once, with the margin it was won by', () => {
    renderOverlay(wonSession(100, 170), {
      isNewBestMoves: true,
      isNewBestTime: true,
      bestMoves: 100,
      bestSeconds: 170,
      previousBestMoves: 110,
      previousBestSeconds: 182,
      moves: 100,
      seconds: 170,
    });
    expect(screen.getAllByText(/Your fewest moves yet/)).toHaveLength(1);
    expect(screen.getByText('−10')).toHaveClass('result-delta-better');
    expect(screen.getAllByText(/Your fastest yet/)).toHaveLength(1);
    expect(screen.getByText('−0:12')).toHaveClass('result-delta-better');
  });

  it('has no margin to give on a first win', () => {
    renderOverlay(wonSession(100, 170), {
      isNewBestMoves: true,
      isNewBestTime: true,
      bestMoves: 100,
      bestSeconds: 170,
      previousBestMoves: null,
      previousBestSeconds: null,
      moves: 100,
      seconds: 170,
    });
    expect(screen.queryByText(/^[+−±]/)).not.toBeInTheDocument();
  });
});
