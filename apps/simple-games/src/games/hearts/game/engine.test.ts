/**
 * One hand of Hearts, rule by rule: the pass and its rotation, the two of
 * clubs, following suit, what the first trick will not take, when hearts
 * break, who takes a trick, and how twenty-six points get shared out.
 *
 * Hands are dealt by hand rather than played into, because the positions that
 * matter — a seat holding nothing but hearts on the opening trick, a seat that
 * takes all twenty-six, a seat that takes the queen and nothing else — are
 * ones a seeded deal would take thousands of hands to produce. Every fixture
 * goes through `isValidHand` on the way in and after every card, so a test can
 * never assert about a position the game could not reach.
 */
import { describe, expect, it } from 'vitest';
import {
  cardOf,
  CARD_COUNT,
  HEARTS,
  isHeart,
  QUEEN_OF_SPADES,
  sortedCards,
  suitOf,
  TWO_OF_CLUBS,
  type Card,
  type Suit,
} from './cards';
import {
  allCards,
  canPlay,
  collectTrick,
  confirmPass,
  dealHand,
  isValidHand,
  legalPlays,
  pendingTrick,
  playCard,
  scoreHand,
  selectPassCard,
  unselectPassCard,
} from './engine';
import {
  bySeat,
  HAND_PENALTY_TOTAL,
  HAND_SIZE,
  legalPlaysIn,
  passDirectionOf,
  passOffsetOf,
  passReceiverOf,
  penaltiesTakenIn,
  SEATS,
  seatToPlay,
  trickWinnerOf,
  TRICKS_PER_HAND,
  YOU,
  type BySeat,
  type HandState,
  type PassOffset,
  type Seat,
} from './types';

const SUIT_LETTERS = 'SHDC';
/** Rank 1 is the two and rank 13 the ace: the ace is high in Hearts. */
const RANK_LETTERS = '23456789TJQKA';

function card(text: string): Card {
  const suit = SUIT_LETTERS.indexOf(text[0]!) as Suit;
  const rank = RANK_LETTERS.indexOf(text[1]!) + 1;
  if (suit < 0 || rank < 1) throw new Error(`not a card: ${text}`);
  return cardOf(suit, rank);
}
const cards = (text: string): Card[] => text.split(/\s+/).filter(Boolean).map(card);

/**
 * Four hands from however many are named; the rest of the deck fills the gaps
 * in ascending order, so a fixture is always a whole fifty-two cards without
 * writing out three hands nobody is asserting about.
 */
function deal(named: Partial<Record<Seat, readonly Card[]>>): BySeat<readonly Card[]> {
  const taken = new Set<Card>();
  for (const seat of SEATS) {
    const own = named[seat] ?? [];
    if (own.length > HAND_SIZE) throw new Error('a hand is at most thirteen cards');
    for (const held of own) {
      if (taken.has(held)) throw new Error('a card cannot be in two hands');
      taken.add(held);
    }
  }
  const rest: Card[] = [];
  for (let value = 0; value < CARD_COUNT; value++) if (!taken.has(value)) rest.push(value);

  let at = 0;
  return bySeat<readonly Card[]>((seat) => {
    const own = [...(named[seat] ?? [])];
    while (own.length < HAND_SIZE) own.push(rest[at++]!);
    return sortedCards(own);
  });
}

/** The position the tricks start from: after the pass, before the opening lead. */
function startOfPlay(hands: BySeat<readonly Card[]>, passOffset: PassOffset = 0): HandState {
  const leader = SEATS.find((seat) => hands[seat].includes(TWO_OF_CLUBS))!;
  const built: HandState = {
    passOffset,
    hands,
    selected: bySeat<readonly Card[]>(() => []),
    confirmed: [false, false, false, false],
    phase: 'playing',
    leader,
    played: [],
    tricks: [],
    heartsBroken: false,
  };
  if (!isValidHand(built)) throw new Error('fixture is not a hand that could come from play');
  return built;
}

