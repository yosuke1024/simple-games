/**
 * Statistics (docs/PEG_SOLITAIRE_RULES.md §10): per board, the games begun,
 * the fewest pegs a finished game left and the perfect clears; overall, the
 * play time. No streak — there is nothing here that punishes a day off — and
 * no rating: the only thing these numbers are compared with is this device's
 * own history.
 */
import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { BOARD_KINDS } from '../../game';
import { usePegSolitaire } from '../../state/GameContext';

/** What a record not yet set reads as: a dash, never a zero. */
const NO_RECORD = '—';

export function PegSolitaireStatsScreen() {
  const { goHome, stats } = usePegSolitaire();
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
        {BOARD_KINDS.map((kind) => {
          const record = stats[kind];
          return (
            <section key={kind} className="stats-section">
              <h2 className="stats-title">{t(`pegSolitaireBoard_${kind}`)}</h2>
              <dl className="stats-grid">
                <div className="stats-row">
                  <dt>{t('played')}</dt>
                  <dd>{record.played}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('pegSolitaireStatFewest')}</dt>
                  <dd>{record.best ?? NO_RECORD}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('pegSolitaireStatPerfect')}</dt>
                  <dd>{record.perfect}</dd>
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
