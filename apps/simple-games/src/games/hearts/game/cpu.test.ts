/**
 * What the opponents are, and — the part this title exists to make checkable —
 * what they can see.
 *
 * The first describe block is the contract: the view handed to a CPU seat is
 * re-derived from a hand whose every card it is not entitled to has been
 * changed, and it has to come out identical, as does the card it plays. If a
 * CPU seat could see the player's hand, or the three cards somebody is about
 * to pass, those tests fail; there is no way to pass them by accident.
 *
 * The rest is the ordinary opponent's-behaviour set: legal at every strength,
 * the same answer for the same view and the same tie-break, and the plays the
 * rules of thumb promise actually made.
 */
import { describe, expect, it } from 'vitest';
import {
  cardOf,
  CLUBS,
  isHeart,
  QUEEN_OF_SPADES,
  RANK_ACE,
  RANKS,
  rankOf,
  sortedCards,
  suitOf,
  TWO_OF_CLUBS,
  type Card,
  type Suit,
} from './cards';
import {
  buildCpuView,
  chooseCpuAction,
  chooseCpuPass,
  chooseCpuPlay,
  knowledgeOf,
  legalPlaysFor,
  moonThreatOf,
  winningSeatOf,
  type CpuView,
  type PublicTrick,
} from './cpu';
import {
  collectTrick,
  dealHand,
  isValidHand,
  legalPlays,
  playCard,
  selectPassCard,
} from './engine';
import { createRng, shuffled } from './rng';
import {
  bySeat,
  DIFFICULTIES,
  HAND_SIZE,
  PASS_SIZE,
  seatAt,
  SEAT_COUNT,
  SEATS,
  seatToPlay,
  YOU,
  type BySeat,
  type HandState,
} from './types';

const SUIT_LETTERS = 'SHDC';
const RANK_LETTERS = '23456789TJQKA';

function card(text: string): Card {
  const suit = SUIT_LETTERS.indexOf(text[0]!) as Suit;
  const rank = RANK_LETTERS.indexOf(text[1]!) + 1;
  if (suit < 0 || rank < 1) throw new Error(`not a card: ${text}`);
  return cardOf(suit, rank);
}
const cards = (text: string): Card[] => text.split(/\s+/).filter(Boolean).map(card);

const NO_SCORES: BySeat<number> = [0, 0, 0, 0];

/**
 * One finished trick of high clubs, so a fixture is mid-hand by default rather
 * than sitting on the opening trick where the two of clubs is the only legal
 * card. Clubs are never points and never the queen, so the filler disturbs
 * nothing any test below is about; a test that wants the opening trick asks
 * for `tricks: []`.
 */
function fillerTrick(held: readonly Card[]): PublicTrick {
  const chosen: Card[] = [];
  for (let rank = RANKS; rank >= 1 && chosen.length < SEAT_COUNT; rank--) {
    const club = cardOf(CLUBS, rank);
    if (!held.includes(club)) chosen.push(club);
  }
  return { leader: 0, cards: chosen, winner: 0 };
}

/**
 * A view built from parts, for testing one decision at a time. The seat and
 * the turn follow from the trick unless a test says otherwise, so a fixture
 * only has to say who led and what has landed.
 */
function viewOf(options: Partial<CpuView> & { hand: readonly Card[] }): CpuView {
  const hand = sortedCards(options.hand);
  const trickLeader = options.trickLeader ?? 0;
  const trickCards = options.trickCards ?? [];
  const toPlay = trickCards.length >= SEAT_COUNT ? null : seatAt(trickLeader, trickCards.length);
  return {
    seat: toPlay ?? 0,
    difficulty: 'normal',
    phase: 'playing',
    passOffset: 1,
    passSelection: [],
    tricks: [fillerTrick(hand)],
    heartsBroken: true,
    scores: NO_SCORES,
    taken: NO_SCORES,
    ...options,
    turn: 'turn' in options ? options.turn! : toPlay,
    trickLeader,
    trickCards,
    hand,
  };
}

