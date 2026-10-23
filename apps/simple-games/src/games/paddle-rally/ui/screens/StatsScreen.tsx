import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { MODES } from '../../game';
import { usePaddleRally } from '../../state/GameContext';
export function StatsScreen() {
  const { t } = useSettings(),
    { stats, goHome } = usePaddleRally();
  return (
    <div className="screen stats-screen">
      <header className="screen-header">
        <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
          <IconBack />
        </button>
        <h1>{t('statistics')}</h1>
        <span />
      </header>
      <div className="stats-body">
        {MODES.map((mode) => (
          <section className="stats-section" key={mode}>
            <h2 className="stats-title">{t(`paddleRallyMode_${mode}`)}</h2>
            <dl className="stats-grid">
              <div className="stats-row">
                <dt>{t('played')}</dt>
                <dd>{stats[mode].played}</dd>
              </div>
              <div className="stats-row">
                <dt>{t('paddleRallyWins')}</dt>
                <dd>{stats[mode].wins}</dd>
              </div>
              <div className="stats-row">
                <dt>{t('paddleRallyLosses')}</dt>
                <dd>{stats[mode].losses}</dd>
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
