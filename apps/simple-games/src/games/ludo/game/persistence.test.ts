/**
 * The persistence round-trip (docs/RELEASE_CHECKLIST.md §0, and the reason the
 * match goldens are not enough): compatibility.test.ts pins that the dice and
 * the opponents are deterministic, but it says nothing about SAVED DATA
 * surviving — the field names, the digits the choices are written as, what
 * `rollCount` counts. Every one of those tests builds its record with today's
 * code, so renaming a field or changing the encoding leaves them all green
 * while every suspended match already on a player's device quietly stops
 * loading.
 *
 * The payload below is an actual v1 record this game wrote, pasted in as a
 * literal. **It must not be regenerated to make a change pass.** From here on,
 * a change to the schema is a migration written against this fixture, not an
 * edit to it. Ludo's schema is also reachable through the web release ahead of
 * the tagged one (docs/WEB_VERSION.md), so it is handed out before it is
 * frozen — which is exactly the situation this file exists for.
 */
import { describe, expect, it } from 'vitest';
import { canonicalRecordOf, restoreSession, type PersistedMatch } from './serialize';
import { movablePawns, doRoll } from './session';
import { HOME_PROGRESS, YOU } from './types';

/**
 * A real `ld.saveGame` payload, written by v1 (2026-08-13): a normal-strength
 * match two hundred and two throws in, with thirty-five moves made by the
 * player, suspended at the only state a save can hold — the player about to
 * throw.
 */
const SUSPENDED_PAYLOAD =
  '{"schemaVersion":1,"seed":"ludo-suspended-v1","difficulty":"normal",' +
  '"rollCount":202,"choices":"11111112311111111121222233330100203",' +
  '"elapsedSeconds":412,"savedAt":1754640000000}';

const parsed = (): PersistedMatch => JSON.parse(SUSPENDED_PAYLOAD) as PersistedMatch;

describe('v1 payloads keep loading (schema freeze)', () => {
  it('restores the position that payload means, down to the run of sixes', () => {
    const session = restoreSession(parsed())!;
    expect(session).not.toBeNull();

    // Two hundred and two throws have been made, so the next die drawn is
    // `rollFor(seed, 202)` — the roll count *is* the position in the dice
    // stream (dice.ts), which is why it is the one derived-looking number the
    // record keeps.
    expect(session.state.rollIndex).toBe(202);
    expect(session.state.turn).toBe(YOU);
    expect(session.state.die).toBeNull();

    // One six already thrown in this turn and answered, so the player throws
    // again (§2.1). Nothing in the payload says so: the streak is replayed.
    expect(session.state.sixStreak).toBe(1);
    expect(session.lastRoll!.die).toBe(6);

    // Where the sixteen pawns stand. Seat 0 (the player) has three pawns just
    // out of the yard on its entrance square and one five squares along; seat
    // 1 has a pawn five squares into its home column (57 = 52 + 5) and one
    // still in the yard; seat 2 is barely out; seat 3 already has a pawn home.
    expect(session.state.pawns).toEqual([
      [5, 1, 1, 1],
      [57, 21, 0, 1],
      [0, 5, 0, 0],
      [1, 59, 1, 34],
    ]);
    expect(session.state.pawns[3][1]).toBe(HOME_PROGRESS);

    expect(session.difficulty).toBe('normal');
    expect(session.seed).toBe('ludo-suspended-v1');
    expect(session.elapsedSeconds).toBe(412);
    expect(session.status).toBe('playing');
    expect(session.choices).toHaveLength(35);
  });

  it('comes back playable, on the throw the player was about to make', () => {
    const session = restoreSession(parsed())!;
    // Nothing to move until the die is thrown, and a real die when it is.
    expect(movablePawns(session)).toEqual([]);
    const thrown = doRoll(session)!;
    expect(thrown.state.rollIndex).toBe(203);
    expect(thrown.lastRoll!.die).toBeGreaterThanOrEqual(1);
    expect(thrown.lastRoll!.die).toBeLessThanOrEqual(6);
  });

  it('round-trips: what the game writes today is the same record', () => {
    const record = parsed();
    const rewritten = canonicalRecordOf(restoreSession(record)!, record.savedAt);
    expect(rewritten).toEqual(record);
  });
});

describe('fail-closed against a tampered copy of the frozen payload', () => {
  const tamperedWith = (changes: Partial<PersistedMatch>): PersistedMatch => ({
    ...parsed(),
    ...changes,
  });

  it('discards a payload whose roll count no longer fits its choices', () => {
    expect(restoreSession(tamperedWith({ rollCount: 201 }))).toBeNull();
    expect(restoreSession(tamperedWith({ rollCount: 203 }))).toBeNull();
  });

  it('discards a payload whose history stops fitting a digit later on', () => {
    // The first digit is the interesting one: at that moment (roll 36, a six,
    // all four pawns in the yard) **every** pawn was legal, so a local check
    // of that one step would wave `0` through. It is refused all the same,
    // because a replay is not a check of one step — thirty-four moves further
    // on, this history no longer fits the board the swap produced, and the
    // record is dropped whole rather than partly believed.
    expect(restoreSession(tamperedWith({ choices: `0${parsed().choices.slice(1)}` }))).toBeNull();
  });

  it('discards a payload from a schema this build does not know', () => {
    expect(restoreSession(tamperedWith({ schemaVersion: 2 as unknown as 1 }))).toBeNull();
  });

  it('discards a payload whose seed was swapped under its history', () => {
    // Same choices, different dice: the match those thirty-five moves were
    // made in does not exist on this seed.
    expect(restoreSession(tamperedWith({ seed: 'ludo-suspended-v2' }))).toBeNull();
  });

  it('reads a strength swap as another match, never as a repair of this one', () => {
    // Worth being exact about, because it is not a refusal. The strength is
    // part of what the record identifies, and the CPU seats' moves are derived
    // from it, so the same thirty-five choices replayed against hard opponents
    // describe a *different* match — one this history happens to stay legal
    // in. Nothing is corrected and nothing is carried over from the normal
    // match: what comes back is the hard match, board and all.
    const elsewhere = restoreSession(tamperedWith({ difficulty: 'hard' }));
    expect(elsewhere).not.toBeNull();
    expect(elsewhere!.difficulty).toBe('hard');
    expect(elsewhere!.state.pawns).not.toEqual(restoreSession(parsed())!.state.pawns);
  });
});
