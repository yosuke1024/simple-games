/**
 * The one thing this game has to say at the end: who won, and the two totals
 * that say it (§1, §7). A loss is stated, never scolded; there is no revival
 * to buy and no ad to watch for one more throw (docs/YACHT_RULES.md §6,
 * ADS_POLICY.md).
 */
import { useSettings } from '@/state/SettingsContext';
import { BestDelta } from '@/ui/components/BestDelta';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { useResultReveal } from '@/ui/useResultReveal';
import { cpuTotalOf, outcomeOf, statusOf, totalOf, type YachtSession } from '../../game';
import type { LastResult } from '../../state/GameContext';

export interface YachtResultOverlayProps {
  session: YachtSession;
  lastResult: LastResult | null;
  onNewGame: () => void;
  onHome: () => void;
}

export function YachtResultOverlay({
  session,
  lastResult,
  onNewGame,
  onHome,
}: YachtResultOverlayProps) {
  const { t } = useSettings();
  // The full sheets get their beat before the card covers them (§10).
  const revealed = useResultReveal(statusOf(session) === 'finished');
  if (!revealed) return null;

  const total = totalOf(session);
  const cpuTotal = cpuTotalOf(session);
  const best = lastResult?.bestScore ?? total;
  // `session` is finished here, so this is never null — `lastResult` is
  // preferred since it is the outcome booked into the statistics.
  const outcome = lastResult?.outcome ?? outcomeOf(session)!;

  const title =
    outcome === 'won'
      ? t('yachtWinTitle')
      : outcome === 'lost'
        ? t('yachtLoseTitle')
        : t('yachtDrawTitle');
  const body =
    outcome === 'won'
      ? t('yachtWinBody')
      : outcome === 'lost'
        ? t('yachtLoseBody')
        : t('yachtDrawBody');

  return (
    <div className="overlay overlay-result">
      <div
        className={`dialog result ${outcome === 'won' ? 'result-clear' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-body">{body}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('yachtYou')}</dt>
            <dd>{total}</dd>
          </div>
          <div>
            <dt>{t('yachtCpu')}</dt>
            <dd>{cpuTotal}</dd>
          </div>
          <div>
            <dt>{t('yachtBest')}</dt>
            <dd>{best}</dd>
          </div>
        </dl>

        {/* Said only when an earlier record was beaten: a first sheet is a
            best by definition, and saying so would be noise. */}
        {lastResult?.isNewBest && lastResult.previousBest !== null ? (
          <p className="dialog-body">
            {t('yachtNewBest')}
            <BestDelta
              value={lastResult.total}
              previous={lastResult.previousBest}
              kind="count"
              lowerIsBetter={false}
            />
          </p>
        ) : null}

        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onNewGame} autoFocus>
            {t('newGame')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        {/* Both totals, exactly what the card shows — never a reward, never
            asked twice (services/share). */}
        <ShareAction
          gameId="yacht"
          outcome={outcome === 'won' ? 'completed' : 'played'}
          details={[
            { label: t('yachtYou'), value: String(total) },
            { label: t('yachtCpu'), value: String(cpuTotal) },
          ]}
        />
      </div>
      <ResultAdSlot />
    </div>
  );
}
