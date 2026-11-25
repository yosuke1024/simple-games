/**
 * What the result card hands the Club House (docs/BOUNCE_UP_RULES.md §13): the
 * score, in the table of the run's width, built from the same field as the
 * share's details. Every fall is a finished run there (`completed`), while
 * the share keeps its own word (`played`). The best is the player's own
 * record and is not sent. No seed, no date, no digest: the table does not
 * line towers up (club.md §16).
 */
// Rendered without the game's Root, so the catalog the Root registers is registered here.
import '../../i18n';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { BOUNCE_UP_CHALLENGE } from '../../challenge/contract';
import type { LastResult } from '../../state/GameContext';
import { WIDTHS } from '../../storage/schemas';
import { BounceUpResultOverlay } from './ResultOverlay';

const clubProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('@/ui/components/ClubResultAction', () => ({
  ClubResultAction: (props: Record<string, unknown>) => {
    clubProps.current = props;
    return null;
  },
}));

const shareProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('@/ui/components/ShareAction', () => ({
  ShareAction: (props: Record<string, unknown>) => {
    shareProps.current = props;
    return null;
  },
}));

function renderEnded(result: LastResult | null) {
  clubProps.current = null;
  shareProps.current = null;
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <BounceUpResultOverlay result={result} onRetry={vi.fn()} onHome={vi.fn()} />
    </SettingsProvider>,
  );
}

const fall = (overrides: Partial<LastResult> = {}): LastResult => ({
  width: 'normal',
  score: 412,
  best: 950,
  previousBest: 950,
  ...overrides,
});

afterEach(cleanup);

describe('BounceUpResultOverlay → Club', () => {
  it('sends a fall as completed, with the score in its width’s table', () => {
    renderEnded(fall());
    expect(clubProps.current).toMatchObject({
      gameId: 'bounce-up',
      outcome: 'completed',
      facts: { score: 412 },
      seed: '',
      params: { width: 'normal' },
      boardDigest: null,
    });
    expect(clubProps.current!.daily ?? null).toBeNull();
    // The share keeps its own word for a run that ends in a fall.
    expect(shareProps.current).toMatchObject({ gameId: 'bounce-up', outcome: 'played' });
  });

  it('sends a Wide run to the Wide table, and a new best like any other fall', () => {
    renderEnded(fall({ width: 'wide', score: 1200, best: 1200, previousBest: 800 }));
    expect(clubProps.current).toMatchObject({
      outcome: 'completed',
      facts: { score: 1200 },
      params: { width: 'wide' },
    });
  });

  it('sends a first run (no best before it) the same way', () => {
    renderEnded(fall({ score: 15, best: 15, previousBest: null }));
    expect(clubProps.current).toMatchObject({ outcome: 'completed', facts: { score: 15 } });
  });

  it('builds the facts from the same field as the share’s details, and leaves the best out', () => {
    renderEnded(fall({ score: 0, best: 300, previousBest: 300 }));
    const details = clubProps.current!.details as { value: string }[];
    expect(details).toBe(shareProps.current!.details);
    expect(details[0]!.value).toBe('0');
    expect(clubProps.current!.facts).toEqual({ score: 0 });
  });

  it('hands over what the contract accepts as it is', () => {
    for (const width of WIDTHS) {
      renderEnded(fall({ width, score: 12 }));
      expect(BOUNCE_UP_CHALLENGE.validateParams(clubProps.current!.params)).toEqual({ width });
      expect(BOUNCE_UP_CHALLENGE.validateFacts(clubProps.current!.facts)).toEqual({ score: 12 });
      expect(BOUNCE_UP_CHALLENGE.paramsKey({ width })).toBe(width);
      cleanup();
    }
  });

  it('sends nothing while there is no card', () => {
    renderEnded(null);
    expect(clubProps.current).toBeNull();
  });
});
