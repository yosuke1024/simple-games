/**
 * The Dino Run board: a Canvas 2D view over the pure simulation in
 * game/engine.ts, plus the two controls that drive it.
 *
 * The controls live here rather than on the game screen because they are part
 * of the board's input surface: tapping the track jumps, and the two buttons
 * under it do the same two things with a name and a hit area big enough for a
 * thumb (docs/DINO_RUN_RULES.md §3). Keeping them together is also what lets
 * every input path — canvas, buttons, keyboard — go through one function
 * each, instead of three that can drift apart.
 *
 * Battery discipline (§9, §12): the loop runs only while this component is
 * mounted and the page visible; backgrounding stops it outright, and a
 * finished run cancels it after the final frame. Play time counts only while
 * the track is actually moving.
 *
 * Colors come from the accent tokens the shell stamps per game
 * (ui/styles.css), read from computed style and re-read when the theme
 * changes — the canvas follows dark mode exactly like the DOM around it.
 */
import { useCallback, useEffect, useRef, type PointerEvent } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useReducedMotion } from '@/ui/useReducedMotion';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  DUCK_HEIGHT,
  GROUND_Y,
  RUNNER_HEIGHT,
  RUNNER_X,
} from '../../game/constants';
import {
  createInitialState,
  isGrounded,
  jump,
  obstacleX,
  setDucking,
  step,
} from '../../game/engine';
import { obstacleKind } from '../../game/obstacles';
import type { GameState } from '../../game/types';
import {
  BIRD_WINGS,
  CLOUD,
  DUCK_BODY,
  DUCK_EYE,
  DUCK_LEGS,
  OBSTACLE_SHAPES,
  RUNNER_BODY,
  RUNNER_EYE,
  RUNNER_LEGS,
  RUNNER_LEGS_AIR,
  type Rect,
} from './sprites';

const STEP_MS = 1000 / 120;
const MAX_STEPS_PER_FRAME = 6;
const MAX_FRAME_DT_MS = 250;

/** One stride, and one wingbeat. Both are read off the distance run, so they
    speed up with the track instead of drifting away from it. */
const STRIDE_PX = 26;
const WINGBEAT_PX = 90;

/** Clouds drift at a third of the ground's speed — depth for two fillRects. */
const CLOUD_PARALLAX = 0.34;
const CLOUDS: readonly (readonly [number, number])[] = [
  [40, 26],
  [190, 44],
  [300, 18],
];

/** The pebbles on the ground, spaced unevenly so the track is not a ruler. */
const PEBBLES: readonly (readonly [number, number, number])[] = [
  [14, 5, 7],
  [96, 3, 4],
  [151, 6, 3],
  [223, 4, 8],
  [287, 3, 5],
  [341, 5, 6],
];
const PEBBLE_SPAN = 400;

interface Palette {
  surface: string;
  accent: string;
  ink: string;
  inkSoft: string;
}

/** Fallbacks are the light-theme series tokens; only jsdom ever needs them. */
function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const pick = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    surface: pick('--surface', '#fffdf8'),
    accent: pick('--accent', '#8a6a2b'),
    ink: pick('--ink', '#232a33'),
    inkSoft: pick('--ink-soft', '#6b7480'),
  };
}

/** Draws a shape's rectangles with its box's top-left corner at (x, y). */
function blit(ctx: CanvasRenderingContext2D, rects: readonly Rect[], x: number, y: number): void {
  for (const [rx, ry, rw, rh] of rects) ctx.fillRect(x + rx, y + ry, rw, rh);
}

/**
 * `calm` is reduced motion (§12). The track itself still moves — that is the
 * game, not decoration — but everything that moves *only* to look alive stops:
 * the clouds and pebbles hold still and the runner keeps one pose.
 */
