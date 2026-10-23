import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { useFallingBlocks } from '../../state/GameContext';
export function StatsScreen() {
  const { t } = useSettings();
  const { stats, goHome } = useFallingBlocks();
  const facts = [
    { label: t('played'), value: stats.played },
    { label: t('fallingBlocksBest'), value: stats.bestScore },
    { label: t('fallingBlocksLines'), value: stats.linesCleared },
    { label: t('totalTime'), value: formatDuration(stats.totalPlaySeconds) },
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
            {facts.map((fact) => (
              <div className="stats-row" key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
