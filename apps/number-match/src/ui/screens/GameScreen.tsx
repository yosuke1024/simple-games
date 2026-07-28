import { useCallback, useEffect, useRef, useState } from 'react';
import {
  blockingCells,
  canAddNumbers,
  canUndo,
  isMatchingValues,
  MAX_CELLS,
  sessionShape,
  type Board,
} from '../../game';
import { haptics } from '../../services/haptics';
import { sounds } from '../../services/sound';
import { useApp } from '../../state/AppContext';
import { useSettings } from '../../state/SettingsContext';
import { BannerSlot } from '../components/BannerSlot';
import { BoardView } from '../components/BoardView';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ResultOverlay } from '../components/ResultOverlay';

const HINT_COOLDOWN_MS = 2000;
const INVALID_FLASH_MS = 350;
/** Long enough to read "these numbers are in the way", short enough to stay quiet. */
const BLOCKED_FLASH_MS = 1100;
/** Beyond this, marking blockers is noise rather than an explanation. */
const MAX_BLOCKERS_SHOWN = 3;
const TOAST_MS = 2600;
const EMPTY_BOARD: Board = [];
const NO_BLOCKERS: readonly number[] = [];

export function GameScreen() {
  const {
    session,
    progress,
    lastResult,
    sessionEpoch,
    applyPair,
    applyUndo,
    applyAdd,
    takeHint,
    goHome,
    restartCurrent,
    startNextLevel,
  } = useApp();
  const { t, settings } = useSettings();

  const [selected, setSelected] = useState<number | null>(null);
  const [hintPair, setHintPair] = useState<readonly [number, number] | null>(null);
  const [invalidPair, setInvalidPair] = useState<readonly [number, number] | null>(null);
  const [blockedCells, setBlockedCells] = useState<readonly number[]>(NO_BLOCKERS);
  const [toast, setToast] = useState<string | null>(null);
  const [hintCoolingDown, setHintCoolingDown] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);

  // The score to beat on this board — the reference keeps this in view
  // instead of a clock, which points attention at play rather than pace.
  const currentBest =
    session === null
      ? undefined
      : session.mode === 'level' && session.level !== null
        ? progress.bestScores[String(session.level)]
        : session.dailyDate
          ? progress.bestDaily[session.dailyDate]
          : undefined;

  const boardRef = useRef<HTMLDivElement | null>(null);
  const beatenEpoch = useRef(-1);
  const previousLength = useRef<number>(session?.board.length ?? 0);
  const previousStatus = useRef(session?.status ?? 'playing');
  const toastIdRef = useRef(0);

  const board = session?.board ?? EMPTY_BOARD;

  // Board changed (match / undo / add): stale indices must not linger.
  useEffect(() => {
    setSelected(null);
    setHintPair(null);
    setInvalidPair(null);
    setBlockedCells(NO_BLOCKERS);
  }, [board]);

  // After Add Numbers, keep the player oriented: reveal the appended cells.
  useEffect(() => {
    const length = board.length;
    const el = boardRef.current;
    if (length > previousLength.current && el && typeof el.scrollTo === 'function') {
      // Honor both the in-app setting and the OS-level reduce-motion preference.
      const osReduced =
        typeof window !== 'undefined' &&
        !!window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const behavior: ScrollBehavior = settings.reducedMotion || osReduced ? 'auto' : 'smooth';
      el.scrollTo({ top: el.scrollHeight, behavior });
    }
    previousLength.current = length;
  }, [board.length, settings.reducedMotion]);

  // Result feedback (sound / vibration) exactly once per transition.
  useEffect(() => {
    const status = session?.status ?? 'playing';
    if (status !== previousStatus.current) {
      if (status === 'cleared') {
        sounds.clear();
        void haptics.clear();
      } else if (status === 'gameOver') {
        sounds.gameOver();
      }
      previousStatus.current = status;
    }
  }, [session?.status]);

  const showToast = useCallback((message: string) => {
    const id = ++toastIdRef.current;
    setToast(message);
    window.setTimeout(() => {
      // Only the latest toast's timer may clear it (repeat taps re-show the
      // same message; each gets its full duration).
      if (toastIdRef.current === id) setToast(null);
    }, TOAST_MS);
  }, []);

  // Beating the board's best is the moment worth marking — once per game.
  useEffect(() => {
    if (!session || currentBest === undefined) return;
    if (beatenEpoch.current !== sessionEpoch && session.score.total > currentBest) {
      beatenEpoch.current = sessionEpoch;
      showToast(t('newBest'));
    }
  }, [session, currentBest, sessionEpoch, showToast, t]);

  const onCellTap = useCallback(
    (index: number) => {
      if (!session || session.status !== 'playing') return;
      const cell = session.board[index];
      if (!cell || cell.cleared) return;
      if (selected === null) {
        setSelected(index);
        sounds.select();
        void haptics.tap();
        return;
      }
      if (selected === index) {
        setSelected(null);
        return;
      }
      if (applyPair(selected, index)) {
        sounds.match();
        void haptics.match();
      } else {
        sounds.invalid();
        void haptics.invalid();
        const pair: readonly [number, number] = [selected, index];
        setInvalidPair(pair);
        setSelected(index);
        window.setTimeout(() => {
          setInvalidPair((current) => (current === pair ? null : current));
        }, INVALID_FLASH_MS);

        // The values matched but the path was blocked — the most common
        // misunderstanding. Point at the numbers that are in the way instead
        // of only shaking the two cells (silent, works in every language).
        const other = session.board[selected];
        if (other && !other.cleared && isMatchingValues(other.value, cell.value)) {
          const blockers = blockingCells(session.board, selected, index);
          if (blockers.length > 0 && blockers.length <= MAX_BLOCKERS_SHOWN) {
            setBlockedCells(blockers);
            window.setTimeout(() => {
              setBlockedCells((current) => (current === blockers ? NO_BLOCKERS : current));
            }, BLOCKED_FLASH_MS);
          }
        }
      }
    },
    [applyPair, selected, session],
  );

  const onUndo = useCallback(() => {
    if (applyUndo()) sounds.undo();
  }, [applyUndo]);

  const onHint = useCallback(() => {
    if (hintCoolingDown) return;
    setHintCoolingDown(true);
    window.setTimeout(() => setHintCoolingDown(false), HINT_COOLDOWN_MS);
    const pair = takeHint();
    if (pair) {
      setHintPair(pair);
      sounds.select();
    } else {
      showToast(t('hintNoneToast'));
    }
  }, [hintCoolingDown, showToast, t, takeHint]);

  const onAdd = useCallback(() => {
    if (applyAdd()) {
      sounds.addNumbers();
      void haptics.tap();
    }
  }, [applyAdd]);

  if (!session) return null;

  const undoDisabled = session.status !== 'playing' || !canUndo(session);
  const addDisabled =
    session.status !== 'playing' ||
    !canAddNumbers(session.board, sessionShape(session), MAX_CELLS);

  return (
    <div className="screen game-screen">
      {/* inert while the result overlay is up: nothing behind the dialog is
          focusable or exposed to assistive technology. */}
      <div className="game-content" inert={session.status !== 'playing'}>
      <header className="game-topbar">
        <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
          ←
        </button>
        <div className="game-status">
          <span className="game-mode">
            {session.mode === 'daily' ? t('modeDaily') : t('modeLevel', { n: session.level ?? 1 })}
          </span>
          <span className="game-score">
            <span className="visually-hidden">{t('score')} </span>
            {session.score.total}
          </span>
          {currentBest !== undefined ? (
            <span className="game-best">
              {t('best')} {currentBest}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label={t('tryAgain')}
          onClick={() => setConfirmRestart(true)}
        >
          ↻
        </button>
      </header>

      <div className="board-scroll" ref={boardRef}>
        <BoardView
          board={session.board}
          selected={selected}
          hintPair={hintPair}
          invalidPair={invalidPair}
          blockedCells={blockedCells}
          onCellTap={onCellTap}
        />
      </div>

      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}

      <div className="action-bar">
        <button type="button" className="action-btn" onClick={onUndo} disabled={undoDisabled}>
          <span className="action-icon" aria-hidden="true">
            ⤺
          </span>
          {t('undo')}
        </button>
        <button
          type="button"
          className="action-btn"
          onClick={onHint}
          disabled={session.status !== 'playing' || hintCoolingDown}
        >
          <span className="action-icon" aria-hidden="true">
            ◎
          </span>
          {t('hint')}
        </button>
        <button type="button" className="action-btn" onClick={onAdd} disabled={addDisabled}>
          <span className="action-icon" aria-hidden="true">
            ＋
          </span>
          {t('addNumbers')}
        </button>
      </div>

      <BannerSlot />
      </div>

      <ResultOverlay
        session={session}
        lastResult={lastResult}
        onRetry={restartCurrent}
        onNextLevel={startNextLevel}
        onHome={goHome}
      />

      <ConfirmDialog
        open={confirmRestart}
        title={t('tryAgain')}
        body={t('confirmNewGameBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setConfirmRestart(false)}
        onConfirm={() => {
          setConfirmRestart(false);
          restartCurrent();
        }}
      />
    </div>
  );
}
