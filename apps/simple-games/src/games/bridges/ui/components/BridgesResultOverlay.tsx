/**
 * The clear screen (docs/BRIDGES_RULES.md §3, §11). Time and hints — the facts
 * of the run. The time appears only here, because showing it while playing
 * would be a clock counting up at someone doing a puzzle. There is no losing
 * screen, because there is no losing (§3).
 *
 * No Club House action: Bridges is not a Club challenge while it is in early
 * release (§17), so the share is the only thing below the buttons.
 *
 * The card does not act on what was meant for the board (§13). The last
 * bridge is very often a second tap on the partner just tapped, or an Enter
 * on a focused island — and under Reduced Motion the card is there the
 * instant that bridge lands, with Retry focused. So for its first
 * RESULT_ARM_MS the card takes no click or tap, and it never takes a held
 * key's repeats: a double tap or a held Enter cannot throw away the result
 * it has not shown yet. Nothing is animated and nothing re-renders for this;
 * one timer, released with the card (useTransientTimeout).
 */
import { useCallback, useEffect, useRef, type KeyboardEvent, type MouseEvent } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { BestDelta } from '@/ui/components/BestDelta';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { formatDuration } from '@/ui/format';
import { useResultReveal } from '@/ui/useResultReveal';
import { useTransientTimeout } from '@/ui/useTransientTimeout';
import type { BridgesSession } from '../../game';
import type { LastResult } from '../../state/GameContext';

/**
 * How long the card ignores clicks once it is up (§13): longer than a quick
 * second tap or a double press of Enter, short enough that no one reaching
 * for a button on purpose is still waiting.
 */
export const RESULT_ARM_MS = 400;

export interface BridgesResultOverlayProps {
  session: BridgesSession;
  lastResult: LastResult | null;
  onRetry: () => void;
  onNewBoard: () => void;
  onHome: () => void;
}

export function BridgesResultOverlay({
  session,
  lastResult,
  onRetry,
  onNewBoard,
  onHome,
}: BridgesResultOverlayProps) {
  // The finished board gets its beat before the card covers it (§13).
  const revealed = useResultReveal(session.status === 'solved');
  if (!revealed) return null;
  return (
    <ResultCard
      session={session}
      lastResult={lastResult}
      onRetry={onRetry}
      onNewBoard={onNewBoard}
      onHome={onHome}
    />
  );
}

/** The card itself, mounted when it is revealed — which is when its arming starts. */
function ResultCard({
  session,
  lastResult,
  onRetry,
  onNewBoard,
  onHome,
}: BridgesResultOverlayProps) {
  const { t } = useSettings();
  const armedRef = useRef(false);
  const later = useTransientTimeout();
  useEffect(() => {
    later(() => {
      armedRef.current = true;
    }, RESULT_ARM_MS);
  }, [later]);

  /** A click before the card is armed reaches no button (§13). */
  const onClickCapture = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (armedRef.current) return;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  /** A held key's repeats press nothing — a held Enter would press Retry (§13). */
  const onKeyDownCapture = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.repeat) event.preventDefault();
  }, []);

  // A daily is one board a day: there is no other board to offer (§8).
  const canStartNew = session.mode === 'difficulty';

  const details = [
    { label: t('timeLabel'), value: formatDuration(session.elapsedSeconds) },
    { label: t('bridgesHintsUsed'), value: String(session.hintCount) },
  ];

  return (
    <div className="overlay overlay-result">
      <div
        className="dialog result result-clear"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('bridgesSolvedTitle')}
        onClickCapture={onClickCapture}
        onKeyDownCapture={onKeyDownCapture}
      >
        <h2 className="dialog-title">{t('bridgesSolvedTitle')}</h2>
        <p className="dialog-body">{t('bridgesSolvedBody')}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('timeLabel')}</dt>
            <dd>{formatDuration(session.elapsedSeconds)}</dd>
          </div>
          <div>
            <dt>{t('bridgesHintsUsed')}</dt>
            <dd>{session.hintCount}</dd>
          </div>
        </dl>

        {lastResult?.isNewBest ? (
          <p className="dialog-body">
            {t('bridgesNewBestTime')}
            <BestDelta
              value={lastResult.seconds}
              previous={lastResult.previousBestSeconds}
              kind="time"
            />
          </p>
        ) : lastResult ? (
          <p className="dialog-body">
            {t('bestTime')} {formatDuration(lastResult.bestSeconds)}
            <BestDelta
              value={lastResult.seconds}
              previous={lastResult.previousBestSeconds}
              kind="time"
            />
          </p>
        ) : null}

        <div className="result-actions">
          {/* Retry leads and New board follows (§8): the same board again is the
              first offer, a fresh one the second, and the daily has no second. */}
          <button type="button" className="btn btn-primary" onClick={onRetry} autoFocus>
            {t('tryAgain')}
          </button>
          {canStartNew ? (
            <button type="button" className="btn btn-secondary" onClick={onNewBoard}>
              {t('bridgesNewBoard')}
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction gameId="bridges" outcome="completed" details={details} />
      </div>
      <ResultAdSlot />
    </div>
  );
}
