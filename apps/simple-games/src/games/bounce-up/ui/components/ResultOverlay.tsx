/**
 * The end of a run (docs/BOUNCE_UP_RULES.md §7「結果」). There is no clear to
 * celebrate — every run ends in a fall, sooner or later — so the card states
 * the facts and offers the next run, free, right there: the score, the width
 * it was climbed at, and this width's best with the difference from the best
 * the run began against (`BestDelta`). The heading is the score itself, never
 * praise; a new best is the number moving, not an event.
 *
 * There is nothing to buy: no continue, no second chance, no ad to watch for
 * one more bounce (§1). Retry is the ↻'s own function — a fresh seed at this
 * width.
 *
 * It arrives after the board's beat (`useResultReveal`, 900 ms; at once
 * under Reduced Motion) — the stopped board is worth a look first.
 */
import { useSettings } from '@/state/SettingsContext';
import { BestDelta } from '@/ui/components/BestDelta';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { useResultReveal } from '@/ui/useResultReveal';
import type { LastResult } from '../../state/GameContext';

export interface BounceUpResultOverlayProps {
  result: LastResult | null;
  onRetry: () => void;
  onHome: () => void;
}

const WIDTH_KEYS = {
  normal: 'bounceUpWidth_normal',
  wide: 'bounceUpWidth_wide',
} as const;

export function BounceUpResultOverlay({ result, onRetry, onHome }: BounceUpResultOverlayProps) {
  const { t } = useSettings();
  const revealed = useResultReveal(result !== null);
  if (!revealed || result === null) return null;

  const title = t('bounceUpResultTitle', { score: result.score });
  const width = t(WIDTH_KEYS[result.width]);

  return (
    <div className="overlay overlay-result">
      <div className="dialog result" role="alertdialog" aria-modal="true" aria-label={title}>
        <h2 className="dialog-title">{title}</h2>

        <dl className="result-facts">
          <div>
            <dt>{t('score')}</dt>
            <dd>{result.score}</dd>
          </div>
          <div>
            <dt>{t('bounceUpWidth')}</dt>
            <dd>{width}</dd>
          </div>
          <div>
            <dt>{t('bounceUpBest')}</dt>
            <dd>
              {result.best}
              <BestDelta
                value={result.score}
                previous={result.previousBest}
                kind="count"
                lowerIsBetter={false}
              />
            </dd>
          </div>
        </dl>

        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRetry} autoFocus>
            {t('bounceUpClimbAgain')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction
          gameId="bounce-up"
          outcome="played"
          details={[
            { label: t('score'), value: String(result.score) },
            { label: t('bounceUpWidth'), value: width },
          ]}
        />
      </div>
      <ResultAdSlot />
    </div>
  );
}
