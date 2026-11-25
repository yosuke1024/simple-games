/**
 * The end of a match (docs/SCOPA_RULES.md §3.4, §11.2): who took it, the final
 * score, and the deal that decided it — its settlement is shown here rather
 * than on a screen of its own, one tap fewer (the Gin Rummy §3.3 shape). A
 * loss is stated, never scolded, and there is no praise for a win either; the
 * next match is free, with no revival to buy and no ad to watch for one more
 * deal (docs/ADS_POLICY.md).
 *
 * No `BestDelta`: there is no personal best in this game to compare with.
 *
 * The Club House ranks the match by its final score (§17): a lost match is
 * ranked too, by the player's own score, so the card always sends `completed`
 * while the share keeps its won / played split. A match left with ↻ never
 * reaches this card and sends nothing. The Nearby view (§16) does not import
 * this overlay, so a Nearby match never reaches the Club.
 */
import { useMemo } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ClubResultAction } from '@/ui/components/ClubResultAction';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { useResultReveal } from '@/ui/useResultReveal';
import type { ScopaSession } from '../../game';
import type { LastResult } from '../../state/GameContext';
import { DealTable, SweepLine } from './DealTable';

export interface ScopaResultOverlayProps {
  session: ScopaSession;
  lastResult: LastResult | null;
  onRematch: () => void;
  onHome: () => void;
}

export function ScopaResultOverlay({
  session,
  lastResult,
  onRematch,
  onHome,
}: ScopaResultOverlayProps) {
  const { t } = useSettings();
  // The last card and the table's sweep get their beat before the card covers
  // them (§11.2).
  const revealed = useResultReveal(session.status !== 'playing' && lastResult !== null);
  const mine = lastResult?.mine ?? 0;
  const theirs = lastResult?.theirs ?? 0;
  // The match's facts, once: the share's strings and the Club's figures are
  // read from the same fields (docs/architecture/club.md §6-1).
  const facts = useMemo(() => ({ score: mine, cpuScore: theirs }), [mine, theirs]);
  if (!revealed || !lastResult) return null;

  const won = lastResult.status === 'won';
  const title = won ? t('scopaWinTitle') : t('scopaLoseTitle');
  // The share line carries what the screen shows: the two final scores.
  const details = [
    { label: t('scopaYou'), value: String(mine) },
    { label: t('scopaCpu'), value: String(theirs) },
  ];
  const decider = session.lastDeal;

  return (
    <div className="overlay overlay-result">
      <div
        className={`dialog result ${won ? 'result-clear' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="dialog-title">{title}</h2>

        <dl className="result-facts">
          <div>
            <dt>{t('scopaYou')}</dt>
            <dd>{mine}</dd>
          </div>
          <div>
            <dt>{t('scopaCpu')}</dt>
            <dd>{theirs}</dd>
          </div>
        </dl>

        {decider ? (
          <section className="sc-decider" aria-label={t('scopaDecidingDeal')}>
            <h3 className="sc-decider-title">{t('scopaDecidingDeal')}</h3>
            <SweepLine outcome={decider} />
            <DealTable outcome={decider} />
          </section>
        ) : null}

        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRematch} autoFocus>
            {t('newGame')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction gameId="scopa" outcome={won ? 'completed' : 'played'} details={details} />
        <ClubResultAction
          gameId="scopa"
          outcome="completed"
          details={details}
          facts={facts}
          seed={session.seed}
          params={{}}
          boardDigest={null}
        />
      </div>
      <ResultAdSlot />
    </div>
  );
}