describe('what a CPU seat is allowed to see', () => {
  const dealt = dealHand('hearts-view', 1);
  const view = buildCpuView(dealt, 2, 'hard', [10, 20, 30, 40]);

  it('is exactly these fields — and none of them is another seat’s hand', () => {
    // Written out so that adding a field to CpuView is a decision somebody
    // takes in this test, not a line that slips through in another one.
    expect(Object.keys(view).sort()).toEqual(
      [
        'difficulty',
        'hand',
        'heartsBroken',
        'passOffset',
        'passSelection',
        'phase',
        'scores',
        'seat',
        'taken',
        'trickCards',
        'trickLeader',
        'tricks',
        'turn',
      ].sort(),
    );
    // No seed reaches here either: the deal cannot be worked backwards.
    expect(Object.keys(view)).not.toContain('seed');
    expect(Object.keys(view)).not.toContain('hands');
    expect(chooseCpuAction).toHaveLength(2);
  });

  /**
   * The same deal with every card this seat cannot see replaced: the other
   * three hands are shuffled among themselves. Nothing seat 2 is entitled to
   * has moved, so nothing about its view may move either.
   */
  const reDealt = (salt: string): HandState => {
    const others = shuffled(
      [...dealt.hands[0], ...dealt.hands[1], ...dealt.hands[3]],
      createRng(salt),
    );
    return {
      ...dealt,
      hands: bySeat<readonly Card[]>((seat) => {
        if (seat === 2) return dealt.hands[2];
        const at = seat === 0 ? 0 : seat === 1 ? HAND_SIZE : HAND_SIZE * 2;
        return sortedCards(others.slice(at, at + HAND_SIZE));
      }),
    };
  };

  it('does not move when every hidden card is changed', () => {
    const other = reDealt('hearts-view-reshuffle');
    expect(isValidHand(other)).toBe(true);
    expect(other.hands[YOU]).not.toEqual(dealt.hands[YOU]);
    expect(other.hands[1]).not.toEqual(dealt.hands[1]);
    expect(buildCpuView(other, 2, 'hard', [10, 20, 30, 40])).toEqual(view);
  });

  it('and neither does what the seat plays', () => {
    for (const salt of ['a', 'b', 'c']) {
      const other = reDealt(`hearts-view-${salt}`);
      for (const difficulty of DIFFICULTIES) {
        expect(chooseCpuAction(buildCpuView(other, 2, difficulty, NO_SCORES), 0.5)).toEqual(
          chooseCpuAction(buildCpuView(dealt, 2, difficulty, NO_SCORES), 0.5),
        );
      }
    }
  });

  it('cannot see what anybody else has picked out to pass', () => {
    const withPicks = SEATS.filter((seat) => seat !== 2).reduce<HandState>(
      (hand, seat) => selectPassCard(hand, seat, hand.hands[seat][0]!)!,
      dealt,
    );
    expect(withPicks.selected[YOU]).toHaveLength(1);
    expect(buildCpuView(withPicks, 2, 'hard', NO_SCORES)).toEqual(
      buildCpuView(dealt, 2, 'hard', NO_SCORES),
    );
    // Its own picks it does see.
    const own = selectPassCard(dealt, 2, dealt.hands[2][0]!)!;
    expect(buildCpuView(own, 2, 'hard', NO_SCORES).passSelection).toEqual([dealt.hands[2][0]!]);
  });

  it('copies rather than shares, so a view cannot be walked back to the hand', () => {
    expect(view.hand).not.toBe(dealt.hands[2]);
    expect(view.trickCards).not.toBe(dealt.played);
    expect(view.passSelection).not.toBe(dealt.selected[2]);
  });

  it('reads the scores against the seat it was built for', () => {
    expect(view.scores).toEqual([10, 20, 30, 40]);
    expect(view.seat).toBe(2);
    expect(buildCpuView(dealt, 0, 'hard', [10, 20, 30, 40]).hand).toEqual(dealt.hands[0]);
  });
});

