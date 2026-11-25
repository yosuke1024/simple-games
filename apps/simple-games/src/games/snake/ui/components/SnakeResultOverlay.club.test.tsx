/**
 * What the result card hands the Club House (docs/SNAKE_RULES.md §18): the
 * score, in the table of the run's speed, built from the same field as the
 * share's details. Every ending — a crash into the wall or the body, or the
 * full board — is a finished run there (`completed`), while the share keeps
 * its own split (a full board `completed`, a crash `played`). No seed, no
 * date, no digest: the table does not line boards up (club.md §16).
 */
// Rendered without the game's Root, so the catalog the Root registers is registered here.
import '../../i18n';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { SNAKE_CHALLENGE } from '../../challenge/contract';
import { MAX_SCORE } from '../../game';
import type { LastResult } from '../../state/GameContext';
import { SnakeResultOverlay } from './SnakeResultOverlay';

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

function renderEnded(result: LastResult) {
  clubProps.current = null;
  shareProps.current = null;
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <SnakeResultOverlay result={result} onRetry={vi.fn()} onNewBoard={vi.fn()} onHome={vi.fn()} />
    </SettingsProvider>,
  );
}

const crash = (overrides: Partial<LastResult> = {}): LastResult => ({
  outcome: 'over',
  crash: 'wall',
  score: 42,
  length: 45,
  speed: 'fast',
  bestScore: 50,
  previousBestScore: 50,
  isNewBestScore: false,
  ...overrides,
});

afterEach(cleanup);

describe('SnakeResultOverlay → Club', () => {
  it('sends a wall crash as completed, with the score in its speed’s table', () => {
    renderEnded(crash());
    expect(clubProps.current).toMatchObject({
      gameId: 'snake',
      outcome: 'completed',
      facts: { score: 42 },
      seed: '',
      params: { speed: 'fast' },
      boardDigest: null,
    });
    expect(clubProps.current!.daily ?? null).toBeNull();
    // The share keeps its own word for a crash.
    expect(shareProps.current).toMatchObject({ gameId: 'snake', outcome: 'played' });
  });

  it('sends a crash into the body as completed too', () => {
    renderEnded(crash({ crash: 'self', score: 7, length: 10, speed: 'slow' }));
    expect(clubProps.current).toMatchObject({
      outcome: 'completed',
      facts: { score: 7 },
      params: { speed: 'slow' },
    });
  });

  it('sends a full board as completed, at the top of the contract’s range', () => {
    renderEnded(
      crash({ outcome: 'cleared', crash: null, score: MAX_SCORE, length: 196, speed: 'normal' }),
    );
    expect(clubProps.current).toMatchObject({
      outcome: 'completed',
      facts: { score: MAX_SCORE },
      params: { speed: 'normal' },
    });
    expect(shareProps.current).toMatchObject({ outcome: 'completed' });
  });

  it('builds the facts from the same field as the share’s details, and leaves the length out', () => {
    renderEnded(crash({ score: 0, length: 3 }));
    const details = clubProps.current!.details as { value: string }[];
    expect(details).toBe(shareProps.current!.details);
    expect(details[0]!.value).toBe('0');
    expect(clubProps.current!.facts).toEqual({ score: 0 });
  });

  it('hands over what the contract accepts as it is', () => {
    for (const speed of ['slow', 'normal', 'fast'] as const) {
      renderEnded(crash({ speed, score: 12 }));
      expect(SNAKE_CHALLENGE.validateParams(clubProps.current!.params)).toEqual({ speed });
      expect(SNAKE_CHALLENGE.validateFacts(clubProps.current!.facts)).toEqual({ score: 12 });
      expect(SNAKE_CHALLENGE.paramsKey({ speed })).toBe(speed);
      cleanup();
    }
  });
});
