/**
 * The Tangram game screen (docs/TANGRAM_RULES.md §3, §4, §10).
 *
 * The figure, the tray, and three buttons under them: Rotate, Flip and Undo.
 * No clock and no count on screen (§7): the figure's tier and number in the
 * top bar are the only words. There is no Hint, by design (§3).
 *
 * A piece in the hand — dragged (components/TangramBoard.tsx) or lifted by
 * the keyboard (here) — is this screen's state, never the session's: it is
 * not saved, it does not count, and leaving the screen, the page going
 * hidden or Back abandons it (§8「手にある駒」).
 *
 * The keyboard (§4「キーボード」), an adapter over the same calls the pointer
 * makes:
 *
 * - Tab walks the seven pieces (fixed ones too, for reading). Enter / Space
 *   lifts the focused piece; the arrows move its provisional point exactly
 *   one unit and the piece is drawn where it would snap; Enter / Space puts
 *   it there (nothing happens with nowhere to snap). R turns and F flips the
 *   lifted piece without touching the session; Escape puts it back — a board
 *   piece to the tray, one operation. While a piece is lifted Tab stays put.
 * - Not lifted, R and F turn and flip the focused (or selected) piece the way
 *   a tap and the Flip button do, Escape sends a focused board piece to the
 *   tray, and Ctrl/Cmd+Z undoes.
 * - A held key lifts, places, turns, flips, puts back and undoes nothing;
 *   only the arrows repeat.
 *
 * While anything modal is up — the result card, the ↻ question — the play
 * area is `inert` and the keys are off (src/test/modalIsolationWiring.test.ts),
 * and the ↻ offers the retry alone, as the result card does: the next figure
 * is the next step of the list, not another board (src/test/restartDialogWiring.test.ts).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { RestartDialog } from '@/ui/components/RestartDialog';
import { IconBack, IconRetry, IconUndo } from '@/ui/components/icons';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import { useReducedMotion } from '@/ui/useReducedMotion';
import {
  canFlip,
  canUndo,
  centroidOf,
  figureNumber,
  isFixed,
  keyboardSnap,
  outlineCenter,
  stepPoint,
  TURNS,
  type Orientation,
  type PieceId,
  type Placement,
} from '../../game';
import { useTangram } from '../../state/GameContext';
import { TangramBoard, type Lift, type PieceAnimation } from '../components/TangramBoard';
import { TangramResultOverlay } from '../components/ResultOverlay';
import { figureTitle, fitMessage } from '../labels';

/** The keys this screen answers: swallowed, and nothing more, while a finger is on a piece. */
const GAME_KEYS = new Set([
  'Enter',
  ' ',
  'r',
  'R',
  'f',
  'F',
  'Escape',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
]);

