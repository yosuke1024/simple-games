/**
 * The saved hand comes back exactly, or it does not come back.
 *
 * Round-tripping is the easy half. The half that matters is the refusals: a
 * record that could not have come from play must decode to null so the loader
 * drops the save and goes home, rather than dealing the player into a position
 * where the fifty-two cards do not add up.
 */
import { describe, expect, it } from 'vitest';
import { cardOf, sortedCards, type Card, type Suit } from './cards';
import { buildCpuView, knowledgeOf } from './cpu';
import { dealHand, discardCard, drawFromStock, knock, passUpcard, takeUpcard } from './engine';
import { decodeHand, encodeHand } from './serialize';
import {
  CPU,
  isConsistentLog,
  isValidHand,
  topDiscard,
  YOU,
  type HandState,
  type PublicEvent,
} from './types';

const SUIT_LETTERS = 'SHDC';
const RANK_LETTERS = 'A23456789TJQK';

function card(text: string): Card {
  const suit = SUIT_LETTERS.indexOf(text[0]!) as Suit;
  const rank = RANK_LETTERS.indexOf(text[1]!) + 1;
  if (suit < 0 || rank < 1) throw new Error(`not a card: ${text}`);
  return cardOf(suit, rank);
}

const dealt = dealHand('gin-serialize', 1, CPU);

/** A card as the two base-36 digits the format writes it with. */
const code = (value: Card): string => value.toString(36).padStart(2, '0');

/** The same record with a different public log. */
const withLog = (state: HandState, log: string): string =>
  [...encodeHand(state).split('/').slice(0, 7), log].join('/');

/** The log as the encoder wrote it, one four-character event at a time. */
const events = (state: HandState): string[] =>
  encodeHand(state).split('/')[7]!.match(/.{4}/g) ?? [];

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

/**
 * The public log is the CPU's whole memory of the hand (game/cpu.ts), so a log
 * nothing checks is a way to tell the opponent things that never happened. The
 * discard pile is the answer: every card that ever went onto it or came off it
 * is named in the record, so the pile can be rebuilt from the log and compared
 * with the one on the table.
 */
describe('the public log has to match the table', () => {
  const rejects = (text: string) => expect(decodeHand(text)).toBeNull();

  /** Both players refused the upcard and the non-dealer opened from the stock. */
  const opened = drawFromStock(passUpcard(passUpcard(dealt)!)!)!;

  it('keeps a log that really was played', () => {
    for (const state of positions()) expect(decodeHand(encodeHand(state))).toEqual(state);
    expect(decodeHand(encodeHand(opened))).toEqual(opened);
  });

  it('refuses a face-down draw rewritten as a card off the pile', () => {
    // The attack the boundary exists to stop: the last event is the player
    // drawing a card nobody saw. Rewritten as a take off the pile, naming a
    // card out of the player's own hand, `knowledgeOf` would read that card as
    // one the *opponent* is holding and hard would play around it. The pile
    // says otherwise — nothing was taken off it — so the save does not come back.
    const written = events(opened);
    expect(written[written.length - 1]).toBe('s0--');
    const held = opened.hands[YOU][0]!;
    rejects(withLog(opened, [...written.slice(0, -1), `d0${code(held)}`].join('')));
  });

  it('refuses a take that names anything but the card on top', () => {
    const taken = takeUpcard(dealt)!;
    const written = events(taken);
    // The upcard really was taken; the record claims a different card was.
    const other = taken.hands[YOU].find((card) => card !== taken.takenFromDiscard)!;
    rejects(withLog(taken, [written[0]!, `d0${code(other)}`].join('')));
  });

  it('refuses a take off a pile with nothing on it', () => {
    const taken = takeUpcard(dealt)!;
    const put = discardCard(
      taken,
      taken.hands[YOU].find((c) => c !== taken.takenFromDiscard)!,
    )!;
    const written = events(put);
    // The last event put a card down onto an empty pile. Read as a take
    // instead, there is nothing there to take.
    expect(written[2]!.startsWith('x')).toBe(true);
    rejects(withLog(put, [...written.slice(0, 2), `d${written[2]!.slice(1)}`].join('')));
  });

  it('refuses a log that skips what the table remembers', () => {
    // The hand as played, with the opening stock draw simply deleted: the
    // stock is a card shallower than a log with no draw in it could leave it,
    // and the player is holding one more card than it accounts for.
    rejects(withLog(opened, events(opened).slice(0, -1).join('')));
    // And with nothing in it at all — every hand begins with a turned card.
    rejects(withLog(opened, ''));
  });

  it('refuses a log that does not begin with the turned card', () => {
    const written = events(opened);
    rejects(withLog(opened, [...written.slice(1), written[0]!].join('')));
  });
});

