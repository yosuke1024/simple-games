/**
 * One hand of Gin Rummy, rule by rule: who gets first refusal on the upcard,
 * what may and may not be put down, where the knock limit falls, and how the
 * settlement divides the points.
 *
 * Hands are built card by card rather than played into, because the positions
 * that matter — a knock at exactly ten, a defender who ends level — are ones a
 * seeded deal would take a thousand hands to produce. Every fixture goes
 * through `isValidHand` on the way in, so a test can never assert about a
 * position the game could not reach.
 */
import { describe, expect, it } from 'vitest';
import { cardOf, sortedCards, CARD_COUNT, type Card, type Suit } from './cards';
import {
  allCards,
  canDiscard,
  canKnock,
  dealHand,
  discardCard,
  drawFromDiscard,
  drawFromStock,
  knock,
  knockableDiscards,
  passUpcard,
  settleHand,
  takeUpcard,
} from './engine';
import { bestMeldPlan } from './melds';
import {
  CPU,
  HAND_SIZE,
  INITIAL_STOCK,
  isValidHand,
  opponentOf,
  topDiscard,
  YOU,
  type HandEnding,
  type HandState,
  type Phase,
  type Seat,
} from './types';

const SUIT_LETTERS = 'SHDC';
const RANK_LETTERS = 'A23456789TJQK';

function card(text: string): Card {
  const suit = SUIT_LETTERS.indexOf(text[0]!) as Suit;
  const rank = RANK_LETTERS.indexOf(text[1]!) + 1;
  if (suit < 0 || rank < 1) throw new Error(`not a card: ${text}`);
  return cardOf(suit, rank);
}
const hand = (text: string): Card[] => text.split(/\s+/).filter(Boolean).map(card);

interface HandSpec {
  readonly you: readonly Card[];
  readonly cpu: readonly Card[];
  readonly turn?: Seat;
  readonly dealer?: Seat;
  readonly phase?: Phase;
  readonly ending?: HandEnding;
  readonly stockSize?: number;
  /** The takeable card, or null for a pile whose top was just taken. */
  readonly upcard?: Card | null;
  readonly takenFromDiscard?: Card | null;
  readonly mustDrawStock?: boolean;
}

/**
 * A hand state built from the two holdings. Whatever the fixture does not name
 * goes into the stock and — once the stock is the size asked for — under the
 * discard pile, so all fifty-two cards are always accounted for.
 */
function buildHand(spec: HandSpec): HandState {
  const named = new Set<Card>([...spec.you, ...spec.cpu]);
  if (spec.upcard !== undefined && spec.upcard !== null) named.add(spec.upcard);
  const rest: Card[] = [];
  for (let value = 0; value < CARD_COUNT; value++) if (!named.has(value)) rest.push(value);

  const stockSize = spec.stockSize ?? 20;
  const stock = rest.slice(0, stockSize);
  const buried = rest.slice(stockSize);
  const upcard = spec.upcard === undefined ? buried.pop()! : spec.upcard;
  const discard = upcard === null ? buried : [...buried, upcard];

  const built: HandState = {
    dealer: spec.dealer ?? CPU,
    hands: [sortedCards(spec.you), sortedCards(spec.cpu)],
    stock,
    discard,
    turn: spec.turn ?? YOU,
    phase: spec.phase ?? 'discard',
    ending: spec.ending ?? 'none',
    takenFromDiscard: spec.takenFromDiscard ?? null,
    mustDrawStock: spec.mustDrawStock ?? false,
    log: [],
  };
  if (!isValidHand(built)) throw new Error('fixture is not a hand that could come from play');
  return built;
}

/** Every card, once, wherever it is. The invariant no move may break. */
function expectFiftyTwoCards(state: HandState): void {
  expect(sortedCards(allCards(state))).toEqual(Array.from({ length: CARD_COUNT }, (_, i) => i));
}

