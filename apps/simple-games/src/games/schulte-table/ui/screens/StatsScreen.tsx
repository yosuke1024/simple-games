import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { SIZES, type Size } from '../../game';
import { useSchulte } from '../../state/GameContext';
import { clearedDailyCount, clearedLevelCount } from '../../state/statsLogic';
import { sizeKey } from '../../storage/schemas';

/**
 * Statistics per board size (docs/SCHULTE_TABLE_RULES.md §10): counts, fastest
 * time, total time, and every wrong tap ever made. No score and no streak.
 * Everything here is local — there is no ranking to compare against.
 *
 * Wrong taps are a running total rather than a best, on purpose (§9): a
 * "fewest misses" record is set by tapping slowly.
 */
export function SchulteStatsScreen() {
  const { goHome, stats, progress } = useSchulte();
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
              <dt>{t('schulteLevelsDone')}</dt>
              <dd>{clearedLevelCount(progress)}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('schulteDailiesDone')}</dt>
              <dd>{clearedDailyCount(progress)}</dd>
            </div>
          </dl>
        </section>

        {SIZES.map((size: Size) => {
          const bucket = stats[sizeKey(size)];
          return (
            <section key={size} className="stats-section">
              <h2 className="stats-title">{t('schulteSizeLabel', { n: size })}</h2>
              <dl className="stats-grid">
                <div className="stats-row">
                  <dt>{t('played')}</dt>
                  <dd>{bucket.played}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('cleared')}</dt>
                  <dd>{bucket.cleared}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('bestTime')}</dt>
                  <dd>{bucket.bestSeconds === null ? '—' : formatDuration(bucket.bestSeconds)}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('schulteTotalMisses')}</dt>
                  <dd>{bucket.totalMisses}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('totalTime')}</dt>
                  <dd>{formatDuration(bucket.totalPlaySeconds)}</dd>
                </div>
              </dl>
            </section>
          );
        })}
      </div>
    </div>
  );
}
