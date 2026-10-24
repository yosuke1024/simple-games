/**
 * The Make the Target game screen (docs/MAKE_THE_TARGET_RULES.md §1–§5, §12).
 *
 * The target, the tiles, the four operators — or, once the last tile is not
 * the target, the `missed` panel in their place, at the same fixed height so
 * nothing above or below it moves (§4) — the moves so far, one line each, and
 * Undo. No clock and no move count on screen (§9), and no Hint, by design
 * (§5): the whole board is visible, and nothing here says what to combine
 * next or whether the target can still be made.
 *
 * Every way to play reaches the same calls: a tap on a tile or an operator,
 * and the keyboard — an adapter over the very handlers the buttons call, so
 * nothing is reachable by key that is not on the screen (§3,
 * docs/RELEASE_CHECKLIST.md §5.13). The board's tab stop answers the arrows
 * and Home / End itself (components/MakeTheTargetBoard.tsx) and Enter / Space
 * press a tile; from anywhere, `+` `-` `*` (or `x`) `/` choose an operator,
 * Ctrl/Cmd+Z is Undo and Escape clears the choice; with the focus off the
 * board, the first arrow only brings it to the first number. A held key's
 * repeats press nothing — not a tile, an operator, Undo, nor a button on the
 * panel or the result card.
 *
 * A merge the rules refuse changes nothing and says nothing (§3): no sound,
 * no message — the tile and the operator stay chosen.
 *
 * The focus is put back where a keyboard player can carry on whenever the
 * control that had it went away — the home's button that opened this screen,
 * a tile a merge used up, the panel's Undo — and only from nowhere (the
 * page's body): it is never taken from wherever it still is. The `missed`
 * panel takes the focus on its first offer, Undo (§4).
 *
 * While the result card, the ↻ question or the "Show a solution?" question is
 * up, `.game-content` is `inert` and the keys are off
 * (src/test/modalIsolationWiring.test.ts); the ↻ offers what the result card
 * offers (src/test/restartDialogWiring.test.ts).
 */
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { RestartDialog } from '@/ui/components/RestartDialog';
import { IconBack, IconRetry, IconUndo } from '@/ui/components/icons';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import {
  canReveal,
  canUndo,
  expressionLines,
  lastNumber,
  OPERATOR_SYMBOLS,
  OPERATORS,
  replay,
  type Operator,
} from '../../game';
import { useMakeTheTarget, type SessionChange } from '../../state/GameContext';
import { isSuspendable } from '../../storage/gamePersistence';
import { ExpressionList } from '../components/ExpressionList';
import { MakeTheTargetBoard, type Arrival } from '../components/MakeTheTargetBoard';
import { MakeTheTargetResultOverlay } from '../components/ResultOverlay';
import { TargetMark } from '../components/TargetMark';
import { operatorLabel, spokenLine } from '../spoken';

/** The keys that choose an operator (§3), read from `event.key` so the keypad's count too. */
const OPERATOR_KEYS: Readonly<Record<string, Operator>> = {
  '+': '+',
  '-': '-',
  '*': '*',
  x: '*',
  X: '*',
  '/': '/',
};

