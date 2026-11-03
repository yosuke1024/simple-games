import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { MODES, CATALOG } from '../../game';
import { useRiverCargo } from '../../state/GameContext';
export function StatsScreen() {
  const { t } = useSettings();
  const { stats, goHome } = useRiverCargo();
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
            <h2 className="stats-title">{t(`riverCargoMode_${mode}`)}</h2>
            <dl className="stats-grid">
              {CATALOG.filter((p) => p.mode === mode).map((p) => (
                <div className="stats-row" key={p.id}>
                  <dt>{t('riverCargoPuzzle', { n: p.id.split('-')[1]! })}</dt>
                  <dd>
                    {stats.puzzles[p.id]?.best != null
                      ? t('riverCargoPuzzleBest', { n: stats.puzzles[p.id]!.best! })
                      : '—'}
                  </dd>
                </div>
              ))}
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
