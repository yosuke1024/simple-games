/**
 * docs/ECHO_PADS_RULES.md §1, §4–§6, §8: the run's state machine, its
 * illegal moves, replay counting and restoring a suspended run.
 */
import { describe, expect, it } from 'vitest';
import { LEVELS } from './levels';
import { generateSequence } from './sequence';
import {
  addElapsed,
  canChangePace,
  canPlay,
  canPress,
  createDailySession,
  createLevelSession,
  endPlayback,
  isPlayingBack,
  longestReturned,
  padForKey,
  play,
  press,
  restoreSession,
  roundSequence,
  snapshotOf,
  type EchoSession,
  type EchoSnapshot,
} from './session';

const must = <T>(value: T | null): T => {
  expect(value).not.toBeNull();
  return value!;
};

const level = (n: number, attempt = 0): EchoSession => must(createLevelSession(n, attempt));

/** ▶, then the playback runs to its end. */
const listen = (s: EchoSession, pace: 'calm' | 'normal' | 'quick' = 'normal'): EchoSession =>
  must(endPlayback(must(play(s, pace))));

/** Presses the whole round correctly. */
function answerRound(start: EchoSession): EchoSession {
  let s = start;
  for (const pad of roundSequence(start)) s = must(press(s, pad));
  return s;
}

/** A pad that is not the next item. */
const wrongPad = (s: EchoSession): number => (s.sequence[s.inputCount]! + 1) % s.padCount;

describe('a new run (§1)', () => {
  it('starts idle at round 3 with the sequence of its seed', () => {
    for (const spec of LEVELS) {
      const s = level(spec.level, 2);
      expect(s.status).toBe('idle');
      expect(s.round).toBe(3);
      expect(s.padCount).toBe(spec.padCount);
      expect(s.target).toBe(spec.target);
      expect(s.seed).toBe(`echo-level-${spec.level}-r2`);
      expect(s.sequence).toEqual(generateSequence(s.seed, spec.padCount, spec.target).pads);
      expect(roundSequence(s)).toEqual(s.sequence.slice(0, 3));
    }
  });

  it('builds the daily on 6 pads, target 10, with its seed', () => {
    const s = must(createDailySession('2026-10-22', 1));
    expect([s.mode, s.padCount, s.target, s.seed]).toEqual([
      'daily',
      6,
      10,
      'echo-daily-2026-10-22-r1',
    ]);
  });

  it('refuses levels, attempts and dates that cannot exist', () => {
    expect(createLevelSession(0, 0)).toBeNull();
    expect(createLevelSession(23, 0)).toBeNull();
    expect(createLevelSession(1, -1)).toBeNull();
    expect(createLevelSession(1, 0.5)).toBeNull();
    expect(createDailySession('2026-02-30', 0)).toBeNull();
  });
});

describe('the round loop (§1, §5)', () => {
  it('idle → playing-back → awaiting-input → idle at k + 1, round k a prefix of round k + 1', () => {
    let s = level(5); // 4 pads, target 8
    const heard: number[][] = [];
    while (s.status !== 'cleared') {
      expect(s.status).toBe('idle');
      s = must(play(s, 'normal'));
      expect(s.status).toBe('playing-back');
      heard.push(roundSequence(s).slice());
      s = must(endPlayback(s));
      expect(s.status).toBe('awaiting-input');
      s = answerRound(s);
    }
    expect(heard.map((h) => h.length)).toEqual([3, 4, 5, 6, 7, 8]);
    for (let i = 1; i < heard.length; i++) {
      expect(heard[i]!.slice(0, heard[i - 1]!.length)).toEqual(heard[i - 1]);
    }
    expect(longestReturned(s)).toBe(8);
  });

  it('clears on the target round; a target-4 level is two rounds', () => {
    let s = level(1);
    s = answerRound(listen(s));
    expect([s.status, s.round]).toEqual(['idle', 4]);
    s = answerRound(listen(s));
    expect(s.status).toBe('cleared');
    expect(canPlay(s)).toBe(false);
    expect(canPress(s)).toBe(false);
  });

  it('ends the run on the first wrong press and remembers what was expected', () => {
    let s = listen(level(14));
    s = must(press(s, s.sequence[0]!));
    const expected = s.sequence[1]!;
    const pressed = wrongPad(s);
    s = must(press(s, pressed));
    expect(s.status).toBe('failed');
    expect(s.failure).toEqual({ round: 3, index: 1, pressed, expected });
    expect(longestReturned(s)).toBe(0);
    expect(canPress(s)).toBe(false);
  });

  it('reports k − 1 as the longest returned when round k fails', () => {
    let s = answerRound(listen(level(6)));
    s = answerRound(listen(s));
    s = listen(s); // round 5
    s = must(press(s, wrongPad(s)));
    expect([s.status, s.failure?.round, longestReturned(s)]).toEqual(['failed', 5, 4]);
  });
});

