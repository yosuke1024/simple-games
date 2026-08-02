import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { useSkyFighter } from '../../state/GameContext';
import { clearedLevelCount } from '../../state/statsLogic';

/**
 * Statistics (docs/SKY_FIGHTER_RULES.md §9): counts, one best score, and
 * totals. No streak. Everything here is local — there is no ranking to
 * compare against.
 */
export function SkyStatsScreen() {
  const { goHome, stats, progress } = useSkyFighter();
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
              <dt>{t('levelsCleared')}</dt>
              <dd>{clearedLevelCount(progress)}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('bestScore')}</dt>
              <dd>{stats.bestScore}</dd>
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
              <dd>{stats.cleared}</dd>
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
