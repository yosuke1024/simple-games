/**
 * The end-of-run card says the run's facts and nothing that ranks the player
 * (docs/BUNNY_HOP_RULES.md §9, §12): the record stated once, with how far
 * this run was from it.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import type { LastResult } from '../../state/GameContext';
import { BunnyResultOverlay } from './BunnyResultOverlay';

function renderOverlay(result: LastResult | null) {
  const onRunAgain = vi.fn();
  const onHome = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <BunnyResultOverlay result={result} onRunAgain={onRunAgain} onHome={onHome} />
    </SettingsProvider>,
  );
  return { onRunAgain, onHome };
}

afterEach(cleanup);

describe('BunnyResultOverlay', () => {
  it('shows nothing while the run is still going', () => {
    renderOverlay(null);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('states the record with how far short this run fell', () => {
    renderOverlay({
      score: 640,
      obstaclesPassed: 12,
      isNewBestScore: false,
      bestScore: 874,
      previousBestScore: 874,
    });

    expect(screen.getByRole('alertdialog', { name: 'Bumped' })).toBeInTheDocument();
    expect(screen.getByText(/Best score/)).toHaveTextContent('874');
    expect(screen.getByText('−234')).not.toHaveClass('result-delta-better');
  });

  it('marks a new record exactly once, with the margin it was won by', () => {
    renderOverlay({
      score: 900,
      obstaclesPassed: 17,
      isNewBestScore: true,
      bestScore: 900,
      previousBestScore: 874,
    });
    expect(screen.getAllByText(/Your best score yet/)).toHaveLength(1);
    expect(screen.getByText('+26')).toHaveClass('result-delta-better');
  });

  it('has no margin to give on a first run', () => {
    renderOverlay({
      score: 300,
      obstaclesPassed: 5,
      isNewBestScore: true,
      bestScore: 300,
      previousBestScore: null,
    });
    expect(screen.queryByText(/^[+−±]/)).not.toBeInTheDocument();
  });
});
