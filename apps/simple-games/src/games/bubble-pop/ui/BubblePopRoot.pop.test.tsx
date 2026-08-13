/**
 * Regression for the P1 Codex finding on BubbleBoard.tsx: with Reduced
 * Motion off, resolveRef.current used to read every popped cell's color off
 * session.board (the *pre-placement* board), including the just-landed
 * cell itself — which placeAndResolve's `popped` array can include but
 * session.board has never seen, so colorOf threw on every 3+ pop. This test
 * fires a shot that is known to pop a cluster and drives the animated
 * (non-Reduced-Motion) path all the way through with the dev-only frame
 * seam (window.__buFrame / __buState — same idiom as
 * BubblePopRoot.leak.test.tsx), so a regression here fails as a thrown
 * error, not a silent no-op.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { stubCanvas2d, stubMatchMedia } from '@/test/lifecycle';
import { BU_STORAGE_KEYS } from '../storage/schemas';
import { BubblePopRoot } from './BubblePopRoot';

afterEach(cleanup);

const readyForLevel5 = {
  [BU_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
  [BU_STORAGE_KEYS.progress]: JSON.stringify({ schemaVersion: 1, highestUnlocked: 5 }),
};

it('pops a cluster and keeps playing with Reduced Motion off (P1 regression)', async () => {
  // stubMatchMedia's `matches: false` turns off the OS-level Reduced Motion
  // signal; combined with the default (off) in-app setting, this is exactly
  // the "Reduced Motion disabled" condition the crash needed.
  const restoreCanvas = stubCanvas2d();
  const restoreMedia = stubMatchMedia();
  const user = userEvent.setup();
  try {
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <BubblePopRoot onExit={() => undefined} kv={createMemoryKV(readyForLevel5)} />
      </SettingsProvider>,
    );
    // Home's primary button always names the play frontier (Level 5 here).
    await user.click(await screen.findByRole('button', { name: 'Level 5' }));
    expect(screen.getByRole('img', { name: 'Bubble Pop board' })).toBeInTheDocument();
    // The dev seam appears only past the loop's canvas guard — without it
    // this test would silently be exercising nothing.
    expect('__buFrame' in window).toBe(true);

    const buState = (window as unknown as { __buState: () => { board: Map<string, unknown> } })
      .__buState;
    const buFrame = (window as unknown as { __buFrame: (now: number) => void }).__buFrame;
    const boardSizeBefore = buState().board.size;

    // Level 5's board (seed BOARD_SEED, docs/BUBBLE_POP_RULES.md) pops a
    // 3-cluster at -3° off straight-up on the very first shot — found by
    // sweeping aimGuide + placeAndResolve over every 1° step the real
    // ArrowLeft/ArrowRight keys can reach, the same pair BubbleBoard.tsx's
    // `fire` calls, for exactly the popped-cell-count>0 condition this bug
    // needs (see game/guide.test.ts for the identical sweep technique).
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: ' ' });

    // Flight (path length / SHOT_SPEED, well under 1.1s for this board) plus
    // the 220ms pop/fall settle: pump enough by-hand, clamped-250ms frames
    // to cover both — the dev seam exists precisely because a browser pane
    // never fires real requestAnimationFrame callbacks here.
    await act(async () => {
      let now = 0;
      for (let i = 0; i < 10; i++) {
        now += 300;
        buFrame(now);
      }
    });

    // Reaching here at all is the regression check (the pre-fix code threw
    // inside the frame callback, which React would have surfaced as a
    // rejected/failed test). The board shrinking confirms the pop actually
    // resolved rather than silently getting stuck mid-animation.
    expect(buState().board.size).toBeLessThan(boardSizeBefore);
  } finally {
    restoreMedia();
    restoreCanvas();
  }
});
