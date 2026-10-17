/**
 * The Snake game screen (docs/SNAKE_RULES.md §5, §6, §13).
 *
 * Top bar: the way home, the score with the best at this speed (or, while
 * paused, "❚❚ Paused" in its place), and the ↻ (RestartDialog — "Retry same
 * board", "New Game" or Cancel, the same continuations the result card
 * offers). Then the board, and under it the cross of direction buttons with
 * Start / Pause / Resume in its middle.
 *
 * Four input paths, one function: a swipe on the board, a direction button,
 * an arrow key or W A S D — all of them `steer` (§5). Space and P start,
 * pause and resume. While a dialog or the result card is up the board is
 * `inert` and the key listener is detached (docs/ARCHITECTURE.md「モーダルの間、
 * 盤面は inert」), and opening the ↻ pauses the run first: a run never keeps
 * moving under a question, and Cancel leaves it paused (§6).
 *
 * Nothing is ever laid over the board (§13): before Start and while paused
 * the whole of it stays in view — the first food, every coil of the body,
 * the heading chosen for the restart — because looking at the stopped board
 * is what those two states are for (§2, §5). Start and Resume are the cross's
 * middle button (and Space / P, and in `ready` any direction); the paused
 * state is said in the top bar, in words and the ❚❚ mark.
 *
 * The screen re-renders on a tick, but the board only redraws for what it
 * shows (SnakeBoard is memoised on body, food, heading, status, crash and the
 * chosen heading) and the controls only for the run's status and heading — a
 * turn queued while running changes nothing either of them draws (§13).
 */
import { useEffect, useRef, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { IconBack, IconRetry } from '@/ui/components/icons';
import { RestartDialog } from '@/ui/components/RestartDialog';
import { useGameKeys } from '@/ui/useGameKeys';
import {
  BOARD_SIZE,
  isFinished,
  pendingHeading,
  type Crash,
  type Direction,
  type RunStatus,
} from '../../game';
import { useSnake } from '../../state/GameContext';
import { SnakePad } from '../components/SnakePad';
import { SnakeResultOverlay } from '../components/SnakeResultOverlay';
import { SnakeStage } from '../components/SnakeStage';

/** Arrow keys by what they say. */
const KEY_DIRECTIONS: Readonly<Record<string, Direction>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/**
 * W A S D by where they sit, not by the letter printed on them: the cluster
 * under the left hand is the same four keys on every layout (an AZERTY
 * board's Z Q S D).
 */
const CODE_DIRECTIONS: Readonly<Record<string, Direction>> = {
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
};

/** A focused control answers Space itself; the game must not answer it a second time (§13). */
function isControl(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('button, a[href], [role="button"], summary, select, input, textarea') !== null
  );
}

const STATE_KEYS = {
  ready: 'snakeStateReady',
  running: 'snakeStateRunning',
  paused: 'snakeStatePaused',
  over: 'snakeStateOver',
  cleared: 'snakeStateCleared',
} as const satisfies Record<RunStatus, string>;

interface Heard {
  readonly status: RunStatus;
  readonly score: number;
  readonly pending: Direction | null;
  readonly crash: Crash | null;
}

/** Where focus goes once the control that held it has gone (a card, a dialog). */
type Refocus = 'toggle' | 'restart';