/** Plays the cards in order, folding each finished trick away as it completes. */
function play(hand: HandState, script: readonly Card[]): HandState {
  let state = hand;
  for (const next of script) {
    const played = playCard(state, next);
    if (played === null) throw new Error(`the fixture plays an illegal card: ${next}`);
    const collected = collectTrick(played);
    state = collected === null ? played : collected.hand;
    expect(isValidHand(state)).toBe(true);
  }
  return state;
}

/** Everybody plays their lowest legal card until the hand is done. */
function playOut(hand: HandState): HandState {
  let state = hand;
  let guard = 0;
  while (state.phase !== 'over' && guard++ < CARD_COUNT + 1) {
    state = play(state, [legalPlays(state)[0]!]);
  }
  return state;
}

/** Every card, once, wherever it is. The invariant no move may break. */
function expectFiftyTwoCards(hand: HandState): void {
  expect(sortedCards(allCards(hand))).toEqual(Array.from({ length: CARD_COUNT }, (_, i) => i));
}

describe('the deal (thirteen each)', () => {
  const dealt = dealHand('hearts-deal', 1);

  it('gives thirteen cards to each of the four seats', () => {
    for (const seat of SEATS) expect(dealt.hands[seat]).toHaveLength(HAND_SIZE);
    expectFiftyTwoCards(dealt);
    expect(isValidHand(dealt)).toBe(true);
  });

  it('deals the same hand for the same seed and hand number, and a different one otherwise', () => {
    expect(dealHand('hearts-deal', 1)).toEqual(dealt);
    expect(dealHand('hearts-deal', 5).hands[YOU]).not.toEqual(dealt.hands[YOU]);
    expect(dealHand('hearts-other', 1).hands[YOU]).not.toEqual(dealt.hands[YOU]);
  });
});

describe('the pass rotates left, right, across, and then not at all', () => {
  it('turns with the hand number, every four hands', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(passOffsetOf)).toEqual([1, 3, 2, 0, 1, 3, 2, 0]);
    expect([1, 2, 3, 4].map((n) => passDirectionOf(passOffsetOf(n)))).toEqual([
      'left',
      'right',
      'across',
      'none',
    ]);
  });

  it('sends the cards to the seat the direction names', () => {
    // Seat 0 is the player, 1 is on their left, 2 across, 3 on their right.
    expect(passReceiverOf(0, 1)).toBe(1);
    expect(passReceiverOf(0, 3)).toBe(3);
    expect(passReceiverOf(0, 2)).toBe(2);
    expect(passReceiverOf(3, 1)).toBe(0);
    expect(passReceiverOf(2, 3)).toBe(1);
  });

  it('skips the passing phase entirely on the hand nobody passes', () => {
    const fourth = dealHand('hearts-deal', 4);
    expect(fourth.passOffset).toBe(0);
    expect(fourth.phase).toBe('playing');
    expect(fourth.hands[fourth.leader]).toContain(TWO_OF_CLUBS);
    expect(seatToPlay(fourth)).toBe(fourth.leader);
    // And a passing hand really does wait.
    expect(dealHand('hearts-deal', 1).phase).toBe('passing');
    expect(seatToPlay(dealHand('hearts-deal', 1))).toBeNull();
  });
});

