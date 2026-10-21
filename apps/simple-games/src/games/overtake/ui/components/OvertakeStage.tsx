/**
 * The board and its buttons (docs/OVERTAKE_RULES.md §1, §3, §11): a Canvas 2D
 * view over the pure race in game/race.ts, the input mapper that turns
 * fingers, keys and buttons into `{ steerX, brake }` (game/input.ts), and the
 * row of ◀ ▼ ▶ under the board.
 *
 * The race's world is this component's: the cars, the course and every held
 * input live in refs, so nothing re-renders 120 times a second. Its STATUS is
 * the provider's (state/GameContext.tsx) and arrives as `status`: the loop
 * runs only while it is `running` (§11), and the moment it is not — Pause, a
 * background, a blur, hardware Back, the finish — the loop is cancelled, the
 * board is drawn once, and every held input is dropped (§2). Nothing here
 * counts seconds; the provider's clock does.
 *
 * Input (§3, provisional until the Phase 0 device trial):
 * - Drag (default): one relative finger anywhere on the board. The vertical
 *   reading is one constant, `DRAG_MAPPING` — mode A pulls down to ease off
 *   (a ratchet base), mode B ignores it. A second finger is the hardest
 *   brake and never takes the steering. ▼ is shown only under
 *   `(any-pointer: coarse)` (CSS, ui/overtake.css).
 * - Buttons: ◀ ▼ ▶ always shown; the board only starts and resumes.
 * - Keys (GameScreen.tsx hands them over through `StageHandle`).
 * A press on the board in `ready` or `paused` starts or resumes, and in Drag
 * that finger steers from there.
 *
 * Pointer contract (docs/ARCHITECTURE.md「指を取り上げられたときの契約」): every
 * record carries its `pointerId`; up and cancel end the same gesture; the
 * buttons capture the pointer and also end on `lostpointercapture`; the click
 * a press leaves behind (`detail > 0`, or after a press this button heard) is
 * spent, and a keyboard or assistive click (`detail === 0`) is one step's
 * worth — a lane for ◀ ▶, half a second of braking for ▼. A press released
 * before any race step read it leaves a click that is that one step too, and
 * a cancelled press leaves no mark behind.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { sounds } from '@/services/sound';
import { BOARD_HEIGHT, BOARD_WIDTH, DRAG_MAPPING, SUB } from '../../game/constants';
import {
  TAP_BRAKE_STEPS,
  beginDrag,
  clickTarget,
  combineBrake,
  dragTarget,
  heldTarget,
  pullBrake,
  ratchetBase,
  reanchor,
  toStepInput,
  type Controls,
  type DragState,
} from '../../game/input';
import {
  courseFor,
  createRace,
  livePlace,
  pauseRace,
  progressPermille,
  resumeRace,
  startRace,
  stepRace,
  type RaceState,
  type RaceStatus,
} from '../../game/race';
import type { Course } from '../../game/types';
import { drawRace, readPalette, type Palette } from '../draw';

/** The fixed step and the frame's ceiling (§1; Sky Fighter's SkyBoard shape). */
const STEP_MS = 1000 / 120;
const MAX_STEPS_PER_FRAME = 6;
const MAX_FRAME_DT_MS = 250;
const STEP_SECONDS = STEP_MS / 1000;

/** What the row above the board shows: the live place and the progress marks (§11). */
export interface StageHud {
  readonly place: number;
  /** Progress along the course, in whole percent: the player, then rivals 1–3. */
  readonly player: number;
  readonly rivals: readonly number[];
}

export function hudOf(race: RaceState, course: Course): StageHud {
  const percent = (r: number) => Math.floor(progressPermille(course, r) / 10);
  return {
    place: race.status === 'finished' && race.place !== null ? race.place : livePlace(race),
    player: race.status === 'finished' ? 100 : percent(race.player.r),
    rivals: race.rivals.map((rival) => (rival.finish !== null ? 100 : percent(rival.car.r))),
  };
}

const sameHud = (a: StageHud, b: StageHud) =>
  a.place === b.place && a.player === b.player && a.rivals.every((p, i) => p === b.rivals[i]);

export type HeldKey = 'left' | 'right' | 'down';
type PadButton = 'left' | 'right' | 'down';

