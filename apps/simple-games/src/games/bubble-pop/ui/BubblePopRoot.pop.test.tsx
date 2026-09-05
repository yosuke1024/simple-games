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
import { afterEach, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { stubCanvas2d, stubMatchMedia } from '@/test/lifecycle';
import { BOARD_HEIGHT, BOARD_WIDTH } from '../game/constants';
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

it('resets the drag on pointerCancel mid-aim, and fires normally on the next drag (#120)', async () => {
  // BubbleBoard.tsx wires onPointerCancel to the exact same `endDrag` as
  // onPointerUp, and endDrag fires whatever was aimed the instant a drag
  // was already in progress — so losing the gesture mid-aim (a system
  // dialog, a pinch, anything the OS can take a pointer away for) sends the
  // loaded bubble flying, the same as a release would. Whether firing on a
  // cancel is the right call is a design question, reported separately —
  // not pinned here. What this test pins is that the drag bookkeeping
  // itself comes out of a cancel sound, the same contract
  // BrickBreakerRoot.test.tsx pins for its paddle drag (#120).
  const restoreCanvas = stubCanvas2d();
  const restoreMedia = stubMatchMedia();
  const user = userEvent.setup();
  try {
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <BubblePopRoot onExit={() => undefined} kv={createMemoryKV(readyForLevel5)} />
      </SettingsProvider>,
    );
    await user.click(await screen.findByRole('button', { name: 'Level 5' }));
    const canvas = screen.getByRole('img', { name: 'Bubble Pop board' });
    // jsdom lays nothing out: without a rectangle, toBoardPoint's
    // zero-width fallback maps every clientX/Y to the same board point, so
    // distinct aims would be indistinguishable. One CSS pixel per logical
    // unit — the same trick BrickBreakerRoot.test.tsx uses for its sibling
    // #120 paddle-drag test.
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

    // The dev seam appears only past the loop's canvas guard — without it
    // this test would silently be exercising nothing.
    expect('__buFrame' in window).toBe(true);
    const buState = (
      window as unknown as {
        __buState: () => {
          board: Map<string, unknown>;
          current: unknown;
          next: unknown;
          shotsUntilDescent: number;
          status: string;
        };
      }
    ).__buState;
    const buFrame = (window as unknown as { __buFrame: (now: number) => void }).__buFrame;
    // `frame`'s own `lastTime` closure persists across calls to the seam,
    // so this test's simulated clock must keep advancing across both
    // settles below rather than restart at 0 each time — restarting it
    // would hand the closure a large negative dt on the next pump's first
    // frame and stall whatever is mid-flight.
    let simNow = 0;
    const settle = async () => {
      // Flight (well under 1.1s for this board) plus the 220ms pop/fall
      // settle — same by-hand frame pump as the P1 regression test above,
      // needed because a browser pane never fires real
      // requestAnimationFrame callbacks here.
      await act(async () => {
        for (let i = 0; i < 10; i++) {
          simNow += 300;
          buFrame(simNow);
        }
      });
    };

    // Aim, then lose the gesture mid-drag instead of releasing it. Because
    // endDrag fires whatever was aimed the instant a drag was in progress,
    // this cancel stages a shot of its own — the design question flagged
    // above, not what this test pins.
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 140, clientY: 40 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 60, clientY: 40 });
    fireEvent.pointerCancel(canvas, { pointerId: 1 });

    // Let the cancelled shot's flight and pop/fall settle so the board is
    // back at 'idle': BubbleBoard.tsx's onPointerDown only starts a new
    // drag once phase is idle again.
    await settle();
    const afterCancelledShot = buState();
    // Both checks below only mean something if the level is still live
    // after the cancel's own shot; Level 5's very first shot neither
    // clears the board nor reaches the loss line at any aim used here.
    expect(afterCancelledShot.status).toBe('playing');

    // The actual #120 contract: endDrag (BubbleBoard.tsx:344-348) must
    // clear draggingRef on a cancel exactly as it does on a real release,
    // not leave the drag looking still-live. There is no window seam for
    // aim/dragging state itself to assert on directly — __buState exposes
    // only BubblePopSession, which has no angle or dragging field (unlike
    // Brick Breaker's paddleX, which onPointerMove writes to continuously
    // and BrickBreakerRoot.test.tsx's sibling #120 test reads straight off)
    // — so a stray pointerMove alone can never prove or disprove a leaked
    // drag: BubbleBoard.tsx's onPointerMove only ever touches the
    // unobservable angleRef. What DOES prove it is the bare pointerUp right
    // after, with no fresh pointerDown of its own: if draggingRef were
    // still true, this pointerUp would still pass endDrag's dragging check
    // and stage a second shot at whatever angle that stray move left
    // behind. game/session.ts's `fireShot` always returns a fresh object
    // via spread while status is 'playing' (session.ts:76-112), so ANY
    // second shot — independent of what it happens to pop — swaps out
    // sessionRef.current; settling and finding the identical reference is
    // therefore proof no second shot was ever staged, i.e. the cancel
    // really did end the drag rather than leave it live for this pointerUp
    // to pick back up.
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 260, clientY: 40 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    await settle();
    expect(buState()).toBe(afterCancelledShot);

    // A fresh press-drag-release cycle works exactly like any other shot:
    // a brand-new session replaces the old one, and (since the run is
    // still 'playing') current <- next — game/session.ts's `fireShot`
    // invariant for every non-terminal shot, independent of what this
    // particular shot happens to pop. Either check alone would prove the
    // drag lifecycle survived the earlier cancel and probe; both together
    // also confirm this fresh drag is a real, ordinary shot rather than a
    // leftover echo of either previous one.
    fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 220, clientY: 40 });
    fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 180, clientY: 40 });
    fireEvent.pointerUp(canvas, { pointerId: 2 });
    await settle();
    const afterFreshShot = buState();
    expect(afterFreshShot).not.toBe(afterCancelledShot);
    expect(afterFreshShot.current).toBe(afterCancelledShot.next);
  } finally {
    restoreMedia();
    restoreCanvas();
  }
});
