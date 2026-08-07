import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { MAX_LEVEL } from '../../game';
import { useRecall } from '../../state/GameContext';

/**
 * Level select: replay any unlocked level to beat its time, or continue at the
 * frontier. A finished level shows the fastest it has been done in — the record
 * a replay is measured against (§7).
 *
 * Replaying a level is a fresh layout of the same difficulty, never the layout
 * it was cleared on (§8) — so the record stands against the level, not against
 * one arrangement of it.
 *
 * No confirmation dialog anywhere: a round is never suspended (§12), so picking
 * a level cannot discard one.
 */
export function RecallLevelSelectScreen() {
  const { goHome, startLevel, progress } = useRecall();
  const { t } = useSettings();
  const highest = progress.highestUnlocked;

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
          onClick={() => startLevel(level)}
        >
          <span className="level-cell-number">{level}</span>
          {best !== undefined ? (
            <span className="recall-level-best">{formatDuration(best)}</span>
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
    </div>
  );
}
