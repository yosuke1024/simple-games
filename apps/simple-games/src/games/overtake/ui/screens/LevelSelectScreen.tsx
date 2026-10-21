/**
 * The level picker (docs/OVERTAKE_RULES.md §7): any cleared level can be run
 * again, the frontier is marked, and nothing ahead of it opens. There is no
 * saved race (§9), so starting one costs nothing and asks nothing.
 */
import { useSettings } from '@/state/SettingsContext';
import { IconBack, IconCheck } from '@/ui/components/icons';
import { LEVEL_COUNT } from '../../game/levels';
import { useOvertake } from '../../state/GameContext';
import { homeLevel } from '../../state/statsLogic';

export function OvertakeLevelSelectScreen() {
  const { goHome, startLevel, progress } = useOvertake();
  const { t } = useSettings();
  // The frontier may sit one past the last level ("all cleared"): the grid
  // marks the last cell then, and its tick shows the last win.
  const current = homeLevel(progress);

  const cells = [];
  for (let level = 1; level <= LEVEL_COUNT; level++) {
    const cleared = level < progress.highestUnlocked;
    cells.push(
      level <= current ? (
        <button
          key={level}
          type="button"
          className={`level-cell ${level === current ? 'level-cell-current' : ''}`}
          aria-label={t('modeLevel', { n: level })}
          onClick={() => startLevel(level)}
        >
          <span className="level-cell-number">{level}</span>
          {cleared ? <IconCheck className="level-cell-check" aria-hidden="true" /> : null}
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
