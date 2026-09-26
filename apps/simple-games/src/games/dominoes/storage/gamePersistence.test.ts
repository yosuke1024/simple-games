/**
 * What a saved game has to prove before it is handed back (§9). Every
 * rejection below is a record that play could not have produced from its own
 * seed; each one would resume a different game than the one put down — or a
 * game that cannot go on — so each is discarded and the player lands on the
 * home screen instead.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { createSession, CPU, PLAYER, type DominoesSession } from '../game';
import { findPosition, playThrough } from '../game/test-helpers';
import { loadSavedGame, toPersisted } from './gamePersistence';
import { DM_STORAGE_KEYS, type PersistedGame } from './schemas';

const saved = (record: unknown) =>
  createMemoryKV({ [DM_STORAGE_KEYS.game]: JSON.stringify(record) });

const load = (record: unknown) => loadSavedGame(saved(record));

/** A game well under way: tiles drawn, several on the line, the player to move. */
const midGame = findPosition(
  'dm-persist',
  (s) =>
    s.status === 'playing' &&
    s.toMove === PLAYER &&
    s.line.length >= 4 &&
    s.boneyard.length > 0 &&
    s.boneyard.length < 13,
);
const record = (): PersistedGame => toPersisted({ ...midGame, elapsedSeconds: 42 }, 1);

describe('resuming a saved game (§9)', () => {
  it('gives back the same game, position and all', async () => {
    const session = await load(record());
    expect(session).not.toBeNull();
    const { elapsedSeconds, ...rest } = session!;
    const { elapsedSeconds: _ignored, ...expected } = midGame;
    expect(rest).toEqual(expected);
    expect(elapsedSeconds).toBe(42);
  });

  it('gives back a fresh game on either side’s turn', async () => {
    for (const seed of ['dominoes-golden-a', 'dominoes-golden-b']) {
      const fresh = createSession(seed);
      expect(await load(toPersisted(fresh, 1))).toEqual(fresh);
    }
  });

  it('gives back a game with a pass pending', async () => {
    const pending = findPosition(
      'dm-persist-pass',
      (s) => s.status === 'playing' && s.passes === 1,
    );
    expect(await load(toPersisted(pending, 1))).toEqual(pending);
  });
});

describe('discarding a save that play could not have produced (§9)', () => {
  it('discards a finished game: a hand played out', async () => {
    const game = playThrough('dm-persist-out');
    const last = game[game.length - 1]!;
    expect(last.ending).toBe('out');
    expect(await load(toPersisted(last, 1))).toBeNull();
  });

  it('discards a finished game: two passes in a row', async () => {
    let blocked: DominoesSession | null = null;
    for (let i = 0; i < 400 && blocked === null; i++) {
      const game = playThrough(`dm-persist-blocked-${i}`);
      const last = game[game.length - 1]!;
      if (last.ending === 'blocked') blocked = last;
    }
    expect(blocked).not.toBeNull();
    expect(await load(toPersisted(blocked!, 1))).toBeNull();
  });

  it('discards a pip value outside 0–6', async () => {
    const bad = record();
    bad.playerHand[0] = [0, 7];
    expect(await load(bad)).toBeNull();
    const line = record();
    line.line[0] = [-1, line.line[0]![1]];
    expect(await load(line)).toBeNull();
  });

  it('discards a hand tile written larger pip first', async () => {
    const bad = record();
    const [a, b] = bad.playerHand.find(([x, y]) => x !== y)!;
    bad.playerHand[bad.playerHand.findIndex(([x, y]) => x === a && y === b)] = [b, a];
    expect(await load(bad)).toBeNull();
  });

  it('discards a set with a tile missing or twice', async () => {
    const twice = record();
    twice.boneyard[0] = twice.playerHand[0]!;
    expect(await load(twice)).toBeNull();
    const missing = record();
    missing.boneyard.pop();
    expect(await load(missing)).toBeNull();
  });

  it('discards a line that does not join', async () => {
    const bad = record();
    const index = bad.line.findIndex(([l, r], i) => l !== r && i > 0);
    bad.line[index] = [bad.line[index]![1], bad.line[index]![0]];
    expect(await load(bad)).toBeNull();
  });

  it('discards an empty line', async () => {
    expect(await load({ ...record(), line: [] })).toBeNull();
  });

  it('discards a boneyard in another order than the seed dealt', async () => {
    const bad = record();
    [bad.boneyard[0], bad.boneyard[1]] = [bad.boneyard[1]!, bad.boneyard[0]!];
    expect(await load(bad)).toBeNull();
  });

  it('discards a position its seed could not have dealt', async () => {
    expect(await load({ ...record(), seed: 'dominoes-some-other-seed' })).toBeNull();
  });

  it('discards a pass with tiles still in the boneyard, or a block', async () => {
    expect(await load({ ...record(), passes: 1 })).toBeNull();
    expect(await load({ ...record(), passes: 2 })).toBeNull();
    expect(await load({ ...record(), passes: 3 })).toBeNull();
  });

  it('discards a move count the position could not add up to', async () => {
    const base = record();
    const least = midGame.line.length + (14 - midGame.boneyard.length);
    expect(base.moveCount).toBeGreaterThanOrEqual(least);
    expect(await load({ ...base, moveCount: least - 1 })).toBeNull();
    expect(await load({ ...base, moveCount: least + midGame.line.length })).toBeNull();
  });

  it('discards the wrong side to move before the opening is answered', async () => {
    const fresh = toPersisted(createSession('dominoes-golden-a'), 1);
    expect(fresh.toMove).toBe(CPU);
    expect(await load({ ...fresh, toMove: PLAYER })).toBeNull();
  });

  it('discards a record missing a field, with a stray side, or from another version', async () => {
    const { boneyard: _dropped, ...withoutBoneyard } = record();
    expect(await load(withoutBoneyard)).toBeNull();
    expect(await load({ ...record(), toMove: 3 })).toBeNull();
    expect(await load({ ...record(), schemaVersion: 2 })).toBeNull();
    expect(await load({ ...record(), seed: '' })).toBeNull();
  });
});
