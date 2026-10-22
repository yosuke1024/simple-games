/**
 * The level list (docs/ECHO_PADS_RULES.md §2): the 22 levels as two tiers of
 * eleven — 4 pads, then 6 pads, target lengths 4 to 14 — each cell its
 * target length, a check once cleared, and a locked cell until the level
 * before it in the tier is cleared. Both tiers open at length 4. Any open
 * level can be chosen again; every choice is a new sequence (§3).
 *
 * The only record shown is "cleared" (§9): no best time, no fewest replays.
 * With a level run suspended, a choice asks first (ReplaceRunDialog).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconBack, IconCheck } from '@/ui/components/icons';
import { isFinished, isUnlocked, LEVELS, PAD_COUNTS } from '../../game';
import { useEchoPads } from '../../state/GameContext';
import { ReplaceRunDialog } from '../components/ReplaceRunDialog';
import { levelDetail, tierName } from '../labels';

export function EchoPadsLevelsScreen() {
  const { goHome, startLevel, progress, sessions } = useEchoPads();
  const { t } = useSettings();
  const [pending, setPending] = useState<number | null>(null);
  const current = sessions.level !== null && !isFinished(sessions.level) ? sessions.level : null;

  const choose = (level: number) => {
    if (current) setPending(level);
    else startLevel(level);
  };

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
        {PAD_COUNTS.map((padCount) => (
          <section key={padCount} className="ep-tier">
            <h2 className="ep-tier-title">{tierName(t, padCount)}</h2>
            <div className="level-grid">
              {LEVELS.filter((spec) => spec.padCount === padCount).map((spec) => {
                const { level } = spec;
                if (!isUnlocked(progress, level)) {
                  return (
                    // Disabled buttons still expose their accessible name to TalkBack.
                    <button
                      key={level}
                      type="button"
                      disabled
                      className="level-cell level-cell-locked"
                      aria-label={t('levelLocked', { n: level })}
                    >
                      <span className="level-cell-number">{spec.target}</span>
                    </button>
                  );
                }
                const cleared = progress.cleared[level - 1] === true;
                // One catalog entry per label: the language owns the order and
                // the punctuation (§14), the code only fills the slots.
                const slots = {
                  level: t('modeLevel', { n: level }),
                  detail: levelDetail(t, spec.padCount, spec.target),
                };
                return (
                  <button
                    key={level}
                    type="button"
                    className="level-cell"
                    aria-label={t(
                      cleared ? 'echoPadsLevelCellCleared' : 'echoPadsLevelCell',
                      slots,
                    )}
                    onClick={() => choose(level)}
                  >
                    <span className="level-cell-number">{spec.target}</span>
                    {cleared ? <IconCheck className="ep-level-check" aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <ReplaceRunDialog
        pendingLevel={pending}
        current={current}
        onCancel={() => setPending(null)}
        onConfirm={(level) => {
          setPending(null);
          startLevel(level);
        }}
      />
    </div>
  );
}
