/**
 * One match through the session's beats, and every transition it must refuse
 * (docs/SCOPA_RULES.md §2–§4.2; ② of §15.2). A refused transition returns null
 * and leaves the session it was handed exactly as it was.
 */
import { describe, expect, it } from 'vitest';
import { buildCpuView, chooseCpuMove } from './cpu';
import { firstDealerOf, legalMoves, phaseOf } from './engine';
import { createRng } from './rng';
import {
  applyBeat,
  applyCpuStep,
  beatOwed,
  canDealNextDeal,
  canRefill,
  createSession,
  dealerOf,
  doNextDeal,
  doPlay,
  doRefill,
  isCpuTurn,
  isPlayersTurn,
  matchSeed,
  newSeedToken,
  playerMoves,
  restoreSession,
  type ScopaSession,
} from './session';
import { cpuStrategy, playMatch, seats } from './test-helpers';
import { CPU, MATCH_TARGET, PLAYS_PER_DEAL, YOU } from './types';

/** The player's side, played by the same evaluation as the CPU with its own coin. */
function playerMove(session: ScopaSession) {
  const view = buildCpuView(session.deal, YOU, session.scores);
  const tie = createRng(`${session.seed}:you:${session.moveCount}`)();
  return chooseCpuMove(view, tie)!;
}

/** One step of the screen's loop: a beat if one is owed, else the player's tap. */
function step(session: ScopaSession): ScopaSession {
  const beat = beatOwed(session);
  if (beat !== null) return applyBeat(session, beat)!.session;
  if (canDealNextDeal(session)) return doNextDeal(session)!;
  return doPlay(session, playerMove(session))!.session;
}

/** Steps until `until` holds (or the match ends), returning that session. */
function stepUntil(session: ScopaSession, until: (s: ScopaSession) => boolean): ScopaSession {
  let current = session;
  for (let guard = 0; guard < 5_000 && !until(current); guard++) {
    if (current.status !== 'playing') break;
    current = step(current);
  }
  return current;
}

describe('a new match', () => {
  it('starts on deal 1 at nothing all, dealt by the seed’s coin', () => {
    const session = createSession('scopa-new');
    expect(session.dealNumber).toBe(1);
    expect(session.scores).toEqual([0, 0]);
    expect(session.status).toBe('playing');
    expect(session.moveCount).toBe(0);
    expect(session.lastDeal).toBeNull();
    expect(session.deal.dealer).toBe(firstDealerOf('scopa-new'));
    expect(isPlayersTurn(session)).toBe(session.deal.dealer === CPU);
    expect(isCpuTurn(session)).toBe(session.deal.dealer === YOU);
  });

  it('seeds itself per match', () => {
    expect(matchSeed('abc')).toBe('scopa-abc');
    expect(newSeedToken(36 ** 3, () => 0)).toBe('1000-0');
    expect(createSession().seed).toMatch(/^scopa-/);
  });
});

