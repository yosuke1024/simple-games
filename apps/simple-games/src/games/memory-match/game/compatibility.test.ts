/**
 * Golden boards: one daily and one pinned seed, exactly.
 *
 * A seed is a promise. The daily is the same board for every player, and §8's
 * "retry the same board" help only means anything if the seed keeps producing
 * the board the player memorised. Any change to the rng or the dealing order
 * will fail here, which is the point: it costs players their recorded bests
 * and their remembered layouts, so it has to be a decision rather than a side
 * effect.
 *
 * If a change here is intended, regenerate the strings and say so in the
 * commit message, along with what it costs existing players.
 */
import { describe, expect, it } from 'vitest';
import { deckToString } from './deck';
import { createDailySession, createDifficultySession } from './session';

describe('boards that must never change', () => {
  it('the daily for 2026-08-01 is unchanged', () => {
    const session = createDailySession('2026-08-01');
    expect(session.difficulty).toBe('medium');
    expect(session.deck.length).toBe(20);
    // Row-major, base 36, one symbol index per cell (4×5).
    expect(deckToString(session.deck)).toBe('1e70e7a68dbb26d1a082');
  });

  it('a pinned easy seed is unchanged', () => {
    const session = createDifficultySession('easy', 'memory-easy-golden');
    // Row-major, base 36, one symbol index per cell (3×4).
    expect(deckToString(session.deck)).toBe('737bbcd3c0d0');
  });
});