describe('choosing three to pass', () => {
  const dealt = dealHand('hearts-pass', 1);
  const first = (seat: Seat, count: number): Card[] => dealt.hands[seat].slice(0, count);

  const chosen = (hand: HandState, seat: Seat, picks: readonly Card[]): HandState => {
    let state = hand;
    for (const pick of picks) {
      const next = selectPassCard(state, seat, pick);
      expect(next).not.toBeNull();
      state = next!;
    }
    return state;
  };

  it('takes three and refuses a fourth', () => {
    const three = chosen(dealt, YOU, first(YOU, 3));
    expect(three.selected[YOU]).toEqual(first(YOU, 3));
    expect(selectPassCard(three, YOU, dealt.hands[YOU][3]!)).toBeNull();
  });

  it('refuses a card the seat is not holding, and the same card twice', () => {
    expect(selectPassCard(dealt, YOU, dealt.hands[1][0]!)).toBeNull();
    const one = chosen(dealt, YOU, first(YOU, 1));
    expect(selectPassCard(one, YOU, dealt.hands[YOU][0]!)).toBeNull();
  });

  it('puts a card back, and will not put back one that was never picked', () => {
    const two = chosen(dealt, YOU, first(YOU, 2));
    expect(unselectPassCard(two, YOU, dealt.hands[YOU][0]!)!.selected[YOU]).toEqual(
      first(YOU, 2).slice(1),
    );
    expect(unselectPassCard(two, YOU, dealt.hands[YOU][5]!)).toBeNull();
  });

  it('confirms on exactly three and not on two', () => {
    expect(confirmPass(chosen(dealt, YOU, first(YOU, 2)), YOU)).toBeNull();
    const three = chosen(dealt, YOU, first(YOU, 3));
    const result = confirmPass(three, YOU)!;
    expect(result.hand.confirmed[YOU]).toBe(true);
    expect(result.exchange).toBeNull();
    // And a confirmed seat cannot change its mind.
    expect(selectPassCard(result.hand, YOU, dealt.hands[YOU][4]!)).toBeNull();
    expect(unselectPassCard(result.hand, YOU, dealt.hands[YOU][0]!)).toBeNull();
    expect(confirmPass(result.hand, YOU)).toBeNull();
  });

  it('has nothing to choose on the hand nobody passes', () => {
    const fourth = dealHand('hearts-pass', 4);
    expect(selectPassCard(fourth, YOU, fourth.hands[YOU][0]!)).toBeNull();
    expect(confirmPass(fourth, YOU)).toBeNull();
  });
});

describe('the exchange happens to all four seats at once', () => {
  const exchanged = (handNumber: number) => {
    const dealt = dealHand('hearts-exchange', handNumber);
    const picks = bySeat<readonly Card[]>((seat) => dealt.hands[seat].slice(0, 3));
    let hand = dealt;
    for (const seat of SEATS) {
      for (const pick of picks[seat]) hand = selectPassCard(hand, seat, pick)!;
    }
    let exchange = null;
    for (const seat of SEATS) {
      // Until the fourth, nobody's cards have moved anywhere.
      if (hand.phase === 'passing') expect(hand.hands[seat]).toHaveLength(HAND_SIZE);
      const result = confirmPass(hand, seat)!;
      hand = result.hand;
      exchange = result.exchange ?? exchange;
    }
    return { dealt, hand, picks, exchange: exchange! };
  };

  for (const [handNumber, offset] of [
    [1, 1],
    [2, 3],
    [3, 2],
  ] as const) {
    it(`moves every seat's three ${passDirectionOf(offset as PassOffset)}`, () => {
      const { dealt, hand, picks, exchange } = exchanged(handNumber);
      expect(exchange.offset).toBe(offset);
      for (const seat of SEATS) {
        const to = passReceiverOf(seat, offset as PassOffset);
        expect(exchange.passed[seat]).toEqual(picks[seat]);
        // The three left this seat and arrived at exactly one other.
        for (const gone of picks[seat]) {
          expect(hand.hands[seat]).not.toContain(gone);
          expect(hand.hands[to]).toContain(gone);
        }
        expect(exchange.received[to]).toEqual(sortedCards([...picks[seat]]));
        expect(hand.hands[seat]).toHaveLength(HAND_SIZE);
        expect(hand.hands[seat]).not.toEqual(dealt.hands[seat]);
      }
      expectFiftyTwoCards(hand);
      expect(isValidHand(hand)).toBe(true);
    });
  }

  it('starts the tricks, on whoever holds the two of clubs after the swap', () => {
    const { hand } = exchanged(1);
    expect(hand.phase).toBe('playing');
    expect(hand.selected.every((chosen) => chosen.length === 0)).toBe(true);
    expect(hand.confirmed.every((flag) => flag === false)).toBe(true);
    expect(hand.hands[hand.leader]).toContain(TWO_OF_CLUBS);
    expect(seatToPlay(hand)).toBe(hand.leader);
  });
});

