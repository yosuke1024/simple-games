/**
 * Golden deals and matches — the v1 contract for Scopa's deal, its opponent
 * and its saved-game format (docs/SCOPA_RULES.md §2.1, §4.1, §9.1; ③ of §15.2).
 *
 * These strings pin the whole chain at once: the PRNG, the exact shape of the
 * seed strings, the shuffle of forty cards, the reshuffle for three kings, who
 * deals first, what the CPU's weights and its risk (§4.1) make it play, how a
 * deal settles, and the bytes a suspended match is written as.
 *
 * If this test fails, the thing to fix is the implementation, not the
 * expectation. Regenerating these strings changes what a saved match resumes
 * into — a different deal, a different opponent — and silently rewrites games
 * players have already played. Doing it anyway is a decision to make
 * deliberately, to state in the commit message, and to write into the rules
 * document in the same commit.
 *
 * The scripted player is a fixed input sequence without a hand-written move
 * list: it takes the same view the CPU does from its own seat (or picks
 * uniformly from a seeded stream), so the match is fixed by the seed alone and
 * cannot stop being legal for any reason other than the rules changing.
 */
import { describe, expect, it } from 'vitest';
import { FULL_DECK, primieraValueOf, SEVEN_OF_DIAMONDS, valueOf, type Card } from './cards';
import {
  buildCpuView,
  chooseCpuMove,
  GAIN_SCALE,
  priceMoves,
  WEIGHT_ACE,
  WEIGHT_CARD,
  WEIGHT_DIAMOND,
  WEIGHT_SCOPA,
  WEIGHT_SETTEBELLO,
  WEIGHT_SEVEN,
  WEIGHT_SIX,
} from './cpu';
import { dealDeal, dealOrder, firstDealerOf } from './engine';
import { createRng } from './rng';
import { encodeDeal, toSavedMatch } from './serialize';
import {
  applyBeat,
  beatOwed,
  canDealNextDeal,
  createSession,
  doNextDeal,
  doPlay,
  type ScopaSession,
} from './session';
import { randomPairs } from './test-helpers';
import {
  CATEGORY_POINTS,
  CPU,
  HAND_SIZE,
  MATCH_TARGET,
  MAX_DEAL_POINTS,
  MAX_REDEALS,
  MAX_SCOPAS_PER_DEAL,
  PLAYS_PER_DEAL,
  REDEAL_KINGS,
  ROUNDS_PER_DEAL,
  TABLE_START,
  YOU,
} from './types';

const SEED = 'scopa-golden';
const code = (card: Card): string => card.toString(36).padStart(2, '0');

type Player = 'cpu' | 'random';

function step(session: ScopaSession, player: Player): ScopaSession {
  const beat = beatOwed(session);
  if (beat !== null) return applyBeat(session, beat)!.session;
  if (canDealNextDeal(session)) return doNextDeal(session)!;
  const move =
    player === 'cpu'
      ? chooseCpuMove(
          buildCpuView(session.deal, YOU, session.scores),
          createRng(`${session.seed}:you:${session.moveCount}`)(),
        )!
      : randomPairs({
          deal: session.deal,
          seat: YOU,
          scores: session.scores,
          seed: session.seed,
          moveCount: session.moveCount,
        });
  return doPlay(session, move)!.session;
}

interface Trace {
  readonly status: string;
  readonly scores: readonly number[];
  readonly dealNumber: number;
  readonly moveCount: number;
  /** Each deal's points, `you:cpu`. */
  readonly deals: string;
  /** The first deal's whole history, as the save format writes it. */
  readonly firstDeal: string;
  /** The save record after the fiftieth card. */
  readonly saved: string;
}

