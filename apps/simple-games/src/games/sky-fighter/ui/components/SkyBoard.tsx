/**
 * The Sky Fighter board: a Canvas 2D view over the pure simulation in
 * game/engine.ts.
 *
 * Battery discipline (docs/SKY_FIGHTER_RULES.md §9, §12): the loop runs only
 * while this component is mounted and the page visible; backgrounding stops
 * it outright, a pending boss reward pauses it, and a settled run
 * (cleared/failed) cancels it after the final frame. Play time counts while
 * the sky is live.
 *
 * Colors come from the accent tokens the shell stamps per game
 * (ui/styles.css), read from computed style and re-read when the theme
 * changes — the canvas follows dark mode exactly like the DOM around it.
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useReducedMotion } from '@/ui/useReducedMotion';
import {
  BOARD_HEIGHT,
  BOARD_SEED,
  BOARD_WIDTH,
  BULLET_RADIUS,
  ENEMY_BULLET_RADIUS,
  ENEMY_KIND_RADIUS,
  ITEM_RADIUS,
  MISSILE_RADIUS,
  SHIP_RADIUS,
  SHIP_SPEED,
} from '../../game/constants';
import { chooseReward, createInitialState, moveShipBy, step } from '../../game/engine';
import { wavesInLevel } from '../../game/levels';
import type {
  Boss,
  BossKind,
  EnemyKind,
  GameState,
  Pickup,
  RewardKind,
  WeaponUpgrades,
} from '../../game/types';
import type { RunOutcome } from '../../state/GameContext';
import { easeOut } from '../canvas';
import { SkyRewardOverlay } from './SkyRewardOverlay';

const STEP_MS = 1000 / 120;
const MAX_STEPS_PER_FRAME = 6;
const MAX_FRAME_DT_MS = 250;

/** How long a downed craft keeps falling as it fades (§12). */
const DOWN_MS = 220;
/** A boss takes longer to go down — the fall has to read as an event (§7). */
const BOSS_DOWN_MS = 520;

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

type Outline = readonly (readonly [number, number])[];

/**
 * Every craft is a half-outline mirrored around its own centre line, built
 * from a handful of points — enough for a swept wing to read at 20px, cheap
 * enough to draw a dozen of per frame on a weak WebView.
 *
 * The player points up and every enemy points down. That single opposition is
 * what says "these are two sides"; nothing else on screen has to explain it.
 */
const PLAYER_OUTLINE: Outline = [
  [0, -1], // nose
  [0.14, -0.35], // fuselage
  [0.88, 0.2], // wing leading edge
  [0.8, 0.46], // wing trailing edge — the gap between these two is the wing
  [0.2, 0.3], // wing root
  [0.38, 0.88], // tailplane
  [0, 0.7], // tail root
];

/**
 * One silhouette per enemy kind, all of them nose-down. Size tells the three
 * classes apart; the shapes tell the six *craft* apart, so a wave reads as a
 * formation of things that behave differently rather than as copies of one
 * circle at three scales (§4, §12).
 *
 * The armed kinds are the ones with something under the wing: the bomber's
 * wide slab, the heavy's stepped double wing, the gunship's chin. The two
 * unarmed small craft are the clean ones.
 */
