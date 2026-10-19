/**
 * Statistics (docs/UNBLOCK_PUZZLE_RULES.md §10): per difficulty, boards
 * played, boards cleared, boards cleared in exactly their fewest moves, the
 * fastest clear and the play time; then how many days the daily was cleared
 * and the play time across everything. All local; there is no ranking to
 * compare against, and no streak, because none is kept (§9).
 */
import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { DIFFICULTIES, type Difficulty } from '../../game';
import { useUnblockPuzzle } from '../../state/GameContext';
import { dailiesCleared, totalPlaySeconds } from '../../state/statsLogic';

export function UnblockPuzzleStatsScreen() {
  const { goHome, stats } = useUnblockPuzzle();
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
              <h2 className="stats-title">{t(`unblockPuzzleDifficulty_${difficulty}`)}</h2>
              <dl className="stats-grid">
                <div className="stats-row">
                  <dt>{t('played')}</dt>
                  <dd>{bucket.played}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('unblockPuzzleSolvedCount')}</dt>
                  <dd>{bucket.solved}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('unblockPuzzleOptimalCount')}</dt>
                  <dd>{bucket.optimal}</dd>
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
          <h2 className="stats-title">{t('unblockPuzzleOverallSection')}</h2>
          <dl className="stats-grid">
            <div className="stats-row">
              <dt>{t('unblockPuzzleDailiesCleared')}</dt>
              <dd>{dailiesCleared(stats)}</dd>
            </div>
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
