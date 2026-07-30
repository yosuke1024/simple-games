import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applyMatchDetailed,
  blockingPath,
  canAddNumbers,
  canUndo,
  isLive,
  isMatchingCells,
  MAX_CELLS,
  type BlockedPath,
  type Board,
} from '../../game';
import { haptics } from '../../services/haptics';
import { sounds } from '../../services/sound';
import { useApp } from '../../state/AppContext';
import { useSettings } from '../../state/SettingsContext';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { BannerSlot } from '../components/BannerSlot';
import { BoardView, type MatchAnim } from '../components/BoardView';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { IconAdd, IconBack, IconHint, IconRetry, IconUndo } from '../components/icons';
import { ResultOverlay } from '../components/ResultOverlay';

const HINT_COOLDOWN_MS = 2000;
const INVALID_FLASH_MS = 350;
/** Long enough to read "these numbers are in the way", short enough to stay quiet. */
const BLOCKED_FLASH_MS = 1100;
/** Beyond this, marking blockers is noise rather than an explanation. */
const MAX_BLOCKERS_SHOWN = 3;
const TOAST_MS = 2600;
const EMPTY_BOARD: Board = [];

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
    flags,
    markIntroSeen,
  } = useApp();
  const { t, settings } = useSettings();

  const [selected, setSelected] = useState<number | null>(null);
  const [hintPair, setHintPair] = useState<readonly [number, number] | null>(null);
  const [invalidPair, setInvalidPair] = useState<readonly [number, number] | null>(null);
  const [blocked, setBlocked] = useState<BlockedPath | null>(null);
  const [lastMatch, setLastMatch] = useState<MatchAnim | null>(null);
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
  const introEpoch = useRef(-1);
  const previousLength = useRef<number>(session?.board.length ?? 0);
  const previousStatus = useRef(session?.status ?? 'playing');
  const toastIdRef = useRef(0);

  const board = session?.board ?? EMPTY_BOARD;

  // Board changed (match / undo / add): stale indices must not linger.
  useEffect(() => {
    setSelected(null);
    setHintPair(null);
    setInvalidPair(null);
    setBlocked(null);
  }, [board]);

  // A new game is a clean slate: no send-off animation from the previous one.
  useEffect(() => {
    setLastMatch(null);
  }, [sessionEpoch]);

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

  // The first board holding a wild or a stone explains it, once, as a toast
  // (§16). A toast rather than a tutorial step: the rule arrives on the board
  // that needs it, and the tutorial stays at the three steps it promises.
  // One per game at most — two explanations at once is a lecture.
  useEffect(() => {
    if (!session || introEpoch.current === sessionEpoch) return;
    const has = (kind: 'wild' | 'stone') => session.board.some((c) => c?.kind === kind);
    const due = !flags.wildIntroSeen && has('wild')
      ? 'wild'
      : !flags.stoneIntroSeen && has('stone')
        ? 'stone'
        : null;
    if (due === null) return;
    introEpoch.current = sessionEpoch;
    showToast(t(due === 'wild' ? 'wildIntroToast' : 'stoneIntroToast'));
    markIntroSeen(due === 'wild' ? 'wildIntroSeen' : 'stoneIntroSeen');
  }, [session, sessionEpoch, flags, markIntroSeen, showToast, t]);

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
      // Stones and cleared cells are not selectable.
      if (!isLive(cell)) return;
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
      // Captured before the model board moves on: the pair's indices and the
      // rows the collapse is about to remove, so BoardView can act them out.
      const detail = applyMatchDetailed(session.board, selected, index);
      if (detail !== null && applyPair(selected, index)) {
        setLastMatch({
          pair: [selected, index],
          prevBoard: session.board,
          rowsRemoved: detail.rowsRemoved,
        });
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
        // misunderstanding. Trace the route the pair would have taken and mark
        // what stands on it, instead of only shaking the two cells (silent,
        // works in every language). The route matters as much as the blockers:
        // in reading order it wraps past the row's end, so a lone dashed tile
        // out there reads as unrelated.
        const other = session.board[selected];
        if (isLive(other) && isMatchingCells(other, cell)) {
          const route = blockingPath(session.board, selected, index);
          if (route.blockers.length > 0 && route.blockers.length <= MAX_BLOCKERS_SHOWN) {
            setBlocked(route);
            window.setTimeout(() => {
              setBlocked((current) => (current === route ? null : current));
            }, BLOCKED_FLASH_MS);
          }
        }
      }
    },
    [applyPair, selected, session],
  );

  const onUndo = useCallback(() => {
    setLastMatch(null);
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
    setLastMatch(null);
    if (applyAdd()) {
      sounds.addNumbers();
      void haptics.tap();
    }
  }, [applyAdd]);

  if (!session) return null;

  const undoDisabled = session.status !== 'playing' || !canUndo(session);
  const addDisabled =
    session.status !== 'playing' ||
    !canAddNumbers(session.board, MAX_CELLS);

  return (
    <div className="screen game-screen">
      {/* inert while the result overlay is up: nothing behind the dialog is
          focusable or exposed to assistive technology. */}
      <div className="game-content" inert={session.status !== 'playing'}>
      <header className="game-topbar">
        <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
          <IconBack />
        </button>
        <div className="game-status">
          <span className="game-mode">
            {session.mode === 'daily' ? t('modeDaily') : t('modeLevel', { n: session.level ?? 1 })}
          </span>
          <span className="game-score">
            <span className="visually-hidden">{t('score')} </span>
            <AnimatedNumber value={session.score.total} />
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
          <IconRetry />
        </button>
      </header>

      <div className="board-scroll" ref={boardRef}>
        <BoardView
          board={session.board}
          selected={selected}
          hintPair={hintPair}
          invalidPair={invalidPair}
          blocked={blocked}
          lastMatch={lastMatch}
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
            <IconUndo />
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
            <IconHint />
          </span>
          {t('hint')}
        </button>
        <button type="button" className="action-btn" onClick={onAdd} disabled={addDisabled}>
          <span className="action-icon" aria-hidden="true">
            <IconAdd />
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