describe('the opening lead is the two of clubs', () => {
  const hand = startOfPlay(deal({ 0: cards('C2 CA HA SA D2') }));

  it('leaves the holder of the two exactly one legal card', () => {
    expect(hand.leader).toBe(YOU);
    expect(legalPlays(hand)).toEqual([TWO_OF_CLUBS]);
    expect(canPlay(hand, card('CA'))).toBe(false);
    expect(playCard(hand, card('CA'))).toBeNull();
    expect(playCard(hand, TWO_OF_CLUBS)).not.toBeNull();
  });
});

describe('follow the suit that was led', () => {
  it('offers only the suit led, to a seat that holds it', () => {
    const hand = startOfPlay(
      deal({
        0: cards('C2 C5 CT S3 SK H4 H9 D6 DJ DQ DK D9 D8'),
        1: cards('C3 C4 C6 S2 S4 S5 S6 S7 S8 S9 ST SJ SA'),
      }),
    );
    const opened = playCard(hand, TWO_OF_CLUBS)!;
    const follower = seatToPlay(opened)!;
    const clubs = opened.hands[follower].filter((held) => suitOf(held) === 3);
    expect(clubs.length).toBeGreaterThan(0);
    expect(legalPlays(opened)).toEqual(clubs);
    for (const held of opened.hands[follower]) {
      expect(canPlay(opened, held)).toBe(clubs.includes(held));
    }
  });

  it('is the one rule with no exception — the rest only ever apply to a void seat', () => {
    // A seat holding one card of the suit led, and twelve points, still plays
    // the one card.
    const held = cards('C7 H2 H3 H4 H5 H6 H7 H8 H9 HT HJ HQ SQ');
    expect(
      legalPlaysIn({ cards: held, leadCard: card('C2'), firstTrick: true, heartsBroken: false }),
    ).toEqual([card('C7')]);
  });
});

describe('the first trick will not take a point', () => {
  it('refuses hearts and the queen from a seat that is void in clubs', () => {
    const hand = startOfPlay(
      deal({ 0: cards('C2 C3 C4 C5'), 1: cards('SQ SK H2 H3 H4 D2 D3 D4 D5 D6 D7 D8 D9') }),
    );
    const opened = playCard(hand, TWO_OF_CLUBS)!;
    expect(seatToPlay(opened)).toBe(1);
    const legal = legalPlays(opened);
    expect(legal).not.toContain(QUEEN_OF_SPADES);
    expect(legal).not.toContain(card('H2'));
    expect(legal).toContain(card('SK'));
    expect(playCard(opened, card('H2'))).toBeNull();
    expect(playCard(opened, QUEEN_OF_SPADES)).toBeNull();
  });

  it('bends for a seat holding nothing but points, because that hand can be dealt', () => {
    // The queen and twelve hearts: every card this seat has is a penalty.
    const allPoints = cards('SQ H2 H3 H4 H5 H6 H7 H8 H9 HT HJ HQ HK');
    const hand = startOfPlay(deal({ 0: cards('C2 C3 C4 C5'), 1: allPoints }));
    const opened = playCard(hand, TWO_OF_CLUBS)!;
    expect(seatToPlay(opened)).toBe(1);
    expect(sortedCards(legalPlays(opened))).toEqual(sortedCards(allPoints));
    expect(playCard(opened, QUEEN_OF_SPADES)).not.toBeNull();
  });

  it('and a heart forced out that way really does break them', () => {
    const allHearts = cards('H2 H3 H4 H5 H6 H7 H8 H9 HT HJ HQ HK HA');
    const hand = startOfPlay(deal({ 0: cards('C2 C3 C4 C5'), 1: allHearts }));
    const opened = playCard(hand, TWO_OF_CLUBS)!;
    expect(opened.heartsBroken).toBe(false);
    expect(playCard(opened, card('HA'))!.heartsBroken).toBe(true);
  });
});