describe('illegal moves change nothing (§4–§6)', () => {
  it('pads do nothing while idle, playing back, reviewing, failed or cleared', () => {
    const idle = level(3);
    expect(press(idle, idle.sequence[0]!)).toBeNull();
    const playing = must(play(idle, 'quick'));
    expect(press(playing, playing.sequence[0]!)).toBeNull();
    const failed = must(press(must(endPlayback(playing)), wrongPad(must(endPlayback(playing)))));
    expect(press(failed, 0)).toBeNull();
    const reviewing = must(play(failed, 'normal'));
    expect(reviewing.status).toBe('reviewing');
    expect(press(reviewing, 0)).toBeNull();
    let cleared = level(12);
    cleared = answerRound(listen(answerRound(listen(cleared))));
    expect(cleared.status).toBe('cleared');
    expect(press(cleared, 0)).toBeNull();
  });

  it('pads that do not exist are refused, not failures', () => {
    const s = listen(level(1));
    for (const bad of [-1, 4, 1.5, Number.NaN]) expect(press(s, bad)).toBeNull();
    const six = listen(level(12));
    expect(press(six, 6)).toBeNull();
  });

  it('▶ is refused while playing back, after input began, and after a clear', () => {
    const playing = must(play(level(2), 'normal'));
    expect(canPlay(playing)).toBe(false);
    expect(play(playing, 'normal')).toBeNull();
    const started = must(press(listen(level(2)), level(2).sequence[0]!));
    expect(started.inputStarted).toBe(true);
    expect(canPlay(started)).toBe(false);
    expect(play(started, 'normal')).toBeNull();
    let cleared = level(1);
    cleared = answerRound(listen(answerRound(listen(cleared))));
    expect(play(cleared, 'normal')).toBeNull();
  });

  it('Stop with nothing playing is refused; an unknown pace is refused', () => {
    const s = level(1);
    expect(endPlayback(s)).toBeNull();
    expect(endPlayback(listen(s))).toBeNull();
    expect(play(s, 'fast' as never)).toBeNull();
  });

  it('pace changes only while nothing plays', () => {
    const s = level(1);
    expect(canChangePace(s)).toBe(true);
    const playing = must(play(s, 'calm'));
    expect(isPlayingBack(playing)).toBe(true);
    expect(canChangePace(playing)).toBe(false);
    expect(canChangePace(must(endPlayback(playing)))).toBe(true);
  });
});

describe('replays (§6)', () => {
  it('counts the second and later ▶ of a round before input, stops included', () => {
    let s = level(9);
    s = listen(s);
    expect([s.roundPlays, s.replays]).toEqual([1, 0]);
    s = listen(s);
    s = must(play(s, 'calm'));
    s = must(endPlayback(s)); // stopped part-way: still a ▶
    expect([s.roundPlays, s.replays]).toEqual([3, 2]);
    s = answerRound(s);
    // A new round: its first ▶ is free again.
    s = listen(s);
    expect([s.round, s.roundPlays, s.replays]).toEqual([4, 1, 2]);
    s = listen(s);
    expect(s.replays).toBe(3);
  });

  it('does not count playbacks after a failure, and they return to failed', () => {
    let s = listen(level(9));
    s = must(press(s, wrongPad(s)));
    const replays = s.replays;
    for (let i = 0; i < 5; i++) {
      s = must(play(s, 'normal'));
      expect(s.status).toBe('reviewing');
      expect(roundSequence(s)).toEqual(s.sequence.slice(0, 3));
      s = must(endPlayback(s));
      expect(s.status).toBe('failed');
    }
    expect(s.replays).toBe(replays);
  });

  it('records each pace heard once, in first-use order', () => {
    let s = level(9);
    s = listen(s, 'quick');
    s = listen(s, 'calm');
    s = listen(s, 'quick');
    expect(s.pacesHeard).toEqual(['quick', 'calm']);
  });
});

