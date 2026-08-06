import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { useBlockPuzzle } from '../../state/GameContext';

/**
 * Statistics (docs/BLOCK_PUZZLE_RULES.md §9): games played, the personal
 * best, lines cleared in total, and total time. No streak, and no ranking to
 * compare against — everything here is local, and it is the whole record.
 */
export function BlockStatsScreen() {
  const { goHome, stats } = useBlockPuzzle();
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
          <h2 className="stats-title">{t('blockName')}</h2>
          <dl className="stats-grid">
            <div className="stats-row">
              <dt>{t('played')}</dt>
              <dd>{stats.played}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('blockBestScore')}</dt>
              <dd>{stats.bestScore}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('blockLines')}</dt>
              <dd>{stats.linesCleared}</dd>
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
