/**
 * Golden boards, pinned as a *physics* trace — the first of its kind in this
 * collection (docs/plans/2026-08-08-mahjong-bubble-ludo.md, Phase 3's
 * "latest convention" note). Brick Breaker's golden freezes a static layout;
 * this freezes a scripted shot sequence's board *after every shot*, so a
 * change to the rng, the generator, the level table, BOARD_SEED, the
 * reflection math, or the landing-cell tie-break will fail here — the
 * point, since it has to be a decision rather than a side effect.
 *
 * If a change here is intended, regenerate the strings (uncomment the dump
 * below, run it, copy the output) and say so in the commit message, along
 * with what it costs existing players.
 */
import { describe, expect, it } from 'vitest';
import { BOARD_SEED } from './constants';
import { boardToString } from './generator';
import { createSession, fireShot, type BubblePopSession } from './session';

/** A fixed angle script, chosen to exercise a wall bounce (±1.0 rad) as well
 * as gentle, unreflected shots — a trace of only straight-up shots would
 * never touch the reflection math this golden exists to pin. */
const SCRIPT = [0, 0.5, -0.5, 1.0, -1.0, 0.65, -0.65, 0.15, -0.15, 0.3];

function trace(level: number): string {
  let session: BubblePopSession = createSession(BOARD_SEED, level);
  const lines: string[] = [boardToString(session.board)];
  for (const angle of SCRIPT) {
    session = fireShot(session, angle);
    lines.push(boardToString(session.board));
    if (session.status !== 'playing') break;
  }
  return lines.join('\n---\n');
}

describe('boards that must never change', () => {
  it('level 1, ten scripted shots, is unchanged', () => {
    expect(trace(1)).toBe(
      [
        'pgpgyppb/bbybygb/pggygppy/bybgygb/pybpbbgp',
        'pgpgyppb/bbybygb/pggygppy/bybgygb/pybpbbgp/...g...',
        'pgpgyppb/bbybygb/pggygppy/bybgygb/pybpbbgp/...gy..',
        'pgpgyppb/bbybygb/pggygppy/by.gygb/py.pbbgp/...gy..',
        'pgpgyppb/bbybygb/pggygppy/by.gy.b/py.pbb.p/...gy..',
        'pgpgyppb/bbybygb/pggygppy/b..gy.b/p..pbb.p/...gy..',
        'pgpgyppb/bbybygb/pggygppy/b..gy.b/pg.pbb.p/...gy..',
        'pgpgyppb/bbybygb/pggygppy/b..gy.b/pg.pbb.p/...gy../....b...',
        'pgpgyppb/bbybygb/pggygppy/b..gy.b/pg.pbb.p/...gy../....bp..',
        'pgpgyppb/bbybygb/pggygppy/b..gy.b/pgbpbb.p/...gy../....bp..',
        'pgpgyppb/bbybygb/pggygppy/b..gy.b/pgbpbb.p/...gy.g/....bp..',
      ].join('\n---\n'),
    );
  });

  it('level 100 (deep — 9 rows, 6 colors), ten scripted shots, is unchanged', () => {
    expect(trace(100)).toBe(
      [
        'cygybocg/cyobogo/pbppgycg/ygyoyoy/ogcogogp/pbbygbp/gopcboyg/bgcyygp/yopbbpgc',
        'cygybocg/cyobogo/pbppgycg/ygyoyoy/ogcogogp/pbbygbp/gopcboyg/bgcyygp/yopbbpgc/...o...',
        'cygybocg/cyobogo/pbppgycg/ygyoyoy/ogcogogp/pbbygbp/gopcboyg/bgcyy.p/yopbbp.c/...o...',
        'cygybocg/cyobogo/pbppgycg/ygyoyoy/ogcogogp/pbbygbp/gopcboyg/bgcyy.p/yopbbp.c/o..o...',
        'cygybocg/cyobogo/pbppgycg/ygyoyoy/ogcogogp/pbbygbp/gopcboyg/bgcyy.p/yopbbp.c/o..o.../p.......',
        'cygybocg/cyobogo/pbppgycg/ygyoyoy/ogcogogp/pbbygbp/gopcboyg/bgcyy.p/yopbbp.c/o..o.c./p.......',
        'cygybocg/cyobogo/pbppgycg/ygyoyoy/ogcogogp/pbbygbp/gopcboyg/bgcyy.p/yopbbp.c/o..o.c./p.....p.',
        'cygybocg/cyobogo/pbppgycg/ygyoyoy/ogcogogp/pbbygbp/gopcboyg/bgcyy.p/yopbbp.c/o..o.c./p.....p./p......',
        'cygybocg/cyobogo/pbppgycg/ygyoyoy/ogcogogp/pbbygbp/gopcboyg/bgcyy.p/yopbbp.c/o..oyc./p.....p./p......',
        'cygybocg/cyobogo/pbppgycg/ygyoyoy/ogcogogp/pbbygbp/gopcboyg/bgcyy.p/yopbbp.c/o.poyc./p.....p./p......',
        'cygybocg/cyobogo/pbppgycg/ygyoyoy/ogcogogp/pbbygbp/gopcboyg/bgcyy.p/yopbbp.c/o.poyc./p.....p./p....p.',
      ].join('\n---\n'),
    );
  });
});
