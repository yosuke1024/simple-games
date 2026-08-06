import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { useSnake } from '../../state/GameContext';

/**
 * Statistics (docs/SNAKE_RULES.md §9): counts, two personal records, and one
 * total. No streak. Everything here is local — there is no ranking to compare
 * against, and nothing here has ever left the device.
 */
export function SnakeStatsScreen() {
  const { goHome, stats } = useSnake();
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
          <h2 className="stats-title">{t('snakeName')}</h2>
          <dl className="stats-grid">
            <div className="stats-row">
              <dt>{t('snakeBestScore')}</dt>
              <dd>{stats.bestScore}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('snakeBestLength')}</dt>
              <dd>{stats.bestLength}</dd>
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
              <dt>{t('totalTime')}</dt>
              <dd>{formatDuration(stats.totalPlaySeconds)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