const ARROWS: Readonly<Record<string, readonly [dx: number, dy: number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** The piece a keyboard user is on, if focus is on one of the pieces. */
function focusedPiece(): PieceId | null {
  if (typeof document === 'undefined') return null;
  const active = document.activeElement as HTMLElement | null;
  const value = active?.dataset?.piece;
  return value === undefined ? null : (value as PieceId);
}

function RotateGlyph() {
  return (
    <svg className="tn-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 12a7 7 0 1 1-2.05-4.95" />
      <path d="M19 4v4h-4" />
    </svg>
  );
}

function FlipGlyph() {
  return (
    <svg className="tn-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v18" strokeDasharray="2 2" />
      <path d="M9 7 4 17h5z" />
      <path d="m15 7 5 10h-5z" />
    </svg>
  );
}

export function TangramGameScreen() {
  const {
    session,
    lastResult,
    sessionEpoch,
    place,
    toTray,
    rotate,
    flip,
    applyUndo,
    goHome,
    restartCurrent,
    startNextFigure,
  } = useTangram();
  const { t } = useSettings();
  const reducedMotion = useReducedMotion();

  const [confirmRestart, setConfirmRestart] = useState(false);
  const [selected, setSelected] = useState<PieceId | null>(null);
  const [lift, setLift] = useState<Lift | null>(null);
  /** A finger is on a piece: the buttons and the keys wait (§4). */
  const [held, setHeld] = useState(false);
  const [animation, setAnimation] = useState<PieceAnimation | null>(null);
  const animationCount = useRef(0);
  /**
   * What the live region reads out (§10): while a piece is lifted, whether it
   * fits where it is drawn. `turn` tells a repeat of the same words apart — a
   * live region reads a change, so every other repeat carries a no-break space.
   */
  const [spoken, setSpoken] = useState<{ text: string; turn: number } | null>(null);
  /** Set when the focus may have just lost its element (a card or dialog answer). */
  const refocus = useRef(false);

  const speak = useCallback((text: string) => {
    setSpoken((current) =>
      current !== null && current.text === text
        ? { text, turn: current.turn + 1 }
        : { text, turn: 0 },
    );
  }, []);

  // A figure coming on screen is a clean slate: nothing selected, nothing held.
  useEffect(() => {
    setSelected(null);
    setLift(null);
    setAnimation(null);
    setSpoken(null);
  }, [sessionEpoch]);

  // A lifted piece is abandoned when the page goes hidden (§8「手にある駒」):
  // the session never had it, so there is nothing to undo or save.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') setLift(null);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // After the render that took the focused control away (the result card's
  // buttons, the ↻ dialog's answers), the focus goes to the first piece — never
  // taken from wherever it still is, and the page is not scrolled for it.
  useLayoutEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    const active = document.activeElement;
    if (active !== null && active !== document.body && active.isConnected) return;
    document.querySelector<HTMLElement>('.tn-play [data-piece]')?.focus({ preventScroll: true });
  });

  // The completion's sound and vibration, once per transition (§10).
  const previousStatus = useRef(session?.status ?? 'playing');
  useEffect(() => {
    const status = session?.status ?? 'playing';
    if (status === 'complete' && previousStatus.current === 'playing') {
      sounds.clear();
      void haptics.clear();
    }
    previousStatus.current = status;
  }, [session?.status]);

  const animate = useCallback(
    (id: PieceId, kind: 'turn' | 'flip') => {
      if (reducedMotion) return;
      animationCount.current += 1;
      setAnimation({ id, kind, key: animationCount.current });
    },
    [reducedMotion],
  );

  const onSelect = useCallback((id: PieceId) => setSelected(id), []);

  const onTap = useCallback(
    (id: PieceId) => {
      if (rotate(id)) animate(id, 'turn');
    },
    [animate, rotate],
  );

  /** A placement from a drop or from Enter: the one sound a placement makes (§10). */
  const onPlace = useCallback(
    (id: PieceId, placement: Placement) => {
      if (!place(id, placement)) return;
      setAnimation(null);
      sounds.select();
      void haptics.tap();
    },
    [place],
  );

  const onReturn = useCallback(
    (id: PieceId) => {
      if (toTray(id)) setAnimation(null);
    },
    [toTray],
  );

  const onRotate = useCallback(() => {
    if (selected !== null) onTap(selected);
  }, [onTap, selected]);

  const onFlip = useCallback(() => {
    if (selected !== null && flip(selected)) animate(selected, 'flip');
  }, [animate, flip, selected]);

  const onUndo = useCallback(() => {
    if (!applyUndo()) return;
    setAnimation(null);
    sounds.undo();
  }, [applyUndo]);

  const onRetry = useCallback(() => {
    refocus.current = true;
    restartCurrent();
  }, [restartCurrent]);

  const onNextFigure = useCallback(() => {
    refocus.current = true;
    startNextFigure();
  }, [startNextFigure]);

  /** Lifts a piece for the keyboard: from the board where it stands, from the tray onto the figure's centre (§4). */
  const liftPiece = useCallback(
    (id: PieceId) => {
      if (session === null) return;
      const placed = session.board[id];
      const o: Orientation = placed ? { r: placed.r, f: placed.f } : session.tray[id];
      const point = placed ? centroidOf(id, placed) : outlineCenter(session.figure.outline);
      const outcome = keyboardSnap(session.figure.outline, session.board, id, o, point);
      setSelected(id);
      setLift({ id, source: placed ? 'board' : 'tray', o, point, outcome });
      speak(t('tangramLifted', { piece: t(`tangramPiece_${id}`) }));
    },
    [session, speak, t],
  );

  /** The lifted piece in a new turn, side or place — the session untouched (§4). */
  const reLift = useCallback(
    (current: Lift, o: Orientation, point: readonly [number, number]) => {
      if (session === null) return;
      const outcome = keyboardSnap(session.figure.outline, session.board, current.id, o, point);
      setLift({ ...current, o, point, outcome });
      speak(fitMessage(t, outcome.target));
    },
    [session, speak, t],
  );

  const onKey = (event: KeyboardEvent): boolean => {
    if (session === null) return false;
    if (isUndoKey(event)) {
      if (!event.repeat && !held && lift === null && canUndo(session)) onUndo();
      return true;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    const key = event.key;
    if (held) return GAME_KEYS.has(key);

    if (lift !== null) {
      const arrow = ARROWS[key];
      if (arrow !== undefined) {
        reLift(lift, lift.o, stepPoint(lift.point, arrow[0], arrow[1]));
        return true;
      }
      if (event.repeat) return true;
      if (key === 'Enter' || key === ' ') {
        const placement = lift.outcome.placement;
        if (placement) {
          setLift(null);
          onPlace(lift.id, placement);
        }
        return true;
      }
      if (key === 'r' || key === 'R') {
        reLift(lift, { r: (lift.o.r + 1) % TURNS, f: lift.o.f }, lift.point);
        return true;
      }
      if (key === 'f' || key === 'F') {
        if (canFlip(lift.id)) reLift(lift, { r: lift.o.r, f: lift.o.f ? 0 : 1 }, lift.point);
        return true;
      }
      if (key === 'Escape') {
        setLift(null);
        if (lift.source === 'board') onReturn(lift.id);
        return true;
      }
      // The focus stays with the lifted piece until it is placed or put back.
      return key === 'Tab';
    }

    const focused = focusedPiece();
    if (key === 'Enter' || key === ' ') {
      if (focused === null) return false;
      if (!event.repeat && !isFixed(session, focused)) liftPiece(focused);
      else setSelected(focused);
      return true;
    }
    if (key === 'r' || key === 'R' || key === 'f' || key === 'F') {
      const target = focused ?? selected;
      if (target === null) return false;
      if (!event.repeat) {
        setSelected(target);
        if (key === 'r' || key === 'R') onTap(target);
        else if (flip(target)) animate(target, 'flip');
      }
      return true;
    }
    if (key === 'Escape') {
      if (focused === null || session.board[focused] === undefined) return false;
      if (!event.repeat) onReturn(focused);
      return true;
    }
    return false;
  };
  useGameKeys(onKey, session !== null && session.status === 'playing' && !confirmRestart);

  if (!session) return null;

  const finished = session.status !== 'playing';
  const busy = held || lift !== null;
  const selectedMovable = selected !== null && !isFixed(session, selected);
  const title = figureTitle(
    t,
    session.mode,
    session.figure.tier,
    figureNumber(session.figure),
    session.dailyDate,
  );
  const spokenText =
    spoken === null ? '' : spoken.turn % 2 === 1 ? `${spoken.text}\u00a0` : spoken.text;

  return (
    <div className="screen game-screen tn-screen">
      <div className="game-content" inert={finished || confirmRestart}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <span className="game-mode">{session.mode === 'daily' ? t('modeDaily') : title}</span>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('tryAgain')}
            onClick={() => setConfirmRestart(true)}
          >
            <IconRetry />
          </button>
        </header>

        <TangramBoard
          session={session}
          label={t('tangramSilhouetteLabel', { figure: title })}
          selected={selected}
          lift={lift}
          animation={animation}
          onSelect={onSelect}
          onTap={onTap}
          onDrop={onPlace}
          onReturn={onReturn}
          onHoldChange={setHeld}
        />

        <div className="action-bar tn-actions">
          <button
            type="button"
            className="action-btn"
            onClick={onRotate}
            disabled={finished || busy || !selectedMovable}
          >
            <span className="action-icon" aria-hidden="true">
              <RotateGlyph />
            </span>
            {t('tangramRotate')}
          </button>
          <button
            type="button"
            className="action-btn"
            onClick={onFlip}
            disabled={
              finished || busy || !selectedMovable || selected === null || !canFlip(selected)
            }
          >
            <span className="action-icon" aria-hidden="true">
              <FlipGlyph />
            </span>
            {t('tangramFlip')}
          </button>
          <button
            type="button"
            className="action-btn"
            onClick={onUndo}
            disabled={busy || !canUndo(session)}
          >
            <span className="action-icon" aria-hidden="true">
              <IconUndo />
            </span>
            {t('undo')}
          </button>
        </div>

        {/* For a screen reader (§10): while a piece is lifted, whether it fits
            where it is drawn and what it touches — never where, never why not. */}
        <p className="visually-hidden" aria-live="polite">
          {spokenText}
        </p>

        <BannerSlot />
      </div>

      <TangramResultOverlay
        session={session}
        lastResult={lastResult}
        onRetry={onRetry}
        onNextFigure={onNextFigure}
        onHome={goHome}
      />

      <RestartDialog
        open={confirmRestart}
        onClose={() => setConfirmRestart(false)}
        onRetry={onRetry}
      />
    </div>
  );
}
