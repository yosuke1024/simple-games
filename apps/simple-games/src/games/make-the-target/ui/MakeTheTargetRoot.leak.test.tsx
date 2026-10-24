/**
 * The resource-release contract at the board itself (docs/GAME_LIFECYCLE.md,
 * docs/MAKE_THE_TARGET_RULES.md §15 ⑥). The registry-wide sweep in
 * src/test/lifecycle.test.tsx mounts every game on its home; this one goes
 * further — onto a board, where the play clock's interval, the key listener
 * and the visibility listener are live, and into the beat between a made
 * target and its result card, where a timer is pending — and unmounts there.
 * Everything must go with it.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { stubMatchMedia, trackResources } from '@/test/lifecycle';
import { TG_STORAGE_KEYS } from '../storage/schemas';
import { MakeTheTargetRoot } from './MakeTheTargetRoot';
import { freeGame, play, storedRecord } from './test-helpers';

afterEach(cleanup);

const records = {
  [TG_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
  // Two moves made: one more makes the target.
  [TG_STORAGE_KEYS.game]: storedRecord(play(freeGame(), 0, '+', 1, 2, '+', 3)),
};

function mount() {
  return render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <MakeTheTargetRoot onExit={() => undefined} kv={createMemoryKV(records)} />
    </SettingsProvider>,
  );
}

const tile = (slot: number) =>
  screen
    .getByRole('group', { name: 'Numbers' })
    .querySelector<HTMLButtonElement>(`button[data-slot="${slot}"]`)!;

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
    expect(screen.getByRole('group', { name: 'Numbers' })).toBeInTheDocument();
    fireEvent.click(tile(0));
    fireEvent.keyDown(window, { key: '+' });
    view.unmount();
    tracker.assertReleased();
  } finally {
    tracker.restore();
  }
});

it('releases the result beat’s timer when unmounted between the made target and the card', async () => {
  // Motion allowed (no reduced-motion stand-in), so the card really waits.
  const restoreMedia = stubMatchMedia();
  const user = userEvent.setup();
  try {
    const warmup = mount();
    await screen.findByRole('button', { name: /Resume/ });
    warmup.unmount();

    const tracker = trackResources();
    try {
      const view = mount();
      await user.click(await screen.findByRole('button', { name: /Resume/ }));
      fireEvent.click(tile(1));
      fireEvent.click(screen.getByRole('button', { name: 'Multiply' }));
      fireEvent.click(tile(3));
      // Made, and the card is still waiting for its beat.
      expect(document.querySelector('.tg-target')).toHaveClass('tg-target-made');
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
