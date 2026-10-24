/**
 * The clear screen (docs/PIPE_LINK_RULES.md §2, §8). The facts of the run —
 * the board's size, the time, the hints — and nothing that praises them. The
 * time appears only here, because showing it while playing would be a clock
 * counting up at someone doing a puzzle. There is no losing screen, because
 * there is no losing (§2).
 *
 * No Club House action: Pipe Link is not a Club challenge while it is in
 * early release (the rules' preamble), so the share is the only thing below
 * the buttons.
 *
 * The card does not act on what was meant for the board (§3). The last tile
 * is very often turned in the middle of quick taps, or by a held Enter — and
 * under Reduced Motion the card is there the instant it lands, with the retry
 * focused. So for its first RESULT_ARM_MS the card takes no click or tap, and
 * it never takes a held key's repeats. One timer, released with the card.
 */
import { useCallback, useEffect, useRef, type KeyboardEvent, type MouseEvent } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { BestDelta } from '@/ui/components/BestDelta';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { formatDuration } from '@/ui/format';
import { useResultReveal } from '@/ui/useResultReveal';
import { useTransientTimeout } from '@/ui/useTransientTimeout';
import type { PipeLinkSession } from '../../game';
import type { LastResult } from '../../state/GameContext';

/**
 * How long the card ignores clicks once it is up (§3) — Bridges' value,
 * copied (initial value).
 */
export const RESULT_ARM_MS = 400;

export interface PipeLinkResultOverlayProps {
  session: PipeLinkSession;
  lastResult: LastResult | null;
  onRetry: () => void;
  onNewBoard: () => void;
  onHome: () => void;
}

export function PipeLinkResultOverlay(props: PipeLinkResultOverlayProps) {
  // The finished board gets its beat before the card covers it (§10).
  const revealed = useResultReveal(props.session.status === 'solved');
  if (!revealed) return null;
  return <ResultCard {...props} />;
}

/** The card itself, mounted when it is revealed — which is when its arming starts. */
function ResultCard({
  session,
  lastResult,
  onRetry,
  onNewBoard,
  onHome,
}: PipeLinkResultOverlayProps) {
  const { t } = useSettings();
  const armedRef = useRef(false);
  const later = useTransientTimeout();
  useEffect(() => {
    later(() => {
      armedRef.current = true;
    }, RESULT_ARM_MS);
  }, [later]);

  /** A click before the card is armed reaches no button. */
  const onClickCapture = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (armedRef.current) return;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  /** A held key's repeats press nothing — a held Enter would press the retry. */
  const onKeyDownCapture = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.repeat) event.preventDefault();
  }, []);

  // A daily is one board a day: there is no other board to offer (§8).
  const canStartNew = session.mode === 'difficulty';
  const { width, height } = session.board;
  const size = t('pipeLinkBoardNote', { width, height });

  const details = [
    { label: t('pipeLinkBoardSize'), value: size },
    { label: t('timeLabel'), value: formatDuration(session.elapsedSeconds) },
    { label: t('pipeLinkHintsUsed'), value: String(session.hintCount) },
  ];

  return (
    <div className="overlay overlay-result">
      <div
        className="dialog result result-clear"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('pipeLinkSolvedTitle')}
        onClickCapture={onClickCapture}
        onKeyDownCapture={onKeyDownCapture}
      >
        <h2 className="dialog-title">{t('pipeLinkSolvedTitle')}</h2>
        <p className="dialog-body">{t('pipeLinkSolvedBody', { tiles: width * height })}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('pipeLinkBoardSize')}</dt>
            <dd>{size}</dd>
          </div>
          <div>
            <dt>{t('timeLabel')}</dt>
            <dd>{formatDuration(session.elapsedSeconds)}</dd>
          </div>
          <div>
            <dt>{t('pipeLinkHintsUsed')}</dt>
            <dd>{session.hintCount}</dd>
          </div>
        </dl>

        {lastResult?.isNewBest ? (
          <p className="dialog-body">
            {t('pipeLinkNewBestTime')}
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
          {/* The same board again leads, a new one follows (§8), and the daily
              has no second board. */}
          <button type="button" className="btn btn-primary" onClick={onRetry} autoFocus>
            {t('tryAgain')}
          </button>
          {canStartNew ? (
            <button type="button" className="btn btn-secondary" onClick={onNewBoard}>
              {t('pipeLinkNewBoard')}
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction gameId="pipe-link" outcome="completed" details={details} />
      </div>
      <ResultAdSlot />
    </div>
  );
}
