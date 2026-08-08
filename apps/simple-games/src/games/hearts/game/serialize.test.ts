/**
 * The saved hand comes back exactly, or it does not come back.
 *
 * Round-tripping is the easy half. The half that matters is the refusals: a
 * record that could not have come from play must decode to null so the loader
 * drops the save and goes home, rather than dealing the player into a position
 * where the fifty-two cards do not add up — or, worse, into a hand where
 * somebody has already broken a rule.
 */
import { describe, expect, it } from 'vitest';
import { cardOf, sortedCards, TWO_OF_CLUBS, type Card, type Suit } from './cards';
import {
  collectTrick,
  confirmPass,
  dealHand,
  legalPlays,
  playCard,
  selectPassCard,
} from './engine';
import { decodeHand, encodeHand } from './serialize';
import { bySeat, HAND_SIZE, SEATS, TRICKS_PER_HAND, YOU, type HandState } from './types';

const SUIT_LETTERS = 'SHDC';
const RANK_LETTERS = '23456789TJQKA';

function card(text: string): Card {
  const suit = SUIT_LETTERS.indexOf(text[0]!) as Suit;
  const rank = RANK_LETTERS.indexOf(text[1]!) + 1;
  if (suit < 0 || rank < 1) throw new Error(`not a card: ${text}`);
  return cardOf(suit, rank);
}

const dealt = dealHand('hearts-serialize', 1);

/** Plays one card, folding the trick away when it completes. */
function step(hand: HandState, next: Card): HandState {
  const played = playCard(hand, next)!;
  const collected = collectTrick(played);
  return collected === null ? played : collected.hand;
}

/** Plays the lowest legal card `count` times. */
function steps(hand: HandState, count: number): HandState {
  let state = hand;
  for (let taken = 0; taken < count && state.phase !== 'over'; taken++) {
    state = step(state, legalPlays(state)[0]!);
  }
  return state;
}

/** Everybody plays their lowest legal card until the hand is done. */
function playOut(hand: HandState): HandState {
  return steps(hand, 60);
}

/** The four seats pick their first three and commit them, in seat order. */
function afterThePass(hand: HandState): HandState {
  return SEATS.reduce<HandState>((state, seat) => {
    const picked = state.hands[seat]
      .slice(0, 3)
      .reduce<HandState>((inner, pick) => selectPassCard(inner, seat, pick)!, state);
    return confirmPass(picked, seat)!.hand;
  }, hand);
}

/** A few positions from one match, one per phase and one mid-trick. */
function positions(): HandState[] {
  const picked = SEATS.reduce<HandState>(
    (hand, seat) =>
      hand.hands[seat]
        .slice(0, 3)
        .reduce<HandState>((state, pick) => selectPassCard(state, seat, pick)!, hand),
    dealt,
  );
  const twoIn = confirmPass(confirmPass(picked, 0)!.hand, 1)!.hand;
  const playing = afterThePass(dealt);
  const opened = playCard(playing, TWO_OF_CLUBS)!;
  // Four cards on the table and none of them collected: a resting state of
  // its own, and the one the screen animates the fold from.
  const onTheTable = [1, 2, 3].reduce<HandState>(
    (hand) => playCard(hand, legalPlays(hand)[0]!)!,
    opened,
  );
  return [dealt, picked, twoIn, playing, opened, onTheTable, playOut(playing)];
}

describe('round trip', () => {
  it('gives back exactly the hand it was given, in every phase', () => {
    for (const state of positions()) {
      const text = encodeHand(state);
      expect(decodeHand(text)).toEqual(state);
      // And the text is stable: encoding twice cannot drift.
      expect(encodeHand(decodeHand(text)!)).toBe(text);
    }
  });

  it('keeps the tricks, which are the CPU’s whole memory of the hand', () => {
    const state = steps(afterThePass(dealt), 20);
    const restored = decodeHand(encodeHand(state))!;
    expect(restored.tricks).toEqual(state.tricks);
    expect(restored.tricks.length).toBeGreaterThan(3);
    expect(restored.heartsBroken).toBe(state.heartsBroken);
    expect(restored.leader).toBe(state.leader);
  });

  it('keeps a finished hand finished, with all thirteen tricks', () => {
    const finished = positions()[6]!;
    expect(finished.tricks).toHaveLength(TRICKS_PER_HAND);
    expect(decodeHand(encodeHand(finished))).toEqual(finished);
  });
});

