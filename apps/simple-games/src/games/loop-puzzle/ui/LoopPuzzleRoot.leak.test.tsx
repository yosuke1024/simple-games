/**
 * The resource-release contract at the board itself (docs/GAME_LIFECYCLE.md).
 * The registry-wide sweep in src/test/lifecycle.test.tsx mounts every game on
 * its home; this one goes further — onto a board, where the play clock's
 * interval, the key listener and the visibility listener are live, and into
 * the beat between a solved board and its result card, where a timer is
 * pending — and unmounts there. Everything must go with it.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { stubMatchMedia, trackResources } from '@/test/lifecycle';
import { LINE, createDailySession, localDateString } from '../game';
import { LP_STORAGE_KEYS } from '../storage/schemas';
import { LoopPuzzleRoot } from './LoopPuzzleRoot';

afterEach(cleanup);

const tutorialDone = {
  [LP_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

function mount() {
  return render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <LoopPuzzleRoot onExit={() => undefined} kv={createMemoryKV(tutorialDone)} />
    </SettingsProvider>,
  );
}

it('releases the play clock and listeners when unmounted on a board', async () => {
  const user = userEvent.setup();
  // Warm-up: first-use module singletons are the shell's, not the game's.
  const warmup = mount();
  await screen.findByRole('button', { name: /Daily Challenge/ });
  warmup.unmount();

  const tracker = trackResources();
  try {
    const view = mount();
    await user.click(await screen.findByRole('button', { name: /Daily Challenge/ }));
    expect(screen.getByRole('group', { name: /Loop Puzzle board/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
    view.unmount();
    tracker.assertReleased();
  } finally {
    tracker.restore();
  }
});

it('releases the result beat’s timer when unmounted between the solve and the card', async () => {
  // Motion allowed (no reduced-motion stand-in), so the card really waits.
  const restoreMedia = stubMatchMedia();
  const user = userEvent.setup();
  try {
    const warmup = mount();
    await screen.findByRole('button', { name: /Daily Challenge/ });
    warmup.unmount();

    const tracker = trackResources();
    try {
      const view = mount();
      await user.click(await screen.findByRole('button', { name: /Daily Challenge/ }));
      const truth = createDailySession(localDateString(new Date()));
      const board = screen.getByRole('group', { name: /Loop Puzzle board/ });
      act(() => {
        truth.solution.forEach((mark, edge) => {
          if (mark === LINE) {
            board.querySelector<HTMLButtonElement>(`button[data-edge="${edge}"]`)!.click();
          }
        });
      });
      // Solved, and the card is still waiting for its beat.
      expect(board).toHaveClass('lp-board-solved');
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      view.unmount();
      tracker.assertReleased();
    } finally {
      tracker.restore();
    }
  } finally {
    restoreMedia();
  }
});