describe('hearts may not be led until they are broken', () => {
  /** The rule itself, stated without a hand around it. */
  const lead = (held: readonly Card[], heartsBroken: boolean): Card[] =>
    legalPlaysIn({ cards: held, leadCard: null, firstTrick: false, heartsBroken });

  it('keeps hearts out of a lead while the leader holds anything else', () => {
    const held = cards('S3 SK D6 H4 H9 HA');
    expect(lead(held, false)).toEqual(cards('S3 SK D6'));
    expect(sortedCards(lead(held, true))).toEqual(sortedCards(held));
  });

  it('lets a seat holding nothing but hearts lead them anyway', () => {
    const allHearts = cards('H2 H3 H4 H5 H6 H7 H8 H9 HT HJ HQ HK HA');
    expect(sortedCards(lead(allHearts, false))).toEqual(sortedCards(allHearts));
  });

  it('lets the queen of spades be led whenever her holder likes', () => {
    // She is thirteen points and not a heart, so nothing gates her.
    expect(lead(cards('SQ H2 H3'), false)).toEqual([QUEEN_OF_SPADES]);
    expect(lead(cards('SQ S2 H2'), false)).toContain(QUEEN_OF_SPADES);
  });

  it('holds in a real hand: after the opening trick, no heart is on offer', () => {
    let state = playCard(startOfPlay(dealHand('hearts-lead', 4).hands), TWO_OF_CLUBS)!;
    while (state.tricks.length === 0) state = play(state, [legalPlays(state)[0]!]);
    expect(state.tricks).toHaveLength(1);
    expect(state.heartsBroken).toBe(false);
    const legal = legalPlays(state);
    expect(legal.length).toBeGreaterThan(0);
    expect(legal.some(isHeart)).toBe(false);
    expect(state.hands[state.leader].some(isHeart)).toBe(true);
  });
});

describe('breaking hearts', () => {
  it('happens on the first heart played and not before', () => {
    let state = startOfPlay(dealHand('hearts-break', 4).hands);
    let brokeOn = -1;
    let index = 0;
    while (state.phase !== 'over') {
      const next = legalPlays(state)[0]!;
      const before = state.heartsBroken;
      state = play(state, [next]);
      if (!before && state.heartsBroken) brokeOn = index;
      expect(state.heartsBroken).toBe(before || isHeart(next));
      index += 1;
    }
    expect(brokeOn).toBeGreaterThanOrEqual(0);
  });

  it('is not caused by the queen of spades, who is worth thirteen and breaks nothing', () => {
    // Seat 1 is void in clubs and throws the queen onto the second trick.
    const hand = startOfPlay(
      deal({
        0: cards('C2 C3 C4 C5 CA'),
        1: cards('SQ S2 S3 D2 D3 D4 D5 D6 D7 D8 D9 DT DJ'),
      }),
    );
    const first = play(hand, [
      TWO_OF_CLUBS,
      card('S2'),
      legalPlays(playCard(playCard(hand, TWO_OF_CLUBS)!, card('S2'))!)[0]!,
    ]);
    expect(first.heartsBroken).toBe(false);
    const finished = play(first, [legalPlays(first)[0]!]);
    expect(finished.tricks).toHaveLength(1);
    // Somewhere later the queen goes down; wherever that is, she breaks nothing.
    let state = finished;
    while (state.phase !== 'over' && !state.played.includes(QUEEN_OF_SPADES)) {
      const options = legalPlays(state);
      const next = options.includes(QUEEN_OF_SPADES) ? QUEEN_OF_SPADES : options[0]!;
      const before = state.heartsBroken;
      state = play(state, [next]);
      if (next === QUEEN_OF_SPADES && !before) expect(state.heartsBroken).toBe(false);
    }
  });
});

