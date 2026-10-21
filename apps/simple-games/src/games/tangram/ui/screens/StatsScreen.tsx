/**
 * Statistics (docs/TANGRAM_RULES.md §7): per tier, the figures started, the
 * completions, how many different figures have been completed — a count,
 * never "n of N", so nothing here lists what is left undone — and the play
 * time; then the daily's own row (started, days completed, play time), and
 * the play time across everything. All local: no ranking, and no streak,
 * because none is kept.
 */
import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { TIERS } from '../../game';
import { useTangram } from '../../state/GameContext';
import { dailiesCompleted, solvedFiguresOf, totalPlaySeconds } from '../../state/statsLogic';

export function TangramStatsScreen() {
  const { goHome, stats, progress } = useTangram();
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
        {TIERS.map((tier) => {
          const row = stats[tier];
          return (
            <section key={tier} className="stats-section">
              <h2 className="stats-title">{t(`tangramTier_${tier}`)}</h2>
              <dl className="stats-grid">
                <div className="stats-row">
                  <dt>{t('tangramStatStarted')}</dt>
                  <dd>{row.played}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('tangramStatCompleted')}</dt>
                  <dd>{row.solved}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('tangramStatDifferent')}</dt>
                  <dd>{solvedFiguresOf(progress, tier)}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('totalTime')}</dt>
                  <dd>{formatDuration(row.totalPlaySeconds)}</dd>
                </div>
              </dl>
            </section>
          );
        })}

        <section className="stats-section">
          <h2 className="stats-title">{t('dailyChallenge')}</h2>
          <dl className="stats-grid">
            <div className="stats-row">
              <dt>{t('tangramStatStarted')}</dt>
              <dd>{stats.daily.played}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('tangramStatDays')}</dt>
              <dd>{dailiesCompleted(stats)}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('totalTime')}</dt>
              <dd>{formatDuration(stats.daily.totalPlaySeconds)}</dd>
            </div>
          </dl>
        </section>

        <section className="stats-section">
          <h2 className="stats-title">{t('tangramStatsAll')}</h2>
          <dl className="stats-grid">
            <div className="stats-row">
              <dt>{t('totalTime')}</dt>
              <dd>{formatDuration(totalPlaySeconds(stats))}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
