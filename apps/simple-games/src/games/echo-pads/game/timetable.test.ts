/**
 * docs/ECHO_PADS_RULES.md §4: the playback constants, held for every pace ×
 * every length a run can play (1..14 — rounds are 3..14, the shorter ones
 * are checked too so nothing rests on the first round being 3).
 */
import { describe, expect, it } from 'vitest';
import { generateSequence } from './sequence';
import {
  buildTimetable,
  LEAD_IN_MS,
  litAt,
  MIN_GAP_MS,
  MIN_PERIOD_MS,
  PACE_TIMING,
  periodOf,
  playbackEvents,
} from './timetable';
import { PACES, type Pace } from './types';

const LENGTHS = Array.from({ length: 14 }, (_, i) => i + 1);
const padsOf = (length: number): number[] =>
  generateSequence(`timetable-${length}`, 6, length).pads.slice();

describe('the pace constants (§4)', () => {
  it('holds the table: Calm 700/300, Normal 450/200, Quick 280/140, lead-in 600', () => {
    expect(PACE_TIMING).toEqual({
      calm: { litMs: 700, gapMs: 300 },
      normal: { litMs: 450, gapMs: 200 },
      quick: { litMs: 280, gapMs: 140 },
    });
    expect(LEAD_IN_MS).toBe(600);
    expect(MIN_PERIOD_MS).toBe(400);
    expect(MIN_GAP_MS).toBe(120);
    expect(PACES.map(periodOf)).toEqual([1000, 650, 420]);
  });

  it('never flashes more than 2.5 times a second, even on Quick', () => {
    for (const pace of PACES) {
      expect(periodOf(pace)).toBeGreaterThanOrEqual(MIN_PERIOD_MS);
      expect(1000 / periodOf(pace)).toBeLessThanOrEqual(2.5);
      expect(PACE_TIMING[pace].gapMs).toBeGreaterThanOrEqual(MIN_GAP_MS);
    }
  });
});

describe('the timetable, every pace × length 1..14 (§4)', () => {
  it.each(PACES)('%s: period, gap, one pad at a time, no speed-up, total', (pace: Pace) => {
    const { litMs, gapMs } = PACE_TIMING[pace];
    for (const length of LENGTHS) {
      const pads = padsOf(length);
      const table = buildTimetable(pads, pace);
      expect(table.steps.map((s) => s.pad)).toEqual(pads);
      table.steps.forEach((step, i) => {
        expect(step.index).toBe(i);
        expect(step.onAt).toBe(LEAD_IN_MS + i * periodOf(pace));
        expect(step.offAt - step.onAt).toBe(litMs);
        const next = table.steps[i + 1];
        if (next) {
          // The same period everywhere: no speed-up as the sequence grows.
          expect(next.onAt - step.onAt).toBe(periodOf(pace));
          expect(next.onAt - step.offAt).toBe(gapMs);
          expect(next.onAt - step.onAt).toBeGreaterThanOrEqual(MIN_PERIOD_MS);
          expect(next.onAt - step.offAt).toBeGreaterThanOrEqual(MIN_GAP_MS);
        }
      });
      // One pad lit at a time. What is lit changes only at an on or off time,
      // so checking each of those instants and the millisecond before covers
      // every interval of the playback.
      for (const step of table.steps) {
        for (const t of [step.onAt - 1, step.onAt, step.offAt - 1, step.offAt]) {
          expect(litAt(table, t).length).toBeLessThanOrEqual(1);
        }
        expect(litAt(table, step.onAt)).toEqual([step.pad]);
        expect(litAt(table, step.offAt - 1)).toEqual([step.pad]);
      }
      expect(litAt(table, LEAD_IN_MS - 1)).toEqual([]);
      expect(table.totalMs).toBe(LEAD_IN_MS + (length - 1) * periodOf(pace) + litMs);
    }
  });

  it('lists events in time order, on/off paired, ending at the last light going out', () => {
    for (const pace of PACES) {
      for (const length of LENGTHS) {
        const table = buildTimetable(padsOf(length), pace);
        const events = playbackEvents(table);
        expect(events).toHaveLength(2 * length + 1);
        for (let i = 1; i < events.length; i++) {
          expect(events[i]!.at).toBeGreaterThanOrEqual(events[i - 1]!.at);
        }
        const last = events[events.length - 1]!;
        expect(last).toEqual({ at: table.totalMs, kind: 'end' });
        // Walking the events, never more than one pad is on.
        let lit = 0;
        for (const e of events) {
          if (e.kind === 'on') lit += 1;
          if (e.kind === 'off') lit -= 1;
          expect(lit === 0 || lit === 1).toBe(true);
        }
        expect(lit).toBe(0);
      }
    }
  });

  it('prints and pins the playback length of every round, per pace (§17)', () => {
    const rows = PACES.map((pace) => {
      const totals = LENGTHS.filter((k) => k >= 3).map(
        (k) => buildTimetable(padsOf(k), pace).totalMs,
      );
      return { pace, totals };
    });
    console.log(
      ['round k: ' + LENGTHS.filter((k) => k >= 3).join(' / ')]
        .concat(rows.map((r) => `${r.pace}: ${r.totals.join(' / ')} ms`))
        .join('\n'),
    );
    expect(rows).toMatchInlineSnapshot(`
      [
        {
          "pace": "calm",
          "totals": [
            3300,
            4300,
            5300,
            6300,
            7300,
            8300,
            9300,
            10300,
            11300,
            12300,
            13300,
            14300,
          ],
        },
        {
          "pace": "normal",
          "totals": [
            2350,
            3000,
            3650,
            4300,
            4950,
            5600,
            6250,
            6900,
            7550,
            8200,
            8850,
            9500,
          ],
        },
        {
          "pace": "quick",
          "totals": [
            1720,
            2140,
            2560,
            2980,
            3400,
            3820,
            4240,
            4660,
            5080,
            5500,
            5920,
            6340,
          ],
        },
      ]
    `);
  });

  it('an empty sequence is only the lead-in', () => {
    expect(buildTimetable([], 'normal')).toEqual({
      pace: 'normal',
      steps: [],
      totalMs: LEAD_IN_MS,
    });
  });
});
