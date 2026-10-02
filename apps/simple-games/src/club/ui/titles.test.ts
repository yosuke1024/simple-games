import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GAMES } from '@/app/registry';
import type { Challenge } from '../api/types';
import { contractFor } from '../contract/challenge';
import { challengeTitle, rankingTitle } from './ClubScreen';
import { modeLabel, type T } from './common';

/** Answers with the key (and the variables it was given), so a test sees which word was asked for. */
const t = ((key: string, vars?: Record<string, string | number>) =>
  vars === undefined
    ? key
    : `${key}(${Object.entries(vars)
        .map(([name, value]) => `${name}=${value}`)
        .join(',')})`) as T;

const challenge = (gameId: string, params: unknown, daily: string | null): Challenge => ({
  id: 'ch',
  gameId,
  contractVersion: 1,
  params,
  seed: 's',
  boardDigest: 'x1:00000000',
  title: null,
  createdBy: { id: 'm', nickname: 'Ken' },
  createdAt: '2026-10-02T00:00:00.000Z',
  resultCount: 1,
  mine: false,
  daily,
});

describe('mode words', () => {
  it('a. leaves a one-table game and a daily board out of the title', () => {
    expect(modeLabel('freecell', 'standard', t)).toBeNull();
    expect(modeLabel('water-sort', 'daily', t)).toBeNull();
    expect(modeLabel('quick-math', 'daily', t)).toBeNull();
    expect(rankingTitle('freecell', 'standard', t)).toBe('FreeCell');
    expect(challengeTitle(challenge('freecell', {}, '2026-10-02'), t)).toBe('FreeCell · clubDaily');
    expect(challengeTitle(challenge('water-sort', { tier: 'daily' }, '2026-10-02'), t)).toBe(
      'Water Sort · clubDaily',
    );
  });

  it('b. names Mahjong Solitaire’s table by the levels its layout covers, never by the id', () => {
    expect(modeLabel('mahjong-solitaire', 'turtle', t)).toBe('clubTier_levels(from=90,to=100)');
    expect(modeLabel('mahjong-solitaire', 'sprout', t)).toBe('clubTier_levels(from=1,to=8)');
    expect(modeLabel('mahjong-solitaire', 'garden', t)).toBe('clubTier_levels(from=79,to=89)');
    expect(rankingTitle('mahjong-solitaire', 'turtle', t)).toBe(
      'Mahjong Solitaire · clubTier_levels(from=90,to=100)',
    );
    expect(challengeTitle(challenge('mahjong-solitaire', { layout: 'steps' }, null), t)).toBe(
      'Mahjong Solitaire · clubTier_levels(from=9,to=16)',
    );
  });

  it('b. says only Daily for a Mahjong Solitaire daily: a level band says nothing about it', () => {
    expect(modeLabel('mahjong-solitaire', 'turtle', t, true)).toBeNull();
    expect(
      challengeTitle(challenge('mahjong-solitaire', { layout: 'turtle' }, '2026-10-02'), t),
    ).toBe('Mahjong Solitaire · clubDaily');
  });

  it('b. shows a layout the table does not know as written, never as a made-up band', () => {
    expect(modeLabel('mahjong-solitaire', 'newlayout', t)).toBe('newlayout');
  });

  it('c. reads a CPU opponent’s difficulty in the words of its own game', () => {
    for (const game of ['gin-rummy', 'hearts', 'mancala', 'reversi']) {
      expect(modeLabel(game, 'easy', t), game).toBe('clubTier_cpuEasy');
      expect(modeLabel(game, 'normal', t), game).toBe('clubTier_cpuNormal');
      expect(modeLabel(game, 'hard', t), game).toBe('clubTier_cpuHard');
    }
    expect(rankingTitle('hearts', 'normal', t)).toBe('Hearts · clubTier_cpuNormal');
    expect(challengeTitle(challenge('reversi', { difficulty: 'hard' }, '2026-10-02'), t)).toBe(
      'Reversi · clubTier_cpuHard · clubDaily',
    );
    // Only a CPU game: Sudoku's easy is the generic word.
    expect(modeLabel('hearts', 'easy', t)).toBe('clubTier_cpuEasy');
    expect(modeLabel('sudoku', 'easy', t)).toBe('clubTier_easy');
  });

  it('d. reads Dots and Boxes’ sizes as boxes per side, not as a difficulty', () => {
    expect(modeLabel('dots-and-boxes', 'small', t)).toBe('3×3');
    expect(modeLabel('dots-and-boxes', 'medium', t)).toBe('4×4');
    expect(modeLabel('dots-and-boxes', 'large', t)).toBe('5×5');
    expect(modeLabel('dots-and-boxes', 'medium', t)).not.toBe('clubTier_medium');
    expect(rankingTitle('dots-and-boxes', 'medium', t)).toBe('Dots and Boxes · 4×4');
    expect(challengeTitle(challenge('dots-and-boxes', { size: 'large' }, null), t)).toBe(
      'Dots and Boxes · 5×5',
    );
    // The game's own buttons (its catalog, read as text: club/ may not import a game).
    const catalog = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../../games/dots-and-boxes/i18n/en.ts'),
      'utf8',
    );
    for (const size of ['small', 'medium', 'large']) {
      const word = new RegExp(`dotsAndBoxesSize_${size}: '([^']+)'`).exec(catalog)?.[1];
      expect(word, size).toBeDefined();
      expect(modeLabel('dots-and-boxes', size, t), size).toBe(word!.replace(/ /g, ''));
    }
  });

  it('e. names Quick Math’s tracks in the words of the game’s own bands', () => {
    expect(modeLabel('quick-math', 'addsub', t)).toBe('clubTier_qmAddSub');
    expect(modeLabel('quick-math', 'multiply', t)).toBe('clubTier_qmMultiply');
    expect(modeLabel('quick-math', 'divide', t)).toBe('clubTier_qmDivide');
    expect(modeLabel('quick-math', 'missing', t)).toBe('clubTier_qmMissing');
    expect(modeLabel('quick-math', 'mixed', t)).toBe('clubTier_qmMixed');
    expect(rankingTitle('quick-math', 'addsub', t)).toBe('Quick Math · clubTier_qmAddSub');
  });

  it('f. writes a Schulte Table as its size and its order', () => {
    expect(modeLabel('schulte-table', '5x5-odd-then-even', t)).toBe('5×5 · clubTier_oddThenEven');
    expect(modeLabel('schulte-table', '3x3-ascending', t)).toBe('3×3 · clubTier_ascending');
    expect(modeLabel('schulte-table', '4x4-descending', t)).toBe('4×4 · clubTier_descending');
    expect(rankingTitle('schulte-table', '5x5-ascending', t)).toBe(
      'Schulte Table · 5×5 · clubTier_ascending',
    );
    expect(
      challengeTitle(
        challenge('schulte-table', { size: 4, order: 'oddThenEven' }, '2026-10-02'),
        t,
      ),
    ).toBe('Schulte Table · 4×4 · clubTier_oddThenEven · clubDaily');
    // An order the table does not know stays as written.
    expect(modeLabel('schulte-table', '5x5-spiral', t)).toBe('5×5-spiral');
  });

  it('g. names difficulties, Hit and Blow’s normal, Solitaire draws and Spider suits, and writes sizes as N×N', () => {
    expect(modeLabel('sudoku', 'easy', t)).toBe('clubTier_easy');
    expect(modeLabel('sudoku', 'medium', t)).toBe('clubTier_medium');
    expect(modeLabel('sudoku', 'hard', t)).toBe('clubTier_hard');
    expect(modeLabel('hit-and-blow', 'normal', t)).toBe('clubTier_normal');
    expect(modeLabel('hit-and-blow', 'easy', t)).toBe('clubTier_easy');
    expect(modeLabel('hit-and-blow', 'hard', t)).toBe('clubTier_hard');
    expect(modeLabel('solitaire', 'draw-1', t)).toBe('clubTier_draw1');
    expect(modeLabel('solitaire', 'draw-3', t)).toBe('clubTier_draw3');
    expect(modeLabel('spider-solitaire', '1-suit', t)).toBe('clubTier_suit1');
    expect(modeLabel('spider-solitaire', '2-suits', t)).toBe('clubTier_suits2');
    expect(modeLabel('spider-solitaire', '4-suits', t)).toBe('clubTier_suits4');
    expect(modeLabel('nonogram', '10x10', t)).toBe('10×10');
    expect(modeLabel('takuzu', '8x8', t)).toBe('8×8');
    expect(rankingTitle('hit-and-blow', 'normal', t)).toBe('Hit & Blow · clubTier_normal');
    expect(rankingTitle('sudoku', 'hard', t)).toBe('Sudoku · clubTier_hard');
    expect(challengeTitle(challenge('takuzu', { size: 8 }, '2026-10-02'), t)).toBe(
      'Takuzu · 8×8 · clubDaily',
    );
  });

  it('shows a key it has no word for as written, so an unfinished value is visible', () => {
    expect(modeLabel('sudoku', 'expert', t)).toBe('expert');
  });
});

