/**
 * The records a released build actually wrote, read by today's validators
 * (RELEASE_CHECKLIST §0, graduation of the web-beta title, 2026-10-02;
 * docs/YACHT_RULES.md §7, §8).
 *
 * This file freezes Yacht's save schema at the moment it moves from the web
 * beta into the app. From here on a stored shape changes by migration, and a
 * validator is only proven by data it did not generate itself: building a
 * payload from `defaultValue()` or `toPersisted()` would follow the schema
 * wherever the schema went and prove nothing.
 *
 * Provenance: played in the PUBLISHED web build (pixapps-landing 7e536db,
 * built from simple-games 74b4e58), served locally with every external
 * request blocked and a fresh localStorage. The game was driven through its
 * own UI with a browser automation (clicks on the tutorial, the dice, the
 * Roll button and the score boxes — no storage writes, no game internals):
 * the tutorial, seven whole matches (all lost to the CPU, so `wins` and
 * `draws` are 0 here), then an eighth match left through Back to Home in the
 * middle of the player's turn — two throws used, two dice kept. The three
 * strings below are what Capacitor Preferences held afterwards, copied
 * verbatim; none is hand-built. Yacht has no preferences record and no daily
 * (the keys are `yt.flags`, `yt.stats`, `yt.saveGame`), so this covers every
 * key it writes.
 *
 * Against today's tree (`git rev-parse 74b4e58:<path> HEAD:<path>`):
 * `storage/schemas.ts` 4e9eecb, `storage/keys.ts` d7a76a4,
 * `storage/gamePersistence.ts` 8b80efa and the `game/` tree b6e9523 are all
 * identical to 74b4e58. What the published build wrote is therefore what
 * today's code reads, and nothing here is a changed-since-capture assumption.
 *
 * Do not regenerate these strings to make a change go green: a payload that
 * has to be rewritten is a payload existing players cannot load either. From
 * now on these records change only by migration.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import {
  CATEGORIES,
  createSession,
  drawFaces,
  roll,
  score,
  statusOf,
  toMove,
  totalOf,
  cpuTotalOf,
  type YachtSession,
} from '../game';
import { loadSavedGame, saveGame } from './gamePersistence';
import { flagsSchema, gameSchema, statsSchema, YT_STORAGE_KEYS } from './schemas';

/** Capacitor Preferences, as it stood after eight matches in the browser. */
const RELEASED: Record<string, string> = {
  [YT_STORAGE_KEYS.flags]: '{"schemaVersion":1,"tutorialCompleted":true}',
  [YT_STORAGE_KEYS.stats]:
    '{"schemaVersion":2,"played":8,"completed":7,"bestScore":143,"totalScore":738,' +
    '"totalPlaySeconds":368,"wins":0,"losses":7,"draws":0}',
  [YT_STORAGE_KEYS.game]:
    '{"schemaVersion":2,"seed":"yacht-muqqbkpo-7qe3m","rollIndex":14,"dice":[3,6,2,1,4],' +
    '"held":[false,true,false,true,false],"rollsUsed":2,' +
    '"scores":[3,null,6,null,null,null,null,null,null,null,20,null],' +
    '"cpuScores":[null,null,6,12,null,null,null,20,null,null,null,null],' +
    '"elapsedSeconds":43,"savedAt":1790931454382}',
};

const SAVED_AT = 1790931454382;

const released = () => createMemoryKV({ ...RELEASED });

/** A sheet by box name, so the expectations read as the sheet does. */
const sheet = (boxes: Partial<Record<(typeof CATEGORIES)[number], number>>) =>
  CATEGORIES.map((category) => boxes[category] ?? null);

