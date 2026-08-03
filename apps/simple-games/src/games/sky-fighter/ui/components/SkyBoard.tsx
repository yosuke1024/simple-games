/**
 * The Sky Fighter board: a Canvas 2D view over the pure simulation in
 * game/engine.ts.
 *
 * Battery discipline (docs/SKY_FIGHTER_RULES.md §9, §12): the loop runs only
 * while this component is mounted and the page visible; backgrounding stops
 * it outright, and a settled run (cleared/failed) cancels it after the final
 * frame. Play time counts while the sky is live.
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
  BULLET_RADIUS,
  ENEMY_BULLET_RADIUS,
  ENEMY_RADII,
  SHIP_RADIUS,
  SHIP_SPEED,
  SHIP_Y,
  TOKEN_RADIUS,
} from '../../game/constants';
import { createInitialState, moveShipBy, setShipX, step } from '../../game/engine';
import { wavesInLevel } from '../../game/levels';
import type { GameState } from '../../game/types';
import type { RunOutcome } from '../../state/GameContext';
import { easeOut } from '../canvas';

const STEP_MS = 1000 / 120;
const MAX_STEPS_PER_FRAME = 6;
const MAX_FRAME_DT_MS = 250;

/** How long a downed craft keeps falling as it fades (§12). */
const DOWN_MS = 220;

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
    accent: pick('--accent', '#5d5aa8'),
    ink: pick('--ink', '#232a33'),
  };
}

/**
 * Every craft is a half-outline mirrored around its own centre line, built
 * from a handful of points — enough for a swept wing to read at 20px, cheap
 * enough to draw a dozen of per frame on a weak WebView.
 *
 * The player points up and every enemy points down. That single opposition is
 * what says "these are two sides"; nothing else on screen has to explain it.
 */
const PLAYER_OUTLINE: readonly (readonly [number, number])[] = [
  [0, -1], // nose
  [0.14, -0.35], // fuselage
  [0.88, 0.2], // wing leading edge
  [0.8, 0.46], // wing trailing edge — the gap between these two is the wing
  [0.2, 0.3], // wing root
  [0.38, 0.88], // tailplane
  [0, 0.7], // tail root
];

/**
 * One silhouette per enemy tier, all of them nose-down. Size already tells the
 * three apart; the shapes make each one a *kind* of aircraft, so a wave reads
 * as a formation rather than as three copies of the same circle (§12).
 */
const ENEMY_OUTLINES: readonly (readonly (readonly [number, number])[])[] = [
  // Tier 0 — bomber. Long straight wings and a wide tailplane: heavy, the one
  // that breaks into the most pieces, and the only one that shoots back (§6).
  [
    [0, 1],
    [0.24, 0.52],
    [1, 0.16],
    [1, -0.1],
    [0.28, -0.28],
    [0.74, -0.9],
    [0, -0.72],
  ],
  // Tier 1 — fighter. The player's own planform, flown the other way.
  [
    [0, 1],
    [0.14, 0.35],
    [0.88, -0.2],
    [0.8, -0.46],
    [0.2, -0.3],
    [0.38, -0.88],
    [0, -0.7],
  ],
  // Tier 2 — dart. Sharply swept and narrow, so the smallest still reads as
  // fast rather than as a speck.
  [
    [0, 1],
    [0.12, 0.24],
    [0.66, -0.56],
    [0.18, -0.5],
    [0.3, -0.96],
    [0, -0.8],
  ],
];

/** Traces a half-outline and its mirror as one closed path. */
function craftPath(
  ctx: CanvasRenderingContext2D,
  outline: readonly (readonly [number, number])[],
  x: number,
  y: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + outline[0]![0] * radius, y + outline[0]![1] * radius);
  for (let i = 1; i < outline.length; i++) {
    ctx.lineTo(x + outline[i]![0] * radius, y + outline[i]![1] * radius);
  }
  for (let i = outline.length - 1; i >= 1; i--) {
    ctx.lineTo(x - outline[i]![0] * radius, y + outline[i]![1] * radius);
  }
  ctx.closePath();
}

/** A craft caught mid-fall. Lives in the view, never in the simulation. */
interface Falling {
  x: number;
  y: number;
  radius: number;
  tier: number;
  /** Radians it keels through as it goes; sign alternates so a split pair
      does not fall as a mirrored cliche. */
  spin: number;
  age: number;
}