describe('the deal (10 each, the twenty-first face up)', () => {
  const dealt = dealHand('gin-deal', 1, CPU);

  it('gives ten cards each, turns one, and leaves the rest face down', () => {
    expect(dealt.hands[YOU]).toHaveLength(HAND_SIZE);
    expect(dealt.hands[CPU]).toHaveLength(HAND_SIZE);
    expect(dealt.discard).toHaveLength(1);
    expect(dealt.stock).toHaveLength(INITIAL_STOCK);
    expectFiftyTwoCards(dealt);
    expect(isValidHand(dealt)).toBe(true);
  });

  it('opens on the non-dealer, who has the first look at the upcard', () => {
    expect(dealt.phase).toBe('upcard');
    expect(dealt.turn).toBe(YOU);
    expect(dealt.dealer).toBe(CPU);
    expect(dealHand('gin-deal', 1, YOU).turn).toBe(CPU);
  });

  it('deals the same hand for the same seed and hand number, and a different one otherwise', () => {
    expect(dealHand('gin-deal', 1, CPU)).toEqual(dealt);
    expect(dealHand('gin-deal', 2, CPU).hands[YOU]).not.toEqual(dealt.hands[YOU]);
    expect(dealHand('gin-other', 1, CPU).hands[YOU]).not.toEqual(dealt.hands[YOU]);
  });

  it('records the turned card in the public log', () => {
    expect(dealt.log).toEqual([{ kind: 'upcard', card: topDiscard(dealt) }]);
  });
});

describe('first refusal on the upcard (non-dealer, then dealer, then the stock)', () => {
  const dealt = dealHand('gin-upcard', 1, CPU);

  it('passes the option to the dealer when the non-dealer refuses', () => {
    const passed = passUpcard(dealt)!;
    expect(passed.phase).toBe('upcard');
    expect(passed.turn).toBe(CPU);
    expect(passed.discard).toEqual(dealt.discard);
  });

  it('sends the non-dealer to the stock when both refuse, and locks the pile', () => {
    const both = passUpcard(passUpcard(dealt)!)!;
    expect(both.phase).toBe('draw');
    expect(both.turn).toBe(YOU);
    expect(both.mustDrawStock).toBe(true);
    // The refused card stays refused: it is not on offer for that draw.
    expect(drawFromDiscard(both)).toBeNull();

    const drawn = drawFromStock(both)!;
    expect(drawn.phase).toBe('discard');
    expect(drawn.hands[YOU]).toHaveLength(HAND_SIZE + 1);
    expect(drawn.mustDrawStock).toBe(false);
    expect(drawn.stock).toHaveLength(INITIAL_STOCK - 1);
    expectFiftyTwoCards(drawn);
  });

  it('takes the upcard straight into the discard step', () => {
    const upcard = topDiscard(dealt)!;
    const taken = takeUpcard(dealt)!;
    expect(taken.phase).toBe('discard');
    expect(taken.turn).toBe(YOU);
    expect(taken.hands[YOU]).toContain(upcard);
    expect(taken.discard).toHaveLength(0);
    expect(taken.takenFromDiscard).toBe(upcard);
    expect(taken.log[taken.log.length - 1]).toEqual({
      kind: 'draw-discard',
      seat: YOU,
      card: upcard,
    });
    expectFiftyTwoCards(taken);
  });

  it('has no upcard step left once a hand is under way', () => {
    const playing = passUpcard(passUpcard(dealt)!)!;
    expect(takeUpcard(playing)).toBeNull();
    expect(passUpcard(playing)).toBeNull();
  });
});

describe('a turn: draw, then put one down', () => {
  const eleven = hand('SA S2 S3 H5 H6 H7 D9 DT DJ CT CK');

  it('refuses to put back the card just taken off the pile', () => {
    const state = buildHand({
      you: eleven,
      cpu: hand('C2 C3 C4 D2 D3 D4 H2 H3 HQ HK'),
      takenFromDiscard: card('CK'),
      upcard: card('S9'),
    });
    expect(canDiscard(state, card('CK'))).toBe(false);
    expect(discardCard(state, card('CK'))).toBeNull();
    expect(knock(state, card('CK'))).toBeNull();
    // Everything else in the hand is fair game.
    expect(canDiscard(state, card('CT'))).toBe(true);
  });

  it('allows the card back down when it came off the stock instead', () => {
    const state = buildHand({
      you: eleven,
      cpu: hand('C2 C3 C4 D2 D3 D4 H2 H3 HQ HK'),
      takenFromDiscard: null,
      upcard: card('S9'),
    });
    expect(canDiscard(state, card('CK'))).toBe(true);
    const after = discardCard(state, card('CK'))!;
    expect(topDiscard(after)).toBe(card('CK'));
    expect(after.turn).toBe(CPU);
    expect(after.phase).toBe('draw');
    expectFiftyTwoCards(after);
  });

  it('refuses a card the seat does not hold', () => {
    const state = buildHand({
      you: eleven,
      cpu: hand('C2 C3 C4 D2 D3 D4 H2 H3 HQ HK'),
      upcard: card('S9'),
    });
    expect(discardCard(state, card('C2'))).toBeNull();
  });

  it('takes the pile top on an ordinary turn', () => {
    const state = buildHand({
      you: hand('SA S2 S3 H5 H6 H7 D9 DT DJ CT'),
      cpu: hand('C2 C3 C4 D2 D3 D4 H2 H3 HQ HK'),
      phase: 'draw',
      upcard: card('S4'),
    });
    const taken = drawFromDiscard(state)!;
    expect(taken.hands[YOU]).toContain(card('S4'));
    expect(taken.takenFromDiscard).toBe(card('S4'));
    expect(taken.phase).toBe('discard');
    expectFiftyTwoCards(taken);
  });
});

