/**
 * Mode A, kept behind the constant (docs/OVERTAKE_RULES.md §3, §10): the game
 * ships on mapping 'B', and mode A (one finger, two axes) stays for a device
 * trial later. With `DRAG_MAPPING` at 'A' the drag's pull down eases off and a
 * lift lets the throttle back, and Quick Rules step 2 says the pull. The
 * constant is the one switch; this proves the UI follows it without any other
 * change.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { stubAnimationFrames, stubCanvas2d } from '@/test/lifecycle';
import { FULL_SPEED } from '../game/constants';
import { OvertakeRoot } from './OvertakeRoot';
import { canvasEl, layOutCanvas, pump, raceState } from './test-driver';

vi.mock('../game/constants', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../game/constants')>()),
  DRAG_MAPPING: 'A',
}));

let restores: Array<() => void> = [];

beforeEach(() => {
  restores = [stubCanvas2d(), stubAnimationFrames(), layOutCanvas()];
});

afterEach(() => {
  cleanup();
  for (const restore of restores.reverse()) restore();
});

async function launch(tutorialCompleted: boolean) {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <OvertakeRoot
        onExit={() => undefined}
        kv={createMemoryKV({
          'ot.flags': JSON.stringify({ schemaVersion: 1, tutorialCompleted }),
        })}
      />
    </SettingsProvider>,
  );
  for (let i = 0; i < 5; i++) await act(async () => undefined);
}

it('Quick Rules step 2 says the pull for Drag on mapping A', async () => {
  await launch(false);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText(/pull your finger down/)).toBeInTheDocument();
  expect(screen.queryByText(/hold ▼ to ease off/)).toBeNull();
});

it('a pull down eases off; a lift lets the throttle back', async () => {
  await launch(true);
  fireEvent.click(screen.getByRole('button', { name: 'Level 1' }));
  const canvas = canvasEl();
  fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 180, clientY: 400, button: 0 });
  // The frame that takes the loop's first time; the next one steps.
  pump(1);
  pump(16);
  expect(raceState().player.w).toBe(FULL_SPEED);
  // 90 px down is the hardest brake: the car slows toward 60 px/s.
  fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 180, clientY: 490 });
  pump(10);
  const slowed = raceState().player.w;
  expect(slowed).toBeLessThan(FULL_SPEED - 200);
  fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 180, clientY: 490 });
  pump(10);
  expect(raceState().player.w).toBeGreaterThan(slowed);
});
