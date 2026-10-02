/**
 * What the result card hands the Club House (docs/NUMBER_MATCH_RULES.md §17):
 * a daily is one board for everyone and carries its date and board digest, so
 * it meets in that day's Today challenge; a level or free board is a result in
 * the game's ranking table and carries neither. A dead end is `played` and is
 * never sent anywhere (the bridge drops it); the card still hands it over as
 * it always did.
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import {
  boardDigestOf,
  createDailySession,
  createFreeSession,
  createLevelSession,
} from '../../game';
import type { GameSession } from '../../game';
import { ResultOverlay } from './ResultOverlay';

const clubProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('@/ui/components/ClubResultAction', () => ({
  ClubResultAction: (props: Record<string, unknown>) => {
    clubProps.current = props;
    return null;
  },
}));

function renderEnded(session: GameSession, status: 'cleared' | 'gameOver') {
  clubProps.current = null;
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <ResultOverlay
        session={{ ...session, status, elapsedSeconds: 75, moveCount: 12 }}
        lastResult={null}
        onRetry={vi.fn()}
        onNextLevel={vi.fn()}
        onNewFree={vi.fn()}
        onHome={vi.fn()}
      />
    </SettingsProvider>,
  );
}

afterEach(cleanup);

describe('ResultOverlay → Club', () => {
  it('sends a cleared daily with its date and board digest, for Today', () => {
    const daily = createDailySession('2026-10-02');
    renderEnded(daily, 'cleared');
    expect(clubProps.current).toMatchObject({
      gameId: 'number-match',
      outcome: 'completed',
      seed: daily.seed,
      params: {},
      daily: '2026-10-02',
      boardDigest: boardDigestOf(daily),
    });
  });

  it('hands a dead-end daily over as played — the bridge sends nothing for it', () => {
    renderEnded(createDailySession('2026-10-02'), 'gameOver');
    expect(clubProps.current).toMatchObject({ outcome: 'played', daily: '2026-10-02' });
  });

  it('sends a level or free board to the ranking: no date, no digest', () => {
    renderEnded(createLevelSession(1), 'cleared');
    expect(clubProps.current).toMatchObject({ daily: null, boardDigest: null });
    renderEnded(createFreeSession('easy', 'free-test'), 'cleared');
    expect(clubProps.current).toMatchObject({ daily: null, boardDigest: null });
  });
});
