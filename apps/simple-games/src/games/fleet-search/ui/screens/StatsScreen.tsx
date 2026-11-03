import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { MODES } from '../../game';
import { useFleetSearch } from '../../state/GameContext';
export function StatsScreen() {
  const { t } = useSettings();
  const { stats, goHome } = useFleetSearch();
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
        {MODES.map((mode) => (
          <section className="stats-section" key={mode}>
            <h2 className="stats-title">{t(`fleetSearchMode_${mode}`)}</h2>
            <dl className="stats-grid">
              <div className="stats-row">
                <dt>{t('played')}</dt>
                <dd>{stats.boards[mode].played}</dd>
              </div>
              <div className="stats-row">
                <dt>{t('fleetSearchWins')}</dt>
                <dd>{stats.boards[mode].completed}</dd>
              </div>
              <div className="stats-row">
                <dt>{t('fleetSearchBest')}</dt>
                <dd>{stats.boards[mode].best ?? '—'}</dd>
              </div>
            </dl>
          </section>
        ))}
        <section className="stats-section">
          <dl className="stats-grid">
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
