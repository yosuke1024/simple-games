import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { stubCanvas2d, stubMatchMedia } from '@/test/lifecycle';
import { BOARD_HEIGHT, BOARD_WIDTH } from '../game/constants';
import type { GameState } from '../game/types';
import { SF_STORAGE_KEYS } from '../storage/schemas';
import { SkyFighterRoot } from './SkyFighterRoot';

// jsdom has no canvas: getContext returns null, so the board renders but the
// loop never starts — which is exactly the simulation/view split under test.

function renderGame(initial: Record<string, string> = {}) {
  const onExit = vi.fn();
  const kv = createMemoryKV(initial);
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <SkyFighterRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

const tutorialDone = {
  [SF_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

afterEach(cleanup);

describe('first run', () => {
  it('shows Quick Rules and starts level 1 right after (§11)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Move to aim')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Big ones break up')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Catch what falls')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    expect(screen.getByRole('img', { name: 'Sky Fighter board' })).toBeInTheDocument();
    expect(screen.getByText('Stage 1')).toBeInTheDocument();
    expect(screen.getByText('Wave 1 / 4')).toBeInTheDocument();
  });
});

describe('home', () => {
  it('starts the frontier level and hands control back to the collection', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);

    expect(await screen.findByRole('button', { name: /Level 1/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('locks every level beyond the frontier (§7)', async () => {
    const user = userEvent.setup();
    renderGame({
      ...tutorialDone,
      [SF_STORAGE_KEYS.progress]: JSON.stringify({ schemaVersion: 1, highestUnlocked: 5 }),
    });

    const levels = await screen.findByRole('button', { name: /^Levels/ });
    // The chip says how far up the hundred the frontier is: four cleared.
    expect(levels).toHaveTextContent('4/100');
    await user.click(levels);
    expect(screen.getByRole('button', { name: 'Level 5' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Level 6, locked' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Level 1' })).toBeEnabled();
  });

  it('shows one best score and no streak (§9)', async () => {
    const user = userEvent.setup();
    renderGame({
      ...tutorialDone,
      [SF_STORAGE_KEYS.stats]: JSON.stringify({
        schemaVersion: 1,
        played: 9,
        cleared: 4,
        bestScore: 1520,
        totalPlaySeconds: 240,
      }),
    });

    await user.click(await screen.findByRole('button', { name: 'Statistics' }));
    expect(screen.getByText('Best score')).toBeInTheDocument();
    expect(screen.getByText('1520')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});

describe('playing', () => {
  it('mounts the board with score, wave, lives and the weapon line (§2, §5)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);

    await user.click(await screen.findByRole('button', { name: /Level 1/ }));
    expect(screen.getByRole('img', { name: 'Sky Fighter board' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Lives: 3' })).toBeInTheDocument();
    expect(screen.getByLabelText('Score')).toHaveTextContent('0');
    // The four weapon axes, folded into one small line (§5).
    expect(screen.getByLabelText('Power 0')).toBeInTheDocument();
    expect(screen.getByLabelText('Missile 0')).toBeInTheDocument();
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
  });

  /**
   * Ship steering is drag-follow and relative (§3): the ship moves by the
   * *delta* between successive points, not to an absolute position, so a
   * finger the OS pulls away mid-drag (a system gesture, an incoming call)
   * must not leave a stale last-point behind for the next touch to turn into
   * a phantom jump. onPointerCancel already aliases onPointerUp in
   * SkyBoard.tsx — this pins that the reset it does (draggingRef,
   * lastPointRef) is actually enough, the same contract Brick Breaker's
   * paddle owes its own drag (issue #120).
   */
  it('drops a cancelled drag instead of resuming it, and steers again on the next touch (§3, issue #120)', async () => {
    const restoreCanvas = stubCanvas2d();
    const restoreMedia = stubMatchMedia();
    const user = userEvent.setup();
    try {
      renderGame(tutorialDone);
      await user.click(await screen.findByRole('button', { name: /Level 1/ }));
      const board = screen.getByRole('img', { name: 'Sky Fighter board' });

      // jsdom lays nothing out on its own; the board reads position only
      // through getBoundingClientRect, so give it the logical box the game
      // already assumes — client coordinates then equal logical ones
      // one-for-one, and a delta of N logical px is a delta of N clientX px.
      vi.spyOn(board, 'getBoundingClientRect').mockReturnValue({
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

      // The dev seam appears only once the loop effect has passed its canvas
      // guard (stubCanvas2d) — without it this test would silently be
      // reading a shipX that can never move.
      expect('__sfState' in window).toBe(true);
      const shipX = () => (window as unknown as { __sfState: () => GameState }).__sfState().shipX;
      const startX = shipX();

      fireEvent.pointerDown(board, {
        pointerId: 1,
        button: 0,
        buttons: 1,
        pointerType: 'touch',
        clientX: 100,
        clientY: 300,
      });
      fireEvent.pointerMove(board, {
        pointerId: 1,
        buttons: 1,
        pointerType: 'touch',
        clientX: 150,
        clientY: 300,
      });
      const afterDrag = shipX();
      expect(afterDrag).not.toBe(startX);

      fireEvent.pointerCancel(board, { pointerId: 1 });

      // A second finger's move with no pointerdown of its own — exactly what
      // a stray touch delivers once its drag has already been cancelled —
      // must be ignored outright, not read as a continuation of the old one.
      fireEvent.pointerMove(board, {
        pointerId: 2,
        buttons: 1,
        pointerType: 'touch',
        clientX: 250,
        clientY: 300,
      });
      expect(shipX()).toBe(afterDrag);

      // A fresh press still steers: the cancel released the drag, it did not
      // wedge it.
      fireEvent.pointerDown(board, {
        pointerId: 3,
        button: 0,
        buttons: 1,
        pointerType: 'touch',
        clientX: 150,
        clientY: 300,
      });
      fireEvent.pointerMove(board, {
        pointerId: 3,
        buttons: 1,
        pointerType: 'touch',
        clientX: 120,
        clientY: 300,
      });
      expect(shipX()).not.toBe(afterDrag);
    } finally {
      restoreMedia();
      restoreCanvas();
    }
  });
});
