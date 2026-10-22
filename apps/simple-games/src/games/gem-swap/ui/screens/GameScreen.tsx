/**
 * The Gem Swap game screen (docs/GEM_SWAP_RULES.md §3, §9, §10).
 *
 * From the top: the top bar (Back, the gem count, ↻), the score and the bar
 * of swaps left, the board, Undo. No clock, no cascade count, no praise: the
 * score is the only number on screen, and it is the board's own (§9).
 *
 * Selecting a gem is this screen's own state, not the game's: it is not
 * saved, it does not count, and it is dropped whenever the board changes. An
 * invalid swap changes nothing at all — the gems stay, no sound plays and
 * the selection stays where it was (§3); only a screen reader hears that the
 * two cannot be swapped.
 *
 * A valid swap is resolved whole by the provider before anything is drawn;
 * what follows here is a replay of a move that has already happened (§10):
 * the exchange and then every cascade stage, one beat each, squeezed so a
 * move stays within about a second (`playbackIntervalMs`), skipped entirely
 * under Reduced Motion or for a move too long to squeeze. One timer at a
 * time, owned by one effect: a tap or key on the board skips to the final
 * board, and so do the ↻ dialog, Undo and the page going to the background —
 * and nothing ever resumes a replay that was stopped (there is nothing to
 * resume; the state is already final). Unmounting clears the timer with the
 * effect (docs/GAME_LIFECYCLE.md).
 *
 * The keyboard focus is put back on the board's tab stop whenever the
 * control that had it went away (a result-card or dialog button, the home's
 * button that opened this screen, an Undo that turned itself off), only
 * ever from nowhere and without scrolling the page.
 *
 * Two rules the frame keeps (docs/ARCHITECTURE.md「シェルの枠とゲームの中身」):
 * while the round is over or the ↻ dialog is up, `.game-content` is `inert`
 * and the keyboard is detached (src/test/modalIsolationWiring.test.ts); and
 * the ↻ offers exactly what the result card offers — a new board and the
 * same board again (src/test/restartDialogWiring.test.ts).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { RestartDialog } from '@/ui/components/RestartDialog';
import { IconBack, IconRetry, IconUndo } from '@/ui/components/icons';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import { useReducedMotion } from '@/ui/useReducedMotion';
import { canUndo, isAdjacent, playbackIntervalMs, swapsLeft } from '../../game';
import { useGemSwap } from '../../state/GameContext';
import { GemBoard, type BoardFrame } from '../components/GemBoard';
import { GemSwapResultOverlay } from '../components/ResultOverlay';
import { SwapsBar } from '../components/SwapsBar';
import { replayFrames, type ReplayFrame } from '../replay';

interface Replay {
  readonly frames: readonly ReplayFrame[];
  readonly beatMs: number;
  readonly index: number;
  /** Unique per beat across the screen's life, so each beat's motion plays afresh. */
  readonly key: number;
}

