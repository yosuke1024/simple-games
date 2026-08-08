import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { SIZES, type Size } from '../../game';
import { useFutoshiki } from '../../state/GameContext';
import { solvedDailyCount, solvedLevelCount } from '../../state/statsLogic';
import { sizeKey } from '../../storage/schemas';

/**
 * Statistics per board size (docs/FUTOSHIKI_RULES.md §10): counts, fastest and
 * total time. No score, no streak, and no tier column — a player picks a level
 * number, so a table cut by tier would be cut along an axis nobody chooses.
 * Everything here is local; there is no ranking to compare against.
 */
export function FutoshikiStatsScreen() {
  const { goHome, stats, progress } = useFutoshiki();
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
              <dt>{t('futoshikiLevelsSolved')}</dt>
              <dd>{solvedLevelCount(progress)}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('futoshikiDailiesSolved')}</dt>
              <dd>{solvedDailyCount(progress)}</dd>
            </div>
          </dl>
        </section>

        {SIZES.map((size: Size) => {
          const bucket = stats[sizeKey(size)];
          return (
            <section key={size} className="stats-section">
              <h2 className="stats-title">{t('futoshikiSizeLabel', { n: size })}</h2>
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
      </div>
    </div>
  );
}
