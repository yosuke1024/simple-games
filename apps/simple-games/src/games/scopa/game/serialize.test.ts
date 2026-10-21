/**
 * The saved match comes back exactly, or it does not come back
 * (docs/SCOPA_RULES.md §9.1, §9.2; ④ and ⑤ of §15.2, the game/ half).
 *
 * Round-tripping is the easy half, and it is checked on every position of many
 * whole matches — before refills, after them, and on settled deals. The half
 * that matters is the refusals: a record the rules could not have produced
 * must decode to null, so the loader goes home rather than dealing the player
 * into an invented table.
 */
import { describe, expect, it } from 'vitest';
import { sortedCards, valueOf, type Card } from './cards';
import { buildCpuView, chooseCpuMove } from './cpu';
import {
  applyMove,
  applyRefill,
  dealDeal,
  dealOrder,
  enumerateCaptures,
  isCompleteDeck,
  phaseOf,
  settleDeal,
} from './engine';
import { createRng } from './rng';
import {
  decodeDeal,
  decodeSavedMatch,
  encodeDeal,
  toSavedMatch,
  type SavedMatch,
} from './serialize';
import {
  applyBeat,
  beatOwed,
  canDealNextDeal,
  createSession,
  doNextDeal,
  doPlay,
  restoreSession,
  type ScopaSession,
} from './session';
import {
  cpuStrategy,
  dealWith,
  percentile,
  playMatch,
  randomCardThenOption,
  randomPairs,
  seats,
  type MatchRecord,
} from './test-helpers';
import { CPU, MAX_DEAL_POINTS, PLAYS_PER_DEAL, YOU, type DealState } from './types';

/** For the exhaustive and self-play tests: a few seconds alone, more under a parallel run. */
const HEAVY_TIMEOUT_MS = 30_000;

const sessionAt = (
  seed: string,
  state: MatchRecord['states'][number],
  elapsedSeconds = 7,
): ScopaSession =>
  restoreSession({
    seed,
    dealNumber: state.dealNumber,
    deal: state.deal,
    scores: state.scores,
    moveCount: state.moveCount,
    elapsedSeconds,
  })!;

/** Through JSON, as the storage layer would carry it. */
const throughJson = (record: SavedMatch): unknown => JSON.parse(JSON.stringify(record));

const MATCHES = 60;
const matches: MatchRecord[] = Array.from({ length: MATCHES }, (_, i) => {
  const strategies = [
    seats(cpuStrategy, cpuStrategy),
    seats(randomPairs, cpuStrategy),
    seats(randomCardThenOption, randomPairs),
  ][i % 3]!;
  return playMatch(`scopa-save-${i}`, strategies, { keepStates: true });
});

