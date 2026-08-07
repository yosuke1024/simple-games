import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import type { StatsBucket } from '../../game';
import { useQuickMath } from '../../state/GameContext';
import { clearedDailyCount, clearedLevelCount } from '../../state/statsLogic';
import { STATS_BUCKETS } from '../../storage/schemas';

/**
 * Statistics per band, plus one bucket for dailies (docs/QUICK_MATH_RULES.md
 * §10): counts, fastest time, total time, and every wrong answer ever given.
 * No score and no streak. Everything here is local — there is no ranking to
 * compare against.
 *
 * Wrong answers are a running total rather than a best, on purpose (§4): a
 * "fewest mistakes" record is set by answering slowly.
 */
const BUCKET_LABELS: Record<
  StatsBucket,
  | 'qmathBandAddSub'
  | 'qmathBandMultiply'
  | 'qmathBandDivide'
  | 'qmathBandMissing'
  | 'qmathBandMixed'
  | 'modeDaily'
> = {
  addSub: 'qmathBandAddSub',
  multiply: 'qmathBandMultiply',
  divide: 'qmathBandDivide',
  missing: 'qmathBandMissing',
  mixed: 'qmathBandMixed',
  daily: 'modeDaily',
};

export function QuickMathStatsScreen() {
  const { goHome, stats, progress } = useQuickMath();
  const { t } = useSettings();

  return (
    <div className="screen stats-screen">
      <header className="screen-header">
        <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
          <IconBack />
        </button>
        <h1>{t('statistics')}</h1>
        <span className="icon-btn-placeholder" />
      </header>

      <div className="stats-body">
        <section className="stats-section">
          <h2 className="stats-title">{t('levelsTitle')}</h2>
          <dl className="stats-grid">
            <div className="stats-row">
              <dt>{t('reachedLevel')}</dt>
              <dd>{progress.highestUnlocked}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('qmathLevelsDone')}</dt>
              <dd>{clearedLevelCount(progress)}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('qmathDailiesDone')}</dt>
              <dd>{clearedDailyCount(progress)}</dd>
            </div>
          </dl>
        </section>

        {STATS_BUCKETS.map((bucket) => {
          const value = stats[bucket];
          return (
            <section key={bucket} className="stats-section">
              <h2 className="stats-title">{t(BUCKET_LABELS[bucket])}</h2>
              <dl className="stats-grid">
                <div className="stats-row">
                  <dt>{t('played')}</dt>
                  <dd>{value.played}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('cleared')}</dt>
                  <dd>{value.cleared}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('bestTime')}</dt>
                  <dd>{value.bestSeconds === null ? '—' : formatDuration(value.bestSeconds)}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('qmathTotalMisses')}</dt>
                  <dd>{value.totalMisses}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('totalTime')}</dt>
                  <dd>{formatDuration(value.totalPlaySeconds)}</dd>
                </div>
              </dl>
            </section>
          );
        })}
      </div>
    </div>
  );
}
