import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { useDominoes } from '../../state/GameContext';

/**
 * Statistics (docs/DOMINOES_RULES.md §8): one record against the one
 * opponent, and total time. No streak — there is nothing here that punishes a
 * day off. Everything is local; there is no rating and no ranking.
 */
export function DominoesStatsScreen() {
  const { goHome, stats } = useDominoes();
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
          <dl className="stats-grid">
            <div className="stats-row">
              <dt>{t('played')}</dt>
              <dd>{stats.played}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('dominoesWins')}</dt>
              <dd>{stats.wins}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('dominoesLosses')}</dt>
              <dd>{stats.losses}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('dominoesDraws')}</dt>
              <dd>{stats.draws}</dd>
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
