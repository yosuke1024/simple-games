import { useApp } from '../../state/AppContext';
import { totalBestScore } from '../../state/progressLogic';
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

/** The quiet personal ranking: local best scores only, no server. */
function BestScoresSection() {
  const { progress } = useApp();
  const { t, locale } = useSettings();
  /** Localizes a YYYY-MM-DD daily ref for display. */
  const formatDailyRef = (ref: string): string => {
    const [y, m, d] = ref.split('-').map(Number);
    if (!y || !m || !d) return ref;
    return new Date(y, m - 1, d).toLocaleDateString(locale);
  };
  return (
    <section className="stats-section">
      <h2 className="stats-title">{t('bestScores')}</h2>
      <dl className="stats-grid">
        <div className="stats-row">
          <dt>{t('reachedLevel')}</dt>
          <dd>{progress.highestUnlocked}</dd>
        </div>
        <div className="stats-row">
          <dt>{t('totalBest')}</dt>
          <dd>{totalBestScore(progress)}</dd>
        </div>
      </dl>
      {progress.topScores.length > 0 ? (
        <ol className="top-scores">
          {progress.topScores.map((entry, index) => (
            <li key={`${entry.mode}-${entry.ref}`} className="top-score-row">
              <span className="top-score-rank">{index + 1}</span>
              <span className="top-score-ref">
                {entry.mode === 'daily'
                  ? `${t('modeDaily')} ${formatDailyRef(entry.ref)}`
                  : t('modeLevel', { n: entry.ref })}
              </span>
              <span className="top-score-date">
                {new Date(entry.at).toLocaleDateString(locale)}
              </span>
              <span className="top-score-value">{entry.score}</span>
            </li>
          ))}
        </ol>
      ) : null}
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
        <BestScoresSection />
        <StatsSection title={t('levelsTitle')} stats={stats.level} />
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
