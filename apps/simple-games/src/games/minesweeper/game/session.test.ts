/**
 * One game, start to finish (docs/MINESWEEPER_RULES.md §2, §4, §7, §8, §10) —
 * including the two things this title refuses to have: a board you can lose to
 * luck, and an undo.
 */
import { describe, expect, it } from 'vitest';
import * as gameModule from './index';
import { cellAndNeighbours } from './board';
import { addDays, DAILY_DIFFICULTY, dailySeed, dayDifference, localDateString } from './daily';
import { isLost, isWon, remainingMines } from './engine';
import { decodeBoard, encodeBoard } from './serialize';
import * as sessionModule from './session';
import {
  chordCell,
  countHintUse,
  createDailySession,
  createDifficultySession,
  difficultySeed,
  flagCell,
  hasStarted,
  hintFor,
  newSeedToken,
  presetOf,
  restartSession,
  restoreSession,
  tapCell,
  type MinesweeperSession,
} from './session';
import { cellCount, PRESETS } from './types';

const CENTRE = 40; // (4,4) on the 9x9 easy board.

const started = (seed = 'mines-easy-test', first = CENTRE): MinesweeperSession =>
  tapCell(createDifficultySession('easy', seed), first)!;

describe('a new difficulty game (§8)', () => {
  it('has no mines until the first tap names a cell (§4)', () => {
    const session = createDifficultySession('easy', 'mines-easy-test');
    expect(hasStarted(session)).toBe(false);
    expect(session.firstIndex).toBeNull();
    expect(session.board.field.mines.some(Boolean)).toBe(false);
    expect(session.board.opened.some(Boolean)).toBe(false);
    expect(session.status).toBe('playing');
    expect(session.mode).toBe('difficulty');
    expect(session.dailyDate).toBeNull();
    expect(presetOf(session)).toEqual(PRESETS.easy);
  });

  it('refuses a flag before the first tap: there is nothing to reason about yet', () => {
    const session = createDifficultySession('easy', 'mines-easy-test');
    expect(flagCell(session, 0)).toBeNull();
    expect(hintFor(session)).toBeNull();
  });

  it('gives each new game its own seed', () => {
    expect(newSeedToken(1000, () => 0.5)).toBe(newSeedToken(1000, () => 0.5));
    expect(newSeedToken(1000, () => 0.5)).not.toBe(newSeedToken(1001, () => 0.5));
    expect(difficultySeed('hard', 'abc')).toBe('mines-hard-abc');
    expect(createDifficultySession('easy').seed).not.toBe(createDifficultySession('easy').seed);
  });
});

describe('the first tap (§4)', () => {
  it('is always safe, always a 0, and always opens a region', () => {
    for (const first of [0, 8, 40, 72, 80]) {
      const session = started('mines-first-tap', first);
      const around = cellAndNeighbours(9, 9, first);
      for (const cell of around) expect(session.board.field.mines[cell], `${first}`).toBe(false);
      expect(session.board.field.counts[first]).toBe(0);
      expect(session.board.opened.filter(Boolean).length).toBeGreaterThanOrEqual(around.length);
      expect(session.status).toBe('playing');
      expect(hasStarted(session)).toBe(true);
    }
  });

  it('lays exactly as many mines as the preset promises, and counts them', () => {
    const session = started();
    expect(session.board.field.mines.filter(Boolean)).toHaveLength(PRESETS.easy.mines);
    expect(remainingMines(session.board)).toBe(PRESETS.easy.mines);
    expect(session.board.opened.length).toBe(cellCount(PRESETS.easy));
  });
});