describe('fails closed', () => {
  const valid = encodeHand(dealt);
  const rejects = (text: string) => expect(decodeHand(text)).toBeNull();
  const withField = (at: number, value: string, from = valid): string => {
    const fields = from.split('/');
    fields[at] = value;
    return fields.join('/');
  };

  it('rejects anything that is not the format', () => {
    rejects('');
    rejects(valid.slice(1));
    rejects(`${valid}/extra`);
    rejects(withField(0, '2'));
    rejects(valid.split('/').slice(1).join('/'));
  });

  it('rejects a card that is not a card', () => {
    const hand = valid.split('/')[2]!;
    rejects(withField(2, `zz${hand.slice(2)}`));
    // 52 in base 36 is '1g' — one past the end of the deck.
    rejects(withField(2, `1g${hand.slice(2)}`));
    // An odd number of digits cannot be whole cards.
    rejects(withField(2, `${hand}0`));
    // Upper case is not what the encoder writes.
    rejects(withField(2, `1F${hand.slice(2)}`));
  });

  it('rejects a deck that does not add up to fifty-two', () => {
    const fields = valid.split('/');
    // A card in two hands at once.
    rejects(withField(2, fields[3]!.slice(0, 2) + fields[2]!.slice(2)));
    // A card missing entirely.
    rejects(withField(2, fields[2]!.slice(2)));
  });

  it('rejects a hand that is not in canonical order', () => {
    const hand = valid.split('/')[2]!;
    const reversed = hand.match(/../g)!.reverse().join('');
    expect(reversed).not.toBe(hand);
    rejects(withField(2, reversed));
  });

  it('rejects flags that belong to another phase', () => {
    // Nobody passes on the fourth hand, so a passing phase there never was.
    rejects(withField(1, `0${valid.split('/')[1]!.slice(1)}`));
    // Four confirmations resolve the exchange rather than sitting there.
    rejects(withField(1, `${valid.split('/')[1]!.slice(0, 4)}1111`));
    // A confirmation with no three cards behind it.
    rejects(withField(1, `${valid.split('/')[1]!.slice(0, 4)}1000`));
    // Hearts broken before a card has been played.
    rejects(withField(1, `${valid.split('/')[1]!.slice(0, 3)}1${valid.split('/')[1]!.slice(4)}`));
  });

  it('rejects a phase, a seat or an offset that is not one', () => {
    rejects(withField(1, `1?${valid.split('/')[1]!.slice(2)}`));
    rejects(withField(1, `1p4${valid.split('/')[1]!.slice(3)}`));
    rejects(withField(1, `9${valid.split('/')[1]!.slice(1)}`));
    rejects(withField(1, valid.split('/')[1]!.slice(1)));
  });

  it('rejects a pass selection the seat is not holding', () => {
    const fields = valid.split('/');
    rejects(withField(6, fields[3]!.slice(0, 2)));
    // …and one that is longer than a pass.
    rejects(withField(6, fields[2]!.slice(0, 8)));
  });

  it('rejects a trick that is not four cards, or a leader that is not a seat', () => {
    const state = steps(afterThePass(dealt), 4);
    const text = encodeHand(state);
    expect(decodeHand(text)).toEqual(state);

    const tricks = text.split('/')[11]!;
    expect(tricks).toHaveLength(9);
    rejects(withField(11, tricks.slice(0, -2), text));
    rejects(withField(11, `9${tricks.slice(1)}`, text));
  });

  it('rejects a hand that never could have been played', () => {
    // A hand mid-trick whose opening lead was not the two of clubs.
    const playing = afterThePass(dealt);
    const other = playing.hands[playing.leader].find((held) => held !== TWO_OF_CLUBS)!;
    const invented: HandState = {
      ...playing,
      hands: bySeat<readonly Card[]>((seat) =>
        seat === playing.leader
          ? playing.hands[seat].filter((held) => held !== other)
          : playing.hands[seat],
      ),
      played: [other],
    };
    expect(sortedCards([...invented.hands.flat(), ...invented.played])).toHaveLength(52);
    rejects(encodeHand(invented));
  });
});

describe('the encoded shape', () => {
  it('is twelve fields of two-digit cards', () => {
    const fields = encodeHand(dealt).split('/');
    expect(fields).toHaveLength(12);
    expect(fields[0]).toBe('1');
    // pass offset 1, phase 'passing', leader 0, unbroken, nobody confirmed.
    expect(fields[1]).toBe('1p000000');
    for (const seat of SEATS) expect(fields[2 + seat]).toHaveLength(HAND_SIZE * 2);
    for (const seat of SEATS) expect(fields[6 + seat]).toBe('');
    expect(fields[10]).toBe('');
    expect(fields[11]).toBe('');
  });

  it('writes the two of spades as 00 and the ace of clubs as 1f', () => {
    expect(card('S2')).toBe(0);
    expect(card('CA')).toBe(51);
    expect((51).toString(36)).toBe('1f');
    expect(TWO_OF_CLUBS).toBe(39);
  });

  it('writes each finished trick as its leader and its four cards', () => {
    const state = steps(afterThePass(dealt), 4);
    const fields = encodeHand(state).split('/');
    expect(fields[11]).toHaveLength(9);
    expect(fields[11]!.slice(0, 1)).toBe(String(state.tricks[0]!.leader));
    expect(fields[11]!.slice(1, 3)).toBe(TWO_OF_CLUBS.toString(36));
    // Twelve cards left in the leader's hand, one trick gone.
    expect(fields[2 + state.tricks[0]!.leader]).toHaveLength((HAND_SIZE - 1) * 2);
    expect(fields[2 + YOU]).toHaveLength((HAND_SIZE - 1) * 2);
  });
});
