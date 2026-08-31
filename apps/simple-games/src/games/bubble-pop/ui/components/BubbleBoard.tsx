/**
 * The Bubble Pop board: a Canvas 2D view over the pure simulation in
 * game/session.ts and game/engine.ts (Brick Breaker's board is this game's
 * stated pattern — docs/plans/2026-08-08-mahjong-bubble-ludo.md §Bubble Pop).
 *
 * Unlike Brick Breaker, resolution is not stepped frame by frame: `fireShot`
 * decides the whole outcome (flight, pop, drop, descent, win/loss) in one
 * call the instant a shot is released. What this component animates is a
 * *replay* of that already-decided outcome — the flight along
 * `ShotResult.path`, then a short pop/fall settle — never a second source of
 * truth. The trajectory guide shown while dragging calls the exact same
 * `aimGuide` on the exact same session the real shot fires from (§8): there
 * is no cached or stale board here, only the one session ref.
 *
 * Battery and theme discipline mirrors Brick Breaker's BrickBoard.tsx
 * exactly: the rAF loop runs only while mounted and the page visible, DPR is
 * capped at 2, nothing here uses shadowBlur or ctx.filter, colors come from
 * the accent/series tokens read via computed style and re-read on theme
 * change (MutationObserver + matchMedia), and setPointerCapture is
 * best-effort.
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useReducedMotion } from '@/ui/useReducedMotion';
import {
  BOARD_HEIGHT,
  BOARD_SEED,
  BOARD_WIDTH,
  CELL_RADIUS,
  LAUNCHER_X,
  LAUNCHER_Y,
  LOSS_LINE_Y,
  SHOT_SPEED,
} from '../../game/constants';
import { clampAimAngle, placeAndResolve } from '../../game/engine';
import { cellFromKey, cellKey, effectiveCenter } from '../../game/grid';
import { levelSpec } from '../../game/levels';
import {
  aimGuide,
  createSession,
  fireShot,
  swapNext,
  type BubblePopSession,
} from '../../game/session';
import type { Board, BubbleColor, Cell, Point as GamePoint, ShotResult } from '../../game/types';
import type { RunOutcome } from '../../state/GameContext';
import { drawBubble, easeOut, pathLength, pointAtDistance, type BubbleMark } from '../canvas';

/** Same-shape choice for every color, so colorblind play never depends on hue alone (§12). */
const BUBBLE_MARKS: Record<BubbleColor, BubbleMark> = {
  blue: 'circle',
  green: 'triangle',
  yellow: 'square',
  purple: 'diamond',
  orange: 'star',
  cyan: 'crescent',
};

/** How long the pop-shrink / fall-fade settle animation runs (Reduced Motion: instant). */
const RESOLVE_MS = 220;
/** How far a disconnected bubble drops off-screen while fading. */
const FALL_DISTANCE = 90;

interface Palette {
  surface: string;
  accent: string;
  inkSoft: string;
  markFill: string;
  markStroke: string;
  colors: Record<BubbleColor, string>;
}

/** Fallbacks are the light-theme series tokens; only jsdom ever needs them. */
function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const pick = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    surface: pick('--surface', '#fffdf8'),
    accent: pick('--accent', '#712d2f'),
    inkSoft: pick('--ink-soft', '#5c6772'),
    markFill: pick('--bu-mark', 'rgba(255,255,255,0.94)'),
    markStroke: pick('--bu-mark-stroke', 'rgba(0,0,0,0.3)'),
    colors: {
      blue: pick('--bu-c-blue', '#3b6fc4'),
      green: pick('--bu-c-green', '#4b8f57'),
      yellow: pick('--bu-c-yellow', '#c99a2e'),
      purple: pick('--bu-c-purple', '#8452b0'),
      orange: pick('--bu-c-orange', '#c9782f'),
      cyan: pick('--bu-c-cyan', '#2f9e9e'),
    },
  };
}

type Phase = 'idle' | 'flying' | 'resolving';

interface FlightAnim {
  path: readonly GamePoint[];
  totalLength: number;
  traveled: number;
  color: BubbleColor;
}

