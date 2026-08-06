/**
 * The board with its loop actually running. Everything else about this game
 * is covered without a canvas — SnakeRoot.test.tsx renders the screens where
 * `getContext` returns null and the loop never starts — which leaves the two
 * things that only exist while it does: input reaching the simulation, and a
 * settled run reaching the result overlay.
 *
 * Frames are pumped by hand through the DEV seam rather than waited for.
 * jsdom's requestAnimationFrame runs on wall-clock time, so a real wait would
 * make the number of grid steps a function of how loaded the machine is, and
 * this file would flake instead of failing.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { stubCanvas2d, stubMatchMedia } from '@/test/lifecycle';
import { GRID_SIZE } from '../game/constants';
import type { GameState } from '../game/types';
import { SN_STORAGE_KEYS } from '../storage/schemas';
import { SnakeRoot } from './SnakeRoot';

afterEach(cleanup);

const tutorialDone = {
  [SN_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

const CENTRE = Math.floor(GRID_SIZE / 2);

it('turns on a key press, refuses the reversal, and settles at the wall', async () => {
  const restoreCanvas = stubCanvas2d();
  const restoreMedia = stubMatchMedia();
  const user = userEvent.setup();
  try {
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <SnakeRoot onExit={() => undefined} kv={createMemoryKV(tutorialDone)} />
      </SettingsProvider>,
    );
    await user.click(await screen.findByRole('button', { name: 'New Game' }));

    const win = window as unknown as Record<string, unknown>;
    const frame = win.__snFrame as (now: number) => void;
    const readState = win.__snState as () => GameState;

    let clock = 0;
    /** Feeds the loop `ms` of even 8ms frames, the way a device would. */
    const pump = (ms: number) => {
      act(() => {
        for (let t = 0; t <= ms; t += 8) frame(clock + t);
      });
      clock += ms;
    };

    pump(0);
    expect(readState().snake[0]).toEqual({ x: CENTRE, y: CENTRE });

    // The snake never waits to be started (§3): it is already moving right.
    pump(400);
    expect(readState().snake[0]!.x).toBeGreaterThan(CENTRE);
    expect(readState().snake[0]!.y).toBe(CENTRE);

    fireEvent.keyDown(window, { key: 'ArrowUp' });
    pump(400);
    expect(readState().snake[0]!.y).toBeLessThan(CENTRE);

    // The 180° is dropped rather than queued — a slip must not be fatal (§3).
    const climbing = readState();
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(readState().queue).toEqual(climbing.queue);

    // Left to climb, it reaches the top wall; the run settles exactly once and
    // the overlay offers the one free choice §8 describes.
    pump(4000);
    expect(readState().status).toBe('over');
    expect(await screen.findByText('The run is over')).toBeInTheDocument();
    // Scoped to the dialog: the top bar's restart control carries the same
    // label, and while the overlay is up the board behind it is inert.
    const dialog = within(screen.getByRole('alertdialog'));
    expect(dialog.getByRole('button', { name: 'New Game' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue/i })).not.toBeInTheDocument();
  } finally {
    restoreMedia();
    restoreCanvas();
  }
});
