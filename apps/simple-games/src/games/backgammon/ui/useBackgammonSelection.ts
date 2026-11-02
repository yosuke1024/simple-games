/**
 * Picking up and putting down (docs/BACKGAMMON_RULES.md §2.5, §11): the
 * selection lives here rather than in the session — it is a thing about this
 * screen, and it disappears the moment the match moves on.
 *
 * Everything offered comes from the allowed steps and nothing else (§7): only
 * a point with a step may be picked up, and only the landing points of the
 * picked-up checker's steps may be put down on. Two dice landing on the same
 * point can only happen when bearing off, where the exact die is used (§16).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { OFF, type Dist, type Step } from '../game/types';

export interface Target {
  readonly to: Dist;
  readonly step: Step;
}

export function useBackgammonSelection(
  playing: boolean,
  steps: readonly Step[],
  play: (step: Step) => boolean,
) {
  const [selected, setSelected] = useState<Dist | null>(null);
  useEffect(() => {
    if (!playing) setSelected(null);
  }, [playing]);
  // A selection that the position no longer supports (the turn moved on, or
  // 待った put the checker back) is dropped rather than left pointing at nothing.
  useEffect(() => {
    if (selected !== null && !steps.some((step) => step.from === selected)) setSelected(null);
  }, [selected, steps]);

  const movable = useMemo(
    () => (playing ? [...new Set(steps.map((step) => step.from))] : []),
    [playing, steps],
  );

  const targets = useMemo<Target[]>(() => {
    if (selected === null) return [];
    const out = new Map<Dist, Step>();
    for (const step of steps) {
      if (step.from !== selected) continue;
      const to = Math.max(OFF, step.from - step.die);
      const existing = out.get(to);
      // Bearing off with either die: keep the exact one (§16).
      if (!existing || step.die === step.from) out.set(to, step);
    }
    return [...out.entries()].map(([to, step]) => ({ to, step }));
  }, [selected, steps]);

  const onPoint = useCallback(
    (dist: Dist) => {
      if (!playing) return;
      const target = selected === null ? null : targets.find((t) => t.to === dist);
      if (target) {
        if (play(target.step)) setSelected(null);
        return;
      }
      if (movable.includes(dist)) setSelected(dist === selected ? null : dist);
      else if (selected !== null) setSelected(null);
    },
    [movable, play, playing, selected, targets],
  );

  return {
    selected,
    targets,
    movable,
    onPoint,
    clearSelection: useCallback(() => setSelected(null), []),
  };
}
