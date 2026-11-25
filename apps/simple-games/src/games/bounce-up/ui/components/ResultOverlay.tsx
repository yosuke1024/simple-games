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
 * In a Club House the card's score goes to this width's table
 * (`ClubResultAction`, §13): every fall is `completed`, with `{ score }` built
 * from the same value as the share's details. The best is the player's own
 * record, not this run's, and is not sent. A run left mid-way never reaches
 * this card, so it is booked locally (§5) but sent nowhere.
 *
 * It arrives after the board's beat (`useResultReveal`, 900 ms; at once
 * under Reduced Motion) — the stopped board is worth a look first.
 */
import { useMemo } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { BestDelta } from '@/ui/components/BestDelta';
import { ClubResultAction } from '@/ui/components/ClubResultAction';
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
  const score = result?.score ?? 0;
  // The run's facts, once: the share's strings and the Club's figure are read
  // from the same field (docs/architecture/club.md §6-1).
  const facts = useMemo(() => ({ score }), [score]);
  if (!revealed || result === null) return null;

  const title = t('bounceUpResultTitle', { score });
  const width = t(WIDTH_KEYS[result.width]);
  const details = [
    { label: t('score'), value: String(score) },
    { label: t('bounceUpWidth'), value: width },
  ];

  return (
    <div className="overlay overlay-result">
      <div className="dialog result" role="alertdialog" aria-modal="true" aria-label={title}>
        <h2 className="dialog-title">{title}</h2>

        <dl className="result-facts">
          <div>
            <dt>{t('score')}</dt>
            <dd>{score}</dd>
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
        <ShareAction gameId="bounce-up" outcome="played" details={details} />
        <ClubResultAction
          gameId="bounce-up"
          outcome="completed"
          details={details}
          facts={facts}
          seed=""
          params={{ width: result.width }}
          boardDigest={null}
        />
      </div>
      <ResultAdSlot />
    </div>
  );
}
