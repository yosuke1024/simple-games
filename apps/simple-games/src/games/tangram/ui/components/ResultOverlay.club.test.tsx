/**
 * What the completion card hands the Club House (docs/TANGRAM_RULES.md §14):
 * a daily is one figure for everyone that day and carries its date and the
 * figure's digest, so it meets in that day's Today challenge; a Free Play
 * figure is a result in its tier's ranking table and carries neither. The
 * figure sent is the card's time.
 */
// Rendered without the game's Root, so the catalog the Root registers is registered here.
import '../../i18n';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { TANGRAM_CHALLENGE } from '../../challenge/contract';
import {
  boardDigestOf,
  createDailySession,
  createSession,
  figureById,
  figureNumber,
  PIECE_IDS,
  placePiece,
  withElapsedSeconds,
  type Figure,
  type TangramSession,
} from '../../game';
import type { LastResult } from '../../state/GameContext';
import { TangramResultOverlay } from './ResultOverlay';

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

/** Every non-fixed piece where the catalog's solution puts it: the figure complete. */
function solved(session: TangramSession, seconds: number): TangramSession {
  let out = withElapsedSeconds(session, seconds);
  for (const id of PIECE_IDS) {
    if (out.figure.fixed.includes(id)) continue;
    const pose = out.figure.solution[id];
    out = placePiece(out, id, { ...pose, pv: pose.at })!;
  }
  expect(out.status).toBe('complete');
  return out;
}

/** The LastResult GameContext books for this completion. */
const resultOf = (session: TangramSession, previous: number | null = null): LastResult => ({
  mode: session.mode,
  tier: session.figure.tier,
  number: figureNumber(session.figure),
  dailyDate: session.dailyDate,
  seconds: session.elapsedSeconds,
  previous,
});

const free = (id: string): Figure => figureById(id)!;

function show(session: TangramSession, lastResult: LastResult | null) {
  clubProps.current = null;
  clubProps.calls = 0;
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <TangramResultOverlay
        session={session}
        lastResult={lastResult}
        onRetry={vi.fn()}
        onNextFigure={vi.fn()}
        onHome={vi.fn()}
      />
    </SettingsProvider>,
  );
}

afterEach(cleanup);

describe('TangramResultOverlay → Club', () => {
  it('sends a daily with its date and the figure’s digest, for Today', () => {
    const daily = solved(createDailySession('2026-10-21')!, 83);
    show(daily, resultOf(daily));
    expect(clubProps.current).toMatchObject({
      gameId: 'tangram',
      outcome: 'completed',
      seed: 'tangram-daily-2026-10-21',
      params: { tier: 'medium' },
      daily: '2026-10-21',
      boardDigest: boardDigestOf(daily),
    });
    expect(clubProps.current!.boardDigest).toBe('tn1:d57a5991');
    // The contract takes the daily's params as they are: a refusal would drop it silently.
    expect(TANGRAM_CHALLENGE.validateParams(clubProps.current!.params)).toEqual({
      tier: 'medium',
    });
  });

  it('gives the same figure on another day another seed: the digest alone repeats', () => {
    // 2026-11-02 deals `arrow` again (12 Medium figures, §6).
    const first = solved(createDailySession('2026-10-21')!, 83);
    const again = solved(createDailySession('2026-11-02')!, 83);
    expect(again.figure.id).toBe(first.figure.id);
    show(again, resultOf(again));
    expect(clubProps.current).toMatchObject({
      seed: 'tangram-daily-2026-11-02',
      daily: '2026-11-02',
      boardDigest: boardDigestOf(first),
    });
  });

  it('sends a Free Play completion to its tier’s ranking: no date, no digest', () => {
    for (const id of ['square', 'arrow', 'mushroom']) {
      cleanup();
      const done = solved(createSession(free(id)), 83);
      show(done, resultOf(done));
      expect(clubProps.current).toMatchObject({
        gameId: 'tangram',
        outcome: 'completed',
        seed: id,
        params: { tier: done.figure.tier },
        daily: null,
        boardDigest: null,
      });
      expect(TANGRAM_CHALLENGE.validateParams(clubProps.current!.params)).toEqual({
        tier: done.figure.tier,
      });
    }
  });

  it('sends the card’s time, the same as the share’s string', () => {
    const done = solved(createSession(free('square')), 83);
    show(done, resultOf(done, 90));
    expect(clubProps.current!.facts).toEqual({ elapsedSeconds: 83 });
    expect(clubProps.current!.details).toEqual([
      { label: 'Tier', value: 'Easy' },
      { label: 'Figure', value: '1' },
      { label: 'Time', value: '1:23' },
    ]);
    expect(TANGRAM_CHALLENGE.validateFacts(clubProps.current!.facts)).toEqual({
      elapsedSeconds: 83,
    });
  });

  it('sends a completion in 0:00 as it is', () => {
    const done = solved(createSession(free('square')), 0);
    show(done, resultOf(done));
    expect(clubProps.current!.facts).toEqual({ elapsedSeconds: 0 });
  });

  it('nothing is sent while the figure is still in play', () => {
    const playing = createSession(free('square'));
    show(playing, null);
    expect(clubProps.calls).toBe(0);
  });
});