describe('restart (§2)', () => {
  it('rebuilds the identical board — same seed, same first tap, same mines', () => {
    let session = started('mines-restart', CENTRE);
    // Play a little, including something that can be lost.
    const mine = session.board.field.mines.findIndex(Boolean);
    session = flagCell(session, mine)!;
    const lost = tapCell(session, session.board.field.mines.findIndex((m, i) => m && i !== mine))!;
    expect(isLost(lost.board)).toBe(true);

    const again = restartSession(lost);
    expect(again.seed).toBe(lost.seed);
    expect(again.firstIndex).toBe(CENTRE);
    expect(again.board.field.mines).toEqual(lost.board.field.mines);
    // The opening region is back exactly as it was, and nothing else is.
    expect(again.board.opened).toEqual(started('mines-restart', CENTRE).board.opened);
    expect(again.board.flagged.some(Boolean)).toBe(false);
    expect(again.status).toBe('playing');
    expect(again.elapsedSeconds).toBe(0);
    expect(again.hintCount).toBe(0);
  });

  it('leaves an untouched game untouched', () => {
    const session = createDifficultySession('medium', 'mines-medium-test');
    const again = restartSession(session);
    expect(again.seed).toBe(session.seed);
    expect(again.firstIndex).toBeNull();
    expect(hasStarted(again)).toBe(false);
  });

  it('rebuilds a daily from its date', () => {
    const session = tapCell(createDailySession('2026-08-03'), CENTRE)!;
    const again = restartSession(session);
    expect(again.dailyDate).toBe('2026-08-03');
    expect(again.board.field.mines).toEqual(session.board.field.mines);
  });
});

describe('playing (§2, §3)', () => {
  it('ends the game when a mine is opened, and takes no more moves', () => {
    const session = started('mines-lose');
    const mine = session.board.field.mines.findIndex(Boolean);
    const lost = tapCell(session, mine)!;
    expect(lost.status).toBe('lost');
    expect(isLost(lost.board)).toBe(true);
    expect(tapCell(lost, 0)).toBeNull();
    expect(flagCell(lost, 0)).toBeNull();
    expect(chordCell(lost, session.board.opened.findIndex(Boolean))).toBeNull();
  });

  it('is won when every cell without a mine is open, whatever the flags say', () => {
    let session = started('mines-win');
    for (let i = 0; i < session.board.opened.length; i++) {
      if (session.board.field.mines[i]) continue;
      const next = tapCell(session, i);
      if (next) session = next;
    }
    expect(session.status).toBe('won');
    expect(isWon(session.board)).toBe(true);
    expect(session.board.flagged.some(Boolean)).toBe(false);
  });

  it('toggles a flag and refuses to open the cell under it', () => {
    const session = started('mines-flag');
    const shut = session.board.opened.findIndex((isOpen) => !isOpen);
    const flagged = flagCell(session, shut)!;
    expect(flagged.board.flagged[shut]).toBe(true);
    expect(tapCell(flagged, shut)).toBeNull();
    expect(flagCell(flagged, shut)!.board.flagged[shut]).toBe(false);
  });
});

describe('hint (§7)', () => {
  it('names a safe cell and the numbers proving it, without opening anything', () => {
    const session = started('mines-hint');
    const hint = hintFor(session)!;
    expect(hint).not.toBeNull();
    expect(session.board.field.mines[hint.index]).toBe(false);
    expect(session.board.opened[hint.index]).toBe(false);
    for (const reason of hint.reason) expect(session.board.opened[reason]).toBe(true);
    // Taking a hint changes the count and nothing else on the board.
    const counted = countHintUse(session);
    expect(counted.hintCount).toBe(1);
    expect(counted.board).toBe(session.board);
  });

  it('has an answer at every step of a whole game, and never a mine (§4)', () => {
    let session = started('mines-hint-walk');
    let guard = 0;
    while (session.status === 'playing' && guard++ <= cellCount(PRESETS.easy)) {
      const hint = hintFor(session);
      expect(hint, `stalled after ${guard} hints`).not.toBeNull();
      expect(session.board.field.mines[hint!.index]).toBe(false);
      session = tapCell(session, hint!.index)!;
    }
    expect(session.status).toBe('won');
  });
});

describe('undo (§7)', () => {
  it('does not exist — not in the session, not in the barrel', () => {
    const names = [...Object.keys(sessionModule), ...Object.keys(gameModule)];
    expect(names.filter((name) => /undo|history|revert|rewind/i.test(name))).toEqual([]);
  });
});

