import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { stubCanvas2d, stubMatchMedia } from '@/test/lifecycle';
import { BOARD_HEIGHT, BOARD_WIDTH } from '../game/constants';
import { BB_STORAGE_KEYS } from '../storage/schemas';
import { BrickBreakerRoot } from './BrickBreakerRoot';

// jsdom has no canvas: getContext returns null, so the board renders but the
// loop never starts — which is exactly the simulation/view split under test.

function renderGame(initial: Record<string, string> = {}) {
  const onExit = vi.fn();
  const kv = createMemoryKV(initial);
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <BrickBreakerRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

const tutorialDone = {
  [BB_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

/**
 * jsdom lays nothing out, so the canvas is handed a rectangle by force —
 * one CSS pixel per logical unit, so a clientX maps straight onto board x.
 */
function giveBoardALayout(canvas: HTMLElement): void {
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    right: BOARD_WIDTH,
    bottom: BOARD_HEIGHT,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

/** The dev-only seam BrickBoard exposes while a run is live (see BrickBoard.tsx). */
const paddleX = () =>
  (window as unknown as { __bbState: () => { paddleX: number } }).__bbState().paddleX;

afterEach(cleanup);

describe('first run', () => {
  it('shows Quick Rules and starts level 1 right after (§11)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Aim with the paddle')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Hollow bricks hold a ball')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('The wall creeps down')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    expect(screen.getByRole('img', { name: 'Brick Breaker board' })).toBeInTheDocument();
    expect(screen.getByText('Level 1')).toBeInTheDocument();
  });
});

describe('home', () => {
  it('starts the frontier level and hands control back to the collection', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);

    expect(await screen.findByRole('button', { name: 'Level 1' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('locks every level beyond the frontier (§7)', async () => {
    const user = userEvent.setup();
    renderGame({
      ...tutorialDone,
      [BB_STORAGE_KEYS.progress]: JSON.stringify({ schemaVersion: 1, highestUnlocked: 3 }),
    });

    // The Levels chip says how many of the hundred are behind the frontier.
    const chip = await screen.findByRole('button', { name: /^Levels/ });
    expect(chip).toHaveTextContent('2/100');
    await user.click(chip);
    expect(screen.getByRole('button', { name: 'Level 3' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Level 4, locked' })).toBeDisabled();
    // Cleared levels stay replayable.
    expect(screen.getByRole('button', { name: 'Level 1' })).toBeEnabled();
  });

  it('shows counts and no clock, no score, no streak (§9, §13)', async () => {
    const user = userEvent.setup();
    renderGame({
      ...tutorialDone,
      [BB_STORAGE_KEYS.stats]: JSON.stringify({
        schemaVersion: 1,
        played: 12,
        cleared: 7,
        totalPlaySeconds: 300,
      }),
    });

    await user.click(await screen.findByRole('button', { name: 'Statistics' }));
    expect(screen.getByText('Games played')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/score/i)).not.toBeInTheDocument();
  });
});

describe('playing', () => {
  it('mounts the board with lives and bricks in the status row (§2)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);

    await user.click(await screen.findByRole('button', { name: 'Level 1' }));
    expect(screen.getByRole('img', { name: 'Brick Breaker board' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Lives: 3' })).toBeInTheDocument();
    // The golden level-1 board has 18 bricks (compatibility.test.ts).
    expect(screen.getByText('Bricks 18')).toBeInTheDocument();
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
  });

  it('leaves the paddle where a cancelled drag left it, and steers again on a fresh press (#120)', async () => {
    const restoreCanvas = stubCanvas2d();
    const restoreMedia = stubMatchMedia();
    const user = userEvent.setup();
    try {
      renderGame(tutorialDone);
      await user.click(await screen.findByRole('button', { name: 'Level 1' }));
      const canvas = screen.getByRole('img', { name: 'Brick Breaker board' });
      giveBoardALayout(canvas);
      // Without the canvas stub the loop never starts and this seam never
      // appears — without it this test would silently be testing nothing.
      expect(typeof (window as unknown as Record<string, unknown>).__bbState).toBe('function');

      const start = paddleX();
      fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 100, clientY: 600 });
      fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 200, clientY: 600 });
      const steered = paddleX();
      expect(steered).not.toBe(start);
      expect(steered).toBeCloseTo(200);

      // The system takes the gesture away mid-drag — a call, a system
      // gesture, a pinch — the same as onPointerUp (BrickBoard.tsx wires
      // onPointerCancel={onPointerUp}), so dragging must end here too.
      fireEvent.pointerCancel(canvas, { pointerId: 1 });

      // A stray move with no pointerDown behind it must not still be
      // steering: the cancel, not just the eventual pointerUp, ended the drag.
      fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 300, clientY: 600 });
      expect(paddleX()).toBe(steered);

      // A fresh press starts an ordinary drag again.
      fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 300, clientY: 600 });
      fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 250, clientY: 600 });
      expect(paddleX()).toBeCloseTo(250);
    } finally {
      restoreMedia();
      restoreCanvas();
    }
  });
});
