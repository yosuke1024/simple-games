import { localDateString } from '../../game';
import { useApp } from '../../state/AppContext';
import { availableDailyDates } from '../../state/progressLogic';
import { useSettings } from '../../state/SettingsContext';

/**
 * The daily backlog: today plus however far back the player has unlocked by
 * clearing (docs §14). Reachable dates only — nothing here teases a day the
 * player cannot open yet.
 */
export function DailyScreen() {
  const { goHome, sessions, progress, startDaily } = useApp();
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
          ←
        </button>
        <h1>{t('dailyChallenge')}</h1>
        <span className="icon-btn-placeholder" />
      </header>

      <p className="daily-hint">{t('dailyBacklogHint')}</p>

      <div className="daily-list">
        {dates.map((date) => {
          const best = progress.bestDaily[date];
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
                    ✓ {t('best')} {best}
                  </span>
                ) : null}
                <span aria-hidden="true">›</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
