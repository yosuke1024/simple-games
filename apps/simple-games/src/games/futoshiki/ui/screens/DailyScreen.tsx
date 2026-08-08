import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconCheck, IconChevronRight } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { localDateString } from '../../game';
import { useFutoshiki } from '../../state/GameContext';
import { availableDailyDates } from '../../state/progressLogic';

/**
 * The daily backlog: today and the thirty days behind it, all open (§9). A
 * solved day shows the time it took — a record of what was played, never a run
 * of days to protect.
 *
 * There is one daily slot (§11), so opening a second day replaces a suspended
 * one. That is a board, its notes and its undo stack gone, and the level
 * picker asks before doing the same thing — so this asks too. Only when a
 * suspended daily exists and the tap is for a different day: resuming the day
 * already in progress replaces nothing.
 */
export function FutoshikiDailyScreen() {
  const { goHome, sessions, progress, startDaily } = useFutoshiki();
  const { t, locale } = useSettings();
  const [confirmDate, setConfirmDate] = useState<string | null>(null);

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

      <p className="daily-hint">{t('futoshikiDailyBacklogHint')}</p>

      <div className="daily-list">
        {dates.map((date) => {
          const best = progress.dailySeconds[date];
          return (
            <button
              key={date}
              type="button"
              className={`settings-row daily-row ${date === today ? 'daily-row-today' : ''}`}
              onClick={() =>
                inProgress !== null && inProgress !== date ? setConfirmDate(date) : startDaily(date)
              }
            >
              <span className="settings-row-label">
                {date === today ? t('dailyToday') : formatDate(date)}
              </span>
              <span className="daily-row-meta">
                {date === inProgress ? (
                  <span className="futoshiki-daily-badge">{t('resume')}</span>
                ) : best !== undefined ? (
                  <span className="futoshiki-daily-badge futoshiki-daily-badge-done">
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

      <ConfirmDialog
        open={confirmDate !== null}
        title={t('confirmNewGameTitle')}
        body={t('confirmNewGameBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setConfirmDate(null)}
        onConfirm={() => {
          const date = confirmDate;
          setConfirmDate(null);
          if (date !== null) startDaily(date);
        }}
      />
    </div>
  );
}