describe('the knock limit falls between ten and eleven', () => {
  it('allows a knock that leaves exactly ten', () => {
    // Three runs and a lone ten of clubs.
    const state = buildHand({
      you: hand('SA S2 S3 H5 H6 H7 D9 DT DJ CT SK'),
      cpu: hand('C2 C3 C4 D2 D3 D4 H2 H3 HQ HK'),
      upcard: card('S9'),
    });
    expect(bestMeldPlan(hand('SA S2 S3 H5 H6 H7 D9 DT DJ CT')).deadwoodValue).toBe(10);
    expect(canKnock(state, card('SK'))).toBe(true);
    const knocked = knock(state, card('SK'))!;
    expect(knocked.phase).toBe('over');
    expect(knocked.ending).toBe('knock');
    expect(knocked.turn).toBe(YOU);
    expectFiftyTwoCards(knocked);
  });

  it('refuses a knock that would leave eleven', () => {
    const eleven = hand('SA S2 S3 H5 H6 H7 CA D2 H3 C5');
    expect(bestMeldPlan(eleven).deadwoodValue).toBe(11);
    const state = buildHand({
      you: [...eleven, card('DK')],
      cpu: hand('C2 C3 C4 D3 D4 D5 H9 HT HQ HK'),
      upcard: card('S9'),
    });
    expect(canKnock(state, card('DK'))).toBe(false);
    expect(knock(state, card('DK'))).toBeNull();
    // And no other card in the hand gets under the limit either.
    expect(knockableDiscards(state)).toEqual([]);
  });
});

describe('settling a knock', () => {
  /** The knocker: three runs and the eight of clubs, so eight points. */
  const knocker = hand('SA S2 S3 H5 H6 H7 D9 DT DJ C8');

  const settled = (defender: readonly Card[], knockerCards: readonly Card[] = knocker) =>
    settleHand(
      buildHand({
        you: knockerCards,
        cpu: defender,
        phase: 'over',
        ending: 'knock',
        turn: YOU,
        stockSize: 5,
      }),
    );

  it('pays the difference when the knocker is ahead', () => {
    const outcome = settled(hand('C4 C5 C6 HT HJ HQ D5 D6 D7 SK'));
    expect(outcome.kind).toBe('knock');
    expect(outcome.winner).toBe(YOU);
    expect(outcome.knockerDeadwood).toBe(8);
    expect(outcome.defenderDeadwood).toBe(10);
    expect(outcome.points).toBe(2);
  });

  it('undercuts on a tie — level pegging goes to the defender, plus twenty-five', () => {
    const outcome = settled(hand('C4 C5 C6 HT HJ HQ D5 D6 D7 S8'));
    expect(outcome.knockerDeadwood).toBe(8);
    expect(outcome.defenderDeadwood).toBe(8);
    expect(outcome.kind).toBe('undercut');
    expect(outcome.winner).toBe(CPU);
    expect(outcome.points).toBe(25);
  });

  it('undercuts by the difference plus twenty-five when the defender is ahead', () => {
    const outcome = settled(hand('C4 C5 C6 HT HJ HQ D5 D6 D7 CA'));
    expect(outcome.kind).toBe('undercut');
    expect(outcome.winner).toBe(CPU);
    expect(outcome.defenderDeadwood).toBe(1);
    expect(outcome.points).toBe(8 - 1 + 25);
  });

  it('lets the defender lay off onto the knocker’s melds', () => {
    // The eight of hearts goes onto H5-H6-H7 and the defender is left with
    // nothing — which turns a two-point loss into a thirty-three point win.
    const outcome = settled(hand('C4 C5 C6 HT HJ HQ D5 D6 D7 H8'));
    expect(outcome.layoffs).toEqual([{ card: card('H8'), meldIndex: 1 }]);
    expect(outcome.defenderDeadwood).toBe(0);
    expect(outcome.kind).toBe('undercut');
    expect(outcome.points).toBe(8 + 25);
  });
});

