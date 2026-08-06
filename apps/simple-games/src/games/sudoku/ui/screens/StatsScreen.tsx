import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { DIFFICULTIES, type Difficulty } from '../../game';
import { useSudoku } from '../../state/GameContext';
import { averageSolveSeconds, solvedLevelCount } from '../../state/statsLogic';

/**
 * Statistics per difficulty (docs/SUDOKU_RULES.md §12): counts and times, no
 * score and no streak. Everything here is local — there is no ranking to
 * compare against.
 */
export function SudokuStatsScreen() {
  const { goHome, stats, progress } = useSudoku();
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
          <h2 className="stats-title">{t('levelsTitle')}</h2>
          <dl className="stats-grid">
            <div className="stats-row">
              <dt>{t('reachedLevel')}</dt>
              <dd>{progress.highestUnlocked}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('sudokuLevelsSolved')}</dt>
              <dd>{solvedLevelCount(progress)}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('sudokuDailiesSolved')}</dt>
              <dd>{Object.keys(progress.dailyTimes).length}</dd>
            </div>
          </dl>
        </section>

        {DIFFICULTIES.map((difficulty: Difficulty) => {
          const bucket = stats[difficulty];
          const average = averageSolveSeconds(stats, difficulty);
          return (
            <section key={difficulty} className="stats-section">
              <h2 className="stats-title">{t(`sudokuTier_${difficulty}`)}</h2>
              <dl className="stats-grid">
                <div className="stats-row">
                  <dt>{t('played')}</dt>
                  <dd>{bucket.played}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('cleared')}</dt>
                  <dd>{bucket.solved}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('totalTime')}</dt>
                  <dd>{formatDuration(bucket.totalPlaySeconds)}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('bestTime')}</dt>
                  <dd>{bucket.bestSeconds === null ? '—' : formatDuration(bucket.bestSeconds)}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('sudokuAverageTime')}</dt>
                  <dd>{average === null ? '—' : formatDuration(average)}</dd>
                </div>
              </dl>
            </section>
          );
        })}
      </div>
    </div>
  );
}
