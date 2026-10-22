/**
 * The resource-release contract mid-game (docs/GAME_LIFECYCLE.md): with a
 * board on screen the play clock's interval, the keyboard listener and the
 * visibility listener are all live, and a long press may be armed. Unmounting
 * must release every one. The registry-wide sweep in src/test/lifecycle.test.tsx
 * only reaches the first screen (Quick Rules), where none of these exist yet.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { trackResources } from '@/test/lifecycle';
import { PN_STORAGE_KEYS } from '../storage/schemas';
import { PipeLinkRoot } from './PipeLinkRoot';

afterEach(cleanup);

const tutorialDone = {
  [PN_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

// The time limit is generous on purpose: the test generates a real Easy board
// and runs the Hint's solver: about 1-1.6 s alone, but it went past 5 s
// once under a fully parallel run on a loaded machine. Wall-clock is never the
// thing checked here (docs/PIPE_LINK_RULES.md §14) — the release is.
it('releases the clock, the listeners and a half-made long press when unmounted mid-game', async () => {
  const user = userEvent.setup();
  // Warm-up: first-use module singletons are the shell's, not the game's.
  const warmup = render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <PipeLinkRoot onExit={() => undefined} kv={createMemoryKV(tutorialDone)} />
    </SettingsProvider>,
  );
  await screen.findByRole('button', { name: /^Easy/ });
  warmup.unmount();

  const tracker = trackResources();
  try {
    const view = render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <PipeLinkRoot onExit={() => undefined} kv={createMemoryKV(tutorialDone)} />
      </SettingsProvider>,
    );
    await user.click(await screen.findByRole('button', { name: /^Easy/ }));
    const board = screen.getByRole('group', { name: /^Pipe Link board/ });
    const tiles = within(board).getAllByRole('button');
    await user.click(screen.getByRole('button', { name: 'Hint' }));
    // The game is really running: a board, a hint on it, a clock behind it.
    expect(tiles).toHaveLength(25);
    expect(screen.getByRole('status')).not.toBeEmptyDOMElement();
    // A touch press left hanging: its long-press timer is armed, no release comes.
    fireEvent.pointerDown(tiles[0]!, { button: 0, buttons: 1, pointerType: 'touch', pointerId: 7 });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    view.unmount();
    tracker.assertReleased();
  } finally {
    tracker.restore();
  }
}, 20_000);
