/**
 * Statistics per difficulty (docs/SUDOKU_6X6_RULES.md §10): games played,
 * games solved, fastest solve, total play time — plus how many days the daily
 * was solved. All local; there is no ranking to compare against, and no
 * streak, because none is kept (§9).
 */
import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { DIFFICULTIES, type Difficulty } from '../../game';
import { useSudoku6x6 } from '../../state/GameContext';
import { dailiesSolved } from '../../state/statsLogic';
import { DIFFICULTY_KEY } from '../difficultyKey';

export function Sudoku6x6StatsScreen() {
  const { goHome, stats } = useSudoku6x6();
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
              <h2 className="stats-title">{t(DIFFICULTY_KEY[difficulty])}</h2>
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
          <h2 className="stats-title">{t('sudoku6x6DailySection')}</h2>
          <dl className="stats-grid">
            <div className="stats-row">
              <dt>{t('sudoku6x6DailiesSolved')}</dt>
              <dd>{dailiesSolved(stats)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
