import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { SIZES, type Size } from '../../game';
import { useRecall } from '../../state/GameContext';
import { clearedDailyCount, clearedLevelCount } from '../../state/statsLogic';
import { sizeKey } from '../../storage/schemas';

/**
 * Statistics per board size (docs/NUMBER_RECALL_RULES.md §11): rounds started
 * and finished, fastest time, total time, and how many were done at the first
 * attempt. No score and no streak. Everything here is local — there is no
 * ranking to compare against.
 *
 * "Played" counts every look at a layout, retries included, so it is always at
 * least as large as "finished" — a round that ended in a wrong tile was still
 * a round (§8).
 */
export function RecallStatsScreen() {
  const { goHome, stats, progress } = useRecall();
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
              <dt>{t('recallLevelsDone')}</dt>
              <dd>{clearedLevelCount(progress)}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('recallDailiesDone')}</dt>
              <dd>{clearedDailyCount(progress)}</dd>
            </div>
          </dl>
        </section>

        {SIZES.map((size: Size) => {
          const bucket = stats[sizeKey(size)];
          return (
            <section key={size} className="stats-section">
              <h2 className="stats-title">{t('recallSizeLabel', { n: size })}</h2>
              <dl className="stats-grid">
                <div className="stats-row">
                  <dt>{t('played')}</dt>
                  <dd>{bucket.played}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('cleared')}</dt>
                  <dd>{bucket.cleared}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('bestTime')}</dt>
                  <dd>{bucket.bestSeconds === null ? '—' : formatDuration(bucket.bestSeconds)}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('recallFirstTry')}</dt>
                  <dd>{bucket.firstTryClears}</dd>
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
