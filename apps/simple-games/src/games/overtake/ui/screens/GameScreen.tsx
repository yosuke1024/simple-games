/**
 * The Overtake game screen (docs/OVERTAKE_RULES.md §2, §3, §11).
 *
 * From the top: the bar (← home, the level, ❚❚ / ▶, ↻), the race row (the
 * place `n/4`, the progress marks, one short state line), the board, and the
 * row of buttons under it. Nothing is ever laid over the board — not in
 * `ready`, not while paused (§11): the state is said in the race row, which
 * keeps its height whatever it says, so the board never moves.
 *
 * - ↻ is the instant retry of an arcade race (§8): no question, the same
 *   course, `ready`. Disabled in `ready`, where there is nothing to throw
 *   away. The result card's Retry is the same function.
 * - No clock anywhere (§11): the race's time is not shown in play, on the
 *   card or in the statistics. The place and the progress marks change
 *   quietly — no colour, flash, toast or sound.
 * - Keys (§3): ← → / A D steer, ↓ / S ease off, Space / Enter start and
 *   resume (left to a focused button), P / Esc pause. W A S D by position
 *   (`code`). Held keys are the stage's (StageHandle); a repeat never starts,
 *   resumes or pauses. From the finishing step on the listener is detached
 *   (`useGameKeys`' `enabled`), through the 900 ms beat and the card (§3).
 * - The live region speaks once, at the finish: the place and the bumps.
 *   It sits outside `.game-content`, which is inert under the card.
 */
import { useEffect, useRef, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { IconBack, IconRetry } from '@/ui/components/icons';
import { useGameKeys } from '@/ui/useGameKeys';
import { RIVAL_COUNT } from '../../game/constants';
import type { RaceStatus } from '../../game/race';
import { useOvertake } from '../../state/GameContext';
import {
  OvertakeStage,
  type HeldKey,
  type StageHandle,
  type StageHud,
} from '../components/OvertakeStage';
import { OvertakeResultOverlay } from '../components/ResultOverlay';
import { FALLBACK_TRACK_PX, RIVAL_MARK_PX, spreadMarks } from '../progressMarks';

/** Arrow keys by what they say; W A S D by where they sit (an AZERTY board's Z Q S D). */
function heldKeyOf(event: KeyboardEvent): HeldKey | 'up' | null {
  if (event.key === 'ArrowLeft' || event.code === 'KeyA') return 'left';
  if (event.key === 'ArrowRight' || event.code === 'KeyD') return 'right';
  if (event.key === 'ArrowDown' || event.code === 'KeyS') return 'down';
  if (event.key === 'ArrowUp' || event.code === 'KeyW') return 'up';
  return null;
}

/** A focused control answers Space / Enter itself; the game must not answer twice (§3). */
function isControl(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('button, a[href], [role="button"], summary, select, input, textarea') !== null
  );
}

const STATE_KEYS = {
  ready: 'overtakeState_ready',
  running: 'overtakeState_running',
  paused: 'overtakeState_paused',
  finished: 'overtakeState_finished',
} as const satisfies Record<RaceStatus, string>;

/** The starting grid's place: two cars ahead on the front row, a tie beside (§2). */
const OPENING_HUD: StageHud = { place: 3, player: 0, rivals: [0, 0, 0] };

