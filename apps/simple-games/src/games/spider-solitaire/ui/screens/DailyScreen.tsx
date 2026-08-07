import { useSettings } from '@/state/SettingsContext';
import { IconBack, IconCheck, IconChevronRight } from '@/ui/components/icons';
import { localDateString } from '../../game';
import { useSpider } from '../../state/GameContext';
import { availableDailyDates } from '../../state/progressLogic';
import { dailyResultFor } from '../../state/statsLogic';

/**
 * The daily backlog: today and the weeks behind it, all open (§6). A won day
 * shows the moves it took — a record of what was played, never a run of days
 * to protect. A day with no badge may simply not have been won yet (§2).
 *
 * The badge is the record at the difficulty now selected, because that is the
 * difficulty the row will deal at (§7). A day won at one suit shows nothing
 * here once the player has switched to four: they have not beaten that one
 * yet, and showing the one-suit figure would be handing them a target from a
 * different game. The lifetime count on the statistics screen still counts
 * days rather than difficulties (§9).
 */
export function SpiderDailyScreen() {
  const { goHome, sessions, stats, startDaily, suitCount } = useSpider();
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

      <p className="daily-hint">{t('spiderDailyBacklogHint')}</p>

      <div className="daily-list">
        {dates.map((date) => {
          const best = dailyResultFor(stats, date, suitCount);
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
                  <span className="sp-daily-badge">{t('resume')}</span>
                ) : best !== null ? (
                  <span className="sp-daily-badge sp-daily-badge-done">
                    <IconCheck className="badge-icon" /> {best.moves}
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
