/**
 * The end of a race (docs/OVERTAKE_RULES.md §2, §11「結果」): the place, large,
 * and the bumps — and nothing else. No time (the race's clock is never
 * shown), no overtakes counted (a back-and-forth would pad it), no lead or
 * gap (a time in disguise), no best to beat (`BestDelta` has nothing to
 * compare). The heading states the fact: the level cleared, or the level and
 * the place. No praise, and no "lost" or "failed" either — second to fourth
 * is an ending, not a failure.
 *
 * First place leads with Next (not after Lv100), then Retry and Levels;
 * otherwise Retry leads, then Levels (§11 — provisional until the owner's
 * choice for 42–46 is recorded, §18). Retry is the ↻'s own function.
 *
 * It arrives after the board's beat (`useResultReveal`, 900 ms; at once
 * under Reduced Motion) — the stopped race is worth a look first.
 */
import { useSettings } from '@/state/SettingsContext';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { useResultReveal } from '@/ui/useResultReveal';
import { RIVAL_COUNT } from '../../game/constants';
import type { LastResult } from '../../state/GameContext';

export interface OvertakeResultOverlayProps {
  result: LastResult | null;
  onNext: () => void;
  onRetry: () => void;
  onLevels: () => void;
}

const RACERS = RIVAL_COUNT + 1;

export function OvertakeResultOverlay({
  result,
  onNext,
  onRetry,
  onLevels,
}: OvertakeResultOverlayProps) {
  const { t } = useSettings();
  const revealed = useResultReveal(result !== null);
  if (!revealed || result === null) return null;

  const place = `${result.place}/${RACERS}`;
  const title = result.cleared
    ? t('overtakeResultCleared', { n: result.level })
    : t('overtakeResultPlaced', { n: result.level, place });
  const hasNext = result.nextLevel !== null;

  return (
    <div className="overlay overlay-result">
      <div
        className={`dialog result ${result.cleared ? 'result-clear' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="dialog-title">{title}</h2>

        <dl className="result-facts ot-result-facts">
          <div className="ot-result-place">
            <dt>{t('overtakePlace')}</dt>
            <dd>{place}</dd>
          </div>
          <div>
            <dt>{t('overtakeBumps')}</dt>
            <dd>{result.bumps}</dd>
          </div>
        </dl>

        <div className="result-actions">
          {hasNext ? (
            <button type="button" className="btn btn-primary" onClick={onNext} autoFocus>
              {t('nextLevel')}
            </button>
          ) : null}
          <button
            type="button"
            className={`btn ${hasNext ? 'btn-secondary' : 'btn-primary'}`}
            onClick={onRetry}
            autoFocus={!hasNext}
          >
            {t('tryAgain')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onLevels}>
            {t('levelsTitle')}
          </button>
        </div>
        <ShareAction
          gameId="overtake"
          outcome={result.outcome}
          details={[
            { value: t('modeLevel', { n: result.level }) },
            { label: t('overtakePlace'), value: place },
            { label: t('overtakeBumps'), value: String(result.bumps) },
          ]}
        />
      </div>
      <ResultAdSlot />
    </div>
  );
}