const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export function GemSwapGameScreen() {
  const { session, lastResult, swap, undo, goHome, startNewRound, retrySameBoard } = useGemSwap();
  const { t } = useSettings();
  const reducedMotion = useReducedMotion();
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const replayRef = useRef(replay);
  replayRef.current = replay;
  const beatCount = useRef(0);
  const announceCount = useRef(0);
  const boardElement = useRef<HTMLDivElement | null>(null);
  /** Set when the focus may have just lost its element (see the header). */
  const refocus = useRef(true);

  // After the render that took the focused control away. A layout effect, so
  // that after a ↻ answer the board has the focus before the dialog's own
  // focus return runs (ui/useDialogDismiss.ts): that return sees a focus put
  // somewhere on purpose and leaves it. Cancel and Escape set nothing here,
  // so they are the dialog's alone — back to the ↻.
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

  /** Says one line to a screen reader, again even when it is the same line. */
  const announce = useCallback((text: string) => {
    announceCount.current += 1;
    // A live region does not repeat an unchanged text; a trailing no-break
    // space on every other line makes the second "cannot swap" a new one.
    setAnnouncement(announceCount.current % 2 === 0 ? `${text}\u00a0` : text);
  }, []);

  // The replay's one timer (§10). Each landing moves to the next beat and
  // plays that beat's clear; after the last beat the board is simply the
  // round's own. The page going to the background ends the replay on the
  // final board — coming back resumes nothing.
  useEffect(() => {
    if (replay === null) return undefined;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') setReplay(null);
    };
    document.addEventListener('visibilitychange', onVisibility);
    const id = window.setTimeout(() => {
      const current = replayRef.current;
      if (current === null) return;
      const index = current.index + 1;
      if (index >= current.frames.length) {
        setReplay(null);
        return;
      }
      // One `match()` per stage, all at the same pitch (§10).
      if (current.frames[index]!.clearing.length > 0) sounds.match();
      beatCount.current += 1;
      setReplay({ ...current, index, key: beatCount.current });
    }, replay.beatMs);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [replay]);

  const skip = useCallback(() => setReplay(null), []);

  /** One swap, from any door — a tap, a swipe, a key — and what it looks and sounds like. */
  const play = useCallback(
    (a: number, b: number): boolean => {
      const outcome = swap(a, b);
      if (outcome === null) {
        // Nothing moves and nothing sounds; the selection stays (§3).
        announce(t('gemSwapLiveInvalid'));
        return false;
      }
      setSelected(null);
      announce(t('gemSwapLiveMove', { count: outcome.move.score, left: swapsLeft(outcome.round) }));
      // The first stage's clear is heard with the exchange; the rest with
      // their beats. Without a replay the move is heard once (§10).
      sounds.match();
      const beatMs = playbackIntervalMs(outcome.move.stages.length);
      if (reducedMotion || beatMs === null) {
        setReplay(null);
      } else {
        beatCount.current += 1;
        setReplay({
          frames: replayFrames(outcome.move, a, b),
          beatMs,
          index: 0,
          key: beatCount.current,
        });
      }
      return true;
    },
    [announce, reducedMotion, swap, t],
  );

  /** The tap path (§3): select, deselect, reselect, or try the swap with the neighbour. */
  const onTap = useCallback(
    (cell: number) => {
      if (selected === cell) {
        setSelected(null);
        return;
      }
      if (selected !== null && isAdjacent(selected, cell)) {
        play(selected, cell);
        return;
      }
      setSelected(cell);
      sounds.select();
    },
    [play, selected],
  );

  const onSwipe = useCallback(
    (from: number, to: number) => {
      play(from, to);
    },
    [play],
  );

  const left = session ? swapsLeft(session.round) : 0;

  const onUndo = useCallback(() => {
    setReplay(null);
    if (!undo()) return;
    sounds.undo();
    setSelected(null);
    // One swap is back: the bar has one more segment than a moment ago.
    announce(t('gemSwapLiveUndo', { left: left + 1 }));
    refocus.current = true;
  }, [announce, left, t, undo]);

  const restartWith = useCallback((start: () => void) => {
    setReplay(null);
    setSelected(null);
    refocus.current = true;
    start();
  }, []);
  const onRetry = useCallback(() => restartWith(retrySameBoard), [restartWith, retrySameBoard]);
  const onNewBoard = useCallback(() => restartWith(startNewRound), [restartWith, startNewRound]);

  const openRestart = useCallback(() => {
    setReplay(null);
    setConfirmRestart(true);
  }, []);

  /* Keyboard as an adapter over the taps above (issue #93). While a cell has
     the focus, the board answers the arrows and Enter / Space itself
     (GemBoard). From anywhere else on the screen the first arrow brings the
     focus onto the board. Escape lets go of a selected gem, Ctrl/Cmd+Z
     undoes. Nothing answers at all while the round is over or the ↻ dialog
     is up — the dialog's own Escape is Cancel. */
  const onKey = (event: KeyboardEvent): boolean => {
    if (session === null) return false;
    if (isUndoKey(event)) {
      if (!event.repeat) onUndo();
      return true;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    if (event.key === 'Escape') {
      if (replayRef.current !== null) {
        skip();
        return true;
      }
      if (selected === null) return false;
      setSelected(null);
      return true;
    }
    if (ARROW_KEYS.has(event.key)) {
      boardElement.current?.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus();
      return true;
    }
    return false;
  };
  useGameKeys(onKey, session !== null && session.round.status === 'playing' && !confirmRestart);

  if (!session) return null;

  const { round } = session;
  const over = round.status === 'over';
  const frame = replay ? replay.frames[replay.index]! : null;
  const boardFrame: BoardFrame | null =
    replay && frame
      ? { key: replay.key, beatMs: replay.beatMs, clearing: frame.clearing, motion: frame.motion }
      : null;
  // Read against the board as it is now: a selection survives only an
  // invalid swap.
  const shownSelection = over ? null : selected;

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={over || confirmRestart}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <span className="game-mode">{t('gemSwapKindsCount', { count: round.colors })}</span>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('tryAgain')}
            onClick={openRestart}
          >
            <IconRetry />
          </button>
        </header>

        <div className="gs-body">
          <div className="gs-status">
            <p className="gs-score">
              <span className="gs-score-label">{t('score')}</span>{' '}
              <span className="gs-score-value">{round.score}</span>
            </p>
            <SwapsBar left={left} />
          </div>
          <GemBoard
            board={frame ? frame.board : round.board}
            frame={boardFrame}
            selected={shownSelection}
            interactive={!over}
            onTap={onTap}
            onSwipe={onSwipe}
            onSwapToward={play}
            onSkip={skip}
            boardRef={setBoardElement}
          />
          <p className="visually-hidden" role="status" aria-live="polite">
            {announcement}
          </p>
        </div>

        <div className="action-bar gs-actions">
          <button type="button" className="action-btn" onClick={onUndo} disabled={!canUndo(round)}>
            <span className="action-icon" aria-hidden="true">
              <IconUndo />
            </span>
            {t('undo')}
          </button>
        </div>

        <BannerSlot />
      </div>

      <GemSwapResultOverlay
        result={replay === null ? lastResult : null}
        onNewBoard={onNewBoard}
        onRetry={onRetry}
        onHome={goHome}
      />

      <RestartDialog
        open={confirmRestart}
        onClose={() => setConfirmRestart(false)}
        onRetry={onRetry}
        newBoard={{ label: t('gemSwapNewBoard'), start: onNewBoard }}
      />
    </div>
  );
}