/**
 * Every paramsKey every contract can produce, as the params that make it: the
 * Club writes a title from nothing else, and a value here that the title
 * shows raw ("Hearts · normal") is a mode a player cannot read. Each row is
 * run through the contract, so a spelling the contract changed fails here too.
 */
const STANDARD = [{ params: {}, key: 'standard' }];
const difficulties = (values: readonly string[], extra: object = {}) =>
  values.map((difficulty) => ({ params: { difficulty, ...extra }, key: difficulty }));
const squares = (sizes: readonly number[]) =>
  sizes.map((size) => ({ params: { size }, key: `${size}x${size}` }));
const EASY_MEDIUM_HARD = ['easy', 'medium', 'hard'];
const CPU = ['easy', 'normal', 'hard'];

const EVERY_KEY: Readonly<Record<string, readonly { params: unknown; key: string }[]>> = {
  '2048': STANDARD,
  'binary-balance': difficulties(EASY_MEDIUM_HARD),
  'block-puzzle': STANDARD,
  'box-regions': difficulties(EASY_MEDIUM_HARD),
  'bunny-hop': STANDARD,
  'crown-grid': difficulties(EASY_MEDIUM_HARD),
  dominoes: STANDARD,
  'dots-and-boxes': ['small', 'medium', 'large'].map((size) => ({ params: { size }, key: size })),
  freecell: STANDARD,
  futoshiki: squares([4, 5, 6, 7]),
  'gin-rummy': difficulties(CPU),
  hearts: difficulties(CPU),
  'hit-and-blow': difficulties(CPU),
  kakuro: squares([6, 8, 10]),
  'mahjong-solitaire': [
    'sprout',
    'steps',
    'terrace',
    'courtyard',
    'pagoda',
    'lantern',
    'bridge',
    'keep',
    'garden',
    'turtle',
  ].map((layout) => ({ params: { layout }, key: layout })),
  mancala: difficulties(CPU),
  'memory-match': difficulties(EASY_MEDIUM_HARD),
  minesweeper: difficulties(EASY_MEDIUM_HARD, { firstIndex: 0 }),
  nonogram: squares([5, 10]),
  'number-match': STANDARD,
  'number-path': difficulties(EASY_MEDIUM_HARD),
  'number-recall': STANDARD,
  'quick-math': [
    ['addSub', 'addsub'],
    ['multiply', 'multiply'],
    ['divide', 'divide'],
    ['missing', 'missing'],
    ['mixed', 'mixed'],
    ['daily', 'daily'],
  ].map(([track, key]) => ({ params: { track }, key: key! })),
  reversi: difficulties(CPU),
  'schulte-table': [3, 4, 5].flatMap((size) =>
    [
      ['ascending', 'ascending'],
      ['descending', 'descending'],
      ['oddThenEven', 'odd-then-even'],
    ].map(([order, name]) => ({ params: { size, order }, key: `${size}x${size}-${name}` })),
  ),
  'shape-regions': difficulties(EASY_MEDIUM_HARD),
  'sky-fighter': STANDARD,
  'sliding-puzzle': squares([3, 4, 5]),
  solitaire: [
    { params: { drawThree: false }, key: 'draw-1' },
    { params: { drawThree: true }, key: 'draw-3' },
  ],
  'spider-solitaire': [
    { params: { suitCount: 1 }, key: '1-suit' },
    { params: { suitCount: 2 }, key: '2-suits' },
    { params: { suitCount: 4 }, key: '4-suits' },
  ],
  'sudoku-6x6': difficulties(EASY_MEDIUM_HARD),
  sudoku: difficulties(EASY_MEDIUM_HARD),
  takuzu: squares([6, 8, 10]),
  'water-sort': ['easy', 'medium', 'hard', 'daily'].map((tier) => ({
    params: { tier },
    key: tier,
  })),
  yacht: STANDARD,
};

