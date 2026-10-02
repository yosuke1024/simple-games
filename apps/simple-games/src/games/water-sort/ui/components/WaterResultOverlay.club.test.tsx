/**
 * What the clear screen hands the Club House (docs/WATER_SORT_RULES.md §14): a
 * daily is one board for everyone and carries its date, its board digest and
 * the `daily` params — it matches no ranking tier, so it is sent to Today and
 * never to a table. Any other board keeps the tier gate: a free board or one of
 * the three tier levels goes to its tier's ranking, and every other level has
 * none.
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { WATER_SORT_CHALLENGE } from '../../challenge/contract';
import {
  boardDigestOf,
  createDailySession,
  createFreeSession,
  createLevelSession,
  restoreSession,
  TUBE_CAPACITY,
  type WaterSession,
} from '../../game';
import { WaterResultOverlay } from './WaterResultOverlay';

const clubProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('@/ui/components/ClubResultAction', () => ({
  ClubResultAction: (props: Record<string, unknown>) => {
    clubProps.current = props;
    return null;
  },
}));

/** The board with every colour in a tube of its own — the solved end state. */
function solved(fresh: WaterSession): WaterSession {
  const sorted = Array.from({ length: fresh.colors }, (_, color) =>
    new Array<number>(TUBE_CAPACITY).fill(color),
  );
  return restoreSession({
    mode: fresh.mode,
    seed: fresh.seed,
    colors: fresh.colors,
    dailyDate: fresh.dailyDate,
    level: fresh.level,
    freeTier: fresh.freeTier,
    tubes: [...sorted, [], []],
    moveCount: 30,
    hintCount: 0,
    elapsedSeconds: 100,
  });
}

function renderSolved(session: WaterSession) {
  clubProps.current = null;
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <WaterResultOverlay
        session={solved(session)}
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

describe('WaterResultOverlay → Club', () => {
  it('sends the daily with its date, digest and daily params, though no tier deals it', () => {
    const daily = createDailySession('2026-10-02');
    renderSolved(daily);
    expect(clubProps.current).toMatchObject({
      gameId: 'water-sort',
      outcome: 'completed',
      seed: daily.seed,
      params: { tier: 'daily' },
      daily: '2026-10-02',
      boardDigest: boardDigestOf(daily),
    });
    // The params the overlay sends are the ones the contract accepts.
    expect(WATER_SORT_CHALLENGE.validateParams(clubProps.current!.params)).toEqual({
      tier: 'daily',
    });
  });

  it('sends a tier level to its ranking: tier params, no date', () => {
    const level = createLevelSession(50);
    renderSolved(level);
    expect(clubProps.current).toMatchObject({
      params: { tier: 'medium' },
      daily: null,
      boardDigest: boardDigestOf(level),
    });
  });

  it('sends a free board to its tier’s ranking', () => {
    renderSolved(createFreeSession('hard', 'water-free-test'));
    expect(clubProps.current).toMatchObject({ params: { tier: 'hard' }, daily: null });
  });

  it('sends nothing for a level no tier deals', () => {
    renderSolved(createLevelSession(1));
    expect(clubProps.current).toBeNull();
  });
});
