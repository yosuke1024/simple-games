import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { BOARD_SIZES } from '../../game';
import { useDotsAndBoxes } from '../../state/GameContext';
import { SIZE_KEY } from '../sizeKey';

/**
 * Statistics (docs/DOTS_AND_BOXES_RULES.md §7): a record per board, and
 * total time. No streak — there is nothing here that punishes a day off.
 * Everything is local; there is no rating and no ranking, only your own
 * history on each board.
 */
export function DotsAndBoxesStatsScreen() {
  const { goHome, stats } = useDotsAndBoxes();
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
        {BOARD_SIZES.map((size) => {
          const record = stats[size];
          return (
            <section key={size} className="stats-section">
              <h2 className="stats-title">{t(SIZE_KEY[size])}</h2>
              <dl className="stats-grid">
                <div className="stats-row">
                  <dt>{t('played')}</dt>
                  <dd>{record.played}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('dotsAndBoxesWins')}</dt>
                  <dd>{record.wins}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('dotsAndBoxesLosses')}</dt>
                  <dd>{record.losses}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('dotsAndBoxesDraws')}</dt>
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
