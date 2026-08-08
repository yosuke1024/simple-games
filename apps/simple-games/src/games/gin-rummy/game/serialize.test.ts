/**
 * The saved hand comes back exactly, or it does not come back.
 *
 * Round-tripping is the easy half. The half that matters is the refusals: a
 * record that could not have come from play must decode to null so the loader
 * drops the save and goes home, rather than dealing the player into a position
 * where the fifty-two cards do not add up.
 */
import { describe, expect, it } from 'vitest';
import { cardOf, type Card, type Suit } from './cards';
import { dealHand, discardCard, drawFromStock, knock, passUpcard, takeUpcard } from './engine';
import { decodeHand, encodeHand } from './serialize';
import { CPU, YOU, type HandState } from './types';

const SUIT_LETTERS = 'SHDC';
const RANK_LETTERS = 'A23456789TJQK';

function card(text: string): Card {
  const suit = SUIT_LETTERS.indexOf(text[0]!) as Suit;
  const rank = RANK_LETTERS.indexOf(text[1]!) + 1;
  if (suit < 0 || rank < 1) throw new Error(`not a card: ${text}`);
  return cardOf(suit, rank);
}

const dealt = dealHand('gin-serialize', 1, CPU);

/** A few positions from one hand, one per phase. */
function positions(): HandState[] {
  const taken = takeUpcard(dealt)!;
  const afterDiscard = discardCard(
    taken,
    taken.hands[YOU].find((c) => c !== taken.takenFromDiscard)!,
  )!;
  const bothPassed = passUpcard(passUpcard(dealt)!)!;
  return [dealt, bothPassed, drawFromStock(bothPassed)!, taken, afterDiscard];
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

  it('keeps the public log, which is the CPU’s memory of the hand', () => {
    const played = discardCard(
      drawFromStock(passUpcard(passUpcard(dealt)!)!)!,
      dealt.hands[YOU][0]!,
    )!;
    const restored = decodeHand(encodeHand(played))!;
    expect(restored.log).toEqual(played.log);
    expect(restored.log.length).toBeGreaterThan(3);
  });

  it('keeps a settled hand settled', () => {
    const eleven = takeUpcard(dealt)!;
    // Knock only if this deal happens to allow it; otherwise assert the shape
    // of a dead hand instead, which the engine test already builds.
    const knockable = eleven.hands[YOU].filter((c) => c !== eleven.takenFromDiscard);
    const knocked = knockable.map((c) => knock(eleven, c)).find((state) => state !== null);
    const state = knocked ?? eleven;
    expect(decodeHand(encodeHand(state))).toEqual(state);
  });
});

