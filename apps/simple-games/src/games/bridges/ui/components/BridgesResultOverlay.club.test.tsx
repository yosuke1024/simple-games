/**
 * What the clear screen hands the Club House (docs/BRIDGES_RULES.md §17): a
 * daily is one board for everyone and carries its date and board digest, so
 * it meets in that day's Today challenge; a free board is a result in its
 * difficulty's ranking table and carries neither. The figures are the card's.
 */
// Rendered without the game's Root, so the catalog the Root registers is registered here.
import '../../i18n';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { BRIDGES_CHALLENGE } from '../../challenge/contract';
import { boardDigestOf, createDailySession, createDifficultySession } from '../../game';
import type { BridgesSession } from '../../game';
import { BridgesResultOverlay } from './BridgesResultOverlay';

const clubProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('@/ui/components/ClubResultAction', () => ({
  ClubResultAction: (props: Record<string, unknown>) => {
    clubProps.current = props;
    return null;
  },
}));

function renderSolved(session: BridgesSession) {
  clubProps.current = null;
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <BridgesResultOverlay
        session={{ ...session, status: 'solved', elapsedSeconds: 75, hintCount: 2 }}
        lastResult={null}
        onRetry={vi.fn()}
        onNewBoard={vi.fn()}
        onHome={vi.fn()}
      />
    </SettingsProvider>,
  );
}

afterEach(cleanup);

describe('BridgesResultOverlay → Club', () => {
  it('sends a daily with its date and board digest, for Today', () => {
    const daily = createDailySession('2026-10-17');
    renderSolved(daily);
    expect(clubProps.current).toMatchObject({
      gameId: 'bridges',
      outcome: 'completed',
      seed: daily.seed,
      params: { difficulty: 'medium' },
      daily: '2026-10-17',
      boardDigest: boardDigestOf(daily),
    });
    // The contract takes the daily's params as they are: a refusal would drop it silently.
    expect(BRIDGES_CHALLENGE.validateParams(clubProps.current!.params)).toEqual({
      difficulty: 'medium',
    });
  });

  it('sends a free board to its difficulty’s ranking: no date, no digest', () => {
    renderSolved(createDifficultySession('hard', 'bridges-hard-golden'));
    expect(clubProps.current).toMatchObject({
      seed: 'bridges-hard-golden',
      params: { difficulty: 'hard' },
      daily: null,
      boardDigest: null,
    });
  });

  it('sends the card’s two figures, the same as the share’s strings', () => {
    renderSolved(createDifficultySession('easy', 'bridges-easy-golden'));
    expect(clubProps.current!.facts).toEqual({ elapsedSeconds: 75, hints: 2 });
    expect(clubProps.current!.details).toEqual([
      { label: 'Time', value: '1:15' },
      { label: 'Hints used', value: '2' },
    ]);
    expect(BRIDGES_CHALLENGE.validateFacts(clubProps.current!.facts)).toEqual({
      elapsedSeconds: 75,
      hints: 2,
    });
  });
});
