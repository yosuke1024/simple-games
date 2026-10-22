/**
 * The Bounce Up game screen (docs/BOUNCE_UP_RULES.md §4, §7).
 *
 * From the top: the bar (← home, the score with this width's best, ❚❚ / ▶,
 * ↻), one short state line, and the board with ◀ ▶ over its lower corners
 * where a finger is the pointer. Nothing is laid over the middle of the
 * board — not in `ready`, not while paused: the state is said in the line
 * above it, which keeps its height whatever it says, so the board never moves.
 *
 * - ↻ is the instant retry of an arcade run (§4): no question, a fresh seed
 *   at this run's width, `ready`. It is labelled with the game's own "Climb
 *   again" — never `tryAgain`, and with no RestartDialog — the shape
 *   src/test/restartDialogWiring.test.ts allows the arcade titles. The
 *   result card's retry is the same function.
 * - No clock anywhere: the run's time is not shown in play, on the card or
 *   in the statistics (§7).
 * - Keys (§4「入力」): ← → / A D move while held (and start a `ready` run);
 *   Space starts and resumes (left to a focused button); P / Esc pause.
 *   A D by position (`code`). Held keys are the stage's (StageHandle); a
 *   repeat never starts, resumes or pauses. From the falling step on the
 *   listener is detached (`useGameKeys`' `enabled`), through the beat and
 *   the card.
 * - The score is plain DOM text, so a screen reader reads it; the live region
 *   speaks once, at the end. It sits outside `.game-content`, which is inert
 *   under the card.
 */
import { useRef, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { IconBack, IconRetry } from '@/ui/components/icons';
import { useGameKeys } from '@/ui/useGameKeys';
import type { RunStatus } from '../../game/types';
import { useBounceUp } from '../../state/GameContext';
import { BounceStage, type HeldKey, type StageHandle } from '../components/BounceStage';
import { BounceUpResultOverlay } from '../components/ResultOverlay';

/** ← → by what they say; A D by where they sit (an AZERTY board's Q D). */
function heldKeyOf(event: KeyboardEvent): HeldKey | null {
  if (event.key === 'ArrowLeft' || event.code === 'KeyA') return 'left';
  if (event.key === 'ArrowRight' || event.code === 'KeyD') return 'right';
  return null;
}

/** A focused control answers Space itself; the game must not answer twice (§4). */
function isControl(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('button, a[href], [role="button"], summary, select, input, textarea') !== null
  );
}

const STATE_KEYS = {
  ready: 'bounceUpState_ready',
  running: 'bounceUpState_running',
  paused: 'bounceUpState_paused',
  over: 'bounceUpState_over',
} as const satisfies Record<RunStatus, string>;

export function BounceUpGameScreen() {
  const {
    session,
    lastResult,
    play,
    pauseRun,
    togglePause,
    retryRun,
    noteScore,
    finishRun,
    goHome,
  } = useBounceUp();
  const { t } = useSettings();
  const [score, setScore] = useState(0);
  const stageRef = useRef<StageHandle>(null);

  const status: RunStatus = session?.status ?? 'ready';

  const onKey = (event: KeyboardEvent): boolean => {
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    const held = heldKeyOf(event);
    if (held !== null) {
      // Swallowed always, so a held arrow never scrolls the page. The first
      // one starts a waiting run (§4); a paused run waits for the player.
      if (status === 'ready' && !event.repeat) play();
      stageRef.current?.holdKey(held, true);
      return true;
    }
    if (event.key === ' ' || event.code === 'Space') {
      if (isControl(event.target)) return false;
      if (!event.repeat) play();
      return true;
    }
    if (event.code === 'KeyP' || event.key === 'p' || event.key === 'P' || event.key === 'Escape') {
      if (!event.repeat) pauseRun();
      return true;
    }
    return false;
  };
  useGameKeys(onKey, session !== null && status !== 'over');

  if (!session) return null;

  const over = status === 'over';
  const running = status === 'running';
  const onScore = (next: number) => {
    setScore(next);
    noteScore(next);
  };

  return (
    <div className="screen game-screen bo-screen">
      <div className="game-content" inert={over}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="game-status bo-status">
            <span className="game-score bo-score">
              <span className="visually-hidden">{t('score')} </span>
              {score}
            </span>
            {session.bestAtStart > 0 ? (
              <span className="bo-best">
                {t('bounceUpBestNote', { score: session.bestAtStart })}
              </span>
            ) : null}
          </div>
          <span className="bo-topbar-actions">
            <button
              type="button"
              className="icon-btn"
              aria-label={
                running
                  ? t('bounceUpPause')
                  : status === 'paused'
                    ? t('resume')
                    : t('bounceUpStart')
              }
              aria-keyshortcuts={running ? 'P' : 'Space'}
              onClick={togglePause}
              disabled={over}
            >
              {running ? <PauseMark /> : <PlayMark />}
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={t('bounceUpClimbAgain')}
              onClick={retryRun}
            >
              <IconRetry />
            </button>
          </span>
        </header>

        <p className="bo-state">
          {status === 'ready' ? t('bounceUpTouchToStart') : null}
          {status === 'paused' ? (
            <>
              <PauseMark className="bo-state-mark" />
              {t('bounceUpPaused')}
            </>
          ) : null}
        </p>

        <div className="bo-body">
          <BounceStage
            key={`${session.seed}:${session.nonce}`}
            ref={stageRef}
            seed={session.seed}
            width={session.width}
            status={status}
            bestAtStart={session.bestAtStart}
            onPlay={play}
            onScore={onScore}
            onOver={finishRun}
            boardLabel={t('bounceUpBoardLabel', { state: t(STATE_KEYS[status]) })}
            padLabel={t('bounceUpPad')}
            leftLabel={t('bounceUpMoveLeft')}
            rightLabel={t('bounceUpMoveRight')}
          />
        </div>

        <BannerSlot />
      </div>

      {/* Outside .game-content, so the end is still heard while the board
          behind the result card is inert. */}
      <p className="visually-hidden bo-live" role="status" aria-live="polite">
        {lastResult ? t('bounceUpLiveResult', { score: lastResult.score }) : ''}
      </p>

      <BounceUpResultOverlay result={lastResult} onRetry={retryRun} onHome={goHome} />
    </div>
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