describe('round trip', () => {
  it(
    'gives back exactly the session it was given, at every position of whole matches',
    { timeout: HEAVY_TIMEOUT_MS },
    () => {
      let positions = 0;
      let refills = 0;
      let settled = 0;
      const nodes: number[] = [];
      const ms: number[] = [];
      for (const match of matches) {
        for (const state of match.states) {
          const session = sessionAt(match.seed, state);
          const record = toSavedMatch(session, 1_760_000_000_000);
          const started = performance.now();
          const back = decodeSavedMatch(throughJson(record));
          ms.push(performance.now() - started);
          expect(back).toEqual(session);
          expect(encodeDeal(back!.deal)).toBe(record.deal);
          expect(beatOwed(back!)).toBe(beatOwed(session));
          positions += 1;
          if (phaseOf(state.deal) === 'refill') refills += 1;
          if (phaseOf(state.deal) === 'over') settled += 1;
          // The replay enumerates the table once per play: the work of one validate.
          let work = 0;
          let replay = dealDeal(match.seed, state.dealNumber, state.deal.dealer);
          for (const play of state.deal.plays) {
            if (phaseOf(replay) === 'refill') replay = { ...replay, ...refillOf(replay) };
            work += enumerateCaptures(replay.table).nodes;
            replay = applyPlayFrom(replay, play.card, play.captured);
          }
          nodes.push(work);
        }
      }
      nodes.sort((a, b) => a - b);
      ms.sort((a, b) => a - b);
      console.log(
        `[scopa] save round trip: ${MATCHES} matches, ${positions} positions (${refills} before a refill, ` +
          `${settled} settled); validate work p50=${percentile(nodes, 50)} p99=${percentile(nodes, 99)} ` +
          `max=${nodes[nodes.length - 1]} subsets (arithmetic bound 36 × 236 = 8,496); ` +
          `decode ms p50=${percentile(ms, 50).toFixed(3)} max=${ms[ms.length - 1]!.toFixed(3)}`,
      );
      // Pinned for §9.2 and §15.2's numbers — not thresholds. Wall clock is never asserted.
      expect([positions, refills, settled]).toEqual([10_986, 1_315, 203]);
      expect([percentile(nodes, 50), percentile(nodes, 99), nodes[nodes.length - 1]]).toEqual([
        108, 271, 346,
      ]);
      expect(nodes[nodes.length - 1]).toBeLessThanOrEqual(36 * 236);
    },
  );

  it('resumes on the CPU’s turn and before a refill owing the same beat', () => {
    const owed = new Set<string>();
    for (const match of matches.slice(0, 5)) {
      for (const state of match.states) {
        const session = sessionAt(match.seed, state);
        const back = decodeSavedMatch(throughJson(toSavedMatch(session, 0)))!;
        owed.add(String(beatOwed(back)));
        expect(beatOwed(back)).toBe(beatOwed(session));
        expect(canDealNextDeal(back)).toBe(canDealNextDeal(session));
      }
    }
    expect([...owed].sort()).toEqual(['cpu', 'null', 'refill']);
  });

  it('writes fractional seconds and times as whole numbers, which then read back', () => {
    const state = matches[0]!.states.find((s) => s.deal.plays.length === 7)!;
    const session = sessionAt(matches[0]!.seed, state, 7.9);
    const record = toSavedMatch(session, 1_760_000_000_000.5);
    expect(record.elapsedSeconds).toBe(7);
    expect(record.savedAt).toBe(1_760_000_000_000);
    expect(decodeSavedMatch(throughJson(record))).toEqual({ ...session, elapsedSeconds: 7 });
  });

  it('replays a deal that needed a reshuffle', () => {
    let seed = '';
    for (let i = 0; seed === '' && i < 20_000; i++) {
      if (dealOrder(`scopa-save-redeal-${i}`, 1).redeals > 0) seed = `scopa-save-redeal-${i}`;
    }
    const session = createSession(seed);
    expect(session.deal.redeals).toBeGreaterThan(0);
    // A reshuffle is not a move: nothing has been played.
    expect(session.moveCount).toBe(0);
    expect(session.deal.plays).toHaveLength(0);
    expect(decodeSavedMatch(throughJson(toSavedMatch(session, 0)))).toEqual(session);
  });
});

// The replay helpers above, kept outside the engine so the work count is the
// test's own and not the decoder's report of itself.
const refillOf = (deal: DealState): DealState => applyRefill(deal)!;
const applyPlayFrom = (deal: DealState, card: Card, captured: readonly Card[]): DealState =>
  applyMove(deal, { card, captured })!;

// ---------------------------------------------------------------------------
// Refusals
// ---------------------------------------------------------------------------

const code = (card: Card): string => card.toString(36).padStart(2, '0');

/** A mid-deal record to tamper with, with the parsed plays. */
function sample(index: number): { record: SavedMatch; plays: string[]; state: DealState } {
  const match = matches[index]!;
  const state = match.states.find((s) => s.deal.plays.length === 13)!;
  const record = toSavedMatch(sessionAt(match.seed, state), 0);
  return { record, plays: record.deal.split('/')[2]!.split('.'), state: state.deal };
}

const withDeal = (record: SavedMatch, deal: string): SavedMatch => ({ ...record, deal });
const withPlays = (record: SavedMatch, plays: readonly string[], rounds?: number): SavedMatch =>
  withDeal(record, `1/${rounds ?? record.deal.split('/')[1]}/${plays.join('.')}`);
const rejects = (record: unknown) => expect(decodeSavedMatch(record)).toBeNull();

