import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { useIndianRummy } from '../../state/GameContext';
export function StatsScreen() {
  const { t } = useSettings();
  const { stats, goHome } = useIndianRummy();
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
            {[
              { label: t('indianRummyPlayed'), value: stats.played },
              { label: t('indianRummyFinished'), value: stats.completed },
              { label: t('indianRummyWins'), value: stats.wins },
              { label: t('indianRummyDraws'), value: stats.draws },
              { label: t('totalTime'), value: formatDuration(stats.totalPlaySeconds) },
            ].map((row) => (
              <div className="stats-row" key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
