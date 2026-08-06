/**
 * The Snake board: a Canvas 2D view over the pure simulation in
 * game/engine.ts, and the collection's third real-time game loop.
 *
 * Battery discipline (docs/SNAKE_RULES.md §10, §12): the loop runs only while
 * this component is mounted and the page visible; backgrounding stops it
 * outright and the snake holds where it stands, and a settled run cancels the
 * loop after its final frame. Play time is counted only while the board is
 * actually moving (§9).
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
  BOARD_SEED,
  BOARD_WIDTH,
  CELL,
  SWIPE_THRESHOLD_PX,
} from '../../game/constants';
import { createInitialState, queueTurn, step } from '../../game/engine';
import type { Direction, GameState, Point } from '../../game/types';
import type { RunOutcome } from '../../state/GameContext';
import { addRoundRect } from '../canvas';

// A fixed step keeps the simulation independent of the frame rate; the engine
// carries its own remainder, so a slow frame costs smoothness, never ground.
const STEP_MS = 1000 / 120;
const MAX_STEPS_PER_FRAME = 6;
const MAX_FRAME_DT_MS = 250;

/** The gap around a cell, and the corner it is drawn with (§12). */
const PAD = 2.5;
const SEGMENT_RADIUS = 7;
const FOOD_RADIUS = 7;

/** The body is drawn a shade thinner than the head, so the front reads (§12). */
const BODY_ALPHA = 0.72;

/** Directions by key, arrows and WASD alike (§3). Data, not registration. */
const KEY_DIRECTIONS: Readonly<Record<string, Direction>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  a: 'left',
  s: 'down',
  d: 'right',
  W: 'up',
  A: 'left',
  S: 'down',
  D: 'right',
};

interface Palette {
  surface: string;
  accent: string;
  ink: string;
}

/** Fallbacks are the light-theme series tokens; only jsdom ever needs them. */
function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const pick = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    surface: pick('--surface', '#fffdf8'),
    accent: pick('--accent', '#6d7a34'),
    ink: pick('--ink', '#232a33'),
  };
}

function addSegment(ctx: CanvasRenderingContext2D, cell: Point): void {
  const size = CELL - PAD * 2;
  addRoundRect(ctx, cell.x * CELL + PAD, cell.y * CELL + PAD, size, size, SEGMENT_RADIUS);
}

/**
 * The gap between two neighbouring cells, filled square. Rounding it too
 * would leave four notches where it meets the segments, and the snake would
 * read as a string of beads instead of one body.
 */
function addJoin(ctx: CanvasRenderingContext2D, a: Point, b: Point): void {
  if (a.y === b.y) {
    ctx.rect(Math.max(a.x, b.x) * CELL - PAD, a.y * CELL + PAD, PAD * 2, CELL - PAD * 2);
  } else {
    ctx.rect(a.x * CELL + PAD, Math.max(a.y, b.y) * CELL - PAD, CELL - PAD * 2, PAD * 2);
  }
}

function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  palette: Palette,
  foodScale: number,
): void {
  ctx.fillStyle = palette.surface;
  ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  const snake = state.snake;
  ctx.fillStyle = palette.accent;

  // The body behind the head, drawn as one path and filled once (see
  // ../canvas.ts for why the joins and the segments share a path).
  if (snake.length > 1) {
    ctx.globalAlpha = BODY_ALPHA;
    ctx.beginPath();
    for (let i = 1; i < snake.length; i++) {
      addSegment(ctx, snake[i]!);
      if (i > 1) addJoin(ctx, snake[i - 1]!, snake[i]!);
    }
    ctx.fill();
  }

  // The head and the neck that carries it, solid. One shade denser is the
  // whole of "which end is the front" — no eye, no second colour (§12).
  ctx.globalAlpha = 1;
  ctx.beginPath();
  addSegment(ctx, snake[0]!);
  if (snake.length > 1) addJoin(ctx, snake[0]!, snake[1]!);
  ctx.fill();

  ctx.fillStyle = palette.ink;
  ctx.beginPath();
  ctx.arc(
    state.food.x * CELL + CELL / 2,
    state.food.y * CELL + CELL / 2,
    FOOD_RADIUS * foodScale,
    0,
    Math.PI * 2,
  );
  ctx.fill();
}

export interface BoardHud {
  score: number;
  length: number;
}

export interface SnakeBoardProps {
  /** Fired exactly once, when the run settles (§2). */
  onRunEnd: (outcome: RunOutcome, score: number, length: number) => void;
  /** Books play seconds that just became final (§9). */
  onBookSeconds: (seconds: number) => void;
  /** Fired when the glanceable counts change — once per meal. */
  onHudChange: (hud: BoardHud) => void;
  ariaLabel: string;
}

