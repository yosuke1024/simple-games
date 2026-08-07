/**
 * The Bunny Hop board: a Canvas 2D view over the pure simulation in
 * game/engine.ts, plus the control that drives it.
 *
 * The score is drawn on the track rather than in the app's status row
 * (§6): digits are the same rectangles as the runner, they need no
 * translation, and a scoreboard over the horizon is what this game has looked
 * like since the browser's offline page. The status row keeps the score only
 * as a labelled, screen-reader-visible value.
 *
 * The jump button lives here rather than on the game screen because it is
 * part of the board's input surface: tapping the track jumps, and the button
 * does the same thing with a name and a hit area big enough for a thumb
 * (§3). Keeping them together is also what lets every input path — canvas,
 * button, keyboard — go through one function instead of three that can drift.
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
import { BOARD_HEIGHT, BOARD_WIDTH, GROUND_Y, RUNNER_HEIGHT, RUNNER_X } from '../../game/constants';
import { createInitialState, isGrounded, jump, obstacleX, step } from '../../game/engine';
import { obstacleKind } from '../../game/obstacles';
import type { GameState } from '../../game/types';
import {
  BIRD_DRAW_OFFSET_X,
  BIRD_DRAW_OFFSET_Y,
  BIRD_FRAMES,
  CLOUD,
  GLYPH_GAP,
  GLYPH_WIDTH,
  GLYPHS,
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
const STRIDE_PX = 34;
const WINGBEAT_PX = 120;

/** Clouds drift at a third of the ground's speed — depth for two fillRects. */
const CLOUD_PARALLAX = 0.34;
const CLOUDS: readonly (readonly [number, number])[] = [
  [70, 26],
  [280, 44],
  [470, 18],
];

/** The horizon's bumps and pebbles, spaced unevenly so it is not a ruler. */
const GROUND_MARKS: readonly (readonly [number, number, number])[] = [
  [24, 5, 9],
  [96, 3, 4],
  [151, 8, 3],
  [223, 4, 11],
  [287, 3, 6],
  [341, 7, 5],
  [412, 4, 8],
  [488, 6, 3],
  [545, 3, 7],
];
const GROUND_SPAN = 640;

/** The score is zero-padded to this many digits, scoreboard style (§6). */
const SCORE_DIGITS = 5;
const SCORE_RIGHT = BOARD_WIDTH - 14;
const SCORE_TOP = 12;
/** Blinks after a hundred: shown, hidden, shown — three beats and done. */
const MILESTONE_BLINK_MS = 900;

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
    accent: pick('--accent', '#6e7a34'),
    ink: pick('--ink', '#232a33'),
    inkSoft: pick('--ink-soft', '#6b7480'),
  };
}

/** Draws a shape's rectangles with its box's top-left corner at (x, y). */
function blit(ctx: CanvasRenderingContext2D, rects: readonly Rect[], x: number, y: number): void {
  for (const [rx, ry, rw, rh] of rects) ctx.fillRect(x + rx, y + ry, rw, rh);
}

/** Draws text right-aligned at `right`, in the glyphs the sprites define. */
function blitText(ctx: CanvasRenderingContext2D, text: string, right: number, top: number): void {
  const step = GLYPH_WIDTH + GLYPH_GAP;
  let x = right - text.length * step + GLYPH_GAP;
  for (const char of text) {
    const glyph = GLYPHS[char];
    if (glyph) blit(ctx, glyph, x, top);
    x += step;
  }
}

const pad = (value: number): string => String(Math.min(value, 99999)).padStart(SCORE_DIGITS, '0');

export interface RenderExtras {
  best: number;
  /** Counts down while the hundred just passed is being blinked (§6). */
  blinkMs: number;
  /** Reduced motion: the decoration holds still, the track does not (§12). */
  calm: boolean;
}

function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  palette: Palette,
  extras: RenderExtras,
) {
  const scroll = extras.calm ? 0 : state.distance;

  ctx.fillStyle = palette.surface;
  ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  // Sky, then ground, then the things on it — back to front, once each.
  ctx.fillStyle = palette.inkSoft;
  const drift = scroll * CLOUD_PARALLAX;
  const cloudSpan = BOARD_WIDTH + 60;
  for (const [x, y] of CLOUDS) {
    blit(ctx, CLOUD, ((((x - drift) % cloudSpan) + cloudSpan) % cloudSpan) - 30, y);
  }

  // The horizon: a line with bumps sitting on it and grit scattered below —
  // the ground reads as ground, and the scrolling is visible even on the
  // stretches where no obstacle is on screen.
  ctx.fillRect(0, GROUND_Y, BOARD_WIDTH, 2);
  for (const [x, offset, width] of GROUND_MARKS) {
    const px = ((((x - scroll) % GROUND_SPAN) + GROUND_SPAN) % GROUND_SPAN) - 20;
    ctx.fillRect(px, GROUND_Y + 3 + offset, width, 2);
    ctx.fillRect(px + 6, GROUND_Y - 2, width, 2);
  }

  // Obstacles in the accent, the runner in ink: colour says what is a hazard
  // before its shape does (§12).
  ctx.fillStyle = palette.accent;
  for (const obstacle of state.obstacles) {
    const kind = obstacleKind(obstacle.kindId);
    const x = obstacleX(state.distance, obstacle);
    if (x > BOARD_WIDTH || x + kind.width < 0) continue;
    const y = GROUND_Y - kind.bottom - kind.height;
    if (kind.flying) {
      // The box is the body; the picture hangs off it by a fixed offset (§7).
      const beat = Math.floor(scroll / WINGBEAT_PX) % BIRD_FRAMES.length;
      blit(ctx, BIRD_FRAMES[beat]!, x + BIRD_DRAW_OFFSET_X, y + BIRD_DRAW_OFFSET_Y);
    } else {
      blit(ctx, OBSTACLE_SHAPES[obstacle.kindId], x, y);
    }
  }

  const grounded = isGrounded(state);
  const top = GROUND_Y - state.runnerY - RUNNER_HEIGHT;
  const stride = Math.floor(scroll / STRIDE_PX) % 2;

  ctx.fillStyle = palette.ink;
  blit(ctx, RUNNER_BODY, RUNNER_X, top);
  blit(ctx, grounded ? RUNNER_LEGS[stride]! : RUNNER_LEGS_AIR, RUNNER_X, top);
  // The eye is a hole in the art, so it needs no drawing while the runner is
  // alive. A crashed one has it filled in — the one thing on screen that says
  // the run is over without a word to translate (§12).
  if (state.status === 'over') blit(ctx, RUNNER_EYE, RUNNER_X, top);

  // The scoreboard. The best score sits to the left of the run's own, and
  // only once there is one — a fresh install has nothing to beat.
  const blinking = extras.blinkMs > 0 && Math.floor(extras.blinkMs / 150) % 2 === 1;
  ctx.fillStyle = palette.inkSoft;
  if (extras.best > 0) {
    const width = (SCORE_DIGITS + 4) * (GLYPH_WIDTH + GLYPH_GAP);
    blitText(ctx, `HI ${pad(extras.best)}`, SCORE_RIGHT - width, SCORE_TOP);
  }
  if (!blinking) blitText(ctx, pad(state.score), SCORE_RIGHT, SCORE_TOP);
}

