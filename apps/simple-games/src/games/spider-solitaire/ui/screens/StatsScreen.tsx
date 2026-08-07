import { useSettings } from '@/state/SettingsContext';
import { formatDuration } from '@/ui/format';
import { IconBack } from '@/ui/components/icons';
import { SUIT_COUNTS, type SuitCount } from '../../game';
import { useSpider } from '../../state/GameContext';
import { statsFor, winRatePercent, wonDailyCount } from '../../state/statsLogic';

/**
 * Statistics (docs/SPIDER_SOLITAIRE_RULES.md §9): deals, wins, and the honest
 * ratio between them — deals are not screened for winnability (§5), and the
 * win rate says so, as does the dead end a game can reach (§2).
 *
 * Kept per difficulty, because a win at four suits and a win at one are not
 * the same achievement and one number over both would hide which is which.
 * No score and no streak. Everything here is local — there is no ranking to
 * compare against.
 */
export function SpiderStatsScreen() {
  const { goHome, stats } = useSpider();
  const { t } = useSettings();

  const label = (suitCount: SuitCount): string =>
    suitCount === 1
      ? t('spiderOneSuit')
      : suitCount === 2
        ? t('spiderTwoSuits')
        : t('spiderFourSuits');

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
        {SUIT_COUNTS.map((suitCount) => {
          const row = statsFor(stats, suitCount);
          const rate = winRatePercent(stats, suitCount);
          return (
            <section className="stats-section" key={suitCount}>
              <h2 className="stats-title">{label(suitCount)}</h2>
              <dl className="stats-grid">
                <div className="stats-row">
                  <dt>{t('spiderDealsPlayed')}</dt>
                  <dd>{row.played}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('spiderGamesWon')}</dt>
                  <dd>{row.won}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('spiderWinRate')}</dt>
                  <dd>{rate === null ? '—' : `${rate}%`}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('spiderBestMoves')}</dt>
                  <dd>{row.bestMoves === null ? '—' : row.bestMoves}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('bestTime')}</dt>
                  <dd>{row.bestSeconds === null ? '—' : formatDuration(row.bestSeconds)}</dd>
                </div>
              </dl>
            </section>
          );
        })}

        <section className="stats-section">
          <h2 className="stats-title">{t('dailyChallenge')}</h2>
          <dl className="stats-grid">
            <div className="stats-row">
              <dt>{t('spiderDailiesWon')}</dt>
              <dd>{wonDailyCount(stats)}</dd>
            </div>
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
