import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { useThreePeaks } from '../../state/GameContext';
export function ThreePeaksStatsScreen() {
  const { t } = useSettings();
  const { stats, goHome } = useThreePeaks();
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
        <dl className="stats-grid">
          <div className="stats-row">
            <dt>{t('played')}</dt>
            <dd>{stats.played}</dd>
          </div>
          <div className="stats-row">
            <dt>{t('threePeaksWins')}</dt>
            <dd>{stats.wins}</dd>
          </div>
          <div className="stats-row">
            <dt>{t('threePeaksBest')}</dt>
            <dd>{stats.bestRemaining ?? '—'}</dd>
          </div>
          <div className="stats-row">
            <dt>{t('totalTime')}</dt>
            <dd>{formatDuration(stats.totalPlaySeconds)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