/** What the game screen's key handler reaches (§3「キー」). */
export interface StageHandle {
  /** ← → / A D / ↓ S pressed or released. Ignored unless the race is running. */
  holdKey: (key: HeldKey, down: boolean) => void;
}

export interface OvertakeStageProps {
  level: number;
  status: RaceStatus;
  controls: Controls;
  /** Start (`ready`) or resume (`paused`): a press on the board (§2). */
  onPlay: () => void;
  /** The finishing step, once (§2). */
  onFinish: (place: number, bumps: number) => void;
  onHud: (hud: StageHud) => void;
  boardLabel: string;
  padLabel: string;
  leftLabel: string;
  rightLabel: string;
  downLabel: string;
}

interface Held {
  /** The steering finger (Drag only). */
  drag: DragState | null;
  /** Where that finger is now, CSS px from the canvas's corner. */
  pointer: { x: number; y: number };
  /** Mode A: the brake the pull asks for (0..1000), recomputed every frame. */
  dragBrake: number;
  /** Other fingers on the board: the hardest brake while any is down (Drag only). */
  secondFingers: Set<number>;
  /** ◀ ▼ ▶: the pointer holding each, or null. */
  buttons: Record<PadButton, number | null>;
  /** The press each button heard: its trailing click is spent, not acted on. */
  pressed: Record<PadButton, boolean>;
  /**
   * A hold no race step has read yet. A press and release inside one frame
   * (a synthetic or assistive double-tap) moved nothing, so its trailing
   * click is the one-step action instead of being spent (§3).
   */
  unspent: Record<PadButton, boolean>;
  keys: Record<HeldKey, boolean>;
  /** Steps left of a keyboard / assistive ▼ click (§3). */
  tapSteps: number;
  /** The lateral target, logical px, or null before anything steered. */
  target: number | null;
  /** A key or ◀ ▶ moved the target: the next finger move re-anchors (§3). */
  keyMoved: boolean;
  /** CSS px per logical px, measured on the steering finger's press. */
  scale: number;
}

const freshHeld = (): Held => ({
  drag: null,
  pointer: { x: 0, y: 0 },
  dragBrake: 0,
  secondFingers: new Set(),
  buttons: { left: null, right: null, down: null },
  pressed: { left: false, right: false, down: false },
  unspent: { left: false, right: false, down: false },
  keys: { left: false, right: false, down: false },
  tapSteps: 0,
  target: null,
  keyMoved: false,
  scale: 0,
});

/** Paused, finished or blurred: every held input goes (§2). The target stays. */
function dropHeld(held: Held): void {
  held.drag = null;
  held.dragBrake = 0;
  held.secondFingers.clear();
  held.buttons = { left: null, right: null, down: null };
  held.unspent = { left: false, right: false, down: false };
  held.keys = { left: false, right: false, down: false };
  held.tapSteps = 0;
}

const PAD_BUTTONS: readonly PadButton[] = ['left', 'down', 'right'];

function padOf(element: Element): PadButton {
  const which = (element as HTMLElement).dataset.pad;
  return which === 'left' || which === 'right' ? which : 'down';
}

