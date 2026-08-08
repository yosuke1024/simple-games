/**
 * Mahjong Solitaire's own strings (issue #38): bundled into the game's
 * chunk, not the entry, and registered on chunk load by ./index.ts. The
 * shell's en.ts stays the source of truth for shared keys, this file for
 * this game's.
 *
 * Tile names are spoken, not just drawn (§12): a screen reader hears the
 * face and whether the tile can be taken, which is the whole board state.
 */
export const en = {
  mahjongName: 'Mahjong Solitaire',
  mahjongBoardLabel: 'Mahjong board, {n} tiles left',
  mahjongTilesLeft: '{n} tiles left',

  // The 42 faces, grouped the way matching works (§2).
  mahjongFaceCharacters: 'Characters {n}',
  mahjongFaceDots: 'Dots {n}',
  mahjongFaceBamboo: 'Bamboo {n}',
  mahjongFaceEast: 'East Wind',
  mahjongFaceSouth: 'South Wind',
  mahjongFaceWest: 'West Wind',
  mahjongFaceNorth: 'North Wind',
  mahjongFaceDragonRed: 'Red Dragon',
  mahjongFaceDragonGreen: 'Green Dragon',
  mahjongFaceDragonWhite: 'White Dragon',
  mahjongFaceFlower: 'Flower {n}',
  mahjongFaceSeason: 'Season {n}',

  // Tile state, appended to the face name.
  mahjongTileFree: '{tile}, can be taken',
  mahjongTileBlocked: '{tile}, blocked',
  mahjongTileSelected: '{tile}, selected',

  // The stuck notice (§7) — a fact, quietly stated; never an ending.
  mahjongStuckTitle: 'No free pairs match',
  mahjongStuckBody: 'Undo some moves or retry this board — both are free and unlimited.',

  mahjongHintNone: 'No matching pair is free right now.',

  // Result (§9).
  mahjongClearTitle: 'Cleared!',
  mahjongClearBody: 'Every tile is off the board.',
  mahjongHintsUsed: 'Hints used',
  mahjongNewBestTime: 'Your fastest yet.',

  // Statistics (§9).
  mahjongLevelsCleared: 'Levels cleared',
  mahjongDailiesCleared: 'Dailies cleared',
  mahjongDailyBacklogHint: 'Every earlier day stays open.',

  // Quick Rules (§11).
  mahjongStep1Title: 'Take matching pairs',
  mahjongStep1Body:
    'Tap two tiles with the same face to remove them. A tile can be taken when nothing rests on it and its left or right side is open.',
  mahjongStep2Title: 'Flowers and seasons are groups',
  mahjongStep2Body: 'Any flower matches any flower, and any season matches any season.',
  mahjongStep3Title: 'Clear the board',
  mahjongStep3Body:
    'Every board can be cleared. If no pairs are left, undo or retry — both are free and unlimited.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type MahjongMessages = Record<keyof typeof en, string>;
