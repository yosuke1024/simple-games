/**
 * Statistics (docs/BACKGAMMON_RULES.md §8): a record per opponent and the
 * time played, stated as counts. No streak, no gammon tally, no ranking.
 */
import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { DIFFICULTIES } from '../../game/types';
import { useBackgammon } from '../../state/GameContext';

export function BackgammonStatsScreen() {
  const { stats, goHome } = useBackgammon();
  const { t } = useSettings();

  return (
    <div className="screen stats-screen">
      <header className="screen-header">
        <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
          <IconBack />
        </button>
        <h1>{t('statistics')}</h1>
      </header>

      <div className="stats-list">
        {DIFFICULTIES.map((difficulty) => {
          const record = stats[difficulty];
          return (
            <section key={difficulty} className="stats-card">
              <h2 className="stats-card-title">{t(`backgammonDifficulty_${difficulty}`)}</h2>
              <dl className="stats-rows">
                <div className="stats-row">
                  <dt>{t('played')}</dt>
                  <dd>{record.played}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('backgammonStatsWins')}</dt>
                  <dd>{record.wins}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('backgammonStatsLosses')}</dt>
                  <dd>{record.losses}</dd>
                </div>
              </dl>
            </section>
          );
        })}
        <section className="stats-card">
          <dl className="stats-rows">
            <div className="stats-row">
              <dt>{t('backgammonStatsTime')}</dt>
              <dd>{formatDuration(stats.totalPlaySeconds)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
