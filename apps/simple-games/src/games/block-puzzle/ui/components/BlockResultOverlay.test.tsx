/**
 * The end-of-run card says the run's facts and nothing that ranks the player
 * (docs/BLOCK_PUZZLE_RULES.md §9, §12): the record stated once, with how far
 * this run was from it.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { createSession, type BlockSession } from '../../game';
import type { LastResult } from '../../state/GameContext';
import { BlockResultOverlay } from './BlockResultOverlay';

/** A board declared out of room — the overlay reads the status, not the cells. */
function overSession(score: number): BlockSession {
  return { ...createSession('block-overlay-test'), status: 'over', score };
}

function renderOverlay(session: BlockSession, lastResult: LastResult | null) {
  const onNewGame = vi.fn();
  const onHome = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <BlockResultOverlay
        session={session}
        lastResult={lastResult}
        onNewGame={onNewGame}
        onHome={onHome}
      />
    </SettingsProvider>,
  );
  return { onNewGame, onHome };
}

afterEach(cleanup);

describe('BlockResultOverlay', () => {
  it('shows nothing while the board still has room', () => {
    renderOverlay(createSession('block-overlay-test'), null);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('states the record with how far short this run fell', () => {
    renderOverlay(overSession(800), {
      isNewBestScore: false,
      bestScore: 1000,
      previousBestScore: 1000,
    });

    expect(screen.getByRole('alertdialog', { name: 'No room left' })).toBeInTheDocument();
    expect(screen.getByText(/Best score/)).toHaveTextContent('1000');
    expect(screen.getByText('−200')).not.toHaveClass('result-delta-better');
  });

  it('marks a new record exactly once, with the margin it was won by', () => {
    renderOverlay(overSession(1200), {
      isNewBestScore: true,
      bestScore: 1200,
      previousBestScore: 1000,
    });
    expect(screen.getAllByText(/Your best score yet/)).toHaveLength(1);
    expect(screen.getByText('+200')).toHaveClass('result-delta-better');
  });

  it('has no margin to give on a first game', () => {
    renderOverlay(overSession(300), {
      isNewBestScore: true,
      bestScore: 300,
      previousBestScore: null,
    });
    expect(screen.queryByText(/^[+−±]/)).not.toBeInTheDocument();
  });
});
