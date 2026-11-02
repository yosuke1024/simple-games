/**
 * The resource-release contract mid-game (docs/GAME_LIFECYCLE.md): with a
 * match on screen the play clock's interval, the keyboard listener, the
 * visibility listener and the CPU's armed timeout are all live. Unmounting
 * must release every one. The registry-wide sweep in src/test/lifecycle.test.tsx
 * only reaches the first screen (Quick Rules), where none of these exist yet.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { trackResources } from '@/test/lifecycle';
import { BK_STORAGE_KEYS } from '../storage/schemas';
import { BackgammonRoot } from './BackgammonRoot';

afterEach(cleanup);

const tutorialDone = {
  [BK_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

it('releases the clock, the listeners and the CPU timer when unmounted mid-match', async () => {
  const user = userEvent.setup();
  // Warm-up: first-use module singletons are the shell's, not the game's.
  const warmup = render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <BackgammonRoot onExit={() => undefined} kv={createMemoryKV(tutorialDone)} />
    </SettingsProvider>,
  );
  await screen.findByRole('button', { name: /^Normal/ });
  warmup.unmount();

  const tracker = trackResources();
  try {
    const view = render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <BackgammonRoot onExit={() => undefined} kv={createMemoryKV(tutorialDone)} />
      </SettingsProvider>,
    );
    await user.click(await screen.findByRole('button', { name: /^Normal/ }));
    // The match is really running: the opening thrown, a board, a clock behind it,
    // and — whoever won the opening — a CPU beat armed or the player's move offered.
    await user.click(screen.getByRole('button', { name: 'Roll for the opening' }));
    expect(screen.getByRole('group', { name: 'Backgammon board' })).toBeTruthy();
    expect(screen.getByRole('status')).not.toBeEmptyDOMElement();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    view.unmount();
    tracker.assertReleased();
  } finally {
    tracker.restore();
  }
});
