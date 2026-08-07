import { useSettings } from '@/state/SettingsContext';
import { IconBack, IconCheck, IconChevronRight } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { localDateString } from '../../game';
import { useRecall } from '../../state/GameContext';
import { availableDailyDates } from '../../state/progressLogic';

/**
 * The daily backlog: today and the weeks behind it, all open (§9). A finished
 * day shows the time it took — a record of what was played, never a run of days
 * to protect.
 */
export function RecallDailyScreen() {
  const { goHome, progress, startDaily } = useRecall();
  const { t, locale } = useSettings();

  const today = localDateString(new Date());
  const dates = availableDailyDates(today);

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

      <p className="daily-hint">{t('recallDailyBacklogHint')}</p>

      <div className="daily-list">
        {dates.map((date) => {
          const best = progress.dailySeconds[date];
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
                {best !== undefined ? (
                  <span className="recall-daily-badge">
                    <IconCheck className="badge-icon" /> {formatDuration(best)}
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
