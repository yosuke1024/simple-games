/**
 * The two saved-game slots. Both hold the same record shape, so the KEY is
 * what says which mode a record is — and a record that disagrees with its key
 * is corrupt data, not an instruction to change modes. Loading one would send
 * a player who asked to resume their level game into the daily slot: the
 * other game, or a blank screen where the other game isn't.
 *
 * The second half is the fail-closed half of §11, and Kakuro can be strict
 * about it because the whole puzzle travels with the save: a layout whose
 * white cells do not split into legal runs, or an answer that repeats a digit
 * inside one, would leave the player with a board that cannot be finished.
 *
 * Every rejection below is checked through `decodeGame` in the game layer, not
 * against a second copy of the rules living in storage/ — which is the point
 * of the split, and what these cases are really pinning.
 */
import { describe, expect, it } from 'vitest';
import { cluesOf, createDailySession, createLevelSession } from '../game';
import { toPersisted, toSession } from './gamePersistence';
import { dailyGameSchema, gameSchema } from './schemas';

const SAVED_AT = 1_754_000_000_000;
const levelSession = createLevelSession(1);
const levelRecord = toPersisted(levelSession, SAVED_AT);
const dailyRecord = toPersisted(createDailySession('2026-08-07'), SAVED_AT);

/** The first cell the player writes in, and the first that carries a sum. */
const whiteIndex = levelSession.table.white[0]!;
const clueIndex = levelSession.table.runs[0]!.clue;
/** Its neighbour in the same horizontal run — the pair rule 1 speaks about. */
const runNeighbour = levelSession.table.runs[0]!.cells[1]!;

/** Replaces one character of a grid string. */
const withCharacter = (grid: string, index: number, character: string): string =>
  grid.slice(0, index) + character + grid.slice(index + 1);

/** Replaces one note mask, which travels comma-separated rather than packed. */
const withNote = (notes: string, index: number, mask: string): string => {
  const masks = notes.split(',');
  masks[index] = mask;
  return masks.join(',');
};

describe('saved-game slots', () => {
  it('loads each record from its own slot', () => {
    expect(gameSchema.validate(levelRecord)?.mode).toBe('level');
    expect(dailyGameSchema.validate(dailyRecord)?.mode).toBe('daily');
  });

  it('refuses a record written for the other mode', () => {
    // Both records are what the game itself writes, and both are otherwise
    // perfectly valid. The only thing wrong is the slot they are sitting in.
    expect(gameSchema.validate(dailyRecord)).toBeNull();
    expect(dailyGameSchema.validate(levelRecord)).toBeNull();
  });

  it('refuses a record whose size the game does not have', () => {
    expect(gameSchema.validate({ ...levelRecord, size: 7 })).toBeNull();
    expect(gameSchema.validate({ ...levelRecord, size: 12 })).toBeNull();
  });
});

describe('the clues are rebuilt, never read back (§11)', () => {
  it('does not write them in the first place', () => {
    // The record has no field to hold a sum, which is why a stale clue is not
    // a state this game can reach — in a save file or anywhere else.
    expect(Object.keys(levelRecord).sort()).toEqual([
      'dailyDate',
      'elapsedSeconds',
      'entries',
      'hintCount',
      'layout',
      'level',
      'mistakeCount',
      'mode',
      'notes',
      'savedAt',
      'schemaVersion',
      'seed',
      'size',
      'solution',
    ]);
  });

  it('adds them back up from the layout and the answer', () => {
    const resumed = toSession(levelRecord);
    expect(resumed?.level).toBe(1);
    expect(resumed?.history).toEqual([]);
    // Not "some clues": the same clues, cell for cell, as the board that was
    // generated from the seed.
    expect(resumed === null ? null : cluesOf(resumed)).toEqual(cluesOf(levelSession));
  });
});

