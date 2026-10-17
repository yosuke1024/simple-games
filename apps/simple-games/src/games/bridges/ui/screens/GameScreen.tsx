/**
 * The Bridges game screen (docs/BRIDGES_RULES.md §3, §4, §5, §9).
 *
 * No clock on screen (§11): the elapsed time is recorded and shown on the
 * result card and in the statistics, so nothing here pushes the player to
 * hurry.
 *
 * The selection lives here. A tap on an island is turned into select /
 * deselect / one bridge step by `tapOutcome` (ui/tapLogic.ts); the board only
 * reports which island was pressed. A step leaves the selection where it was,
 * so the same partner tapped again goes on round the cycle.
 *
 * Two actions, both free and unlimited (§9): Undo, because the 0 → 1 → 2 → 0
 * cycle cannot step back and a bridge taken away may have unblocked another,
 * and Hint, which points and never writes to the board. The keyboard reaches
 * both — Ctrl/Cmd+Z and H (issue #93) — as adapters over the same handlers
 * the buttons call, and Escape clears the selection the way a tap on the
 * water does. Arrows walk the islands (the board's own keys); pressed while
 * the focus is elsewhere, they bring it onto the board first.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { RestartDialog } from '@/ui/components/RestartDialog';
import { IconBack, IconHint, IconRetry, IconUndo } from '@/ui/components/icons';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import { canUndo, colOf, factsOf, rowOf, type BridgesSession, type Hint } from '../../game';
import { useBridges } from '../../state/GameContext';
import { BridgesBoard, type BridgesBoardHandle } from '../components/BridgesBoard';
import { BridgesResultOverlay } from '../components/BridgesResultOverlay';
import { ARROW_DIRECTIONS, isPartner, tapOutcome } from '../tapLogic';

export function BridgesGameScreen() {
  const {
    session,
    lastResult,
    sessionEpoch,
    connect,
    applyUndo,
    takeHint,
    goHome,
    restartCurrent,
    startNewBoard,
  } = useBridges();
  const { t } = useSettings();

  const [selected, setSelected] = useState<number | null>(null);
  const [hint, setHint] = useState<Hint | null>(null);
  /**
   * What the hint said. It stays under the board, beside the marks it
   * explains, until the next move takes both away — never over the board,
   * where it could cover the very pair it points at.
   */
  const [message, setMessage] = useState<string | null>(null);
  /** What the last bridge step did, for a screen reader (polite, never a toast). */
  const [announcement, setAnnouncement] = useState('');
  const [confirmRestart, setConfirmRestart] = useState(false);
  const boardRef = useRef<BridgesBoardHandle | null>(null);

  // A new board — or the same one retried or resumed — is a clean slate.
  useEffect(() => {
    setSelected(null);
    setHint(null);
    setMessage(null);
    setAnnouncement('');
  }, [sessionEpoch]);

  // Result feedback (sound / vibration) exactly once per transition, and the
  // finished board shown without a selection on it.
  const previousStatus = useRef(session?.status ?? 'playing');
  useEffect(() => {
    const status = session?.status ?? 'playing';
    if (status === 'solved' && previousStatus.current === 'playing') {
      setSelected(null);
      sounds.clear();
      void haptics.clear();
    }
    previousStatus.current = status;
  }, [session?.status]);

  /**
   * Says, for a screen reader only, what a pair now carries — after a step
   * and after an undo alike, so every change to the board is heard and the
   * same step made again after an undo is a new sentence, not a repeat the
   * live region would swallow.
   */
  const announce = useCallback(
    (edge: number, count: number) => {
      if (session === null) return;
      const pair = session.graph.edges[edge];
      if (pair === undefined) return;
      setAnnouncement(
        t(
          count === 0
            ? 'bridgesAnnounceNone'
            : count === 1
              ? 'bridgesAnnounceOne'
              : 'bridgesAnnounceTwo',
          pairPlace(session, pair.a, pair.b),
        ),
      );
    },
    [session, t],
  );

  /**
   * One bridge step between two islands, with its sound and its spoken
   * result. The counts come from the context, read from the session the step
   * was applied to — not from this render's copy, which a second step in the
   * same task would find already out of date.
   */
  const step = useCallback(
    (from: number, to: number): boolean => {
      const change = connect(from, to);
      if (change === null) return false;
      setHint(null);
      setMessage(null);
      // A bridge added rings like a selection; the cycle back to none like taking back.
      if (change.after > change.before) sounds.select();
      else sounds.undo();
      void haptics.tap();
      announce(change.edge, change.after);
      return true;
    },
    [announce, connect],
  );

  const onTapIsland = useCallback(
    (island: number) => {
      if (session === null || session.status !== 'playing') return;
      const outcome = tapOutcome(session, selected, island);
      if (outcome.kind === 'select') setSelected(outcome.island);
      else if (outcome.kind === 'deselect') setSelected(null);
      else step(outcome.from, outcome.to);
    },
    [selected, session, step],
  );

  /** A drag is "select, then tap" in one stroke (§4): the origin stays selected after. */
  const onDragConnect = useCallback(
    (from: number, to: number) => {
      if (session === null || session.status !== 'playing') return;
      if (!isPartner(session, from, to)) return;
      setSelected(from);
      step(from, to);
    },
    [session, step],
  );

  const onTapWater = useCallback(() => setSelected(null), []);

  const onUndo = useCallback(() => {
    const change = applyUndo();
    if (change === null) return;
    setHint(null);
    setMessage(null);
    sounds.undo();
    announce(change.edge, change.after);
  }, [announce, applyUndo]);

  /** The hint points; it never writes to the board for the player (§9). */
  const onHint = useCallback(() => {
    const next = takeHint();
    if (next === null) {
      setHint(null);
      setMessage(t('bridgesHintNone'));
      return;
    }
    setHint(next);
    // The marks are the hint's alone while it shows: a selection's dashed
    // rings beside them would be two sets of rings to tell apart.
    setSelected(null);
    sounds.select();
    if (next.kind === 'wrong') {
      setMessage(t('bridgesHintWrong'));
      return;
    }
    const two = next.atLeast >= 2;
    if (next.island >= 0) setMessage(t(two ? 'bridgesHintTwoAt' : 'bridgesHintOneAt'));
    else setMessage(t(two ? 'bridgesHintTwo' : 'bridgesHintOne'));
  }, [t, takeHint]);

  /* Keyboard as an adapter over the handlers above (issue #93): H asks for
     the hint, Ctrl/Cmd+Z undoes, Escape clears the selection — the same
     one-shot actions the buttons and a tap on the water trigger, so key
     repeat is ignored for the first two. An arrow that arrives here was not
     answered by the board (the focus was elsewhere): it brings the focus onto
     the board, and the next arrow walks it. */
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
    if (ARROW_DIRECTIONS[event.key] !== undefined && !event.shiftKey) {
      boardRef.current?.focusIsland();
      return true;
    }
    return false;
  };
  useGameKeys(onKey, session !== null && session.status === 'playing' && !confirmRestart);

  if (!session) return null;

  const finished = session.status !== 'playing';
  const facts = factsOf(session);
  // The one way a board can look finished and not be (§3, §5).
  const split = !finished && facts.allNumbersMet && facts.groups > 1;

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
                : t(`bridgesDifficulty_${session.difficulty}`)}
            </span>
            <span className="bg-size-tag">
              {t('bridgesBoardNote', { width: session.width, height: session.height })}
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

        <div className="bg-board-scroll">
          <BridgesBoard
            key={sessionEpoch}
            ref={boardRef}
            session={session}
            selected={selected}
            hint={hint}
            solved={session.status === 'solved'}
            onTapIsland={onTapIsland}
            onDragConnect={onDragConnect}
            onTapWater={onTapWater}
          />
          {/* The one line under the board (§5, §9): what the hint said, else
              the note that every number is met but the islands are apart. */}
          <p className="bg-note" role="status">
            {message ?? (split ? t('bridgesSplitNote', { groups: facts.groups }) : '')}
            {hint !== null ? (
              <span className="visually-hidden"> {hintWhere(session, hint, t)}</span>
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
          <button type="button" className="action-btn" onClick={onHint}>
            <span className="action-icon" aria-hidden="true">
              <IconHint />
            </span>
            {t('hint')}
          </button>
        </div>

        <BannerSlot />
      </div>

      <BridgesResultOverlay
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
            ? { label: t('bridgesNewBoard'), start: () => startNewBoard(session.difficulty) }
            : undefined
        }
      />
    </div>
  );
}

/** One island's place, 1-based, as the spoken names give it (§5, §13). */
function placeOf(session: BridgesSession, island: number): { row: number; col: number } {
  const index = session.islands[island]!.index;
  return { row: rowOf(index, session.width) + 1, col: colOf(index, session.width) + 1 };
}

/** A pair's two places, for the sentences that name both ends. */
function pairPlace(session: BridgesSession, a: number, b: number) {
  const first = placeOf(session, a);
  const second = placeOf(session, b);
  return { row1: first.row, col1: first.col, row2: second.row, col2: second.col };
}

/**
 * Where the hint's marks are, in words (§9, §13): the marks are drawn, and a
 * screen reader needs the places they stand on. Read with the hint's own
 * sentence in the line under the board, hidden from sight.
 */
function hintWhere(
  session: BridgesSession,
  hint: Hint,
  t: ReturnType<typeof useSettings>['t'],
): string {
  const edge = session.graph.edges[hint.edge];
  if (edge === undefined) return '';
  const pair = pairPlace(session, edge.a, edge.b);
  if (hint.kind === 'step' && hint.island >= 0) {
    return t('bridgesHintWhereRing', { ...pair, ...placeOf(session, hint.island) });
  }
  return t('bridgesHintWhere', pair);
}
