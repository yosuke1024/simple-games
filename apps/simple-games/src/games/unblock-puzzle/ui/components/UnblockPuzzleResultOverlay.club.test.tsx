/**
 * What the clear card hands the Club House (docs/UNBLOCK_PUZZLE_RULES.md
 * §18): a daily is one board for everyone and carries its date and the dealt
 * board's digest, so it meets in that day's Today challenge; a Free Play
 * clear is a result in its difficulty's ranking table and carries neither.
 * The figures are the card's own — time, moves, hints — and nothing else.
 */
// Rendered without the game's Root, so the catalog the Root registers is registered here.
import '../../i18n';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { formatDuration } from '@/ui/format';
import {
  boardDigestOf,
  createDailySession,
  createFreeSession,
  doSlide,
  encodeBoard,
  rangeOf,
} from '../../game';
import type { UnblockSession } from '../../game';
import type { LastResult } from '../../state/GameContext';
import { UnblockPuzzleResultOverlay } from './UnblockPuzzleResultOverlay';

const clubProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('@/ui/components/ClubResultAction', () => ({
  ClubResultAction: (props: Record<string, unknown>) => {
    clubProps.current = props;
    return null;
  },
}));

const lastResult: LastResult = {
  facts: { moves: 14, minMoves: 12, cellsMoved: 23, seconds: 95, hints: 2 },
  optimal: false,
  improved: false,
  previous: null,
};

function renderSolved(session: UnblockSession) {
  clubProps.current = null;
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <UnblockPuzzleResultOverlay
        session={{ ...session, status: 'solved' }}
        lastResult={lastResult}
        onRetry={vi.fn()}
        onNewBoard={vi.fn()}
        onHome={vi.fn()}
      />
    </SettingsProvider>,
  );
}

afterEach(cleanup);

describe('UnblockPuzzleResultOverlay → Club', () => {
  it('sends a daily with its date and board digest, for Today', () => {
    const daily = createDailySession('2026-11-15');
    renderSolved(daily);
    expect(clubProps.current).toMatchObject({
      gameId: 'unblock-puzzle',
      outcome: 'completed',
      seed: 'unblock-puzzle-daily-2026-11-15',
      params: { difficulty: 'medium' },
      daily: '2026-11-15',
      boardDigest: boardDigestOf(daily),
    });
  });

  it('sends a Free Play clear to its difficulty’s ranking: no date, no digest', () => {
    const free = createFreeSession('hard', 'unblock-puzzle-hard-golden');
    renderSolved(free);
    expect(clubProps.current).toMatchObject({
      seed: 'unblock-puzzle-hard-golden',
      params: { difficulty: 'hard' },
      daily: null,
      boardDigest: null,
    });
  });

  it('sends the card’s time, moves and hints — not the fewest moves or the cells moved', () => {
    renderSolved(createFreeSession('easy', 'unblock-puzzle-easy-golden'));
    expect(clubProps.current?.facts).toEqual({ elapsedSeconds: 95, moves: 14, hints: 2 });
    // The same clear facts the share repeats.
    expect(clubProps.current?.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: '14' }),
        expect.objectContaining({ value: formatDuration(95) }),
      ]),
    );
  });

  it('digests the dealt board, not the board the moves left', () => {
    const dealt = createDailySession('2026-11-15');
    const digest = boardDigestOf(dealt);
    // The first block (past the target) that can slide anywhere at all.
    const block = dealt.start.blocks.findIndex((_, index) => {
      const range = rangeOf(dealt, index);
      return index > 0 && range.max > range.min;
    });
    const range = rangeOf(dealt, block);
    const to = dealt.board.positions[block] === range.min ? range.max : range.min;
    const played = doSlide(dealt, block, to)!;
    expect(encodeBoard(played.board)).not.toBe(encodeBoard(dealt.start));
    renderSolved(played);
    expect(clubProps.current?.boardDigest).toBe(digest);
    expect(digest).toBe('ub1:27dd6bae');
  });
});
