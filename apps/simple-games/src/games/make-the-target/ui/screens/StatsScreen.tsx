/**
 * Statistics (docs/MAKE_THE_TARGET_RULES.md §9): per difficulty, problems
 * played, problems solved, the fastest clear and the play time; for the
 * daily, its plays, the days it was cleared and its play time; and the play
 * time across every mode. All local; there is no ranking to compare against,
 * and no streak, because none is kept (§8). The wording follows Bridges until
 * the owner settles one rule for the shelf (provisional — §17).
 */
import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { DIFFICULTIES, type Difficulty } from '../../game';
import { useMakeTheTarget } from '../../state/GameContext';
import { dailiesCleared, totalPlaySeconds } from '../../state/statsLogic';

export function MakeTheTargetStatsScreen() {
  const { goHome, stats } = useMakeTheTarget();
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
              <h2 className="stats-title">{t(`makeTheTargetDifficulty_${difficulty}`)}</h2>
              <dl className="stats-grid">
                <div className="stats-row">
                  <dt>{t('played')}</dt>
                  <dd>{bucket.played}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('makeTheTargetSolvedCount')}</dt>
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
          <h2 className="stats-title">{t('makeTheTargetDailySection')}</h2>
          <dl className="stats-grid">
            <div className="stats-row">
              <dt>{t('played')}</dt>
              <dd>{stats.daily.played}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('makeTheTargetDailiesCleared')}</dt>
              <dd>{dailiesCleared(stats)}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('totalTime')}</dt>
              <dd>{formatDuration(stats.daily.totalPlaySeconds)}</dd>
            </div>
          </dl>
        </section>

        <section className="stats-section">
          <h2 className="stats-title">{t('makeTheTargetAllModes')}</h2>
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