describe('who takes the trick', () => {
  it('is the highest card of the suit that was led', () => {
    const hand = startOfPlay(
      deal({ 0: cards('C2 C3'), 1: cards('CA CK'), 2: cards('CQ CJ'), 3: cards('CT C9') }),
    );
    const done = playCard(
      playCard(playCard(playCard(hand, TWO_OF_CLUBS)!, card('CA'))!, card('CQ'))!,
      card('CT'),
    )!;
    const pending = pendingTrick(done)!;
    expect(pending.winner).toBe(1);
    expect(pending.points).toBe(0);
    expect(collectTrick(done)!.hand.leader).toBe(1);
  });

  it('is never a card of another suit, however big', () => {
    expect(
      trickWinnerOf({ leader: 0, cards: [card('C2'), card('SA'), card('HA'), card('DA')] }),
    ).toBe(0);
    expect(
      trickWinnerOf({ leader: 2, cards: [card('D5'), card('DT'), card('SA'), card('D9')] }),
    ).toBe(3);
  });

  it('sits on the table until it is collected — that is its own beat', () => {
    const hand = startOfPlay(deal({ 0: cards('C2 C3'), 1: cards('CA CK') }));
    let state = playCard(hand, TWO_OF_CLUBS)!;
    for (let index = 1; index < 4; index++) state = playCard(state, legalPlays(state)[0]!)!;
    expect(state.played).toHaveLength(4);
    expect(state.tricks).toHaveLength(0);
    expect(seatToPlay(state)).toBeNull();
    expect(playCard(state, state.hands[0][0]!)).toBeNull();
    expect(isValidHand(state)).toBe(true);

    const collected = collectTrick(state)!;
    expect(collected.hand.played).toHaveLength(0);
    expect(collected.hand.tricks).toHaveLength(1);
    expect(collectTrick(collected.hand)).toBeNull();
  });
});

describe('a hand played to the end', () => {
  it('uses all fifty-two cards in thirteen tricks and leaves every hand empty', () => {
    const state = playOut(startOfPlay(dealHand('hearts-conservation', 4).hands));
    expect(state.phase).toBe('over');
    expect(state.tricks).toHaveLength(TRICKS_PER_HAND);
    for (const seat of SEATS) expect(state.hands[seat]).toHaveLength(0);
    expect(state.tricks.flatMap((trick) => [...trick.cards])).toHaveLength(CARD_COUNT);
    expectFiftyTwoCards(state);
    expect(legalPlays(state)).toEqual([]);
  });

  it('shares out exactly twenty-six points, whatever the deal', () => {
    for (const seed of ['hearts-a', 'hearts-b', 'hearts-c', 'hearts-d']) {
      const outcome = scoreHand(playOut(startOfPlay(dealHand(seed, 4).hands)))!;
      expect(outcome.taken.reduce((a, b) => a + b, 0)).toBe(HAND_PENALTY_TOTAL);
    }
  });

  it('has no score to give while it is still being played', () => {
    const hand = startOfPlay(dealHand('hearts-unfinished', 4).hands);
    expect(scoreHand(hand)).toBeNull();
    expect(scoreHand(play(hand, [TWO_OF_CLUBS]))).toBeNull();
  });
});