function render(ctx: CanvasRenderingContext2D, state: GameState, palette: Palette, calm: boolean) {
  const scroll = calm ? 0 : state.distance;

  ctx.fillStyle = palette.surface;
  ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  // Sky, then ground, then the things on it — back to front, once each.
  ctx.fillStyle = palette.inkSoft;
  const drift = scroll * CLOUD_PARALLAX;
  const cloudSpan = BOARD_WIDTH + 60;
  for (const [x, y] of CLOUDS) {
    blit(ctx, CLOUD, ((((x - drift) % cloudSpan) + cloudSpan) % cloudSpan) - 30, y);
  }

  ctx.fillRect(0, GROUND_Y, BOARD_WIDTH, 2);
  for (const [x, offset, width] of PEBBLES) {
    const px = ((((x - scroll) % PEBBLE_SPAN) + PEBBLE_SPAN) % PEBBLE_SPAN) - 20;
    ctx.fillRect(px, GROUND_Y + 3 + offset, width, 2);
  }

  // Obstacles in the accent, the runner in ink: colour says what is a hazard
  // before its shape does (§12).
  ctx.fillStyle = palette.accent;
  for (const obstacle of state.obstacles) {
    const kind = obstacleKind(obstacle.kindId);
    const x = obstacleX(state.distance, obstacle);
    if (x > BOARD_WIDTH || x + kind.width < 0) continue;
    const y = GROUND_Y - kind.bottom - kind.height;
    blit(ctx, OBSTACLE_SHAPES[obstacle.kindId], x, y);
    if (kind.flying) {
      const beat = Math.floor(scroll / WINGBEAT_PX) % BIRD_WINGS.length;
      const [wx, wy, ww, wh] = BIRD_WINGS[beat]!;
      ctx.fillRect(x + wx, y + wy, ww, wh);
    }
  }

  const grounded = isGrounded(state);
  const ducking = state.ducking && grounded;
  const height = ducking ? DUCK_HEIGHT : RUNNER_HEIGHT;
  const top = GROUND_Y - state.runnerY - height;

  ctx.fillStyle = palette.ink;
  const stride = Math.floor(scroll / STRIDE_PX) % 2;
  if (ducking) {
    blit(ctx, DUCK_BODY, RUNNER_X, top);
    blit(ctx, DUCK_LEGS[stride]!, RUNNER_X, top);
  } else {
    blit(ctx, RUNNER_BODY, RUNNER_X, top);
    blit(ctx, grounded ? RUNNER_LEGS[stride]! : RUNNER_LEGS_AIR, RUNNER_X, top);
  }

  // The eye last, punched back out in the surface colour. A crashed runner
  // loses it — the one thing on screen that says the run is over without a
  // word to translate (§12).
  if (state.status !== 'over') {
    ctx.fillStyle = palette.surface;
    const [ex, ey, ew, eh] = ducking ? DUCK_EYE : RUNNER_EYE;
    ctx.fillRect(RUNNER_X + ex, top + ey, ew, eh);
  }
}

export interface BoardHud {
  score: number;
  status: GameState['status'];
  /** Rises every 100 points; the score line flashes when it changes (§6). */
  milestones: number;
}

export interface DinoBoardProps {
  /** The track. A new seed remounts the board through the screen's key. */
  seed: string;
  /** Fired exactly once, when the run ends (§2). */
  onRunEnd: (score: number, obstaclesPassed: number) => void;
  /** Books play seconds that just became final (§9). */
  onBookSeconds: (seconds: number) => void;
  /** Fired when the glanceable counts change. */
  onHudChange: (hud: BoardHud) => void;
  ariaLabel: string;
  jumpLabel: string;
  duckLabel: string;
}

