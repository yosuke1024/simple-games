/**
 * The resource-release contract at the board itself (docs/GAME_LIFECYCLE.md):
 * with a canvas the loop actually starts, so unmounting mid-play must cancel
 * the animation frame, drop the key/visibility/MutationObserver hooks, and
 * clear the dev-only window seam. The registry-wide sweep in
 * src/test/lifecycle.test.tsx never reaches this — jsdom's canvas has no 2D
 * context, and the board bails out before its loop when getContext returns
 * null.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { stubCanvas2d, stubMatchMedia, trackResources } from '@/test/lifecycle';
import { BU_STORAGE_KEYS } from '../storage/schemas';
import { BubblePopRoot } from './BubblePopRoot';

afterEach(cleanup);

const tutorialDone = {
  [BU_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

it('stops the game loop and listeners when unmounted mid-play', async () => {
  const restoreCanvas = stubCanvas2d();
  const restoreMedia = stubMatchMedia();
  const user = userEvent.setup();
  try {
    // Warm-up: first-use module singletons are the shell's, not the game's.
    const warmup = render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <BubblePopRoot onExit={() => undefined} kv={createMemoryKV(tutorialDone)} />
      </SettingsProvider>,
    );
    await screen.findByRole('button', { name: 'Level 1' });
    warmup.unmount();

    const tracker = trackResources();
    try {
      const view = render(
        <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
          <BubblePopRoot onExit={() => undefined} kv={createMemoryKV(tutorialDone)} />
        </SettingsProvider>,
      );
      await user.click(await screen.findByRole('button', { name: 'Level 1' }));
      expect(screen.getByRole('img', { name: 'Bubble Pop board' })).toBeInTheDocument();
      // The dev seam appears only after the loop effect passed the canvas
      // guard — without it this test would silently be testing nothing.
      expect('__buFrame' in window).toBe(true);
      // The loop starts the instant the board mounts and the page is visible
      // (unlike Brick Breaker's physics, nothing here needs a shot in flight
      // to be "live" — the loop redraws every frame regardless, ready for a
      // drag at any time). Give it a beat.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      view.unmount();
      tracker.assertReleased();
    } finally {
      tracker.restore();
    }

    // The dev seam must fall with the board (it retains the loop's closure).
    expect('__buFrame' in window).toBe(false);
    expect('__buState' in window).toBe(false);
  } finally {
    restoreMedia();
    restoreCanvas();
  }
});