const NAV_KEYS = new Set(['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'Home', 'End']);

/**
 * A held Enter or Space presses a button once, not once per repeat (§3): the
 * tiles, the operators, Undo and the panel's buttons are buttons, whose own
 * click a held Enter would otherwise fire again on every repeat.
 */
function swallowRepeatedPress(event: ReactKeyboardEvent<HTMLDivElement>) {
  if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
}

export function MakeTheTargetGameScreen() {
  const {
    session,
    lastResult,
    sessionEpoch,
    pressTile,
    pressOperator,
    clearChoice,
    applyUndo,
    revealCurrent,
    goHome,
    restartCurrent,
    startNewBoard,
  } = useMakeTheTarget();
  const { t } = useSettings();
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [confirmReveal, setConfirmReveal] = useState(false);
  /** The last merge's arrival, for the board's short slide; cleared by anything else. */
  const [arrival, setArrival] = useState<Arrival | null>(null);
  const arrivals = useRef(0);
  /**
   * What the live region reads (§12): the move just made, the move taken
   * back, the `missed` sentence. `turn` tells a repeat of the same words
   * apart — a live region reads a change, so every other repeat carries a
   * trailing no-break space no screen reader voices.
   */
  const [spoken, setSpoken] = useState<{ text: string; turn: number } | null>(null);
  const boardElement = useRef<HTMLDivElement | null>(null);
  const missedUndo = useRef<HTMLButtonElement | null>(null);
  /** The epoch the screen-local state above belongs to; a new problem starts clean. */
  const [epoch, setEpoch] = useState(sessionEpoch);
  if (epoch !== sessionEpoch) {
    setEpoch(sessionEpoch);
    setArrival(null);
    setSpoken(null);
  }

  const status = session?.status ?? null;
  const moveCount = session?.moves.length ?? 0;

  // After the render that took the focused control away (see the header):
  // the `missed` panel's Undo while it is up, the board's tab stop otherwise.
  // A layout effect, so that after a ↻ answer the board has the focus before
  // the dialog's own focus return runs (ui/useDialogDismiss.ts): that return
  // then sees a focus put somewhere on purpose and leaves it.
  useLayoutEffect(() => {
    if (status === 'missed') {
      missedUndo.current?.focus({ preventScroll: true });
      return;
    }
    const active = document.activeElement;
    if (active !== null && active !== document.body && active.isConnected) return;
    boardElement.current
      ?.querySelector<HTMLButtonElement>('button[tabindex="0"]:not(:disabled)')
      ?.focus({ preventScroll: true });
  }, [status, moveCount, sessionEpoch]);

  const setBoardElement = useCallback((element: HTMLDivElement | null) => {
    boardElement.current = element;
  }, []);

  /** Says `text`, even when it is what the live region already says. */
  const speak = useCallback((text: string) => {
    setSpoken((current) =>
      current !== null && current.text === text
        ? { text, turn: current.turn + 1 }
        : { text, turn: 0 },
    );
  }, []);

  /** What a tap did, heard and seen (§12): a merge's line, its arrival, its sound. */
  const afterTap = useCallback(
    (change: SessionChange | null) => {
      if (change === null) return; // refused or nothing to do: silent (§3)
      const { from, to } = change;
      if (to.moves.length === from.moves.length) {
        // A choice made or cleared.
        sounds.select();
        return;
      }
      const move = to.moves[to.moves.length - 1]!;
      arrivals.current += 1;
      setArrival({ slot: move.right, from: move.left, key: arrivals.current });
      const lines = expressionLines(to);
      const line = spokenLine(t, lines[lines.length - 1]!);
      if (to.status === 'missed') {
        // No sound: the board states a fact, it does not lose (§4).
        speak(
          t('makeTheTargetSpokenMissed', {
            line,
            value: lastNumber(to.slots) ?? 0,
            target: to.problem.target,
          }),
        );
      } else if (to.status === 'solved') {
        speak(line);
        sounds.clear();
      } else {
        speak(line);
        sounds.select();
      }
    },
    [speak, t],
  );

  const onTile = useCallback((slot: number) => afterTap(pressTile(slot)), [afterTap, pressTile]);
  const onOperator = useCallback(
    (op: Operator) => afterTap(pressOperator(op)),
    [afterTap, pressOperator],
  );

  const onUndo = useCallback(() => {
    const change = applyUndo();
    if (change === null) return;
    const before = replay(change.from.problem.numbers, change.from.moves)!.expressions;
    const taken = before[before.length - 1];
    setArrival(null);
    if (taken !== undefined) speak(t('makeTheTargetSpokenUndo', { line: spokenLine(t, taken) }));
    sounds.undo();
  }, [applyUndo, speak, t]);

  const onRetry = useCallback(() => {
    setArrival(null);
    restartCurrent();
  }, [restartCurrent]);

  const onNewBoard = useCallback(() => {
    if (session === null) return;
    setArrival(null);
    startNewBoard(session.difficulty);
  }, [session, startNewBoard]);

  /* Keyboard as an adapter over the taps above (§3). Nothing answers a key
     repeat, and nothing answers at all while a card or a question is up. */
  const onKey = (event: KeyboardEvent): boolean => {
    if (session === null) return false;
    if (isUndoKey(event)) {
      if (!event.repeat && canUndo(session)) onUndo();
      return true;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    const op = OPERATOR_KEYS[event.key];
    if (op !== undefined) {
      if (!event.repeat && session.status === 'playing') onOperator(op);
      return true;
    }
    if (event.key === 'Escape') return clearChoice();
    if (NAV_KEYS.has(event.key)) {
      // From outside the board (the board answers these itself and marks them
      // handled): the first press only brings the focus to the first number.
      const first = boardElement.current?.querySelector<HTMLButtonElement>(
        'button[data-slot]:not(:disabled)',
      );
      if (!first) return false;
      first.focus({ preventScroll: true });
      return true;
    }
    return false;
  };
  useGameKeys(
    onKey,
    session !== null && isSuspendable(session) && !confirmRestart && !confirmReveal,
  );

  if (!session) return null;

  const playing = session.status === 'playing';
  const missed = session.status === 'missed';
  const finished = session.status === 'solved' || session.status === 'revealed';
  const lines = expressionLines(session);
  const steps = session.problem.numbers.length - 1;
  const spokenText =
    spoken === null ? '' : spoken.turn % 2 === 1 ? `${spoken.text}\u00a0` : spoken.text;

  return (
    <div className="screen game-screen tg-screen">
      <div className="game-content" inert={finished || confirmRestart || confirmReveal}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <span className="game-mode">
            {session.mode === 'daily'
              ? t('modeDaily')
              : t(`makeTheTargetDifficulty_${session.difficulty}`)}
          </span>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('tryAgain')}
            onClick={() => setConfirmRestart(true)}
          >
            <IconRetry />
          </button>
        </header>

        <div className="tg-play" onKeyDownCapture={swallowRepeatedPress}>
          <div className={`tg-target${session.status === 'solved' ? ' tg-target-made' : ''}`}>
            <TargetMark />
            <span className="tg-target-value" aria-hidden="true">
              {session.problem.target}
            </span>
            <span className="visually-hidden">
              {t('makeTheTargetTargetSpoken', { target: session.problem.target })}
            </span>
          </div>

          <MakeTheTargetBoard
            slots={session.slots}
            selectedTile={playing ? session.selectedTile : null}
            locked={!playing}
            arrival={arrival}
            label={t('makeTheTargetNumbersLabel')}
            onTile={onTile}
            boardRef={setBoardElement}
          />

          {/* One fixed-height place: the operators, or the `missed` panel (§4). */}
          <div className="tg-ops-slot">
            {missed ? (
              <div className="tg-missed">
                <p className="tg-missed-text">
                  {t('makeTheTargetMissed', {
                    value: lastNumber(session.slots) ?? 0,
                    target: session.problem.target,
                  })}
                </p>
                <div className="tg-missed-actions">
                  <button
                    ref={missedUndo}
                    type="button"
                    className="btn btn-primary"
                    onClick={onUndo}
                  >
                    {t('undo')}
                  </button>
                  {canReveal(session) ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setConfirmReveal(true)}
                    >
                      {t('makeTheTargetShowSolution')}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="tg-ops" role="group" aria-label={t('makeTheTargetOperatorsLabel')}>
                {OPERATORS.map((op) => (
                  <button
                    key={op}
                    type="button"
                    className={`tg-op${session.selectedOperator === op ? ' tg-op-selected' : ''}`}
                    aria-label={operatorLabel(t, op)}
                    aria-pressed={playing && session.selectedOperator === op}
                    disabled={!playing || session.selectedTile === null}
                    onClick={() => onOperator(op)}
                  >
                    <span aria-hidden="true">{OPERATOR_SYMBOLS[op]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <ExpressionList
            lines={lines}
            label={t('makeTheTargetStepsLabel')}
            className={`tg-lines-${Math.max(1, steps)}`}
          />
        </div>

        {/* Kept in place while the panel's Undo stands in for it, so nothing moves (§3):
            `hidden` alone would lose to the shared `.action-btn { display: flex }`,
            so make-the-target.css turns it into `visibility: hidden` here — the bar
            keeps its place and the button leaves the tab order and the a11y tree. */}
        <div className="action-bar tg-actions" onKeyDownCapture={swallowRepeatedPress}>
          <button
            type="button"
            className="action-btn"
            onClick={onUndo}
            disabled={!canUndo(session)}
            hidden={missed}
          >
            <span className="action-icon" aria-hidden="true">
              <IconUndo />
            </span>
            {t('undo')}
          </button>
        </div>

        <BannerSlot />
      </div>

      {/* Outside `.game-content`: the move that solves the problem makes that
          container `inert` in the same commit that writes its line, and inert
          content is hidden from assistive technology, so the last line would
          go unread (§12). */}
      <p className="visually-hidden" aria-live="polite">
        {spokenText}
      </p>

      <MakeTheTargetResultOverlay
        session={session}
        lastResult={lastResult}
        onRetry={onRetry}
        onNewBoard={onNewBoard}
        onHome={goHome}
      />

      <RestartDialog
        open={confirmRestart}
        onClose={() => setConfirmRestart(false)}
        onRetry={onRetry}
        newBoard={
          session.mode === 'free'
            ? { label: t('makeTheTargetNewBoard'), start: onNewBoard }
            : undefined
        }
      />

      <ConfirmDialog
        open={confirmReveal}
        title={t('makeTheTargetRevealTitle')}
        body={t('makeTheTargetRevealBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('makeTheTargetRevealConfirm')}
        onCancel={() => setConfirmReveal(false)}
        onConfirm={() => {
          setConfirmReveal(false);
          revealCurrent();
        }}
      />
    </div>
  );
}
