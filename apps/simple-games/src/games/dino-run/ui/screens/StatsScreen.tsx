import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { useDinoRun } from '../../state/GameContext';

/**
 * Statistics (docs/DINO_RUN_RULES.md §9): counts, one best score, and totals.
 * No streak. Everything here is local — there is no ranking to compare
 * against, and no leaderboard to put a name into.
 */
export function DinoStatsScreen() {
  const { goHome, stats } = useDinoRun();
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
          <h2 className="stats-title">{t('statistics')}</h2>
          <dl className="stats-grid">
            <div className="stats-row">
              <dt>{t('dinoBestScore')}</dt>
              <dd>{stats.bestScore}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('played')}</dt>
              <dd>{stats.played}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('dinoObstaclesPassed')}</dt>
              <dd>{stats.obstaclesPassed}</dd>
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
