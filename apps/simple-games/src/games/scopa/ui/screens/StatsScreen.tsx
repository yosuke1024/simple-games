/**
 * Statistics (docs/SCOPA_RULES.md §8): four numbers and nothing else —
 * matches played (counted when they start), won, lost, and total time. No
 * streak, no best score, no average, no draws column (eleven or more and
 * ahead is always one side, §3.4), and no deals — they are the innings of a
 * match. Everything is local; there is no rating and no ranking. The values
 * are shown as stored, never reconciled with each other (§9.4).
 */
import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { useScopa } from '../../state/GameContext';

export function ScopaStatsScreen() {
  const { goHome, stats } = useScopa();
  const { t } = useSettings();

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
            <div className="stats-row">
              <dt>{t('played')}</dt>
              <dd>{stats.played}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('scopaWins')}</dt>
              <dd>{stats.wins}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('scopaLosses')}</dt>
              <dd>{stats.losses}</dd>
            </div>
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
