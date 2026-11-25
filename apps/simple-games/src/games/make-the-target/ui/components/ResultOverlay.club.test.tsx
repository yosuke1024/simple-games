/**
 * What the clear card hands the Club House (docs/MAKE_THE_TARGET_RULES.md
 * §16): a daily is one problem for everyone and carries its date and board
 * digest, so it meets in that day's Today challenge; a Free Play problem is a
 * result in its difficulty's ranking table and carries neither. The figure is
 * the card's time. The card after a shown solution sends nothing.
 */
// Rendered without the game's Root, so the catalog the Root registers is registered here.
import '../../i18n';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { MAKE_THE_TARGET_CHALLENGE } from '../../challenge/contract';
import { boardDigestOf, revealSolution, withElapsed, type MakeTheTargetSession } from '../../game';
import type { LastResult } from '../../state/GameContext';
import { dailyGame, freeGame, MISS, play, SOLVE } from '../test-helpers';
import { MakeTheTargetResultOverlay } from './ResultOverlay';

const clubProps = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
  calls: 0,
}));
vi.mock('@/ui/components/ClubResultAction', () => ({
  ClubResultAction: (props: Record<string, unknown>) => {
    clubProps.current = props;
    clubProps.calls++;
    return null;
  },
}));

const FIRST_CLEAR = { previousSeconds: null, isNewBest: true, bestSeconds: 83 } as const;

function show(session: MakeTheTargetSession, lastResult: LastResult | null) {
  clubProps.current = null;
  clubProps.calls = 0;
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <MakeTheTargetResultOverlay
        session={session}
        lastResult={lastResult}
        onRetry={vi.fn()}
        onNewBoard={vi.fn()}
        onHome={vi.fn()}
      />
    </SettingsProvider>,
  );
}

const solvedIn = (seconds: number, session: MakeTheTargetSession) =>
  play(withElapsed(session, seconds), ...SOLVE);

afterEach(cleanup);

describe('MakeTheTargetResultOverlay → Club', () => {
  it('sends a daily with its date and board digest, for Today', () => {
    const daily = solvedIn(83, dailyGame('2026-10-21'));
    show(daily, { seconds: 83, comparison: FIRST_CLEAR });
    expect(clubProps.current).toMatchObject({
      gameId: 'make-the-target',
      outcome: 'completed',
      seed: 'make-the-target-daily-2026-10-21',
      params: { difficulty: 'medium' },
      daily: '2026-10-21',
      boardDigest: boardDigestOf(daily),
    });
    expect(clubProps.current!.boardDigest).toMatch(/^tg1:[0-9a-f]{8}$/);
    // The contract takes the daily's params as they are: a refusal would drop it silently.
    expect(MAKE_THE_TARGET_CHALLENGE.validateParams(clubProps.current!.params)).toEqual({
      difficulty: 'medium',
    });
  });

  it('sends a Free Play clear to its difficulty’s ranking: no date, no digest', () => {
    const free = solvedIn(83, freeGame('easy'));
    show(free, { seconds: 83, comparison: FIRST_CLEAR });
    expect(clubProps.current).toMatchObject({
      gameId: 'make-the-target',
      outcome: 'completed',
      seed: free.seed,
      params: { difficulty: 'easy' },
      daily: null,
      boardDigest: null,
    });
  });

  it('sends the card’s time, the same as the share’s string', () => {
    show(solvedIn(83, freeGame('medium')), { seconds: 83, comparison: FIRST_CLEAR });
    expect(clubProps.current!.facts).toEqual({ elapsedSeconds: 83 });
    expect(clubProps.current!.details).toEqual([
      { label: 'Difficulty', value: 'Medium' },
      { label: 'Time', value: '1:23' },
      { label: 'Numbers', value: '4' },
    ]);
    expect(MAKE_THE_TARGET_CHALLENGE.validateFacts(clubProps.current!.facts)).toEqual({
      elapsedSeconds: 83,
    });
  });

  it('sends a clear in 0:00 as it is', () => {
    show(solvedIn(0, freeGame('easy')), { seconds: 0, comparison: FIRST_CLEAR });
    expect(clubProps.current!.facts).toEqual({ elapsedSeconds: 0 });
  });

  it('a retry of a solved problem is sent like any clear (outcome completed, §16)', () => {
    show(solvedIn(5, freeGame('easy')), { seconds: 5, comparison: null });
    expect(clubProps.current).toMatchObject({ outcome: 'completed', facts: { elapsedSeconds: 5 } });
  });

  it('the card after a shown solution sends nothing', () => {
    show(revealSolution(play(freeGame(), ...MISS))!, null);
    expect(clubProps.calls).toBe(0);
  });

  it('nothing is sent while the problem is still in play or missed', () => {
    show(freeGame(), null);
    expect(clubProps.calls).toBe(0);
    cleanup();
    show(play(freeGame(), ...MISS), null);
    expect(clubProps.calls).toBe(0);
  });
});
