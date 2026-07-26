import { useApp } from '../../state/AppContext';
import { useSettings } from '../../state/SettingsContext';
import type { ModeStats } from '../../storage/schemas';
import { formatDuration } from '../format';

function StatsSection({
  title,
  stats,
  extraRows,
}: {
  title: string;
  stats: ModeStats;
  extraRows?: { label: string; value: string }[];
}) {
  const { t } = useSettings();
  const rows = [
    { label: t('played'), value: String(stats.played) },
    { label: t('cleared'), value: String(stats.cleared) },
    { label: t('gameOverCount'), value: String(stats.gameOver) },
    { label: t('totalTime'), value: formatDuration(stats.totalPlaySeconds) },
    {
      label: t('bestTime'),
      value: stats.bestClearSeconds === null ? '—' : formatDuration(stats.bestClearSeconds),
    },
    ...(extraRows ?? []),
  ];
  return (
    <section className="stats-section">
      <h2 className="stats-title">{title}</h2>
      <dl className="stats-grid">
        {rows.map((row) => (
          <div key={row.label} className="stats-row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function StatsScreen() {
  const { goHome, stats, dailyStreakToday } = useApp();
  const { t } = useSettings();
  return (
    <div className="screen stats-screen">
      <header className="screen-header">
        <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
          ←
        </button>
        <h1>{t('statistics')}</h1>
        <span className="icon-btn-placeholder" />
      </header>
      <div className="stats-body">
        <StatsSection title={t('modeClassic')} stats={stats.classic} />
        <StatsSection
          title={t('dailyChallenge')}
          stats={stats.daily}
          extraRows={[
            { label: t('streak'), value: String(dailyStreakToday) },
            { label: t('bestStreak'), value: String(stats.daily.bestStreak) },
          ]}
        />
      </div>
    </div>
  );
}