function playMatch(player: Player): Trace {
  let session = createSession(SEED);
  const deals: string[] = [];
  let firstDeal = '';
  let saved = '';
  for (let guard = 0; guard < 10_000 && session.status === 'playing'; guard++) {
    const before = session;
    session = step(session, player);
    if (session.lastDeal !== null && before.lastDeal === null) {
      deals.push(session.lastDeal.points.join(':'));
      if (session.dealNumber === 1) firstDeal = encodeDeal(session.deal);
    }
    if (session.moveCount === 50 && saved === '') {
      saved = JSON.stringify(toSavedMatch(session, 1_760_000_000_000));
    }
  }
  return {
    status: session.status,
    scores: session.scores,
    dealNumber: session.dealNumber,
    moveCount: session.moveCount,
    deals: deals.join(' '),
    firstDeal,
    saved,
  };
}

describe('deals that must never change (v1)', () => {
  it('picks the same first dealer for a seed', () => {
    expect(firstDealerOf(SEED)).toBe(YOU);
    expect(firstDealerOf('scopa-golden-b')).toBe(CPU);
    expect(firstDealerOf('scopa-golden-c')).toBe(YOU);
  });

  it('pins the first two deals of a fixed seed', () => {
    const first = dealOrder(SEED, 1);
    expect(first.redeals).toBe(0);
    expect(first.order.map(code).join('')).toBe(
      '0n13120j0e0v0b0y0z0u0l060s050k0i0h0w0c0a080q0x0o0m0f09070p0d0400030r01100g110t02',
    );
    const second = dealOrder(SEED, 2);
    expect(second.redeals).toBe(0);
    expect(second.order.map(code).join('')).toBe(
      '050b0y0m120w000j0e0d070p0k0s040u0g110f0q0h100v0l0a020x0i03010o090t0613080z0n0c0r',
    );
    const deal = dealDeal(SEED, 1, YOU);
    expect(deal.table).toEqual([11, 34, 35, 30]);
    expect(deal.hands).toEqual([
      [19, 31, 39],
      [14, 23, 38],
    ]);
  });

  it('pins the first seed of a scan that needs a reshuffle, and its second shuffle', () => {
    // Bounded, as engine.test's scan is: a regression that never reshuffles fails, not hangs.
    let at = 0;
    for (; at < 20_000; at++) if (dealOrder(`scopa-redeal-${at}`, 1).redeals > 0) break;
    expect(at).toBe(668);
    const { order, redeals } = dealOrder('scopa-redeal-668', 1);
    expect(redeals).toBe(1);
    expect(order.map(code).join('')).toBe(
      '0u0s000t11040y0i0l0w020n030k0g0a0813120h0d10050p0r010v090c0f0m07060j0e0z0x0o0q0b',
    );
  });
});

describe('the opponent that must never change (v1)', () => {
  it('prices the opening of the golden deal the same way', () => {
    // The CPU does not deal, so it opens. Table 2♥ 5♣ 6♣ A♣; hand 5♥ 4♦ Q♣.
    // 5♥ must take 5♣ (the same value first), 4♦ can only be placed, Q♣ (9)
    // takes 2♥ + A♣ + 6♣. Every price is the §4.1 arithmetic, the risk's
    // suitless supposed card included.
    const view = buildCpuView(dealDeal(SEED, 1, YOU), CPU, [0, 0]);
    expect(priceMoves(view)).toEqual([
      { move: { card: 14, captured: [34] }, gain: 2, risk: 47, price: -27 },
      { move: { card: 23, captured: [] }, gain: 0, risk: 51, price: -51 },
      { move: { card: 38, captured: [11, 30, 35] }, gain: 7, risk: 12, price: 58 },
    ]);
    expect(chooseCpuMove(view, 0.5)).toEqual({ card: 38, captured: [11, 30, 35] });
  });
});