interface SettledCell {
  cell: Cell;
  color: BubbleColor;
}

interface ResolveAnim {
  ceilingOffset: number;
  landing: SettledCell;
  popped: SettledCell[];
  fell: SettledCell[];
  age: number;
  nextSession: BubblePopSession;
}

export interface BubbleHud {
  shotsUntilDescent: number;
  descentEvery: number;
  current: BubbleColor;
  next: BubbleColor;
}

export interface BubbleBoardLabels {
  board: string;
  swap: string;
  current: (color: BubbleColor) => string;
  next: (color: BubbleColor) => string;
  aiming: (row: number, col: number) => string;
}

export interface BubbleBoardProps {
  level: number;
  /** Fired exactly once, when the run settles. */
  onRunEnd: (outcome: RunOutcome, seconds: number) => void;
  /** Books play seconds that just became final. */
  onBookSeconds: (seconds: number) => void;
  /** Fired whenever the glanceable HUD changes — shots left, current/next. */
  onHudChange: (hud: BubbleHud) => void;
  labels: BubbleBoardLabels;
}

function colorOf(board: Board, cell: Cell): BubbleColor {
  const color = board.get(cellKey(cell));
  if (color === undefined) throw new Error('bubble-pop: colorOf on an empty cell');
  return color;
}