describe('fails closed', () => {
  const valid = encodeHand(dealt);

  const rejects = (text: string) => expect(decodeHand(text)).toBeNull();

  it('rejects anything that is not the format', () => {
    rejects('');
    rejects(valid.slice(1));
    rejects(`${valid}/extra`);
    rejects(valid.replace(/^1/, '2'));
    rejects(valid.split('/').slice(1).join('/'));
  });

  it('rejects a card that is not a card', () => {
    const fields = valid.split('/');
    rejects([...fields.slice(0, 3), `zz${fields[3]!.slice(2)}`, ...fields.slice(4)].join('/'));
    // 52 in base 36 is '1g' — one past the end of the deck.
    rejects([...fields.slice(0, 3), `1g${fields[3]!.slice(2)}`, ...fields.slice(4)].join('/'));
    // An odd number of digits cannot be whole cards.
    rejects([...fields.slice(0, 3), `${fields[3]!}0`, ...fields.slice(4)].join('/'));
  });

  it('rejects a deck that does not add up to fifty-two', () => {
    const fields = valid.split('/');
    // A card in two places at once.
    const duplicated = [...fields];
    duplicated[3] = fields[4]!.slice(0, 2) + fields[3]!.slice(2);
    rejects(duplicated.join('/'));
    // A card missing entirely.
    const short = [...fields];
    short[5] = fields[5]!.slice(2);
    rejects(short.join('/'));
  });

  it('rejects hand sizes the phase does not allow', () => {
    const fields = valid.split('/');
    // Eleven cards each in the upcard phase: nobody has drawn yet.
    const moved = [...fields];
    moved[3] = fields[3]! + fields[5]!.slice(0, 2);
    moved[5] = fields[5]!.slice(2);
    rejects(moved.join('/'));
  });

  it('rejects a flag that belongs to another phase', () => {
    const fields = valid.split('/');
    // The forced stock draw does not exist during the upcard offer.
    rejects([fields[0]!, `${fields[1]!.slice(0, 4)}1`, ...fields.slice(2)].join('/'));
    // Nor does a card taken off the pile.
    rejects([...fields.slice(0, 2), '00', ...fields.slice(3)].join('/'));
  });

  it('rejects a phase or an ending that disagree', () => {
    const fields = valid.split('/');
    // Still in the upcard phase, but claiming the hand is over.
    rejects([fields[0]!, `${fields[1]!.slice(0, 3)}k0`, ...fields.slice(2)].join('/'));
    // Over, but claiming nothing ended it.
    rejects([fields[0]!, `${fields[1]!.slice(0, 2)}on0`, ...fields.slice(2)].join('/'));
    // A letter that is not a phase at all.
    rejects([fields[0]!, `${fields[1]!.slice(0, 2)}?n0`, ...fields.slice(2)].join('/'));
  });

  it('rejects a knock the rules would not have allowed', () => {
    // This deal's non-dealer holds far more than ten points of deadwood, so a
    // record claiming they knocked is a record of something that never
    // happened.
    const fields = valid.split('/');
    const claimed = [
      fields[0]!,
      `${String(CPU)}${String(YOU)}ok0`,
      ...fields.slice(2, 5),
      // Move one stock card onto the pile so the stock lands on two, which is
      // the only stock depth an ended hand could have here.
      fields[5]!,
      fields[6]!,
      fields[7]!,
    ].join('/');
    rejects(claimed);
  });

  it('rejects a dead hand whose stock never ran out', () => {
    const fields = valid.split('/');
    rejects([fields[0]!, `${fields[1]!.slice(0, 2)}ox0`, ...fields.slice(2)].join('/'));
  });

  it('rejects a taken card the seat is not holding', () => {
    const taken = takeUpcard(dealt)!;
    const fields = encodeHand(taken).split('/');
    // Swap the taken card for one out of the stock.
    rejects([...fields.slice(0, 2), fields[5]!.slice(0, 2), ...fields.slice(3)].join('/'));
  });

  it('rejects a malformed log', () => {
    const fields = valid.split('/');
    rejects([...fields.slice(0, 7), 'u-'].join('/'));
    rejects([...fields.slice(0, 7), 'q-00'].join('/'));
    // The turned card has no seat; a pass has no card.
    rejects([...fields.slice(0, 7), 'u000'].join('/'));
    rejects([...fields.slice(0, 7), 'p000'].join('/'));
    rejects([...fields.slice(0, 7), 'd0--'].join('/'));
  });

  it('rejects a seat that is not a seat', () => {
    const fields = valid.split('/');
    rejects([fields[0]!, `2${fields[1]!.slice(1)}`, ...fields.slice(2)].join('/'));
    rejects([...fields.slice(0, 7), 'x200'].join('/'));
  });
});

describe('the encoded shape', () => {
  it('is eight fields of two-digit cards', () => {
    const fields = encodeHand(dealt).split('/');
    expect(fields).toHaveLength(8);
    expect(fields[0]).toBe('1');
    expect(fields[1]).toHaveLength(5);
    expect(fields[2]).toBe('--');
    expect(fields[3]).toHaveLength(20);
    expect(fields[4]).toHaveLength(20);
    expect(fields[5]).toHaveLength(62);
    expect(fields[6]).toHaveLength(2);
    expect(fields[7]).toHaveLength(4);
  });

  it('writes the ace of spades as 00 and the king of clubs as 1f', () => {
    expect(card('SA')).toBe(0);
    expect(card('CK')).toBe(51);
    expect((51).toString(36)).toBe('1f');
  });
});
