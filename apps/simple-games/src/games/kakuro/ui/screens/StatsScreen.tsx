import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { SIZES, type Size } from '../../game';
import { useKakuro } from '../../state/GameContext';
import { solvedDailyCount, solvedLevelCount } from '../../state/statsLogic';
import { sizeKey } from '../../storage/schemas';

/**
 * Statistics per board size (docs/KAKURO_RULES.md §10): counts, fastest and
 * total time. No score, no streak, and no difficulty column — this game has no
 * tiers at all (§7), and a player picks a level number, so a table cut any
 * other way would be cut along an axis nobody chooses. The headings are the
 * dimensions rather than the band names, because a name would have to be
 * translated and `8×8` does not (§10). Everything here is local; there is no
 * ranking to compare against.
 */
export function KakuroStatsScreen() {
  const { goHome, stats, progress } = useKakuro();
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
              <dt>{t('kakuroLevelsSolved')}</dt>
              <dd>{solvedLevelCount(progress)}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('kakuroDailiesSolved')}</dt>
              <dd>{solvedDailyCount(progress)}</dd>
            </div>
          </dl>
        </section>

        {SIZES.map((size: Size) => {
          const bucket = stats[sizeKey(size)];
          return (
            <section key={size} className="stats-section">
              <h2 className="stats-title">{t('kakuroSizeLabel', { n: size })}</h2>
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