describe('fails closed: the record’s shape (§9.2)', () => {
  const { record } = sample(0);

  it('accepts the untouched sample', () => {
    expect(decodeSavedMatch(record)).not.toBeNull();
  });

  it('rejects anything that is not the record', () => {
    for (const raw of [null, undefined, 7, 'x', [], {}, { ...record, schemaVersion: 2 }])
      rejects(raw);
    const { seed: _seed, ...noSeed } = record;
    rejects(noSeed);
  });

  it('rejects fields out of their range', () => {
    rejects({ ...record, seed: '' });
    rejects({ ...record, seed: 'x'.repeat(65) });
    rejects({ ...record, seed: 3 });
    rejects({ ...record, dealNumber: 0 });
    rejects({ ...record, dealNumber: 1000 });
    rejects({ ...record, dealNumber: 1.5 });
    rejects({ ...record, scores: [0] });
    rejects({ ...record, scores: [0, -1] });
    rejects({ ...record, scores: [0, 1000] });
    rejects({ ...record, scores: '0,0' });
    rejects({ ...record, elapsedSeconds: -1 });
    rejects({ ...record, elapsedSeconds: 1e7 + 1 });
    rejects({ ...record, elapsedSeconds: 2.5 });
    rejects({ ...record, savedAt: -1 });
    rejects({ ...record, savedAt: 1e15 + 1 });
    rejects({ ...record, moveCount: '13' });
  });

  it('rejects a dealer the seed does not deal', () => {
    rejects({ ...record, dealer: record.dealer === YOU ? CPU : YOU });
    rejects({ ...record, dealer: 2 });
  });

  it('rejects a deal string that is not the format', () => {
    const [, rounds, plays] = record.deal.split('/');
    rejects(withDeal(record, ''));
    rejects(withDeal(record, `2/${rounds}/${plays}`));
    rejects(withDeal(record, `1/${rounds}/${plays}/`));
    rejects(withDeal(record, `1/${rounds}`));
    for (const bad of ['0', '7', '9', 'x', '01', ''])
      rejects(withDeal(record, `1/${bad}/${plays}`));
    rejects({ ...record, deal: 12 });
  });

  it('rejects a card that is not a card, and plays that are not whole cards', () => {
    const { plays } = sample(0);
    const first = plays[0]!;
    rejects(withPlays(record, [`zz${first.slice(2)}`, ...plays.slice(1)]));
    // 40 in base 36 is '14' — one past the end of the deck.
    rejects(withPlays(record, [`14${first.slice(2)}`, ...plays.slice(1)]));
    rejects(withPlays(record, [first.toUpperCase().replace(/^(..)/, 'A0'), ...plays.slice(1)]));
    rejects(withPlays(record, [`${first}0`, ...plays.slice(1)]));
    rejects(withPlays(record, ['', ...plays.slice(1)]));
    rejects(withPlays(record, [...plays, '']));
  });

  it('rejects thirty-seven plays or more', () => {
    const match = matches[1]!;
    const over = match.states.find((s) => phaseOf(s.deal) === 'over')!;
    const record36 = toSavedMatch(sessionAt(match.seed, over), 0);
    expect(decodeSavedMatch(record36)).not.toBeNull();
    const plays = record36.deal.split('/')[2]!.split('.');
    expect(plays).toHaveLength(PLAYS_PER_DEAL);
    rejects(withPlays(record36, [...plays, plays[0]!]));
  });
});

