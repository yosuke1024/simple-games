/**
 * The end-of-run card says the run's facts and nothing that ranks the player
 * (docs/SKY_FIGHTER_RULES.md §9, §12): the record stated once, with how far
 * this run was from it — the same on a clear and on a loss.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import type { LastResult } from '../../state/GameContext';
import { SkyResultOverlay } from './SkyResultOverlay';

function renderOverlay(result: LastResult | null) {
  const onRetry = vi.fn();
  const onHome = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <SkyResultOverlay result={result} onRetry={onRetry} onHome={onHome} />
    </SettingsProvider>,
  );
  return { onRetry, onHome };
}

afterEach(cleanup);

describe('SkyResultOverlay', () => {
  it('shows nothing while the run is still flying', () => {
    renderOverlay(null);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('states the record with how far short a lost run fell', () => {
    renderOverlay({
      outcome: 'failed',
      stage: 3,
      score: 1300,
      isNewBestScore: false,
      bestScore: 1520,
      previousBestScore: 1520,
    });

    expect(screen.getByRole('alertdialog', { name: 'Shot down' })).toBeInTheDocument();
    expect(screen.getByText(/Best score/)).toHaveTextContent('1520');
    expect(screen.getByText('−220')).not.toHaveClass('result-delta-better');
  });

  it('marks a new record exactly once on a clear, with the margin it was won by', () => {
    renderOverlay({
      outcome: 'cleared',
      stage: 4,
      score: 1700,
      isNewBestScore: true,
      bestScore: 1700,
      previousBestScore: 1520,
    });
    expect(screen.getByRole('alertdialog', { name: 'Sky clear!' })).toBeInTheDocument();
    expect(screen.getAllByText(/Your best score yet/)).toHaveLength(1);
    expect(screen.getByText('+180')).toHaveClass('result-delta-better');
  });

  it('has no margin to give on a first run', () => {
    renderOverlay({
      outcome: 'failed',
      stage: 1,
      score: 300,
      isNewBestScore: true,
      bestScore: 300,
      previousBestScore: null,
    });
    expect(screen.queryByText(/^[+−±]/)).not.toBeInTheDocument();
  });
});
