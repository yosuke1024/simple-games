/**
 * The one thing this game has to say at the end: the sheet's total (§6). It
 * states the best score once, quietly — a record, not a target — and offers a
 * new sheet. There is no revival to buy and no ad to watch for one more throw
 * (docs/YACHT_RULES.md §5, ADS_POLICY.md).
 */
import { useSettings } from '@/state/SettingsContext';
import { BestDelta } from '@/ui/components/BestDelta';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { useResultReveal } from '@/ui/useResultReveal';
import { statusOf, totalOf, type YachtSession } from '../../game';
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
  // The full sheet gets its beat before the card covers it (§9).
  const revealed = useResultReveal(statusOf(session) === 'finished');
  if (!revealed) return null;

  const total = totalOf(session);
  const best = lastResult?.bestScore ?? total;

  return (
    <div className="overlay overlay-result">
      <div
        className="dialog result result-clear"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('yachtResultTitle')}
      >
        <h2 className="dialog-title">{t('yachtResultTitle')}</h2>
        <p className="dialog-body">{t('yachtResultBody')}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('yachtTotal')}</dt>
            <dd>{total}</dd>
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
        {/* The headline figure only: the best is a record, and a share never
            repeats one. */}
        <ShareAction
          gameId="yacht"
          outcome="completed"
          details={[{ label: t('yachtTotal'), value: String(total) }]}
        />
      </div>
      <ResultAdSlot />
    </div>
  );
}