describe('a save play could not have produced (§11)', () => {
  it('drops a layout with a run of one cell', () => {
    // Turning one clue cell white here leaves a single white cell walled in on
    // both sides: its clue would be its answer, which is a printed digit
    // rather than a square to solve (§1).
    const cells = [...levelSession.layout.cells];
    const lone = cells.findIndex(
      (_cell, index) =>
        index > levelSession.size &&
        index % levelSession.size > 0 &&
        cells[index] === 0 &&
        cells[index - 1] === 0 &&
        cells[index + 1] === 0,
    );
    expect(lone).toBeGreaterThan(0);
    const layout = withCharacter(levelRecord.layout, lone, '.');
    expect(toSession({ ...levelRecord, layout })).toBeNull();
  });

  it('drops a layout with white cells on the top row', () => {
    // Two of them, so the row itself holds a legal two-cell run: what is wrong
    // is that a column starting on row 0 has nowhere to write its sum (§1).
    const layout = withCharacter(withCharacter(levelRecord.layout, 1, '.'), 2, '.');
    expect(toSession({ ...levelRecord, layout })).toBeNull();
  });

  it('drops a layout with a white cell in the left column', () => {
    const left = levelSession.size * 2;
    const layout = withCharacter(levelRecord.layout, left, '.');
    expect(toSession({ ...levelRecord, layout })).toBeNull();
  });

  it('drops a layout whose white cells fall into two islands', () => {
    // Two 2×2 blocks in opposite corners. Every run is two cells long and
    // nothing sits on either rail, so this passes each local rule and is still
    // not a board: it is two puzzles drawn inside one grid, and no deduction
    // ever crosses from one to the other (§1).
    const layout = ['######', '#..###', '#..###', '######', '####..', '####..'].join('');
    const solution = ['......', '.12...', '.34...', '......', '....12', '....34'].join('');
    const entries = '.'.repeat(36);
    const notes = new Array<string>(36).fill('0').join(',');
    expect(toSession({ ...levelRecord, layout, solution, entries, notes })).toBeNull();
  });

  it('drops a layout with no white cells at all', () => {
    const layout = '#'.repeat(36);
    const solution = '.'.repeat(36);
    const entries = '.'.repeat(36);
    const notes = new Array<string>(36).fill('0').join(',');
    expect(toSession({ ...levelRecord, layout, solution, entries, notes })).toBeNull();
  });

  it('drops an answer that repeats a digit inside one run', () => {
    // Rule 1, the invariant everything else leans on (§3). Rule 2 is not
    // checked and does not need to be: the clues are added up from this very
    // answer, so a run adds to its clue by construction.
    const solution = withCharacter(
      levelRecord.solution,
      runNeighbour,
      levelRecord.solution[whiteIndex]!,
    );
    expect(solution).not.toBe(levelRecord.solution);
    expect(toSession({ ...levelRecord, solution })).toBeNull();
  });

  it('drops an answer with a white cell left blank', () => {
    const solution = withCharacter(levelRecord.solution, whiteIndex, '.');
    expect(toSession({ ...levelRecord, solution })).toBeNull();
  });

  it('drops an entry written on a clue cell', () => {
    // This game's whole corruption test for a fixed digit. There are no
    // givens to write over, because there are no givens at all (§1).
    const entries = withCharacter(levelRecord.entries, clueIndex, '1');
    expect(toSession({ ...levelRecord, entries })).toBeNull();
  });

  it('drops a note on a clue cell, and one left under a written digit', () => {
    expect(
      toSession({ ...levelRecord, notes: withNote(levelRecord.notes, clueIndex, '1') }),
    ).toBeNull();
    // Placing a digit clears the notes beneath it (§4), so a mask on a filled
    // cell is a state play cannot reach.
    const entries = withCharacter(levelRecord.entries, whiteIndex, '1');
    const notes = withNote(levelRecord.notes, whiteIndex, '1');
    expect(toSession({ ...levelRecord, entries, notes })).toBeNull();
  });

  it('drops a note holding a bit outside 1 to 9', () => {
    // Bit 10 — a digit no Kakuro has at any size (§3).
    const notes = withNote(levelRecord.notes, whiteIndex, (1 << 9).toString(32));
    expect(toSession({ ...levelRecord, notes })).toBeNull();
  });

  it('drops a grid of the wrong length, and one with characters it never writes', () => {
    expect(toSession({ ...levelRecord, layout: levelRecord.layout.slice(1) })).toBeNull();
    expect(toSession({ ...levelRecord, solution: levelRecord.solution.slice(1) })).toBeNull();
    expect(toSession({ ...levelRecord, entries: levelRecord.entries.slice(1) })).toBeNull();
    expect(toSession({ ...levelRecord, notes: levelRecord.notes.slice(2) })).toBeNull();
    expect(
      toSession({ ...levelRecord, layout: withCharacter(levelRecord.layout, 0, 'x') }),
    ).toBeNull();
    expect(
      toSession({ ...levelRecord, entries: withCharacter(levelRecord.entries, whiteIndex, '0') }),
    ).toBeNull();
  });

  it('does not resume a game that is already finished', () => {
    // A solved board is a result screen, not a game to come back to.
    expect(toSession({ ...levelRecord, entries: levelRecord.solution })).toBeNull();
  });
});
