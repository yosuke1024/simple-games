import { useCallback, useEffect, useRef, useState } from 'react';
import { canAddNumbers, canUndo, MAX_CELLS, type Board } from '../../game';
import { haptics } from '../../services/haptics';
import { sounds } from '../../services/sound';
import { useApp } from '../../state/AppContext';
import { useSettings } from '../../state/SettingsContext';
import { BannerSlot } from '../components/BannerSlot';
import { BoardView } from '../components/BoardView';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ResultOverlay } from '../components/ResultOverlay';
import { formatDuration } from '../format';

const HINT_COOLDOWN_MS = 2000;
const INVALID_FLASH_MS = 350;
const TOAST_MS = 2600;
const EMPTY_BOARD: Board = [];

export function GameScreen() {
  const {
    session,
    applyPair,
    applyUndo,
    applyAdd,
    takeHint,
    goHome,
    restartCurrent,
    startClassic,
  } = useApp();
  const { t, settings } = useSettings();

  const [selected, setSelected] = useState<number | null>(null);
  const [hintPair, setHintPair] = useState<readonly [number, number] | null>(null);
  const [invalidPair, setInvalidPair] = useState<readonly [number, number] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [hintCoolingDown, setHintCoolingDown] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const previousLength = useRef<number>(session?.board.length ?? 0);
  const previousStatus = useRef(session?.status ?? 'playing');
  const toastIdRef = useRef(0);

  const board = session?.board ?? EMPTY_BOARD;

  // Board changed (match / undo / add): stale indices must not linger.
  useEffect(() => {
    setSelected(null);
    setHintPair(null);
    setInvalidPair(null);
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
  const addDisabled = session.status !== 'playing' || !canAddNumbers(session.board, MAX_CELLS);

  return (
    <div className="screen game-screen">
      <header className="game-topbar">
        <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
          ←
        </button>
        <div className="game-status">
          <span className="game-mode">
            {session.mode === 'daily' ? t('modeDaily') : t('modeClassic')}
          </span>
          <span className="game-time">{formatDuration(session.elapsedSeconds)}</span>
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

      <ResultOverlay
        session={session}
        onRetry={restartCurrent}
        onNewGame={startClassic}
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