describe('reading the public record', () => {
  it('remembers every card played and works out what is still out there', () => {
    const knowledge = knowledgeOf(
      viewOf({
        hand: cards('S2 S3 H2'),
        tricks: [{ leader: 0, cards: cards('C2 CA CK CQ'), winner: 1 }],
        trickLeader: 1,
        trickCards: cards('D2 D3'),
      }),
    );
    expect(knowledge.played.has(card('CA'))).toBe(true);
    expect(knowledge.played.has(card('D3'))).toBe(true);
    expect(knowledge.unseen.has(card('CA'))).toBe(false);
    expect(knowledge.unseen.has(card('S2'))).toBe(false); // its own card
    expect(knowledge.unseen.has(card('SA'))).toBe(true);
    expect(knowledge.queenGone).toBe(false);
  });

  it('notices a seat that could not follow, which is how a void becomes public', () => {
    const knowledge = knowledgeOf(
      viewOf({
        hand: cards('S2 S3'),
        // Seat 0 led clubs; seat 2 threw a diamond, so seat 2 has no clubs.
        tricks: [{ leader: 0, cards: cards('C2 C5 D9 CQ'), winner: 3 }],
      }),
    );
    expect([...knowledge.voids[2]]).toEqual([3]);
    expect([...knowledge.voids[1]]).toEqual([]);
    expect([...knowledge.voids[0]]).toEqual([]);
  });

  it('knows the queen once she is down', () => {
    expect(
      knowledgeOf(viewOf({ hand: cards('S2'), trickCards: [QUEEN_OF_SPADES], trickLeader: 0 }))
        .queenGone,
    ).toBe(true);
  });

  it('sees who is on top of the trick right now', () => {
    const view = viewOf({ hand: cards('S2'), trickLeader: 3, trickCards: cards('D5 DK D9') });
    expect(winningSeatOf(view)).toBe(0);
    expect(winningSeatOf(viewOf({ hand: cards('S2'), trickCards: [] }))).toBeNull();
  });
});

describe('every strength plays by the rules', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`${difficulty} answers the same view the same way`, () => {
      const view = viewOf({
        difficulty,
        hand: cards('SA SQ S2 H5 H9 D3 DT C4 CJ'),
        trickLeader: 0,
        trickCards: cards('D6'),
      });
      expect(chooseCpuPlay(view, 0.25)).toEqual(chooseCpuPlay(view, 0.25));
      expect(chooseCpuPlay(view, 0.9)).toEqual(chooseCpuPlay(view, 0.9));
      expect(chooseCpuAction(view, 0.5)).toEqual(chooseCpuAction(view, 0.5));
    });

    it(`${difficulty} only ever names a legal card`, () => {
      const view = viewOf({
        difficulty,
        hand: cards('SA SQ S2 H5 H9 D3 DT C4 CJ'),
        trickLeader: 0,
        trickCards: cards('D6'),
      });
      for (const tieBreak of [0, 0.33, 0.67, 0.99]) {
        expect(legalPlaysFor(view)).toContain(chooseCpuPlay(view, tieBreak)!);
      }
    });

    it(`${difficulty} plays a whole hand out without an illegal move`, () => {
      let state = dealHand(`hearts-cpu-${difficulty}`, 4);
      let guard = 0;
      while (state.phase !== 'over' && guard < 60) {
        const seat = seatToPlay(state)!;
        const view = buildCpuView(state, seat, difficulty, NO_SCORES);
        const action = chooseCpuAction(view, createRng(`tie-${guard}`)())!;
        expect(action.kind).toBe('play');
        const next = playCard(state, action.kind === 'play' ? action.card : -1);
        expect(next).not.toBeNull();
        const collected = collectTrick(next!);
        state = collected === null ? next! : collected.hand;
        expect(isValidHand(state)).toBe(true);
        guard += 1;
      }
      expect(state.phase).toBe('over');
    });

    it(`${difficulty} passes exactly three cards it is holding`, () => {
      const dealt = dealHand(`hearts-pass-${difficulty}`, 1);
      for (const seat of SEATS) {
        const view = buildCpuView(dealt, seat, difficulty, NO_SCORES);
        const action = chooseCpuAction(view, 0.5)!;
        expect(action.kind).toBe('pass');
        const chosen = action.kind === 'pass' ? action.cards : [];
        expect(chosen).toHaveLength(PASS_SIZE);
        expect(new Set(chosen).size).toBe(PASS_SIZE);
        for (const held of chosen) expect(dealt.hands[seat]).toContain(held);
        expect(chooseCpuPass(view, 0.5)).toEqual([...chosen]);
      }
    });

    it(`${difficulty} has nothing to pass on the hand nobody passes`, () => {
      const fourth = dealHand(`hearts-none-${difficulty}`, 4);
      const view = { ...buildCpuView(fourth, 1, difficulty, NO_SCORES), phase: 'passing' as const };
      expect(chooseCpuAction(view, 0.5)).toBeNull();
    });
  }
});