function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  palette: Palette,
  falling: readonly Falling[],
) {
  ctx.fillStyle = palette.surface;
  ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  ctx.fillStyle = palette.accent;
  for (const bullet of state.bullets) {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, BULLET_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  // Enemy fire is a falling tracer, not a dot: at a glance the shape alone
  // says which way a shot is going, without a second colour to decode (§6).
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = ENEMY_BULLET_RADIUS * 1.6;
  ctx.lineCap = 'round';
  for (const shot of state.enemyBullets) {
    ctx.beginPath();
    ctx.moveTo(shot.x, shot.y - 5);
    ctx.lineTo(shot.x, shot.y + 5);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';

  // Enemies are solid in the accent while the player is drawn in ink: colour
  // says which side a thing is on before its shape does (§12).
  ctx.lineJoin = 'round';
  ctx.fillStyle = palette.accent;
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 1;
  for (const enemy of state.enemies) {
    const radius = ENEMY_RADII[enemy.tier]!;
    craftPath(ctx, ENEMY_OUTLINES[enemy.tier]!, enemy.x, enemy.y, radius - 0.5);
    ctx.fill();
    ctx.stroke();
  }

  // A downed craft keels over: it shrinks, turns a little, and fades out over
  // 220ms. No burst, no debris — the thing already on screen simply stops
  // existing over time instead of between two frames (§12).
  for (const wreck of falling) {
    const t = easeOut(wreck.age / DOWN_MS);
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.translate(wreck.x, wreck.y);
    ctx.rotate(wreck.spin * t);
    craftPath(ctx, ENEMY_OUTLINES[wreck.tier]!, 0, 0, (wreck.radius - 0.5) * (1 - t * 0.45));
    ctx.fill();
    ctx.restore();
  }

  // The token is the player's own craft in miniature: what it does needs no
  // legend, no icon to learn and no translated string (§5).
  for (const token of state.tokens) {
    craftPath(ctx, PLAYER_OUTLINE, token.x, token.y, TOKEN_RADIUS);
    ctx.fill();
    ctx.stroke();
  }

  // Blink while the grace period runs, so a hit reads without a HUD message.
  const blinking = state.invulnerableMs > 0 && Math.floor(state.invulnerableMs / 120) % 2 === 0;
  if (!blinking) {
    ctx.fillStyle = palette.ink;
    ctx.strokeStyle = palette.ink;
    // Stroking the same path with a round join softens the points, so the
    // craft reads as a machined shape rather than as a set of coordinates.
    ctx.lineWidth = 1.25;
    craftPath(ctx, PLAYER_OUTLINE, state.shipX, SHIP_Y, SHIP_RADIUS - 0.5);
    ctx.fill();
    ctx.stroke();
  }
}

export interface BoardHud {
  score: number;
  wave: number;
  waves: number;
  lives: number;
  power: number;
}

export interface SkyBoardProps {
  level: number;
  /** Fired exactly once, when the run settles (§2). */
  onRunEnd: (outcome: RunOutcome, score: number) => void;
  /** Books play seconds that just became final (§9). */
  onBookSeconds: (seconds: number) => void;
  /** Fired when the glanceable counts change. */
  onHudChange: (hud: BoardHud) => void;
  ariaLabel: string;
}

export function SkyBoard({
  level,
  onRunEnd,
  onBookSeconds,
  onHudChange,
  ariaLabel,
}: SkyBoardProps) {
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

  const toLogicalX = useCallback((clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return BOARD_WIDTH / 2;
    const rect = canvas.getBoundingClientRect();
    const ratio = rect.width === 0 ? 0.5 : (clientX - rect.left) / rect.width;
    return Math.min(1, Math.max(0, ratio)) * BOARD_WIDTH;
  }, []);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      draggingRef.current = true;
      stateRef.current = setShipX(stateRef.current, toLogicalX(event.clientX));
      // Capture is an improvement (a finger sliding off the canvas keeps
      // steering), never a precondition — it throws if the pointer is already
      // gone, and losing the ship to that would be absurd.
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Steering still works from the events we do get.
      }
    },
    [toLogicalX],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (!draggingRef.current) return;
      stateRef.current = setShipX(stateRef.current, toLogicalX(event.clientX));
    },
    [toLogicalX],
  );

  const onPointerUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  // Keyboard play for the web build: arrows steer; firing is automatic (§3).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') keysRef.current.left = true;
      if (event.key === 'ArrowRight') keysRef.current.right = true;
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
  }, []);

  useEffect(() => {
    // The status row is real even where canvas is not (jsdom): publish the
    // opening counts before the rendering guard.
    const opening = stateRef.current;
    onHudChangeRef.current({
      score: opening.score,
      wave: Math.max(1, opening.waveInLevel + 1),
      waves: wavesInLevel(opening.level),
      lives: opening.lives,
      power: opening.power,
    });

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = BOARD_WIDTH * dpr;
    canvas.height = BOARD_HEIGHT * dpr;
    ctx.scale(dpr, dpr);

    let falling: Falling[] = [];
    let palette = readPalette();
    const repaint = () => {
      palette = readPalette();
      render(ctx, stateRef.current, palette, falling);
    };
    // The shell swaps accent tokens by attribute; the OS may flip dark mode.
    const observer = new MutationObserver(repaint);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-game'],
    });
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', repaint);

    let prevEnemies = new Map(stateRef.current.enemies.map((enemy) => [enemy.id, enemy]));
    let prevScore = stateRef.current.score;
    let prevLives = stateRef.current.lives;
    let prevPower = stateRef.current.power;
    let prevHud: BoardHud | null = null;

    const publishHud = (state: GameState) => {
      const hud: BoardHud = {
        score: state.score,
        wave: Math.max(1, state.waveInLevel + 1),
        waves: wavesInLevel(state.level),
        lives: state.lives,
        power: state.power,
      };
      if (
        prevHud &&
        prevHud.score === hud.score &&
        prevHud.wave === hud.wave &&
        prevHud.lives === hud.lives &&
        prevHud.power === hud.power
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
      if (state.status === 'cleared') {
        sounds.clear();
        void haptics.clear();
        onRunEndRef.current('cleared', state.score);
      } else {
        sounds.gameOver();
        void haptics.invalid();
        onRunEndRef.current('failed', state.score);
      }
    };

    const frame = (now: number) => {
      rafId = requestAnimationFrame(frame);
      if (lastTime === null) lastTime = now;
      const dt = Math.min(now - lastTime, MAX_FRAME_DT_MS);
      lastTime = now;

      const dir = (keysRef.current.left ? -1 : 0) + (keysRef.current.right ? 1 : 0);
      if (dir !== 0 && !draggingRef.current) {
        stateRef.current = moveShipBy(stateRef.current, dir * SHIP_SPEED * (dt / 1000));
      }

      if (stateRef.current.status === 'playing') {
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
        }
      }

      const current = stateRef.current;

      // Sound belongs to events, so find them by diffing frames.
      if (current.score > prevScore) sounds.select();
      if (current.power > prevPower) sounds.match();
      if (current.lives < prevLives) {
        sounds.invalid();
        void haptics.invalid();
      }
      prevScore = current.score;
      prevPower = current.power;

      if (!reducedRef.current) {
        const live = new Set(current.enemies.map((enemy) => enemy.id));
        for (const [id, enemy] of prevEnemies) {
          if (live.has(id)) continue;
          const radius = ENEMY_RADII[enemy.tier]!;
          // A craft that drifted off the bottom was never shot down, and must
          // not leave a wreck behind at the edge of the board.
          if (enemy.y - radius > BOARD_HEIGHT - 4) continue;
          falling.push({
            x: enemy.x,
            y: enemy.y,
            radius,
            tier: enemy.tier,
            spin: (id % 2 === 0 ? 1 : -1) * 0.9,
            age: 0,
          });
        }
        for (const wreck of falling) wreck.age += dt;
        if (falling.some((wreck) => wreck.age >= DOWN_MS)) {
          falling = falling.filter((wreck) => wreck.age < DOWN_MS);
        }
      }
      prevEnemies = new Map(current.enemies.map((enemy) => [enemy.id, enemy]));

      publishHud(current);
      prevLives = current.lives;

      render(ctx, current, palette, falling);

      // A settled run stops the loop after its final frame (battery, §12).
      if (current.status !== 'playing' && falling.length === 0) {
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
      (window as unknown as Record<string, unknown>).__sfFrame = frame;
      (window as unknown as Record<string, unknown>).__sfState = () => stateRef.current;
    }

    return () => {
      stop();
      flushSeconds();
      document.removeEventListener('visibilitychange', onVisibility);
      media.removeEventListener('change', repaint);
      observer.disconnect();
      if (import.meta.env.DEV) {
        // The seam retains the whole loop closure — drop it with the board.
        delete (window as unknown as Record<string, unknown>).__sfFrame;
        delete (window as unknown as Record<string, unknown>).__sfState;
      }
    };
    // A new level or retry remounts this component (key includes the nonce),
    // so the loop's lifetime is exactly one attempt.
  }, [flushSeconds]);

  return (
    <canvas
      ref={canvasRef}
      className="sf-canvas"
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
