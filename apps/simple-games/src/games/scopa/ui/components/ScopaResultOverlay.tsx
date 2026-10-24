/**
 * The end of a match (docs/SCOPA_RULES.md §3.4, §11.2): who took it, the final
 * score, and the deal that decided it — its settlement is shown here rather
 * than on a screen of its own, one tap fewer (the Gin Rummy §3.3 shape). A
 * loss is stated, never scolded, and there is no praise for a win either; the
 * next match is free, with no revival to buy and no ad to watch for one more
 * deal (docs/ADS_POLICY.md).
 *
 * No `BestDelta`: there is no personal best in this game to compare with.
 */
import { useSettings } from '@/state/SettingsContext';
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
  if (!revealed || !lastResult) return null;

  const won = lastResult.status === 'won';
  const title = won ? t('scopaWinTitle') : t('scopaLoseTitle');
  // The share line carries what the screen shows: the two final scores.
  const details = [
    { label: t('scopaYou'), value: String(lastResult.mine) },
    { label: t('scopaCpu'), value: String(lastResult.theirs) },
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
            <dd>{lastResult.mine}</dd>
          </div>
          <div>
            <dt>{t('scopaCpu')}</dt>
            <dd>{lastResult.theirs}</dd>
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
      </div>
      <ResultAdSlot />
    </div>
  );
}
