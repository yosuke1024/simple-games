/**
 * What the clear screen hands the Club House (docs/PIPE_LINK_RULES.md §16): a
 * daily is one board for everyone and carries its date and board digest, so
 * it meets in that day's Today challenge; a free board is a result in its
 * difficulty's ranking table and carries neither. The figures are the card's.
 *
 * The card mounts only after the reveal beat (useResultReveal); under Reduced
 * Motion it is there at once, so the settings ask for it rather than leaning
 * on jsdom having no matchMedia.
 */
// Rendered without the game's Root, so the catalog the Root registers is registered here.
import '../../i18n';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { PIPE_LINK_CHALLENGE } from '../../challenge/contract';
import { boardDigestOf, createDailySession, createDifficultySession } from '../../game';
import type { PipeLinkSession } from '../../game';
import { PipeLinkResultOverlay } from './ResultOverlay';

const clubProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('@/ui/components/ClubResultAction', () => ({
  ClubResultAction: (props: Record<string, unknown>) => {
    clubProps.current = props;
    return null;
  },
}));

function renderSolved(session: PipeLinkSession) {
  clubProps.current = null;
  render(
    <SettingsProvider initialSettings={{ ...settingsSchema.defaultValue(), reducedMotion: true }}>
      <PipeLinkResultOverlay
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

describe('PipeLinkResultOverlay → Club', () => {
  it('sends a daily with its date and board digest, for Today', () => {
    const daily = createDailySession('2026-10-22');
    renderSolved(daily);
    expect(clubProps.current).toMatchObject({
      gameId: 'pipe-link',
      outcome: 'completed',
      seed: 'pipe-link-daily-2026-10-22',
      params: { difficulty: 'medium' },
      daily: '2026-10-22',
      boardDigest: 'pn1:de36a62d',
    });
    expect(clubProps.current!.boardDigest).toBe(boardDigestOf(daily));
    // The contract takes the daily's params as they are: a refusal would drop it silently.
    expect(PIPE_LINK_CHALLENGE.validateParams(clubProps.current!.params)).toEqual({
      difficulty: 'medium',
    });
  });

  it('sends a free board to its difficulty’s ranking: no date, no digest', () => {
    renderSolved(createDifficultySession('hard', 'pipe-link-hard-golden'));
    expect(clubProps.current).toMatchObject({
      gameId: 'pipe-link',
      outcome: 'completed',
      seed: 'pipe-link-hard-golden',
      params: { difficulty: 'hard' },
      daily: null,
      boardDigest: null,
    });
    expect(PIPE_LINK_CHALLENGE.validateParams(clubProps.current!.params)).toEqual({
      difficulty: 'hard',
    });
  });

  it('sends the card’s two figures, the same as the share’s strings', () => {
    renderSolved(createDifficultySession('easy', 'pipe-link-easy-golden'));
    expect(clubProps.current!.facts).toEqual({ elapsedSeconds: 75, hints: 2 });
    expect(clubProps.current!.details).toEqual([
      { label: 'Board', value: '5×5' },
      { label: 'Time', value: '1:15' },
      { label: 'Hints used', value: '2' },
    ]);
    expect(PIPE_LINK_CHALLENGE.validateFacts(clubProps.current!.facts)).toEqual({
      elapsedSeconds: 75,
      hints: 2,
    });
  });
});
