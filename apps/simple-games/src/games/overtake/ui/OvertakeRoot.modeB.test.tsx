/**
 * The other outcome of the Phase 0 device trial (docs/OVERTAKE_RULES.md §3,
 * §10): with `DRAG_MAPPING` at 'B' the drag steers sideways only — its
 * vertical is ignored, and easing off is ▼, a second finger or ↓ / S — and
 * Quick Rules step 2 says ▼. The constant is the one switch; this proves the
 * UI follows it without any other change.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { stubAnimationFrames, stubCanvas2d } from '@/test/lifecycle';
import { FULL_SPEED, MIN_TARGET_SPEED, SUB } from '../game/constants';
import { OvertakeRoot } from './OvertakeRoot';
import { canvasEl, layOutCanvas, pump, raceState } from './test-driver';

vi.mock('../game/constants', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../game/constants')>()),
  DRAG_MAPPING: 'B',
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

it('Quick Rules step 2 says ▼ for Drag on mapping B', async () => {
  await launch(false);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText(/hold ▼ to ease off/)).toBeInTheDocument();
});

it('the drag steers but its pull eases nothing off; a second finger still does', async () => {
  await launch(true);
  fireEvent.click(screen.getByRole('button', { name: 'Level 1' }));
  const canvas = canvasEl();
  fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 180, clientY: 400, button: 0 });
  pump(1);
  fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 190, clientY: 520 });
  pump(16);
  expect(raceState().player.target / SUB).toBeCloseTo(152 + 12, 5);
  expect(raceState().player.w).toBe(FULL_SPEED);
  fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 60, clientY: 200, button: 0 });
  pump(20);
  expect(raceState().player.w).toBe(MIN_TARGET_SPEED);
});
