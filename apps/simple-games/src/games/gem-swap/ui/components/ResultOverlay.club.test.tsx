/**
 * What the end of a round hands the Club House (docs/GEM_SWAP_RULES.md §16):
 * the score from the same field the card and the share read, the gem count as
 * the table, the round's seed, and no daily or board digest — Gem Swap has no
 * daily, so every result goes to its gem count's ranking. A round that ended
 * by 30 swaps or stuck is `completed`; a round the cascade cap stopped is
 * `played`, which the Club sends nowhere (§5).
 */
// Rendered without the game's Root, so the catalog the Root registers is registered here.
import '../../i18n';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { ROUND_SWAPS, trySwap } from '../../game';
import type { LastResult } from '../../state/GameContext';
import { GS_STORAGE_KEYS } from '../../storage/schemas';
import { GemSwapRoot } from '../GemSwapRoot';
import { cell, firstValid, recordOf, roundAfter } from '../test-helpers';
import { GemSwapResultOverlay } from './ResultOverlay';

const clubProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('@/ui/components/ClubResultAction', () => ({
  ClubResultAction: (props: Record<string, unknown>) => {
    clubProps.current = props;
    return null;
  },
}));

const { deviceStore } = vi.hoisted(() => ({ deviceStore: new Map<string, string>() }));
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: ({ key }: { key: string }) => Promise.resolve({ value: deviceStore.get(key) ?? null }),
    set: ({ key, value }: { key: string; value: string }) => {
      deviceStore.set(key, value);
      return Promise.resolve();
    },
    remove: ({ key }: { key: string }) => {
      deviceStore.delete(key);
      return Promise.resolve();
    },
  },
}));

const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });

afterEach(async () => {
  cleanup();
  await settle();
  deviceStore.clear();
  clubProps.current = null;
});

const result = (overrides: Partial<LastResult> = {}): LastResult => ({
  score: 211,
  colors: 6,
  seed: 'gem-swap-test-seed',
  endReason: 'swaps',
  counted: true,
  best: 211,
  previousBest: 180,
  isNewBest: true,
  ...overrides,
});

function renderCard(lastResult: LastResult) {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <GemSwapResultOverlay
        result={lastResult}
        onNewBoard={vi.fn()}
        onRetry={vi.fn()}
        onHome={vi.fn()}
      />
    </SettingsProvider>,
  );
}

describe('GemSwapResultOverlay → Club', () => {
  it('sends a round of 30 swaps to its gem count’s ranking, as completed', () => {
    renderCard(result());
    expect(clubProps.current).toMatchObject({
      gameId: 'gem-swap',
      outcome: 'completed',
      facts: { score: 211 },
      seed: 'gem-swap-test-seed',
      params: { colors: 6 },
      boardDigest: null,
    });
    // No daily: Gem Swap has none, so nothing goes to Today.
    expect(clubProps.current?.daily).toBeUndefined();
  });

  it('the facts repeat the card: the same score the share’s details carry', () => {
    renderCard(result({ score: 97, colors: 5 }));
    const details = clubProps.current?.details as { label: string; value: string }[];
    expect(details.find((detail) => detail.label === 'Score')?.value).toBe('97');
    expect(clubProps.current).toMatchObject({ facts: { score: 97 }, params: { colors: 5 } });
  });

  it('sends a stuck round too — it counts toward the best', () => {
    renderCard(result({ endReason: 'stuck', score: 40 }));
    expect(clubProps.current).toMatchObject({ outcome: 'completed', facts: { score: 40 } });
  });

  it('marks a round the cascade cap stopped as played, which goes nowhere', () => {
    renderCard(result({ endReason: 'cap', counted: false, isNewBest: false }));
    expect(clubProps.current).toMatchObject({ outcome: 'played' });
  });

  it('is handed the round’s own seed when a round ends on screen', async () => {
    const round = roundAfter(ROUND_SWAPS - 1);
    deviceStore.set(
      GS_STORAGE_KEYS.flags,
      JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
    );
    deviceStore.set(GS_STORAGE_KEYS.game, JSON.stringify(recordOf(round)));
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <GemSwapRoot onExit={vi.fn()} entry="shortcut" />
      </SettingsProvider>,
    );
    await settle();
    const [a, b] = firstValid(round);
    fireEvent.click(cell(a), { detail: 1 });
    fireEvent.click(cell(b), { detail: 1 });
    const final = trySwap(round, a, b)!.round;
    expect(final.endReason).toBe('swaps');
    expect(clubProps.current).toMatchObject({
      gameId: 'gem-swap',
      outcome: 'completed',
      facts: { score: final.score },
      seed: round.seed,
      params: { colors: round.colors },
      boardDigest: null,
    });
  });
});
