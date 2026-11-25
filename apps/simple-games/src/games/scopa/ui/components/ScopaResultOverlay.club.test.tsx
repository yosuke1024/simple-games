/**
 * What the result card hands the Club House (docs/SCOPA_RULES.md §17): the
 * match's two final scores, read from the same fields as the share line, in
 * the one `standard` table. A lost match is ranked too, by the player's own
 * score, so the card hands `completed` either way; the share keeps its own
 * won / played split. There is no daily, so no date and no board digest.
 */
// Rendered without the game's Root, so the catalog the Root registers is registered here.
import '../../i18n';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { createSession, type ScopaSession } from '../../game';
import type { LastResult } from '../../state/GameContext';
import { ScopaResultOverlay } from './ScopaResultOverlay';

const clubProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
const shareProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('@/ui/components/ClubResultAction', () => ({
  ClubResultAction: (props: Record<string, unknown>) => {
    clubProps.current = props;
    return null;
  },
}));
vi.mock('@/ui/components/ShareAction', () => ({
  ShareAction: (props: Record<string, unknown>) => {
    shareProps.current = props;
    return null;
  },
}));

function renderEnded(session: ScopaSession, lastResult: LastResult | null) {
  clubProps.current = null;
  shareProps.current = null;
  return render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <ScopaResultOverlay
        session={session}
        lastResult={lastResult}
        onRematch={vi.fn()}
        onHome={vi.fn()}
      />
    </SettingsProvider>,
  );
}

const ended = (status: 'won' | 'lost', mine: number, theirs: number) => {
  const session: ScopaSession = {
    ...createSession('scopa-club-test'),
    status,
    scores: [mine, theirs],
    lastDeal: null,
  };
  return { session, lastResult: { status, mine, theirs } satisfies LastResult };
};

afterEach(cleanup);

describe('ScopaResultOverlay → Club', () => {
  it('sends a won match by its final score, in the standard table', () => {
    const { session, lastResult } = ended('won', 12, 9);
    renderEnded(session, lastResult);
    expect(clubProps.current).toMatchObject({
      gameId: 'scopa',
      outcome: 'completed',
      facts: { score: 12, cpuScore: 9 },
      seed: 'scopa-club-test',
      params: {},
      boardDigest: null,
    });
    expect(clubProps.current?.daily).toBeUndefined();
    expect(shareProps.current).toMatchObject({ gameId: 'scopa', outcome: 'completed' });
  });

  it('sends a lost match too, as completed with the player’s own score', () => {
    const { session, lastResult } = ended('lost', 7, 11);
    renderEnded(session, lastResult);
    expect(clubProps.current).toMatchObject({
      outcome: 'completed',
      facts: { score: 7, cpuScore: 11 },
    });
    // The share keeps its own split: a loss is shared as played.
    expect(shareProps.current).toMatchObject({ outcome: 'played' });
  });

  it('builds the facts from the same values as the share details and the card', () => {
    const { session, lastResult } = ended('won', 11, 4);
    const { getByText } = renderEnded(session, lastResult);
    const details = clubProps.current?.details as readonly { value: string }[];
    expect(details).toBe(shareProps.current?.details);
    expect(details.map((d) => d.value)).toEqual(['11', '4']);
    const facts = clubProps.current?.facts as { score: number; cpuScore: number };
    expect([String(facts.score), String(facts.cpuScore)]).toEqual(details.map((d) => d.value));
    expect(getByText('11')).toBeTruthy();
    expect(getByText('4')).toBeTruthy();
  });

  it('keeps the seed within the Club’s limit', () => {
    const fresh = createSession();
    expect(fresh.seed.length).toBeLessThanOrEqual(80);
  });

  it('sends nothing while the match is still being played', () => {
    renderEnded(createSession('scopa-club-test'), null);
    expect(clubProps.current).toBeNull();
  });
});