export const OvertakeStage = forwardRef<StageHandle, OvertakeStageProps>(function OvertakeStage(
  {
    level,
    status,
    controls,
    onPlay,
    onFinish,
    onHud,
    boardLabel,
    padLabel,
    leftLabel,
    rightLabel,
    downLabel,
  },
  handleRef,
) {
  const course = useMemo(() => courseFor(level), [level]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const raceRef = useRef<RaceState>(createRace(level));
  const heldRef = useRef<Held>(freshHeld());
  const statusRef = useRef(status);
  statusRef.current = status;
  const controlsRef = useRef(controls);
  controlsRef.current = controls;
  const onPlayRef = useRef(onPlay);
  onPlayRef.current = onPlay;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const onHudRef = useRef(onHud);
  onHudRef.current = onHud;
  /** Draws the board once; set by the canvas effect, a no-op without a 2D context. */
  const drawRef = useRef<() => void>(() => undefined);
  /** One frame of the loop; set by the canvas effect. */
  const frameRef = useRef<(now: number) => void>(() => undefined);
  /** The loop's clock: the last frame's time and the unstepped remainder. */
  const timingRef = useRef<{ lastTime: number | null; accumulator: number }>({
    lastTime: null,
    accumulator: 0,
  });

  /** The car's own lateral target, logical px — where a fresh steer starts from. */
  const carTarget = useCallback(() => raceRef.current.player.target / SUB, []);

  // The provider's status, applied to the race: a start, a resume, a pause.
  // Leaving `running` drops every held input (§2) and draws the stopped board.
  useEffect(() => {
    const race = raceRef.current;
    // Every status change restarts the loop's clock: the first frame after a
    // resume steps from zero, never across the pause.
    timingRef.current = { lastTime: null, accumulator: 0 };
    if (status === 'running') {
      if (race.status === 'ready') raceRef.current = startRace(race);
      else if (race.status === 'paused') raceRef.current = resumeRace(race);
    } else {
      if (race.status === 'running') raceRef.current = pauseRace(race);
      dropHeld(heldRef.current);
    }
    drawRef.current();
  }, [status]);

  useImperativeHandle(
    handleRef,
    () => ({
      holdKey: (key, down) => {
        if (down && statusRef.current !== 'running') return;
        heldRef.current.keys[key] = down;
      },
    }),
    [],
  );

  // The canvas, its colours and its size, and the frame itself. Mounted once
  // per race (the screen keys the stage by level and nonce).
  useEffect(() => {
    let prevHud = hudOf(raceRef.current, course);
    onHudRef.current(prevHud);

    // Keys let go anywhere end their hold, whatever the status (§3).
    const onKeyUp = (event: KeyboardEvent) => {
      const keys = heldRef.current.keys;
      if (event.key === 'ArrowLeft' || event.code === 'KeyA') keys.left = false;
      if (event.key === 'ArrowRight' || event.code === 'KeyD') keys.right = false;
      if (event.key === 'ArrowDown' || event.code === 'KeyS') keys.down = false;
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
      const width = Math.max(1, Math.round((canvas.clientWidth || BOARD_WIDTH) * dpr));
      const height = Math.max(1, Math.round(width * (BOARD_HEIGHT / BOARD_WIDTH)));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const scale = width / BOARD_WIDTH;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    };
    sizeCanvas();

    let palette: Palette = readPalette();
    const draw = () => drawRace(ctx, palette, course, raceRef.current);
    const repaint = () => {
      palette = readPalette();
      draw();
    };
    drawRef.current = draw;

    // The shell swaps the accent by attribute; the OS may flip dark mode (§11).
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
      if (timing.lastTime === null || raceRef.current.status !== 'running') {
        // The first frame of a stretch only takes the time; a frame outside a
        // running race only draws.
        timing.lastTime = now;
        timing.accumulator = 0;
        draw();
        return;
      }
      const dt = Math.min(Math.max(0, now - timing.lastTime), MAX_FRAME_DT_MS);
      timing.lastTime = now;
      const held = heldRef.current;
      const seconds = dt / 1000;

      // Mode A's ratchet sinks with time, finger moving or not (§3).
      if (held.drag !== null && DRAG_MAPPING === 'A' && controlsRef.current === 'drag') {
        const baseY = ratchetBase(held.drag.baseY, held.pointer.y, seconds);
        held.drag = { ...held.drag, baseY };
        held.dragBrake = pullBrake(held.pointer.y - baseY);
      } else {
        held.dragBrake = 0;
      }

      // Capped, not only accumulated: a slow device loses time rather than
      // building a backlog it never pays off (§1, §11).
      let accumulator = Math.min(timing.accumulator + dt, STEP_MS * MAX_STEPS_PER_FRAME);
      let race = raceRef.current;
      let bumped = false;
      let steps = 0;
      while (accumulator >= STEP_MS && steps < MAX_STEPS_PER_FRAME && race.status === 'running') {
        // ← → / A D and ◀ ▶ move the target at the car's own 440 px/s (§3),
        // per step of race time — never by the wall clock, which a slow frame
        // would let run ahead of a car capped at six steps (§1).
        const dir =
          (held.keys.left || held.buttons.left !== null ? -1 : 0) +
          (held.keys.right || held.buttons.right !== null ? 1 : 0);
        if (dir !== 0) {
          held.target = heldTarget(held.target ?? race.player.target / SUB, dir, STEP_SECONDS);
          held.keyMoved = true;
        }
        for (const which of PAD_BUTTONS) {
          if (held.buttons[which] !== null) held.unspent[which] = false;
        }
        const brake = combineBrake({
          drag: held.dragBrake,
          secondFinger: controlsRef.current === 'drag' && held.secondFingers.size > 0,
          downButton: held.buttons.down !== null,
          downKey: held.keys.down,
          tapSteps: held.tapSteps,
        });
        race = stepRace(course, race, toStepInput(held.target, brake));
        if (held.tapSteps > 0) held.tapSteps -= 1;
        if (race.bumped) bumped = true;
        if (race.lockReleased) {
          // The lock is over: steer on from where the car is, so the finger's
          // travel during the lock does not jump it (§3「Bump の後の操舵」).
          held.target = race.player.target / SUB;
          if (held.drag !== null) {
            held.drag = reanchor(held.drag, held.pointer.x, held.pointer.y, held.target);
          }
        }
        accumulator -= STEP_MS;
        steps += 1;
      }
      timing.accumulator = accumulator;
      raceRef.current = race;
      if (bumped) sounds.invalid();

      const hud = hudOf(race, course);
      if (!sameHud(hud, prevHud)) {
        prevHud = hud;
        onHudRef.current(hud);
      }
      draw();

      if (race.status === 'finished' && !reported && race.place !== null) {
        reported = true;
        onFinishRef.current(race.place, race.player.bumps);
      }
    };
    frameRef.current = frame;
    draw();

    // Dev-only seam: frames pumped by hand (tests, a browser pane that never
    // fires requestAnimationFrame). Compiled out of production builds.
    if (import.meta.env.DEV) {
      const w = window as unknown as Record<string, unknown>;
      w.__otFrame = frame;
      w.__otState = () => raceRef.current;
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
        delete w.__otFrame;
        delete w.__otState;
      }
    };
  }, [course]);

  // The loop: requestAnimationFrame only while the race runs (§11).
  const running = status === 'running';
  useEffect(() => {
    if (!running) return undefined;
    let rafId: number | null = null;
    const loop = (now: number) => {
      rafId = null;
      frameRef.current(now);
      if (raceRef.current.status === 'running') rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [running]);

  // ---------- the board ----------

  const localPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top, width: rect.width };
  };

  const capture = (event: ReactPointerEvent<Element>) => {
    // An improvement, never a precondition: it throws if the pointer is
    // already gone, and jsdom has no capture at all.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // The events that do arrive still steer.
    }
  };

  const beginSteer = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const held = heldRef.current;
    const point = localPoint(event);
    held.scale = point.width / BOARD_WIDTH;
    held.pointer = { x: point.x, y: point.y };
    held.drag = beginDrag(event.pointerId, point.x, point.y, held.target ?? carTarget());
    held.keyMoved = false;
    capture(event);
  };

  const onBoardPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const current = statusRef.current;
    if (current === 'finished') return;
    const drag = controlsRef.current === 'drag';
    const held = heldRef.current;
    if (current === 'ready' || current === 'paused') {
      // Start or resume; in Drag, the same finger steers from here (§2).
      onPlayRef.current();
      if (drag && held.drag === null) beginSteer(event);
      return;
    }
    // Buttons: the board is a place to rest a hand — nothing happens (§3).
    if (!drag) return;
    if (held.drag === null) {
      beginSteer(event);
    } else if (event.pointerId !== held.drag.pointerId) {
      // A second finger: the hardest brake, never the steering (§3).
      held.secondFingers.add(event.pointerId);
      capture(event);
    }
  };

  const onBoardPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const held = heldRef.current;
    if (held.drag === null || event.pointerId !== held.drag.pointerId) return;
    const point = localPoint(event);
    held.pointer = { x: point.x, y: point.y };
    if (statusRef.current !== 'running') return;
    if (held.keyMoved) {
      // A key moved the car since: the finger takes it from where it is (§3).
      held.drag = reanchor(held.drag, point.x, point.y, held.target ?? carTarget());
      held.keyMoved = false;
      return;
    }
    const next = dragTarget(held.drag, point.x, held.scale);
    held.target = next.targetX;
    held.drag = next.state;
  };

  /** Release and cancel end the same gesture: the car stays, the brake lets go (§3). */
  const onBoardPointerEnd = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const held = heldRef.current;
    if (held.drag !== null && event.pointerId === held.drag.pointerId) {
      held.drag = null;
      held.dragBrake = 0;
    } else {
      held.secondFingers.delete(event.pointerId);
    }
  };

  // ---------- ◀ ▼ ▶ ----------

  const onPadPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const which = padOf(event.currentTarget);
    const held = heldRef.current;
    // Every press marks its trailing click as spent, acted on or not.
    held.pressed[which] = true;
    // Nothing in `ready` (no accidental start) or while stopped (§2).
    if (statusRef.current !== 'running' || held.buttons[which] !== null) return;
    held.buttons[which] = event.pointerId;
    held.unspent[which] = true;
    capture(event);
  };

  /**
   * Up, cancel and a lost capture all end the hold: a finger that slid off
   * never sticks (§3). A cancel — or a capture lost before any `pointerup` —
   * leaves no click behind, so it also takes back the mark that would have
   * spent one: the next keyboard or assistive click (`detail === 0`) acts.
   * After a `pointerup` the browser's own `lostpointercapture` finds the hold
   * already over and leaves the mark for the click that follows.
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

  const onPadClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const which = padOf(event.currentTarget);
    const held = heldRef.current;
    if (held.unspent[which]) {
      // Pressed and let go before any step read the hold: this click is the
      // one-step action, or the control would have done nothing at all.
      held.unspent[which] = false;
      held.pressed[which] = false;
      stepAction(which);
      return;
    }
    // The click a press leaves behind: the hold already did the work (§3).
    if (event.detail > 0 || held.pressed[which]) {
      held.pressed[which] = false;
      return;
    }
    stepAction(which);
  };

  /** A keyboard or assistive click: a lane for ◀ ▶, half a second of braking for ▼ (§3). */
  const stepAction = (which: PadButton) => {
    const held = heldRef.current;
    if (statusRef.current !== 'running') return;
    if (which === 'down') {
      held.tapSteps = TAP_BRAKE_STEPS;
    } else {
      held.target = clickTarget(
        held.target ?? carTarget(),
        which === 'left' ? -1 : 1,
        course.lanes,
      );
      held.keyMoved = true;
    }
  };

  /** A key on a focused button comes before its click: no press left anything to spend. */
  const onPadKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const which = padOf(event.currentTarget);
    heldRef.current.pressed[which] = false;
    heldRef.current.unspent[which] = false;
  };

  const labels: Record<PadButton, string> = { left: leftLabel, right: rightLabel, down: downLabel };
  const shown = controls === 'buttons' ? PAD_BUTTONS : (['down'] as const);

  return (
    <>
      <div className="ot-board" role="img" aria-label={boardLabel}>
        <canvas
          ref={canvasRef}
          className="ot-canvas"
          aria-hidden="true"
          onPointerDown={onBoardPointerDown}
          onPointerMove={onBoardPointerMove}
          onPointerUp={onBoardPointerEnd}
          onPointerCancel={onBoardPointerEnd}
          onLostPointerCapture={onBoardPointerEnd}
          onContextMenu={(event) => event.preventDefault()}
        />
      </div>
      <div
        className={`ot-pad ${controls === 'buttons' ? 'ot-pad-buttons' : 'ot-pad-drag'}`}
        role="group"
        aria-label={padLabel}
      >
        {shown.map((which) => (
          <button
            key={which}
            type="button"
            className="ot-pad-btn"
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
    </>
  );
});

/** ◀ ▼ ▶ drawn as shapes, so no font decides how they look. */
function PadGlyph({ which }: { which: PadButton }) {
  const d =
    which === 'left'
      ? 'M15 5 L7 12 L15 19 Z'
      : which === 'right'
        ? 'M9 5 L17 12 L9 19 Z'
        : 'M5 8 L19 8 L12 17 Z';
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="ot-pad-glyph">
      <path d={d} />
    </svg>
  );
}
