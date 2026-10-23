import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { SIZES } from '../../game';
import { useColorFlood } from '../../state/GameContext';
export function StatsScreen() {
  const { t } = useSettings();
  const { stats, goHome } = useColorFlood();
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
        {SIZES.map((size) => (
          <section className="stats-section" key={size}>
            <h2 className="stats-title">
              {size} × {size}
            </h2>
            <dl className="stats-grid">
              <div className="stats-row">
                <dt>{t('played')}</dt>
                <dd>{stats.boards[size].played}</dd>
              </div>
              <div className="stats-row">
                <dt>{t('cleared')}</dt>
                <dd>{stats.boards[size].completed}</dd>
              </div>
              <div className="stats-row">
                <dt>{t('colorFloodBest')}</dt>
                <dd>{stats.boards[size].best ?? '—'}</dd>
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