describe('fails closed: plays the rules could not have produced (§9.2)', () => {
  /** Finds, across the self-played histories, a play matching `pick` and returns the record cut just after it. */
  function find(pick: (table: readonly Card[], card: Card, captured: readonly Card[]) => boolean): {
    record: SavedMatch;
    plays: string[];
    at: number;
    table: Card[];
  } {
    for (const match of matches) {
      for (const state of match.states) {
        if (phaseOf(state.deal) !== 'over') continue;
        let replay = dealDeal(match.seed, state.dealNumber, state.deal.dealer);
        for (let at = 0; at < state.deal.plays.length; at++) {
          const play = state.deal.plays[at]!;
          if (phaseOf(replay) === 'refill') replay = refillOf(replay);
          if (pick(replay.table, play.card, play.captured)) {
            const cut = match.states.find(
              (s) => s.dealNumber === state.dealNumber && s.deal.plays.length === at + 1,
            )!;
            const record = toSavedMatch(sessionAt(match.seed, cut), 0);
            const plays = record.deal.split('/')[2]!.split('.');
            return { record, plays, at, table: [...replay.table] };
          }
          replay = applyPlayFrom(replay, play.card, play.captured);
        }
      }
    }
    throw new Error('no such play in the sample');
  }

  /** Subsets of the table summing to v with two or more cards, ignoring rule 1. */
  const sumsTo = (table: readonly Card[], v: number): Card[][] => {
    const out: Card[][] = [];
    const sorted = sortedCards(table);
    for (let mask = 1; mask < 1 << sorted.length; mask++) {
      const set = sorted.filter((_, i) => (mask >> i) & 1);
      if (set.length >= 2 && set.reduce((s, c) => s + valueOf(c), 0) === v) out.push(set);
    }
    return out;
  };

  const replace = (found: ReturnType<typeof find>, play: string): SavedMatch => {
    const plays = [...found.plays];
    plays[found.at] = play;
    return withPlays(found.record, plays);
  };

  it('accepts what it finds before tampering', () => {
    const found = find((_, __, captured) => captured.length === 1);
    expect(decodeSavedMatch(found.record)).not.toBeNull();
  });

  it('rejects a sum taken while the same value lay on the table', () => {
    const found = find(
      (table, card, captured) => captured.length === 1 && sumsTo(table, valueOf(card)).length > 0,
    );
    const play = found.plays[found.at]!;
    const sum = sumsTo(found.table, valueOf(Number.parseInt(play.slice(0, 2), 36)))[0]!;
    rejects(replace(found, play.slice(0, 2) + sum.map(code).join('')));
  });

  it('rejects a set that does not add up to the card played', () => {
    const found = find((_, __, captured) => captured.length >= 2);
    const play = found.plays[found.at]!;
    // Drop the last card of the set: it no longer sums to the card.
    rejects(replace(found, play.slice(0, -2)));
  });

  it('rejects a card placed when it could take', () => {
    const found = find((_, __, captured) => captured.length > 0);
    rejects(replace(found, found.plays[found.at]!.slice(0, 2)));
  });

  /** A card of the same value as `like` that is on neither the table nor `besides`. */
  const offTable = (found: ReturnType<typeof find>, like: Card, besides: readonly Card[]): Card =>
    [...Array(40).keys()].find(
      (c) => valueOf(c) === valueOf(like) && !besides.includes(c) && !found.table.includes(c),
    )!;

  it('rejects taking a card that is not on the table — from a card that could only be placed', () => {
    const found = find((table, card, captured) => captured.length === 0 && table.length > 0);
    const played = Number.parseInt(found.plays[found.at]!.slice(0, 2), 36);
    // The same value from somewhere off the table: a card never put down.
    rejects(replace(found, code(played) + code(offTable(found, played, [played]))));
  });

  it('rejects taking a card that is not on the table — from a card that could take', () => {
    // A same-value take, its card swapped for the same value off the table.
    const same = find((_, __, captured) => captured.length === 1);
    const [played, taken] = same.plays[same.at]!.match(/.{2}/g)!.map((t) => Number.parseInt(t, 36));
    const swapped = offTable(same, taken!, [played!, taken!]);
    expect(same.table).not.toContain(swapped);
    rejects(replace(same, code(played!) + code(swapped)));
    // A sum, one of its cards swapped for the same value off the table: it still adds up.
    const sum = find((_, __, captured) => captured.length >= 2);
    const [card, ...set] = sum.plays[sum.at]!.match(/.{2}/g)!.map((t) => Number.parseInt(t, 36));
    const out = offTable(sum, set[0]!, [card!, ...set]);
    expect(sum.table).not.toContain(out);
    rejects(
      replace(
        sum,
        code(card!) +
          sortedCards([out, ...set.slice(1)])
            .map(code)
            .join(''),
      ),
    );
  });

  it('rejects taken cards written out of order, or one twice', () => {
    const found = find((_, __, captured) => captured.length >= 2);
    const play = found.plays[found.at]!;
    const taken = play.slice(2).match(/.{2}/g)!;
    rejects(replace(found, play.slice(0, 2) + [...taken].reverse().join('')));
    rejects(replace(found, play.slice(0, 2) + taken[0]! + taken.join('')));
  });

  it('rejects a card out of turn, a card played twice, and a card not in hand', () => {
    const { record, plays, state } = sample(2);
    // The first play made with a card the other side was dealt.
    const opening = dealDeal(record.seed, record.dealNumber, record.dealer);
    const firstSeat = record.dealer === YOU ? CPU : YOU;
    const otherCard = opening.hands[record.dealer][0]!;
    expect(opening.hands[firstSeat]).not.toContain(otherCard);
    rejects(withPlays(record, [code(otherCard), ...plays.slice(1)]));
    // Playing the first card again on the next turn of the same seat.
    const again = [...plays];
    again[2] = plays[0]!;
    rejects(withPlays(record, again));
    // A card still in the stock.
    rejects(withPlays(record, [...plays.slice(0, -1), code(state.stock[0]!)]));
  });

  it('rejects rounds that do not match the plays', () => {
    const { record, plays } = sample(3);
    const rounds = Number(record.deal.split('/')[1]);
    expect(plays).toHaveLength(13);
    expect(rounds).toBe(3);
    rejects(withPlays(record, plays, rounds - 1));
    rejects(withPlays(record, plays, rounds + 1));
    // Exactly at a round's end, both readings are honest: before the refill, or after it.
    const twelve = plays.slice(0, 12);
    const before = withPlays({ ...record, moveCount: record.moveCount - 1 }, twelve, 2);
    const after = withPlays({ ...record, moveCount: record.moveCount - 1 }, twelve, 3);
    expect(phaseOf(decodeSavedMatch(before)!.deal)).toBe('refill');
    expect(phaseOf(decodeSavedMatch(after)!.deal)).toBe('play');
    rejects(withPlays({ ...record, moveCount: record.moveCount - 1 }, twelve, 4));
    rejects(withPlays({ ...record, moveCount: record.moveCount - 1 }, twelve, 1));
  });
});

