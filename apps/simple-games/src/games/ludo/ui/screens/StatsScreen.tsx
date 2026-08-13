import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { DIFFICULTIES } from '../../game';
import { useLudo } from '../../state/GameContext';

/**
 * Statistics: a record per opponent strength, and total time. No streak —
 * there is nothing here that punishes a day off. Everything is local; there is
 * no rating and no ranking, only this device's own history against each
 * strength.
 *
 * There is **no draws column**, unlike Hearts'. A Ludo match ends the instant
 * one seat gets all four pawns home (docs/LUDO_RULES.md §2.8), so a tie for
 * first is unreachable rather than merely rare, and a column that could only
 * ever read zero would be furniture. Games played may still run ahead of wins
 * plus losses: the difference is the matches walked away from and the ones
 * that reached the roll cap with nobody home (§9).
 */
export function LudoStatsScreen() {
  const { goHome, stats } = useLudo();
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
              <h2 className="stats-title">{t(`ludoDifficulty_${difficulty}`)}</h2>
              <dl className="stats-grid">
                <div className="stats-row">
                  <dt>{t('played')}</dt>
                  <dd>{record.played}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('ludoWins')}</dt>
                  <dd>{record.wins}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('ludoLosses')}</dt>
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
