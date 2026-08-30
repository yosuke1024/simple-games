/**
 * The Water Sort game screen (docs/WATER_SORT_RULES.md §3, §4, §8).
 *
 * The pour count is on screen because it is the game's own measure. The clock
 * is not: it is recorded and shown on the clear screen instead, so nothing
 * here pushes the player to hurry.
 *
 * Tap-tap pours: the first tap lifts a tube, the second pours into the tapped
 * one (§3). Tapping the lifted tube puts it down; an illegal destination
 * moves the selection instead of scolding — the player was picking a new
 * source, not making a mistake.
 *
 * Undo and Hint are both free and unlimited (§8). The hint highlight and the
 * honest "no way forward found" toast live here; the proof lives in the
 * solver.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconHint, IconRetry, IconUndo } from '@/ui/components/icons';
import { useTransientTimeout } from '@/ui/useTransientTimeout';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import { applyPour, isTubeComplete, type Pour } from '../../game';
import { useWaterSort } from '../../state/GameContext';
import { WaterBoard, type PourEffect } from '../components/WaterBoard';
import { WaterResultOverlay } from '../components/WaterResultOverlay';

/** How long the hint highlight and the toast stay up. */
const HINT_SHOW_MS = 4000;

/** How long the pour gesture plays for — must outlast the CSS animation. */
const POUR_SHOW_MS = 760;

export function WaterGameScreen() {
  const {
    session,
    lastResult,
    tryPour,
    applyUndo,
    requestHint,
    goHome,
    restartCurrent,
    startNextLevel,
  } = useWaterSort();
  const { t } = useSettings();
  const [selected, setSelected] = useState<number | null>(null);
  const [hint, setHint] = useState<Pour | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pourFx, setPourFx] = useState<PourEffect | null>(null);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const toastTimeout = useTransientTimeout();
  const pourTimeout = useTransientTimeout();
  const hintTimeout = useTransientTimeout();
  /** Flipped per pour so a repeat from the same tube replays the gesture. */
  const pourParityRef = useRef<0 | 1>(0);

  const tubes = session?.tubes ?? null;

  // Board changed (pour / undo / restart): stale marks must not linger.
  useEffect(() => {
    setSelected(null);
    setHint(null);
  }, [tubes]);

  /** Replays a pour as a gesture; purely visual (§12). */
  const showPour = useCallback(
    (from: number, to: number) => {
      pourParityRef.current = pourParityRef.current === 0 ? 1 : 0;
      setPourFx({ from, to, dir: to > from ? 'right' : 'left', parity: pourParityRef.current });
      // A newer pour restarts the clock; unmount cancels it (useTransientTimeout).
      pourTimeout(() => setPourFx(null), POUR_SHOW_MS);
    },
    [pourTimeout],
  );

  const showToast = useCallback(
    (message: string) => {
      setToast(message);
      toastTimeout(() => setToast(null), HINT_SHOW_MS);
    },
    [toastTimeout],
  );

  const onTubeTap = useCallback(
    (index: number) => {
      if (!session || session.status !== 'playing') return;

      if (selected === null) {
        // Nothing to pour out of an empty or finished tube (§3).
        const tube = session.tubes[index]!;
        if (tube.length === 0 || isTubeComplete(tube)) return;
        setSelected(index);
        sounds.select();
        void haptics.tap();
        return;
      }

      if (selected === index) {
        setSelected(null);
        return;
      }

      const preview = applyPour(session.tubes, selected, index);
      if (preview) {
        const source = selected;
        if (!tryPour(source, index)) return;
        showPour(source, index);
        // A pour that finishes a tube earns the brighter chime.
        if (isTubeComplete(preview.tubes[index]!)) sounds.match();
        else sounds.select();
        void haptics.tap();
        return;
      }

      // Not a legal destination: treat the tap as picking a new source.
      const tube = session.tubes[index]!;
      if (tube.length > 0 && !isTubeComplete(tube)) {
        setSelected(index);
        sounds.select();
        void haptics.tap();
      } else {
        setSelected(null);
      }
    },
    [selected, session, showPour, tryPour],
  );

  const onUndo = useCallback(() => {
    if (applyUndo()) sounds.undo();
  }, [applyUndo]);

  const onHint = useCallback(() => {
    const move = requestHint();
    if (move) {
      setHint(move);
      hintTimeout(() => {
        setHint((current) => (current === move ? null : current));
      }, HINT_SHOW_MS);
    } else {
      // Honest for both the proven dead end and the capped search (§8).
      showToast(t('waterHintNone'));
    }
  }, [hintTimeout, requestHint, showToast, t]);

  // The clear chime belongs to the solve, not to a particular pour.
  const solved = session?.status === 'solved';
  const solvedRef = useRef(solved);
  useEffect(() => {
    if (solved && !solvedRef.current) {
      sounds.clear();
      void haptics.clear();
    }
    solvedRef.current = solved;
  }, [solved]);

  /* Keyboard as an adapter over the tap handlers above (issue #93): Ctrl/Cmd+Z
     undoes, H asks for the hint — both one-shot actions, so key repeat is
     ignored for each. */
  const onKey = (event: KeyboardEvent): boolean => {
    if (session === null) return false;
    if (isUndoKey(event)) {
      if (!event.repeat && session.history.length > 0) onUndo();
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

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={solved}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="ws-status">
            <span className="ws-mode">
              {session.mode === 'daily'
                ? t('modeDaily')
                : t('modeLevel', { n: session.level ?? 1 })}
            </span>
            <span className="ws-move-count">
              {t('movesLabel')} {session.moveCount}
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

        <div className="ws-body">
          <WaterBoard
            tubes={session.tubes}
            selected={selected}
            hint={hint}
            pour={pourFx}
            onTubeTap={onTubeTap}
          />
        </div>

        <div className="action-bar ws-actions">
          <button
            type="button"
            className="action-btn"
            onClick={onUndo}
            disabled={session.history.length === 0}
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

      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}

      <WaterResultOverlay
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
