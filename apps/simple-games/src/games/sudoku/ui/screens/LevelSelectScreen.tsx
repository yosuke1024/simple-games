import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconChevronLeft, IconChevronRight } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { MAX_LEVEL } from '../../game';
import { useSudoku } from '../../state/GameContext';

const LEVELS_PER_PAGE = 100;

/**
 * Level select: replay any unlocked level (to beat its time) or continue at the
 * frontier. A solved level shows its best time, which is the only record kept.
 */
export function SudokuLevelSelectScreen() {
  const { goHome, sessions, canResume, startLevel, progress } = useSudoku();
  const { t } = useSettings();
  const highest = progress.highestUnlocked;
  const [page, setPage] = useState(() => Math.floor((highest - 1) / LEVELS_PER_PAGE));
  const [confirmLevel, setConfirmLevel] = useState<number | null>(null);

  const pageCount = Math.ceil(MAX_LEVEL / LEVELS_PER_PAGE);
  const start = page * LEVELS_PER_PAGE + 1;
  const end = Math.min(MAX_LEVEL, start + LEVELS_PER_PAGE - 1);

  const onPick = (level: number) => {
    // Only starting a *different* level discards the suspended one; the daily
    // game lives in its own slot and is never at risk here.
    const resumesSame = sessions.level?.level === level && sessions.level.status === 'playing';
    if (canResume('level') && !resumesSame) {
      setConfirmLevel(level);
    } else {
      startLevel(level);
    }
  };

  const cells = [];
  for (let level = start; level <= end; level++) {
    const unlocked = level <= highest;
    const best = progress.bestTimes[String(level)];
    cells.push(
      unlocked ? (
        <button
          key={level}
          type="button"
          className={`level-cell ${level === highest ? 'level-cell-current' : ''}`}
          aria-label={
            best !== undefined
              ? `${t('modeLevel', { n: level })}, ${t('bestTime')} ${formatDuration(best)}`
              : t('modeLevel', { n: level })
          }
          onClick={() => onPick(level)}
        >
          <span className="level-cell-number">{level}</span>
          {best !== undefined ? (
            <span className="level-cell-best">{formatDuration(best)}</span>
          ) : null}
        </button>
      ) : (
        // Disabled buttons still expose their accessible name to TalkBack.
        <button
          key={level}
          type="button"
          disabled
          className="level-cell level-cell-locked"
          aria-label={t('levelLocked', { n: level })}
        >
          <span className="level-cell-number">{level}</span>
        </button>
      ),
    );
  }

  return (
    <div className="screen levels-screen">
      <header className="screen-header">
        <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
          <IconBack />
        </button>
        <h1>{t('levelSelect')}</h1>
        <span className="icon-btn-placeholder" />
      </header>

      {pageCount > 1 ? (
        <div className="level-pager">
          <button
            type="button"
            className="icon-btn"
            aria-label={t('back')}
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            <IconChevronLeft />
          </button>
          <span className="level-pager-range">
            {start} – {end}
          </span>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('next')}
            disabled={page === pageCount - 1}
            onClick={() => setPage(page + 1)}
          >
            <IconChevronRight />
          </button>
        </div>
      ) : null}

      <div className="level-grid-scroll">
        <div className="level-grid">{cells}</div>
      </div>

      <ConfirmDialog
        open={confirmLevel !== null}
        title={t('confirmNewGameTitle')}
        body={t('confirmNewGameBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setConfirmLevel(null)}
        onConfirm={() => {
          const level = confirmLevel;
          setConfirmLevel(null);
          if (level !== null) startLevel(level);
        }}
      />
    </div>
  );
}
