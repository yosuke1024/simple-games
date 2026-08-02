/**
 * The Brick Breaker board: a Canvas 2D view over the pure simulation in
 * game/engine.ts, and the collection's first real-time game loop.
 *
 * Battery discipline (docs/BRICK_BREAKER_RULES.md §6, §9, §12):
 * - The loop runs only while this component is mounted and the page visible;
 *   backgrounding stops it outright, and a settled run (cleared/failed)
 *   cancels it after the final frame.
 * - While every ball is waiting on the paddle nothing moves, so the
 *   simulation is not stepped and the wall does not creep — aiming time is
 *   free, and play time is only counted while the board is live.
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
  BALL_RADIUS,
  BOARD_HEIGHT,
  BOARD_SEED,
  BOARD_WIDTH,
  DESCENT_LINE_Y,
  PADDLE_HEIGHT,
  PADDLE_SPEED,
  PADDLE_Y,
} from '../../game/constants';
import {
  brickTop,
  createInitialState,
  launchBall,
  movePaddleBy,
  paddleWidth,
  setPaddleCenterX,
  step,
} from '../../game/engine';
import type { GameState } from '../../game/types';
import type { RunOutcome } from '../../state/GameContext';
import { easeOut, roundRectPath } from '../canvas';

// Physics at a fixed step for stable collision response; paddle input is
// applied once per rendered frame, which is all it needs.
const STEP_MS = 1000 / 120;
const MAX_STEPS_PER_FRAME = 6;
const MAX_FRAME_DT_MS = 250;

/** How long a broken brick stays on screen, shrinking and fading (§12). */
const BREAK_MS = 150;
const BRICK_RADIUS = 3;

interface Palette {
  surface: string;
  accent: string;
  accentSoft: string;
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
    accentSoft: pick('--accent-soft', '#f0e8d3'),
    ink: pick('--ink', '#232a33'),
    inkSoft: pick('--ink-soft', '#5c6772'),
  };
}

/** A brick caught mid-disappearance. Lives in the view, never in the sim. */
interface Breaking {
  x: number;
  y: number;
  width: number;
  height: number;
  age: number;
}

