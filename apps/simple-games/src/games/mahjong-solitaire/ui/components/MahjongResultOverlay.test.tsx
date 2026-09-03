/**
 * The clear screen shows the run's facts and nothing that ranks the player
 * (docs/MAHJONG_SOLITAIRE_RULES.md §9) — no score, no streak, and a personal
 * best mentioned once, quietly, with the margin against it when there is one.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { createLevelSession, type MahjongSession } from '../../game';
import type { LastResult } from '../../state/GameContext';
import { MahjongResultOverlay } from './MahjongResultOverlay';

/** A level at its end, with the facts the card reads off it. */
function clearedSession(level: number, elapsedSeconds: number): MahjongSession {
  return { ...createLevelSession(level), status: 'won', elapsedSeconds, hintCount: 1 };
}

function renderOverlay(session: MahjongSession, lastResult: LastResult | null) {
  const onRetry = vi.fn();
  const onNextLevel = vi.fn();
  const onHome = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <MahjongResultOverlay
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

describe('MahjongResultOverlay', () => {
  it('shows nothing while the game is still in progress', () => {
    renderOverlay(createLevelSession(1), null);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('reports time and hints — and no score', () => {
    renderOverlay(clearedSession(1, 125), {
      seconds: 125,
      hints: 1,
      isNewBestTime: false,
      bestSeconds: 100,
      previousBestSeconds: 100,
    });
    expect(screen.getByRole('alertdialog', { name: 'Cleared!' })).toBeInTheDocument();
    expect(screen.getByText('2:05')).toBeInTheDocument();
    // The previous best is stated, not celebrated — with how far off it was.
    expect(screen.getByText(/1:40/)).toBeInTheDocument();
    expect(screen.getByText('+0:25')).toBeInTheDocument();
    expect(screen.queryByText(/score/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });

  it('marks a personal best exactly once, with the margin it was won by', () => {
    renderOverlay(clearedSession(1, 90), {
      seconds: 90,
      hints: 0,
      isNewBestTime: true,
      bestSeconds: 90,
      previousBestSeconds: 100,
    });
    expect(screen.getAllByText('Your fastest yet.')).toHaveLength(1);
    expect(screen.getByText('−0:10')).toHaveClass('result-delta-better');
  });

  it('has no margin to give on a first clear', () => {
    renderOverlay(clearedSession(1, 90), {
      seconds: 90,
      hints: 0,
      isNewBestTime: true,
      bestSeconds: 90,
      previousBestSeconds: null,
    });
    expect(screen.queryByText(/^[+−±]/)).not.toBeInTheDocument();
  });

  it('offers the next level for a level game', async () => {
    const user = userEvent.setup();
    const { onNextLevel, onHome } = renderOverlay(clearedSession(2, 60), null);
    await user.click(screen.getByRole('button', { name: 'Next Level' }));
    expect(onNextLevel).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(onHome).toHaveBeenCalledTimes(1);
  });
});