describe('suspend and restore (§8, decision 8 (B))', () => {
  it('a run left before input comes back before the first press, ▶ offered', () => {
    let s = answerRound(listen(level(10)));
    s = listen(s); // round 4, heard once, no input yet
    const snap = must(snapshotOf(s));
    const back = must(restoreSession(snap));
    expect(back.status).toBe('awaiting-input');
    expect(back.round).toBe(4);
    expect(back.inputStarted).toBe(false);
    expect(canPlay(back)).toBe(true);
    expect(back.sequence).toEqual(s.sequence);
    // The next ▶ is the round's second: a replay.
    expect(must(play(back, 'normal')).replays).toBe(s.replays + 1);
  });

  it('a round never played comes back idle', () => {
    const s = answerRound(listen(level(10)));
    const back = must(restoreSession(must(snapshotOf(s))));
    expect([back.status, back.round, back.roundPlays]).toEqual(['idle', 4, 0]);
  });

  it('a run left mid-input comes back at the first press with ▶ withheld', () => {
    let s = listen(level(10));
    s = must(press(s, s.sequence[0]!));
    s = must(press(s, s.sequence[1]!));
    const back = must(restoreSession(must(snapshotOf(s))));
    expect(back.status).toBe('awaiting-input');
    expect(back.inputStarted).toBe(true);
    expect(back.inputCount).toBe(0); // pressed again from the start
    expect(canPlay(back)).toBe(false);
    expect(play(back, 'normal')).toBeNull();
    expect(answerRound(back).round).toBe(4);
  });

  it('a run left during playback comes back with playback stopped', () => {
    const playing = must(play(level(10), 'normal'));
    const back = must(restoreSession(must(snapshotOf(playing))));
    expect(back.status).toBe('awaiting-input');
    expect(isPlayingBack(back)).toBe(false);
  });

  it('finished runs have no record', () => {
    let s = listen(level(1));
    s = must(press(s, wrongPad(s)));
    expect(snapshotOf(s)).toBeNull();
    expect(snapshotOf(must(play(s, 'normal')))).toBeNull();
  });

  it('round-trips daily runs and elapsed seconds', () => {
    let s = listen(must(createDailySession('2026-10-22', 2)));
    s = addElapsed(s, 12.5);
    const back = must(restoreSession(must(snapshotOf(s))));
    expect([back.mode, back.dailyDate, back.attempt, back.elapsedSeconds]).toEqual([
      'daily',
      '2026-10-22',
      2,
      12.5,
    ]);
  });

  it('refuses records the rules cannot produce', () => {
    const good: EchoSnapshot = must(snapshotOf(listen(level(10))));
    const bad: Partial<EchoSnapshot>[] = [
      { level: 0 },
      { level: 23 },
      { dailyDate: '2026-10-22' }, // a level run with a date
      { mode: 'daily' }, // a daily with a level
      { round: 2 },
      { round: 14 }, // level 10's target is 13
      { round: 3.5 },
      { attempt: -1 },
      { attempt: 1.5 },
      { inputStarted: true, roundPlays: 0 },
      { roundPlays: -1 },
      { replays: -1 },
      { roundPlays: 4, replays: 2 },
      { round: 3, roundPlays: 1, replays: 7 }, // round 3 has no earlier round's replays
      { round: 3, roundPlays: 0, replays: 3, pacesHeard: ['quick', 'calm'] }, // nothing played yet
      { round: 3, roundPlays: 1, replays: 0, pacesHeard: ['quick', 'calm'] }, // two paces from one play
      { pacesHeard: [] },
      { pacesHeard: ['normal', 'normal'] },
      { pacesHeard: ['fast' as never] },
      { elapsedSeconds: -1 },
      { elapsedSeconds: Number.POSITIVE_INFINITY },
    ];
    expect(restoreSession(good)).not.toBeNull();
    for (const patch of bad) {
      expect(
        restoreSession({ ...good, ...patch } as EchoSnapshot),
        JSON.stringify(patch),
      ).toBeNull();
    }
    expect(
      restoreSession({ ...good, mode: 'daily', level: null, dailyDate: '2026-02-30' }),
    ).toBeNull();
  });
});

describe('digit keys (§11)', () => {
  it('map 1..pads to pads in reading order', () => {
    expect([1, 2, 3, 4].map((k) => padForKey(String(k), 4))).toEqual([0, 1, 2, 3]);
    expect(padForKey('5', 4)).toBeNull();
    expect(padForKey('6', 6)).toBe(5);
    expect(padForKey('0', 6)).toBeNull();
    expect(padForKey('Enter', 6)).toBeNull();
  });
});
