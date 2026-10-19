/**
 * The Peg Solitaire game screen (docs/PEG_SOLITAIRE_RULES.md §4, §5, §6).
 *
 * The board, one status line under it, and Undo. No clock and no move count
 * on screen (§5): the pegs left is the only number, and it is the board's own.
 * There is no Hint, by design (§6) — the whole board is visible, and the
 * dots are the rules drawn, not a suggestion: every peg the player picks up
 * shows where it can land, never which jump is wise.
 *
 * Picking a peg up is this screen's own state, not the game's: it is not
 * saved, it does not count, and it is dropped whenever the board changes
 * under it. Nothing moves on its own — a peg with a single jump still waits
 * for the tap that sends it (§4).
 *
 * The keyboard focus is put back on the board's tab stop whenever the
 * control that had it went away — the home's board button that opened this
 * screen, a button on the result card or in the ↻ dialog, an Undo button that
 * turned itself off — so a keyboard or screen-reader player keeps their place
 * (§4). It is only ever put back from nowhere (the page's body), never taken
 * from wherever it still is, and the page is not scrolled for it.
 *
 * Two rules the frame keeps (docs/ARCHITECTURE.md「シェルの枠とゲームの中身」):
 * while the result card or the ↻ dialog is up, `.game-content` is `inert` and
 * the keyboard is detached (src/test/modalIsolationWiring.test.ts); and the ↻
 * offers exactly what the result card offers — the same board again, and on
 * Triangle a new one (src/test/restartDialogWiring.test.ts).
 */
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { RestartDialog } from '@/ui/components/RestartDialog';
import { IconBack, IconRetry, IconUndo } from '@/ui/components/icons';
import { useReducedMotion } from '@/ui/useReducedMotion';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import { canUndo, geometryOf, jumpBetween, jumpsFrom, pegCount, type Jump } from '../../game';
import { usePegSolitaire } from '../../state/GameContext';
import { PegBoard } from '../components/PegBoard';
import { PegResultOverlay } from '../components/PegResultOverlay';
import { isArrowKey } from '../layout';

const NO_LANDINGS: readonly number[] = [];

