import { useSettings } from '@/state/SettingsContext';
import { IconBack, IconCheck } from '@/ui/components/icons';
import { LEVEL_COUNT } from '../../game/levels';
import { useBubblePop } from '../../state/GameContext';

/**
 * Level select: replay any cleared board or continue at the frontier. No
 * suspended game exists (docs/plans/2026-08-08-mahjong-bubble-ludo.md
 * §Bubble Pop), so starting a level never costs the player anything and
 * needs no confirmation.
 */
export function BubbleLevelSelectScreen() {
  const { goHome, startLevel, progress } = useBubblePop();
  const { t } = useSettings();
  // highestUnlocked can be LEVEL_COUNT+1 once the run is fully cleared (the
  // one value that means "cleared", not "unlocked" — see statsLogic.ts);
  // this grid only ever has LEVEL_COUNT real cells to address.
  const highest = Math.min(progress.highestUnlocked, LEVEL_COUNT);

  const cells = [];
  for (let level = 1; level <= LEVEL_COUNT; level++) {
    const unlocked = level <= highest;
    const clearedLevel = level < highest;
    cells.push(
      unlocked ? (
        <button
          key={level}
          type="button"
          className={`level-cell ${level === highest ? 'level-cell-current' : ''}`}
          aria-label={t('modeLevel', { n: level })}
          onClick={() => startLevel(level)}
        >
          <span className="level-cell-number">{level}</span>
          {clearedLevel ? <IconCheck className="level-cell-check" aria-hidden="true" /> : null}
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
    </div>
  );
}
