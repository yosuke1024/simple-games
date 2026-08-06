import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { useGame2048 } from '../../state/GameContext';

/**
 * Statistics (docs/GAME_2048_RULES.md §9): games played, the two records, how
 * often 2048 has been reached, and total time. No streak — there is nothing
 * here that punishes a day off. Everything is local; there is no ranking to
 * compare against, only your own history (§7).
 */
export function Game2048StatsScreen() {
  const { goHome, stats } = useGame2048();
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
          <h2 className="stats-title">{t('mergeName')}</h2>
          <dl className="stats-grid">
            <div className="stats-row">
              <dt>{t('played')}</dt>
              <dd>{stats.played}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('mergeBestScore')}</dt>
              <dd>{stats.bestScore}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('mergeBestTile')}</dt>
              <dd>{stats.bestTile === 0 ? '—' : stats.bestTile}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('mergeReachedCount')}</dt>
              <dd>{stats.reached2048}</dd>
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
