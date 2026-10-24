/**
 * The board and its buttons (docs/BOUNCE_UP_RULES.md §2, §4, §7): a Canvas 2D
 * view over the pure run in game/physics.ts, the input that turns fingers,
 * keys and buttons into `{ drag, dir }` (game/input.ts), and the ◀ ▶ laid
 * over the board's lower corners where a finger is the pointer.
 *
 * The run's world is this component's: the body, the platforms and every
 * held input live in refs, so nothing re-renders 120 times a second. Its
 * STATUS is the provider's (state/GameContext.tsx) and arrives as `status`:
 * the loop runs only while it is `running` (§7), and the moment it is not —
 * ❚❚, a background, a blur, hardware Back, the fall — the loop is cancelled,
 * the board is drawn once, and every held input is dropped (§4). Nothing here
 * counts seconds or books points; the provider does.
 *
 * Steps (§2「フレームとステップ」): each frame's elapsed time becomes whole
 * fixed steps through `frameSteps`, at most six a frame with the carry capped
 * as well, and the first frame of every running stretch only takes the time.
 *
 * Input (§4「入力」):
 * - A relative drag anywhere on the board, 1:1 with what the board shows.
 *   The finger's movement is gathered in CSS px and handed to the next
 *   frame's first step as whole units (`dragUnits`, `frameInputs`).
 * - ← → / A D (GameScreen.tsx hands them over through `StageHandle`) and
 *   ◀ ▶ while pressed. ◀ ▶ are shown only under `(any-pointer: coarse)` —
 *   CSS decides (ui/bounce-up.css), never a device sniff.
 * - In `ready` the first press, drag or key starts the run (§4); in `paused`
 *   only a press on the board resumes — ◀ ▶ and the arrows do not.
 *
 * Pointer contract (docs/ARCHITECTURE.md「指を取り上げられたときの契約」「押下の
 * 記録は誰のものか」): every record carries its `pointerId`, and a second
 * finger never overwrites the first; up, cancel and a lost capture end the
 * same gesture; the click a press leaves behind (`detail > 0`, or after a
 * press this button heard) is spent, and a keyboard or assistive click
 * (`detail === 0`) is one nudge of the target, `LEAD_MAX` that way. A press
 * released before any step read it leaves a click that is that nudge too,
 * and a cancelled press leaves no mark behind.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { sounds } from '@/services/sound';
import { useReducedMotion } from '@/ui/useReducedMotion';
import {
  BOARD_HEIGHT_PX,
  BOARD_WIDTH_PX,
  LEAD_MAX,
  SUB,
  createRun,
  dragUnits,
  frameInputs,
  frameSteps,
  heldDirection,
  pause,
  resume,
  runScore,
  start,
  step,
  type PlatformWidth,
  type RunState,
  type RunStatus,
} from '../../game';
import { drawRun, readPalette, type Palette } from '../draw';

/** Steps after a bounce the body is drawn flattened (decoration — §7). */
const SQUASH_STEPS = 8;

export type HeldKey = 'left' | 'right';
type PadButton = 'left' | 'right';

/** What the game screen's key handler reaches (§4「入力」). */
export interface StageHandle {
  /** ← → / A D pressed or released. A press counts only in `ready` or `running`. */
  holdKey: (key: HeldKey, down: boolean) => void;
}

export interface BounceStageProps {
  seed: string;
  width: PlatformWidth;
  status: RunStatus;
  /** This width's best when the run was built (§4): where the line is drawn. */
  bestAtStart: number;
  /** Start (`ready`) or resume (`paused`). */
  onPlay: () => void;
  /** The run's score, whenever it changes. */
  onScore: (score: number) => void;
  /** The step the body fell out of view, once (§2). */
  onOver: (score: number) => void;
  boardLabel: string;
  padLabel: string;
  leftLabel: string;
  rightLabel: string;
}

interface Drag {
  readonly pointerId: number;
  /** The finger's last x, CSS px. */
  lastX: number;
}

interface Held {
  /** The steering finger. */
  drag: Drag | null;
  /** Finger movement not yet handed to a step, CSS px. */
  dragCss: number;
  /** Keyboard / assistive ◀ ▶ nudges not yet handed to a step, units. */
  nudge: number;
  /** CSS px per logical px, measured on the steering finger's press. */
  scale: number;
  /** ◀ ▶: the pointer holding each, or null. */
  buttons: Record<PadButton, number | null>;
  /** The press each button heard: its trailing click is spent, not acted on. */
  pressed: Record<PadButton, boolean>;
  /** A hold no step has read yet: its trailing click is the nudge instead. */
  unspent: Record<PadButton, boolean>;
  keys: Record<HeldKey, boolean>;
}