describe('the beats, in their one order (§4.2)', () => {
  it('runs a whole match: plays, refills, settlements waiting for a tap, the dealer turning', () => {
    let session = createSession('scopa-flow');
    const dealers: number[] = [session.deal.dealer];
    let refills = 0;
    let settlements = 0;
    let lastMoveCount = 0;
    for (let guard = 0; guard < 5_000 && session.status === 'playing'; guard++) {
      const phase = phaseOf(session.deal);
      const beat = beatOwed(session);
      if (phase === 'over') {
        // Settled: nothing owed — the next deal is the player's tap, never a timer.
        expect(beat).toBeNull();
        expect(canDealNextDeal(session)).toBe(true);
        expect(session.lastDeal).not.toBeNull();
        expect(session.moveCount).toBe(PLAYS_PER_DEAL * session.dealNumber);
        settlements += 1;
        const next = doNextDeal(session)!;
        expect(next.moveCount).toBe(session.moveCount);
        expect(next.dealNumber).toBe(session.dealNumber + 1);
        expect(next.deal.dealer).toBe(dealerOf(session.seed, next.dealNumber));
        expect(next.deal.dealer).not.toBe(session.deal.dealer);
        expect(next.lastDeal).toBeNull();
        dealers.push(next.deal.dealer);
        session = next;
        continue;
      }
      if (phase === 'refill') {
        // A refill comes before any CPU card and is a beat of its own.
        expect(beat).toBe('refill');
        expect(isCpuTurn(session)).toBe(false);
        expect(playerMoves(session)).toEqual([]);
        const out = applyBeat(session, 'refill')!;
        expect(out.event).toEqual({ kind: 'refill' });
        expect(out.session.moveCount).toBe(session.moveCount);
        refills += 1;
        session = out.session;
        continue;
      }
      if (isCpuTurn(session)) {
        expect(beat).toBe('cpu');
        const out = applyBeat(session, 'cpu')!;
        expect(out.event.kind === 'play' && out.event.seat).toBe(CPU);
        session = out.session;
      } else {
        expect(beat).toBeNull();
        const out = doPlay(session, playerMove(session))!;
        expect(out.event.kind === 'play' && out.event.seat).toBe(YOU);
        session = out.session;
      }
      expect(session.moveCount).toBe(lastMoveCount + 1);
      lastMoveCount = session.moveCount;
    }
    expect(['won', 'lost']).toContain(session.status);
    const [you, cpu] = session.scores;
    expect(Math.max(you, cpu)).toBeGreaterThanOrEqual(MATCH_TARGET);
    expect(you).not.toBe(cpu);
    expect(session.status).toBe(you > cpu ? 'won' : 'lost');
    // The deciding deal settles too; it is the last one.
    expect(session.lastDeal).not.toBeNull();
    expect(settlements).toBe(session.dealNumber - 1);
    expect(refills).toBe(5 * session.dealNumber);
    expect(session.moveCount).toBe(PLAYS_PER_DEAL * session.dealNumber);
    dealers.forEach((dealer, at) => expect(dealer).toBe(dealerOf('scopa-flow', at + 1)));
  });

  it('plays the same match as the engine-level driver', () => {
    for (let i = 0; i < 5; i++) {
      const seed = `scopa-same-${i}`;
      const finished = stepUntil(createSession(seed), () => false);
      const driven = playMatch(seed, seats(cpuStrategy, cpuStrategy));
      expect(finished.scores).toEqual(driven.scores);
      expect(finished.status).toBe(driven.status);
      expect(finished.dealNumber).toBe(driven.deals.length);
    }
  });

  it('announces what a card did: the taken cards and a scopa', () => {
    let seen = false;
    let session = createSession('scopa-events');
    for (let guard = 0; guard < 5_000 && session.status === 'playing' && !seen; guard++) {
      if (isCpuTurn(session)) {
        const tableBefore = session.deal.table;
        const out = applyCpuStep(session)!;
        if (out.event.kind === 'play' && out.event.scopa) {
          expect(out.event.captured).toEqual([...tableBefore].sort((a, b) => a - b));
          expect(out.session.deal.scopas[CPU]).toBe(session.deal.scopas[CPU] + 1);
          seen = true;
        }
        session = out.session;
      } else session = step(session);
    }
    expect(seen).toBe(true);
  });
});