describe('daily dates (§8)', () => {
  it('is medium every day and carries its date', () => {
    const monday = createDailySession('2026-08-03');
    const saturday = createDailySession('2026-08-08');
    expect(monday.difficulty).toBe(DAILY_DIFFICULTY);
    expect(saturday.difficulty).toBe(monday.difficulty);
    expect(monday.dailyDate).toBe('2026-08-03');
    expect(monday.seed).toBe(dailySeed('2026-08-03'));
    expect(monday.mode).toBe('daily');
  });

  it('gives different days different boards', () => {
    const a = tapCell(createDailySession('2026-08-03'), CENTRE)!;
    const b = tapCell(createDailySession('2026-08-04'), CENTRE)!;
    expect(a.board.field.mines).not.toEqual(b.board.field.mines);
  });

  it('formats, shifts and subtracts local dates', () => {
    expect(localDateString(new Date(2026, 7, 3))).toBe('2026-08-03');
    expect(addDays('2026-08-03', 1)).toBe('2026-08-04');
    expect(addDays('2026-08-01', -1)).toBe('2026-07-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(dayDifference('2026-08-03', '2026-08-04')).toBe(1);
    expect(dayDifference('2026-08-04', '2026-08-03')).toBe(-1);
    expect(dayDifference('2026-03-28', '2026-03-30')).toBe(2);
  });
});

describe('serialization (§10)', () => {
  it('round-trips a played board', () => {
    let session = started('mines-serialize');
    session = flagCell(session, session.board.field.mines.findIndex(Boolean))!;
    const decoded = decodeBoard(encodeBoard(session.board), PRESETS.easy);
    expect(decoded).not.toBeNull();
    expect(decoded!.field.mines).toEqual(session.board.field.mines);
    expect(decoded!.field.counts).toEqual(session.board.field.counts);
    expect(decoded!.opened).toEqual(session.board.opened);
    expect(decoded!.flagged).toEqual(session.board.flagged);
    expect(decoded!.exploded).toBeNull();
  });

  it('round-trips a lost board with the mine that ended it', () => {
    const session = started('mines-serialize-lost');
    const lost = tapCell(session, session.board.field.mines.findIndex(Boolean))!;
    const decoded = decodeBoard(encodeBoard(lost.board), PRESETS.easy)!;
    expect(decoded.exploded).toBe(lost.board.exploded);
    expect(isLost(decoded)).toBe(true);
  });

  it('restores a session from its parts', () => {
    const session = started('mines-restore');
    const { status: _status, ...rest } = session;
    const restored = restoreSession(rest);
    expect(restored.status).toBe('playing');
    expect(restored.board.opened).toEqual(session.board.opened);
    expect(restored.firstIndex).toBe(session.firstIndex);
  });

  it('fails closed on anything that does not add up', () => {
    const board = started('mines-corrupt').board;
    const good = encodeBoard(board);
    const easy = PRESETS.easy;

    // A board of the wrong shape for the difficulty it claims.
    expect(decodeBoard(good, PRESETS.medium)).toBeNull();
    expect(decodeBoard({ ...good, width: 8 }, easy)).toBeNull();
    // Strings of the wrong length, or with characters play cannot produce.
    expect(decodeBoard({ ...good, mines: '01' }, easy)).toBeNull();
    expect(decodeBoard({ ...good, opened: 'x'.repeat(81) }, easy)).toBeNull();
    expect(decodeBoard({ ...good, flagged: '2'.repeat(81) }, easy)).toBeNull();
    // A mine count that disagrees with the preset.
    expect(decodeBoard({ ...good, mines: '0'.repeat(81) }, easy)).toBeNull();
    // A cell both open and flagged.
    const openCell = board.opened.findIndex(Boolean);
    const flagged = board.flagged.map((_, i) => (i === openCell ? '1' : '0')).join('');
    expect(decodeBoard({ ...good, flagged }, easy)).toBeNull();
    // A mine that ended a game that is not marked as ended, and the reverse.
    const mine = board.field.mines.findIndex(Boolean);
    const openedMine = board.opened.map((o, i) => (o || i === mine ? '1' : '0')).join('');
    expect(decodeBoard({ ...good, opened: openedMine }, easy)).toBeNull();
    expect(decodeBoard({ ...good, exploded: mine }, easy)).toBeNull();
    expect(decodeBoard({ ...good, opened: openedMine, exploded: openCell }, easy)).toBeNull();
    expect(decodeBoard({ ...good, opened: openedMine, exploded: 9999 }, easy)).toBeNull();
    // The good record still decodes, so the checks above are not vacuous.
    expect(decodeBoard(good, easy)).not.toBeNull();
  });
});
