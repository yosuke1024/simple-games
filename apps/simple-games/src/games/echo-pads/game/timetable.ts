/**
 * The playback timetable — docs/ECHO_PADS_RULES.md §4.
 *
 * Playback is the one place in the collection where the device moves the
 * board while the player is not touching it (owner decision 2). It starts
 * only on ▶, stops on Stop, never speeds up as the sequence grows, and is
 * paced by the player's choice of Calm / Normal / Quick. The UI does not
 * decide any of this: it walks the event list below with one `setTimeout`
 * chain, and sounds each tone from that timer, so nothing is queued on the
 * audio clock that could ring after a Stop.
 */
import type { Pace } from './types';

/** 2.5 flashes a second at most — under WCAG 2.3.1's three (§4). */
export const MIN_PERIOD_MS = 400;
/** A dark gap long enough to tell a repeated pad as two lights (§4). */
export const MIN_GAP_MS = 120;
/** Between ▶ and the first light: the eye back on the pads, audio resumed. */
export const LEAD_IN_MS = 600;

export interface PaceTiming {
  readonly litMs: number;
  readonly gapMs: number;
}

/** §4's table (initial values). The period is lit + gap. */
export const PACE_TIMING: Readonly<Record<Pace, PaceTiming>> = {
  calm: { litMs: 700, gapMs: 300 },
  normal: { litMs: 450, gapMs: 200 },
  quick: { litMs: 280, gapMs: 140 },
};

export const periodOf = (pace: Pace): number => PACE_TIMING[pace].litMs + PACE_TIMING[pace].gapMs;

export interface TimetableStep {
  /** 0-based position in the played sequence. */
  readonly index: number;
  readonly pad: number;
  readonly onAt: number;
  readonly offAt: number;
}

export interface Timetable {
  readonly pace: Pace;
  readonly steps: readonly TimetableStep[];
  /** When the last light goes off; playback is over. */
  readonly totalMs: number;
}

/** When each pad lights and goes dark, in ms from the ▶ tap. */
export function buildTimetable(pads: readonly number[], pace: Pace): Timetable {
  const { litMs } = PACE_TIMING[pace];
  const period = periodOf(pace);
  const steps = pads.map((pad, index) => {
    const onAt = LEAD_IN_MS + index * period;
    return { index, pad, onAt, offAt: onAt + litMs };
  });
  const last = steps[steps.length - 1];
  return { pace, steps, totalMs: last ? last.offAt : LEAD_IN_MS };
}

export type PlaybackEvent =
  | { readonly at: number; readonly kind: 'on'; readonly index: number; readonly pad: number }
  | { readonly at: number; readonly kind: 'off'; readonly index: number; readonly pad: number }
  | { readonly at: number; readonly kind: 'end' };

/**
 * The timetable as one ordered list: a UI waits `next.at - current.at` and
 * handles one event at a time. Ties keep list order (the last `off` before
 * `end`).
 */
export function playbackEvents(timetable: Timetable): readonly PlaybackEvent[] {
  const events: PlaybackEvent[] = [];
  for (const step of timetable.steps) {
    events.push({ at: step.onAt, kind: 'on', index: step.index, pad: step.pad });
    events.push({ at: step.offAt, kind: 'off', index: step.index, pad: step.pad });
  }
  events.push({ at: timetable.totalMs, kind: 'end' });
  return events;
}

/** The pads lit at time `t` (ms from ▶) — at most one by construction. */
export function litAt(timetable: Timetable, t: number): readonly number[] {
  return timetable.steps.filter((s) => t >= s.onAt && t < s.offAt).map((s) => s.pad);
}