describe('records a released build wrote', () => {
  it('reads the one-time flags', async () => {
    expect(await loadRecord(flagsSchema, released())).toEqual({
      schemaVersion: 1,
      tutorialCompleted: true,
    });
  });

  it('reads every statistic, not a default in the shape of one', async () => {
    expect(await loadRecord(statsSchema, released())).toEqual({
      schemaVersion: 2,
      played: 8,
      completed: 7,
      bestScore: 143,
      totalScore: 738,
      totalPlaySeconds: 368,
      wins: 0,
      losses: 7,
      draws: 0,
    });
  });

  it('reads the saved record field by field', async () => {
    expect(await loadRecord(gameSchema, released())).toEqual({
      schemaVersion: 2,
      seed: 'yacht-muqqbkpo-7qe3m',
      rollIndex: 14,
      dice: [3, 6, 2, 1, 4],
      held: [false, true, false, true, false],
      rollsUsed: 2,
      scores: [3, null, 6, null, null, null, null, null, null, null, 20, null],
      cpuScores: [null, null, 6, 12, null, null, null, 20, null, null, null, null],
      elapsedSeconds: 43,
      savedAt: SAVED_AT,
    });
  });

  it('restores the suspended match down to the die and the box', async () => {
    const session = await loadSavedGame(released());
    expect(session).not.toBeNull();
    // The player's sheet: Ones 3, Threes 6, Choice 20 (29 in all).
    expect(session!.scores).toEqual(sheet({ ones: 3, threes: 6, choice: 20 }));
    // The CPU's: Threes 6, Fours 12, Four of a Kind 20 (38 in all).
    expect(session!.cpuScores).toEqual(sheet({ threes: 6, fours: 12, fourOfAKind: 20 }));
    expect(totalOf(session!)).toBe(29);
    expect(cpuTotalOf(session!)).toBe(38);
    // Left in the middle of the player's fourth turn: two throws used, the
    // second and fourth dice kept.
    expect(session!.dice).toEqual([3, 6, 2, 1, 4]);
    expect(session!.held).toEqual([false, true, false, true, false]);
    expect(session!.rollsUsed).toBe(2);
    expect(toMove(session!)).toBe('player');
    // The seed and the throw counter are what make the next throw the one
    // this match would have dealt.
    expect(session!.seed).toBe('yacht-muqqbkpo-7qe3m');
    expect(session!.rollIndex).toBe(14);
    // The seconds on the match are part of it: dropping them here is how a
    // resumed game quietly reports someone else's play time (issue #109).
    expect(session!.elapsedSeconds).toBe(43);
    expect(statusOf(session!)).toBe('playing');
  });

  it('goes on from where it was left: the next throw is the match’s own', async () => {
    const session = await loadSavedGame(released());
    const next = roll(session!, 'player');
    expect(next).not.toBeNull();
    const faces = drawFaces('yacht-muqqbkpo-7qe3m', 14);
    // Kept dice stay; the others take the faces throw 14 draws for them.
    expect(next!.dice).toEqual([faces[0], 6, faces[2], 1, faces[4]]);
    expect(next!.rollIndex).toBe(15);
    expect(next!.rollsUsed).toBe(3);
    // And the open box it lands in is taken as it would have been.
    const taken = score(next!, 'player', 'sixes');
    expect(taken).not.toBeNull();
    expect(taken!.scores[CATEGORIES.indexOf('sixes')]).toBe(
      next!.dice.filter((d) => d === 6).length * 6,
    );
  });
});

describe('data it cannot use', () => {
  const cases: [string, string][] = [
    ['a version it does not know', '{"schemaVersion":99,"tutorialCompleted":true}'],
    ['text that is not JSON', '{"schemaVersion":2,'],
    ['the wrong shape entirely', '[]'],
  ];

  it.each(cases)('falls back to the flags default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [YT_STORAGE_KEYS.flags]: raw });
    expect(await loadRecord(flagsSchema, kv)).toEqual(flagsSchema.defaultValue());
  });

  it.each(cases)('falls back to the statistics default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [YT_STORAGE_KEYS.stats]: raw });
    expect(await loadRecord(statsSchema, kv)).toEqual(statsSchema.defaultValue());
  });

  it.each(cases)('offers no match to resume for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [YT_STORAGE_KEYS.game]: raw });
    expect(await loadRecord(gameSchema, kv)).toBeNull();
    expect(await loadSavedGame(kv)).toBeNull();
  });

  it('discards a match whose sheets are out of step rather than repairing it', async () => {
    // The CPU three boxes ahead of the player is not a match play could have
    // reached (§8): the record is dropped, not trimmed to fit.
    const kv = createMemoryKV({
      [YT_STORAGE_KEYS.game]: RELEASED[YT_STORAGE_KEYS.game]!.replace(
        '"scores":[3,null,6,null,null,null,null,null,null,null,20,null]',
        '"scores":[null,null,null,null,null,null,null,null,null,null,null,null]',
      ),
    });
    expect(await loadSavedGame(kv)).toBeNull();
  });
});

describe('a suspended match comes back the way it was left', () => {
  it('survives the round trip through storage, written by today’s code', async () => {
    const original = (await loadSavedGame(released())) as YachtSession;
    const kv = createMemoryKV();
    await saveGame(original, kv);
    const restored = await loadSavedGame(kv);
    expect(restored).toEqual(original);

    // Re-saved, it is the released record again, field for field: nothing was
    // added, renamed or reinterpreted on the way through. Only the save time
    // is new, so it is the one field set aside.
    const written = JSON.parse((await kv.get(YT_STORAGE_KEYS.game)) ?? 'null') as Record<
      string,
      unknown
    >;
    const { savedAt: writtenAt, ...rest } = written;
    const { savedAt: _released, ...releasedRest } = JSON.parse(RELEASED[YT_STORAGE_KEYS.game]!);
    expect(typeof writtenAt).toBe('number');
    expect(rest).toEqual(releasedRest);
  });

  it('survives the round trip for a match begun with today’s code too', async () => {
    let session = roll(createSession('yacht-released-records'), 'player')!;
    session = score(session, 'player', 'choice')!;
    const kv = createMemoryKV();
    await saveGame(session, kv);
    expect(await loadSavedGame(kv)).toEqual(session);
  });
});
