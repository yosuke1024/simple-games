import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { useGame2048 } from '../../state/GameContext';
import { dailiesPlayedCount } from '../../state/statsLogic';
import type { ModeStats } from '../../storage/schemas';

/**
 * Statistics per mode (docs/GAME_2048_RULES.md §8): games played, best score,
 * highest tile, how often 2048 was made, and time spent. No streak and no
 * ranking — everything here is local, and there is nothing to compare against.
 */
export function Game2048StatsScreen() {
  const { goHome, stats, progress } = useGame2048();
  const { t } = useSettings();

  const sections: readonly { title: string; bucket: ModeStats }[] = [
    { title: t('g2048ModeClassic'), bucket: stats.classic },
    { title: t('modeDaily'), bucket: stats.daily },
  ];

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
        {sections.map(({ title, bucket }) => (
          <section key={title} className="stats-section">
            <h2 className="stats-title">{title}</h2>
            <dl className="stats-grid">
              <div className="stats-row">
                <dt>{t('played')}</dt>
                <dd>{bucket.played}</dd>
              </div>
              <div className="stats-row">
                <dt>{t('g2048BestScore')}</dt>
                <dd>{bucket.bestScore}</dd>
              </div>
              <div className="stats-row">
                <dt>{t('g2048BestTile')}</dt>
                <dd>{bucket.bestTile === 0 ? '—' : bucket.bestTile}</dd>
              </div>
              <div className="stats-row">
                <dt>{t('g2048Wins')}</dt>
                <dd>{bucket.wins}</dd>
              </div>
              <div className="stats-row">
                <dt>{t('totalTime')}</dt>
                <dd>{formatDuration(bucket.totalPlaySeconds)}</dd>
              </div>
            </dl>
          </section>
        ))}

        <section className="stats-section">
          <h2 className="stats-title">{t('dailyChallenge')}</h2>
          <dl className="stats-grid">
            <div className="stats-row">
              <dt>{t('g2048DaysPlayed')}</dt>
              <dd>{dailiesPlayedCount(progress)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