export function DinoBoard({
  seed,
  onRunEnd,
  onBookSeconds,
  onHudChange,
  ariaLabel,
  jumpLabel,
  duckLabel,
}: DinoBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState>(createInitialState(seed));
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  const onRunEndRef = useRef(onRunEnd);
  onRunEndRef.current = onRunEnd;
  const onBookSecondsRef = useRef(onBookSeconds);
  onBookSecondsRef.current = onBookSeconds;
  const onHudChangeRef = useRef(onHudChange);
  onHudChangeRef.current = onHudChange;

  /** Milliseconds of live running and the part already booked (§9). */
  const runMsRef = useRef(0);
  const bookedSecondsRef = useRef(0);
  const endedRef = useRef(false);

  const flushSeconds = useCallback(() => {
    const whole = Math.floor(runMsRef.current / 1000);
    const unbooked = whole - bookedSecondsRef.current;
    if (unbooked > 0) {
      bookedSecondsRef.current = whole;
      onBookSecondsRef.current(unbooked);
    }
  }, []);

  // The three input paths, each one line deep. Sound and haptics belong to
  // the act of jumping, not to the frame that notices it.
  const doJump = useCallback(() => {
    const before = stateRef.current;
    const after = jump(before);
    if (after === before) return;
    stateRef.current = after;
    if (isGrounded(before)) {
      sounds.select();
      void haptics.tap();
    }
  }, []);

  const doDuck = useCallback((ducking: boolean) => {
    stateRef.current = setDucking(stateRef.current, ducking);
  }, []);

  const onCanvasPointerDown = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      doJump();
    },
    [doJump],
  );

  // Keyboard play for the web build (§3). Space and the arrows are the keys a
  // browser also scrolls with, so they are taken here.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      // A focused control button handles its own keys; taking them here too
      // would jump *and* duck from one press of the space bar.
      if (event.target instanceof HTMLButtonElement) return;
      if (event.key === ' ' || event.key === 'ArrowUp' || event.key === 'w') {
        event.preventDefault();
        doJump();
      } else if (event.key === 'ArrowDown' || event.key === 's') {
        event.preventDefault();
        doDuck(true);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown' || event.key === 's') doDuck(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [doJump, doDuck]);

  useEffect(() => {
    // The status row is real even where canvas is not (jsdom): publish the
    // opening counts before the rendering guard.
    const opening = stateRef.current;
    onHudChangeRef.current({
      score: opening.score,
      status: opening.status,
      milestones: opening.milestones,
    });

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = BOARD_WIDTH * dpr;
    canvas.height = BOARD_HEIGHT * dpr;
    ctx.scale(dpr, dpr);

    let palette = readPalette();
    const repaint = () => {
      palette = readPalette();
      render(ctx, stateRef.current, palette, reducedRef.current);
    };
    // The shell swaps accent tokens by attribute; the OS may flip dark mode.
    const observer = new MutationObserver(repaint);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-game'],
    });
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', repaint);

    let prevHud: BoardHud | null = null;
    const publishHud = (state: GameState) => {
      const hud: BoardHud = {
        score: state.score,
        status: state.status,
        milestones: state.milestones,
      };
      if (
        prevHud &&
        prevHud.score === hud.score &&
        prevHud.status === hud.status &&
        prevHud.milestones === hud.milestones
      ) {
        return;
      }
      prevHud = hud;
      onHudChangeRef.current(hud);
    };

    let rafId: number | null = null;
    let lastTime: number | null = null;
    let accumulator = 0;

    const settle = (state: GameState) => {
      if (endedRef.current) return;
      endedRef.current = true;
      flushSeconds();
      sounds.gameOver();
      void haptics.invalid();
      onRunEndRef.current(state.score, state.obstaclesPassed);
    };

    let prevMilestones = stateRef.current.milestones;

    const frame = (now: number) => {
      rafId = requestAnimationFrame(frame);
      if (lastTime === null) lastTime = now;
      const dt = Math.min(now - lastTime, MAX_FRAME_DT_MS);
      lastTime = now;

      if (stateRef.current.status === 'running') {
        runMsRef.current += dt;
        // Capped, not just accumulated: a sustained low frame rate must not
        // build a backlog that never gets paid off. Losing the extra time is
        // the same trade-off MAX_FRAME_DT_MS already makes for one slow frame.
        accumulator = Math.min(accumulator + dt, STEP_MS * MAX_STEPS_PER_FRAME);
        let steps = 0;
        while (accumulator >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
          stateRef.current = step(stateRef.current, STEP_MS);
          accumulator -= STEP_MS;
          steps += 1;
          if (stateRef.current.status !== 'running') break;
        }
      }

      const current = stateRef.current;
      if (current.milestones > prevMilestones) sounds.match();
      prevMilestones = current.milestones;

      publishHud(current);
      render(ctx, current, palette, reducedRef.current);

      // A finished run stops the loop after its final frame (battery, §12).
      if (current.status === 'over') {
        settle(current);
        stop();
      }
    };

    const start = () => {
      if (rafId !== null || endedRef.current) return;
      lastTime = null;
      rafId = requestAnimationFrame(frame);
    };
    const stop = () => {
      if (rafId === null) return;
      cancelAnimationFrame(rafId);
      rafId = null;
    };

    // Backgrounding stops the loop, drops the held duck (the finger is gone
    // as far as this game knows) and books the seconds run so far — the OS
    // can kill the app without another event (§9).
    const onVisibility = () => {
      if (document.hidden) {
        stop();
        stateRef.current = setDucking(stateRef.current, false);
        flushSeconds();
      } else {
        start();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    if (!document.hidden) start();

    // Dev-only seam: the review harness's browser pane never fires
    // requestAnimationFrame, so frames are pumped by hand there. Compiled out
    // of production builds.
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__drFrame = frame;
      (window as unknown as Record<string, unknown>).__drState = () => stateRef.current;
    }

    return () => {
      stop();
      flushSeconds();
      document.removeEventListener('visibilitychange', onVisibility);
      media.removeEventListener('change', repaint);
      observer.disconnect();
      if (import.meta.env.DEV) {
        // The seam retains the whole loop closure — drop it with the board.
        delete (window as unknown as Record<string, unknown>).__drFrame;
        delete (window as unknown as Record<string, unknown>).__drState;
      }
    };
    // A new run remounts this component (the screen's key carries the run's
    // nonce), so the loop's lifetime is exactly one run.
  }, [flushSeconds]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="dr-canvas"
        style={{ aspectRatio: `${BOARD_WIDTH} / ${BOARD_HEIGHT}` }}
        role="img"
        aria-label={ariaLabel}
        onPointerDown={onCanvasPointerDown}
      />
      <div className="dr-controls">
        <button
          type="button"
          className="dr-control"
          aria-label={jumpLabel}
          onPointerDown={(event) => {
            // On the first frame the finger lands, not on the frame it lifts:
            // a runner is judged in tenths of a second (§3).
            event.preventDefault();
            doJump();
          }}
          // `detail === 0` is a click that came from a keyboard or an
          // assistive technology, where no pointer event ran before it.
          onClick={(event) => {
            if (event.detail === 0) doJump();
          }}
        >
          <span aria-hidden="true">↑</span>
        </button>
        <button
          type="button"
          className="dr-control"
          aria-label={duckLabel}
          onPointerDown={(event) => {
            event.preventDefault();
            doDuck(true);
          }}
          onPointerUp={() => doDuck(false)}
          onPointerCancel={() => doDuck(false)}
          onPointerLeave={() => doDuck(false)}
          // Held from the keyboard too: a button already reports its own key
          // down and up, so ducking works while the key is held rather than
          // for some duration this game would have to invent.
          onKeyDown={(event) => {
            if (event.key === ' ' || event.key === 'Enter') doDuck(true);
          }}
          onKeyUp={(event) => {
            if (event.key === ' ' || event.key === 'Enter') doDuck(false);
          }}
        >
          <span aria-hidden="true">↓</span>
        </button>
      </div>
    </>
  );
}
