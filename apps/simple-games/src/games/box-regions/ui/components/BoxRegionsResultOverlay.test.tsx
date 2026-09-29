/**
 * The clear screen's actions (docs/BOX_REGIONS_RULES.md §9): the same board
 * again comes first, a fresh board second, and the daily has no second — one
 * board a day. Pinned after a review found the two the other way round.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { createDifficultySession, doDraw, regionCells, type BoxRegionsSession } from '../../game';
import { BoxRegionsResultOverlay } from './BoxRegionsResultOverlay';

/** Draws every box of the answer, corner to corner, the way a player would. */
function solvedSession(): BoxRegionsSession {
  let session = createDifficultySession('easy', 'box-regions-easy-overlay');
  for (let region = 0; region < session.clues.length; region++) {
    const cells = regionCells(session.solution, region);
    session = doDraw(session, cells[0]!, cells[cells.length - 1]!) ?? session;
  }
  expect(session.status).toBe('solved');
  return { ...session, elapsedSeconds: 60 };
}

function renderOverlay(session: BoxRegionsSession) {
  const onRetry = vi.fn();
  const onNewBoard = vi.fn();
  const onHome = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <BoxRegionsResultOverlay
        session={session}
        lastResult={null}
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

describe('BoxRegionsResultOverlay actions (§9)', () => {
  it('offers the same board first, a new board second, for a difficulty game', async () => {
    const user = userEvent.setup();
    const { onRetry, onNewBoard, onHome } = renderOverlay(solvedSession());
    // The three result actions, in order; the shell's Share action follows them.
    const buttons = screen.getAllByRole('button').slice(0, 3);
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Retry same board',
      'New board',
      'Home',
    ]);
    expect(buttons[0]).toHaveClass('btn-primary');
    expect(buttons[1]).toHaveClass('btn-secondary');
    await user.click(buttons[0]!);
    expect(onRetry).toHaveBeenCalledTimes(1);
    await user.click(buttons[1]!);
    expect(onNewBoard).toHaveBeenCalledTimes(1);
    await user.click(buttons[2]!);
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it('has no new board for a daily — one board a day (§9)', () => {
    renderOverlay({ ...solvedSession(), mode: 'daily', dailyDate: '2026-08-01' });
    expect(screen.queryByRole('button', { name: 'New board' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry same board' })).toHaveClass('btn-primary');
  });
});