describe('the pass says what each strength is', () => {
  const holding = cards('SQ SK SA S2 H2 HA D3 D4 C5 C6 C7 C8 C9');

  it('normal and hard give the queen and her escorts away; easy just throws big cards', () => {
    const normal = chooseCpuPass(viewOf({ difficulty: 'normal', hand: holding }), 0.5);
    expect(normal).toEqual(sortedCards(cards('SQ SK SA')));
    const hard = chooseCpuPass(viewOf({ difficulty: 'hard', hand: holding }), 0.5);
    expect(hard).toContain(QUEEN_OF_SPADES);
    // Easy knows only that a king is bigger than a five.
    const easy = chooseCpuPass(viewOf({ difficulty: 'easy', hand: holding }), 0.5);
    expect(easy).toEqual(sortedCards(cards('SA SK HA')));
  });

  it('keeps the ace and king when there are small spades enough to hide behind', () => {
    // Six spades: the ace and king are ordinary big cards, and the three high
    // hearts go instead.
    const covered = cards('SA SK S2 S3 S4 S5 HA HK HQ D2 D3 C2 C3');
    const kept = chooseCpuPass(viewOf({ difficulty: 'normal', hand: covered }), 0.5);
    expect(kept).toEqual(sortedCards(cards('HA HK HQ')));
    // Three spades: nothing to hide behind, and the same two cards become the
    // most urgent things in the hand.
    const exposed = cards('SA SK S2 HA HK HQ D2 D3 D4 C2 C3 C4 C5');
    const given = chooseCpuPass(viewOf({ difficulty: 'normal', hand: exposed }), 0.5);
    expect(given).toContain(card('SA'));
    expect(given).toContain(card('SK'));
  });

  it('hard shortens a suit it could get out of; normal does not look', () => {
    // Two diamonds and nothing else worth passing: emptying the suit is worth
    // more than the ranks say, and only hard prices it.
    const shortable = cards('S2 S3 S4 S5 S6 H2 H3 H4 D2 D3 C2 C3 C4');
    const hard = chooseCpuPass(viewOf({ difficulty: 'hard', hand: shortable }), 0.5);
    expect(hard).toContain(card('D2'));
    expect(hard).toContain(card('D3'));
    const normal = chooseCpuPass(viewOf({ difficulty: 'normal', hand: shortable }), 0.5);
    expect(normal).not.toEqual(hard);
  });

  it('is settled by the coin only where the cards are genuinely level', () => {
    const level = cards('S2 S3 S4 H2 H3 H4 D2 D3 D4 C2 C3 C4 C5');
    const view = viewOf({ difficulty: 'easy', hand: level });
    const first = chooseCpuPass(view, 0);
    const second = chooseCpuPass(view, 0.99);
    expect(first).toHaveLength(PASS_SIZE);
    expect(second).toHaveLength(PASS_SIZE);
    expect(chooseCpuPass(view, 0)).toEqual(first);
    expect(chooseCpuPass(view, 0.99)).toEqual(second);
  });
});

