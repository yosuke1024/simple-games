/**
 * The clear screen shows the run's facts and nothing that ranks the player
 * (docs/CROWN_GRID_RULES.md §10) — no score, no streak, and a personal best
 * mentioned once, quietly.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { createDifficultySession, doTap, type CrownGridSession } from '../../game';
import type { LastResult } from '../../state/GameContext';
import { CrownGridResultOverlay } from './CrownGridResultOverlay';

/** Plays a board to completion the only way a player can: two taps per crown. */
function solvedSession(elapsedSeconds: number): CrownGridSession {
  let session = createDifficultySession('easy', 'crown-grid-easy-overlay');
  session.solution.forEach((col, row) => {
    const index = row * session.size + col;
    session = doTap(doTap(session, index)!, index)!;
  });
  return { ...session, elapsedSeconds, hintCount: 1 };
}

function renderOverlay(session: CrownGridSession, lastResult: LastResult | null) {
  const onRetry = vi.fn();
  const onNewBoard = vi.fn();
  const onHome = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <CrownGridResultOverlay
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('CrownGridResultOverlay', () => {
  it('shows nothing while the game is still in progress', () => {
    renderOverlay(createDifficultySession('easy', 'crown-grid-easy-overlay'), null);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('reports time and hints — and no score', () => {
    renderOverlay(solvedSession(125), {
      seconds: 125,
      hints: 1,
      isNewBest: false,
      bestSeconds: 100,
      previousBestSeconds: 100,
    });
    expect(screen.getByRole('alertdialog', { name: 'Solved!' })).toBeInTheDocument();
    expect(screen.getByText('2:05')).toBeInTheDocument();
    expect(screen.getByText('Hints used')).toBeInTheDocument();
    expect(screen.getByText(/1:40/)).toBeInTheDocument();
    expect(screen.getByText('+0:25')).toBeInTheDocument();
    expect(screen.queryByText(/score/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });

  it('marks a personal best exactly once, with the margin it was won by', () => {
    renderOverlay(solvedSession(90), {
      seconds: 90,
      hints: 0,
      isNewBest: true,
      bestSeconds: 90,
      previousBestSeconds: 100,
    });
    expect(screen.getAllByText('Your fastest yet.')).toHaveLength(1);
    expect(screen.getByText('−0:10')).toHaveClass('result-delta-better');
  });

  it('has no margin to give on a first clear', () => {
    renderOverlay(solvedSession(90), {
      seconds: 90,
      hints: 0,
      isNewBest: true,
      bestSeconds: 90,
      previousBestSeconds: null,
    });
    expect(screen.queryByText(/^[+−±]/)).not.toBeInTheDocument();
  });

  it('offers a new board first for a difficulty game, and the same board again', async () => {
    const user = userEvent.setup();
    const { onNewBoard, onRetry, onHome } = renderOverlay(solvedSession(60), null);
    await user.click(screen.getByRole('button', { name: 'New board' }));
    expect(onNewBoard).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it('has no new board for a daily — one board a day (§9)', () => {
    const daily = { ...solvedSession(60), mode: 'daily' as const, dailyDate: '2026-08-01' };
    renderOverlay(daily, null);
    expect(screen.queryByRole('button', { name: 'New board' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry same board' })).toBeInTheDocument();
  });

  it("shares the run's own time and hints, and says it was cleared", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share });
    renderOverlay(solvedSession(125), null);
    await userEvent.click(screen.getByRole('button', { name: 'Share' }));
    const [{ text, url }] = share.mock.calls[0] as [{ text: string; url: string }];
    expect(url).toBe('https://pixapps.ai/simple-games/play/?game=crown-grid');
    expect(text).toContain('I cleared Crown Grid');
    expect(text).toContain('Time 2:05');
    expect(text).toContain('Hints used 1');
  });
});
