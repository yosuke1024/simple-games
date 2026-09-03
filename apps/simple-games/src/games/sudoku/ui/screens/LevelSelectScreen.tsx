import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { difficultyForLevel, MAX_LEVEL } from '../../game';
import { useSudoku } from '../../state/GameContext';

/**
 * Level select: replay any unlocked level (to beat its time) or continue at the
 * frontier. A solved level shows its best time, which is the only record kept.
 */
export function SudokuLevelSelectScreen() {
  const { goHome, sessions, canResume, startLevel, progress } = useSudoku();
  const { t } = useSettings();
  const highest = progress.highestUnlocked;
  const [confirmLevel, setConfirmLevel] = useState<number | null>(null);

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
  for (let level = 1; level <= MAX_LEVEL; level++) {
    const unlocked = level <= highest;
    const best = progress.bestTimes[String(level)];
    // The tier (§9), as one to three dots: a player looking for a hard one
    // they have not beaten fast can find it without opening each level.
    const difficulty = difficultyForLevel(level);
    const tier = t(`sudokuTier_${difficulty}`);
    const dots = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
    const tierMark = (
      <span className="level-cell-tier" aria-hidden="true">
        {Array.from({ length: dots }, (_, i) => (
          <i key={i} />
        ))}
      </span>
    );
    cells.push(
      unlocked ? (
        <button
          key={level}
          type="button"
          className={`level-cell ${level === highest ? 'level-cell-current' : ''}`}
          aria-label={
            best !== undefined
              ? `${t('modeLevel', { n: level })}, ${tier}, ${t('bestTime')} ${formatDuration(best)}`
              : `${t('modeLevel', { n: level })}, ${tier}`
          }
          onClick={() => onPick(level)}
        >
          <span className="level-cell-number">{level}</span>
          {best !== undefined ? (
            <span className="level-cell-best">{formatDuration(best)}</span>
          ) : null}
          {tierMark}
        </button>
      ) : (
        // Disabled buttons still expose their accessible name to TalkBack.
        <button
          key={level}
          type="button"
          disabled
          className="level-cell level-cell-locked"
          aria-label={`${t('levelLocked', { n: level })}, ${tier}`}
        >
          <span className="level-cell-number">{level}</span>
          {tierMark}
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
