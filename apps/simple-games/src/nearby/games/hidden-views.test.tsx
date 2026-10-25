import { act as reactAct, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { dealHand } from '../../games/gin-rummy/game/engine';
import { GinRummyRoot } from '../../games/gin-rummy/ui/GinRummyRoot';
import { DominoesRoot } from '../../games/dominoes/ui/DominoesRoot';
import { applyMove, captureOptions, dealDeal, legalMoves } from '../../games/scopa/game/engine';
import { ScopaRoot } from '../../games/scopa/ui/ScopaRoot';
import { adapter as gin, type GinFull, type GinView } from './gin-rummy';
import { type DominoesView as DominoesState } from './dominoes';
import { adapter as scopa, type ScopaFull } from './scopa';
import GinRummyView from './gin-rummyView';
import DominoesView from './dominoesView';
import ScopaView from './scopaView';

const names = ['Host', 'Pixel'] as const;
function Settings({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider
      initialSettings={{ ...settingsSchema.defaultValue(), language: 'en', reducedMotion: true }}
    >
      {children}
    </SettingsProvider>
  );
}
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('shared hidden-information game UI', () => {
  it('the guest sees its own Gin cards and uses the same two-tap discard', () => {
    let full: GinFull = {
      hand: dealHand('guest-ui', 1, 0),
      handNumber: 1,
      scores: [0, 0],
      outcome: null,
    };
    full = gin.apply(full, 1, { kind: 'take-upcard' }, Math.random) as GinFull;
    const view = gin.project(full, 1) as GinView;
    const act = vi.fn();
    const match = { gameId: 'gin-rummy' as const, round: 1, revision: 1, state: view };
    const mounted = render(<GinRummyView match={match} seat={1} names={names} canAct act={act} />, {
      wrapper: Settings,
    });
    const buttons = [...mounted.container.querySelectorAll<HTMLButtonElement>('.gr-hand-card')];
    expect(buttons.map((b) => Number(b.dataset.card)).sort((a, b) => a - b)).toEqual(
      [...view.cards].sort((a, b) => a - b),
    );
    expect(mounted.container.querySelectorAll('.gr-seat-card')).toHaveLength(view.opponentCount);
    const card = view.discardable[0]!;
    const button = mounted.container.querySelector<HTMLButtonElement>(
      `.gr-hand-card[data-card="${card}"]`,
    )!;
    fireEvent.click(button);
    expect(act).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(act).toHaveBeenCalledWith({ kind: 'discard', card });
    mounted.rerender(
      <GinRummyView match={match} seat={1} names={names} canAct={false} act={act} />,
    );
    expect(
      [...mounted.container.querySelectorAll<HTMLButtonElement>('.gr-hand-card')].every(
        (b) => b.disabled,
      ),
    ).toBe(true);
    expect(mounted.container.textContent).not.toContain('CPU');
    expect(
      [...mounted.container.querySelectorAll('[aria-label]')].some((el) =>
        el.getAttribute('aria-label')!.includes('CPU'),
      ),
    ).toBe(false);
    act.mockClear();
    mounted.rerender(
      <GinRummyView match={{ ...match, round: 2 }} seat={1} names={names} canAct act={act} />,
    );
    fireEvent.click(button);
    expect(act).not.toHaveBeenCalled();
  });

  it('Dominoes keeps the existing tile and end-choice controls for the guest', () => {
    const view: DominoesState = {
      seat: 1,
      turn: 1,
      hand: [
        [1, 2],
        [0, 0],
        [0, 1],
        [0, 2],
        [0, 3],
      ],
      opponentCount: 7,
      stockCount: 14,
      line: [
        { tile: [1, 3], left: 1, right: 3 },
        { tile: [2, 3], left: 3, right: 2 },
      ],
      passes: 0,
      ending: null,
      winner: null,
      score: 0,
      pips: null,
    };
    const act = vi.fn();
    const mounted = render(
      <DominoesView
        match={{ gameId: 'dominoes', round: 1, revision: 0, state: view }}
        seat={1}
        names={names}
        canAct
        act={act}
      />,
      { wrapper: Settings },
    );
    const tile = mounted.container.querySelector<HTMLButtonElement>('.dm-hand-tile')!;
    fireEvent.click(tile);
    expect(act).not.toHaveBeenCalled();
    const ends = mounted.container.querySelectorAll<HTMLButtonElement>('.dm-line button');
    expect(ends).toHaveLength(2);
    fireEvent.click(ends[1]!);
    expect(act).toHaveBeenCalledWith({ kind: 'play', tile: [1, 2], end: 'right' });
    expect(screen.getByRole('button', { name: 'Draw' })).toBeDisabled();
    expect(mounted.container.textContent).not.toContain('CPU');
  });

  it('Scopa guest uses the same lift/take gesture and its own primiera/score orientation', () => {
    let full: ScopaFull | null = null;
    let card = -1;
    for (let n = 0; n < 100; n++) {
      const deal = dealDeal(`scopa-ui-${n}`, 1, 0);
      const one = deal.hands[1].find((c) => captureOptions(deal.table, c).length === 1);
      if (one !== undefined) {
        full = { deal, dealNumber: 1, scores: [3, 7], outcome: null };
        card = one;
        break;
      }
    }
    expect(full).not.toBeNull();
    const act = vi.fn();
    const mounted = render(
      <ScopaView
        match={{ gameId: 'scopa', round: 1, revision: 0, state: scopa.project(full, 1) }}
        seat={1}
        names={names}
        canAct
        act={act}
      />,
      { wrapper: Settings },
    );
    const rows = mounted.container.querySelectorAll('.sc-band-row');
    expect(rows[0]!.textContent).toContain('Host');
    expect(rows[1]!.textContent).toContain('Pixel');
    const button = mounted.container.querySelector<HTMLButtonElement>(
      `.sc-hand-card[data-card="${card}"]`,
    )!;
    fireEvent.click(button);
    expect(act).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(act).toHaveBeenCalledWith({
      kind: 'play',
      card,
      captured: captureOptions(full!.deal.table, card)[0],
    });
    expect(mounted.container.textContent).not.toContain('CPU');
  });

  it('Scopa refill pauses on hidden/interrupted canAct=false, resumes once and cleans up', () => {
    vi.useFakeTimers();
    let deal = dealDeal('refill-ui', 1, 0);
    for (let i = 0; i < 6; i++) deal = applyMove(deal, legalMoves(deal)[0]!)!;
    const full: ScopaFull = { deal, dealNumber: 1, scores: [0, 0], outcome: null };
    const match = {
      gameId: 'scopa' as const,
      round: 1,
      revision: 6,
      state: scopa.project(full, 0),
    };
    const act = vi.fn();
    const mounted = render(<ScopaView match={match} seat={0} names={names} canAct act={act} />, {
      wrapper: Settings,
    });
    reactAct(() => vi.advanceTimersByTime(200));
    mounted.rerender(<ScopaView match={match} seat={0} names={names} canAct={false} act={act} />);
    reactAct(() => vi.advanceTimersByTime(1000));
    expect(act).not.toHaveBeenCalled();
    mounted.rerender(<ScopaView match={match} seat={0} names={names} canAct act={act} />);
    reactAct(() => vi.advanceTimersByTime(450));
    expect(act).toHaveBeenCalledExactlyOnceWith({ kind: 'refill' });
    mounted.unmount();
    reactAct(() => vi.advanceTimersByTime(1000));
    expect(act).toHaveBeenCalledTimes(1);
  });

  it.each([
    { Root: GinRummyRoot, flags: 'gr.flags' },
    { Root: DominoesRoot, flags: 'dm.flags' },
    { Root: ScopaRoot, flags: 'sc.flags' },
  ])(
    'offers the shell callback from the $flags home without starting a solo game',
    async ({ Root, flags }) => {
      const open = vi.fn();
      const kv = createMemoryKV({
        [flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
      });
      render(<Root onExit={vi.fn()} kv={kv} onPlayTogether={open} />, { wrapper: Settings });
      const button = await screen.findByRole('button', { name: /Play with someone/ });
      fireEvent.click(button);
      expect(open).toHaveBeenCalledOnce();
      expect(button).toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Your hand' })).not.toBeInTheDocument();
    },
  );
});