describe('matches that must never change (v1)', () => {
  it('plays the same match against the scripted CPU-like player', () => {
    expect(playMatch('cpu')).toEqual({
      status: 'lost',
      scores: [8, 11],
      dealNumber: 4,
      moveCount: 144,
      deals: '4:1 0:4 2:4 2:2',
      firstDeal:
        '1/6/120b0u0z.0j.0e0y.130j.0n.0v.0l0v.0i.0s0i.06.0k.05.0h060k.0w.08050w.0a.0c.0q0c0n.09.07.' +
        '0x.0o0a0x.0m.0f.0p0f.0r07.04.0d.030d.00.0t09.11040m.01.020001.0g.100g',
      saved:
        '{"schemaVersion":1,"seed":"scopa-golden","dealNumber":2,"dealer":1,"scores":[4,1],' +
        '"moveCount":50,"elapsedSeconds":0,' +
        '"deal":"1/3/05000e.0b.12.0w.0y0b0w.0m.07.0s12.04.0u.0k0u.0p.0g0d0m.1107","savedAt":1760000000000}',
    });
  });

  it('plays the same match against the seeded random player', () => {
    expect(playMatch('random')).toEqual({
      status: 'lost',
      scores: [3, 12],
      dealNumber: 4,
      moveCount: 144,
      deals: '1:3 0:3 2:2 0:4',
      firstDeal:
        '1/6/120b0u0z.0j.0e0y.0v.0n.130j.0l0v.06.0s.0i0s.0k.05.0h060k.0a.08.0q050a.0c.0w0c.0x0n.0o.09.07.' +
        '0m.0f.0p0f.0r07.040o.0d.030d.00.0t09.10.0g10.020m.01.11',
      saved:
        '{"schemaVersion":1,"seed":"scopa-golden","dealNumber":2,"dealer":1,"scores":[1,3],' +
        '"moveCount":50,"elapsedSeconds":0,' +
        '"deal":"1/3/120d0e.0w.0y.0m0w.05000y.0b.07.0s.0k.0u0k.04.0p.0f0p.0q040b","savedAt":1760000000000}',
    });
  });

  it('replays a match identically when it is played twice', () => {
    expect(playMatch('cpu')).toEqual(playMatch('cpu'));
  });
});

describe('the numbers the rules are made of (v1)', () => {
  /** Move any of these and every trace above changes with it. */
  it('keeps the table it promises', () => {
    expect(FULL_DECK).toHaveLength(40);
    expect(SEVEN_OF_DIAMONDS).toBe(26);
    expect(FULL_DECK.slice(0, 10).map(valueOf)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(FULL_DECK.slice(0, 10).map(primieraValueOf)).toEqual([
      16, 12, 13, 14, 15, 18, 21, 10, 10, 10,
    ]);
    expect(HAND_SIZE).toBe(3);
    expect(TABLE_START).toBe(4);
    expect(ROUNDS_PER_DEAL).toBe(6);
    expect(PLAYS_PER_DEAL).toBe(36);
    expect(REDEAL_KINGS).toBe(3);
    expect(MAX_REDEALS).toBe(8);
    expect(MATCH_TARGET).toBe(11);
    expect([CATEGORY_POINTS, MAX_SCOPAS_PER_DEAL, MAX_DEAL_POINTS]).toEqual([4, 18, 22]);
  });

  it('keeps the CPU’s weights (§4.1)', () => {
    expect([
      WEIGHT_CARD,
      WEIGHT_DIAMOND,
      WEIGHT_SEVEN,
      WEIGHT_SIX,
      WEIGHT_ACE,
      WEIGHT_SETTEBELLO,
      WEIGHT_SCOPA,
      GAIN_SCALE,
    ]).toEqual([1, 2, 3, 2, 1, 10, 10, 10]);
  });
});

describe('the saved-game format (v1)', () => {
  it('writes a deal as version, rounds and plays, each play the card and what it took', () => {
    const session = createSession(SEED);
    expect(encodeDeal(session.deal)).toBe('1/1/');
    const after = step(step(session, 'cpu'), 'cpu');
    // The CPU opened with Q♣ (38 = `12`) taking 2♥ A♣ 6♣ (11, 30, 35 =
    // `0b0u0z`), and the player answered.
    expect(encodeDeal(after.deal).startsWith('1/1/120b0u0z.')).toBe(true);
  });
});