describe('the plays the rules of thumb promise', () => {
  it('follows suit whenever it holds the suit led — every strength, every time', () => {
    const holding = cards('SA SQ S2 H5 H9 D3 DT C4 CJ');
    for (const difficulty of DIFFICULTIES) {
      const view = viewOf({
        difficulty,
        hand: holding,
        trickLeader: 0,
        trickCards: cards('D6'),
      });
      const played = chooseCpuPlay(view, 0.5)!;
      expect(suitOf(played)).toBe(suitOf(card('D6')));
    }
  });

  it('ducks under the card that is winning rather than taking the trick', () => {
    const view = viewOf({
      hand: cards('D2 D5 DJ DA H4'),
      trickLeader: 0,
      trickCards: cards('D9'),
    });
    // The jack and ace both take it; the five is the biggest card that does not.
    expect(chooseCpuPlay(view, 0.5)).toBe(card('D5'));
  });

  it('drops the queen of spades the moment she is safe to drop', () => {
    // A bigger spade is already on the trick, so she lands on somebody else.
    const under = viewOf({
      hand: cards('SQ S2 S9 H4 D3'),
      trickLeader: 0,
      trickCards: cards('SA'),
    });
    expect(chooseCpuPlay(under, 0.5)).toBe(QUEEN_OF_SPADES);
    // Void in the suit led, she is the first thing to throw.
    const discarding = viewOf({
      hand: cards('SQ S2 S9 HA D3'),
      trickLeader: 0,
      trickCards: cards('C7 CK'),
    });
    expect(chooseCpuPlay(discarding, 0.5)).toBe(QUEEN_OF_SPADES);
  });

  it('does not play the queen when she would take the trick herself', () => {
    // Only spades to play, and the trick is headed by a small one: the queen
    // would win it and cost thirteen.
    const view = viewOf({
      hand: cards('SQ SK SA'),
      trickLeader: 0,
      trickCards: cards('S2'),
    });
    expect(chooseCpuPlay(view, 0.5)).not.toBe(QUEEN_OF_SPADES);
  });

  it('leads a small card rather than a big one, unlike easy', () => {
    const holding = cards('S2 SA D3 DK C4 CA');
    const normal = viewOf({ difficulty: 'normal', hand: holding, trickLeader: 1 });
    expect(chooseCpuPlay(normal, 0.5)).toBe(card('S2'));
    // Easy leads an ace — which one is the only thing the coin decides.
    const easy = viewOf({ difficulty: 'easy', hand: holding, trickLeader: 1 });
    expect(rankOf(chooseCpuPlay(easy, 0.5)!)).toBe(RANK_ACE);
    expect(chooseCpuPlay(easy, 0)).toBe(card('SA'));
  });

  it('will not lead a heart before the break, and takes the option once it is broken', () => {
    const held = cards('H2 H3 D9 DT');
    const closed = viewOf({ hand: held, trickLeader: 1, heartsBroken: false });
    expect(legalPlaysFor(closed)).toEqual(cards('D9 DT'));
    expect(isHeart(chooseCpuPlay(closed, 0.5)!)).toBe(false);
    const open = viewOf({ hand: held, trickLeader: 1, heartsBroken: true });
    expect(legalPlaysFor(open)).toHaveLength(4);
  });

  it('plays the two of clubs when the two of clubs is the only card there is', () => {
    for (const difficulty of DIFFICULTIES) {
      const view = viewOf({
        difficulty,
        hand: cards('C2 CA SA HA'),
        trickLeader: 1,
        tricks: [],
        heartsBroken: false,
      });
      expect(chooseCpuPlay(view, 0.5)).toBe(TWO_OF_CLUBS);
    }
  });
});