export function SnakeGameScreen() {
  const {
    session,
    stats,
    lastResult,
    steer,
    pauseRun,
    togglePause,
    retryRun,
    startNewRun,
    goHome,
  } = useSnake();
  const { t } = useSettings();
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  /* Focus after a result card or the ↻ dialog closes. The button that held
     it is gone with them, and focus would fall to <body> — where a screen
     reader user has lost their place and must hunt for Pause again. A new
     board goes to the cross's middle button (Start; the ↻ is disabled on a
     ready board), Cancel back to the ↻ that opened the question. Only when
     focus really was lost: a press that already put it somewhere keeps it. */
  const toggleRef = useRef<HTMLButtonElement>(null);
  const restartRef = useRef<HTMLButtonElement>(null);
  const refocusRef = useRef<Refocus | null>(null);
  useEffect(() => {
    const target = refocusRef.current;
    if (target === null) return;
    refocusRef.current = null;
    const active = document.activeElement;
    if (active !== null && active !== document.body && active.isConnected) return;
    (target === 'toggle' ? toggleRef : restartRef).current?.focus();
  });

  const status = session?.status ?? 'ready';
  const score = session?.score ?? 0;
  const pending = session ? pendingHeading(session) : null;
  const crash = session?.crash ?? null;
  const finished = session !== null && isFinished(session);

  /* What a screen reader hears (§13「スクリーンリーダー」): the score when it
     changes, the run's status when it changes, and a heading chosen or
     cleared while paused — never a tick. Worked out from the change itself,
     so a heading chosen twice the same way says nothing the second time. */
  const heardRef = useRef<Heard | null>(null);
  useEffect(() => {
    const before = heardRef.current;
    heardRef.current = { status, score, pending, crash };
    let message: string | null = null;
    if (before === null) {
      if (status === 'paused') message = t('snakeLivePaused', { score });
    } else if (before.status !== status) {
      if (status === 'running') {
        message = before.status === 'paused' ? t('snakeLiveResumed') : t('snakeLiveStarted');
      } else if (status === 'paused') {
        message = t('snakeLivePaused', { score });
      } else if (status === 'over') {
        message = crash === 'self' ? t('snakeLiveSelf', { score }) : t('snakeLiveWall', { score });
      } else if (status === 'cleared') {
        message = t('snakeLiveCleared', { score });
      } else {
        message = '';
      }
    } else if (before.score !== score) {
      message = t('snakeLiveScore', { score });
    } else if (status === 'paused' && before.pending !== pending) {
      message =
        pending === null
          ? t('snakeLiveNextCleared')
          : t('snakeNextTurn', { direction: t(`snakeDir_${pending}`) });
    }
    if (message !== null) setAnnouncement(message);
  }, [status, score, pending, crash, t]);

  /* Keyboard as an adapter over the same handlers the buttons call (issue
     #93). Arrows and W A S D always swallow the key so a held one cannot
     scroll the page; a held key does not repeat a press — one press is one
     input, and a repeat could only ever land as a turn nobody meant. */
  const onKey = (event: KeyboardEvent): boolean => {
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    const direction = KEY_DIRECTIONS[event.key] ?? CODE_DIRECTIONS[event.code];
    if (direction !== undefined) {
      if (!event.repeat) steer(direction);
      return true;
    }
    const space = event.key === ' ' || event.code === 'Space';
    if (space || event.key === 'p' || event.key === 'P') {
      if (space && isControl(event.target)) return false;
      if (!event.repeat) togglePause();
      return true;
    }
    return false;
  };
  useGameKeys(onKey, session !== null && !confirmRestart && !finished);

  if (!session) return null;

  const best = Math.max(stats[session.speed].bestScore, session.score);
  const speedLabel = t(`snakeSpeed_${session.speed}`);
  const boardLabel = t('snakeBoardLabel', { size: BOARD_SIZE, state: t(STATE_KEYS[status]) });

  const openRestart = () => {
    pauseRun();
    setConfirmRestart(true);
  };
  const closeRestart = () => {
    refocusRef.current = 'restart';
    setConfirmRestart(false);
  };
  const retry = () => {
    refocusRef.current = 'toggle';
    retryRun();
  };
  const newRun = () => {
    refocusRef.current = 'toggle';
    startNewRun();
  };

  return (
    <div className="screen game-screen sn-screen">
      <div className="game-content" inert={finished || confirmRestart}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="sn-status">
            <span className="sn-score">
              <span className="sn-score-label">{t('score')}</span>{' '}
              <span className="sn-score-value">{session.score}</span>
            </span>
            {/* One line whatever it says, so the bar never changes height. While
                paused it says so, in words and the ❚❚ mark; otherwise the best
                at this speed — or only the speed, while there is no record:
                "best 0" is the absence of one (§10, the result card agrees). */}
            {status === 'paused' ? (
              <span className="sn-sub sn-paused">
                <svg
                  className="sn-paused-mark"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
                </svg>
                {t('snakePaused')}
              </span>
            ) : (
              <span className="sn-sub">
                {best > 0 ? t('snakeTopBest', { score: best, speed: speedLabel }) : speedLabel}
              </span>
            )}
          </div>
          <button
            ref={restartRef}
            type="button"
            className="icon-btn"
            aria-label={t('tryAgain')}
            onClick={openRestart}
            disabled={status === 'ready'}
          >
            <IconRetry />
          </button>
        </header>

        <div className="sn-body">
          <div className="sn-stage-wrap">
            <SnakeStage
              body={session.body}
              food={session.food}
              direction={session.direction}
              status={status}
              crash={crash}
              pending={pending}
              label={boardLabel}
              onSwipe={steer}
            />
          </div>

          <SnakePad
            status={status}
            direction={session.direction}
            onSteer={steer}
            onToggle={togglePause}
            toggleRef={toggleRef}
          />
        </div>

        <BannerSlot />
      </div>

      {/* Outside .game-content, so the ending is still heard while the board
          behind the result card is inert. */}
      <p className="visually-hidden sn-live" role="status" aria-live="polite">
        {announcement}
      </p>

      <SnakeResultOverlay result={lastResult} onRetry={retry} onNewBoard={newRun} onHome={goHome} />

      <RestartDialog
        open={confirmRestart}
        onClose={closeRestart}
        onRetry={retry}
        newBoard={{ label: t('newGame'), start: newRun }}
      />
    </div>
  );
}
