/**
 * What the end card hands the Club House (docs/INVADERS_RULES.md §13): the
 * score and the stage reached, in the game's one table, built from the same
 * fields as the share's details. Both endings — all twenty stages cleared, or
 * the run lost — are a finished run there (`completed`), while the share keeps
 * its own split (a clear `completed`, a loss `played`). The card between
 * stages sends nothing. No seed, no date, no digest: the table does not line
 * boards up (club.md §16).
 */
// Rendered without the game's Root, so the catalog the Root registers is registered here.
import '../../i18n';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { INVADERS_CHALLENGE } from '../../challenge/contract';
import { createSession, MAX_SCORE, STAGE_COUNT, type Session } from '../../game';
import { ResultOverlay } from './ResultOverlay';

const clubProps = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
  renders: 0,
}));
vi.mock('@/ui/components/ClubResultAction', () => ({
  ClubResultAction: (props: Record<string, unknown>) => {
    clubProps.current = props;
    clubProps.renders += 1;
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

const session = (overrides: Partial<Session>): Session => ({
  ...createSession(),
  started: true,
  ...overrides,
});

const overlay = (s: Session) => (
  <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
    <ResultOverlay session={s} best={4200} onRetry={vi.fn()} onNext={vi.fn()} onHome={vi.fn()} />
  </SettingsProvider>
);

function renderCard(s: Session) {
  clubProps.current = null;
  clubProps.renders = 0;
  shareProps.current = null;
  return render(overlay(s));
}

afterEach(cleanup);

describe('Formation Fire ResultOverlay → Club', () => {
  it('sends a game over as completed, with the score and the stage reached', () => {
    renderCard(session({ status: 'lost', stage: 7, score: 3650, lives: 0 }));
    expect(clubProps.current).toMatchObject({
      gameId: 'invaders',
      outcome: 'completed',
      facts: { score: 3650, stage: 7 },
      seed: '',
      params: {},
      boardDigest: null,
    });
    expect(clubProps.current!.daily ?? null).toBeNull();
    // The share keeps its own word for a loss.
    expect(shareProps.current).toMatchObject({ gameId: 'invaders', outcome: 'played' });
  });

  it('sends the last stage’s clear as completed too', () => {
    renderCard(session({ status: 'won', stage: STAGE_COUNT, score: MAX_SCORE, enemies: [] }));
    expect(clubProps.current).toMatchObject({
      outcome: 'completed',
      facts: { score: MAX_SCORE, stage: STAGE_COUNT },
    });
    expect(shareProps.current).toMatchObject({ outcome: 'completed' });
  });

  it('sends nothing from the card between stages', () => {
    renderCard(session({ status: 'between', stage: 3, score: 2100, enemies: [] }));
    expect(clubProps.current).toBeNull();
    expect(shareProps.current).toBeNull();
  });

  it('mounts the action only once the run ends, through the stages between', () => {
    const view = renderCard(session({ status: 'between', stage: 19, score: 10_000, enemies: [] }));
    expect(clubProps.renders).toBe(0);
    // The next stage begins: no card at all.
    view.rerender(overlay(session({ status: 'running', stage: 20, score: 10_000 })));
    expect(clubProps.renders).toBe(0);
    // The run ends on that stage: the end card, and the action with it.
    view.rerender(overlay(session({ status: 'lost', stage: 20, score: 10_400, lives: 0 })));
    expect(clubProps.current).toMatchObject({
      outcome: 'completed',
      facts: { score: 10_400, stage: 20 },
    });
  });

  it('builds the facts from the same fields as the share’s details', () => {
    renderCard(session({ status: 'lost', stage: 1, score: 0, lives: 0 }));
    const details = clubProps.current!.details as { value: string }[];
    expect(details).toBe(shareProps.current!.details);
    expect(details.map((detail) => detail.value)).toEqual(['0', `1 / ${STAGE_COUNT}`]);
    expect(clubProps.current!.facts).toEqual({ score: 0, stage: 1 });
  });

  it('hands over what the contract accepts as it is, a resumed v1 run’s score included', () => {
    for (const s of [
      session({ status: 'lost', stage: 4, score: 1880, lives: 0 }),
      session({ status: 'won', stage: STAGE_COUNT, score: MAX_SCORE, enemies: [] }),
      // A run begun on the v1 build (twenty full blocks) is resumed as it was (RULES §7).
      session({ status: 'won', stage: STAGE_COUNT, score: 14_000, enemies: [] }),
    ]) {
      renderCard(s);
      const params = INVADERS_CHALLENGE.validateParams(clubProps.current!.params);
      expect(params).toEqual({});
      expect(INVADERS_CHALLENGE.paramsKey(params!)).toBe('standard');
      expect(INVADERS_CHALLENGE.validateFacts(clubProps.current!.facts)).toEqual({
        score: s.score,
        stage: s.stage,
      });
      cleanup();
    }
  });
});