export function PegSolitaireGameScreen() {
  const { session, lastResult, jump, applyUndo, goHome, restartCurrent, startNewBoard } =
    usePegSolitaire();
  const { t } = useSettings();
  const reducedMotion = useReducedMotion();
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [arriving, setArriving] = useState<{ jump: Jump; key: number } | null>(null);
  const arrivalCount = useRef(0);
  const boardElement = useRef<HTMLDivElement | null>(null);
  /**
   * One per game on screen: a new game (↻, the result card) draws a new
   * board, so the keyboard's place starts again at the ringed hole (§4)
   * rather than wherever it was in the last game.
   */
  const [round, setRound] = useState(0);
  /** Set when the focus may have just lost its element (see the header). */
  const refocus = useRef(true);

  // After the render that took the focused control away. Runs after every
  // render, but renders come only from the player's own taps and keys. A
  // layout effect, so that after a ↻ answer the board has the focus before
  // the dialog's own focus return runs (ui/useDialogDismiss.ts, as the dialog
  // unmounts): that return sees a focus put somewhere on purpose and leaves
  // it, rather than taking it back to the ↻ (2026-10-18). Cancel and Escape
  // set nothing here, so they are the dialog's alone — back to the ↻.
  useLayoutEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    const active = document.activeElement;
    if (active !== null && active !== document.body && active.isConnected) return;
    boardElement.current
      ?.querySelector<HTMLButtonElement>('button[tabindex="0"]')
      ?.focus({ preventScroll: true });
  });

  const setBoardElement = useCallback((element: HTMLDivElement | null) => {
    boardElement.current = element;
  }, []);

  // Read against the board as it is now: a peg that has jumped, been undone
  // or been replaced by a new game is no longer picked up.
  const selected =
    session !== null &&
    session.status === 'playing' &&
    picked !== null &&
    session.pegs[picked] === true
      ? picked
      : null;
  const kind = session?.problem.kind ?? null;
  const pegs = session?.pegs ?? null;
  const landings = useMemo(
    () =>
      kind !== null && pegs !== null && selected !== null
        ? jumpsFrom(geometryOf(kind), pegs, selected).map((j) => j.to)
        : NO_LANDINGS,
    [kind, pegs, selected],
  );

  /** One jump, from any door — a tap, a key, a drop — and what it sounds like (§13). */
  const play = useCallback(
    (from: number, to: number, travel: boolean): boolean => {
      if (!session) return false;
      const made = jumpBetween(geometryOf(session.problem.kind), from, to);
      const result = jump(from, to);
      if (!result || !made) return false;
      setPicked(null);
      // A tap or a key sends the peg across the board; a dropped peg is
      // already where it lands. Reduced Motion draws the new board at once.
      if (travel && !reducedMotion) {
        arrivalCount.current += 1;
        setArriving({ jump: made, key: arrivalCount.current });
      } else {
        setArriving(null);
      }
      sounds.select();
      void haptics.tap();
      if (result.outcome?.kind === 'perfect') {
        sounds.clear();
        void haptics.clear();
      } else if (result.outcome) {
        // One peg elsewhere, or several stuck: stated, never scolded (§3).
        sounds.gameOver();
      }
      return true;
    },
    [jump, reducedMotion, session],
  );

  /** The tap path (§4): pick up, put down, or jump to a dotted hole. */
  const onHoleTap = useCallback(
    (index: number) => {
      if (!session || session.status !== 'playing') return;
      if (session.pegs[index]) {
        setPicked(selected === index ? null : index);
        return;
      }
      if (selected !== null && landings.includes(index)) {
        play(selected, index, true);
        return;
      }
      // An empty hole with no dot: the peg is put down, and nothing else.
      setPicked(null);
    },
    [landings, play, selected, session],
  );

  const onDragStart = useCallback((from: number) => setPicked(from), []);

  /** A drop over a hole: a jump if the rules allow it, else the peg goes home. */
  const onDrop = useCallback(
    (from: number, to: number) => {
      play(from, to, false);
    },
    [play],
  );

  const onUndo = useCallback(() => {
    if (!applyUndo()) return;
    sounds.undo();
    setPicked(null);
    setArriving(null);
    refocus.current = true;
  }, [applyUndo]);

  const onRetry = useCallback(() => {
    setPicked(null);
    setArriving(null);
    setRound((r) => r + 1);
    refocus.current = true;
    restartCurrent();
  }, [restartCurrent]);

  const onNewBoard = useCallback(() => {
    setPicked(null);
    setArriving(null);
    setRound((r) => r + 1);
    refocus.current = true;
    startNewBoard();
  }, [startNewBoard]);

  /* Keyboard as an adapter over the taps above (issue #93). While a hole has
     the focus, the board answers the arrows itself (roving focus, PegBoard)
     and Enter / Space press the hole like a tap; from anywhere else on the
     screen, the first arrow brings the focus onto the board. Escape puts a
     picked-up peg down, Ctrl/Cmd+Z undoes. Nothing answers a key repeat, and
     nothing answers at all while the result card or the ↻ dialog is up. */
  const onKey = (event: KeyboardEvent): boolean => {
    if (session === null) return false;
    if (isUndoKey(event)) {
      if (!event.repeat && canUndo(session)) onUndo();
      return true;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    if (event.key === 'Escape') {
      if (selected === null) return false;
      setPicked(null);
      return true;
    }
    if (isArrowKey(event.key)) {
      boardElement.current?.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus();
      return true;
    }
    return false;
  };
  useGameKeys(onKey, session !== null && session.status === 'playing' && !confirmRestart);

  if (!session || kind === null) return null;

  const over = session.status === 'over';
  const triangle = kind === 'triangle';
  const status =
    selected !== null && landings.length === 0
      ? t('pegSolitaireNoJump')
      : t('pegSolitairePegsLeft', { count: pegCount(session.pegs) });

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={over || confirmRestart}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <span className="game-mode">{t(`pegSolitaireBoard_${kind}`)}</span>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('tryAgain')}
            onClick={() => setConfirmRestart(true)}
          >
            <IconRetry />
          </button>
        </header>

        <div className="pg-body">
          <PegBoard
            key={`${kind}-${round}`}
            session={session}
            selected={selected}
            landings={landings}
            arriving={arriving}
            onHoleTap={onHoleTap}
            onDragStart={onDragStart}
            onDrop={onDrop}
            boardRef={setBoardElement}
          />
          {/* One line, always there, so the board never jumps (§5). */}
          <p className="pg-status" role="status">
            {status}
          </p>
        </div>

        <div className="action-bar pg-actions">
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
        </div>

        <BannerSlot />
      </div>

      <PegResultOverlay
        session={session}
        lastResult={lastResult}
        onUndo={onUndo}
        onRetry={onRetry}
        onNewBoard={triangle ? onNewBoard : undefined}
        onHome={goHome}
      />

      <RestartDialog
        open={confirmRestart}
        onClose={() => setConfirmRestart(false)}
        onRetry={onRetry}
        newBoard={triangle ? { label: t('pegSolitaireNewBoard'), start: onNewBoard } : undefined}
      />
    </div>
  );
}
