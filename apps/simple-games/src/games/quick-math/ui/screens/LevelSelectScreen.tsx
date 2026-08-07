import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { MAX_LEVEL } from '../../game';
import { useQuickMath } from '../../state/GameContext';

/**
 * Level select: replay any unlocked level to beat its time, or continue at the
 * frontier. A finished level shows the fastest it has been done in — the record
 * a replay is measured against (§6).
 *
 * This is the drill that suspends a set (§9), so picking a *different* level
 * can cost one — and that is the only case the confirmation covers. Returning
 * to the level already in progress just resumes it, and the daily lives in its
 * own slot and is never at risk here.
 */
export function QuickMathLevelSelectScreen() {
  const { goHome, sessions, canResume, startLevel, progress } = useQuickMath();
  const { t } = useSettings();
  const highest = progress.highestUnlocked;
  const [confirmLevel, setConfirmLevel] = useState<number | null>(null);

  const onPick = (level: number) => {
    const resumesSame = sessions.level?.level === level && sessions.level.status === 'playing';
    if (canResume('level') && !resumesSame) {
      setConfirmLevel(level);
    } else {
      startLevel(level);
    }
  };

  const cells = [];
  for (let level = 1; level <= MAX_LEVEL; level++) {
    const unlocked = level <= highest;
    const best = progress.bestSeconds[String(level)];
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
            <span className="qmath-level-best">{formatDuration(best)}</span>
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
