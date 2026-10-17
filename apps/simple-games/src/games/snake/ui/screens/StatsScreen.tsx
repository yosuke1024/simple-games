/**
 * Statistics (docs/SNAKE_RULES.md §10): four numbers per speed — best score,
 * runs played, full boards, time spent running — and no streak. Speeds are
 * listed apart because a score at Fast and the same score at Slow are not
 * the same run (§7). Everything here is local: there is no ranking to
 * compare against.
 */
import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { SPEEDS } from '../../game';
import { useSnake } from '../../state/GameContext';

export function SnakeStatsScreen() {
  const { goHome, stats } = useSnake();
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
        {SPEEDS.map((speed) => {
          const record = stats[speed];
          return (
            <section key={speed} className="stats-section">
              <h2 className="stats-title">{t(`snakeSpeed_${speed}`)}</h2>
              <dl className="stats-grid">
                <div className="stats-row">
                  <dt>{t('snakeBestScore')}</dt>
                  <dd>{record.bestScore}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('played')}</dt>
                  <dd>{record.played}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('snakeClears')}</dt>
                  <dd>{record.cleared}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('totalTime')}</dt>
                  <dd>{formatDuration(record.totalPlaySeconds)}</dd>
                </div>
              </dl>
            </section>
          );
        })}
      </div>
    </div>
  );
}