export interface BoardHud {
  score: number;
  status: GameState['status'];
  /** Rises every 100 points; the board blinks the score when it changes (§6). */
  milestones: number;
}

export interface BunnyBoardProps {
  /** The track. A new seed remounts the board through the screen's key. */
  seed: string;
  /** The personal best to show beside the run's score; 0 hides it. */
  best: number;
  /** Fired exactly once, when the run ends (§2). */
  onRunEnd: (score: number, obstaclesPassed: number) => void;
  /** Books play seconds that just became final (§9). */
  onBookSeconds: (seconds: number) => void;
  /** Fired when the glanceable counts change. */
  onHudChange: (hud: BoardHud) => void;
  ariaLabel: string;
  jumpLabel: string;
}

export function BunnyBoard({
  seed,
  best,
  onRunEnd,
  onBookSeconds,
  onHudChange,
  ariaLabel,
  jumpLabel,
}: BunnyBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState>(createInitialState(seed));
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const bestRef = useRef(best);
  bestRef.current = best;

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

  // Every input path is this one function. Sound and haptics belong to the
  // act of jumping, not to the frame that notices it.
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

  const onCanvasPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
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
      // A focused button handles its own keys; taking them here as well would
      // jump twice on one press of the space bar.
      if (event.target instanceof HTMLButtonElement) return;
      if (event.key === ' ' || event.key === 'ArrowUp' || event.key === 'w') {
        event.preventDefault();
        doJump();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [doJump]);

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

    let blinkMs = 0;
    let palette = readPalette();
    const extras = (): RenderExtras => ({
      best: Math.max(bestRef.current, stateRef.current.score),
      blinkMs: reducedRef.current ? 0 : blinkMs,
      calm: reducedRef.current,
    });
    const repaint = () => {
      palette = readPalette();
      render(ctx, stateRef.current, palette, extras());
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
      if (current.milestones > prevMilestones) {
        blinkMs = MILESTONE_BLINK_MS;
        sounds.match();
      }
      prevMilestones = current.milestones;
      if (blinkMs > 0) blinkMs = Math.max(0, blinkMs - dt);

      publishHud(current);
      render(ctx, current, palette, extras());

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

    // Backgrounding stops the loop and books the seconds run so far — the OS
    // can kill the app without another event (§9).
    const onVisibility = () => {
      if (document.hidden) {
        stop();
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
      (window as unknown as Record<string, unknown>).__bhFrame = frame;
      (window as unknown as Record<string, unknown>).__bhState = () => stateRef.current;
    }

    return () => {
      stop();
      flushSeconds();
      document.removeEventListener('visibilitychange', onVisibility);
      media.removeEventListener('change', repaint);
      observer.disconnect();
      if (import.meta.env.DEV) {
        // The seam retains the whole loop closure — drop it with the board.
        delete (window as unknown as Record<string, unknown>).__bhFrame;
        delete (window as unknown as Record<string, unknown>).__bhState;
      }
    };
    // A new run remounts this component (the screen's key carries the run's
    // nonce), so the loop's lifetime is exactly one run.
  }, [flushSeconds]);

  return (
    <>
      {/* The whole area around the track jumps, not just the strip itself:
          the board is a short band on a tall phone, and a thumb should not
          have to find it (§3). */}
      <div className="bh-stage" onPointerDown={onCanvasPointerDown}>
        <canvas
          ref={canvasRef}
          className="bh-canvas"
          style={{ aspectRatio: `${BOARD_WIDTH} / ${BOARD_HEIGHT}` }}
          role="img"
          aria-label={ariaLabel}
        />
      </div>
      <button
        type="button"
        className="bh-jump"
        aria-label={jumpLabel}
        onPointerDown={(event) => {
          // On the first frame the finger lands, not on the frame it lifts:
          // a runner is judged in tenths of a second (§3).
          event.preventDefault();
          doJump();
        }}
        // `detail === 0` is a click that came from a keyboard or an assistive
        // technology, where no pointer event ran before it.
        onClick={(event) => {
          if (event.detail === 0) doJump();
        }}
      >
        <span aria-hidden="true">↑</span>
      </button>
    </>
  );
}