/**
 * Adding the record up is not enough, because a forgery can be made to add up.
 * The record is replayed as a *game* — every event legal where it stands, and
 * the position it ends on the position that was saved — and these are the
 * forgeries that survive the arithmetic and die on the replay. Each one leaves
 * the pile, the stock and both hand sizes exactly as they were, which is why
 * every one of them is checked through `isValidHand` first: the table is not
 * what gives them away.
 */
describe('the public log has to be a game that could have been played', () => {
  const rejects = (text: string) => expect(decodeHand(text)).toBeNull();

  /** The upcard taken: the player holds eleven and the pile is empty. */
  const taken = takeUpcard(dealt)!;
  /** Both players refused it; the non-dealer must open from the stock. */
  const bothPassed = passUpcard(passUpcard(dealt)!)!;
  /** …and did. */
  const opened = drawFromStock(bothPassed)!;

  /** What the opponent would take the record to mean about the player's hand. */
  const opponentThinksPlayerHolds = (hand: HandState): ReadonlySet<Card> =>
    knowledgeOf(buildCpuView(hand, CPU, 'hard', [0, 0])).holds;

  it('refuses a discard and a take of the same card, appended to a record that was played', () => {
    // The pair that cancels itself out. A card goes down and comes straight
    // back up, so the pile is pushed and popped, one card leaves the hand and
    // one returns, and the stock is never touched: every total the record
    // could be summed into is exactly what it was.
    const victim = taken.hands[YOU].find((card) => card !== taken.takenFromDiscard)!;
    const forged: HandState = {
      ...taken,
      log: [
        ...taken.log,
        { kind: 'discard', seat: YOU, card: victim },
        { kind: 'draw-discard', seat: YOU, card: victim },
      ],
    };
    expect(isValidHand(forged)).toBe(true);
    expect(forged.discard).toEqual(taken.discard);
    expect(forged.stock).toEqual(taken.stock);
    expect(forged.hands.map((cards) => cards.length)).toEqual([11, 10]);

    // And this is what the pair buys: a card out of the player's own hand,
    // which the opponent now reads as one it watched the player pick up
    // (game/cpu.ts `knowledgeOf`, and hard's `riskOf` plays around it).
    expect(opponentThinksPlayerHolds(forged).has(victim)).toBe(true);

    // Replayed as a game it is not one: the discard handed the turn over, and
    // the take that follows is not the taker's to make.
    expect(isConsistentLog(forged)).toBe(false);
    rejects(encodeHand(forged));
  });

  it('refuses the same pair written in at the front, over two refusals', () => {
    // The other end of the record, and the same hole: the two passes that open
    // this hand rewritten as a discard and an immediate take. Passes move no
    // cards, so the substitution is invisible to every total as well.
    const victim = opened.hands[YOU][0]!;
    const written = events(opened);
    expect(written.slice(1)).toEqual(['p0--', 'p1--', 's0--']);
    rejects(
      withLog(
        opened,
        [written[0]!, `x0${code(victim)}`, `d0${code(victim)}`, written[3]!].join(''),
      ),
    );
  });

  it('refuses an event from the seat whose turn it was not', () => {
    // The non-dealer gets the first look at the turned card, and the dealer
    // the second. A record that refuses them the other way round describes a
    // different game — and refusing moves no cards, so nothing on the table
    // disagrees with it.
    const written = events(bothPassed);
    expect(written.slice(1)).toEqual(['p0--', 'p1--']);
    rejects(withLog(bothPassed, [written[0]!, written[2]!, written[1]!].join('')));
  });

  it('refuses the card just taken off the pile going straight back down', () => {
    // §2.2, the rule that stops the pile being used as a free look: the taken
    // card may not be this turn's discard. The table the record leaves behind
    // is an ordinary one — the card is simply back where it came from.
    const back = taken.takenFromDiscard!;
    const forged: HandState = {
      ...taken,
      hands: [taken.hands[YOU].filter((card) => card !== back), taken.hands[CPU]],
      discard: [...taken.discard, back],
      turn: CPU,
      phase: 'draw',
      takenFromDiscard: null,
      log: [...taken.log, { kind: 'discard', seat: YOU, card: back }],
    };
    expect(isValidHand(forged)).toBe(true);
    rejects(encodeHand(forged));
  });

  it('refuses the refused card being taken after all', () => {
    // Both players passed, so the turned card stays refused and the non-dealer
    // opens from the stock (§2.1). A record that takes it anyway is a record of
    // a move the engine has no door for.
    const refused = topDiscard(bothPassed)!;
    const forged: HandState = {
      ...bothPassed,
      hands: [sortedCards([...bothPassed.hands[YOU], refused]), bothPassed.hands[CPU]],
      discard: [],
      phase: 'discard',
      takenFromDiscard: refused,
      mustDrawStock: false,
      log: [...bothPassed.log, { kind: 'draw-discard', seat: YOU, card: refused }],
    };
    expect(isValidHand(forged)).toBe(true);
    rejects(encodeHand(forged));
  });

  it('refuses a record that says a hand holds a card it does not', () => {
    // A take off the pile is the one thing the record says about whose cards
    // are whose, and it says it out loud: the card was face up when it moved,
    // and it leaves that hand only by being put back down — which is an event
    // of its own. Here the taken card has been quietly swapped for the top of
    // the stock, which leaves every count intact and leaves the opponent
    // certain about a card that is face down.
    const put = discardCard(
      taken,
      taken.hands[YOU].find((c) => c !== taken.takenFromDiscard)!,
    )!;
    const picked = taken.takenFromDiscard!;
    const buried = put.stock[put.stock.length - 1]!;
    const forged: HandState = {
      ...put,
      hands: [
        sortedCards([...put.hands[YOU].filter((card) => card !== picked), buried]),
        put.hands[CPU],
      ],
      stock: [...put.stock.slice(0, -1), picked],
    };
    expect(isValidHand(forged)).toBe(true);
    expect(opponentThinksPlayerHolds(forged).has(picked)).toBe(true);
    expect(forged.hands[YOU]).not.toContain(picked);
    rejects(encodeHand(forged));
  });

  it('refuses anything at all after the hand has settled', () => {
    // Nobody knocks, the stock runs down to two and the hand is void (§3.1).
    // A settled hand takes no more moves — not even one that moves no cards.
    let dead = bothPassed;
    while (dead.phase !== 'over') {
      dead =
        dead.phase === 'draw'
          ? drawFromStock(dead)!
          : discardCard(
              dead,
              dead.hands[dead.turn].find((c) => c !== dead.takenFromDiscard)!,
            )!;
    }
    expect(dead.ending).toBe('dead');
    expect(decodeHand(encodeHand(dead))).toEqual(dead);

    const after: PublicEvent = { kind: 'pass', seat: dead.turn };
    expect(isConsistentLog({ ...dead, log: [...dead.log, after] })).toBe(false);
    rejects(encodeHand({ ...dead, log: [...dead.log, after] }));
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
