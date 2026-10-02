/**
 * What the clear screen hands the Club House (docs/MEMORY_MATCH_RULES.md §14):
 * a daily is one board for everyone and carries its date and board digest, so
 * it meets in that day's Today challenge; a difficulty board is a result in its
 * ranking table and carries neither.
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { boardDigestOf, createDailySession, createDifficultySession } from '../../game';
import type { MemorySession } from '../../game';
import { MemoryResultOverlay } from './MemoryResultOverlay';

const clubProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('@/ui/components/ClubResultAction', () => ({
  ClubResultAction: (props: Record<string, unknown>) => {
    clubProps.current = props;
    return null;
  },
}));

function renderSolved(session: MemorySession) {
  clubProps.current = null;
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <MemoryResultOverlay
        session={{ ...session, status: 'solved', elapsedSeconds: 90, moveCount: 30 }}
        lastResult={null}
        onRetry={vi.fn()}
        onHome={vi.fn()}
      />
    </SettingsProvider>,
  );
}

afterEach(cleanup);

describe('MemoryResultOverlay → Club', () => {
  it('sends a daily with its date and board digest, for Today', () => {
    const daily = createDailySession('2026-10-02');
    renderSolved(daily);
    expect(clubProps.current).toMatchObject({
      gameId: 'memory-match',
      outcome: 'completed',
      seed: daily.seed,
      params: { difficulty: 'medium' },
      daily: '2026-10-02',
      boardDigest: boardDigestOf(daily),
    });
  });

  it('sends a difficulty board to its ranking: no date, no digest', () => {
    renderSolved(createDifficultySession('easy', 'memory-easy-golden'));
    expect(clubProps.current).toMatchObject({
      params: { difficulty: 'easy' },
      daily: null,
      boardDigest: null,
    });
  });
});
