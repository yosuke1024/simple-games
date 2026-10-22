/**
 * Statistics (docs/ECHO_PADS_RULES.md §9, §13): per row — 4 pads, 6 pads,
 * the daily in a row of its own (interim, pending the owner) — the runs
 * started, cleared and ended by a miss, and the play time; the levels
 * cleared per tier; the days the daily was completed — a count, never a run
 * of days. All local: no ranking, no streak, no score.
 */
import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { LEVELS, STATS_ROWS, type StatsRow } from '../../game';
import { useEchoPads } from '../../state/GameContext';

export function EchoPadsStatsScreen() {
  const { goHome, stats, progress } = useEchoPads();
  const { t } = useSettings();

  const title = (row: StatsRow) =>
    row === 'daily'
      ? t('dailyChallenge')
      : t(row === 'pads4' ? 'echoPadsTier_4' : 'echoPadsTier_6');
  const tierLevels = (padCount: 4 | 6) => LEVELS.filter((spec) => spec.padCount === padCount);
  const clearedIn = (padCount: 4 | 6) =>
    tierLevels(padCount).filter((spec) => progress.cleared[spec.level - 1]).length;

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
        {STATS_ROWS.map((row) => {
          const counts = stats.rows[row];
          const padCount = row === 'pads4' ? 4 : 6;
          return (
            <section key={row} className="stats-section">
              <h2 className="stats-title">{title(row)}</h2>
              <dl className="stats-grid">
                <div className="stats-row">
                  <dt>{t('echoPadsStatStarted')}</dt>
                  <dd>{counts.played}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('echoPadsStatCleared')}</dt>
                  <dd>{counts.cleared}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('echoPadsStatMissed')}</dt>
                  <dd>{counts.failed}</dd>
                </div>
                {row === 'daily' ? (
                  <div className="stats-row">
                    <dt>{t('echoPadsStatDays')}</dt>
                    <dd>{stats.dailyDates.length}</dd>
                  </div>
                ) : (
                  <div className="stats-row">
                    <dt>{t('echoPadsStatLevels')}</dt>
                    <dd>
                      {clearedIn(padCount)}/{tierLevels(padCount).length}
                    </dd>
                  </div>
                )}
                <div className="stats-row">
                  <dt>{t('totalTime')}</dt>
                  <dd>{formatDuration(counts.seconds)}</dd>
                </div>
              </dl>
            </section>
          );
        })}
      </div>
    </div>
  );
}
