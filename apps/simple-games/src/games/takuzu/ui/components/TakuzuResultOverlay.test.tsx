/**
 * The clear screen shows the run's facts and nothing that ranks the player
 * (docs/TAKUZU_RULES.md §10) — no score, no streak, and a personal best
 * mentioned once, quietly.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { createLevelSession, doTap, EMPTY, ZERO, type TakuzuSession } from '../../game';
import type { LastResult } from '../../state/GameContext';
import { TakuzuResultOverlay } from './TakuzuResultOverlay';

/** Plays a level to completion the only way a player can: one tap per digit. */
function solvedSession(level: number, elapsedSeconds: number): TakuzuSession {
  let session = createLevelSession(level);
  session.solution.forEach((value, index) => {
    if (session.givens[index] !== EMPTY) return;
    for (let tap = 0; tap < (value === ZERO ? 1 : 2); tap++) {
      const next = doTap(session, index);
      if (next !== null) session = next;
    }
  });
  return { ...session, elapsedSeconds, hintCount: 1 };
}

function renderOverlay(session: TakuzuSession, lastResult: LastResult | null) {
  const onRetry = vi.fn();
  const onNextLevel = vi.fn();
  const onNewFree = vi.fn();
  const onHome = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <TakuzuResultOverlay
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

describe('TakuzuResultOverlay', () => {
  it('shows nothing while the game is still in progress', () => {
    renderOverlay(createLevelSession(1), null);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('reports time and hints — and no score', () => {
    renderOverlay(solvedSession(1, 125), {
      seconds: 125,
      hints: 1,
      isNewBestTime: false,
      bestSeconds: 100,
      previousBestSeconds: 100,
    });

    expect(screen.getByRole('alertdialog', { name: 'Solved!' })).toBeInTheDocument();
    expect(screen.getByText('2:05')).toBeInTheDocument();
    expect(screen.getByText('Hints used')).toBeInTheDocument();
    // The previous best is stated, not celebrated — with how far off it was.
    expect(screen.getByText(/1:40/)).toBeInTheDocument();
    expect(screen.getByText('+0:25')).toBeInTheDocument();
    expect(screen.queryByText(/score/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });

  it('marks a personal best exactly once, with the margin it was won by', () => {
    renderOverlay(solvedSession(1, 90), {
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
    renderOverlay(solvedSession(1, 90), {
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
    const { onNextLevel, onRetry, onHome } = renderOverlay(solvedSession(2, 60), null);

    await user.click(screen.getByRole('button', { name: 'Next Level' }));
    expect(onNextLevel).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it('offers another board at the same tier after a free one (§7)', async () => {
    const user = userEvent.setup();
    const free = { ...solvedSession(3, 60), mode: 'free' as const, level: null };
    const { onNewFree, onNextLevel } = renderOverlay(free, null);
    expect(screen.queryByRole('button', { name: 'Next Level' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New Game' }));
    expect(onNewFree).toHaveBeenCalledTimes(1);
    expect(onNextLevel).not.toHaveBeenCalled();
  });

  it('has no next level for a daily game', () => {
    const daily = {
      ...solvedSession(1, 60),
      mode: 'daily' as const,
      level: null,
      dailyDate: '2026-08-01',
    };
    renderOverlay(daily, null);
    expect(screen.queryByRole('button', { name: 'Next Level' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New Game' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry same board' })).toBeInTheDocument();
  });
});
