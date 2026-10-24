/**
 * Statistics (docs/CHESS_RULES.md §7.3): a record per difficulty — played,
 * won, drawn, lost — and total time. No streak, no rating, no ranking: only
 * your own history against each difficulty, kept on this device.
 */
import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { DIFFICULTIES } from '../../game';
import { useChess } from '../../state/GameContext';

export function ChessStatsScreen() {
  const { goHome, stats } = useChess();
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
        {DIFFICULTIES.map((difficulty) => {
          const record = stats[difficulty];
          return (
            <section key={difficulty} className="stats-section">
              <h2 className="stats-title">{t(`chessDifficulty_${difficulty}`)}</h2>
              <dl className="stats-grid">
                <div className="stats-row">
                  <dt>{t('played')}</dt>
                  <dd>{record.played}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('chessWins')}</dt>
                  <dd>{record.wins}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('chessDraws')}</dt>
                  <dd>{record.draws}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('chessLosses')}</dt>
                  <dd>{record.losses}</dd>
                </div>
              </dl>
            </section>
          );
        })}

        <section className="stats-section">
          <dl className="stats-grid">
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