export function BubbleBoard({
  level,
  onRunEnd,
  onBookSeconds,
  onHudChange,
  labels,
}: BubbleBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sessionRef = useRef<BubblePopSession>(createSession(BOARD_SEED, level));
  const phaseRef = useRef<Phase>('idle');
  const draggingRef = useRef(false);
  const angleRef = useRef(0);
  const flightRef = useRef<FlightAnim | null>(null);
  const resolveRef = useRef<ResolveAnim | null>(null);
  const lastAnnouncedCellRef = useRef<string | null>(null);
  /** Set by the rAF-loop effect below; lets a settled run outside the loop
   * (the Reduced Motion instant-commit path in `fire`) stop it the same way
   * the loop stops itself (battery — a settled board has nothing left to draw). */
  const stopLoopRef = useRef<() => void>(() => undefined);

  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  const onRunEndRef = useRef(onRunEnd);
  onRunEndRef.current = onRunEnd;
  const onBookSecondsRef = useRef(onBookSeconds);
  onBookSecondsRef.current = onBookSeconds;
  const onHudChangeRef = useRef(onHudChange);
  onHudChangeRef.current = onHudChange;
  const labelsRef = useRef(labels);
  labelsRef.current = labels;

  // A visually-hidden live region: "狙い・着弾セルの読み上げ" (the plan's
  // Bubble Pop i18n note) — updated only when the landing cell changes, not
  // on every pointer-move, so a screen reader is not spammed mid-drag.
  const liveRef = useRef<HTMLDivElement | null>(null);
  const announce = useCallback((text: string) => {
    if (liveRef.current) liveRef.current.textContent = text;
  }, []);
  const announceRef = useRef(announce);
  announceRef.current = announce;

  /** Milliseconds visible (bookedRef pattern, docs/GAME_LIFECYCLE.md). */
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

  /** Reports a settled run exactly once — shared by the reduced-motion instant
   * commit in `fire` and the animated commit in the rAF loop below. */
  const settle = useCallback(
    (session: BubblePopSession) => {
      if (endedRef.current) return;
      endedRef.current = true;
      flushSeconds();
      const seconds = Math.floor(runMsRef.current / 1000);
      if (session.status === 'cleared') {
        sounds.clear();
        void haptics.clear();
        onRunEndRef.current('cleared', seconds);
      } else {
        sounds.gameOver();
        void haptics.invalid();
        onRunEndRef.current('failed', seconds);
      }
    },
    [flushSeconds],
  );

  const descentEvery = levelSpec(level).descentEvery;
  // Mirrors the ref for the tray's React-rendered DOM (current/next swatches,
  // the swap button's labels): the canvas itself is drawn imperatively from
  // `sessionRef` every frame and needs no state, but the tray is ordinary
  // JSX and only re-renders when told to.
  const [hud, setHud] = useState<BubbleHud>(() => ({
    shotsUntilDescent: sessionRef.current.shotsUntilDescent,
    descentEvery,
    current: sessionRef.current.current,
    next: sessionRef.current.next,
  }));
  const publishHud = useCallback(() => {
    const session = sessionRef.current;
    const next: BubbleHud = {
      shotsUntilDescent: session.shotsUntilDescent,
      descentEvery,
      current: session.current,
      next: session.next,
    };
    onHudChangeRef.current(next);
    setHud(next);
  }, [descentEvery]);

  const toBoardPoint = useCallback((clientX: number, clientY: number): GamePoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: LAUNCHER_X, y: LAUNCHER_Y };
    const rect = canvas.getBoundingClientRect();
    const rx = rect.width === 0 ? 0.5 : (clientX - rect.left) / rect.width;
    const ry = rect.height === 0 ? 0.5 : (clientY - rect.top) / rect.height;
    return { x: rx * BOARD_WIDTH, y: ry * BOARD_HEIGHT };
  }, []);

  const angleFromPoint = useCallback((p: GamePoint): number => {
    const dx = p.x - LAUNCHER_X;
    const dy = Math.max(1, LAUNCHER_Y - p.y);
    return clampAimAngle(Math.atan2(dx, dy));
  }, []);

  /** Fires the currently aimed shot: computes the replay, then the authoritative next session. */
  const fire = useCallback(
    (angle: number) => {
      const session = sessionRef.current;
      if (phaseRef.current !== 'idle' || session.status !== 'playing') return;

      const shot: ShotResult = aimGuide(session, angle);
      const outcome = placeAndResolve(session.board, shot.landingCell, session.current);
      const nextSession = fireShot(session, angle);

      sounds.select();
      lastAnnouncedCellRef.current = null;

      if (reducedRef.current) {
        // Reduced Motion: land instantly, no shrink/fall/flight to skip.
        if (outcome.popped.length > 0) sounds.match();
        sessionRef.current = nextSession;
        phaseRef.current = 'idle';
        publishHud();
        if (nextSession.status !== 'playing') {
          settle(nextSession);
          stopLoopRef.current();
        }
        return;
      }

      flightRef.current = {
        path: shot.path,
        totalLength: pathLength(shot.path),
        traveled: 0,
        color: session.current,
      };
      const landingKey = cellKey(shot.landingCell);
      resolveRef.current = {
        ceilingOffset: session.ceilingOffset,
        landing: { cell: shot.landingCell, color: session.current },
        // outcome.popped is computed on the post-placement board, so it can
        // include the landing cell itself, which colorOf(session.board, _)
        // (the pre-placement board) has not seen yet and would throw on;
        // every other popped cell was already sitting on session.board.
        popped: outcome.popped.map((cell) => ({
          cell,
          color: cellKey(cell) === landingKey ? session.current : colorOf(session.board, cell),
        })),
        // fell is derived from the post-pop board with the popped group
        // (including any landing cell) already removed, so every fallen cell
        // was necessarily present on session.board before this shot.
        fell: outcome.fell.map((cell) => ({ cell, color: colorOf(session.board, cell) })),
        age: -1, // -1 marks "still flying"; set to 0 once the flight lands
        nextSession,
      };
      phaseRef.current = 'flying';
    },
    [publishHud, settle],
  );

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (phaseRef.current !== 'idle' || sessionRef.current.status !== 'playing') return;
      draggingRef.current = true;
      angleRef.current = angleFromPoint(toBoardPoint(event.clientX, event.clientY));
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Aiming still works from the events we do get.
      }
    },
    [toBoardPoint, angleFromPoint],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (!draggingRef.current) return;
      angleRef.current = angleFromPoint(toBoardPoint(event.clientX, event.clientY));
    },
    [toBoardPoint, angleFromPoint],
  );

  const endDrag = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    fire(angleRef.current);
  }, [fire]);

  const onSwap = useCallback(() => {
    if (phaseRef.current !== 'idle' || sessionRef.current.status !== 'playing') return;
    sessionRef.current = swapNext(sessionRef.current);
    sounds.select();
    publishHud();
  }, [publishHud]);

  // Small keyboard alternative to the drag gesture (web build): arrows steer
  // the aim, space releases it — the same pair Brick Breaker offers for its
  // paddle, adapted to a continuous-angle aim instead of lateral motion.
  useEffect(() => {
    const STEP = (2 * Math.PI) / 180;
    const onKeyDown = (event: KeyboardEvent) => {
      if (phaseRef.current !== 'idle' || sessionRef.current.status !== 'playing') return;
      if (event.key === 'ArrowLeft') {
        draggingRef.current = true;
        angleRef.current = clampAimAngle(angleRef.current - STEP);
      } else if (event.key === 'ArrowRight') {
        draggingRef.current = true;
        angleRef.current = clampAimAngle(angleRef.current + STEP);
      } else if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault();
        // Space always fires at the current aim, whether or not an arrow
        // key (or a pointer drag) has run first — it does not require
        // draggingRef to be set the way endDrag's callers do.
        draggingRef.current = false;
        fire(angleRef.current);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fire]);

  useEffect(() => {
    // Publish the opening HUD before the rendering guard — the status row is
    // real even where canvas is not (jsdom).
    publishHud();

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // The backing store follows the DISPLAYED size (#93): a wide viewport
    // shows a larger board, and stretching a phone-sized bitmap there would
    // blur it. Game logic never sees this — the transform maps the logical
    // 320x672 space onto whatever the CSS layout granted, and inputs already
    // convert through getBoundingClientRect. clientWidth can be 0 (jsdom, a
    // not-yet-laid-out webview): fall back to the logical size and let the
    // resize observer correct it once the canvas is measurable.
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

    let palette = readPalette();
    const repaint = () => {
      palette = readPalette();
      draw();
    };
    // The shell swaps accent tokens by attribute; the OS may flip dark mode.
    const observer = new MutationObserver(repaint);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-game'],
    });
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', repaint);

    // Rotation, Split View, a resized window: re-derive the backing store
    // and repaint in place. Never the session — a run survives a resize
    // untouched. The window listener also catches a devicePixelRatio change
    // (moving the window to another monitor) that leaves the CSS size alone.
    const onViewportChange = () => {
      sizeCanvas();
      repaint();
    };
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onViewportChange);
    resizeObserver?.observe(canvas);
    window.addEventListener('resize', onViewportChange);

    const draw = () => {
      const session = sessionRef.current;
      const flight = flightRef.current;
      const resolving =
        resolveRef.current && resolveRef.current.age >= 0 ? resolveRef.current : null;
      const ceilingOffset = resolving ? resolving.ceilingOffset : session.ceilingOffset;

      ctx.fillStyle = palette.surface;
      ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

      // The loss line: dotted, always shown, never a countdown (§3).
      ctx.save();
      ctx.setLineDash([4, 5]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = palette.inkSoft;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(0, LOSS_LINE_Y);
      ctx.lineTo(BOARD_WIDTH, LOSS_LINE_Y);
      ctx.stroke();
      ctx.restore();

      // Resting bubbles. `session.board` is the board this frame's shot came
      // from — while a resolve animation is live it still holds the
      // popped/fallen cells, which are skipped here and drawn separately
      // below (fading out); once the animation commits, `session` itself
      // becomes `nextSession` and this loop alone is the whole board again.
      const board = session.board;
      for (const key of board.keys()) {
        const cell = cellFromKey(key);
        if (resolving && (isSettled(resolving.popped, cell) || isSettled(resolving.fell, cell)))
          continue;
        const { x, y } = effectiveCenter(cell, ceilingOffset);
        drawBubble(
          ctx,
          x,
          y,
          CELL_RADIUS - 1,
          palette.colors[board.get(key)!],
          BUBBLE_MARKS[board.get(key)!],
          palette.markFill,
          palette.markStroke,
        );
      }

      if (resolving) {
        const t = reducedRef.current ? 1 : Math.min(1, resolving.age / RESOLVE_MS);
        const eased = easeOut(t);
        const landingScale = Math.min(1, t * 2.4); // a quick pop-in, not a slow grow
        const { x: lx, y: ly } = effectiveCenter(resolving.landing.cell, ceilingOffset);
        const stillLanding = !isSettled(resolving.popped, resolving.landing.cell);
        if (stillLanding) {
          drawBubble(
            ctx,
            lx,
            ly,
            (CELL_RADIUS - 1) * landingScale,
            palette.colors[resolving.landing.color],
            BUBBLE_MARKS[resolving.landing.color],
            palette.markFill,
            palette.markStroke,
          );
        }
        for (const { cell, color } of resolving.popped) {
          const { x, y } = effectiveCenter(cell, ceilingOffset);
          const scale = sameCell(cell, resolving.landing.cell) ? Math.max(0, 1 - t) : 1 - eased;
          drawBubble(
            ctx,
            x,
            y,
            (CELL_RADIUS - 1) * Math.max(0, scale),
            palette.colors[color],
            BUBBLE_MARKS[color],
            palette.markFill,
            palette.markStroke,
            1 - eased,
          );
        }
        for (const { cell, color } of resolving.fell) {
          const { x, y } = effectiveCenter(cell, ceilingOffset);
          drawBubble(
            ctx,
            x,
            y + eased * FALL_DISTANCE,
            CELL_RADIUS - 1,
            palette.colors[color],
            BUBBLE_MARKS[color],
            palette.markFill,
            palette.markStroke,
            1 - eased,
          );
        }
      }

      if (flight) {
        const pos = pointAtDistance(flight.path, flight.traveled);
        drawBubble(
          ctx,
          pos.x,
          pos.y,
          CELL_RADIUS - 1,
          palette.colors[flight.color],
          BUBBLE_MARKS[flight.color],
          palette.markFill,
          palette.markStroke,
        );
      }

      // Trajectory guide (§8): the exact same simulation the shot uses, drawn
      // only while aiming, never previewing what a landing pops or drops.
      if (draggingRef.current && phaseRef.current === 'idle') {
        const guide = aimGuide(session, angleRef.current);
        const key = cellKey(guide.landingCell);
        if (lastAnnouncedCellRef.current !== key) {
          lastAnnouncedCellRef.current = key;
          announceRef.current(
            labelsRef.current.aiming(guide.landingCell.row + 1, guide.landingCell.col + 1),
          );
        }
        ctx.save();
        ctx.setLineDash([3, 5]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = palette.accent;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(guide.path[0]!.x, guide.path[0]!.y);
        for (let i = 1; i < guide.path.length; i++) ctx.lineTo(guide.path[i]!.x, guide.path[i]!.y);
        ctx.stroke();
        ctx.restore();

        const { x: gx, y: gy } = effectiveCenter(guide.landingCell, session.ceilingOffset);
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = palette.accent;
        ctx.beginPath();
        ctx.arc(gx, gy, CELL_RADIUS - 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // The loaded bubble waits at the launcher between shots.
      if (!flight && session.status === 'playing') {
        drawBubble(
          ctx,
          LAUNCHER_X,
          LAUNCHER_Y,
          CELL_RADIUS - 1,
          palette.colors[session.current],
          BUBBLE_MARKS[session.current],
          palette.markFill,
          palette.markStroke,
        );
      }
    };

    let rafId: number | null = null;
    let lastTime: number | null = null;

    const frame = (now: number) => {
      rafId = requestAnimationFrame(frame);
      if (lastTime === null) lastTime = now;
      const dt = Math.min(now - lastTime, 250);
      lastTime = now;

      runMsRef.current += dt;

      const flight = flightRef.current;
      if (flight) {
        flight.traveled += (dt / 1000) * SHOT_SPEED;
        if (flight.traveled >= flight.totalLength || reducedRef.current) {
          flightRef.current = null;
          if (resolveRef.current) resolveRef.current.age = 0;
        }
      }

      const resolving = resolveRef.current;
      if (resolving && resolving.age >= 0) {
        if (resolving.popped.length > 0 && resolving.age === 0) sounds.match();
        resolving.age += dt;
        if (reducedRef.current || resolving.age >= RESOLVE_MS) {
          sessionRef.current = resolving.nextSession;
          resolveRef.current = null;
          phaseRef.current = 'idle';
          publishHud();
          // A settled run stops the loop after its final frame (battery):
          // this same call already scheduled the next frame above, so
          // cancel that one rather than leave it to fire and do nothing.
          if (sessionRef.current.status !== 'playing') {
            settle(sessionRef.current);
            stop();
          }
        }
      }

      draw();
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
    stopLoopRef.current = stop;

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
      (window as unknown as Record<string, unknown>).__buFrame = frame;
      (window as unknown as Record<string, unknown>).__buState = () => sessionRef.current;
    }

    return () => {
      stop();
      stopLoopRef.current = () => undefined;
      flushSeconds();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onViewportChange);
      resizeObserver?.disconnect();
      media.removeEventListener('change', repaint);
      observer.disconnect();
      if (import.meta.env.DEV) {
        delete (window as unknown as Record<string, unknown>).__buFrame;
        delete (window as unknown as Record<string, unknown>).__buState;
      }
    };
    // A new level or retry remounts this component (key includes the nonce),
    // so the loop's lifetime is exactly one attempt.
  }, [flushSeconds, publishHud, settle]);

  return (
    <div className="bu-board-wrap">
      <canvas
        ref={canvasRef}
        className="bu-canvas"
        style={{ aspectRatio: `${BOARD_WIDTH} / ${BOARD_HEIGHT}` }}
        role="img"
        aria-label={labels.board}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />
      <div className="bu-sr-only" aria-live="polite" ref={liveRef} />
      <div className="bu-tray">
        <span
          className="bu-swatch bu-swatch-current"
          role="img"
          aria-label={labels.current(hud.current)}
        >
          <BubbleSwatchGlyph color={hud.current} />
        </span>
        <button
          type="button"
          className="icon-btn bu-swap-btn"
          aria-label={labels.swap}
          onClick={onSwap}
        >
          ⇄
        </button>
        <span className="bu-swatch bu-swatch-next" role="img" aria-label={labels.next(hud.next)}>
          <BubbleSwatchGlyph color={hud.next} />
        </span>
      </div>
    </div>
  );
}

