import { useSettings } from '@/state/SettingsContext';
import { IconBack, IconCheck } from '@/ui/components/icons';
import { LEVEL_COUNT } from '../../game/levels';
import { useSkyFighter } from '../../state/GameContext';

/**
 * Level select: replay any cleared sky or continue at the frontier
 * (docs/SKY_FIGHTER_RULES.md §7). No suspended game exists (§10), so starting
 * a level never costs the player anything and needs no confirmation.
 */
export function SkyLevelSelectScreen() {
  const { goHome, startLevel, progress } = useSkyFighter();
  const { t } = useSettings();
  const highest = progress.highestUnlocked;

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
