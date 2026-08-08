/**
 * What a saved match has to prove before it is handed back. The hand's own
 * shape is checked when it is decoded (game/serialize.ts) — fifty-two cards,
 * each exactly once, in a position the rules allow — and these tests pin the
 * parts only the record as a whole can answer: that the match is still in
 * progress, and that the move count and the hand tell the same story.
 *
 * The move count matters because it is half the CPU's tie-break draw
 * (game/session.ts). A save that disagrees with its own hand would resume a
 * match that answers differently from the one that was put down.
 *
 * Every failure here is the same failure: the save is dropped and the player
 * goes home. Nothing is repaired, and nothing is invented to play on with.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import {
  createSession,
  drawFromStock,
  encodeHand,
  MATCH_TARGET,
  passUpcard,
  restoreSession,
  type GinRummySession,
  type HandState,
} from '../game';
import { clearSavedGame, loadSavedGame, saveGame, toPersisted } from './gamePersistence';
import { GR_STORAGE_KEYS } from './schemas';

const saved = (record: unknown) =>
  createMemoryKV({ [GR_STORAGE_KEYS.game]: JSON.stringify(record) });

/**
 * A match a few legal actions in: both players refused the upcard and the
 * non-dealer opened from the stock. Three actions, so three is the smallest
 * move count this record could honestly carry.
 */
const midHand = (): GinRummySession => {
  const base = createSession('hard', 'gin-persist-mid');
  const hand = drawFromStock(passUpcard(passUpcard(base.hand)!)!)!;
  return restoreSession({ ...base, hand, moveCount: 3 });
};

const record = (session: GinRummySession = midHand()) => toPersisted(session, 1_700_000_000_000);

/** The same hand with one pile rewritten — for the conservation checks. */
const withHand = (change: (hand: HandState) => HandState) => {
  const session = midHand();
  return { ...record(session), hand: encodeHand(change(session.hand)) };
};

describe('resuming a saved match', () => {
  it('gives back the match it was handed, hand and score alike', async () => {
    const session = midHand();
    const restored = await loadSavedGame(saved(record(session)));
    expect(restored).toEqual(session);
  });

  it('carries a match already several hands deep', async () => {
    const deep = restoreSession({ ...midHand(), handNumber: 4, scores: [42, 31], moveCount: 61 });
    const restored = await loadSavedGame(saved(record(deep)));
    expect(restored!.handNumber).toBe(4);
    expect(restored!.scores).toEqual([42, 31]);
    expect(restored!.status).toBe('playing');
  });

  it('comes back on the same phase and the same seat to move', async () => {
    const session = midHand();
    const restored = await loadSavedGame(saved(record(session)));
    expect(restored!.hand.phase).toBe(session.hand.phase);
    expect(restored!.hand.turn).toBe(session.hand.turn);
    expect(restored!.hand.dealer).toBe(session.hand.dealer);
    // The public log survives too: it is the CPU's whole memory of the hand,
    // and an opponent that forgot what it watched you pick up is a different
    // opponent from the one that was suspended.
    expect(restored!.hand.log).toEqual(session.hand.log);
  });
});

describe('fail closed', () => {
  it('discards a hand that is not a hand at all', async () => {
    expect(await loadSavedGame(saved({ ...record(), hand: 'not-a-hand' }))).toBeNull();
    expect(await loadSavedGame(saved({ ...record(), hand: '' }))).toBeNull();
  });

  it('discards a hand holding the same card twice', async () => {
    // The stock's first card replaced by one the player is already holding:
    // fifty-two slots, fifty-one cards, one of them twice.
    const broken = withHand((hand) => ({
      ...hand,
      stock: [hand.hands[0][0]!, ...hand.stock.slice(1)],
    }));
    expect(await loadSavedGame(saved(broken))).toBeNull();
  });

  it('discards a hand a card short of a deck', async () => {
    const broken = withHand((hand) => ({ ...hand, stock: hand.stock.slice(1) }));
    expect(await loadSavedGame(saved(broken))).toBeNull();
  });

  it('discards a hand whose size the phase does not allow', async () => {
    // Mid-turn the player to move holds eleven; ten means the draw never
    // happened, and no sequence of moves produces the state as recorded.
    const broken = withHand((hand) => ({
      ...hand,
      hands: [hand.hands[0].slice(1), hand.hands[1]],
      stock: [...hand.stock, hand.hands[0][0]!],
    }));
    expect(await loadSavedGame(saved(broken))).toBeNull();
  });

  it('discards a match somebody has already won', async () => {
    const decided = { ...record(), scores: [MATCH_TARGET, 12] };
    expect(await loadSavedGame(saved(decided))).toBeNull();
    expect(await loadSavedGame(saved({ ...record(), scores: [12, MATCH_TARGET + 7] }))).toBeNull();
  });

  it('discards a record whose move count is under its own history', async () => {
    // Three actions have been logged; a count of two could not have produced
    // them, and the CPU's tie-break would answer from the wrong stream.
    expect(await loadSavedGame(saved({ ...record(), moveCount: 2 }))).toBeNull();
    expect(await loadSavedGame(saved({ ...record(), moveCount: 3 }))).not.toBeNull();
  });

  it('pins the move count exactly while the first hand is the only hand', async () => {
    // Nothing has happened but this hand, so three is not a floor — it is the
    // count. A record claiming four is claiming an action that left no trace,
    // and one step along `${seed}:cpu:${moveCount}` is a different opponent.
    expect(await loadSavedGame(saved({ ...record(), moveCount: 4 }))).toBeNull();
    expect(await loadSavedGame(saved({ ...record(), moveCount: 30 }))).toBeNull();
  });

  it('keeps the floor once earlier hands are behind it', async () => {
    // From the second hand on, what those hands cost is not in the position
    // and cannot be recomputed — only the deals and this hand's own log are.
    // Two deals and three actions is the floor; above it, anything may stand.
    const deep = restoreSession({ ...midHand(), handNumber: 3, moveCount: 5 });
    expect(await loadSavedGame(saved(record(deep)))).not.toBeNull();
    expect(await loadSavedGame(saved({ ...record(deep), moveCount: 61 }))).not.toBeNull();
    expect(await loadSavedGame(saved({ ...record(deep), moveCount: 4 }))).toBeNull();
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

  it('discards a record from a schema it does not know', async () => {
    expect(await loadSavedGame(saved({ ...record(), schemaVersion: 2 }))).toBeNull();
    expect(await loadSavedGame(createMemoryKV({ [GR_STORAGE_KEYS.game]: 'not json' }))).toBeNull();
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
    await saveGame(midHand(), kv);
    // The score is what tells the two saves apart: on the first hand the move
    // count is pinned to the hand's own log, so it is not free to vary here.
    const later = restoreSession({ ...midHand(), scores: [17, 5] });
    await saveGame(later, kv);
    expect((await loadSavedGame(kv))!.scores).toEqual([17, 5]);
  });
});
