/**
 * The saved game's first migration: v1 → v2, the piece colours
 * (docs/BLOCK_PUZZLE_RULES.md §10, §12).
 *
 * v2 widens the board's alphabet from '0'/'1' to '0'–'9' — a filled cell is
 * written as its tone — and changes nothing else. A v1 '1' was drawn in the
 * accent, and the accent is tone 1, so a v1 board carries over as the same
 * 64 characters. This file proves that against the record a released build
 * actually wrote, not against one this build made up.
 *
 * Provenance of V1_GAME: copied verbatim from storage/releasedRecords.test.ts
 * (RELEASED[BP_STORAGE_KEYS.game]), which says how it was captured. That file
 * is the golden record and is not edited; this one only reads the same string.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import {
  CELL_COUNT,
  createSession,
  encodeBoard,
  LEGACY_TONE,
  placePiece,
  restoreSession,
  toneOfPiece,
  type BlockSession,
} from '../game';
import { loadSavedGame, saveGame, toPersisted } from './gamePersistence';
import { BP_STORAGE_KEYS, gameSchema } from './schemas';

const V1_BOARD = '1011001011110111111111001110010000000000100000000000000000000000';

const V1_GAME =
  '{"schemaVersion":1,"seed":"block-mtt7255a-5aanr",' +
  `"board":"${V1_BOARD}",` +
  '"tray":"3ch","score":58,"batchIndex":4,"linesCleared":2,"elapsedSeconds":31,' +
  '"savedAt":1788903705422}';

const kvWith = (raw: string) => createMemoryKV({ [BP_STORAGE_KEYS.game]: raw });

/** The JSON a save left in the store. */
async function stored(kv: ReturnType<typeof createMemoryKV>): Promise<Record<string, unknown>> {
  const raw = await kv.get(BP_STORAGE_KEYS.game);
  expect(raw).not.toBeNull();
  return JSON.parse(raw!) as Record<string, unknown>;
}

describe('a v1 record (§10)', () => {
  it('is read as v2 with the same board text, nothing reinterpreted', async () => {
    expect(gameSchema.version).toBe(2);
    const record = await loadRecord(gameSchema, kvWith(V1_GAME));
    expect(record).toEqual({
      schemaVersion: 2,
      seed: 'block-mtt7255a-5aanr',
      board: V1_BOARD,
      tray: '3ch',
      score: 58,
      batchIndex: 4,
      linesCleared: 2,
      elapsedSeconds: 31,
      savedAt: 1788903705422,
    });
  });

  it('resumes with every filled square in the accent it was drawn in', async () => {
    const session = await loadSavedGame(kvWith(V1_GAME));
    expect(session).not.toBeNull();
    expect(encodeBoard(session!.board)).toBe(V1_BOARD);
    session!.board.forEach((filled, index) => {
      expect(session!.tones[index], `cell ${index}`).toBe(filled ? LEGACY_TONE : 0);
    });
  });

  it('is saved back as v2 with the same 64 characters', async () => {
    const session = await loadSavedGame(kvWith(V1_GAME));
    const kv = createMemoryKV();
    await saveGame(session!, kv);
    const written = await stored(kv);
    expect(written.schemaVersion).toBe(2);
    expect(written.board).toBe(V1_BOARD);
    expect(written.tray).toBe('3ch');
  });

  it('is played on, saved as v2 and read back with old and new squares told apart', async () => {
    // The path a player who updates mid-game takes: resume the v1 board, lay
    // one piece, suspend, resume again. The squares from before the update
    // stay the accent; the new piece wears its family's pigment.
    const resumed = await loadSavedGame(kvWith(V1_GAME));
    expect(resumed).not.toBeNull();
    // Slot 0 of "3ch" is piece 3, the 1×3 bar, laid along the empty bottom
    // row: nothing is cleared, so every square is still on the board to read.
    expect(resumed!.tray[0]).toBe(3);
    const played = placePiece(resumed!, 0, 7, 0)!;
    expect(played).not.toBeNull();
    expect(played.linesCleared).toBe(resumed!.linesCleared);

    const kv = createMemoryKV();
    await saveGame(played, kv);
    const written = await stored(kv);
    expect(written.schemaVersion).toBe(2);
    const bar = String(toneOfPiece(3));
    expect(written.board).toBe(`${V1_BOARD.slice(0, 56)}${bar.repeat(3)}00000`);

    const again = await loadSavedGame(kv);
    expect(again).not.toBeNull();
    expect(again!.board).toEqual(played.board);
    const placed = new Set([56, 57, 58]);
    again!.board.forEach((filled, index) => {
      const expected = !filled ? 0 : placed.has(index) ? toneOfPiece(3) : LEGACY_TONE;
      expect(again!.tones[index], `cell ${index}`).toBe(expected);
    });
  });

  it('is refused when its board holds a digit no v1 build wrote', async () => {
    // The wider alphabet belongs to v2. A v1 record with a '2' is not a
    // board with an indigo square in it; it is a record from something else.
    const tampered = V1_GAME.replace(`"${V1_BOARD}"`, `"2${V1_BOARD.slice(1)}"`);
    expect(tampered).not.toBe(V1_GAME);
    expect(await loadRecord(gameSchema, kvWith(tampered))).toBeNull();
    expect(await loadSavedGame(kvWith(tampered))).toBeNull();
  });
});

