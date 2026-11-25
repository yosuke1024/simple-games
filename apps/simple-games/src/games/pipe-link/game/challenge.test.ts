/**
 * The board digest the Club House compares (docs/PIPE_LINK_RULES.md §16,
 * docs/architecture/club.md §6-4). It is what tells Today's daily challenge
 * that a device played the same puzzle, so it is pinned like the boards
 * themselves: a digest that moves is every device's daily no longer matching.
 * The text it hashes is the golden boards' four strings (compatibility.test.ts);
 * a change to that text is a new digest prefix.
 */
import { describe, expect, it } from 'vitest';
import { boardDigest, boardDigestOf, BOARD_DIGEST_PREFIX } from './challenge';
import { hashSeed } from './rng';
import {
  askHint,
  createDailySession,
  createDifficultySession,
  fromRecord,
  restartSession,
  toRecord,
  turnTile,
  undo,
  withElapsedSeconds,
} from './session';

describe('board digest', () => {
  it('pins the digests of three daily boards', () => {
    expect(boardDigestOf(createDailySession('2026-10-22'))).toBe('pn1:de36a62d');
    expect(boardDigestOf(createDailySession('2026-10-23'))).toBe('pn1:9b24c8f6');
    expect(boardDigestOf(createDailySession('2026-11-15'))).toBe('pn1:55203524');
  });

  it('pins the digests of the golden difficulty boards, eight digits even with a leading zero', () => {
    expect(boardDigestOf(createDifficultySession('easy', 'pipe-link-easy-golden'))).toBe(
      'pn1:bc615112',
    );
    expect(boardDigestOf(createDifficultySession('medium', 'pipe-link-medium-golden'))).toBe(
      'pn1:971268bc',
    );
    expect(boardDigestOf(createDifficultySession('hard', 'pipe-link-hard-golden'))).toBe(
      'pn1:01f1fa7c',
    );
  });

  it("hashes the golden daily's types, source, answer and starting orientations", () => {
    // The strings compatibility.test.ts pins for 2026-10-22, joined by `|`.
    const text = [
      'eeleelesetttsesettetltttttteellsteeltetltlelelele',
      '16',
      '2122213012020202020030320133013003212120130030303',
      '1313000123121313300023332331133130303031302101132',
    ].join('|');
    expect(boardDigestOf(createDailySession('2026-10-22'))).toBe(
      BOARD_DIGEST_PREFIX + hashSeed(text).toString(16).padStart(8, '0'),
    );
  });

  it('is the same digest for the same date and a different one for another date', () => {
    expect(boardDigestOf(createDailySession('2026-10-22'))).toBe(
      boardDigestOf(createDailySession('2026-10-22')),
    );
    expect(boardDigestOf(createDailySession('2026-10-22'))).not.toBe(
      boardDigestOf(createDailySession('2026-10-23')),
    );
  });

  it('is the prefix and eight lowercase hex digits', () => {
    const session = createDailySession('2026-10-22');
    expect(BOARD_DIGEST_PREFIX).toBe('pn1:');
    expect(boardDigestOf(session)).toMatch(/^pn1:[0-9a-f]{8}$/);
    expect(boardDigestOf(session)).toBe(boardDigest(session));
  });

  it('does not move as the board is played, hinted, undone or restarted', () => {
    const session = createDifficultySession('medium', 'pipe-link-medium-golden');
    const before = boardDigestOf(session);
    // Turn the first tile that is not already in its answer's orientation.
    const cell = session.current.findIndex((value, i) => value !== session.solution[i]);
    expect(cell).toBeGreaterThanOrEqual(0);
    const played = turnTile(session, cell, 'cw');
    expect(played).not.toBeNull();
    if (played === null) return;
    expect(played.current).not.toEqual(session.current);
    expect(boardDigestOf(played)).toBe(before);
    const hinted = askHint(withElapsedSeconds(played, 42)).session;
    expect(boardDigestOf(hinted)).toBe(before);
    const undone = undo(hinted);
    expect(undone).not.toBeNull();
    if (undone !== null) expect(boardDigestOf(undone)).toBe(before);
    expect(boardDigestOf(restartSession(hinted))).toBe(before);
    expect(before).toBe('pn1:971268bc');
  });

  it('does not move on a daily as it is played', () => {
    const session = createDailySession('2026-10-22');
    const cell = session.current.findIndex((value, i) => value !== session.solution[i]);
    const played = turnTile(session, cell, 'ccw');
    expect(played).not.toBeNull();
    if (played === null) return;
    expect(boardDigestOf(played)).toBe('pn1:de36a62d');
  });

  // A suspended board comes back from its record (§7): a decode that
  // normalised an orientation (a straight's 0/2, say) would quietly make a
  // resumed daily a separate Today challenge.
  it('does not move when a played board is suspended and resumed', () => {
    const daily = createDailySession('2026-10-22');
    const dailyCell = daily.current.findIndex((value, i) => value !== daily.solution[i]);
    const playedDaily = turnTile(daily, dailyCell, 'cw');
    expect(playedDaily).not.toBeNull();
    if (playedDaily === null) return;
    const resumedDaily = fromRecord(toRecord(playedDaily));
    expect(resumedDaily).not.toBeNull();
    if (resumedDaily !== null) expect(boardDigestOf(resumedDaily)).toBe('pn1:de36a62d');

    const free = createDifficultySession('hard', 'pipe-link-hard-golden');
    const freeCell = free.current.findIndex((value, i) => value !== free.solution[i]);
    const playedFree = turnTile(free, freeCell, 'cw');
    expect(playedFree).not.toBeNull();
    if (playedFree === null) return;
    const resumedFree = fromRecord(toRecord(playedFree));
    expect(resumedFree).not.toBeNull();
    if (resumedFree !== null) expect(boardDigestOf(resumedFree)).toBe('pn1:01f1fa7c');
  });
});
