import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { useMahjong } from '../../state/GameContext';
import { clearedDailyCount, clearedLevelCount } from '../../state/statsLogic';

/**
 * Statistics (docs/MAHJONG_SOLITAIRE_RULES.md §9): counts and total time.
 * No score and no streak. Per-board best times live where the board is
 * fixed — on the level list and the daily list — because boards from 24 to
 * 144 tiles share no meaningful "fastest". Everything here is local; there
 * is no ranking to compare against.
 */
export function MahjongStatsScreen() {
  const { goHome, stats, progress } = useMahjong();
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
              <dt>{t('mahjongLevelsCleared')}</dt>
              <dd>{clearedLevelCount(progress)}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('mahjongDailiesCleared')}</dt>
              <dd>{clearedDailyCount(progress)}</dd>
            </div>
          </dl>
        </section>

        <section className="stats-section">
          <h2 className="stats-title">{t('mahjongName')}</h2>
          <dl className="stats-grid">
            <div className="stats-row">
              <dt>{t('played')}</dt>
              <dd>{stats.played}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('cleared')}</dt>
              <dd>{stats.cleared}</dd>
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