describe('fails closed: fields that disagree with the replay (§9.2)', () => {
  it('rejects a move count one off either way', () => {
    const { record } = sample(4);
    rejects({ ...record, moveCount: record.moveCount + 1 });
    rejects({ ...record, moveCount: record.moveCount - 1 });
  });

  const firstDeal = (pick: (s: MatchRecord['states'][number]) => boolean) => {
    for (const match of matches) {
      const state = match.states.find((s) => s.dealNumber === 1 && pick(s));
      if (state) return toSavedMatch(sessionAt(match.seed, state), 0);
    }
    throw new Error('none');
  };

  it('rejects points on the first deal before it is settled', () => {
    const record = firstDeal((s) => s.deal.plays.length === 20);
    expect(record.scores).toEqual([0, 0]);
    rejects({ ...record, scores: [1, 0] });
    rejects({ ...record, scores: [0, 1] });
  });

  it('rejects a settled first deal whose score is not that deal’s points', () => {
    const record = firstDeal((s) => phaseOf(s.deal) === 'over');
    const [a, b] = record.scores;
    expect(decodeSavedMatch(record)).not.toBeNull();
    rejects({ ...record, scores: [a + 1, b] });
    if (a > 0) rejects({ ...record, scores: [a - 1, b] });
  });

  it('rejects scores no run of deals could have reached', () => {
    // Every deal scores at least one point (7♦), so after two deals the sum is at least two.
    const match = matches.find((m) => m.states.some((s) => s.dealNumber === 3))!;
    const state = match.states.find((s) => s.dealNumber === 3 && s.deal.plays.length === 5)!;
    const record = toSavedMatch(sessionAt(match.seed, state), 0);
    expect(decodeSavedMatch(record)).not.toBeNull();
    rejects({ ...record, scores: [1, 0] });
    expect(decodeSavedMatch({ ...record, scores: [2, 0] })).not.toBeNull();
  });

  it('rejects more points than the deals played could give out', () => {
    // §9.2: no deal gives out more than MAX_DEAL_POINTS (4 + 18, by arithmetic),
    // so on the second deal the score before it sums to at most 22.
    expect(MAX_DEAL_POINTS).toBe(22);
    const match = matches.find((m) => m.states.some((s) => s.dealNumber === 2))!;
    const mid = match.states.find((s) => s.dealNumber === 2 && s.deal.plays.length === 9)!;
    const record = toSavedMatch(sessionAt(match.seed, mid), 0);
    expect(decodeSavedMatch(record)).not.toBeNull();
    // Level, so not a decided match: only the bound turns these away.
    expect(decodeSavedMatch({ ...record, scores: [11, 11] })).not.toBeNull();
    rejects({ ...record, scores: [12, 12] });
    rejects({ ...record, scores: [500, 500] });
    rejects({ ...record, scores: [999, 999] });
    // A settled second deal that split its points evenly (so the score after it
    // stays level too): the bound applies to the score before it.
    const level = (s: MatchRecord['states'][number]) =>
      s.dealNumber === 2 &&
      phaseOf(s.deal) === 'over' &&
      pointsOf(s.deal)[0] === pointsOf(s.deal)[1];
    const evenMatch = matches.find((m) => m.states.some(level))!;
    const settled = evenMatch.states.find(level)!;
    const [d] = pointsOf(settled.deal);
    const record2 = toSavedMatch(sessionAt(evenMatch.seed, settled), 0);
    expect(decodeSavedMatch({ ...record2, scores: [11 + d, 11 + d] })).not.toBeNull();
    rejects({ ...record2, scores: [12 + d, 12 + d] });
  });

  it('rejects a match that is already decided — by the record’s score or by the score before the deal', () => {
    // Mid-deal (a later deal, so that a score is reachable at all) with a decided score.
    const later = matches.find((m) => m.states.some((s) => s.dealNumber === 2))!;
    const record = toSavedMatch(
      sessionAt(
        later.seed,
        later.states.find((s) => s.dealNumber === 2 && s.deal.plays.length === 9)!,
      ),
      0,
    );
    rejects({ ...record, scores: [11, 3] });
    rejects({ ...record, scores: [4, 12] });
    expect(decodeSavedMatch({ ...record, scores: [11, 11] })).not.toBeNull();
    // The deciding deal's own settlement: a correct game deletes the save here.
    let session = createSession('scopa-decided');
    for (let guard = 0; guard < 5_000 && session.status === 'playing'; guard++) {
      session = stepSession(session);
    }
    expect(session.status).not.toBe('playing');
    rejects(toSavedMatch(session, 0));
    // A settled deal level afterwards but decided before it: no deal follows a decided one.
    // On the third deal or later, so that the score before it is inside the
    // points bound and only the decided-before check can turn it away.
    for (const match of matches) {
      const state = match.states.find((s) => {
        if (s.dealNumber < 3 || phaseOf(s.deal) !== 'over') return false;
        return pointsOf(s.deal)[0] !== pointsOf(s.deal)[1];
      });
      if (!state) continue;
      const [d0, d1] = pointsOf(state.deal);
      const total = 11 + Math.max(d0, d1);
      expect(2 * total - d0 - d1).toBeLessThanOrEqual(MAX_DEAL_POINTS * (state.dealNumber - 1));
      const record2 = toSavedMatch(sessionAt(match.seed, state), 0);
      rejects({ ...record2, scores: [total, total] });
      return;
    }
    throw new Error('no settled deal with unequal points in the sample');
  });
});