describe('a v2 record (§10, §12)', () => {
  /** A few pieces down from different families, wherever they legally go. */
  function paintedSession(): BlockSession {
    let session = restoreSession({
      seed: 'block-v2-test',
      board: new Array<boolean>(CELL_COUNT).fill(false),
      // A single square, a two-bar and a small corner: bengara, celadon, ochre.
      tray: [0, 1, 11],
      score: 0,
      batchIndex: 0,
      linesCleared: 0,
      elapsedSeconds: 0,
    });
    session = placePiece(session, 0, 0, 0)!;
    session = placePiece(session, 1, 2, 0)!;
    session = placePiece(session, 2, 4, 4)!;
    return session;
  }

  it('round-trips a board painted in several tones', async () => {
    const session = paintedSession();
    const kv = createMemoryKV();
    await saveGame(session, kv);
    const written = await stored(kv);
    expect(written.schemaVersion).toBe(2);
    expect(written.board).toMatch(/^[0-9]{64}$/);
    expect(String(written.board).charAt(0)).toBe(String(toneOfPiece(0)));

    const restored = await loadSavedGame(kv);
    expect(restored).not.toBeNull();
    expect(restored!.board).toEqual(session.board);
    session.board.forEach((filled, index) => {
      expect(restored!.tones[index], `cell ${index}`).toBe(filled ? session.tones[index] : 0);
    });
    expect(restored!.tray).toEqual(session.tray);
    expect(restored!.batchIndex).toBe(session.batchIndex);
  });

  it('keeps a board whose tone this build does not paint', async () => {
    // A newer build may add a colour; the board must not be lost for it. The
    // stylesheet draws an unknown tone in the accent.
    const persisted = toPersisted(createSession('block-golden'), 1);
    const board = `9${persisted.board.slice(1)}`;
    const session = await loadSavedGame(kvWith(JSON.stringify({ ...persisted, board })));
    expect(session).not.toBeNull();
    expect(session!.board[0]).toBe(true);
    expect(session!.tones[0]).toBe(9);
  });

  it('is refused when its board holds anything but digits', async () => {
    const persisted = toPersisted(createSession('block-golden'), 1);
    for (const bad of ['a', '-', ' ']) {
      const raw = JSON.stringify({ ...persisted, board: `${bad}${persisted.board.slice(1)}` });
      expect(await loadRecord(gameSchema, kvWith(raw)), bad).toBeNull();
    }
  });

  it('is refused at a version this build does not know', async () => {
    const persisted = toPersisted(createSession('block-golden'), 1);
    for (const schemaVersion of [0, 3, 99, '2']) {
      const raw = JSON.stringify({ ...persisted, schemaVersion });
      expect(await loadRecord(gameSchema, kvWith(raw)), String(schemaVersion)).toBeNull();
    }
  });
});
