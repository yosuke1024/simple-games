import type { MahjongMessages } from './en';

export const de: MahjongMessages = {
  mahjongName: 'Mahjong Solitaire',
  mahjongBoardLabel: 'Mahjong-Brett, {n} Steine übrig',
  mahjongTilesLeft: '{n} Steine übrig',

  mahjongFaceCharacters: 'Zeichen {n}',
  mahjongFaceDots: 'Kreise {n}',
  mahjongFaceBamboo: 'Bambus {n}',
  mahjongFaceEast: 'Ostwind',
  mahjongFaceSouth: 'Südwind',
  mahjongFaceWest: 'Westwind',
  mahjongFaceNorth: 'Nordwind',
  mahjongFaceDragonRed: 'Roter Drache',
  mahjongFaceDragonGreen: 'Grüner Drache',
  mahjongFaceDragonWhite: 'Weißer Drache',
  mahjongFaceFlower: 'Blume {n}',
  mahjongFaceSeason: 'Jahreszeit {n}',

  mahjongTileFree: '{tile}, kann genommen werden',
  mahjongTileBlocked: '{tile}, blockiert',
  mahjongTileSelected: '{tile}, ausgewählt',

  mahjongStuckTitle: 'Keine freien Paare',
  mahjongStuckBody:
    'Nimm Züge zurück oder versuche dieses Brett erneut – beides ist kostenlos und unbegrenzt.',

  mahjongHintNone: 'Gerade ist kein Paar frei.',

  mahjongClearTitle: 'Geschafft!',
  mahjongClearBody: 'Alle Steine sind vom Brett.',
  mahjongHintsUsed: 'Verwendete Hinweise',
  mahjongNewBestTime: 'Deine Bestzeit.',

  mahjongLevelsCleared: 'Abgeschlossene Level',
  mahjongDailiesCleared: 'Abgeschlossene Tagesrätsel',
  mahjongDailyBacklogHint: 'Alle früheren Tage bleiben offen.',

  mahjongStep1Title: 'Gleiche Paare nehmen',
  mahjongStep1Body:
    'Tippe zwei Steine mit demselben Bild an, um sie zu entfernen. Ein Stein ist frei, wenn nichts auf ihm liegt und seine linke oder rechte Seite offen ist.',
  mahjongStep2Title: 'Blumen und Jahreszeiten sind Gruppen',
  mahjongStep2Body: 'Jede Blume passt zu jeder Blume, jede Jahreszeit zu jeder Jahreszeit.',
  mahjongStep3Title: 'Das Brett leeren',
  mahjongStep3Body:
    'Jedes Brett lässt sich vollständig abräumen. Bleibt kein Paar übrig, nimm Züge zurück oder starte neu – beides kostenlos und unbegrenzt.',
};
