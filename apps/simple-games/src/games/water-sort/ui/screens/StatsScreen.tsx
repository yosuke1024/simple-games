import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { useWaterSort } from '../../state/GameContext';
import { solvedDailyCount, solvedLevelCount } from '../../state/statsLogic';

/**
 * Statistics (docs/WATER_SORT_RULES.md §9): counts and totals. No score and
 * no streak. Everything here is local — there is no ranking to compare
 * against.
 */
export function WaterStatsScreen() {
  const { goHome, stats, progress } = useWaterSort();
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
              <dt>{t('waterLevelsSolved')}</dt>
              <dd>{solvedLevelCount(progress)}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('waterDailiesSolved')}</dt>
              <dd>{solvedDailyCount(progress)}</dd>
            </div>
          </dl>
        </section>

        <section className="stats-section">
          <h2 className="stats-title">{t('statistics')}</h2>
          <dl className="stats-grid">
            <div className="stats-row">
              <dt>{t('played')}</dt>
              <dd>{stats.played}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('cleared')}</dt>
              <dd>{stats.solved}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('totalTime')}</dt>
              <dd>{formatDuration(stats.totalPlaySeconds)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
