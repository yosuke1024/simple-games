import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { useSolitaire } from '../../state/GameContext';
import { winRatePercent, wonDailyCount } from '../../state/statsLogic';

/**
 * Statistics (docs/SOLITAIRE_RULES.md §9): deals, wins, and the honest ratio
 * between them — deals are not screened for winnability (§5), and the win
 * rate says so. No score and no streak. Everything here is local — there is
 * no ranking to compare against.
 */
export function SolitaireStatsScreen() {
  const { goHome, stats } = useSolitaire();
  const { t } = useSettings();
  const rate = winRatePercent(stats);

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
        <section className="stats-section">
          <h2 className="stats-title">{t('solitaireName')}</h2>
          <dl className="stats-grid">
            <div className="stats-row">
              <dt>{t('solDealsPlayed')}</dt>
              <dd>{stats.played}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('solGamesWon')}</dt>
              <dd>{stats.won}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('solWinRate')}</dt>
              <dd>{rate === null ? '—' : `${rate}%`}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('solBestMoves')}</dt>
              <dd>{stats.bestMoves === null ? '—' : stats.bestMoves}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('bestTime')}</dt>
              <dd>{stats.bestSeconds === null ? '—' : formatDuration(stats.bestSeconds)}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('totalTime')}</dt>
              <dd>{formatDuration(stats.totalPlaySeconds)}</dd>
            </div>
          </dl>
        </section>

        <section className="stats-section">
          <h2 className="stats-title">{t('dailyChallenge')}</h2>
          <dl className="stats-grid">
            <div className="stats-row">
              <dt>{t('solDailiesWon')}</dt>
              <dd>{wonDailyCount(stats)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
