import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { DIFFICULTIES } from '../../game';
import { useHitAndBlow } from '../../state/GameContext';
import { averageGuesses } from '../../state/statsLogic';
import { DIFFICULTY_KEY } from '../difficultyKey';

/** A figure not reached yet reads as a dash, never as zero. */
const NONE = '—';

/**
 * Statistics (docs/HIT_AND_BLOW_RULES.md §7): per difficulty, games played,
 * games solved, the fewest guesses and the average over solved games — plus
 * total time. No streak — there is nothing here that punishes a day off, and
 * an abandoned game never drags the average. Everything is local.
 */
export function HitAndBlowStatsScreen() {
  const { goHome, stats } = useHitAndBlow();
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
          const average = averageGuesses(stats, difficulty);
          return (
            <section key={difficulty} className="stats-section">
              <h2 className="stats-title">{t(DIFFICULTY_KEY[difficulty])}</h2>
              <dl className="stats-grid">
                <div className="stats-row">
                  <dt>{t('played')}</dt>
                  <dd>{record.played}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('hitAndBlowSolved')}</dt>
                  <dd>{record.solved}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('hitAndBlowFewestGuesses')}</dt>
                  <dd>{record.bestGuesses ?? NONE}</dd>
                </div>
                <div className="stats-row">
                  <dt>{t('hitAndBlowAverageGuesses')}</dt>
                  <dd>{average === null ? NONE : average.toFixed(1)}</dd>
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
