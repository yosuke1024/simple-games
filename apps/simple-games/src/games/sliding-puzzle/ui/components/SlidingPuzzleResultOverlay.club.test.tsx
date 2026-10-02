/**
 * What the clear screen hands the Club House (docs/SLIDING_PUZZLE_RULES.md
 * §14): a daily is one board for everyone and carries its date and board
 * digest, so it meets in that day's Today challenge; a level is a result in
 * its size's ranking table and carries neither.
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { boardDigestOf, createDailySession, createLevelSession } from '../../game';
import type { SlidingPuzzleSession } from '../../game';
import { SlidingPuzzleResultOverlay } from './SlidingPuzzleResultOverlay';

const clubProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('@/ui/components/ClubResultAction', () => ({
  ClubResultAction: (props: Record<string, unknown>) => {
    clubProps.current = props;
    return null;
  },
}));

function renderSolved(session: SlidingPuzzleSession) {
  clubProps.current = null;
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <SlidingPuzzleResultOverlay
        session={{ ...session, status: 'solved', elapsedSeconds: 90, moveCount: 120 }}
        lastResult={null}
        onRetry={vi.fn()}
        onNextLevel={vi.fn()}
        onHome={vi.fn()}
      />
    </SettingsProvider>,
  );
}

afterEach(cleanup);

describe('SlidingPuzzleResultOverlay → Club', () => {
  it('sends a daily with its date and board digest, for Today', () => {
    const daily = createDailySession('2026-10-02');
    renderSolved(daily);
    expect(clubProps.current).toMatchObject({
      gameId: 'sliding-puzzle',
      outcome: 'completed',
      seed: daily.seed,
      params: { size: 4 },
      daily: '2026-10-02',
      boardDigest: boardDigestOf(daily),
    });
  });

  it('sends a level to its size’s ranking: no date, no digest', () => {
    renderSolved(createLevelSession(1));
    expect(clubProps.current).toMatchObject({
      params: { size: 3 },
      daily: null,
      boardDigest: null,
    });
  });
});
