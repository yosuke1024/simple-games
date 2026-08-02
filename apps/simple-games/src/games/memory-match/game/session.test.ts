/**
 * Session rules (docs/MEMORY_MATCH_RULES.md §2–§5, §8, §10): the mismatch that
 * waits for the next flip instead of a timer, the move counted on the second
 * card, and the restore that puts unmatched cards face down.
 */
import { describe, expect, it } from 'vitest';
import {
  createDailySession,
  createDifficultySession,
  layoutOf,
  restartSession,
  restoreSession,
  tapCard,
  type MemorySession,
} from './session';
import { cellCount, isValidDeck, LAYOUTS } from './types';

const SEED = 'memory-easy-test';

/** The two cells holding the given symbol. */
function cellsOf(session: MemorySession, symbol: number): [number, number] {
  const cells = session.deck
    .map((value, index) => ({ value, index }))
    .filter((cell) => cell.value === symbol)
    .map((cell) => cell.index);
  return [cells[0]!, cells[1]!];
}

/** Some symbol other than the one at `index`. */
function otherSymbolCell(session: MemorySession, index: number): number {
  const symbol = session.deck[index]!;
  return session.deck.findIndex((value) => value !== symbol);
}

describe('createDifficultySession', () => {
  it('deals a valid deck for every difficulty', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const session = createDifficultySession(difficulty, `memory-${difficulty}-t`);
      expect(isValidDeck(session.deck, LAYOUTS[difficulty])).toBe(true);
      expect(session.status).toBe('playing');
      expect(session.moveCount).toBe(0);
      expect(session.faceUp).toEqual([]);
    }
  });

  it('gives two fresh games different seeds', () => {
    expect(createDifficultySession('easy').seed).not.toBe(createDifficultySession('easy').seed);
  });

  it('deals the same board for the same seed (§5, §8)', () => {
    const a = createDifficultySession('easy', SEED);
    const b = createDifficultySession('easy', SEED);
    expect(a.deck).toEqual(b.deck);
  });
});

describe('tapCard', () => {
  it('turns the first card up without counting a move (§4)', () => {
    const session = createDifficultySession('easy', SEED);
    const next = tapCard(session, 0)!;
    expect(next.faceUp).toEqual([0]);
    expect(next.moveCount).toBe(0);
  });

  it('locks a found pair and counts the move (§3, §4)', () => {
    const session = createDifficultySession('easy', SEED);
    const [a, b] = cellsOf(session, session.deck[0]!);
    const next = tapCard(tapCard(session, a)!, b)!;
    expect(next.matched[a]).toBe(true);
    expect(next.matched[b]).toBe(true);
    expect(next.faceUp).toEqual([]);
    expect(next.moveCount).toBe(1);
  });

  it('keeps a mismatch face up until the next flip (§3)', () => {
    const session = createDifficultySession('easy', SEED);
    const first = 0;
    const second = otherSymbolCell(session, first);
    const shown = tapCard(tapCard(session, first)!, second)!;
    expect(shown.faceUp).toEqual([first, second]);
    expect(shown.moveCount).toBe(1);

    // The next flip puts the mismatch away and opens its own card.
    const third = shown.deck.findIndex(
      (_, index) => index !== first && index !== second,
    );
    const next = tapCard(shown, third)!;
    expect(next.faceUp).toEqual([third]);
    expect(next.moveCount).toBe(1);
  });

  it('ignores taps on matched, face-up, and out-of-range cells (§3)', () => {
    const session = createDifficultySession('easy', SEED);
    const [a, b] = cellsOf(session, session.deck[0]!);
    const oneUp = tapCard(session, a)!;
    expect(tapCard(oneUp, a)).toBeNull();
    const paired = tapCard(oneUp, b)!;
    expect(tapCard(paired, a)).toBeNull();
    expect(tapCard(session, -1)).toBeNull();
    expect(tapCard(session, cellCount(layoutOf(session)))).toBeNull();
    expect(tapCard(session, 0.5)).toBeNull();
  });

  it('solves when the last pair locks (§2)', () => {
    let session = createDifficultySession('easy', SEED);
    const symbols = [...new Set(session.deck)];
    for (const symbol of symbols) {
      const [a, b] = cellsOf(session, symbol);
      session = tapCard(tapCard(session, a)!, b)!;
    }
    expect(session.status).toBe('solved');
    expect(session.moveCount).toBe(symbols.length);
    expect(tapCard(session, 0)).toBeNull();
  });
});

describe('restartSession', () => {
  it('returns the same board with progress cleared (§8)', () => {
    const session = createDifficultySession('easy', SEED);
    const [a, b] = cellsOf(session, session.deck[0]!);
    const played = tapCard(tapCard(session, a)!, b)!;
    const retried = restartSession(played);
    expect(retried.deck).toEqual(session.deck);
    expect(retried.seed).toBe(session.seed);
    expect(retried.moveCount).toBe(0);
    expect(retried.matched.every((flag) => !flag)).toBe(true);
  });

  it('rebuilds a daily from its date', () => {
    const session = createDailySession('2026-08-01');
    const retried = restartSession(session);
    expect(retried.deck).toEqual(session.deck);
    expect(retried.dailyDate).toBe('2026-08-01');
    expect(retried.mode).toBe('daily');
  });
});

describe('restoreSession', () => {
  it('puts unmatched cards face down (§10)', () => {
    const session = createDifficultySession('easy', SEED);
    const restored = restoreSession({
      mode: session.mode,
      seed: session.seed,
      difficulty: session.difficulty,
      dailyDate: null,
      deck: session.deck,
      matched: session.matched,
      moveCount: 3,
      elapsedSeconds: 45,
    });
    expect(restored.faceUp).toEqual([]);
    expect(restored.status).toBe('playing');
    expect(restored.moveCount).toBe(3);
  });

  it('derives solved from a fully matched board', () => {
    const session = createDifficultySession('easy', SEED);
    const restored = restoreSession({
      mode: session.mode,
      seed: session.seed,
      difficulty: session.difficulty,
      dailyDate: null,
      deck: session.deck,
      matched: session.deck.map(() => true),
      moveCount: 9,
      elapsedSeconds: 60,
    });
    expect(restored.status).toBe('solved');
  });
});