const ENEMY_OUTLINES: Readonly<Record<EnemyKind, Outline>> = {
  // Bomber — long straight wings and a wide tailplane: heavy, the one that
  // breaks into the most pieces, and the plainest gun in the sky (§4).
  bomber: [
    [0, 1],
    [0.24, 0.52],
    [1, 0.16],
    [1, -0.1],
    [0.28, -0.28],
    [0.74, -0.9],
    [0, -0.72],
  ],
  // Heavy — a blunt-nosed slab, wider than anything else in a wave, with a
  // second wing stepped in behind the first. Two wings, two gunships (§4).
  heavy: [
    [0.26, 0.95],
    [0.3, 0.5],
    [1.18, 0.26],
    [1.18, 0.0],
    [0.36, -0.14],
    [0.86, -0.44],
    [0.86, -0.7],
    [0.3, -0.6],
    [0, -0.92],
  ],
  // Fighter — the player's own planform, flown the other way.
  fighter: [
    [0, 1],
    [0.14, 0.35],
    [0.88, -0.2],
    [0.8, -0.46],
    [0.2, -0.3],
    [0.38, -0.88],
    [0, -0.7],
  ],
  // Gunship — the fighter's opposite at the same size: a flat nose and
  // straight, square-tipped wings where the fighter is pointed and swept. The
  // craft that shoots at *you*, and the shape says so before the shot does.
  gunship: [
    [0.3, 0.95],
    [0.26, 0.44],
    [1.0, 0.18],
    [1.0, -0.1],
    [0.26, -0.24],
    [0.52, -0.88],
    [0, -0.72],
  ],
  // Scout — sharply swept and narrow, so the smallest still reads as fast
  // rather than as a speck. What a cascade ends in.
  scout: [
    [0, 1],
    [0.12, 0.24],
    [0.66, -0.56],
    [0.18, -0.5],
    [0.3, -0.96],
    [0, -0.8],
  ],
  // Darter — a needle: almost no wing, all length. The one shape in the sky
  // that is pointing somewhere rather than falling.
  darter: [
    [0, 1.15],
    [0.09, 0.2],
    [0.44, -0.34],
    [0.13, -0.42],
    [0.26, -1.0],
    [0, -0.88],
  ],
};

/**
 * One hull per boss archetype (§7), nose-down like every enemy but drawn far
 * larger — the size difference alone must end any doubt about what entered.
 */
const BOSS_OUTLINES: Readonly<Record<BossKind, Outline>> = {
  // Fighter — the player's planform again, but a heavyweight of it.
  fighter: [
    [0, 1],
    [0.14, 0.35],
    [0.92, -0.18],
    [0.84, -0.48],
    [0.22, -0.32],
    [0.42, -0.9],
    [0, -0.72],
  ],
  // Bomber — long straight wings, deep fuselage, a flying slab.
  bomber: [
    [0, 1],
    [0.2, 0.6],
    [1, 0.2],
    [1, -0.14],
    [0.3, -0.3],
    [0.8, -0.86],
    [0, -0.66],
  ],
  // Carrier — a wide deck with a notch: the thing its darts launch from.
  carrier: [
    [0.12, 1],
    [0.5, 0.92],
    [0.62, 0.5],
    [0.95, 0.3],
    [0.95, -0.4],
    [0.6, -0.55],
    [0.5, -0.95],
    [0.12, -0.88],
  ],
};

/** Traces a half-outline and its mirror as one closed path. */
function craftPath(
  ctx: CanvasRenderingContext2D,
  outline: Outline,
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

/** A heart, the shape of a life — no legend needed (§6). */
function heartPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.85);
  ctx.bezierCurveTo(x - r * 1.35, y - r * 0.05, x - r * 0.75, y - r, x, y - r * 0.35);
  ctx.bezierCurveTo(x + r * 0.75, y - r, x + r * 1.35, y - r * 0.05, x, y + r * 0.85);
  ctx.closePath();
}

/** A craft caught mid-fall. Lives in the view, never in the simulation. */
interface Falling {
  x: number;
  y: number;
  radius: number;
  outline: Outline;
  /** Radians it keels through as it goes; sign alternates so a split pair
      does not fall as a mirrored cliche. */
  spin: number;
  age: number;
  /** Milliseconds the fall lasts — longer for a boss than for a dart. */
  life: number;
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

  // Missiles are the player's, so they wear the player's ink — a short dart
  // whose lean shows its heading (§5).
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = MISSILE_RADIUS * 1.5;
  ctx.lineCap = 'round';
  for (const missile of state.missiles) {
    const len = 6 / Math.hypot(missile.dx, missile.dy);
    ctx.beginPath();
    ctx.moveTo(missile.x - missile.dx * len, missile.y - missile.dy * len);
    ctx.lineTo(missile.x, missile.y);
    ctx.stroke();
  }