describe('transitions it refuses', () => {
  const start = createSession('scopa-refuse');
  const playersTurn = stepUntil(start, isPlayersTurn);
  const cpusTurn = stepUntil(start, isCpuTurn);
  const refill = stepUntil(start, canRefill);
  const settled = stepUntil(start, canDealNextDeal);
  const over = stepUntil(start, () => false);

  const untouched = (session: ScopaSession, act: (s: ScopaSession) => unknown) => {
    const before = JSON.stringify(session);
    expect(act(session)).toBeNull();
    expect(JSON.stringify(session)).toBe(before);
  };

  it('refuses the player’s card on the CPU’s turn, and the CPU’s on the player’s', () => {
    const anyCard = cpusTurn.deal.hands[CPU][0]!;
    untouched(cpusTurn, (s) => doPlay(s, { card: anyCard, captured: [] }));
    untouched(playersTurn, applyCpuStep);
    untouched(playersTurn, (s) => applyBeat(s, 'cpu'));
  });

  it('refuses a card not in hand, and a capture the rules do not allow', () => {
    const notHeld = [...Array(40).keys()].find((c) => !playersTurn.deal.hands[YOU].includes(c))!;
    untouched(playersTurn, (s) => doPlay(s, { card: notHeld, captured: [] }));
    // This position (the seed's first turn for the player) has both kinds of
    // card; were the seed or the CPU to change that, these fail rather than skip.
    const legal = legalMoves(playersTurn.deal);
    const taking = legal.find((m) => m.captured.length > 0);
    const placing = legal.find((m) => m.captured.length === 0);
    expect(taking).toBeDefined();
    expect(placing).toBeDefined();
    expect(playersTurn.deal.table.length).toBeGreaterThan(0);
    untouched(playersTurn, (s) => doPlay(s, { card: taking!.card, captured: [] }));
    untouched(playersTurn, (s) =>
      doPlay(s, { card: placing!.card, captured: [playersTurn.deal.table[0]!] }),
    );
  });

  it('refuses any card while a refill or a settlement is waiting', () => {
    expect(phaseOf(refill.deal)).toBe('refill');
    untouched(refill, (s) => doPlay(s, { card: 0, captured: [] }));
    untouched(refill, applyCpuStep);
    untouched(refill, doNextDeal);
    untouched(refill, (s) => applyBeat(s, 'cpu'));
    expect(phaseOf(settled.deal)).toBe('over');
    untouched(settled, (s) => doPlay(s, { card: 0, captured: [] }));
    untouched(settled, applyCpuStep);
    untouched(settled, doRefill);
  });

  it('refuses the next deal before the settlement, and a refill nobody owes', () => {
    untouched(playersTurn, doNextDeal);
    untouched(playersTurn, doRefill);
    untouched(cpusTurn, (s) => applyBeat(s, 'refill'));
  });

  it('stays finished once the match is decided', () => {
    expect(['won', 'lost']).toContain(over.status);
    expect(beatOwed(over)).toBeNull();
    expect(canDealNextDeal(over)).toBe(false);
    untouched(over, doNextDeal);
    untouched(over, doRefill);
    untouched(over, applyCpuStep);
    untouched(over, (s) => doPlay(s, { card: 0, captured: [] }));
    expect(playerMoves(over)).toEqual([]);
  });
});

describe('restoring', () => {
  it('recomputes the status and the settled deal rather than trusting them', () => {
    const settled = stepUntil(createSession('scopa-restore'), canDealNextDeal);
    const { status: _status, lastDeal: _lastDeal, ...data } = settled;
    const restored = restoreSession(data);
    expect(restored).toEqual(settled);
    expect(restored!.lastDeal).not.toBeNull();
    // A decided score is a match that was never saved: it does not come back.
    expect(restoreSession({ ...data, scores: [12, 3] })).toBeNull();
    expect(restoreSession({ ...data, scores: [11, 11] })!.status).toBe('playing');
  });

  it('goes on past a settled deal that left the scores level at eleven or more (§3.4)', () => {
    const settled = stepUntil(createSession('scopa-restore'), canDealNextDeal);
    const { status: _status, lastDeal: _lastDeal, ...data } = settled;
    const level = restoreSession({ ...data, scores: [12, 12] })!;
    expect(level.status).toBe('playing');
    expect(level.lastDeal).not.toBeNull();
    expect(beatOwed(level)).toBeNull();
    expect(canDealNextDeal(level)).toBe(true);
    const next = doNextDeal(level)!;
    expect(next.dealNumber).toBe(level.dealNumber + 1);
    expect(next.deal.dealer).not.toBe(level.deal.dealer);
    expect(next.deal.dealer).toBe(dealerOf(level.seed, next.dealNumber));
    expect(next.moveCount).toBe(level.moveCount);
    expect(next.scores).toEqual([12, 12]);
    expect(next.status).toBe('playing');
    expect(next.lastDeal).toBeNull();
    expect(phaseOf(next.deal)).toBe('play');
  });
});
