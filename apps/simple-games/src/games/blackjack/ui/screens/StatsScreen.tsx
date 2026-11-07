import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { useBlackjack } from '../../state/GameContext';
export function StatsScreen() {
  const { t } = useSettings();
  const { stats, goHome } = useBlackjack();
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
              { label: t('blackjackPlayed'), value: stats.played },
              { label: t('blackjackFinished'), value: stats.completed },
              { label: t('blackjackWins'), value: stats.wins },
              { label: t('blackjackDraws'), value: stats.draws },
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
