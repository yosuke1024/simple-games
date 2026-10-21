/**
 * Statistics (docs/NESTED_TIC_TAC_TOE_RULES.md §7): a record per opponent,
 * and total time. No streak — there is nothing here that punishes a day off.
 * Everything is local; there is no rating and no ranking, only your own
 * history against each difficulty.
 */
import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { DIFFICULTIES } from '../../game';
import { useNestedTicTacToe } from '../../state/GameContext';

export function NestedTicTacToeStatsScreen() {
  const { goHome, stats } = useNestedTicTacToe();
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
              <h2 className="stats-title">{t(`nestedTicTacToeDifficulty_${difficulty}`)}</h2>
              <dl className="stats-grid">
                <div className="stats-row">
                  <dt>{t('played')}</dt>
                  <dd>{record.played}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('nestedTicTacToeWins')}</dt>
                  <dd>{record.wins}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('nestedTicTacToeLosses')}</dt>
                  <dd>{record.losses}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('nestedTicTacToeDraws')}</dt>
                  <dd>{record.draws}</dd>
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
