/**
 * The completion card (docs/TANGRAM_RULES.md §6, §7). The facts — which
 * figure, and how long it took — and nothing to chase: no score, no stars, no
 * title. The time appears only here, because a clock on the board would be
 * counting up at someone doing a puzzle. There is no losing card, because
 * there is no losing (§1).
 *
 * From the second completion of the same figure (or the same day's daily)
 * on, the difference from the record is added, signed (`BestDelta`); a first
 * completion sets the record and says nothing more.
 *
 * Free Play leads with the next figure of the tier and offers the same one
 * again second; the daily is one figure a day, so it offers only the retry
 * (§6, interim until the owner decides). The finished figure gets its beat
 * before the card covers it (`useResultReveal`, immediate under Reduced
 * Motion). A held key's repeats press nothing on the card.
 */
import type { KeyboardEvent } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { BestDelta } from '@/ui/components/BestDelta';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { formatDuration } from '@/ui/format';
import { useResultReveal } from '@/ui/useResultReveal';
import type { TangramSession } from '../../game';
import type { LastResult } from '../../state/GameContext';
import { figureTitle } from '../labels';

export interface TangramResultOverlayProps {
  session: TangramSession;
  lastResult: LastResult | null;
  onRetry: () => void;
  onNextFigure: () => void;
  onHome: () => void;
}

/** A held Enter or Space presses a button once, not once per repeat. */
function swallowRepeatedPress(event: KeyboardEvent<HTMLDivElement>) {
  if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
}

export function TangramResultOverlay({
  session,
  lastResult,
  onRetry,
  onNextFigure,
  onHome,
}: TangramResultOverlayProps) {
  const { t } = useSettings();
  const revealed = useResultReveal(session.status === 'complete');
  if (!revealed || lastResult === null) return null;

  const daily = lastResult.mode === 'daily';
  const time = formatDuration(lastResult.seconds);
  const title = figureTitle(
    t,
    lastResult.mode,
    lastResult.tier,
    lastResult.number,
    lastResult.dailyDate,
  );

  // What the card shows is what a share repeats (at most three): the figure's
  // tier and number — the daily's date — and the time.
  const details = daily
    ? [
        { label: t('modeDaily'), value: lastResult.dailyDate ?? '' },
        { label: t('timeLabel'), value: time },
      ]
    : [
        { label: t('tangramTierLabel'), value: t(`tangramTier_${lastResult.tier}`) },
        { label: t('tangramFigureLabel'), value: String(lastResult.number) },
        { label: t('timeLabel'), value: time },
      ];

  return (
    <div className="overlay overlay-result">
      <div
        className="dialog result result-clear tn-result"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('tangramResultTitle')}
        onKeyDownCapture={swallowRepeatedPress}
      >
        <h2 className="dialog-title">{t('tangramResultTitle')}</h2>
        <p className="dialog-body">{title}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('timeLabel')}</dt>
            <dd>
              {time}
              <BestDelta value={lastResult.seconds} previous={lastResult.previous} kind="time" />
            </dd>
          </div>
        </dl>

        <div className="result-actions">
          {daily ? (
            <button type="button" className="btn btn-primary" onClick={onRetry} autoFocus>
              {t('tryAgain')}
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-primary" onClick={onNextFigure} autoFocus>
                {t('tangramNextFigure')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={onRetry}>
                {t('tryAgain')}
              </button>
            </>
          )}
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction gameId="tangram" outcome="completed" details={details} />
      </div>
      <ResultAdSlot />
    </div>
  );
}