describe('gin', () => {
  /** Ten cards, nothing left over: a four-card run and two threes. */
  const ginHand = hand('SA S2 S3 S4 H5 H6 H7 D9 DT DJ');
  const defender = hand('C4 C5 C6 HT HJ HQ D5 D6 D7 H8');

  const settled = () =>
    settleHand(
      buildHand({
        you: ginHand,
        cpu: defender,
        phase: 'over',
        ending: 'knock',
        turn: YOU,
        stockSize: 5,
      }),
    );

  it('pays the defender’s whole hand plus twenty-five', () => {
    const outcome = settled();
    expect(outcome.kind).toBe('gin');
    expect(outcome.winner).toBe(YOU);
    expect(outcome.knockerDeadwood).toBe(0);
    expect(outcome.defenderDeadwood).toBe(8);
    expect(outcome.points).toBe(8 + 25);
  });

  it('takes no lay-offs — the same eight that would have gone off stays put', () => {
    // The defender's hand is the one that laid the eight of hearts off in the
    // knock above. Against gin there is nowhere to put it.
    expect(settled().layoffs).toEqual([]);
    expect(settled().defenderDeadwood).toBe(8);
  });
});

describe('a hand that runs out', () => {
  it('dies when the stock reaches two, with nothing scored', () => {
    const state = buildHand({
      you: hand('SA S2 S3 H5 H6 H7 D9 DT DJ CT'),
      cpu: hand('C2 C3 C4 D2 D3 D4 H2 H3 HQ HK'),
      phase: 'draw',
      stockSize: 3,
      upcard: card('S9'),
    });
    const drawn = drawFromStock(state)!;
    expect(drawn.stock).toHaveLength(2);
    // The turn still finishes — the hand dies because the *next* one could
    // not begin.
    expect(drawn.phase).toBe('discard');

    const finished = discardCard(drawn, card('CT'))!;
    expect(finished.phase).toBe('over');
    expect(finished.ending).toBe('dead');
    expect(settleHand(finished)).toMatchObject({ kind: 'dead', winner: null, points: 0 });
    expectFiftyTwoCards(finished);
  });

  it('lets a knock land even on the very last draw', () => {
    const state = buildHand({
      you: hand('SA S2 S3 H5 H6 H7 D9 DT DJ CT SK'),
      cpu: hand('C2 C3 C4 D2 D3 D4 H2 H3 HQ HK'),
      stockSize: 2,
      upcard: card('S9'),
    });
    const knocked = knock(state, card('SK'))!;
    expect(knocked.ending).toBe('knock');
    expect(settleHand(knocked).kind).toBe('knock');
  });
});

describe('the fifty-two cards', () => {
  it('are all still there after a hand is played out', () => {
    // A crude but complete player: draw from the stock, put down the highest
    // card that is not the one just taken. It never knocks, so the hand runs
    // to the end of the stock — which is the longest a hand can be.
    let state = passUpcard(passUpcard(dealHand('gin-conservation', 3, YOU)!)!)!;
    let guard = 0;
    while (state.phase !== 'over' && guard++ < 200) {
      if (state.phase === 'draw') {
        state = drawFromStock(state)!;
      } else {
        const choice = [...state.hands[state.turn]]
          .reverse()
          .find((c) => c !== state.takenFromDiscard)!;
        state = discardCard(state, choice)!;
      }
      expectFiftyTwoCards(state);
      expect(isValidHand(state)).toBe(true);
    }
    expect(state.ending).toBe('dead');
    expect(state.stock).toHaveLength(2);
    // Both seats still hold ten, and the rest of the deck is on the pile.
    expect(state.hands[YOU]).toHaveLength(HAND_SIZE);
    expect(state.hands[opponentOf(YOU)]).toHaveLength(HAND_SIZE);
  });
});
