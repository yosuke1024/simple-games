import { useSettings } from '@/state/SettingsContext';
import { IconBack, IconCheck, IconChevronRight } from '@/ui/components/icons';
import { localDateString } from '../../game';
import { useGame2048 } from '../../state/GameContext';
import { availableDailyDates } from '../../state/progressLogic';

/**
 * The daily backlog: today plus however far back the player has unlocked by
 * playing (§6). Reachable dates only — nothing here teases a day that cannot
 * be opened yet, and nothing counts a run of days.
 */
export function Game2048DailyScreen() {
  const { goHome, sessions, progress, startDaily } = useGame2048();
  const { t, locale } = useSettings();

  const today = localDateString(new Date());
  const dates = availableDailyDates(progress, today);
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

      <p className="daily-hint">{t('dailyBacklogHint')}</p>

      <div className="daily-list">
        {dates.map((date) => {
          const best = progress.dailyScores[date];
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
                  <span className="daily-badge">{t('resume')}</span>
                ) : best !== undefined ? (
                  <span className="daily-badge daily-badge-done">
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
