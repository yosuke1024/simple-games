/**
 * Statistics per difficulty (docs/MINESWEEPER_RULES.md §9): games played, games
 * won, win rate, fastest win, total play time — plus how many days the daily
 * was cleared. All local; there is no ranking to compare against, and no
 * streak, because none is kept (§8).
 */
import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { DIFFICULTIES, type Difficulty } from '../../game';
import { useMinesweeper } from '../../state/GameContext';
import { dailiesCleared, winRate } from '../../state/statsLogic';

export function MinesStatsScreen() {
  const { goHome, stats } = useMinesweeper();
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
          const rate = winRate(stats, difficulty);
          return (
            <section key={difficulty} className="stats-section">
              <h2 className="stats-title">{t(`minesDifficulty_${difficulty}`)}</h2>
              <dl className="stats-grid">
                <div className="stats-row">
                  <dt>{t('played')}</dt>
                  <dd>{bucket.played}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('minesGamesWon')}</dt>
                  <dd>{bucket.won}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('minesWinRate')}</dt>
                  <dd>{rate === null ? '—' : `${Math.round(rate * 100)}%`}</dd>
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
          <h2 className="stats-title">{t('minesDailySection')}</h2>
          <dl className="stats-grid">
            <div className="stats-row">
              <dt>{t('minesDailiesCleared')}</dt>
              <dd>{dailiesCleared(stats)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
