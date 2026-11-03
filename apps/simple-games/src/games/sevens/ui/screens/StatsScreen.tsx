import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { useSevens } from '../../state/GameContext';
export function StatsScreen() {
  const { t } = useSettings();
  const { stats, goHome } = useSevens();
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
              { label: t('sevensPlayed'), value: stats.played },
              { label: t('sevensFinished'), value: stats.completed },
              { label: t('sevensWins'), value: stats.wins },
              { label: t('totalTime'), value: formatDuration(stats.totalPlaySeconds) },
            ].map((row) => (
              <div className="stats-row" key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="stats-section">
          <h2 className="stats-title">{t('sevensPlace')}</h2>
          <dl className="stats-grid">
            {stats.placements.map((n, i) => (
              <div className="stats-row" key={i}>
                <dt>{t('sevensPlaceValue', { n: i + 1 })}</dt>
                <dd>{n}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