describe('scoring', () => {
  /**
   * A hand scripted card by card. Seat 0 takes the queen on the second trick
   * and never wins another, so it finishes on exactly thirteen — half the pot,
   * and nothing like a moon.
   */
  const queenOnly = () => {
    const hands = deal({
      0: cards('SA S2 S3 C3 C4 C5 D2 D3 D4 H2 H3 H4 H5'),
      1: cards('SQ S4 S5 C6 C7 C8 D5 D6 D7 H6 H7 H8 H9'),
      2: cards('C2 CA C9 SK S6 S7 D8 D9 DT HT HJ HQ HA'),
      3: cards('CT CJ CQ CK S8 S9 ST SJ DJ DQ DK DA HK'),
    });
    const script = cards(
      // trick 1 (seat 2 leads the two of clubs)   trick 2 (seat 3 leads)
      'C2 CT C3 C6   S8 SA SQ S6   ' +
        // trick 3 (seat 0)      trick 4 (seat 2)      trick 5 (seat 2)
        'S2 S4 SK S9   CA CJ C4 C7   C9 CQ C5 C8   ' +
        // trick 6 (seat 3)      trick 7 (seat 3)      trick 8 (seat 3)
        'CK H2 H6 HT   ST S3 S5 S7   SJ H3 H7 HJ   ' +
        // tricks 9-11 (seat 3)
        'DJ D2 D5 D8   DQ D3 D6 D9   DK D4 D7 DT   ' +
        // trick 12 (seat 3)     trick 13 (seat 3)
        'DA H4 H8 HQ   HK H5 H9 HA',
    );
    return play(startOfPlay(hands), script);
  };

  it('gives every seat what its tricks cost', () => {
    const state = queenOnly();
    const outcome = scoreHand(state)!;
    expect(outcome.taken).toEqual([13, 0, 4, 9]);
    expect(outcome.taken.reduce((a, b) => a + b, 0)).toBe(HAND_PENALTY_TOTAL);
    expect(outcome.delta).toEqual(outcome.taken);
    expect(outcome.taken).toEqual(penaltiesTakenIn(state));
  });

  it('does not call thirteen a sweep — the queen alone is half the pot', () => {
    const outcome = scoreHand(queenOnly())!;
    expect(outcome.taken[0]).toBe(13);
    expect(outcome.moonShooter).toBeNull();
    expect(outcome.delta[0]).toBe(13);
  });

  it('turns a sweep into twenty-six for everybody else', () => {
    // Seat 0 holds every club, so the other three are void in the suit it
    // leads from the first trick to the last: it takes all thirteen tricks,
    // and with them all thirteen hearts and the queen.
    const hands = deal({
      0: cards('C2 C3 C4 C5 C6 C7 C8 C9 CT CJ CQ CK CA'),
      1: cards('S2 S3 S4 S5 S6 S7 S8 S9 ST SJ SQ SK SA'),
      2: cards('H2 H3 H4 H5 H6 H7 H8 H9 HT HJ HQ HK HA'),
      3: cards('D2 D3 D4 D5 D6 D7 D8 D9 DT DJ DQ DK DA'),
    });
    const state = playOut(startOfPlay(hands));
    const outcome = scoreHand(state)!;
    expect(outcome.taken).toEqual([HAND_PENALTY_TOTAL, 0, 0, 0]);
    expect(outcome.moonShooter).toBe(0);
    expect(outcome.delta).toEqual([0, HAND_PENALTY_TOTAL, HAND_PENALTY_TOTAL, HAND_PENALTY_TOTAL]);
  });
});