export function OvertakeGameScreen() {
  const {
    session,
    controls,
    lastResult,
    play,
    pauseRace,
    togglePause,
    retryRace,
    startNextLevel,
    finishRace,
    showLevels,
    goHome,
  } = useOvertake();
  const { t } = useSettings();
  const [hud, setHud] = useState<StageHud>(OPENING_HUD);
  const stageRef = useRef<StageHandle>(null);

  const status: RaceStatus = session?.status ?? 'ready';
  const finished = status === 'finished';

  const onKey = (event: KeyboardEvent): boolean => {
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    const held = heldKeyOf(event);
    if (held !== null) {
      // Swallowed always, so a held arrow never scrolls the page.
      if (held !== 'up') stageRef.current?.holdKey(held, true);
      return true;
    }
    const space = event.key === ' ' || event.code === 'Space';
    if (space || event.key === 'Enter') {
      if (isControl(event.target)) return false;
      if (!event.repeat) play();
      return true;
    }
    if (event.code === 'KeyP' || event.key === 'p' || event.key === 'P' || event.key === 'Escape') {
      if (!event.repeat) pauseRace();
      return true;
    }
    return false;
  };
  useGameKeys(onKey, session !== null && status !== 'finished');

  if (!session) return null;

  const running = status === 'running';
  const boardLabel = t('overtakeBoardLabel', { n: session.level, state: t(STATE_KEYS[status]) });

  return (
    <div className={`screen game-screen ot-screen ${controls === 'buttons' ? 'ot-buttons' : ''}`}>
      <div className="game-content" inert={finished}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <span className="game-mode">{t('modeLevel', { n: session.level })}</span>
          <span className="ot-topbar-actions">
            <button
              type="button"
              className="icon-btn"
              aria-label={
                running
                  ? t('overtakePause')
                  : status === 'paused'
                    ? t('resume')
                    : t('overtakeStart')
              }
              aria-keyshortcuts={running ? 'P' : 'Space'}
              onClick={togglePause}
              disabled={finished}
            >
              {running ? <PauseMark /> : <PlayMark />}
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={t('tryAgain')}
              onClick={retryRace}
              disabled={status === 'ready'}
            >
              <IconRetry />
            </button>
          </span>
        </header>

        <div className="ot-race-row">
          {/* A span takes no name (ARIA 1.2): the digits are hidden from the
              reader and a hidden twin says them in words. Not live — the place
              is not announced during the race (§11). */}
          <span className="ot-place">
            <span aria-hidden="true">
              {hud.place}/{RIVAL_COUNT + 1}
            </span>
            <span className="visually-hidden">{t('overtakePlaceNow', { place: hud.place })}</span>
          </span>
          <ProgressMarks hud={hud} />
          <span className="ot-state">
            {status === 'ready' ? t('overtakeTouchToStart') : null}
            {status === 'paused' ? (
              <>
                <PauseMark className="ot-state-mark" />
                {t('overtakePaused')}
              </>
            ) : null}
          </span>
        </div>

        <div className="ot-body">
          <OvertakeStage
            key={`${session.level}:${session.nonce}`}
            ref={stageRef}
            level={session.level}
            status={status}
            controls={controls}
            onPlay={play}
            onFinish={finishRace}
            onHud={setHud}
            boardLabel={boardLabel}
            padLabel={t('overtakePad')}
            leftLabel={t('overtakeSteerLeft')}
            rightLabel={t('overtakeSteerRight')}
            downLabel={t('overtakeSlowDown')}
          />
        </div>

        <BannerSlot />
      </div>

      {/* Outside .game-content, so the finish is still heard while the board
          behind the result card is inert (§11「スクリーンリーダー」). */}
      <p className="visually-hidden ot-live" role="status" aria-live="polite">
        {lastResult
          ? t('overtakeLiveResult', { place: lastResult.place, bumps: lastResult.bumps })
          : ''}
      </p>

      <OvertakeResultOverlay
        result={lastResult}
        onNext={startNextLevel}
        onRetry={retryRace}
        onLevels={showLevels}
      />
    </div>
  );
}

/**
 * The player and the three others along the course (§11): the others accent
 * rings with their digit on a lane of their own above the track, the player
 * an ink dot on the track itself — so the dot never covers a digit. Rings
 * that bunch up (all four start level, and the paces differ by under a tenth
 * — §6) are spread apart along their lane by `spreadMarks`, their order kept,
 * so every digit stays readable. A quiet strip — it moves, it never signals.
 */
function ProgressMarks({ hud }: { hud: StageHud }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const measure = () => setWidth(element.clientWidth);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, []);
  // jsdom (and the first paint) has no layout: a 360-wide screen's track.
  const track = width > 0 ? width : FALLBACK_TRACK_PX;
  const rivals = spreadMarks(
    hud.rivals.map((percent) => (percent / 100) * track),
    track,
    RIVAL_MARK_PX,
  );
  return (
    <span className="ot-progress" aria-hidden="true" ref={ref}>
      <span className="ot-progress-track" />
      {rivals.map((x, i) => (
        <span
          key={i}
          className="ot-progress-mark ot-progress-rival"
          style={{ left: `${x.toFixed(1)}px` }}
        >
          {i + 1}
        </span>
      ))}
      <span className="ot-progress-mark ot-progress-player" style={{ left: `${hud.player}%` }} />
    </span>
  );
}

/** Sized like the shared icons (icons.tsx: 1em), so ▶ and ❚❚ sit level with ← and ↻. */
function PauseMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
    </svg>
  );
}

function PlayMark() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false">
      <path d="M8 5 L19 12 L8 19 Z" fill="currentColor" />
    </svg>
  );
}
