import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { useInvaders } from '../../state/GameContext';
export function StatsScreen() {
  const { t } = useSettings();
  const { stats, goHome } = useInvaders();
  const facts = [
    [t('played'), stats.played],
    [t('cleared'), stats.cleared],
    [t('invadersBest'), stats.bestScore],
    [t('invadersBestStage'), stats.bestStage || '—'],
    [t('totalTime'), formatDuration(stats.totalPlaySeconds)],
  ];
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
            {facts.map(([label, value]) => (
              <div className="stats-row" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