describe('what a hand may not look like', () => {
  const dealt = dealHand('hearts-valid', 1);
  const playing = startOfPlay(deal({ 0: cards('C2 C3 C4 C5 C6') }));

  it('accepts the positions the engine produces', () => {
    expect(isValidHand(dealt)).toBe(true);
    expect(isValidHand(playing)).toBe(true);
    expect(isValidHand(play(playing, [TWO_OF_CLUBS]))).toBe(true);
    expect(isValidHand(playOut(playing))).toBe(true);
  });

  it('refuses a deck that does not add up to fifty-two', () => {
    expect(
      isValidHand({
        ...dealt,
        hands: bySeat<readonly Card[]>((seat) =>
          seat === 0 ? dealt.hands[0].slice(1) : dealt.hands[seat],
        ),
      }),
    ).toBe(false);
    expect(
      isValidHand({
        ...dealt,
        hands: bySeat<readonly Card[]>((seat) =>
          seat === 0
            ? sortedCards([...dealt.hands[0].slice(1), dealt.hands[1][0]!])
            : dealt.hands[seat],
        ),
      }),
    ).toBe(false);
  });

  it('refuses a hand that is not in canonical order', () => {
    expect(
      isValidHand({
        ...dealt,
        hands: bySeat<readonly Card[]>((seat) =>
          seat === 0 ? [...dealt.hands[0]].reverse() : dealt.hands[seat],
        ),
      }),
    ).toBe(false);
  });

  it('refuses a pass that does not fit its own phase', () => {
    // Nobody passes on the fourth hand, so a passing phase there never was.
    expect(isValidHand({ ...dealt, passOffset: 0 })).toBe(false);
    // Four confirmations resolve the exchange; a hand still passing with four
    // of them skipped its own transition.
    expect(isValidHand({ ...dealt, confirmed: [true, true, true, true] })).toBe(false);
    // A confirmation with no three cards behind it.
    expect(isValidHand({ ...dealt, confirmed: [true, false, false, false] })).toBe(false);
    // A card picked out that the seat is not holding.
    expect(
      isValidHand({
        ...dealt,
        selected: bySeat<readonly Card[]>((seat) => (seat === 0 ? [dealt.hands[1][0]!] : [])),
      }),
    ).toBe(false);
    // Cards still picked out once the tricks have started.
    expect(
      isValidHand({
        ...playing,
        selected: bySeat<readonly Card[]>((seat) => (seat === 0 ? [playing.hands[0][0]!] : [])),
      }),
    ).toBe(false);
  });

  it('refuses a trick nobody could have played', () => {
    const opened = play(playing, [TWO_OF_CLUBS]);
    // The opening lead has to be the two of clubs.
    expect(
      isValidHand({
        ...playing,
        hands: bySeat<readonly Card[]>((seat) =>
          seat === YOU
            ? playing.hands[YOU].filter((held) => held !== card('C3'))
            : playing.hands[seat],
        ),
        played: [card('C3')],
      }),
    ).toBe(false);
    // A break claimed with no heart played.
    expect(isValidHand({ ...opened, heartsBroken: true })).toBe(false);
    // A leader who did not take the previous trick.
    expect(isValidHand({ ...opened, leader: ((opened.leader + 1) % 4) as Seat })).toBe(false);
  });

  it('refuses a trick with a suit that was not followed', () => {
    // Seat 1 holds clubs but throws a diamond onto the opening trick.
    const hand = startOfPlay(deal({ 0: cards('C2'), 1: cards('C7 D7') }));
    const opened = play(hand, [TWO_OF_CLUBS]);
    const cheated: HandState = {
      ...opened,
      hands: bySeat<readonly Card[]>((seat) =>
        seat === 1 ? opened.hands[1].filter((held) => held !== card('D7')) : opened.hands[seat],
      ),
      played: [TWO_OF_CLUBS, card('D7')],
    };
    expect(sortedCards(allCards(cheated))).toHaveLength(CARD_COUNT);
    expect(isValidHand(cheated)).toBe(false);
  });

  it('refuses a finished hand that is not finished, and the other way round', () => {
    expect(isValidHand({ ...playing, phase: 'over' })).toBe(false);
    const finished = playOut(startOfPlay(dealHand('hearts-finish', 4).hands));
    expect(isValidHand(finished)).toBe(true);
    expect(isValidHand({ ...finished, phase: 'playing' })).toBe(false);
  });

  it('refuses a phase that is not a phase, and a seat that is not a seat', () => {
    expect(isValidHand({ ...dealt, phase: 'shuffling' as HandState['phase'] })).toBe(false);
    expect(isValidHand({ ...playing, leader: 7 as Seat })).toBe(false);
    expect(isValidHand({ ...dealt, passOffset: 9 as PassOffset })).toBe(false);
  });

  it('knows a heart from a card that only looks like one', () => {
    expect(isHeart(card('HA'))).toBe(true);
    expect(suitOf(card('HA'))).toBe(HEARTS);
    expect(isHeart(QUEEN_OF_SPADES)).toBe(false);
  });
});
