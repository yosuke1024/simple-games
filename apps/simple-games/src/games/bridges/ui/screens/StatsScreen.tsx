/**
 * Statistics (docs/BRIDGES_RULES.md §11): per difficulty, boards played,
 * boards solved, fastest clear and play time; for the daily, the days it was
 * cleared and its play time; and the play time across every mode. All local;
 * there is no ranking to compare against, and no streak, because none is kept
 * (§8).
 */
import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { DIFFICULTIES, type Difficulty } from '../../game';
import { useBridges } from '../../state/GameContext';
import { dailiesCleared, totalPlaySeconds } from '../../state/statsLogic';

export function BridgesStatsScreen() {
  const { goHome, stats } = useBridges();
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
              <h2 className="stats-title">{t(`bridgesDifficulty_${difficulty}`)}</h2>
              <dl className="stats-grid">
                <div className="stats-row">
                  <dt>{t('played')}</dt>
                  <dd>{bucket.played}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('bridgesSolvedCount')}</dt>
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
          <h2 className="stats-title">{t('bridgesDailySection')}</h2>
          <dl className="stats-grid">
            <div className="stats-row">
              <dt>{t('played')}</dt>
              <dd>{stats.daily.played}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('bridgesDailiesCleared')}</dt>
              <dd>{dailiesCleared(stats)}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('totalTime')}</dt>
              <dd>{formatDuration(stats.daily.totalPlaySeconds)}</dd>
            </div>
          </dl>
        </section>

        <section className="stats-section">
          <h2 className="stats-title">{t('bridgesAllModes')}</h2>
          <dl className="stats-grid">
            <div className="stats-row">
              <dt>{t('totalTime')}</dt>
              <dd>{formatDuration(totalPlaySeconds(stats))}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
