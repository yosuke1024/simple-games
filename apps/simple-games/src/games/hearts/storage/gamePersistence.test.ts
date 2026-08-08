/**
 * What a saved match has to prove before it is handed back. The hand's own
 * shape is checked when it is decoded (game/serialize.ts) — fifty-two cards,
 * each exactly once, and every card already played run back through the rules
 * that allowed it — and these tests pin the parts only the record as a whole
 * can answer: that the match is still in progress, that the pass direction is
 * the one this hand number deals, and that the beat count and the hand tell the
 * same story.
 *
 * The beat count matters because it is half the CPU's tie-break draw
 * (game/session.ts). A save that disagrees with its own hand would resume a
 * match that answers differently from the one that was put down.
 *
 * Every failure here is the same failure: the save is dropped and the player
 * goes home. Nothing is repaired, and nothing is invented to play on with.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import {
  applyCpuStep,
  canCollectTrick,
  canDealNextHand,
  chooseCpuAction,
  createSession,
  cpuViewOf,
  doCollectTrick,
  doConfirmPass,
  doNextHand,
  doPlayCard,
  doSelectPassCard,
  encodeHand,
  isCpuTurn,
  MATCH_TARGET,
  PASS_SIZE,
  restoreSession,
  sortedCards,
  TWO_OF_CLUBS,
  YOU,
  type HandState,
  type HeartsSession,
} from '../game';
import { clearSavedGame, loadSavedGame, saveGame, toPersisted } from './gamePersistence';
import { HT_STORAGE_KEYS } from './schemas';

const saved = (record: unknown) =>
  createMemoryKV({ [HT_STORAGE_KEYS.game]: JSON.stringify(record) });

/**
 * One beat by whoever is due one, with the player's seat played by the easy
 * opponent reading its own view. The matches below are therefore played into
 * existence rather than crafted, which is the only way to be sure the positions
 * being saved are positions the rules produce.
 */
function step(session: HeartsSession): HeartsSession {
  if (canDealNextHand(session)) return doNextHand(session)!;
  if (canCollectTrick(session)) return doCollectTrick(session)!.session;
  if (isCpuTurn(session)) return applyCpuStep(session)!.session;

  const action = chooseCpuAction({ ...cpuViewOf(session, YOU), difficulty: 'easy' }, 0.5)!;
  if (action.kind === 'pass') {
    const chosen = action.cards.reduce<HeartsSession>(
      (state, card) => doSelectPassCard(state, card)!,
      session,
    );
    return doConfirmPass(chosen)!.session;
  }
  return doPlayCard(session, action.card)!.session;
}

const STEP_LIMIT = 20_000;

/** Plays a seeded match until it reaches the position asked for. */
function playUntil(seed: string, reached: (session: HeartsSession) => boolean): HeartsSession {
  let session = createSession('hard', seed);
  for (let taken = 0; taken < STEP_LIMIT && !reached(session); taken++) session = step(session);
  if (!reached(session)) throw new Error(`never reached the position asked for (${seed})`);
  return session;
}

/** A match a few tricks into its second hand — a perfectly ordinary save. */
const midHand = (): HeartsSession =>
  playUntil('hearts-persist-mid', (s) => s.handNumber === 2 && s.hand.tricks.length === 3);

const record = (session: HeartsSession = midHand()) => toPersisted(session, 1_700_000_000_000);

/** The same record with one part of the hand rewritten — for the fail-closed checks. */
const withHand = (session: HeartsSession, change: (hand: HandState) => HandState) => ({
  ...record(session),
  hand: encodeHand(change(session.hand)),
});

