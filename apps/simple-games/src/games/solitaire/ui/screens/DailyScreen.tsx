import { useSettings } from '@/state/SettingsContext';
import { IconBack, IconCheck, IconChevronRight } from '@/ui/components/icons';
import { localDateString } from '../../game';
import { useSolitaire } from '../../state/GameContext';
import { availableDailyDates } from '../../state/progressLogic';

/**
 * The daily backlog: today and the weeks behind it, all open (§6). A won day
 * shows the moves it took — a record of what was played, never a run of days
 * to protect. A day with no badge may simply not have been won yet (§2).
 */
export function SolitaireDailyScreen() {
  const { goHome, sessions, stats, startDaily } = useSolitaire();
  const { t, locale } = useSettings();

  const today = localDateString(new Date());
  const dates = availableDailyDates(today);
  const inProgress = sessions.daily?.status === 'playing' ? sessions.daily.dailyDate : null;

  const formatDate = (iso: string): string => {
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    return new Date(y, m - 1, d).toLocaleDateString(locale);
  };

  return (
    <div className="screen daily-screen">
      <header className="screen-header">
        <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
          <IconBack />
        </button>
        <h1>{t('dailyChallenge')}</h1>
        <span className="icon-btn-placeholder" />
      </header>

      <p className="daily-hint">{t('solDailyBacklogHint')}</p>

      <div className="daily-list">
        {dates.map((date) => {
          const best = stats.dailyMoves[date];
          return (
            <button
              key={date}
              type="button"
              className={`settings-row daily-row ${date === today ? 'daily-row-today' : ''}`}
              onClick={() => startDaily(date)}
            >
              <span className="settings-row-label">
                {date === today ? t('dailyToday') : formatDate(date)}
              </span>
              <span className="daily-row-meta">
                {date === inProgress ? (
                  <span className="sol-daily-badge">{t('resume')}</span>
                ) : best !== undefined ? (
                  <span className="sol-daily-badge sol-daily-badge-done">
                    <IconCheck className="badge-icon" /> {best}
                  </span>
                ) : null}
                <span className="settings-row-chevron" aria-hidden="true">
                  <IconChevronRight />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
