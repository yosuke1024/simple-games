/**
 * The Unblock Puzzle game screen (docs/UNBLOCK_PUZZLE_RULES.md §4–§6, §10, §14).
 *
 * The moves are on screen — the puzzle's own measure, next to the board's
 * fewest — and the clock is not, at all (§10): elapsed time exists only on the
 * result card and in the statistics.
 *
 * Every way to move reaches the same two calls, `slide` and `applyUndo`
 * (§5): a drag or a tap-then-tap on the board (components/UnblockBoard.tsx),
 * the arrow buttons under it for the selected block, and the keyboard —
 * an adapter over the very handlers the buttons call, so nothing is reachable
 * by key that is not on the screen (docs/RELEASE_CHECKLIST.md §5.13):
 *
 * - Tab reaches each block; Enter / Space selects or lets go (the button's
 *   own click); an arrow along a block's lane moves the focused block — or,
 *   with focus elsewhere, the selected one — one cell, and an arrow across
 *   its lane does nothing; Esc lets go. A held key's repeats move nothing.
 * - Ctrl/Cmd+Z is Undo and H is the Hint, like the two buttons.
 *
 * While anything modal is up — the result card, the ↻ question — the board
 * behind it is `inert` and the keys are off (src/test/modalIsolationWiring.test.ts).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { RestartDialog } from '@/ui/components/RestartDialog';
import { IconBack, IconHint, IconRetry, IconUndo } from '@/ui/components/icons';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import { TARGET_INDEX, canUndo, moveCount, slideRange, type Board, type Hint } from '../../game';
import { useUnblockPuzzle } from '../../state/GameContext';
import { UnblockBoard, blockLabel, type BoardHint } from '../components/UnblockBoard';
import { UnblockPuzzleResultOverlay } from '../components/UnblockPuzzleResultOverlay';

type Translate = ReturnType<typeof useSettings>['t'];

/** Arrow keys as a step along a lane: which orientation they move, and which way. */
const ARROWS: Readonly<Record<string, { orientation: 'h' | 'v'; step: -1 | 1 }>> = {
  ArrowLeft: { orientation: 'h', step: -1 },
  ArrowRight: { orientation: 'h', step: 1 },
  ArrowUp: { orientation: 'v', step: -1 },
  ArrowDown: { orientation: 'v', step: 1 },
};

/** The Hint read aloud and shown (§6): which block, from where, to where — never a guess. */
function hintMessage(t: Translate, board: Board, hint: BoardHint): string {
  const block = board.blocks[hint.block]!;
  const position = board.positions[hint.block]!;
  const toFrom = hint.to + 1;
  const toTo = hint.to + block.length;
  if (hint.block === TARGET_INDEX) return t('unblockPuzzleHintTarget', { toFrom, toTo });
  const from = position + 1;
  const to = position + block.length;
  return block.orientation === 'h'
    ? t('unblockPuzzleHintH', { row: block.lane + 1, from, to, toFrom, toTo })
    : t('unblockPuzzleHintV', { col: block.lane + 1, from, to, toFrom, toTo });
}

/** The block a keyboard user is on, if focus is on one of the board's blocks. */
function focusedBlock(): number | null {
  if (typeof document === 'undefined') return null;
  const active = document.activeElement as HTMLElement | null;
  const value = active?.dataset?.block;
  if (value === undefined) return null;
  const index = Number(value);
  return Number.isInteger(index) ? index : null;
}

