import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { DIFFICULTIES, LAYOUTS, type Difficulty } from '../../game';
import { useMemoryMatch } from '../../state/GameContext';
import { solvedDailyCount } from '../../state/statsLogic';

/**
 * Statistics per board (docs/MEMORY_MATCH_RULES.md §9): counts, fewest moves,
 * fastest and total time. No score and no streak. Everything here is local —
 * there is no ranking to compare against.
 */
export function MemoryStatsScreen() {
  const { goHome, stats } = useMemoryMatch();
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
          <h2 className="stats-title">{t('dailyChallenge')}</h2>
          <dl className="stats-grid">
            <div className="stats-row">
              <dt>{t('memoryDailiesCleared')}</dt>
              <dd>{solvedDailyCount(stats)}</dd>
            </div>
          </dl>
        </section>

        {DIFFICULTIES.map((difficulty: Difficulty) => {
          const layout = LAYOUTS[difficulty];
          const bucket = stats[difficulty];
          return (
            <section key={difficulty} className="stats-section">
              <h2 className="stats-title">
                {t(`memoryDifficulty_${difficulty}`)} · {layout.cols}×{layout.rows}
              </h2>
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
                  <dt>{t('memoryBestMoves')}</dt>
                  <dd>{bucket.bestMoves === null ? '—' : bucket.bestMoves}</dd>
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
      </div>
    </div>
  );
}
