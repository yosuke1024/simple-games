/**
 * The resource-release contract mid-game (docs/GAME_LIFECYCLE.md): with a
 * board on screen the play clock's interval, the keyboard listener and the
 * visibility listener are all live, and a drag may be armed. Unmounting must
 * release every one. The registry-wide sweep in src/test/lifecycle.test.tsx
 * only reaches the first screen (Quick Rules), where none of these exist yet.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { trackResources } from '@/test/lifecycle';
import { BG_STORAGE_KEYS } from '../storage/schemas';
import { BridgesRoot } from './BridgesRoot';

afterEach(cleanup);

const tutorialDone = {
  [BG_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

it('releases the clock, the listeners and a half-made drag when unmounted mid-game', async () => {
  const user = userEvent.setup();
  // Warm-up: first-use module singletons are the shell's, not the game's.
  const warmup = render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <BridgesRoot onExit={() => undefined} kv={createMemoryKV(tutorialDone)} />
    </SettingsProvider>,
  );
  await screen.findByRole('button', { name: /^Easy/ });
  warmup.unmount();

  const tracker = trackResources();
  try {
    const view = render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <BridgesRoot onExit={() => undefined} kv={createMemoryKV(tutorialDone)} />
      </SettingsProvider>,
    );
    await user.click(await screen.findByRole('button', { name: /^Easy/ }));
    const board = screen.getByRole('group', { name: /^Bridges board/ });
    const islands = within(board).getAllByRole('button');
    await user.click(screen.getByRole('button', { name: 'Hint' }));
    // The game is really running: a board, a hint on it, a clock behind it.
    expect(islands.length).toBeGreaterThan(0);
    expect(screen.getByRole('status')).not.toBeEmptyDOMElement();
    // A press left hanging: no release before the game goes away.
    fireEvent.pointerDown(islands[0]!, { button: 0, pointerId: 7, clientX: 1, clientY: 1 });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    view.unmount();
    tracker.assertReleased();
  } finally {
    tracker.restore();
  }
});
