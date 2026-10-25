import { describe, expect, it } from 'vitest';
import { buildCpuView, chooseCpuAction } from '../../games/gin-rummy/game/cpu';
import { dealHand } from '../../games/gin-rummy/game/engine';
import { createRng } from '../../games/gin-rummy/game/rng';
import { legalEnds } from '../../games/dominoes/game/engine';
import type { DominoesSession } from '../../games/dominoes/game/match';
import { legalMoves } from '../../games/scopa/game/engine';
import type { GameAdapter, Seat } from '../gameTypes';
import { adapter as dominoes, type DominoesView } from './dominoes';
import { adapter as gin, type GinFull, type GinView } from './gin-rummy';
import { adapter as scopa, type ScopaFull, type ScopaView } from './scopa';

function checked(adapter: GameAdapter, full: unknown) {
  const a = adapter.project(full, 0);
  const b = adapter.project(full, 1);
  for (const view of [a, b]) {
    expect(adapter.isView(view), JSON.stringify(view)).toBe(true);
    expect(new TextEncoder().encode(JSON.stringify(view)).length).toBeLessThan(2300);
    expect(JSON.stringify(view)).not.toMatch(
      /"(?:seed|stock|boneyard|hands|cpuHand|playerHand|log|plays)":/,
    );
    expect(adapter.isView({ ...(view as object), seed: 'hidden' })).toBe(false);
  }
  expect(adapter.turn(a)).toBe(adapter.turn(b));
  expect(adapter.result(a)).toEqual(adapter.result(b));
  expect(adapter.finished(a)).toBe(adapter.finished(b));
  return a;
}

describe('private card and tile projections', () => {
  it('feeds host randomness directly into each shuffle instead of reducing it to a seeded CPU stream', () => {
    for (const adapter of [gin, dominoes, scopa]) {
      let draws = 0;
      const rng = createRng(`host-shuffle-${adapter.id}`);
      checked(
        adapter,
        adapter.create(() => {
          draws++;
          return rng();
        }),
      );
      expect(draws).toBeGreaterThanOrEqual(
        adapter.id === 'dominoes' ? 27 : adapter.id === 'gin-rummy' ? 52 : 40,
      );
    }
  });
  it.each([0, 1] as Seat[])('Gin hides the other hand, stock and long log for seat %s', (seat) => {
    const full = gin.create(createRng(`privacy-${seat}`)) as GinFull;
    const peer = seat === 0 ? 1 : 0;
    const other = [...full.hand.hands[peer]];
    const stock = [...full.hand.stock];
    [other[0], stock[0]] = [stock[0]!, other[0]!];
    const changed = {
      ...full,
      hand: {
        ...full.hand,
        hands: seat === 0 ? [full.hand.hands[0], other] : [other, full.hand.hands[1]],
        stock,
        log: Array(10000).fill({ kind: 'draw-stock', seat: peer }),
      },
    };
    expect(gin.project(full, seat)).toEqual(gin.project(changed, seat));
    const view = gin.project(full, seat) as GinView;
    (view.cards as number[])[0] = 999;
    expect(full.hand.hands[seat]).not.toContain(999);
  });

  it.each([0, 1] as Seat[])(
    'Dominoes and Scopa hide shuffled unknown tiles/cards for seat %s',
    (seat) => {
      const dm = dominoes.create(createRng(`domino-${seat}`)) as DominoesSession;
      const handKey = seat === 0 ? 'cpuHand' : 'playerHand';
      const other = [...dm[handKey]];
      const stock = [...dm.boneyard];
      [other[0], stock[0]] = [stock[0]!, other[0]!];
      expect(dominoes.project(dm, seat)).toEqual(
        dominoes.project(
          {
            ...dm,
            seed: 'another',
            [handKey]: other,
            boneyard: stock,
            cpuPips: 999,
            playerPips: 999,
          },
          seat,
        ),
      );
      const sc = scopa.create(createRng(`scopa-${seat}`)) as ScopaFull;
      const peer = seat === 0 ? 1 : 0;
      const unknown = [...sc.deal.hands[peer]];
      const deck = [...sc.deal.stock];
      [unknown[0], deck[0]] = [deck[0]!, unknown[0]!];
      const hands = seat === 0 ? [sc.deal.hands[0], unknown] : [unknown, sc.deal.hands[1]];
      expect(scopa.project(sc, seat)).toEqual(
        scopa.project({ ...sc, deal: { ...sc.deal, hands, stock: deck } }, seat),
      );
    },
  );

  it('fails closed on malformed/extra fields and out-of-turn input', () => {
    for (const adapter of [gin, dominoes, scopa]) {
      const full = adapter.create(createRng(adapter.id));
      const view = checked(adapter, full);
      expect(adapter.isView(null)).toBe(false);
      expect(adapter.isView({})).toBe(false);
      expect(adapter.isAction({ kind: 'next', extra: 'injected' })).toBe(false);
      expect(adapter.apply(full, 0, { kind: 'unknown' }, Math.random)).toBeNull();
      expect(adapter.apply(full, 1, { kind: 'next' }, Math.random)).toBeNull();
      const turn = adapter.turn(view);
      const other = turn === 0 ? 1 : 0;
      const action =
        adapter.id === 'gin-rummy'
          ? { kind: 'take-upcard' }
          : adapter.id === 'scopa'
            ? { kind: 'play', ...legalMoves((full as ScopaFull).deal)[0]! }
            : { kind: 'draw' };
      expect(adapter.apply(full, other, action, Math.random)).toBeNull();
    }
    expect(gin.isAction({ kind: 'discard', card: 52 })).toBe(false);
    expect(dominoes.isAction({ kind: 'play', tile: [6, 0], end: 'left' })).toBe(false);
    expect(scopa.isAction({ kind: 'play', card: 3, captured: [4, 4] })).toBe(false);
  });
});

