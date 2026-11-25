/**
 * The board digest the Club House compares (docs/TANGRAM_RULES.md §14,
 * docs/architecture/club.md §6-4). It is what tells Today's daily challenge
 * that a device dealt the same figure, so it is pinned like the catalog
 * itself: a digest that moves is every device's daily no longer matching.
 * The dailies of 2026-10-21 (`arrow`) and 2026-12-31 (`crown`) are dates
 * compatibility.test.ts already pins; these lines pin what they hash to.
 */
import { describe, expect, it } from 'vitest';
import { dailyFigure, figureById, FIGURES } from './catalog';
import { BOARD_DIGEST_PREFIX, boardDigest, boardDigestOf } from './challenge';
import { PIECE_IDS } from './pieces';
import {
  createDailySession,
  createSession,
  placePiece,
  restartSession,
  rotatePiece,
  withElapsedSeconds,
  type TangramSession,
} from './session';
import { atVertex0 } from './test-helpers';

const daily = (date: string): TangramSession => createDailySession(date)!;

/** Every non-fixed piece where the catalog's solution puts it: the figure complete. */
function solved(session: TangramSession): TangramSession {
  let out = session;
  for (const id of PIECE_IDS) {
    if (out.figure.fixed.includes(id)) continue;
    out = placePiece(out, id, atVertex0(out.figure.solution[id]))!;
  }
  return out;
}

describe('board digest', () => {
  it('the 2026-10-21 daily and the 2026-12-31 daily hash to their pinned digests', () => {
    expect(daily('2026-10-21').figure.id).toBe('arrow');
    expect(boardDigestOf(daily('2026-10-21'))).toBe('tn1:d57a5991');
    expect(daily('2026-12-31').figure.id).toBe('crown');
    expect(boardDigestOf(daily('2026-12-31'))).toBe('tn1:9ed52f9b');
  });

  it('a Free Play figure of each other tier hashes to its pinned digest', () => {
    expect(boardDigestOf(createSession(figureById('square')!))).toBe('tn1:4192bd69');
    expect(boardDigestOf(createSession(figureById('mushroom')!))).toBe('tn1:758e0e7d');
  });

  it('is the prefix and eight lowercase hex digits', () => {
    expect(BOARD_DIGEST_PREFIX).toBe('tn1:');
    for (const figure of FIGURES) expect(boardDigest(figure)).toMatch(/^tn1:[0-9a-f]{8}$/);
  });

  it('tells every figure of the catalog apart', () => {
    const digests = new Set(FIGURES.map(boardDigest));
    expect(digests.size).toBe(FIGURES.length);
  });

  it('the same date gives the same digest, and the next day a different one', () => {
    expect(boardDigestOf(daily('2026-12-31'))).toBe(boardDigestOf(daily('2026-12-31')));
    expect(boardDigestOf(daily('2026-12-31'))).not.toBe(boardDigestOf(daily('2027-01-01')));
  });

  it('is the figure’s: the same Medium figure in Free Play, or on its next turn as the daily (§6)', () => {
    // The daily comes back to the same figure after a full round of the Medium
    // list, so the digest alone does not name the day — the Club's seed carries
    // the date (ui/components/ResultOverlay.tsx).
    const n = FIGURES.filter((figure) => figure.tier === 'medium').length;
    const later = new Date(Date.UTC(2026, 9, 21 + n)).toISOString().slice(0, 10);
    expect(dailyFigure(later)!.id).toBe('arrow');
    expect(boardDigestOf(daily(later))).toBe(boardDigestOf(daily('2026-10-21')));
    expect(boardDigestOf(createSession(figureById('arrow')!))).toBe(
      boardDigestOf(daily('2026-10-21')),
    );
  });

  it('does not move as the figure is played, finished, timed or restarted', () => {
    const start = daily('2026-12-31');
    const before = boardDigestOf(start);
    const free = PIECE_IDS.find((id) => !start.figure.fixed.includes(id))!;
    const turned = rotatePiece(start, free)!;
    const placed = placePiece(start, free, atVertex0(start.figure.solution[free]))!;
    const done = solved(withElapsedSeconds(start, 95));
    expect(done.status).toBe('complete');
    for (const session of [turned, placed, done, restartSession(done)]) {
      expect(boardDigestOf(session)).toBe(before);
    }
  });

  it('hashes the fixed pieces too: Medium’s start board is part of the figure (§3)', () => {
    const arrow = figureById('arrow')!;
    expect(arrow.fixed).toEqual(['L1', 'P']);
    expect(boardDigest({ ...arrow, fixed: [] })).not.toBe(boardDigest(arrow));
  });
});
