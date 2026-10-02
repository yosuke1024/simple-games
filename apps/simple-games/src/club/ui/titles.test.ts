import { describe, expect, it } from 'vitest';
import type { Challenge } from '../api/types';
import { challengeTitle, rankingTitle } from './ClubScreen';
import { tierLabel, type T } from './common';

/** Answers with the key, so a test sees which word was asked for. */
const t = ((key: string) => key) as T;

const challenge = (gameId: string, params: unknown, daily: string | null): Challenge => ({
  id: 'ch',
  gameId,
  contractVersion: 1,
  params,
  seed: 's',
  boardDigest: 'x1:00000000',
  title: null,
  createdBy: { id: 'm', nickname: 'Ken' },
  createdAt: '2026-10-02T00:00:00.000Z',
  resultCount: 1,
  mine: false,
  daily,
});

describe('tier words', () => {
  it('names difficulties, Solitaire draws and Spider suits, and writes sizes as N×N', () => {
    expect(tierLabel('hard', t)).toBe('clubTier_hard');
    expect(tierLabel('draw-3', t)).toBe('clubTier_draw3');
    expect(tierLabel('1-suit', t)).toBe('clubTier_suit1');
    expect(tierLabel('4-suits', t)).toBe('clubTier_suits4');
    expect(tierLabel('8x8', t)).toBe('8×8');
  });

  it('keeps a one-table game and a daily board out of the title', () => {
    expect(rankingTitle('freecell', 'standard', t)).toBe('FreeCell');
    expect(challengeTitle(challenge('freecell', {}, '2026-10-02'), t)).toBe('FreeCell · clubDaily');
    expect(challengeTitle(challenge('water-sort', { tier: 'daily' }, '2026-10-02'), t)).toBe(
      'Water Sort · clubDaily',
    );
    expect(challengeTitle(challenge('takuzu', { size: 8 }, '2026-10-02'), t)).toBe(
      'Takuzu · 8×8 · clubDaily',
    );
  });
});