describe('complete matches preserve their rules and bounded wire views', () => {
  it('Gin runs multiple hands to 100 and only the host can deal the next hand', () => {
    for (let trial = 0; trial < 3; trial++) {
      const rng = createRng(`gin-match-${trial}`);
      let full = gin.create(rng) as GinFull;
      let steps = 0;
      while (!gin.finished(checked(gin, full)) && steps++ < 3000) {
        const player = full.hand.phase === 'over' ? 0 : full.hand.turn;
        const action =
          full.hand.phase === 'over'
            ? { kind: 'next' }
            : chooseCpuAction(buildCpuView(full.hand, player, 'easy', full.scores), rng());
        expect(action).not.toBeNull();
        if (full.hand.phase === 'over') expect(gin.apply(full, 1, action, rng)).toBeNull();
        const next = gin.apply(full, player, action, rng) as GinFull | null;
        expect(next).not.toBeNull();
        full = next!;
        expect(full.hand.log.length).toBeLessThanOrEqual(1);
      }
      expect(steps).toBeLessThan(3000);
      expect(full.handNumber).toBeGreaterThan(1);
      expect(Math.max(...full.scores)).toBeGreaterThanOrEqual(100);
      expect(gin.apply(full, 0, { kind: 'next' }, rng)).toBeNull();
    }
  });

  it('Gin refuses immediate discard-back and publishes settlement only at hand end', () => {
    let full: GinFull = {
      hand: dealHand('gin-take', 1, 0),
      handNumber: 1,
      scores: [0, 0],
      outcome: null,
    };
    const player = full.hand.turn;
    const card = full.hand.discard.at(-1)!;
    full = gin.apply(full, player, { kind: 'take-upcard' }, Math.random) as GinFull;
    expect(gin.apply(full, player, { kind: 'discard', card }, Math.random)).toBeNull();
    expect((gin.project(full, player) as GinView).discardable).not.toContain(card);
    expect((gin.project(full, player) as GinView).outcome).toBeNull();
  });

  it('Dominoes keeps a drawing player on turn, honors both ends and completes', () => {
    let sawDraw = false;
    for (let trial = 0; trial < 25; trial++) {
      const rng = createRng(`domino-match-${trial}`);
      let full = dominoes.create(rng) as DominoesSession;
      for (let steps = 0; steps < 100; steps++) {
        const view = checked(dominoes, full) as DominoesView;
        if (dominoes.finished(view)) break;
        const player = dominoes.turn(view);
        const local = dominoes.project(full, player) as DominoesView;
        const tile = local.hand.find((tile) => legalEnds(local.line, tile).length > 0);
        const action = tile
          ? { kind: 'play', tile, end: legalEnds(local.line, tile).at(-1)! }
          : { kind: local.stockCount > 0 ? 'draw' : 'pass' };
        const next = dominoes.apply(full, player, action, rng) as DominoesSession | null;
        expect(next).not.toBeNull();
        if (action.kind === 'draw') {
          sawDraw = true;
          expect(next!.toMove).toBe(full.toMove);
        }
        full = next!;
      }
      expect(dominoes.finished(checked(dominoes, full))).toBe(true);
    }
    expect(sawDraw).toBe(true);
  });

  it('Scopa refills five times per deal, alternates dealers and continues to 11 with a lead', () => {
    for (let trial = 0; trial < 5; trial++) {
      const rng = createRng(`scopa-match-${trial}`);
      let full = scopa.create(rng) as ScopaFull;
      let steps = 0;
      let refills = 0;
      while (!scopa.finished(checked(scopa, full)) && steps++ < 1000) {
        const view = scopa.project(full, 0) as ScopaView;
        const player = view.turn;
        let action;
        if (view.phase === 'over') {
          expect(full.deal.plays).toHaveLength(36);
          expect(refills).toBe(5);
          refills = 0;
          action = { kind: 'next' };
          expect(scopa.apply(full, 1, action, rng)).toBeNull();
        } else if (view.phase === 'refill') {
          action = { kind: 'refill' };
          refills++;
          expect(scopa.apply(full, 1, action, rng)).toBeNull();
        } else {
          const moves = legalMoves(full.deal);
          action = { kind: 'play', ...moves[Math.floor(rng() * moves.length)]! };
        }
        const next = scopa.apply(full, player, action, rng) as ScopaFull | null;
        expect(next).not.toBeNull();
        if (action.kind === 'next') expect(next!.deal.dealer).not.toBe(full.deal.dealer);
        full = next!;
      }
      expect(steps).toBeLessThan(1000);
      expect(full.dealNumber).toBeGreaterThan(1);
      expect(Math.max(...full.scores)).toBeGreaterThanOrEqual(11);
      expect(full.scores[0]).not.toBe(full.scores[1]);
      expect(scopa.apply(full, 0, { kind: 'next' }, rng)).toBeNull();
    }
  });
});
