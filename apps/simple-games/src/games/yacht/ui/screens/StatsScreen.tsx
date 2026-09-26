import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { useYacht } from '../../state/GameContext';
import { averageScore } from '../../state/statsLogic';

/**
 * Statistics (docs/YACHT_RULES.md §6): one record for the whole game, and
 * total time. No streak — there is nothing here that punishes a day off.
 * Everything is local; there is no ranking, only your own sheets.
 */
export function YachtStatsScreen() {
  const { goHome, stats } = useYacht();
  const { t } = useSettings();
  const average = averageScore(stats);

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
              <dt>{t('yachtCompleted')}</dt>
              <dd>{stats.completed}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('yachtBestScore')}</dt>
              <dd>{stats.bestScore ?? '—'}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('yachtAverage')}</dt>
              <dd>{average ?? '—'}</dd>
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
