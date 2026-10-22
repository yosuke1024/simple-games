/**
 * What the screen says and reads out about pads, runs and paces
 * (docs/ECHO_PADS_RULES.md §11, §14): every string is one catalog entry with
 * `{var}` slots — never words joined in code. A pad is read as its mark and
 * its position ("Circle, top left"), because those are what tell pads apart;
 * colour is never named.
 */
import type { useSettings } from '@/state/SettingsContext';
import {
  DAILY_PAD_COUNT,
  DAILY_TARGET,
  levelSpec,
  PAD_GRID,
  PAD_MARKS,
  type EchoSession,
  type Pace,
  type PadCount,
  type PadMark,
} from '../game';

export type Translate = ReturnType<typeof useSettings>['t'];

type Position =
  'topLeft' | 'topMiddle' | 'topRight' | 'bottomLeft' | 'bottomMiddle' | 'bottomRight';

/** The mark of a pad in reading order (§11). */
export const markOf = (pad: number): PadMark => PAD_MARKS[pad] ?? 'circle';

/** Where a pad sits: 2 × 2 has no middle column, 2 × 3 has one. */
export function positionOf(padCount: PadCount, pad: number): Position {
  const { cols } = PAD_GRID[padCount];
  const top = pad < cols;
  const col = pad % cols;
  if (cols === 2)
    return top ? (col === 0 ? 'topLeft' : 'topRight') : col === 0 ? 'bottomLeft' : 'bottomRight';
  const side = col === 0 ? 'Left' : col === 1 ? 'Middle' : 'Right';
  return `${top ? 'top' : 'bottom'}${side}` as Position;
}

/** "Circle, top left". */
export const padName = (t: Translate, padCount: PadCount, pad: number): string =>
  t('echoPadsPadLabel', {
    mark: t(`echoPadsMark_${markOf(pad)}`),
    position: t(`echoPadsPos_${positionOf(padCount, pad)}`),
  });

export const tierName = (t: Translate, padCount: PadCount): string =>
  t(padCount === 4 ? 'echoPadsTier_4' : 'echoPadsTier_6');

/** "4 pads · length 8". */
export const levelDetail = (t: Translate, padCount: PadCount, length: number): string =>
  t('echoPadsLevelDetail', { tier: tierName(t, padCount), length });

/** "Level 5", or "Daily". */
export const runName = (t: Translate, session: EchoSession): string =>
  session.mode === 'daily' ? t('modeDaily') : t('modeLevel', { n: session.level ?? 1 });

/** The line under a run's name: its tier and target, the daily's date first. */
export function runDetail(t: Translate, session: EchoSession): string {
  const detail = levelDetail(t, session.padCount, session.target);
  return session.mode === 'daily' && session.dailyDate !== null
    ? `${session.dailyDate} · ${detail}`
    : detail;
}

/** "Level 5 (4 pads · length 8)" for the replace question; the daily's own words. */
export function levelTitle(t: Translate, level: number): string {
  const spec = levelSpec(level);
  return spec === null
    ? t('modeLevel', { n: level })
    : `${t('modeLevel', { n: level })} (${levelDetail(t, spec.padCount, spec.target)})`;
}

export const dailyDetail = (t: Translate): string => levelDetail(t, DAILY_PAD_COUNT, DAILY_TARGET);

export const paceName = (t: Translate, pace: Pace): string => t(`echoPadsPace_${pace}`);
