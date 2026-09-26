/**
 * Statistics per difficulty (docs/SHAPE_REGIONS_RULES.md §10): puzzles
 * played, puzzles solved, fastest clear, total play time — plus how many
 * days the daily was cleared. All local; there is no ranking to compare
 * against, and no streak, because none is kept (§9).
 */
import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { DIFFICULTIES, type Difficulty } from '../../game';
import { useShapeRegions } from '../../state/GameContext';
import { dailiesCleared } from '../../state/statsLogic';

export function ShapeRegionsStatsScreen() {
  const { goHome, stats } = useShapeRegions();
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
              <h2 className="stats-title">{t(`shapeRegionsDifficulty_${difficulty}`)}</h2>
              <dl className="stats-grid">
                <div className="stats-row">
                  <dt>{t('played')}</dt>
                  <dd>{bucket.played}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('shapeRegionsSolvedCount')}</dt>
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
          <h2 className="stats-title">{t('shapeRegionsDailySection')}</h2>
          <dl className="stats-grid">
            <div className="stats-row">
              <dt>{t('shapeRegionsDailiesCleared')}</dt>
              <dd>{dailiesCleared(stats)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
