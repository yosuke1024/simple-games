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
 *
 * Both tests below own the loop's clock outright. vitest's jsdom runs with
 * pretendToBeVisual, so its requestAnimationFrame is real and keeps firing
 * here on a timestamp origin of its own, while `frame` carries one `lastTime`
 * for every caller (BubbleBoard.tsx:611-617) — two clocks, one closure, and a
 * dt that goes negative whenever the pumped one is behind. stubAnimationFrames
 * silences the real frames so the seam is the only thing that moves time
 * (issue #158).
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { stubAnimationFrames, stubCanvas2d, stubMatchMedia } from '@/test/lifecycle';
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
  // Before the board mounts, so the loop never gets a frame this test did not
  // hand it (see the file header and the pump below).
  const restoreFrames = stubAnimationFrames();
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
    // to cover both — the dev seam is here for the review harness's browser
    // pane, which never fires requestAnimationFrame at all (BubbleBoard.tsx's
    // own note on it), and the stub above makes it this test's only frame
    // source too. So this clock may start anywhere and only has to climb:
    // `frame` takes the first pump as its `lastTime` (dt 0) and clamps each of
    // the nine after it to 250ms, so every run simulates the same 2.25s. Left
    // unstubbed it would not — jsdom's own frames set `lastTime` to a stamp
    // measured from window creation, and the first pump at 300 would then hand
    // `frame` a dt of minus however long this file had been running, unwinding
    // the flight instead of advancing it (#158: "expected 38 to be less than
    // 38", reported twice in PR #140).
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
    restoreFrames();
    restoreMedia();
    restoreCanvas();
  }
});

it('does not fire on pointerCancel, and still fires on the next real drag (#144)', async () => {
  // BubbleBoard.tsx used to wire onPointerCancel to the same `endDrag` as
  // onPointerUp, so losing the gesture mid-aim (a notification shade, an
  // incoming call, a palm) spent a shot at whatever angle the finger had
  // last reached. A cancel is not a release (docs/BUBBLE_POP_RULES.md §4):
  // the aim is dropped and the bubble stays loaded. This pins both halves —
  // no shot on the cancel, and the drag bookkeeping still coming out of it
  // sound, the same contract BrickBreakerRoot.test.tsx pins for its paddle
  // drag (#120).
  const restoreCanvas = stubCanvas2d();
  const restoreMedia = stubMatchMedia();
  // Before the board mounts: the pumped frames below are the only ones the
  // loop may see (see the file header).
  const restoreFrames = stubAnimationFrames();
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
    // `frame`'s own `lastTime` closure persists across calls to the seam
    // (BubbleBoard.tsx:611-617), so this clock keeps climbing across all three
    // settles below instead of restarting at 0 each time: handing `frame` a
    // timestamp older than the one before makes its
    // `Math.min(now - lastTime, 250)` dt negative, which unwinds whatever is
    // in flight instead of advancing it and defers the commit to a later pump
    // — precisely what would let a wrongly-staged shot slip past the assertion
    // that is supposed to catch it. Nothing else writes `lastTime` any more,
    // so no reading of the wall clock is needed to stay ahead of it: this used
    // to start at `performance.now()` to outrun jsdom's real frames, which
    // only left the sim thousands of ms ahead of them instead (#158).
    let simNow = 0;
    const settle = async () => {
      // Flight (well under 1.1s for this board) plus the 220ms pop/fall
      // settle, at the 250ms-clamped dt each pumped frame is worth: 2.25s of
      // simulation for the first settle (its opening pump only sets
      // `lastTime`) and 2.5s for the two after it — the same on every machine,
      // now that these are the only frames the loop gets. After a cancel there
      // is nothing in flight to pump, but pumping anyway is the point: it
      // gives a shot that *was* wrongly staged every chance to land and show
      // up in the assertions below.
      await act(async () => {
        for (let i = 0; i < 10; i++) {
          simNow += 300;
          buFrame(simNow);
        }
      });
    };

    // game/session.ts's `fireShot` always returns a fresh object via spread
    // while status is 'playing' (session.ts:76-112), so ANY shot —
    // independent of what it happens to pop — swaps out sessionRef.current.
    // An unchanged reference is therefore proof that nothing was fired.
    const beforeCancel = buState();

    // Aim, then lose the gesture mid-drag instead of releasing it.
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 140, clientY: 40 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 60, clientY: 40 });
    fireEvent.pointerCancel(canvas, { pointerId: 1 });
    await settle();
    // #144: the cancel spent nothing — same session, so the same loaded
    // bubble, the same board and the same shots-until-descent count.
    expect(buState()).toBe(beforeCancel);
    // Both checks here only mean something if the level is still live.
    expect(buState().status).toBe('playing');

    // The #120 half: the cancel must also clear draggingRef, not leave the
    // drag looking still-live. There is no window seam for aim/dragging
    // state itself to assert on directly — __buState exposes only
    // BubblePopSession, which has no angle or dragging field (unlike Brick
    // Breaker's paddleX, which onPointerMove writes to continuously and
    // BrickBreakerRoot.test.tsx's sibling #120 test reads straight off) —
    // so a stray pointerMove alone can never prove or disprove a leaked
    // drag: BubbleBoard.tsx's onPointerMove only ever touches the
    // unobservable angleRef. What DOES prove it is the bare pointerUp right
    // after, with no fresh pointerDown of its own: if draggingRef were
    // still true, this pointerUp would pass endDrag's dragging check and
    // fire at whatever angle that stray move left behind.
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 260, clientY: 40 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    await settle();
    expect(buState()).toBe(beforeCancel);

    // A fresh press-drag-release cycle works exactly like any other shot:
    // a brand-new session replaces the old one, and (since the run is
    // still 'playing') current <- next — game/session.ts's `fireShot`
    // invariant for every non-terminal shot, independent of what this
    // particular shot happens to pop. Together these confirm the aim was
    // only dropped, never disabled: the loaded bubble the cancel kept is
    // the one this drag finally fires.
    fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 220, clientY: 40 });
    fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 180, clientY: 40 });
    fireEvent.pointerUp(canvas, { pointerId: 2 });
    await settle();
    const afterFreshShot = buState();
    expect(afterFreshShot).not.toBe(beforeCancel);
    expect(afterFreshShot.current).toBe(beforeCancel.next);
  } finally {
    restoreFrames();
    restoreMedia();
    restoreCanvas();
  }
});