function sameCell(a: Cell, b: Cell): boolean {
  return a.row === b.row && a.col === b.col;
}

function isSettled(list: readonly SettledCell[], cell: Cell): boolean {
  return list.some((entry) => sameCell(entry.cell, cell));
}

/** A tiny static swatch for the tray — same color+mark idiom as the board, in DOM/SVG. */
function BubbleSwatchGlyph({ color }: { color: BubbleColor }) {
  return (
    <svg viewBox="0 0 32 32" width="100%" height="100%" aria-hidden="true">
      <circle cx="16" cy="16" r="15" className={`bu-swatch-fill bu-swatch-${color}`} />
      <MarkPath mark={BUBBLE_MARKS[color]} />
    </svg>
  );
}

function MarkPath({ mark }: { mark: BubbleMark }) {
  const props = { className: 'bu-swatch-mark' } as const;
  switch (mark) {
    case 'circle':
      return <circle cx="16" cy="16" r="6" {...props} />;
    case 'triangle':
      return <polygon points="16,7 25,23 7,23" {...props} />;
    case 'square':
      return <rect x="8" y="8" width="16" height="16" {...props} />;
    case 'diamond':
      return <polygon points="16,6 26,16 16,26 6,16" {...props} />;
    case 'star':
      return (
        <polygon points="16,5 19,13 27,13 20.5,18 23,26 16,21 9,26 11.5,18 5,13 13,13" {...props} />
      );
    case 'crescent':
      return <path d="M20,7 A11,11 0 1 0 20,25 A8,8 0 1 1 20,7 Z" {...props} />;
  }
}