export function SnakeBoard({ onRunEnd, onBookSeconds, onHudChange, ariaLabel }: SnakeBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState>(createInitialState(BOARD_SEED));
  /** One turn per swipe gesture: `fired` is what stops a drag from spraying. */
  const swipeRef = useRef({ active: false, fired: false, x: 0, y: 0 });
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  const onRunEndRef = useRef(onRunEnd);
  onRunEndRef.current = onRunEnd;
  const onBookSecondsRef = useRef(onBookSeconds);
  onBookSecondsRef.current = onBookSeconds;
  const onHudChangeRef = useRef(onHudChange);
  onHudChangeRef.current = onHudChange;

  /** Milliseconds of live play and the part already booked (§9). */
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

  const turn = useCallback((direction: Direction) => {
    stateRef.current = queueTurn(stateRef.current, direction);
  }, []);

  const onPointerDown = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    swipeRef.current = { active: true, fired: false, x: event.clientX, y: event.clientY };
    // Capture is an improvement (a finger sliding off the canvas still
    // completes its swipe), never a precondition — it throws if the pointer
    // is already gone, and losing a turn to that would be absurd.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // The swipe still lands from the events we do get.
    }
  }, []);

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      const swipe = swipeRef.current;
      if (!swipe.active || swipe.fired) return;
      const dx = event.clientX - swipe.x;
      const dy = event.clientY - swipe.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD_PX) return;
      // The larger component wins outright: a hurried flick is never exactly
      // on an axis, and asking for one would lose half of them (§3).
      swipe.fired = true;
      if (Math.abs(dx) > Math.abs(dy)) {
        turn(dx > 0 ? 'right' : 'left');
      } else {
        turn(dy > 0 ? 'down' : 'up');
      }
    },
    [turn],
  );

  const onPointerUp = useCallback(() => {
    swipeRef.current.active = false;
  }, []);

  // Keyboard play for the web build: arrows and WASD, both turning (§3).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const direction = KEY_DIRECTIONS[event.key];
      if (direction === undefined) return;
      // Without this the arrows scroll the page and the board walks off it.
      if (event.key.indexOf('Arrow') === 0) event.preventDefault();
      turn(direction);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [turn]);

  useEffect(() => {
    // The status row is real even where canvas is not (jsdom): publish the
    // opening counts before the rendering guard.
    const opening = stateRef.current;
    let prevHud: BoardHud = { score: opening.score, length: opening.snake.length };
    onHudChangeRef.current(prevHud);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = BOARD_WIDTH * dpr;
    canvas.height = BOARD_HEIGHT * dpr;
    ctx.scale(dpr, dpr);

    // The food breathes so the eye finds it on a busy board. Stepping one
    // cell at a time is gameplay rather than decoration, so it is not part of
    // what reduced motion turns off (§12).
    let pulseMs = 0;
    const foodScale = () => (reducedRef.current ? 1 : 1 + 0.1 * Math.sin(pulseMs / 180));

    let palette = readPalette();
    const repaint = () => {
      palette = readPalette();
      render(ctx, stateRef.current, palette, foodScale());
    };
    // The shell swaps accent tokens by attribute; the OS may flip dark mode.
    const observer = new MutationObserver(repaint);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-game'],
    });
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', repaint);

    let prevEaten = opening.eaten;

    const publishHud = (state: GameState) => {
      const score = state.score;
      const length = state.snake.length;
      if (prevHud.score === score && prevHud.length === length) return;
      prevHud = { score, length };
      onHudChangeRef.current(prevHud);
    };

    let rafId: number | null = null;
    let lastTime: number | null = null;
    let accumulator = 0;

    const settle = (state: GameState) => {
      if (endedRef.current) return;
      endedRef.current = true;
      flushSeconds();
      if (state.status === 'full') {
        sounds.clear();
        void haptics.clear();
        onRunEndRef.current('full', state.score, state.snake.length);
      } else {
        sounds.gameOver();
        void haptics.invalid();
        onRunEndRef.current('over', state.score, state.snake.length);
      }
    };

    const frame = (now: number) => {
      rafId = requestAnimationFrame(frame);
      if (lastTime === null) lastTime = now;
      const dt = Math.min(now - lastTime, MAX_FRAME_DT_MS);
      lastTime = now;

      if (stateRef.current.status === 'playing') {
        runMsRef.current += dt;
        pulseMs += dt;
        // Capped, not just accumulated: a sustained low frame rate must not
        // build a backlog that never gets paid off. Losing the extra time is
        // the same trade-off MAX_FRAME_DT_MS already makes for one slow frame.
        accumulator = Math.min(accumulator + dt, STEP_MS * MAX_STEPS_PER_FRAME);
        let steps = 0;
        while (accumulator >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
          stateRef.current = step(stateRef.current, STEP_MS);
          accumulator -= STEP_MS;
          steps += 1;
        }
      }

      const current = stateRef.current;

      // Sound belongs to events, so find them by diffing frames. Turning is
      // silent on purpose: near the top speed the flicks would run together
      // into a rattle (§12).
      if (current.eaten > prevEaten) sounds.match();
      prevEaten = current.eaten;
      publishHud(current);

      render(ctx, current, palette, foodScale());

      // A settled run stops the loop after its final frame (battery, §12).
      if (current.status !== 'playing') {
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

    // Backgrounding stops the loop and books the seconds played so far — the
    // OS can kill the app without another event (§9, §10).
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
      (window as unknown as Record<string, unknown>).__snFrame = frame;
      (window as unknown as Record<string, unknown>).__snState = () => stateRef.current;
    }

    return () => {
      stop();
      flushSeconds();
      document.removeEventListener('visibilitychange', onVisibility);
      media.removeEventListener('change', repaint);
      observer.disconnect();
      if (import.meta.env.DEV) {
        // The seam retains the whole loop closure — drop it with the board.
        delete (window as unknown as Record<string, unknown>).__snFrame;
        delete (window as unknown as Record<string, unknown>).__snState;
      }
    };
    // Every new run remounts this component (key is the attempt nonce), so
    // the loop's lifetime is exactly one attempt.
  }, [flushSeconds]);

  return (
    <canvas
      ref={canvasRef}
      className="sn-canvas"
      style={{ aspectRatio: `${BOARD_WIDTH} / ${BOARD_HEIGHT}` }}
      role="img"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}
