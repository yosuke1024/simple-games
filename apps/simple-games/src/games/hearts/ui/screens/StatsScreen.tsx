import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { DIFFICULTIES } from '../../game';
import { useHearts } from '../../state/GameContext';

/**
 * Statistics: a record per opponent strength, and total time. No streak —
 * there is nothing here that punishes a day off. Everything is local; there is
 * no rating and no ranking, only this device's own history against each
 * strength.
 *
 * There **is** a draws column, unlike Gin Rummy's. Hearts is won by holding
 * the fewest points at four seats, and four seats make a tie for lowest
 * ordinary rather than exotic; a match the player shares the lowest score in
 * is a real outcome the rules produce (game/session.ts `statusOf`), so it gets
 * a column of its own rather than being rounded into a win or a loss. It is
 * the board shelf's four-column shape, and it is here for the same reason.
 */
export function HeartsStatsScreen() {
  const { goHome, stats } = useHearts();
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
              <h2 className="stats-title">{t(`heartsDifficulty_${difficulty}`)}</h2>
              <dl className="stats-grid">
                <div className="stats-row">
                  <dt>{t('played')}</dt>
                  <dd>{record.played}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('heartsWins')}</dt>
                  <dd>{record.wins}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('heartsLosses')}</dt>
                  <dd>{record.losses}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('heartsDraws')}</dt>
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