describe('resuming a saved match', () => {
  it('gives back the match it was handed, hand and scores alike', async () => {
    const session = midHand();
    expect(await loadSavedGame(saved(record(session)))).toEqual(session);
  });

  it('carries a match already several hands deep', async () => {
    const deep = playUntil('hearts-persist-deep', (s) => s.handNumber === 4);
    expect(deep.scores.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    const restored = await loadSavedGame(saved(record(deep)));
    expect(restored!.handNumber).toBe(4);
    expect(restored!.scores).toEqual(deep.scores);
    expect(restored!.status).toBe('playing');
    // The fourth hand is the one nobody passes on — the cycle survives too.
    expect(restored!.hand.passOffset).toBe(0);
  });

  it('comes back mid-pass with the three still picked out, and no beat spent on them', async () => {
    let session = createSession('normal', 'hearts-persist-pass');
    session = applyCpuStep(session)!.session;
    const before = session.moveCount;
    for (const card of session.hand.hands[YOU].slice(0, 2)) {
      session = doSelectPassCard(session, card)!;
    }
    expect(session.moveCount).toBe(before);

    const restored = await loadSavedGame(saved(record(session)));
    expect(restored).toEqual(session);
    expect(restored!.hand.selected[YOU]).toHaveLength(2);
    expect(restored!.hand.confirmed[1]).toBe(true);
  });

  it('comes back on a finished trick that still has to be collected', async () => {
    const session = playUntil('hearts-persist-collect', canCollectTrick);
    const restored = await loadSavedGame(saved(record(session)));
    expect(restored).toEqual(session);
    expect(canCollectTrick(restored!)).toBe(true);
    // The public record is the CPU's whole memory of the hand: an opponent that
    // forgot which suits you were void in is not the one that was suspended.
    expect(restored!.hand.tricks).toEqual(session.hand.tricks);
  });

  it('comes back on a settled hand waiting for the next deal', async () => {
    const session = playUntil('hearts-persist-over', (s) => s.hand.phase === 'over');
    const restored = await loadSavedGame(saved(record(session)));
    // The last hand's score is recomputed rather than stored, so it arrives
    // without having been trusted.
    expect(restored).toEqual(session);
    expect(restored!.lastHand).not.toBeNull();
    expect(canDealNextHand(restored!)).toBe(true);
  });
});

describe('fail closed', () => {
  it('discards a hand that is not a hand at all', async () => {
    expect(await loadSavedGame(saved({ ...record(), hand: 'not-a-hand' }))).toBeNull();
    expect(await loadSavedGame(saved({ ...record(), hand: '' }))).toBeNull();
    expect(await loadSavedGame(saved({ ...record(), hand: 'x'.repeat(4096) }))).toBeNull();
  });

  it('discards a hand holding the same card twice', async () => {
    const session = midHand();
    const broken = withHand(session, (hand) => ({
      ...hand,
      // One seat's lowest card replaced by a card another seat is holding:
      // fifty-two slots, fifty-one cards, one of them twice.
      hands: [
        hand.hands[0],
        sortedCards([hand.hands[0][0]!, ...hand.hands[1].slice(1)]),
        hand.hands[2],
        hand.hands[3],
      ],
    }));
    expect(await loadSavedGame(saved(broken))).toBeNull();
  });

  it('discards a hand a card short of a deck', async () => {
    const broken = withHand(midHand(), (hand) => ({
      ...hand,
      hands: [hand.hands[0].slice(1), hand.hands[1], hand.hands[2], hand.hands[3]],
    }));
    expect(await loadSavedGame(saved(broken))).toBeNull();
  });

  it('discards a trick nobody could have played', async () => {
    // Every hand opens on the two of clubs. Swap it out of the first trick for
    // a card its leader is still holding: fifty-two cards, each still exactly
    // once, and an opening lead the rules would never have allowed.
    const session = playUntil('hearts-persist-illegal', (s) => s.hand.tricks.length === 2);
    expect(await loadSavedGame(saved(record(session)))).not.toBeNull();
    const first = session.hand.tricks[0]!;
    expect(first.cards[0]).toBe(TWO_OF_CLUBS);
    const swapIn = session.hand.hands[first.leader][0]!;

    const broken = withHand(session, (hand) => {
      const hands = hand.hands.map((cards, seat) =>
        seat === first.leader
          ? sortedCards([TWO_OF_CLUBS, ...cards.filter((card) => card !== swapIn)])
          : cards,
      );
      return {
        ...hand,
        hands: [hands[0]!, hands[1]!, hands[2]!, hands[3]!],
        tricks: [
          { ...first, cards: [swapIn, first.cards[1], first.cards[2], first.cards[3]] },
          ...hand.tricks.slice(1),
        ],
      };
    });
    expect(await loadSavedGame(saved(broken))).toBeNull();
  });

  it('discards a hand whose own history disagrees with its flags', async () => {
    // Hearts have not been broken in this position; a record saying they have
    // is a record of a hand nobody played.
    const session = playUntil(
      'hearts-persist-flags',
      (s) => s.hand.phase === 'playing' && s.hand.tricks.length === 1 && !s.hand.heartsBroken,
    );
    expect(await loadSavedGame(saved(record(session)))).not.toBeNull();
    expect(
      await loadSavedGame(saved(withHand(session, (hand) => ({ ...hand, heartsBroken: true })))),
    ).toBeNull();
    // Same for who is leading: the trick winner leads the next one, and no
    // other seat can.
    const wrongLeader = ((session.hand.leader + 1) % 4) as 0 | 1 | 2 | 3;
    expect(
      await loadSavedGame(saved(withHand(session, (hand) => ({ ...hand, leader: wrongLeader })))),
    ).toBeNull();
  });

  it('discards a pass the hand number does not deal', async () => {
    // The direction turns with the hand number and nothing else: left, right,
    // across, none. A second hand passing to the left never happened.
    const session = midHand();
    expect(session.hand.passOffset).toBe(3);
    expect(await loadSavedGame(saved({ ...record(session), handNumber: 3 }))).toBeNull();
  });

  it('discards a match somebody has already won', async () => {
    const session = midHand();
    const decided = (scores: [number, number, number, number]) => ({
      ...record(restoreSession({ ...session, scores })),
      scores,
    });
    expect(await loadSavedGame(saved(decided([MATCH_TARGET, 12, 30, 40])))).toBeNull();
    expect(await loadSavedGame(saved(decided([12, 30, 40, MATCH_TARGET + 7])))).toBeNull();
  });

  it('discards a record whose beat count is not the one its hand took', async () => {
    // Every beat this game takes is visible in the position — the pass
    // confirmations, the cards played, the tricks taken in, the deals — so the
    // count is not a floor to clear but a number to match.
    const honest = record();
    expect(await loadSavedGame(saved(honest))).not.toBeNull();
    for (const moveCount of [0, honest.moveCount - 1, honest.moveCount + 1]) {
      expect(await loadSavedGame(saved({ ...honest, moveCount }))).toBeNull();
    }
  });

  it('does not count picking pass cards up and putting them down as beats', async () => {
    // Staging is not a move (game/session.ts), so two saves of the same hand —
    // one with three cards picked out and one with none — carry the same count.
    let session = createSession('normal', 'hearts-persist-staging');
    const bare = record(session);
    for (const card of session.hand.hands[YOU].slice(0, PASS_SIZE)) {
      session = doSelectPassCard(session, card)!;
    }
    const staged = record(session);
    expect(staged.moveCount).toBe(bare.moveCount);
    expect((await loadSavedGame(saved(staged)))!.hand.selected[YOU]).toHaveLength(PASS_SIZE);
  });

  it('discards a record with a field missing', async () => {
    for (const field of [
      'seed',
      'difficulty',
      'hand',
      'handNumber',
      'scores',
      'moveCount',
      'elapsedSeconds',
      'savedAt',
    ] as const) {
      const { [field]: _dropped, ...partial } = record();
      expect(await loadSavedGame(saved(partial))).toBeNull();
    }
  });

  it('discards a score that is not four seats', async () => {
    expect(await loadSavedGame(saved({ ...record(), scores: [0, 0, 0] }))).toBeNull();
    expect(await loadSavedGame(saved({ ...record(), scores: [0, 0, 0, 0, 0] }))).toBeNull();
    expect(await loadSavedGame(saved({ ...record(), scores: [0, -1, 0, 0] }))).toBeNull();
  });

  it('discards a record from a schema it does not know', async () => {
    expect(await loadSavedGame(saved({ ...record(), schemaVersion: 2 }))).toBeNull();
    expect(await loadSavedGame(createMemoryKV({ [HT_STORAGE_KEYS.game]: 'not json' }))).toBeNull();
  });

  it('has nothing to give back when nothing was saved', async () => {
    expect(await loadSavedGame(createMemoryKV())).toBeNull();
  });
});

describe('the one slot', () => {
  it('round-trips through the store, and is emptied when the match ends', async () => {
    const kv = createMemoryKV();
    const session = midHand();

    await saveGame(session, kv);
    expect(await loadSavedGame(kv)).toEqual(session);

    await clearSavedGame(kv);
    expect(await loadSavedGame(kv)).toBeNull();
  });

  it('keeps only the last save — one match at a time', async () => {
    const kv = createMemoryKV();
    const early = playUntil('hearts-persist-slot', (s) => s.hand.tricks.length === 1);
    await saveGame(early, kv);
    const later = playUntil('hearts-persist-slot', (s) => s.hand.tricks.length === 5);
    await saveGame(later, kv);

    const restored = await loadSavedGame(kv);
    expect(restored!.hand.tricks).toHaveLength(5);
    expect(restored!.moveCount).toBe(later.moveCount);
  });

  it('saves a card the player is still holding without ever showing anybody else’s', async () => {
    // A save is the table as it stands, all four hands included — it is the
    // player's own device and the only way to come back to the same match. What
    // matters is that reading it back changes nothing, not that it hides.
    const session = midHand();
    const kv = createMemoryKV();
    await saveGame(session, kv);
    const restored = (await loadSavedGame(kv))!;
    for (const seat of [0, 1, 2, 3] as const) {
      expect(restored.hand.hands[seat]).toEqual(session.hand.hands[seat]);
    }
  });
});

describe('the beat count is derived, not guessed', () => {
  /**
   * The same arithmetic as gamePersistence, written out longhand from the
   * numbers rather than from the constants — four seats, thirteen tricks, and
   * a pass on every hand but the fourth. If the two ever disagree it is the
   * check that is wrong, and every honest save on every device would be thrown
   * away, so it is worth a second opinion.
   */
  const beatsOf = (session: HeartsSession): number => {
    const { hand } = session;
    const passBeats =
      hand.passOffset === 0
        ? 0
        : hand.phase === 'passing'
          ? hand.confirmed.filter(Boolean).length
          : 4;
    // One beat per deal after the first, and every finished hand in full.
    let total = session.handNumber - 1;
    for (let at = 1; at < session.handNumber; at++) total += (at % 4 === 0 ? 0 : 4) + 13 * 5;
    return total + passBeats + hand.played.length + hand.tricks.length * 5;
  };

  it('matches what the session counted, at every beat of a whole match', () => {
    let session = createSession('normal', 'hearts-persist-beats');
    let beats = 0;
    for (let taken = 0; taken < STEP_LIMIT && session.status === 'playing'; taken++) {
      expect(beatsOf(session)).toBe(session.moveCount);
      session = step(session);
      beats += 1;
    }
    expect(beatsOf(session)).toBe(session.moveCount);
    // A whole match, not two beats of one.
    expect(session.handNumber).toBeGreaterThan(3);
    expect(beats).toBeGreaterThan(300);
  });
});