function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  palette: Palette,
  breaking: readonly Breaking[],
) {
  ctx.fillStyle = palette.surface;
  ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  // The line the wall must not reach: a hairline with the faintest shade
  // resting above it — a floor, not an alarm, and never a countdown (§6).
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = palette.inkSoft;
  ctx.fillRect(0, DESCENT_LINE_Y - 24, BOARD_WIDTH, 24);
  ctx.globalAlpha = 0.45;
  ctx.fillRect(0, DESCENT_LINE_Y, BOARD_WIDTH, 1);
  ctx.globalAlpha = 1;

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = palette.accent;
  for (const brick of state.bricks) {
    if (!brick.alive) continue;
    const y = brickTop(brick, state.descent);
    if (brick.kind === 'ball') {
      // The same brick, hollow: one outline says "this one gives something
      // back" without a legend or a second colour to learn (§5).
      roundRectPath(
        ctx,
        brick.x + 0.75,
        y + 0.75,
        brick.width - 1.5,
        brick.height - 1.5,
        BRICK_RADIUS,
      );
      ctx.fillStyle = palette.accentSoft;
      ctx.fill();
      ctx.stroke();
    } else {
      roundRectPath(ctx, brick.x, y, brick.width, brick.height, BRICK_RADIUS);
      ctx.fillStyle = palette.accent;
      ctx.fill();
    }
  }

  // Broken bricks shrink toward their own centre as they fade — the brick
  // stops existing over 150ms instead of between two frames (§12).
  ctx.fillStyle = palette.accent;
  for (const piece of breaking) {
    const t = easeOut(piece.age / BREAK_MS);
    const scale = 1 - t * 0.35;
    const w = piece.width * scale;
    const h = piece.height * scale;
    ctx.globalAlpha = 1 - t;
    roundRectPath(
      ctx,
      piece.x + (piece.width - w) / 2,
      piece.y + (piece.height - h) / 2,
      w,
      h,
      BRICK_RADIUS,
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const width = paddleWidth(state);
  ctx.fillStyle = palette.ink;
  roundRectPath(ctx, state.paddleX - width / 2, PADDLE_Y, width, PADDLE_HEIGHT, PADDLE_HEIGHT / 2);
  ctx.fill();

  for (const ball of state.balls) {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }
}

export interface BoardHud {
  lives: number;
  bricksLeft: number;
}

export interface BrickBoardProps {
  level: number;
  /** Fired exactly once, when the run settles (§2). */
  onRunEnd: (outcome: RunOutcome, seconds: number) => void;
  /** Books play seconds that just became final (§9). */
  onBookSeconds: (seconds: number) => void;
  /** Fired when the glanceable counts change — a few times per run. */
  onHudChange: (hud: BoardHud) => void;
  ariaLabel: string;
}

export function BrickBoard({
  level,
  onRunEnd,
  onBookSeconds,
  onHudChange,
  ariaLabel,
}: BrickBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState>(createInitialState(BOARD_SEED, level));
  const draggingRef = useRef(false);
  const keysRef = useRef({ left: false, right: false });
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  const onRunEndRef = useRef(onRunEnd);
  onRunEndRef.current = onRunEnd;
  const onBookSecondsRef = useRef(onBookSeconds);
  onBookSecondsRef.current = onBookSeconds;
  const onHudChangeRef = useRef(onHudChange);
  onHudChangeRef.current = onHudChange;

  /** Milliseconds of live play (stepping only, §9) and the part already booked. */
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

  const toLogicalX = useCallback((clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return BOARD_WIDTH / 2;
    const rect = canvas.getBoundingClientRect();
    const ratio = rect.width === 0 ? 0.5 : (clientX - rect.left) / rect.width;
    return Math.min(1, Math.max(0, ratio)) * BOARD_WIDTH;
  }, []);

  const launch = useCallback(() => {
    const before = stateRef.current;
    stateRef.current = launchBall(before);
    if (stateRef.current !== before) sounds.select();
  }, []);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      draggingRef.current = true;
      stateRef.current = setPaddleCenterX(stateRef.current, toLogicalX(event.clientX));
      launch();
      // Capture is an improvement (a finger sliding off the canvas keeps
      // steering), never a precondition — it throws if the pointer is already
      // gone, and losing the paddle to that would be absurd.
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Steering still works from the events we do get.
      }
    },
    [toLogicalX, launch],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (!draggingRef.current) return;
      stateRef.current = setPaddleCenterX(stateRef.current, toLogicalX(event.clientX));
    },
    [toLogicalX],
  );

  const onPointerUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  // Keyboard play for the web build: arrows steer, space launches (§3).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') keysRef.current.left = true;
      if (event.key === 'ArrowRight') keysRef.current.right = true;
      if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault();
        launch();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') keysRef.current.left = false;
      if (event.key === 'ArrowRight') keysRef.current.right = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [launch]);

  useEffect(() => {
    // The status row is real even where canvas is not (jsdom): publish the
    // opening counts before the rendering guard.
    const opening = stateRef.current;
    onHudChangeRef.current({
      lives: opening.lives,
      bricksLeft: opening.bricks.reduce((n, brick) => n + (brick.alive ? 1 : 0), 0),
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
      render(ctx, stateRef.current, palette, breaking);
    };
    // The shell swaps accent tokens by attribute; the OS may flip dark mode.
    const observer = new MutationObserver(repaint);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-game'],
    });
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', repaint);

    let breaking: Breaking[] = [];
    let prevAlive: boolean[] = stateRef.current.bricks.map((brick) => brick.alive);
    let prevDescent = stateRef.current.descent;
    let prevBallCount = stateRef.current.balls.length;
    let prevLives = stateRef.current.lives;
    let prevBricksLeft = -1;

    const publishHud = (state: GameState) => {
      const bricksLeft = state.bricks.reduce((n, brick) => n + (brick.alive ? 1 : 0), 0);
      if (state.lives === prevLives && bricksLeft === prevBricksLeft) return;
      prevBricksLeft = bricksLeft;
      onHudChangeRef.current({ lives: state.lives, bricksLeft });
    };
    publishHud(stateRef.current);

    let rafId: number | null = null;
    let lastTime: number | null = null;
    let accumulator = 0;

    const settle = (state: GameState) => {
      if (endedRef.current) return;
      endedRef.current = true;
      flushSeconds();
      const seconds = Math.floor(runMsRef.current / 1000);
      if (state.status === 'cleared') {
        sounds.clear();
        void haptics.clear();
        onRunEndRef.current('cleared', seconds);
      } else {
        sounds.gameOver();
        void haptics.invalid();
        onRunEndRef.current('failed', seconds);
      }
    };

    const frame = (now: number) => {
      rafId = requestAnimationFrame(frame);
      if (lastTime === null) lastTime = now;
      const dt = Math.min(now - lastTime, MAX_FRAME_DT_MS);
      lastTime = now;

      const state = stateRef.current;
      const dir = (keysRef.current.left ? -1 : 0) + (keysRef.current.right ? 1 : 0);
      if (dir !== 0 && !draggingRef.current) {
        stateRef.current = movePaddleBy(stateRef.current, dir * PADDLE_SPEED * (dt / 1000));
      }

      // Aiming is free: while every ball waits on the paddle nothing moves,
      // nothing is stepped, and the wall holds still (§6, §9).
      const live = state.status === 'playing' && state.balls.some((b) => b.status === 'launched');
      if (live) {
        runMsRef.current += dt;
        accumulator += dt;
        let steps = 0;
        while (accumulator >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
          stateRef.current = step(stateRef.current, STEP_MS);
          accumulator -= STEP_MS;
          steps += 1;
        }
      }

      const current = stateRef.current;

      // Sound belongs to events, so find them by diffing frames.
      if (current.balls.length > prevBallCount) sounds.match();
      if (current.lives < prevLives) {
        sounds.invalid();
        void haptics.invalid();
      }
      prevBallCount = current.balls.length;
      publishHud(current);
      prevLives = current.lives;

      if (!reducedRef.current) {
        for (let i = 0; i < current.bricks.length; i++) {
          if (!prevAlive[i] || current.bricks[i]!.alive) continue;
          const brick = current.bricks[i]!;
          breaking.push({
            x: brick.x,
            y: brick.y + prevDescent,
            width: brick.width,
            height: brick.height,
            age: 0,
          });
          sounds.select();
        }
        for (const piece of breaking) piece.age += dt;
        if (breaking.some((piece) => piece.age >= BREAK_MS)) {
          breaking = breaking.filter((piece) => piece.age < BREAK_MS);
        }
      } else {
        // Reduced motion: no fade, but the break still sounds.
        for (let i = 0; i < current.bricks.length; i++) {
          if (prevAlive[i] && !current.bricks[i]!.alive) sounds.select();
        }
      }
      prevAlive = current.bricks.map((brick) => brick.alive);
      prevDescent = current.descent;

      render(ctx, current, palette, breaking);

      // A settled run stops the loop after its final frame (battery, §12).
      if (current.status !== 'playing' && breaking.length === 0) {
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
    // OS can kill the app without another event (§9).
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
      (window as unknown as Record<string, unknown>).__bbFrame = frame;
      (window as unknown as Record<string, unknown>).__bbState = () => stateRef.current;
    }

    return () => {
      stop();
      flushSeconds();
      document.removeEventListener('visibilitychange', onVisibility);
      media.removeEventListener('change', repaint);
      observer.disconnect();
    };
    // A new level or retry remounts this component (key includes the nonce),
    // so the loop's lifetime is exactly one attempt.
  }, [flushSeconds]);

  return (
    <canvas
      ref={canvasRef}
      className="bb-canvas"
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
