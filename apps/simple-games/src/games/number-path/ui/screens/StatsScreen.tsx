/**
 * Statistics per difficulty (docs/NUMBER_PATH_RULES.md §8): boards played,
 * boards solved, fastest solve, total play time — plus how many days the
 * daily was solved. All local; there is no ranking to compare against, and
 * no streak, because none is kept (§7).
 */
import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { DIFFICULTIES, type Difficulty } from '../../game';
import { useNumberPath } from '../../state/GameContext';
import { dailiesSolved } from '../../state/statsLogic';

export function NumberPathStatsScreen() {
  const { goHome, stats } = useNumberPath();
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
        {DIFFICULTIES.map((difficulty: Difficulty) => {
          const bucket = stats[difficulty];
          return (
            <section key={difficulty} className="stats-section">
              <h2 className="stats-title">{t(`numberPathDifficulty_${difficulty}`)}</h2>
              <dl className="stats-grid">
                <div className="stats-row">
                  <dt>{t('played')}</dt>
                  <dd>{bucket.played}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('numberPathSolvedCount')}</dt>
                  <dd>{bucket.solved}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('bestTime')}</dt>
                  <dd>{bucket.bestSeconds === null ? '—' : formatDuration(bucket.bestSeconds)}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('totalTime')}</dt>
                  <dd>{formatDuration(bucket.totalPlaySeconds)}</dd>
                </div>
              </dl>
            </section>
          );
        })}

        <section className="stats-section">
          <h2 className="stats-title">{t('numberPathDailySection')}</h2>
          <dl className="stats-grid">
            <div className="stats-row">
              <dt>{t('numberPathDailiesSolved')}</dt>
              <dd>{dailiesSolved(stats)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
