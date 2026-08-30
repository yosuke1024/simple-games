/**
 * The Mahjong Solitaire game screen (docs/MAHJONG_SOLITAIRE_RULES.md §3, §7,
 * §8, §9).
 *
 * No clock on screen (§9): the elapsed time is recorded and shown on the
 * result card and in the statistics, so nothing here pushes the player to
 * hurry. What IS shown is the remaining-tile count — board state, not a
 * score.
 *
 * Selection is the two-step of the card games (§3): tap a takeable tile to
 * pick it up, tap its match to take the pair. A tap that cannot act moves
 * the selection or does nothing — never a scold, no error sound.
 *
 * Two helps, both free and unlimited (§8): Undo and Hint. The stuck notice
 * (§7) is a quiet fact with its ways out attached; the game never ends
 * against the player's will.
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
import { currentFreeTiles, isStuck, remainingCount } from '../../game';
import { useMahjong } from '../../state/GameContext';
import { MahjongBoard } from '../components/MahjongBoard';
import { MahjongResultOverlay } from '../components/MahjongResultOverlay';

/** Long enough to read a full sentence twice, in a second language. */
const TOAST_MS = 5000;

export function MahjongGameScreen() {
  const {
    session,
    lastResult,
    sessionEpoch,
    takePair,
    undo,
    takeHint,
    goHome,
    restartCurrent,
    startNextLevel,
  } = useMahjong();
  const { t } = useSettings();

  const [selected, setSelected] = useState<number | null>(null);
  const [hintPair, setHintPair] = useState<readonly [number, number] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const toastTimeout = useTransientTimeout();

  // A new board is a clean slate.
  useEffect(() => {
    setSelected(null);
    setHintPair(null);
    setToast(null);
  }, [sessionEpoch]);

  // Result feedback (sound / vibration) exactly once per transition.
  const previousStatus = useRef(session?.status ?? 'playing');
  useEffect(() => {
    const status = session?.status ?? 'playing';
    if (status === 'won' && previousStatus.current === 'playing') {
      sounds.clear();
      void haptics.clear();
    }
    previousStatus.current = status;
  }, [session?.status]);

  const showToast = useCallback(
    (message: string) => {
      setToast(message);
      // Re-showing restarts the clock; unmount cancels it (useTransientTimeout).
      toastTimeout(() => setToast(null), TOAST_MS);
    },
    [toastTimeout],
  );

  const onTileTap = useCallback(
    (index: number) => {
      if (!session || session.status !== 'playing') return;
      const free = new Set(currentFreeTiles(session));
      // A blocked tile: nothing happens, nobody is scolded (§3).
      if (!free.has(index)) return;
      setHintPair(null);
      if (selected === index) {
        setSelected(null);
        return;
      }
      if (selected !== null && takePair(selected, index)) {
        setSelected(null);
        sounds.match();
        void haptics.tap();
        return;
      }
      // Not a match (or nothing held): the selection moves here (§3).
      setSelected(index);
      sounds.select();
    },
    [selected, session, takePair],
  );

  const onUndo = useCallback(() => {
    setSelected(null);
    setHintPair(null);
    if (undo()) sounds.select();
  }, [undo]);

  const onHint = useCallback(() => {
    const pair = takeHint();
    if (pair === null) {
      showToast(t('mahjongHintNone'));
      return;
    }
    setSelected(null);
    setHintPair(pair);
    sounds.select();
  }, [showToast, t, takeHint]);

  /* Keyboard as an adapter over the tap handlers above (issue #93): Ctrl/Cmd+Z
     undoes, H asks for the hint — both one-shot actions, so key repeat is
     ignored for each. */
  const onKey = (event: KeyboardEvent): boolean => {
    if (session === null) return false;
    if (isUndoKey(event)) {
      if (!event.repeat && session.removed.length > 0) onUndo();
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
  const stuck = isStuck(session);

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={finished}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="game-status">
            <span className="game-mode">
              {session.mode === 'daily'
                ? t('modeDaily')
                : t('modeLevel', { n: session.level ?? 1 })}
            </span>
            <span className="mj-count-tag">
              {t('mahjongTilesLeft', { n: remainingCount(session) })}
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

        <div className="mj-board-scroll">
          <MahjongBoard
            session={session}
            selected={selected}
            hintPair={hintPair}
            onTileTap={onTileTap}
          />
        </div>

        {stuck ? (
          <div className="mj-stuck" role="status">
            <p className="mj-stuck-title">{t('mahjongStuckTitle')}</p>
            <p className="mj-stuck-body">{t('mahjongStuckBody')}</p>
            <div className="mj-stuck-actions">
              <button type="button" className="btn btn-secondary" onClick={onUndo}>
                {t('undo')}
              </button>
              <button type="button" className="btn btn-primary" onClick={restartCurrent}>
                {t('tryAgain')}
              </button>
            </div>
          </div>
        ) : null}

        {toast ? (
          <div className="toast" role="status">
            {toast}
          </div>
        ) : null}

        <div className="action-bar">
          <button
            type="button"
            className="action-btn"
            onClick={onUndo}
            disabled={session.removed.length === 0}
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

      <MahjongResultOverlay
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