function ArrowGlyph({ direction }: { direction: 'left' | 'right' | 'up' | 'down' }) {
  const rotation = { right: 0, down: 90, left: 180, up: 270 }[direction];
  return (
    <svg
      className="ub-arrow-glyph"
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function UnblockPuzzleGameScreen() {
  const {
    session,
    lastResult,
    sessionEpoch,
    slide,
    applyUndo,
    takeHint,
    goHome,
    restartCurrent,
    startNewBoard,
  } = useUnblockPuzzle();
  const { t } = useSettings();

  const [selected, setSelected] = useState<number | null>(null);
  /**
   * The Hint on screen, with the board it was found on. It only ever shows on
   * that board: a slide, an Undo or a new board makes a new board object, and
   * the effect below clears the Hint — but the render that brings a new board
   * comes first, and a Hint read against a board it was not found on can name
   * a block that board does not have (found while measuring §8: a Hint shown,
   * then a new board with fewer blocks).
   */
  const [hintState, setHintState] = useState<{ board: Board; shown: BoardHint } | null>(null);
  const hint = session !== null && hintState?.board === session.board ? hintState.shown : null;
  const showHint = useCallback(
    (shown: BoardHint) => {
      if (session !== null) setHintState({ board: session.board, shown });
    },
    [session],
  );
  /**
   * What the line between the arrow buttons says about the Hint: that a move
   * is marked on the board, or that none was found. It stays until the next
   * move — there is no timer to wait out or to clean up.
   */
  const [note, setNote] = useState<'hint' | 'none' | null>(null);
  /**
   * What the live region below reads out (§14): the block a move just moved
   * — where it is now, and how far it can still go — or the Hint in words.
   * `turn` tells a repeat of the same words apart: a live region reads a
   * change, and the same text set again is no change, so every other repeat
   * carries a trailing no-break space that no screen reader voices.
   */
  const [spoken, setSpoken] = useState<{ block: number } | { text: string; turn: number } | null>(
    null,
  );
  const [confirmRestart, setConfirmRestart] = useState(false);

  // A board coming on screen is a clean slate: nothing selected, no hint.
  useEffect(() => {
    setSelected(null);
    setHintState(null);
    setNote(null);
    setSpoken(null);
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

  const onSlide = useCallback(
    (block: number, to: number): boolean => {
      if (!slide(block, to)) return false;
      setHintState(null);
      setNote(null);
      setSpoken({ block });
      sounds.select();
      void haptics.tap();
      return true;
    },
    [slide],
  );

  const onSelect = useCallback((block: number | null) => {
    setSelected(block);
  }, []);

  /** One cell along the block's lane, if its lane runs that way and the cell is free. */
  const stepBlock = useCallback(
    (block: number, orientation: 'h' | 'v', step: -1 | 1): boolean => {
      if (session === null || session.status !== 'playing') return false;
      const shape = session.board.blocks[block];
      if (shape === undefined || shape.orientation !== orientation) return false;
      const position = session.board.positions[block]!;
      const range = slideRange(session.board, block);
      const to = position + step;
      if (to < range.min || to > range.max) return false;
      return onSlide(block, to);
    },
    [onSlide, session],
  );

  const onUndo = useCallback(() => {
    const last = session?.moves[session.moves.length - 1];
    if (!applyUndo()) return;
    setHintState(null);
    setNote(null);
    setSpoken(last === undefined ? null : { block: last.block });
    sounds.undo();
  }, [applyUndo, session]);

  /** Says `text`, even when it is what the live region already says. */
  const speak = useCallback((text: string) => {
    setSpoken((current) =>
      current !== null && 'text' in current && current.text === text
        ? { text, turn: current.turn + 1 }
        : { text, turn: 0 },
    );
  }, []);

  /** The hint points; it never moves anything for the player (§6). */
  const onHint = useCallback(() => {
    if (session === null) return;
    // Asked again with the answer still on screen: nothing has moved since
    // (every slide, Undo and new board clears it), so a search would give the
    // same answer. It is said again, and neither searched nor counted (§6).
    if (hint !== null) {
      speak(hintMessage(t, session.board, hint));
      return;
    }
    if (note === 'none') {
      speak(t('unblockPuzzleHintNone'));
      return;
    }
    const next: Hint | null = takeHint();
    if (next === null) return;
    if (next.kind !== 'move') {
      // Capped, unsolvable or invalid: say so, and show no move (§6).
      setHintState(null);
      setNote('none');
      speak(t('unblockPuzzleHintNone'));
      return;
    }
    const shown = { block: next.block, to: next.to };
    showHint(shown);
    setNote('hint');
    speak(hintMessage(t, session.board, shown));
    sounds.select();
  }, [hint, note, session, showHint, speak, t, takeHint]);

  /* Keyboard as an adapter over the handlers above (issue #93, §5). One-shot
     actions all: key repeat moves nothing, undoes nothing, asks nothing. */
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
    if (event.key === 'Escape') {
      if (selected === null) return false;
      setSelected(null);
      return true;
    }
    const arrow = ARROWS[event.key];
    if (arrow === undefined) return false;
    const block = focusedBlock() ?? selected;
    if (block === null) return false;
    // Swallowed either way, so the page does not scroll under the board.
    if (event.repeat) return true;
    if (session.board.blocks[block]?.orientation === arrow.orientation) {
      setSelected(block);
      stepBlock(block, arrow.orientation, arrow.step);
    }
    return true;
  };
  useGameKeys(onKey, session !== null && session.status === 'playing' && !confirmRestart);

  if (!session) return null;

  const finished = session.status !== 'playing';
  const selectedShape = selected === null ? null : (session.board.blocks[selected] ?? null);
  const vertical = selectedShape?.orientation === 'v';
  const selectedRange =
    selected === null || selectedShape === null ? null : slideRange(session.board, selected);
  const selectedPosition = selected === null ? 0 : (session.board.positions[selected] ?? 0);
  const canBack = selectedRange !== null && !finished && selectedRange.min < selectedPosition;
  const canForward = selectedRange !== null && !finished && selectedRange.max > selectedPosition;
  const orientation = vertical ? 'v' : 'h';
  const prompt =
    finished || (note === null && selected !== null)
      ? ''
      : note === 'hint'
        ? t('unblockPuzzleHintShown')
        : note === 'none'
          ? t('unblockPuzzleHintNone')
          : t('unblockPuzzleSelectPrompt');
  const spokenText =
    spoken === null
      ? ''
      : 'text' in spoken
        ? spoken.turn % 2 === 1
          ? `${spoken.text}\u00a0`
          : spoken.text
        : spoken.block < session.board.blocks.length
          ? blockLabel(t, session.board, spoken.block)
          : '';

  return (
    <div className="screen game-screen ub-screen">
      <div className="game-content" inert={finished || confirmRestart}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="game-status ub-status">
            <span className="game-mode">
              {session.mode === 'daily'
                ? t('modeDaily')
                : t(`unblockPuzzleDifficulty_${session.difficulty}`)}
            </span>
            <span className="ub-moves">
              {t('unblockPuzzleMovesStatus', {
                moves: moveCount(session),
                min: session.minMoves,
              })}
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

        <div className="ub-play">
          <div className="ub-board-area">
            <UnblockBoard
              board={session.board}
              solved={finished}
              selected={finished ? null : selected}
              hint={finished ? null : hint}
              onSelect={onSelect}
              onSlide={onSlide}
            />
          </div>

          <div className="ub-controls">
            <div className="ub-move-row">
              <button
                type="button"
                className="ub-move-btn"
                aria-label={t(vertical ? 'unblockPuzzleMoveUp' : 'unblockPuzzleMoveLeft')}
                disabled={!canBack}
                onClick={() => {
                  if (selected !== null) stepBlock(selected, orientation, -1);
                }}
              >
                <ArrowGlyph direction={vertical ? 'up' : 'left'} />
              </button>
              <span className={`ub-move-prompt${note === 'hint' ? ' ub-move-prompt-hint' : ''}`}>
                {prompt}
              </span>
              <button
                type="button"
                className="ub-move-btn"
                aria-label={t(vertical ? 'unblockPuzzleMoveDown' : 'unblockPuzzleMoveRight')}
                disabled={!canForward}
                onClick={() => {
                  if (selected !== null) stepBlock(selected, orientation, 1);
                }}
              >
                <ArrowGlyph direction={vertical ? 'down' : 'right'} />
              </button>
            </div>

            <div className="action-bar ub-action-bar">
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
          </div>
        </div>

        {/* For a screen reader (§14): where the block just moved now is and how
            far it can still go, or the Hint in words — which block, from where,
            to where. The board shows the same with marks. */}
        <p className="visually-hidden" aria-live="polite">
          {spokenText}
        </p>

        <BannerSlot />
      </div>

      <UnblockPuzzleResultOverlay
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
          session.mode === 'free'
            ? { label: t('unblockPuzzleNewBoard'), start: () => startNewBoard(session.difficulty) }
            : undefined
        }
      />
    </div>
  );
}