describe('the moon', () => {
  const shooting: BySeat<number> = [0, 0, 20, 0];

  it('is spotted when one seat has taken every point there is', () => {
    expect(moonThreatOf(viewOf({ hand: cards('S2'), taken: shooting }))).toBe(2);
    // Not when the points are spread about.
    expect(moonThreatOf(viewOf({ hand: cards('S2'), taken: [3, 0, 20, 0] }))).toBeNull();
    // Not early, when one unlucky trick looks the same as a plan.
    expect(moonThreatOf(viewOf({ hand: cards('S2'), taken: [0, 0, 5, 0] }))).toBeNull();
    // And never itself: this CPU does not shoot, it only blocks.
    expect(moonThreatOf(viewOf({ seat: 2, hand: cards('S2'), taken: shooting }))).toBeNull();
  });

  it('is taken off the shooter by hard, and ignored by the others', () => {
    const base = {
      hand: cards('D2 D5 DA H4'),
      trickLeader: 2,
      trickCards: cards('DK'),
      taken: shooting,
    } as const;
    // Seat 2 is on top with the king; the ace is the only card that takes it
    // off them, and only hard reaches for it.
    expect(chooseCpuPlay(viewOf({ ...base, difficulty: 'hard' }), 0.5)).toBe(card('DA'));
    expect(chooseCpuPlay(viewOf({ ...base, difficulty: 'normal' }), 0.5)).toBe(card('D5'));
    // With the points spread about, hard ducks like everybody else.
    expect(chooseCpuPlay(viewOf({ ...base, difficulty: 'hard', taken: [3, 0, 20, 0] }), 0.5)).toBe(
      card('D5'),
    );
  });

  it('is never fed a point while it is on top of a trick', () => {
    // Seat 2 is on top of the trick and shooting; seat 3 is void in clubs, so
    // anything may go — but not a heart and not the queen, either of which
    // would be twenty-six for everybody else.
    const view = viewOf({
      difficulty: 'hard',
      hand: cards('HA H2 SQ D4'),
      trickLeader: 1,
      trickCards: cards('C7 CK'),
      taken: shooting,
    });
    expect(view.seat).toBe(3);
    expect(winningSeatOf(view)).toBe(2);
    expect(chooseCpuPlay(view, 0.5)).toBe(card('D4'));
    // Without a moon on, the queen is exactly what goes.
    expect(chooseCpuPlay({ ...view, taken: NO_SCORES }, 0.5)).toBe(QUEEN_OF_SPADES);
  });
});

describe('turns it has nothing to do with', () => {
  it('names no card when it is not this seat’s turn', () => {
    const view = viewOf({ seat: 1, hand: cards('S2 S3'), turn: 2 });
    expect(legalPlaysFor(view)).toEqual([]);
    expect(chooseCpuPlay(view, 0.5)).toBeNull();
  });

  it('names no card once the hand is over', () => {
    expect(chooseCpuAction(viewOf({ hand: [], phase: 'over', turn: null }), 0.5)).toBeNull();
  });

  it('names no card while a finished trick waits to be collected', () => {
    const view = viewOf({
      hand: cards('S2 S3'),
      trickLeader: 2,
      trickCards: cards('C2 C3 C4 C5'),
      turn: null,
    });
    expect(chooseCpuPlay(view, 0.5)).toBeNull();
  });

  it('agrees with the engine about what is legal, from a hand it cannot see', () => {
    let state = dealHand('hearts-agree', 4);
    let guard = 0;
    while (state.phase !== 'over' && guard++ < 60) {
      const seat = seatToPlay(state)!;
      const view = buildCpuView(state, seat, 'hard', NO_SCORES);
      expect(legalPlaysFor(view)).toEqual(legalPlays(state));
      const next = playCard(state, legalPlays(state)[0]!)!;
      const collected = collectTrick(next);
      state = collected === null ? next : collected.hand;
    }
    expect(state.phase).toBe('over');
  });
});
