/**
 * Statistics (docs/OVERTAKE_RULES.md §9「統計」): races played and the total
 * time spent racing, and how far up the hundred. Nothing per level — no
 * places, no times, no bumps kept — and no streak. The total play time is
 * the only time this game ever shows, and it is not a race's.
 */
import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { LEVEL_COUNT } from '../../game/levels';
import { useOvertake } from '../../state/GameContext';
import { clearedLevels } from '../../state/statsLogic';

export function OvertakeStatsScreen() {
  const { goHome, stats, progress } = useOvertake();
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
              <dt>{t('levelsCleared')}</dt>
              <dd>
                {clearedLevels(progress)}/{LEVEL_COUNT}
              </dd>
            </div>
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