describe('the forty-card check at the decoder’s exit (§9.2)', () => {
  it('passes every restored position and fails a deck one short or one doubled', () => {
    for (const match of matches.slice(0, 10)) {
      for (const state of match.states) expect(isCompleteDeck(state.deal)).toBe(true);
    }
    const deal = dealDeal('scopa-forty', 1, YOU);
    expect(isCompleteDeck(deal)).toBe(true);
    expect(isCompleteDeck({ ...deal, stock: deal.stock.slice(1) })).toBe(false);
    expect(isCompleteDeck({ ...deal, stock: [...deal.stock.slice(1), deal.table[0]!] })).toBe(
      false,
    );
    expect(isCompleteDeck({ ...deal, table: [...deal.table, 40] })).toBe(false);
    expect(isCompleteDeck(dealWith({}))).toBe(false);
  });

  it('decodes a deal nobody has played into its opening', () => {
    const seed = 'scopa-forty';
    const deal = dealDeal(seed, 1, firstDealer(seed));
    const text = encodeDeal(deal);
    expect(text).toBe('1/1/');
    expect(decodeDeal(seed, 1, text)).toEqual(deal);
  });
});

// Helpers for the decided-match test.

function stepSession(session: ScopaSession): ScopaSession {
  const beat = beatOwed(session);
  if (beat !== null) return applyBeat(session, beat)!.session;
  if (canDealNextDeal(session)) return doNextDeal(session)!;
  const view = buildCpuView(session.deal, YOU, session.scores);
  const tie = createRng(`${session.seed}:you:${session.moveCount}`)();
  return doPlay(session, chooseCpuMove(view, tie)!)!.session;
}

const firstDealer = (seed: string) => createSession(seed).deal.dealer;

const pointsOf = (deal: DealState): readonly [number, number] => settleDeal(deal)!.points;
