/**
 * The clear screen shows the run's facts and nothing that ranks the player
 * (docs/WATER_SORT_RULES.md §9) — no score, no streak, and each personal
 * best mentioned once, quietly, with how far off the record it was.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { createLevelSession, restoreSession, TUBE_CAPACITY, type WaterSession } from '../../game';
import type { LastResult } from '../../state/GameContext';
import { WaterResultOverlay } from './WaterResultOverlay';

/** A level with every colour in a tube of its own — the solved end state. */
function solvedSession(level: number, moves: number, seconds: number): WaterSession {
  const fresh = createLevelSession(level);
  const sorted = Array.from({ length: fresh.colors }, (_, color) =>
    new Array<number>(TUBE_CAPACITY).fill(color),
  );
  return restoreSession({
    mode: fresh.mode,
    seed: fresh.seed,
    colors: fresh.colors,
    dailyDate: fresh.dailyDate,
    level: fresh.level,
    freeTier: fresh.freeTier,
    tubes: [...sorted, [], []],
    moveCount: moves,
    hintCount: 1,
    elapsedSeconds: seconds,
  });
}

function renderOverlay(session: WaterSession, lastResult: LastResult | null) {
  const onRetry = vi.fn();
  const onNextLevel = vi.fn();
  const onNewFree = vi.fn();
  const onHome = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <WaterResultOverlay
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

describe('WaterResultOverlay', () => {
  it('shows nothing while the game is still in progress', () => {
    renderOverlay(createLevelSession(1), null);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('reports pours, time and hints — and how far off each record this run was', () => {
    renderOverlay(solvedSession(1, 23, 125), {
      isNewBestMoves: false,
      isNewBestTime: false,
      bestMoves: 20,
      bestSeconds: 100,
      previousBestMoves: 20,
      previousBestSeconds: 100,
      moves: 23,
      seconds: 125,
      hints: 1,
    });

    expect(screen.getByRole('alertdialog', { name: 'Sorted!' })).toBeInTheDocument();
    expect(screen.getByText('23')).toBeInTheDocument();
    expect(screen.getByText('2:05')).toBeInTheDocument();
    expect(screen.getByText('Hints')).toBeInTheDocument();
    // The records are stated, not celebrated — each with its margin.
    expect(screen.getByText('Fewest pours 20')).toBeInTheDocument();
    expect(screen.getByText('+3')).toBeInTheDocument();
    expect(screen.getByText('Fastest clear 1:40')).toBeInTheDocument();
    expect(screen.getByText('+0:25')).toBeInTheDocument();
    expect(screen.queryByText(/score/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });

  it('marks each personal best exactly once, with the margin it was won by', () => {
    renderOverlay(solvedSession(1, 18, 90), {
      isNewBestMoves: true,
      isNewBestTime: true,
      bestMoves: 18,
      bestSeconds: 90,
      previousBestMoves: 20,
      previousBestSeconds: 100,
      moves: 18,
      seconds: 90,
      hints: 1,
    });
    expect(screen.getAllByText('Your fewest pours yet.')).toHaveLength(1);
    expect(screen.getByText('−2')).toHaveClass('result-delta-better');
    expect(screen.getAllByText('Your fastest yet.')).toHaveLength(1);
    expect(screen.getByText('−0:10')).toHaveClass('result-delta-better');
  });

  it('has no margin to give on a first clear', () => {
    renderOverlay(solvedSession(1, 18, 90), {
      isNewBestMoves: true,
      isNewBestTime: true,
      bestMoves: 18,
      bestSeconds: 90,
      previousBestMoves: null,
      previousBestSeconds: null,
      moves: 18,
      seconds: 90,
      hints: 1,
    });
    expect(screen.queryByText(/^[+−±]/)).not.toBeInTheDocument();
  });

  it('offers the next level for a level game', async () => {
    const user = userEvent.setup();
    const { onNextLevel, onRetry, onHome } = renderOverlay(solvedSession(2, 18, 60), null);

    await user.click(screen.getByRole('button', { name: 'Next Level' }));
    expect(onNextLevel).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it('offers another board at the same tier after a free one, and names no record (§6)', async () => {
    const user = userEvent.setup();
    const free: WaterSession = {
      ...solvedSession(3, 18, 60),
      mode: 'free',
      level: null,
      freeTier: 'easy',
    };
    const { onNewFree, onNextLevel } = renderOverlay(free, {
      isNewBestMoves: false,
      isNewBestTime: false,
      bestMoves: 18,
      bestSeconds: 60,
      previousBestMoves: null,
      previousBestSeconds: null,
      moves: 18,
      seconds: 60,
      hints: 1,
    });
    expect(screen.queryByRole('button', { name: 'Next Level' })).not.toBeInTheDocument();
    // The statistics keep no best for a free board, so the card names none.
    expect(screen.queryByText(/Fewest pours/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Fastest clear/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New Game' }));
    expect(onNewFree).toHaveBeenCalledTimes(1);
    expect(onNextLevel).not.toHaveBeenCalled();
  });

  it('has no next level for a daily game', () => {
    const daily: WaterSession = {
      ...solvedSession(1, 18, 60),
      mode: 'daily',
      level: null,
      dailyDate: '2026-08-01',
    };
    renderOverlay(daily, null);
    expect(screen.queryByRole('button', { name: 'Next Level' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry same board' })).toBeInTheDocument();
  });
});