const freshHeld = (): Held => ({
  drag: null,
  dragCss: 0,
  nudge: 0,
  scale: 0,
  buttons: { left: null, right: null },
  pressed: { left: false, right: false },
  unspent: { left: false, right: false },
  keys: { left: false, right: false },
});

/** Paused, over or blurred: every held input goes (§4). */
function dropHeld(held: Held): void {
  held.drag = null;
  held.dragCss = 0;
  held.nudge = 0;
  held.buttons = { left: null, right: null };
  held.unspent = { left: false, right: false };
  held.keys = { left: false, right: false };
}

const PAD_BUTTONS: readonly PadButton[] = ['left', 'right'];

function padOf(element: Element): PadButton {
  return (element as HTMLElement).dataset.pad === 'left' ? 'left' : 'right';
}

export const BounceStage = forwardRef<StageHandle, BounceStageProps>(function BounceStage(
  {
    seed,
    width,
    status,
    bestAtStart,
    onPlay,
    onScore,
    onOver,
    boardLabel,
    padLabel,
    leftLabel,
    rightLabel,
  },
  handleRef,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runRef = useRef<RunState | null>(null);
  if (runRef.current === null) runRef.current = createRun(seed, width);
  const heldRef = useRef<Held>(freshHeld());
  const statusRef = useRef(status);
  statusRef.current = status;
  const onPlayRef = useRef(onPlay);
  onPlayRef.current = onPlay;
  const onScoreRef = useRef(onScore);
  onScoreRef.current = onScore;
  const onOverRef = useRef(onOver);
  onOverRef.current = onOver;
  const reducedMotion = useReducedMotion();
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;
  /** The tick of the last bounce, for the squash (−∞ before any). */
  const bounceTickRef = useRef(Number.NEGATIVE_INFINITY);
  /** Draws the board once; set by the canvas effect, a no-op without a 2D context. */
  const drawRef = useRef<() => void>(() => undefined);
  /** One frame of the loop; set by the canvas effect. */
  const frameRef = useRef<(now: number) => void>(() => undefined);
  /** The loop's clock: the last frame's time and the unstepped remainder (1/120,000 s). */
  const timingRef = useRef<{ lastTime: number | null; carry: number }>({
    lastTime: null,
    carry: 0,
  });

  // The provider's status, applied to the run: a start, a resume, a pause.
  // Leaving `running` drops every held input (§4) and draws the stopped board.
  useEffect(() => {
    const current = runRef.current!;
    // Every status change restarts the loop's clock: the first frame after a
    // resume steps from zero, never across the pause (§2).
    timingRef.current = { lastTime: null, carry: 0 };
    if (status === 'running') {
      if (current.status === 'ready') runRef.current = start(current);
      else if (current.status === 'paused') runRef.current = resume(current);
    } else {
      if (current.status === 'running') runRef.current = pause(current);
      dropHeld(heldRef.current);
    }
    drawRef.current();
  }, [status]);

  useImperativeHandle(
    handleRef,
    () => ({
      holdKey: (key, down) => {
        const s = statusRef.current;
        if (down && s !== 'running' && s !== 'ready') return;
        heldRef.current.keys[key] = down;
      },
    }),
    [],
  );

  // The canvas, its colours and its size, and the frame itself. Mounted once
  // per run (the screen keys the stage by seed and nonce).
  useEffect(() => {
    let lastScore = runScore(runRef.current!);
    onScoreRef.current(lastScore);

    // Keys let go anywhere end their hold, whatever the status (§4).
    const onKeyUp = (event: KeyboardEvent) => {
      const keys = heldRef.current.keys;
      if (event.key === 'ArrowLeft' || event.code === 'KeyA') keys.left = false;
      if (event.key === 'ArrowRight' || event.code === 'KeyD') keys.right = false;
    };
    window.addEventListener('keyup', onKeyUp);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d') ?? null;
    if (!canvas || !ctx) {
      return () => {
        window.removeEventListener('keyup', onKeyUp);
      };
    }

    // The backing store follows the displayed size; the transform maps the
    // logical 360×640 onto it. clientWidth is 0 before layout (and in jsdom):
    // fall back to the logical size until the observer corrects it.
    const sizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round((canvas.clientWidth || BOARD_WIDTH_PX) * dpr));
      const h = Math.max(1, Math.round(w * (BOARD_HEIGHT_PX / BOARD_WIDTH_PX)));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const scale = w / BOARD_WIDTH_PX;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    };
    sizeCanvas();

    let palette: Palette = readPalette();
    const draw = () => {
      const current = runRef.current!;
      drawRun(ctx, palette, current, {
        bestScore: bestAtStart,
        squash: !reducedRef.current && current.tick - bounceTickRef.current < SQUASH_STEPS,
      });
    };
    const repaint = () => {
      palette = readPalette();
      draw();
    };
    drawRef.current = draw;

    // The shell swaps the accent by attribute; the OS may flip dark mode.
    const observer = new MutationObserver(repaint);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-game'],
    });
    const media =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;
    media?.addEventListener('change', repaint);
    const onViewportChange = () => {
      sizeCanvas();
      draw();
    };
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onViewportChange);
    resizeObserver?.observe(canvas);
    window.addEventListener('resize', onViewportChange);

    let reported = false;

    const frame = (now: number) => {
      const timing = timingRef.current;
      let current = runRef.current!;
      if (timing.lastTime === null || current.status !== 'running') {
        // The first frame of a stretch only takes the time; a frame outside a
        // running run only draws.
        timing.lastTime = now;
        timing.carry = 0;
        draw();
        return;
      }
      const elapsed = now - timing.lastTime;
      timing.lastTime = now;
      const { steps, carry } = frameSteps(timing.carry, elapsed);
      timing.carry = carry;
      const held = heldRef.current;

      let drag = 0;
      if (steps > 0) {
        // The finger's movement since the last stepped frame, whole units;
        // what does not make a whole unit waits for the next (§4).
        const units = dragUnits(held.dragCss, held.scale);
        held.dragCss = held.scale > 0 ? held.dragCss - (units / SUB) * held.scale : 0;
        drag = units + held.nudge;
        held.nudge = 0;
      }
      const dir = heldDirection(
        held.keys.left || held.buttons.left !== null,
        held.keys.right || held.buttons.right !== null,
      );
      for (const which of PAD_BUTTONS) {
        if (steps > 0 && held.buttons[which] !== null) held.unspent[which] = false;
      }

      let vanished = false;
      for (const input of frameInputs(steps, drag, dir)) {
        current = step(current, input);
        if (current.event === 'bounce' || current.event === 'vanish') {
          bounceTickRef.current = current.tick;
        }
        if (current.event === 'vanish') vanished = true;
        if (current.status !== 'running') break;
      }
      runRef.current = current;
      // A cloud that will not hold twice is heard as well as seen (§7「音」).
      if (vanished) sounds.select();

      const score = runScore(current);
      if (score !== lastScore) {
        lastScore = score;
        onScoreRef.current(score);
      }
      draw();

      if (current.status === 'over' && !reported) {
        reported = true;
        onOverRef.current(score);
      }
    };
    frameRef.current = frame;
    draw();

    // Dev-only seam: frames pumped by hand (tests, a browser pane that never
    // fires requestAnimationFrame). Compiled out of production builds.
    if (import.meta.env.DEV) {
      const w = window as unknown as Record<string, unknown>;
      w.__boFrame = frame;
      w.__boState = () => runRef.current;
    }

    return () => {
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onViewportChange);
      resizeObserver?.disconnect();
      media?.removeEventListener('change', repaint);
      observer.disconnect();
      drawRef.current = () => undefined;
      frameRef.current = () => undefined;
      if (import.meta.env.DEV) {
        // The seam holds the whole frame closure — it goes with the board.
        const w = window as unknown as Record<string, unknown>;
        delete w.__boFrame;
        delete w.__boState;
      }
    };
    // The stage is keyed by run (GameScreen.tsx), so the best line never
    // changes under a mounted board; it is listed for honesty, not for reruns.
  }, [bestAtStart]);

  // The loop: requestAnimationFrame only while the run is running (§7).
  const running = status === 'running';
  useEffect(() => {
    if (!running) return undefined;
    let rafId: number | null = null;
    const loop = (now: number) => {
      rafId = null;
      frameRef.current(now);
      if (runRef.current?.status === 'running') rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [running]);

  // ---------- the board ----------

  const capture = (event: ReactPointerEvent<Element>) => {
    // An improvement, never a precondition: it throws if the pointer is
    // already gone, and jsdom has no capture at all.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // The events that do arrive still steer.
    }
  };

  const beginSteer = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const held = heldRef.current;
    const rect = event.currentTarget.getBoundingClientRect();
    held.scale = rect.width / BOARD_WIDTH_PX;
    held.drag = { pointerId: event.pointerId, lastX: event.clientX };
  }, []);

  const onBoardPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const current = statusRef.current;
    if (current === 'over') return;
    const held = heldRef.current;
    // A second finger never takes the steering from the first.
    if (held.drag !== null) return;
    if (current === 'ready' || current === 'paused') onPlayRef.current();
    beginSteer(event);
    capture(event);
  };

  const onBoardPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const held = heldRef.current;
    if (held.drag === null || event.pointerId !== held.drag.pointerId) return;
    const dx = event.clientX - held.drag.lastX;
    held.drag.lastX = event.clientX;
    const current = statusRef.current;
    if (current === 'paused' || current === 'over') return;
    if (Number.isFinite(dx)) held.dragCss += dx;
  };

  /** Release, cancel and a lost capture end the same gesture: the steering finger lets go. */
  const onBoardPointerEnd = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const held = heldRef.current;
    if (held.drag !== null && event.pointerId === held.drag.pointerId) held.drag = null;
  };

  // ---------- ◀ ▶ ----------

  const onPadPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const which = padOf(event.currentTarget);
    const held = heldRef.current;
    // Every press marks its trailing click as spent, acted on or not.
    held.pressed[which] = true;
    const current = statusRef.current;
    // Only a press on the board resumes a paused run (§4).
    if (current === 'paused' || current === 'over') return;
    if (held.buttons[which] !== null) return;
    if (current === 'ready') onPlayRef.current();
    held.buttons[which] = event.pointerId;
    held.unspent[which] = true;
    capture(event);
  };

  /**
   * Up, cancel and a lost capture all end the hold: a finger that slid off
   * never sticks (§4). A cancel — or a capture lost before any `pointerup` —
   * leaves no click behind, so it also takes back the mark that would have
   * spent one: the next keyboard or assistive click (`detail === 0`) acts.
   */
  const onPadPointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const which = padOf(event.currentTarget);
    const held = heldRef.current;
    const mine = held.buttons[which] === event.pointerId;
    if (event.type === 'pointercancel' || (event.type === 'lostpointercapture' && mine)) {
      held.pressed[which] = false;
      held.unspent[which] = false;
    }
    if (mine) held.buttons[which] = null;
  };

  /** A keyboard or assistive click: one nudge of the target, `LEAD_MAX` that way (§4). */
  const nudge = (which: PadButton) => {
    const current = statusRef.current;
    if (current === 'paused' || current === 'over') return;
    if (current === 'ready') onPlayRef.current();
    heldRef.current.nudge += which === 'left' ? -LEAD_MAX : LEAD_MAX;
  };

  const onPadClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const which = padOf(event.currentTarget);
    const held = heldRef.current;
    if (held.unspent[which]) {
      // Pressed and let go before any step read the hold: this click is the
      // nudge, or the button would have done nothing at all.
      held.unspent[which] = false;
      held.pressed[which] = false;
      nudge(which);
      return;
    }
    // The click a press leaves behind: the hold already did the work (§4).
    if (event.detail > 0 || held.pressed[which]) {
      held.pressed[which] = false;
      return;
    }
    nudge(which);
  };

  /** A key on a focused button comes before its click: no press left anything to spend. */
  const onPadKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const which = padOf(event.currentTarget);
    heldRef.current.pressed[which] = false;
    heldRef.current.unspent[which] = false;
  };

  const labels: Record<PadButton, string> = { left: leftLabel, right: rightLabel };

  return (
    <div className="bo-stage">
      <div className="bo-board" role="img" aria-label={boardLabel}>
        <canvas
          ref={canvasRef}
          className="bo-canvas"
          aria-hidden="true"
          onPointerDown={onBoardPointerDown}
          onPointerMove={onBoardPointerMove}
          onPointerUp={onBoardPointerEnd}
          onPointerCancel={onBoardPointerEnd}
          onLostPointerCapture={onBoardPointerEnd}
          onContextMenu={(event) => event.preventDefault()}
        />
      </div>
      <div className="bo-pad" role="group" aria-label={padLabel}>
        {PAD_BUTTONS.map((which) => (
          <button
            key={which}
            type="button"
            className={`bo-pad-btn bo-pad-${which}`}
            data-pad={which}
            aria-label={labels[which]}
            onPointerDown={onPadPointerDown}
            onPointerUp={onPadPointerEnd}
            onPointerCancel={onPadPointerEnd}
            onLostPointerCapture={onPadPointerEnd}
            onClick={onPadClick}
            onKeyDown={onPadKeyDown}
            onContextMenu={(event) => event.preventDefault()}
          >
            <PadGlyph which={which} />
          </button>
        ))}
      </div>
    </div>
  );
});

/** ◀ ▶ drawn as shapes, so no font decides how they look. */
function PadGlyph({ which }: { which: PadButton }) {
  const d = which === 'left' ? 'M15 5 L7 12 L15 19 Z' : 'M9 5 L17 12 L9 19 Z';
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="bo-pad-glyph">
      <path d={d} />
    </svg>
  );
}
