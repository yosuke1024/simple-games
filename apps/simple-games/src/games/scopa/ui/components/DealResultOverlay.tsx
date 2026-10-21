/**
 * A deal, settled (docs/SCOPA_RULES.md §3.2, §11.2): the five categories, who
 * took each point, the deal's points and the match score — which has already
 * moved, so what is shown is the real standing.
 *
 * It waits for a tap rather than a timer: nothing takes the settlement off the
 * screen on its own (state/GameContext.tsx says the same from the other side).
 * The deal that decides the match never comes here — the result card carries
 * its table instead (§11.2).
 */
import { useSettings } from '@/state/SettingsContext';
import { useResultReveal } from '@/ui/useResultReveal';
import { CPU, YOU, type DealOutcome } from '../../game';
import { DealTable, SweepLine } from './DealTable';

export interface DealResultOverlayProps {
  outcome: DealOutcome;
  dealNumber: number;
  /** Match points after this deal, by seat — already moved. */
  scores: readonly [number, number];
  onNext: () => void;
}

export function DealResultOverlay({ outcome, dealNumber, scores, onNext }: DealResultOverlayProps) {
  const { t } = useSettings();
  // Mounted the moment the deal is settled, so mounting is the moment: the
  // last card and where the table went get their beat first (§11.2).
  const revealed = useResultReveal(true);
  if (!revealed) return null;
  const title = t('scopaDealTitle', { n: dealNumber });

  return (
    <div className="overlay overlay-result">
      <div className="dialog result" role="alertdialog" aria-modal="true" aria-label={title}>
        <h2 className="dialog-title">{title}</h2>
        <SweepLine outcome={outcome} />
        <DealTable outcome={outcome} />

        <dl className="result-facts">
          <div>
            <dt>{t('scopaYou')}</dt>
            <dd>{scores[YOU]}</dd>
          </div>
          <div>
            <dt>{t('scopaCpu')}</dt>
            <dd>{scores[CPU]}</dd>
          </div>
        </dl>

        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onNext} autoFocus>
            {t('scopaNextDeal')}
          </button>
        </div>
      </div>
    </div>
  );
}