/** What a title may contain besides numbers: catalog keys (with the variables the fake `t` prints) and the `·` / `×` marks. */
const CATALOG_TOKEN = /clubTier_[A-Za-z0-9]+(?:\((?:[a-z]+=\d+,?)+\))?/g;

describe('every mode the contracts can produce reads as a word, never as the raw key', () => {
  it('has a row for every game with a challenge contract, and no other', () => {
    const withContract = GAMES.filter((game) => game.challenge !== undefined)
      .map((game) => game.id as string)
      .sort();
    expect(Object.keys(EVERY_KEY).sort()).toEqual(withContract);
    expect(withContract).toHaveLength(35);
  });

  it('lists every value the contract sources declare (a new value must be added here)', () => {
    // The sources' `const NAME = [...] as const` lists are the value sets of
    // validateParams; a table that does not multiply out to them is out of date.
    const gamesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../games');
    const sets = /^const [A-Z_0-9]+ = \[([^\]]*)\] as const;$/gm;
    for (const id of readdirSync(gamesDir)) {
      let source: string;
      try {
        source = readFileSync(join(gamesDir, id, 'challenge', 'contract.ts'), 'utf8');
      } catch {
        continue;
      }
      let expected = 1;
      for (const match of source.matchAll(sets)) {
        expected *= match[1]!.split(',').filter((part) => part.trim() !== '').length;
      }
      // Solitaire's boolean draw has no list; its table is two keys.
      if (id === 'solitaire') expected = 2;
      expect(EVERY_KEY[id]?.length, `${id}: rows in EVERY_KEY vs values in its contract`).toBe(
        expected,
      );
    }
  });

  for (const [gameId, rows] of Object.entries(EVERY_KEY)) {
    it(`${gameId}`, () => {
      const contract = contractFor(gameId);
      expect(contract, `${gameId} has a contract`).not.toBeNull();
      for (const { params, key } of rows) {
        const valid = contract!.validateParams(params);
        expect(valid, `${gameId} accepts ${JSON.stringify(params)}`).not.toBeNull();
        expect(contract!.paramsKey(valid!), `${gameId} ${JSON.stringify(params)}`).toBe(key);

        // The ranking table's title and the challenge's, daily or not.
        for (const label of [modeLabel(gameId, key, t), modeLabel(gameId, key, t, true)]) {
          if (label === null) continue;
          // Once the catalog words are taken out, only the numbers and marks of a size or
          // a band may remain: a lower-case ASCII word left over is the key, shown raw.
          const rest = label.replace(CATALOG_TOKEN, '');
          expect(rest, `${gameId} · ${key} → "${label}" shows part of the key raw`).not.toMatch(
            /[a-z]/,
          );
        }
      }
    });
  }
});
