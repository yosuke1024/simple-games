/**
 * The Pipe Link game screen (docs/PIPE_LINK_RULES.md §3, §6, §8, §10).
 *
 * No clock and no turn count on screen (§8): the elapsed time is recorded and
 * shown on the result card and in the statistics, so nothing here pushes the
 * player to hurry.
 *
 * Two actions, both free and unlimited (§6): Undo, because touch has no
 * counter-clockwise turn and stepping a tile back costs three taps, and Hint,
 * which marks one tile and the way it should face and never turns it for the
 * player. The keyboard reaches both — Ctrl/Cmd+Z and H — as adapters over the
 * same handlers the buttons call, and key repeat is ignored for both. Escape
 * means nothing here (there is no selection); while the ↻ question is open it
 * is that question's Cancel, and the board answers no key at all.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { RestartDialog } from '@/ui/components/RestartDialog';
import { IconBack, IconHint, IconRetry, IconUndo } from '@/ui/components/icons';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import { canUndo, countLit, litOf, type Hint, type TurnDirection } from '../../game';
import { usePipeLink, type TileStep } from '../../state/GameContext';
import { PipeBoard, type PipeBoardHandle, type Spin } from '../components/PipeBoard';
import { PipeLinkResultOverlay } from '../components/ResultOverlay';
import { DIFFICULTY_KEYS, pipesKey } from '../labels';

export function PipeLinkGameScreen() {
  const {
    session,
    lastResult,
    sessionEpoch,
    turn,
    applyUndo,
    takeHint,
    goHome,
    restartCurrent,
    startNewBoard,
  } = usePipeLink();
  const { t } = useSettings();

  const [hint, setHint] = useState<Hint | null>(null);
  /** The way the last turn went, so the drawing turns the same way (§10). */
  const [spin, setSpin] = useState<Spin | null>(null);
  /** What the last turn did, for a screen reader (polite, never a toast). */
  const [announcement, setAnnouncement] = useState('');
  const [confirmRestart, setConfirmRestart] = useState(false);
  const boardRef = useRef<PipeBoardHandle | null>(null);

  // A new board — or the same one restarted or resumed — is a clean slate.
  useEffect(() => {
    setHint(null);
    setSpin(null);
    setAnnouncement('');
  }, [sessionEpoch]);

  // Result feedback (sound / vibration) exactly once per transition (§2).
  const previousStatus = useRef(session?.status ?? 'playing');
  useEffect(() => {
    const status = session?.status ?? 'playing';
    if (status === 'solved' && previousStatus.current === 'playing') {
      setHint(null);
      sounds.clear();
      void haptics.clear();
    }
    previousStatus.current = status;
  }, [session?.status]);

  const lit = useMemo(() => (session ? litOf(session) : []), [session]);

  /**
   * Says, for a screen reader only, how a tile now faces and how much of the
   * board is lit — after a turn and after an undo alike (§10).
   */
  const announce = useCallback(
    (step: TileStep) => {
      if (session === null) return;
      const { board } = session;
      // Read the lit count off the orientations the step left, not this
      // render's copy, which a second turn in the same task finds stale.
      const after = [...session.current];
      after[step.cell] = step.after;
      setAnnouncement(
        t('pipeLinkAnnounce', {
          row: Math.floor(step.cell / board.width) + 1,
          col: (step.cell % board.width) + 1,
          pipes: t(pipesKey(board.types[step.cell]!, step.after)),
          lit: countLit(board, after),
          total: board.width * board.height,
        }),
      );
    },
    [session, t],
  );

  const onTurn = useCallback(
    (cell: number, direction: TurnDirection) => {
      const step = turn(cell, direction);
      if (step === null) return;
      setHint(null);
      setSpin({ cell, direction });
      sounds.select();
      void haptics.tap();
      announce(step);
    },
    [announce, turn],
  );

  const onUndo = useCallback(() => {
    const step = applyUndo();
    if (step === null) return;
    setHint(null);
    setSpin({ cell: step.cell, direction: step.direction });
    sounds.undo();
    announce(step);
  }, [announce, applyUndo]);

  /** The hint points; it never turns a tile for the player (§6). */
  const onHint = useCallback(() => {
    const next = takeHint();
    if (next === null) return;
    setHint(next);
    sounds.select();
  }, [takeHint]);

  /* Keyboard as an adapter over the handlers above (issue #93): H asks for
     the hint and Ctrl/Cmd+Z undoes — one-shot actions, so key repeat is
     ignored. An arrow that arrives here was not answered by the board (the
     focus was elsewhere): it brings the focus onto the board, and the next
     arrow walks it. */
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
    if (event.key.startsWith('Arrow') && !event.shiftKey) {
      boardRef.current?.focusTile();
      return true;
    }
    return false;
  };
  useGameKeys(onKey, session !== null && session.status === 'playing' && !confirmRestart);

  if (!session) return null;

  const finished = session.status !== 'playing';
  const { board } = session;
  const hinted = hint !== null && !finished ? hint : null;

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={finished || confirmRestart}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="game-status">
            <span className="game-mode">
              {session.mode === 'daily' ? t('modeDaily') : t(DIFFICULTY_KEYS[session.difficulty])}
            </span>
            <span className="pn-size-tag">
              {t('pipeLinkBoardNote', { width: board.width, height: board.height })}
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

        <div className="pn-board-area">
          <PipeBoard
            key={sessionEpoch}
            ref={boardRef}
            board={board}
            orientations={session.current}
            lit={lit}
            hint={hinted}
            solved={session.status === 'solved'}
            spin={spin}
            onTurn={onTurn}
          />
          {/* The one line under the board (§6): what the hint asks, until the
              next move takes it away. Two lines are reserved, so the board
              never jumps when it fills. */}
          <p className="pn-note" role="status">
            {hinted !== null ? t('pipeLinkHintNote') : ''}
            {hinted !== null ? (
              <span className="visually-hidden">
                {' '}
                {t('pipeLinkHintWhere', {
                  row: Math.floor(hinted.cell / board.width) + 1,
                  col: (hinted.cell % board.width) + 1,
                  pipes: t(pipesKey(board.types[hinted.cell]!, hinted.orientation)),
                })}
              </span>
            ) : null}
          </p>
        </div>

        <p className="visually-hidden" aria-live="polite">
          {announcement}
        </p>

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
          <button type="button" className="action-btn" onClick={onHint} disabled={finished}>
            <span className="action-icon" aria-hidden="true">
              <IconHint />
            </span>
            {t('hint')}
          </button>
        </div>

        <BannerSlot />
      </div>

      <PipeLinkResultOverlay
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
            ? { label: t('pipeLinkNewBoard'), start: () => startNewBoard(session.difficulty) }
            : undefined
        }
      />
    </div>
  );
}
