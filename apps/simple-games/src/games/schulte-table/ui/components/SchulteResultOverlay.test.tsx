/**
 * The finish screen shows the round's facts and nothing that ranks the player
 * (docs/SCHULTE_TABLE_RULES.md §10) — no score, no streak, and a personal
 * best mentioned once, quietly, with the margin against it when there is one.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { createLevelSession, type SchulteSession } from '../../game';
import type { LastResult } from '../../state/GameContext';
import { SchulteResultOverlay } from './SchulteResultOverlay';

/** A level at its end, with the facts the card reads off it. */
function clearedSession(level: number, elapsedSeconds: number): SchulteSession {
  return { ...createLevelSession(level), status: 'cleared', elapsedSeconds, missCount: 2 };
}

function renderOverlay(session: SchulteSession, lastResult: LastResult | null) {
  const onRetry = vi.fn();
  const onNextLevel = vi.fn();
  const onHome = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <SchulteResultOverlay
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

describe('SchulteResultOverlay', () => {
  it('shows nothing while the round is still in progress', () => {
    renderOverlay(createLevelSession(1), null);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('reports time and wrong taps — and no score', () => {
    renderOverlay(clearedSession(1, 125), {
      isNewBest: false,
      bestSeconds: 100,
      previousBestSeconds: 100,
      seconds: 125,
      misses: 2,
    });
    expect(screen.getByRole('alertdialog', { name: 'All found' })).toBeInTheDocument();
    expect(screen.getByText('2:05')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    // The previous best is stated, not celebrated — with how far off it was.
    expect(screen.getByText(/1:40/)).toBeInTheDocument();
    expect(screen.getByText('+0:25')).toBeInTheDocument();
    expect(screen.queryByText(/score/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });

  it('marks a personal best exactly once, with the margin it was won by', () => {
    renderOverlay(clearedSession(1, 90), {
      isNewBest: true,
      bestSeconds: 90,
      previousBestSeconds: 100,
      seconds: 90,
      misses: 0,
    });
    expect(screen.getAllByText('Your fastest yet.')).toHaveLength(1);
    expect(screen.getByText('−0:10')).toHaveClass('result-delta-better');
  });

  it('has no margin to give on a first clear', () => {
    renderOverlay(clearedSession(1, 90), {
      isNewBest: true,
      bestSeconds: 90,
      previousBestSeconds: null,
      seconds: 90,
      misses: 0,
    });
    expect(screen.queryByText(/^[+−±]/)).not.toBeInTheDocument();
  });

  it('offers the next level for a level round', async () => {
    const user = userEvent.setup();
    const { onNextLevel, onHome } = renderOverlay(clearedSession(2, 60), null);
    await user.click(screen.getByRole('button', { name: 'Next Level' }));
    expect(onNextLevel).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(onHome).toHaveBeenCalledTimes(1);
  });
});