  // Enemy fire is a tracer along its own heading: at a glance the shape alone
  // says which way a shot is going, without a second colour to decode (§4).
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = ENEMY_BULLET_RADIUS * 1.6;
  for (const shot of state.enemyBullets) {
    const len = 5 / Math.hypot(shot.dx, shot.dy);
    ctx.beginPath();
    ctx.moveTo(shot.x - shot.dx * len, shot.y - shot.dy * len);
    ctx.lineTo(shot.x + shot.dx * len, shot.y + shot.dy * len);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';

  // Enemies are solid in the accent while the player is drawn in ink: colour
  // says which side a thing is on before its shape does (§12). A surviving
  // hit lifts the fill briefly — damage reads without a health bar.
  ctx.lineJoin = 'round';
  ctx.fillStyle = palette.accent;
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 1;
  for (const enemy of state.enemies) {
    const radius = ENEMY_KIND_RADIUS[enemy.kind];
    const flashing = enemy.hitMs !== undefined;
    if (flashing) ctx.globalAlpha = 0.45;
    craftPath(ctx, ENEMY_OUTLINES[enemy.kind], enemy.x, enemy.y, radius - 0.5);
    ctx.fill();
    ctx.stroke();
    if (flashing) ctx.globalAlpha = 1;
  }

  if (state.boss !== null) {
    const boss = state.boss;
    if (boss.hitMs !== undefined) ctx.globalAlpha = 0.55;
    craftPath(ctx, BOSS_OUTLINES[boss.kind], boss.x, boss.y, boss.radius - 0.5);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;

    // The boss bar (§7): the only gauge on the board, up in the entry strip
    // where the ship cannot fly.
    const barX = 24;
    const barW = BOARD_WIDTH - 48;
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = palette.ink;
    ctx.fillRect(barX, 14, barW, 5);
    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.accent;
    ctx.fillRect(barX, 14, barW * Math.max(0, boss.hp / boss.maxHp), 5);
  }

  // A downed craft keels over: it shrinks, turns a little, and fades out.
  // No burst, no debris — the thing already on screen simply stops existing
  // over time instead of between two frames (§12).
  ctx.fillStyle = palette.accent;
  for (const wreck of falling) {
    const t = easeOut(wreck.age / wreck.life);
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.translate(wreck.x, wreck.y);
    ctx.rotate(wreck.spin * t);
    craftPath(ctx, wreck.outline, 0, 0, (wreck.radius - 0.5) * (1 - t * 0.45));
    ctx.fill();
    ctx.restore();
  }

  // Items tell themselves apart by shape, never by colour alone (§6): the
  // weapon crate is the player's own craft in miniature, a life is a heart,
  // and a Max Life is the bigger heart with a cut-out cross.
  for (const item of state.items) {
    if (item.kind === 'weapon') {
      craftPath(ctx, PLAYER_OUTLINE, item.x, item.y, ITEM_RADIUS);
      ctx.fill();
      ctx.stroke();
    } else {
      const r = item.kind === 'maxlife' ? ITEM_RADIUS + 2 : ITEM_RADIUS;
      heartPath(ctx, item.x, item.y, r);
      ctx.fill();
      if (item.kind === 'maxlife') {
        ctx.strokeStyle = palette.surface;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(item.x - 3, item.y);
        ctx.lineTo(item.x + 3, item.y);
        ctx.moveTo(item.x, item.y - 3);
        ctx.lineTo(item.x, item.y + 3);
        ctx.stroke();
        ctx.strokeStyle = palette.accent;
        ctx.lineWidth = 1;
      }
    }
  }

  // Blink while the grace period runs, so a hit reads without a HUD message.
  const blinking = state.invulnerableMs > 0 && Math.floor(state.invulnerableMs / 120) % 2 === 0;
  if (!blinking) {
    ctx.fillStyle = palette.ink;
    ctx.strokeStyle = palette.ink;
    // Stroking the same path with a round join softens the points, so the
    // craft reads as a machined shape rather than as a set of coordinates.
    ctx.lineWidth = 1.25;
    craftPath(ctx, PLAYER_OUTLINE, state.shipX, state.shipY, SHIP_RADIUS - 0.5);
    ctx.fill();
    ctx.stroke();
  }
}

export interface BoardHud {
  score: number;
  stage: number;
  wave: number;
  waves: number;
  /** True while a boss holds the stage — the HUD swaps the wave count out. */
  boss: boolean;
  lives: number;
  maxLives: number;
  upgrades: WeaponUpgrades;
  pickup: Pickup | null;
}

export function initialHud(level: number): BoardHud {
  const opening = createInitialState(BOARD_SEED, level);
  return {
    score: opening.score,
    stage: opening.level,
    wave: 1,
    waves: wavesInLevel(opening.level),
    boss: false,
    lives: opening.lives,
    maxLives: opening.maxLives,
    upgrades: opening.upgrades,
    pickup: null,
  };
}

export interface SkyBoardProps {
  level: number;
  /** Varies per attempt: what makes this run's drops its own (§5). */
  runSeed: string;
  /** Fired exactly once, when the run settles (§2). */
  onRunEnd: (outcome: RunOutcome, score: number, stage: number) => void;
  /** Fired once per stage the run finishes, as it happens (§7). */
  onStageCleared: (stage: number) => void;
  /** Books play seconds that just became final (§9). */
  onBookSeconds: (seconds: number) => void;
  /** Fired when the glanceable counts change. */
  onHudChange: (hud: BoardHud) => void;
  ariaLabel: string;
}

export function SkyBoard({
  level,
  runSeed,
  onRunEnd,
  onStageCleared,
  onBookSeconds,
  onHudChange,
  ariaLabel,
}: SkyBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState>(createInitialState(BOARD_SEED, level, runSeed));
  const draggingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const keysRef = useRef({ left: false, right: false, up: false, down: false });
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  /** The boss offer on screen, if any. Set by the loop, cleared by a choice. */
  const [rewardOptions, setRewardOptions] = useState<RewardKind[] | null>(null);
  const resumeRef = useRef<(() => void) | null>(null);

  const onRunEndRef = useRef(onRunEnd);
  onRunEndRef.current = onRunEnd;
  const onStageClearedRef = useRef(onStageCleared);
  onStageClearedRef.current = onStageCleared;
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

  const toLogical = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: BOARD_WIDTH / 2, y: BOARD_HEIGHT / 2 };
    const rect = canvas.getBoundingClientRect();
    const rx = rect.width === 0 ? 0.5 : (clientX - rect.left) / rect.width;
    const ry = rect.height === 0 ? 0.5 : (clientY - rect.top) / rect.height;
    return {
      x: Math.min(1, Math.max(0, rx)) * BOARD_WIDTH,
      y: Math.min(1, Math.max(0, ry)) * BOARD_HEIGHT,
    };
  }, []);

  // Dragging is relative (§3): the ship follows the finger's *movement*, so
  // touching the far side of the board never teleports it — and the finger
  // can rest beside the craft instead of covering it.
  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      draggingRef.current = true;
      lastPointRef.current = toLogical(event.clientX, event.clientY);
      // Capture is an improvement (a finger sliding off the canvas keeps
      // steering), never a precondition — it throws if the pointer is already
      // gone, and losing the ship to that would be absurd.
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Steering still works from the events we do get.
      }
    },
    [toLogical],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (!draggingRef.current || lastPointRef.current === null) return;
      const point = toLogical(event.clientX, event.clientY);
      const last = lastPointRef.current;
      stateRef.current = moveShipBy(stateRef.current, point.x - last.x, point.y - last.y);
      lastPointRef.current = point;
    },
    [toLogical],
  );

  const onPointerUp = useCallback(() => {
    draggingRef.current = false;
    lastPointRef.current = null;
  }, []);

  // Keyboard play for the web build: arrows or WASD steer in both axes
  // (aliased the way Brick Breaker's A/D alias its own arrows); firing is
  // automatic (§3). Left/right behave exactly as they always have.
  useEffect(() => {
    const setKey = (event: KeyboardEvent, down: boolean) => {
      if (event.key === 'ArrowLeft' || event.code === 'KeyA') keysRef.current.left = down;
      if (event.key === 'ArrowRight' || event.code === 'KeyD') keysRef.current.right = down;
      if (event.key === 'ArrowUp' || event.code === 'KeyW') keysRef.current.up = down;
      if (event.key === 'ArrowDown' || event.code === 'KeyS') keysRef.current.down = down;
    };
    const onKeyDown = (event: KeyboardEvent) => setKey(event, true);
    const onKeyUp = (event: KeyboardEvent) => setKey(event, false);
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
      stage: opening.level,
      wave: Math.max(1, opening.waveInLevel + 1),
      waves: wavesInLevel(opening.level),
      boss: opening.boss !== null,
      lives: opening.lives,
      maxLives: opening.maxLives,
      upgrades: opening.upgrades,
      pickup: opening.pickup,
    });

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // The backing store follows the DISPLAYED size (#93): a wide viewport
    // shows a larger board, and stretching a phone-sized bitmap there would
    // blur it. Game logic never sees this — the transform maps the logical
    // 360x640 space onto whatever the CSS layout granted, and inputs already
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

    // Rotation, Split View, a resized window: re-derive the backing store
    // and repaint in place. Never the game state — a run survives a resize
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

    let prevEnemies = new Map(stateRef.current.enemies.map((enemy) => [enemy.id, enemy]));
    let prevBoss: Boss | null = stateRef.current.boss;
    /** Highest stage already reported cleared; the run starts one below. */
    let clearedThrough = stateRef.current.level - 1;
    let prevScore = stateRef.current.score;
    let prevLives = stateRef.current.lives;
    let prevPickupSeq = stateRef.current.pickup?.seq ?? 0;
    let prevHud: BoardHud | null = null;
    let rewardShown = false;

    const publishHud = (state: GameState) => {
      const hud: BoardHud = {
        score: state.score,
        stage: state.level,
        wave: Math.max(1, state.waveInLevel + 1),
        waves: wavesInLevel(state.level),
        boss: state.boss !== null,
        lives: state.lives,
        maxLives: state.maxLives,
        upgrades: state.upgrades,
        pickup: state.pickup,
      };
      if (
        prevHud &&
        prevHud.score === hud.score &&
        prevHud.stage === hud.stage &&
        prevHud.wave === hud.wave &&
        prevHud.boss === hud.boss &&
        prevHud.lives === hud.lives &&
        prevHud.maxLives === hud.maxLives &&
        prevHud.upgrades === hud.upgrades &&
        (prevHud.pickup?.seq ?? 0) === (hud.pickup?.seq ?? 0)
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
        // The final stage's clear is real progress even though no next stage
        // follows it (§7).
        if (clearedThrough < state.level) {
          onStageClearedRef.current(state.level);
          clearedThrough = state.level;
        }
        sounds.clear();
        void haptics.clear();
        onRunEndRef.current('cleared', state.score, state.level);
      } else {
        sounds.gameOver();
        void haptics.invalid();
        onRunEndRef.current('failed', state.score, state.level);
      }
    };

    const frame = (now: number) => {
      rafId = requestAnimationFrame(frame);
      if (lastTime === null) lastTime = now;
      const dt = Math.min(now - lastTime, MAX_FRAME_DT_MS);
      lastTime = now;

      const keys = keysRef.current;
      const dirX = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
      const dirY = (keys.up ? -1 : 0) + (keys.down ? 1 : 0);
      if ((dirX !== 0 || dirY !== 0) && !draggingRef.current) {
        const speed = SHIP_SPEED * (dt / 1000) * (dirX !== 0 && dirY !== 0 ? Math.SQRT1_2 : 1);
        stateRef.current = moveShipBy(stateRef.current, dirX * speed, dirY * speed);
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
      const pickupSeq = current.pickup?.seq ?? 0;
      if (pickupSeq > prevPickupSeq) sounds.match();
      prevPickupSeq = pickupSeq;
      if (current.lives < prevLives) {
        sounds.invalid();
        void haptics.invalid();
      }
      prevScore = current.score;

      // A finished stage is reported the moment it settles (§7): normal
      // stages as the run flies past them, a boss stage the moment the boss
      // falls — not when the reward is chosen, so leaving from the untimed
      // reward dialog (Android Back, app death) still keeps the clear.
      for (let stage = clearedThrough + 1; stage < current.level; stage++) {
        onStageClearedRef.current(stage);
        clearedThrough = stage;
      }
      if (current.status === 'reward' && clearedThrough < current.level) {
        onStageClearedRef.current(current.level);
        clearedThrough = current.level;
      }

      if (!reducedRef.current) {
        const live = new Set(current.enemies.map((enemy) => enemy.id));
        for (const [id, enemy] of prevEnemies) {
          if (live.has(id)) continue;
          const radius = ENEMY_KIND_RADIUS[enemy.kind];
          // A craft that drifted off the bottom was never shot down, and must
          // not leave a wreck behind at the edge of the board.
          if (enemy.y - radius > BOARD_HEIGHT - 4) continue;
          falling.push({
            x: enemy.x,
            y: enemy.y,
            radius,
            outline: ENEMY_OUTLINES[enemy.kind],
            spin: (id % 2 === 0 ? 1 : -1) * 0.9,
            age: 0,
            life: DOWN_MS,
          });
        }
        // The boss goes down the same way, only slower and unmistakably (§7).
        if (prevBoss !== null && current.boss === null && current.status !== 'playing') {
          falling.push({
            x: prevBoss.x,
            y: prevBoss.y,
            radius: prevBoss.radius,
            outline: BOSS_OUTLINES[prevBoss.kind],
            spin: 0.6,
            age: 0,
            life: BOSS_DOWN_MS,
          });
        }
        for (const wreck of falling) wreck.age += dt;
        if (falling.some((wreck) => wreck.age >= wreck.life)) {
          falling = falling.filter((wreck) => wreck.age < wreck.life);
        }
      }
      prevEnemies = new Map(current.enemies.map((enemy) => [enemy.id, enemy]));
      prevBoss = current.boss;

      publishHud(current);
      prevLives = current.lives;

      render(ctx, current, palette, falling);

      // A pending boss offer pauses the loop after the fall finishes: the
      // choice takes as long as it takes, with nothing burning behind it (§8).
      if (current.status === 'reward' && falling.length === 0) {
        if (!rewardShown) {
          rewardShown = true;
          flushSeconds();
          setRewardOptions(current.rewardOptions);
        }
        stop();
        return;
      }

      // A settled run stops the loop after its final frame (battery, §12).
      if (current.status !== 'playing' && current.status !== 'reward' && falling.length === 0) {
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

    // The reward choice restarts the loop from here (the state has already
    // moved on to the next stage's quiet break by then).
    resumeRef.current = () => {
      rewardShown = false;
      start();
    };

    // Backgrounding stops the loop and books the seconds played so far — the
    // OS can kill the app without another event (§9). While a reward offer is
    // up the loop stays parked; choosing is what resumes it.
    const onVisibility = () => {
      if (document.hidden) {
        stop();
        flushSeconds();
      } else if (stateRef.current.status !== 'reward') {
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
      (window as unknown as Record<string, unknown>).__sfSetState = (next: GameState) => {
        stateRef.current = next;
      };
    }

    return () => {
      stop();
      flushSeconds();
      resumeRef.current = null;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onViewportChange);
      resizeObserver?.disconnect();
      media.removeEventListener('change', repaint);
      observer.disconnect();
      if (import.meta.env.DEV) {
        // The seam retains the whole loop closure — drop it with the board.
        delete (window as unknown as Record<string, unknown>).__sfFrame;
        delete (window as unknown as Record<string, unknown>).__sfState;
        delete (window as unknown as Record<string, unknown>).__sfSetState;
      }
    };
    // A new run or retry remounts this component (key includes the nonce),
    // so the loop's lifetime is exactly one attempt.
  }, [flushSeconds]);

  const onChooseReward = useCallback((index: number) => {
    stateRef.current = chooseReward(stateRef.current, index);
    setRewardOptions(null);
    resumeRef.current?.();
  }, []);

  return (
    <div className="sf-board-wrap">
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
      {rewardOptions !== null ? (
        <SkyRewardOverlay options={rewardOptions} onChoose={onChooseReward} />
      ) : null}
    </div>
  );
}
