/**
 * The Loop Puzzle game screen (docs/LOOP_PUZZLE_RULES.md §4, §5, §6, §10).
 *
 * No clock on screen (§10): the elapsed time is recorded and shown on the
 * result card and in the statistics, so nothing here pushes the player to
 * hurry.
 *
 * Under the board sits one quiet line of words (§5, §6). After a Hint it
 * says what the hint marked and why, for as long as the mark stays on the
 * board (until the next step); otherwise it says what the marks break right
 * now, read from the rules alone — no mark is ever changed for the player,
 * and no sound goes with a broken rule. The line lives beside the board, not
 * over it, so a hint near the bottom edge is never hidden by its own words.
 *
 * Two actions, both free and unlimited: Undo (one tap is one step) and Hint,
 * which marks one edge and says why without writing anything (§6). The
 * keyboard reaches both — Ctrl/Cmd+Z and H (issue #93) — as adapters over the
 * same handlers the buttons call; the board's own edges take Enter / Space,
 * the arrow keys and L / X / Delete (ui/components/LoopPuzzleBoard.tsx).
 *
 * While anything modal is up — the result card or the ↻ dialog —
 * `.game-content` is `inert` and the key listener is off
 * (docs/ARCHITECTURE.md「モーダルの間、盤面は inert」).
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { RestartDialog } from '@/ui/components/RestartDialog';
import { IconBack, IconHint, IconRetry, IconUndo } from '@/ui/components/icons';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import { canUndo, gridFor, hintEdge, type Hint, type Mark } from '../../game';
import { useLoopPuzzle } from '../../state/GameContext';
import { LoopPuzzleBoard } from '../components/LoopPuzzleBoard';
import { LoopPuzzleResultOverlay } from '../components/LoopPuzzleResultOverlay';
import { conflictMessageKey, edgeLabel, hintMessageKey } from '../feedback';

/** What the last Hint tap gave: a hint, or nothing to say (null). Absent until asked. */
interface HintView {
  readonly hint: Hint | null;
}

export function LoopPuzzleGameScreen() {
  const {
    session,
    lastResult,
    sessionEpoch,
    cycleEdge,
    setEdgeMark,
    applyUndo,
    takeHint,
    goHome,
    restartCurrent,
    startNewBoard,
  } = useLoopPuzzle();
  const { t } = useSettings();

  const [hintView, setHintView] = useState<HintView | null>(null);
  const [confirmRestart, setConfirmRestart] = useState(false);

  // A board coming on screen is a clean slate.
  useEffect(() => {
    setHintView(null);
  }, [sessionEpoch]);

  // Result feedback (sound / vibration) exactly once per transition.
  const previousStatus = useRef(session?.status ?? 'playing');
  useEffect(() => {
    const status = session?.status ?? 'playing';
    if (status === 'solved' && previousStatus.current === 'playing') {
      sounds.clear();
      void haptics.clear();
    }
    previousStatus.current = status;
  }, [session?.status]);

  /** A step was taken: the hint it answered is spent. */
  const changed = useCallback(() => {
    setHintView(null);
    sounds.select();
    void haptics.tap();
  }, []);

  const onCycle = useCallback(
    (edge: number) => {
      if (cycleEdge(edge)) changed();
    },
    [changed, cycleEdge],
  );

  const onSet = useCallback(
    (edge: number, mark: Mark) => {
      if (setEdgeMark(edge, mark)) changed();
    },
    [changed, setEdgeMark],
  );

  const onUndo = useCallback(() => {
    if (!applyUndo()) return;
    setHintView(null);
    sounds.undo();
  }, [applyUndo]);

  /** The hint points; it never writes to the board for the player (§6). */
  const onHint = useCallback(() => {
    const next = takeHint();
    setHintView({ hint: next });
    if (next !== null) sounds.select();
  }, [takeHint]);

  /* Keyboard as an adapter over the handlers above (issue #93): H asks for
     the hint and Ctrl/Cmd+Z undoes, the same one-shot actions the two buttons
     trigger, so key repeat is ignored for both. */
  const onKey = (event: KeyboardEvent): boolean => {
    if (session === null) return false;
    if (isUndoKey(event)) {
      if (!event.repeat && canUndo(session)) onUndo();
      return true;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    if (event.key === 'h' || event.key === 'H') {
      if (!event.repeat) onHint();
      return true;
    }
    return false;
  };
  useGameKeys(onKey, session !== null && session.status === 'playing' && !confirmRestart);

  if (!session) return null;

  const finished = session.status !== 'playing';
  const hint = hintView?.hint ?? null;
  // The hint's words while its mark is up; otherwise what the marks break (§5, §6).
  const conflict = finished || hintView !== null ? null : conflictMessageKey(session);
  const message =
    hintView !== null
      ? t(hint === null ? 'loopPuzzleHintNone' : hintMessageKey(hint))
      : conflict !== null
        ? t(conflict)
        : '';
  // Where the marked edge is, for a listener (§13): its own spoken name,
  // read after the hint's sentence — the frame on the board says it to the eye.
  const marked =
    hint === null
      ? null
      : edgeLabel(
          gridFor(session.width, session.height),
          hintEdge(hint),
          session.marks[hintEdge(hint)]! as Mark,
        );

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={finished || confirmRestart}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="game-status">
            <span className="game-mode">
              {session.mode === 'daily'
                ? t('modeDaily')
                : t(`loopPuzzleDifficulty_${session.difficulty}`)}
            </span>
            <span className="lp-size-tag">
              {t('loopPuzzleBoardNote', { width: session.width, height: session.height })}
            </span>
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

        {/* `--lp-n` sizes the board's floor (loop-puzzle.css). */}
        <div className="lp-board-area" style={{ '--lp-n': session.width } as CSSProperties}>
          <LoopPuzzleBoard
            session={session}
            hint={hint}
            onCycle={onCycle}
            onSet={onSet}
            solved={session.status === 'solved'}
          />
          {/* One quiet line, always at least the same height, so the board
              never moves when words come or go. A status region: a screen
              reader hears each new sentence once. */}
          <p
            className={[
              'lp-feedback',
              hint !== null ? 'lp-feedback-hint' : '',
              conflict !== null ? 'lp-feedback-conflict' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            role="status"
          >
            <span className="lp-feedback-text">{message}</span>
            {marked !== null ? (
              <span className="visually-hidden"> {t(marked.key, marked.values)}</span>
            ) : null}
          </p>
        </div>

        <div className="action-bar">
          <button
            type="button"
            className="action-btn"
            onClick={onUndo}
            disabled={!canUndo(session)}
          >
            <span className="action-icon" aria-hidden="true">
              <IconUndo />
            </span>
            {t('undo')}
          </button>
          <button type="button" className="action-btn" onClick={onHint}>
            <span className="action-icon" aria-hidden="true">
              <IconHint />
            </span>
            {t('hint')}
          </button>
        </div>

        <BannerSlot />
      </div>

      <LoopPuzzleResultOverlay
        session={session}
        lastResult={lastResult}
        onRetry={restartCurrent}
        onNewBoard={() => startNewBoard(session.difficulty)}
        onHome={goHome}
      />

      <RestartDialog
        open={confirmRestart}
        onClose={() => setConfirmRestart(false)}
        onRetry={restartCurrent}
        newBoard={
          session.mode === 'difficulty'
            ? { label: t('loopPuzzleNewBoard'), start: () => startNewBoard(session.difficulty) }
            : undefined
        }
      />
    </div>
  );
}
